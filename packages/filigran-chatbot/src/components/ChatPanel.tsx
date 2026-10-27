import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ChatArtifact, ChatArtifactKind, ChatAttachment, ChatPanelHandle, ChatPanelProps, ChatSendOutcome, Translate } from '../types';
import { answerMarkdownSources, artifactFileExtension, filenameFromContentDisposition, hexAlpha, markerKinds } from '../utils';
import { speakableText } from '../utils/speech';
import { optInRoute } from '../utils/routes';
import { themeVariables } from '../utils/theme';
import { createTranslate } from '../i18n';
import { feedbackBaseUrl } from '../utils/feedback';
import { conversationReferencesUrl } from '../utils/conversationRefs';
import { pendingWorkspaceStillFileable, returnRefreshDue } from '../utils/workspaces';
import { readRefusalDetail, requestHeadersKey } from '../utils/refusal';
import { parseArtifact, parseContextUsage, parseRestoredMessages, storedMessageId } from '../hooks/protocols/parseRestEvent';
import { mergeReadBack, useChat } from '../hooks/useChat';
import { askHost } from '../utils/askHost';
import { findAgent, useAgents } from '../hooks/useAgents';
import { useConversations } from '../hooks/useConversations';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { useSidebarResize } from '../hooks/useSidebarResize';
import { useAwayCompletionNotice } from '../hooks/useAwayCompletionNotice';
import { useComposerExtras } from '../hooks/useComposerExtras';
import { useAgentSuggestions } from '../hooks/useAgentSuggestions';
import { useLatestCallback, useShallowStable } from '../hooks/useStableProps';
import { useVoiceCall } from '../hooks/useVoiceCall';
import { PanelRequestsProvider, usePanelRequests, type PanelRequests } from '../hooks/usePanelRequests';
import { watchSessionEnd } from '../utils/sessionEnd';
import { AlertTriangleIcon, DefaultLogoIcon } from './icons';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { statusLineText } from './ChatThinking';
import { ChatVoiceCall } from './ChatVoiceCall';
import { waitingGameUrl } from './ChatWaitingPanel';
import { ChatWelcome } from './ChatWelcome';
import { ConversationSidebar } from './ConversationSidebar';

const FLOATING_WIDTH = 380;
const FLOATING_HEIGHT = 560;
const SIDEBAR_GAP = 6;
/** How long a message jumped to stays highlighted. */
const HIGHLIGHT_MS = 2000;
/** What the restore route answers, as far as the panel reads it. */
interface RestoredHistory {
  conversation_id?: unknown;
  agent_name?: unknown;
  has_more?: unknown;
  messages?: unknown[];
}
// A backend down, or out of its gateway's reach: it says nothing of the conversation asked for.
const BACKEND_DOWN_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);
// The credentials refused, not the conversation: kept, and read back once the host's credentials change.
const RESTORE_REFUSED_STATUSES: ReadonlySet<number> = new Set([401, 403]);
const RESTORE_RETRY_BASE_MS = 5000;
const RESTORE_RETRY_MAX_MS = 60000;

/**
 * Fallback suggestions, translated where they are written so extraction sees
 * the keys — the host's own list and the backend's are translated too (they may
 * be keys), but only these belong to the package.
 */
const defaultSuggestions = (t: Translate) => [
  t('Help me create a new simulation scenario'),
  t('What are the latest attack patterns?'),
  t('How do I configure detection rules?'),
  t('Summarize my recent findings'),
];

/**
 * The panel, its requests reporting the end of the user's session
 * (`onSessionEnded`): once per set of `requestHeaders`, whichever request or
 * stream said it first.
 */
export const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel(props, ref) {
  const onSessionEndedRef = useRef(props.onSessionEnded);
  onSessionEndedRef.current = props.onSessionEnded;
  const headersKeyRef = useRef('');
  headersKeyRef.current = requestHeadersKey(props.requestHeaders);
  const requests = useMemo<PanelRequests>(() => {
    let endedFor: string | null = null;
    const sessionEnded = (reason: string | undefined) => {
      if (!onSessionEndedRef.current || endedFor === headersKeyRef.current) return;
      endedFor = headersKeyRef.current;
      askHost(onSessionEndedRef.current, reason);
    };
    return { sessionEnded, fetch: watchSessionEnd(() => (onSessionEndedRef.current ? sessionEnded : undefined)) };
  }, []);
  return (
    <PanelRequestsProvider value={requests}>
      <ChatPanelBody {...props} ref={ref} />
    </PanelRequestsProvider>
  );
});

const ChatPanelBody = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanelBody(
  {
    mode,
    onClose,
    onModeChange,
    topOffset = 0,
    apiBaseUrl,
    apiEndpoints: apiEndpointsProp,
    agentDashboardUrl,
    waitingGameUrl: waitingGameUrlProp,
    user,
    t: hostT,
    accentColor = '#7b5cff',
    logoIcon,
    promptSuggestions: promptSuggestionsProp,
    draftBorderColor,
    resizable = false,
    onWidthChange,
    onResizeStart,
    onResizeEnd,
    disableFileManagement = false,
    onRelativeLinkClick: onRelativeLinkClickProp,
    onDownloadError: onDownloadErrorProp,
    maxFileCount,
    maxTotalSize,
    requestHeaders: requestHeadersProp,
    pageContext: pageContextProp,
    pushContentSelector,
    backendType = 'rest',
    miniGameEnabled = true,
    onPlayWaitingGame: onPlayWaitingGameProp,
    notifyOnComplete = true,
    onTaskComplete: onTaskCompleteProp,
    onMessageFeedback: onMessageFeedbackProp,
    locale,
    disableImagePreviews = false,
    contextUsageEnabled = true,
    composerToolbar,
    storageKeyPrefix,
    conversationId: controlledConversationId,
    onConversationChange: onConversationChangeProp,
    initialAgent,
    onAgentChange: onAgentChangeProp,
    readOnly = false,
    readOnlyNotice,
    getRequestExtras: getRequestExtrasProp,
    onStreamEvent: onStreamEventProp,
    markerRenderers: markerRenderersProp,
    codeBlockRenderers: codeBlockRenderersProp,
    transformMessageText,
    onArtifactOpen: onArtifactOpenProp,
    headerActions,
    banner,
    composerHeader,
    transcriptFooter,
    welcome,
    renderMessageExtras,
    messageFooterActions,
    sidebarRowActions,
    sidebarHeaderActions,
    sidebarSections,
    statusLabel,
    waitingMessages: waitingMessagesProp,
    renderWaitingPanel,
    fontFamily,
    theme,
    onReady: onReadyProp,
    onBeforeSend: onBeforeSendProp,
    onHeldSendSettled: onHeldSendSettledProp,
    onTurnRunningChange: onTurnRunningChangeProp,
    steerAttachments = false,
    holdSendsDuringTurn = false,
    agentMentions: agentMentionsEnabled = false,
    hideConversationList = false,
  },
  ref,
) {
  // Hosts tend to build these inline, so each host render hands the panel new
  // objects and functions with the same content. Held stable here, so a host
  // render re-renders no memoized message row, re-runs none of the effects
  // keyed on them (agent list, prompts, quota, suggestions, conversation list)
  // and refetches none of the images fetched with the headers. `t` passes
  // through as is, since a new one means new translations, and so do
  // ReactNode props, which cannot be compared.
  const apiEndpoints = useShallowStable(apiEndpointsProp);
  const requestHeaders = useShallowStable(requestHeadersProp);
  const pageContext = useShallowStable(pageContextProp);
  const promptSuggestions = useShallowStable(promptSuggestionsProp);
  const onRelativeLinkClick = useLatestCallback(onRelativeLinkClickProp);
  const onDownloadError = useLatestCallback(onDownloadErrorProp);
  const onPlayWaitingGame = useLatestCallback(onPlayWaitingGameProp);
  const onTaskComplete = useLatestCallback(onTaskCompleteProp);
  const onMessageFeedback = useLatestCallback(onMessageFeedbackProp);
  const onConversationChange = useLatestCallback(onConversationChangeProp);
  const onAgentChange = useLatestCallback(onAgentChangeProp);
  const getRequestExtras = useLatestCallback(getRequestExtrasProp);
  const onBeforeSend = useLatestCallback(onBeforeSendProp);
  const onHeldSendSettled = useLatestCallback(onHeldSendSettledProp);
  const onStreamEvent = useLatestCallback(onStreamEventProp);
  const onTurnRunningChange = useLatestCallback(onTurnRunningChangeProp);
  // A click handler, not content: held stable so a host's inline one spares every row.
  const onArtifactOpen = useLatestCallback(onArtifactOpenProp);
  const rootRef = useRef<HTMLDivElement>(null);
  const { fetch: panelFetch, sessionEnded } = usePanelRequests();
  // The panel's own catalog in `locale`, under whatever the host translates itself.
  const t = useMemo(() => createTranslate(hostT, locale), [hostT, locale]);
  const waitingMessages = useShallowStable(waitingMessagesProp);
  // The host's marker cards by upper-cased name, the form the parser reads.
  const markerRenderers = useMemo(
    () => (markerRenderersProp ? Object.fromEntries(Object.entries(markerRenderersProp).map(([k, r]) => [k.toUpperCase(), r])) : undefined),
    [markerRenderersProp],
  );
  // The host's code block renderers by lower-cased fence language, the form the renderer looks up.
  const codeBlockRenderers = useShallowStable(
    useMemo(
      () => (codeBlockRenderersProp ? Object.fromEntries(Object.entries(codeBlockRenderersProp).map(([k, r]) => [k.toLowerCase(), r])) : undefined),
      [codeBlockRenderersProp],
    ),
  );
  const markerKindList = useShallowStable(useMemo(() => markerKinds(markerRenderers && Object.keys(markerRenderers)), [markerRenderers]));
  const thinking = useMemo(() => ({ statusLabel, waitingMessages, renderWaitingPanel }), [statusLabel, waitingMessages, renderWaitingPanel]);
  // Inline mode is laid out like fullscreen, inside the host's container.
  const isWide = mode === 'fullscreen' || mode === 'inline';

  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const {
    agents,
    agentsLoading,
    agentsError,
    agentsSettled,
    agentsDisabled,
    selectedAgent,
    agentMenuOpen,
    setAgentMenuOpen,
    handleSwitchAgent,
    reloadAgents,
  } = useAgents({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    requestHeaders,
    storageKeyPrefix,
    initialAgent,
    onAgentChange: onAgentChangeProp ? onAgentChange : undefined,
  });

  // The conversation whose restore settled (read back, failed or nothing to
  // read): the skeleton and onReady wait for it.
  const [historySettledId, setHistorySettledId] = useState<string | null>(null);
  const restoringIdRef = useRef<string | null>(null);
  // The conversation whose history this panel actually holds: only its event
  // stream is followed, so a relayed turn never lands in an empty transcript.
  const [eventsReadyId, setEventsReadyId] = useState<string | null>(null);
  // The conversation the gate above was last checked for, kept in state so a
  // render React throws away takes its reset with it.
  const [eventsGateFor, setEventsGateFor] = useState<string | null | undefined>(undefined);
  // A read-back that came while a turn was on screen: put above that turn as
  // soon as it ends.
  const [restorePostponed, setRestorePostponed] = useState<{ conversationId: string; data: RestoredHistory } | null>(null);
  // A conversation the backend could not be reached for: read back once it can.
  const [restoreOwedId, setRestoreOwedId] = useState<string | null>(null);
  const restoreAttemptsRef = useRef(0);
  // A conversation whose read-back refused the credentials (401, 403): what the
  // backend said, and the headers it refused.
  const [restoreRefused, setRestoreRefused] = useState<{ conversationId: string; detail: string | null; headersKey: string } | null>(null);
  // Retitled elsewhere, or by the backend after the first answer.
  const refreshConversationsRef = useRef<() => Promise<unknown>>(async () => undefined);
  // Every frame of both streams goes to the voice call first, then to the
  // host: each on its own, so neither throwing keeps the frame from the other.
  const voiceFrameRef = useRef<(frame: Record<string, unknown>, relayed: boolean) => void>(() => undefined);
  const handleStreamFrame = useCallback(
    (frame: Record<string, unknown>, info: { relayed: boolean }) => {
      askHost(voiceFrameRef.current, frame, info.relayed);
      askHost(onStreamEvent, frame, info);
    },
    [onStreamEvent],
  );

  const {
    messages,
    inputValue,
    setInputValue,
    isLoading,
    turnRunning,
    sendsHeld,
    turnEnd,
    agentStatus,
    attachedFiles,
    conversationId,
    contextUsage,
    transferredAgent,
    canSteer,
    pendingApprovals,
    isSubmittingApproval,
    approvalError,
    submitApprovalDecisions,
    isResumingAfterDecision,
    historyReloadNonce,
    reloadHistory,
    mergeTurnHistory,
    settleUnseenEnd,
    historyLoadedRef,
    conversationIdRef,
    handleFileAdd,
    handlePaste,
    handleSendMessage,
    skipWait,
    readPendingApprovals,
    heldMessage,
    notice,
    cancelHeldMessage,
    agentMentions,
    addAgentMention,
    handleNewChat,
    pendingWorkspaceId,
    clearPendingWorkspace,
    handleStopGenerating,
    conversationRefs,
    addConversationRef,
    setAttachedFiles,
    setMessages,
    setContextUsage,
    updateConversationId,
    handleSwitchConversation,
  } = useChat({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    agentSlug: selectedAgent?.slug,
    requestHeaders,
    pageContext,
    onRelativeLinkClick: onRelativeLinkClickProp ? onRelativeLinkClick : undefined,
    t,
    maxFileCount,
    maxTotalSize,
    storageKeyPrefix,
    controlledConversationId,
    onConversationIdChange: onConversationChangeProp ? onConversationChange : undefined,
    getRequestExtras: getRequestExtrasProp ? getRequestExtras : undefined,
    onStreamEvent: handleStreamFrame,
    onSessionEnded: sessionEnded,
    onConversationTitle: () => void refreshConversationsRef.current(),
    historySettledFor: eventsReadyId,
    steerAttachments,
    holdSends: holdSendsDuringTurn,
    agentMentionsEnabled,
    onBeforeSend: onBeforeSendProp ? onBeforeSend : undefined,
    onHeldSendSettled: onHeldSendSettledProp ? onHeldSendSettled : undefined,
  });
  // A conversation left and come back to waits for its history again before
  // its event stream is followed. Reset while rendering, so the hook never
  // opens the stream on the earlier visit's word.
  if (eventsGateFor !== conversationId) {
    setEventsGateFor(conversationId);
    if (eventsReadyId !== null) setEventsReadyId(null);
  }

  // A host that owns the conversation (a `?c=` URL) moves the panel with it.
  useEffect(() => {
    if (controlledConversationId === undefined || controlledConversationId === conversationIdRef.current) return;
    if (controlledConversationId) handleSwitchConversation(controlledConversationId);
    else handleNewChat();
    // Only a change of the host's id moves the panel; the panel's own changes
    // reach the host through `onConversationChange`.
  }, [controlledConversationId]);

  const { suggestions: agentSuggestions, loading: suggestionsLoading } = useAgentSuggestions({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    requestHeaders,
    agentSlug: selectedAgent?.slug,
  });

  /**
   * Suggestions shown on the welcome screen, resolved to final text here rather
   * than in `ChatWelcome`: the backend's and the host's lists still go through
   * `t` (a host may well pass keys), while the package's own fallback is
   * translated at its definition so the keys stay extractable.
   */
  const suggestions = useMemo(
    () => (agentSuggestions ?? promptSuggestions)?.map((s) => t(s)) ?? defaultSuggestions(t),
    [agentSuggestions, promptSuggestions, t],
  );

  const { prompts, quota, refreshQuota } = useComposerExtras({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    requestHeaders,
  });

  const {
    historyEnabled,
    conversations,
    conversationsLoading,
    refreshConversations,
    deleteConversation,
    renameConversation,
    moveConversation,
    clearConversations,
  } = useConversations({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    requestHeaders,
  });
  refreshConversationsRef.current = refreshConversations;
  // Workspaces group the fullscreen list, when the host names their route.
  const { workspacesEnabled, workspaces, refreshWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace } = useWorkspaces({
    apiBaseUrl,
    apiEndpoints,
    backendType,
    requestHeaders,
  });
  // A pending workspace deleted, archived or unshared elsewhere leaves the
  // refreshed list: the next conversation must not be created in it.
  useEffect(() => {
    if (workspacesEnabled && pendingWorkspaceId && !pendingWorkspaceStillFileable(pendingWorkspaceId, workspaces)) {
      clearPendingWorkspace(pendingWorkspaceId);
    }
  }, [workspacesEnabled, workspaces, pendingWorkspaceId, clearPendingWorkspace]);
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);

  // Fullscreen shows the conversation list permanently, so it has to be
  // fetched on entry rather than lazily when a menu opens. Kept collapsible:
  // fullscreen is also the mode people use to read a long answer.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // A host may give the thread the whole width (a rail, a task pane): the
  // header's history menu then stands in for the list.
  const showConversationSidebar = isWide && historyEnabled && !hideConversationList;

  // Re-read on entry AND whenever the active conversation changes, so a chat
  // created by the first send appears in the list. The header menu could fetch
  // lazily on open; a permanent list has no such moment, and a stale sidebar
  // that never shows the conversation you are in is worse than no sidebar.
  useEffect(() => {
    if (showConversationSidebar) void refreshConversations();
  }, [showConversationSidebar, conversationId, refreshConversations]);

  // The workspaces are also changed elsewhere (the XTM One web chat, another
  // tab): read on entry, after every write the sidebar makes (the hook
  // re-reads them), on each conversation switch, at the end of each turn and
  // on each return to the page - a group deleted there must not linger here.
  useEffect(() => {
    if (showConversationSidebar) void refreshWorkspaces();
  }, [showConversationSidebar, conversationId, refreshWorkspaces]);

  // Back to the page (from the XTM One tab, say): both lists may have moved.
  const lastReturnRefreshRef = useRef<number | null>(null);
  useEffect(() => {
    if (!showConversationSidebar) return;
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!returnRefreshDue(now, lastReturnRefreshRef.current)) return;
      lastReturnRefreshRef.current = now;
      void refreshConversations();
      void refreshWorkspaces();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [showConversationSidebar, refreshConversations, refreshWorkspaces]);

  // The host hears when a turn starts or stops running, once per change, with
  // how it ended, and that it stopped when the panel goes away in the middle
  // of one.
  const reportedRunningRef = useRef(false);
  useEffect(() => {
    if (reportedRunningRef.current === turnRunning) return;
    reportedRunningRef.current = turnRunning;
    if (turnRunning) askHost(onTurnRunningChange, true);
    else askHost(onTurnRunningChange, false, { ended: turnEnd ?? 'stopped' });
  }, [turnRunning, turnEnd, onTurnRunningChange]);
  useEffect(
    () => () => {
      if (!reportedRunningRef.current) return;
      reportedRunningRef.current = false;
      askHost(onTurnRunningChange, false, { ended: 'stopped' });
    },
    [onTurnRunningChange],
  );

  // A finished turn has consumed allowance and may have retitled the chat.
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (wasLoadingRef.current && !turnRunning) {
      refreshQuota();
      // The backend titles a conversation from its first message, so the row
      // stays "New conversation" until the turn is read back. A conversation
      // that could not be created in its workspace (deleted elsewhere) is
      // read back unfiled: the workspaces are re-read with it.
      if (showConversationSidebar) {
        void refreshConversations();
        void refreshWorkspaces();
      }
    }
    wasLoadingRef.current = turnRunning;
  }, [turnRunning, refreshQuota, showConversationSidebar, refreshConversations, refreshWorkspaces]);

  const handleHistoryMenuToggle = () => {
    // Computed from the committed state in the event handler — NOT inside the
    // state updater, which must stay pure (StrictMode/concurrent rendering may
    // invoke updaters more than once, which would duplicate the fetch).
    const next = !historyMenuOpen;
    if (next) {
      // Fetch lazily on open so the list reflects the latest server state
      // (titles are rewritten by the backend after the first message).
      void refreshConversations();
    }
    setHistoryMenuOpen(next);
  };

  const handleSelectConversation = (id: string) => {
    setHistoryMenuOpen(false);
    handleSwitchConversation(id);
  };

  // The `@` conversation menu of the composer, when the host names its route.
  const conversationReferencesSearchUrl = conversationReferencesUrl(apiBaseUrl, apiEndpoints, backendType);

  // A referenced conversation's chip opens it in the panel when it is one the
  // conversation list holds, so the list is read as soon as the thread shows
  // a reference - not only once the history menu has been opened - and again
  // for each conversation switched to, whose chips may name newer ones.
  const openableConversationIds = useMemo(() => new Set(conversations.map((c) => c.conversationId)), [conversations]);
  const onOpenConversation = useLatestCallback(historyEnabled ? handleSelectConversation : undefined);
  const threadReferencesConversations = messages.some((m) => (m.conversationRefs?.length ?? 0) > 0);
  useEffect(() => {
    if (threadReferencesConversations && historyEnabled) void refreshConversations();
  }, [threadReferencesConversations, historyEnabled, refreshConversations, conversationId]);

  // Older messages the backend holds beyond the restored ones (`messagesPage`).
  const messagesPageBase = optInRoute(apiBaseUrl, apiEndpoints, backendType, 'messagesPage');
  const [serverHasEarlier, setServerHasEarlier] = useState(false);
  const ttsUrl = optInRoute(apiBaseUrl, apiEndpoints, backendType, 'tts');
  const ttsRoute = useMemo(() => (ttsUrl ? { url: ttsUrl, requestHeaders } : undefined), [ttsUrl, requestHeaders]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => setServerHasEarlier(false), [conversationId]);
  const loadEarlier = useCallback(async (): Promise<number> => {
    const convId = conversationIdRef.current;
    const oldest = messagesRef.current.find((m) => m.serverId)?.serverId;
    if (!messagesPageBase || !convId || !oldest) {
      setServerHasEarlier(false);
      return 0;
    }
    try {
      const res = await panelFetch(
        `${messagesPageBase}/${encodeURIComponent(convId)}/messages?before=${encodeURIComponent(oldest)}&limit=50&supports_artifacts=true`,
        {
          headers: { ...(requestHeaders ?? {}) },
        },
      );
      if (!res.ok || conversationIdRef.current !== convId) return 0;
      const data = await res.json();
      if (conversationIdRef.current !== convId) return 0;
      const known = new Set(messagesRef.current.map((m) => m.serverId).filter(Boolean));
      const earlier = parseRestoredMessages(data?.messages)
        .filter((m) => !m.serverId || !known.has(m.serverId))
        .map((m) => ({ ...m, id: storedMessageId(m.serverId) }));
      setMessages((prev) => [...earlier, ...prev]);
      setServerHasEarlier(data?.has_more === true && earlier.length > 0);
      return earlier.length;
    } catch {
      return 0;
    }
  }, [messagesPageBase, conversationIdRef, requestHeaders, setMessages]);

  /**
   * Put a conversation's history read back on screen. *merge*: a turn ran
   * meanwhile, and the history joins what is shown (see `mergeReadBack`).
   */
  const applyRestoredHistory = (convId: string, data: RestoredHistory, merge: boolean) => {
    setEventsReadyId(convId);
    setServerHasEarlier(!!messagesPageBase && data.has_more === true);
    if (!data.messages?.length) return;
    const restored = parseRestoredMessages(data.messages);
    if (merge) {
      setMessages((prev) => mergeReadBack(prev, restored));
      return;
    }
    setMessages(restored);
    // The context gauge is conversation state, not per-message: the NEWEST
    // entry that carries a reading is the current occupancy. Scanned from
    // the end so a turn that predates the field (or a user message) falls
    // through to the last one that has it, rather than blanking the gauge.
    for (let i = data.messages.length - 1; i >= 0; i -= 1) {
      const usage = parseContextUsage(data.messages[i] as Record<string, unknown>);
      if (usage) {
        setContextUsage(usage);
        break;
      }
    }
  };

  // An owed read-back is tried again with backoff, and at once when the
  // browser is back online or the page is shown again - never over a turn
  // on screen, which the history read back would replace.
  const isLoadingNowRef = useRef(isLoading);
  isLoadingNowRef.current = isLoading;
  useEffect(() => {
    restoreAttemptsRef.current = 0;
  }, [conversationId]);
  useEffect(() => {
    if (!restorePostponed || isLoading) return;
    setRestorePostponed(null);
    if (restorePostponed.conversationId === conversationId) applyRestoredHistory(restorePostponed.conversationId, restorePostponed.data, true);
  }, [restorePostponed, isLoading, conversationId]);
  useEffect(() => {
    if (!restoreOwedId || restoreOwedId !== conversationId || isLoading) return;
    const retry = () => {
      if (isLoadingNowRef.current) return;
      setRestoreOwedId(null);
      restoreAttemptsRef.current += 1;
      reloadHistory();
    };
    const delay = Math.min(RESTORE_RETRY_MAX_MS, RESTORE_RETRY_BASE_MS * 2 ** restoreAttemptsRef.current);
    const timer = window.setTimeout(retry, delay);
    const onVisible = () => {
      if (document.visibilityState === 'visible') retry();
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [restoreOwedId, conversationId, isLoading, reloadHistory]);

  // A read-back refused for its credentials is tried again once the host's
  // credentials change (a token refreshed), or when the user asks.
  const headersKey = requestHeadersKey(requestHeaders);
  const retryRefusedRestore = useCallback(() => {
    setRestoreRefused(null);
    reloadHistory();
  }, [reloadHistory]);
  useEffect(() => {
    if (!restoreRefused || restoreRefused.conversationId !== conversationId || isLoading) return;
    if (restoreRefused.headersKey !== headersKey) retryRefusedRestore();
  }, [restoreRefused, conversationId, isLoading, headersKey, retryRefusedRestore]);
  const refusedRestore = restoreRefused && restoreRefused.conversationId === conversationId ? restoreRefused : null;

  // A conversation being read back shows its shape, not the welcome screen.
  const restoreEnabled = backendType === 'rest' && !apiEndpoints?.singleEndpoint && apiEndpoints?.sessions !== null;
  const restoringHistory = restoreEnabled && !!conversationId && historySettledId !== conversationId;

  // Files dragged over the thread attach on drop, as picking them would.
  const canDropFiles =
    !readOnly && !disableFileManagement && backendType === 'rest' && !apiEndpoints?.singleEndpoint && apiEndpoints?.upload !== null;
  const [dropping, setDropping] = useState(false);
  const dragDepthRef = useRef(0);
  const carriesFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');
  const dropHandlers = canDropFiles
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!carriesFiles(e)) return;
          dragDepthRef.current += 1;
          setDropping(true);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!carriesFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!carriesFiles(e)) return;
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDropping(false);
        },
        onDrop: (e: React.DragEvent) => {
          if (!carriesFiles(e)) return;
          e.preventDefault();
          // The host's own drop zones under the panel do not take the files too.
          e.stopPropagation();
          dragDepthRef.current = 0;
          setDropping(false);
          handleFileAdd(e.dataTransfer.files);
        },
      }
    : {};

  const handleClearAll = async () => {
    if (await clearConversations?.()) handleNewChat();
  };

  const handleDeleteConversation = async (id: string) => {
    const deleted = await deleteConversation(id);
    // Deleting the active conversation resets to a fresh chat so the next
    // message doesn't target a dead conversation id.
    if (deleted && id === conversationIdRef.current) {
      handleNewChat();
    }
  };

  const { sidebarWidth, handleResizeStart, defaultWidth, isResizing } = useSidebarResize({
    mode,
    resizable,
    onWidthChange,
    onResizeStart,
    onResizeEnd,
    storageKeyPrefix,
  });

  // Push content when sidebar mode is active using CSS variable
  useEffect(() => {
    const width = mode === 'sidebar' ? (resizable ? sidebarWidth : defaultWidth) : 0;
    const pushWidth = width > 0 ? width + SIDEBAR_GAP : 0;

    // Set CSS variable on :root for any component to use
    document.documentElement.style.setProperty('--chatbot-sidebar-width', `${pushWidth}px`);
    document.documentElement.style.setProperty('--chatbot-transition', isResizing ? 'none' : 'all 225ms cubic-bezier(0.4, 0, 0.2, 1)');

    // Also apply to pushContentSelector if provided (for simple cases)
    if (pushContentSelector) {
      const contentElement = document.querySelector<HTMLElement>(pushContentSelector);
      if (contentElement) {
        const originalPaddingRight = contentElement.style.paddingRight;
        const originalTransition = contentElement.style.transition;

        contentElement.style.paddingRight = pushWidth > 0 ? `${pushWidth}px` : '';
        contentElement.style.transition = isResizing ? 'none' : 'padding-right 225ms cubic-bezier(0.4, 0, 0.2, 1)';

        return () => {
          contentElement.style.paddingRight = originalPaddingRight;
          contentElement.style.transition = originalTransition;
          document.documentElement.style.setProperty('--chatbot-sidebar-width', '0px');
        };
      }
    }

    return () => {
      document.documentElement.style.setProperty('--chatbot-sidebar-width', '0px');
    };
  }, [pushContentSelector, mode, sidebarWidth, defaultWidth, resizable, isResizing]);

  // Stable across renders so the memoized message rows (which take it as a
  // prop) aren't invalidated on every streamed frame.
  const resolvedLogo = useMemo(() => logoIcon ?? <DefaultLogoIcon size={24} />, [logoIcon]);
  const playUrl = useMemo(() => waitingGameUrl(agentDashboardUrl, waitingGameUrlProp), [agentDashboardUrl, waitingGameUrlProp]);
  const firstName = user.firstName;
  /**
   * The agent a *restored* conversation belongs to, as the backend reports it.
   *
   * Sits between the live transfer and the menu selection: the backend routes
   * a reopened conversation, and its new replies, to its own stored agent
   * whichever agent is selected, so that is the agent its label names.
   */
  const [conversationAgentName, setConversationAgentName] = useState<string | null>(null);
  const agentName = transferredAgent?.name || conversationAgentName || selectedAgent?.name || t('Assistant');

  // "Viewing the chat" must mean the panel is on screen in the active tab —
  // NOT that an element inside it currently holds focus. In sidebar (and
  // floating) mode the user routinely reads a streamed answer while their focus
  // stays in the host app, so the previous focus-within test
  // (`document.activeElement.closest('.filigran-chatbot.fixed')`) wrongly
  // classified them as "not viewing" and fired a redundant completion toast for
  // an answer sitting right in front of them. The host mounts `<ChatPanel/>`
  // only while the widget is open, so a mounted + visible panel root means the
  // answer is visible to the user; the notifier still treats a hidden tab or an
  // unfocused window as "away" and notifies there. A host that keeps the panel
  // mounted but `display:none` while "closed" is likewise reported as not
  // viewing (checkVisibility() === false), so completion still notifies. The
  // `.fixed` qualifier targets the panel root, never the toggle button (which
  // carries `.filigran-chatbot` alone). Stable reference (useCallback) so the
  // notifier's effect doesn't re-run on every render — the panel re-renders
  // frequently while a response streams; the DOM is queried live on each call.
  const isViewingChat = useCallback(() => {
    const panel = rootRef.current as (HTMLElement & { checkVisibility?: () => boolean }) | null;
    if (!panel) return false;
    if (typeof panel.checkVisibility === 'function') return panel.checkVisibility();
    // Fallback for browsers without Element.checkVisibility(): a display:none
    // panel generates no layout box, so an empty client-rect list means hidden
    // (works for the position:fixed root, whose offsetParent is null even when
    // shown). Erring toward "not viewing" keeps the documented closed/hidden
    // path notifying instead of silently swallowing the notice on older engines.
    return panel.getClientRects().length > 0;
  }, []);

  // Notify when a long turn finishes and the user is not watching the chat —
  // away (tab hidden / another window / panel closed-or-hidden). An open,
  // on-screen panel in the focused tab counts as watching, so no toast fires
  // for an answer the user can already see.
  useAwayCompletionNotice({
    isLoading: turnRunning,
    agentName,
    t,
    enabled: notifyOnComplete,
    onComplete: onTaskComplete,
    isViewingChat,
  });

  // Download an agent-generated file. The URL is resolved against the host
  // app's own backend proxy (apiBaseUrl), NOT the upstream chat service:
  // the proxy mints any upstream token server-side, so the user stays
  // authenticated to the host platform (e.g. OpenCTI / OpenAEV) only and
  // never logs in to the upstream service. Same-origin cookies +
  // requestHeaders (CSRF / draft context) carry the host-app auth.
  // Downloads need a path to build the URL from. Enabled for the REST
  // backend unless explicitly disabled (`download === null`). In
  // single-endpoint mode there is no per-path routing, so a download path
  // must be provided explicitly (e.g. an OpenCTI-style proxy route);
  // otherwise the default REST `/chat/files` path is used.
  const downloadPathProvided = apiEndpoints?.download !== null && apiEndpoints?.download !== undefined;
  const canDownload = backendType === 'rest' && apiEndpoints?.download !== null && (!apiEndpoints?.singleEndpoint || downloadPathProvided);

  // The host-proxied URL of an attachment. Shared by the download action and
  // the inline image preview so both resolve against the same proxy route.
  const resolveAttachmentUrl = useCallback(
    (att: ChatAttachment) => {
      const base = apiEndpoints?.download ?? '/chat/files';
      return `${apiBaseUrl}${base}/${encodeURIComponent(att.fileId)}/download`;
    },
    [apiBaseUrl, apiEndpoints],
  );

  const handleDownloadFile = useCallback(
    async (att: ChatAttachment) => {
      const url = resolveAttachmentUrl(att);
      try {
        const res = await panelFetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { ...(requestHeaders ?? {}) },
        });
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = att.filename || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        // Surface the failure (403/404/5xx/network) to the host so it can
        // notify the user — the chatbot has no toast surface of its own.
        // If the host doesn't provide a handler the error is intentionally
        // not thrown further (a rejected click handler has nowhere to go).
        onDownloadError?.(err, att);
      }
    },
    [resolveAttachmentUrl, requestHeaders, onDownloadError],
  );

  // The decks, reports and videos an answer made are downloaded and followed
  // through the host's proxy too, once the host names the route
  // (`apiEndpoints.artifacts`, no default). Without it the cards still show
  // and link to XTM One.
  const artifactsBase = backendType === 'rest' && apiEndpoints?.artifacts ? `${apiBaseUrl}${apiEndpoints.artifacts}` : null;
  const artifactUrl = useCallback(
    (kind: ChatArtifactKind, id: string) => `${artifactsBase}/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`,
    [artifactsBase],
  );

  const handleDownloadArtifact = useCallback(
    async (artifact: ChatArtifact, format: string) => {
      const fallbackName = `${artifact.title || artifact.kind}.${artifactFileExtension(format)}`;
      try {
        const res = await panelFetch(`${artifactUrl(artifact.kind, artifact.id)}/download`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
          body: JSON.stringify({ format }),
        });
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filenameFromContentDisposition(res.headers.get('content-disposition')) ?? fallbackName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        // The host's notification path for a failed download, named after the
        // file the user asked for.
        onDownloadError?.(err, { fileId: artifact.id, filename: fallbackName, type: format.toUpperCase() });
      }
    },
    [artifactUrl, requestHeaders, onDownloadError],
  );

  const handleRefreshArtifact = useCallback(
    async (kind: ChatArtifactKind, id: string) => {
      const res = await panelFetch(artifactUrl(kind, id), { credentials: 'include', headers: { ...(requestHeaders ?? {}) } });
      if (!res.ok) return undefined;
      return parseArtifact(await res.json());
    },
    [artifactUrl, requestHeaders],
  );

  const cssVars = {
    '--chat-accent': accentColor,
    '--chat-accent-10': hexAlpha(accentColor, 0.1),
    '--chat-accent-40': hexAlpha(accentColor, 0.25),
    '--chat-accent-50': hexAlpha(accentColor, 0.5),
    '--chat-accent-dark': accentColor,
    ...(fontFamily ? { fontFamily } : {}),
    ...themeVariables(theme),
  } as React.CSSProperties;

  // The restore merges a replayed turn's read-back through this, outside its deps.
  const mergeTurnHistoryRef = useRef(mergeTurnHistory);
  mergeTurnHistoryRef.current = mergeTurnHistory;
  const settleUnseenEndRef = useRef(settleUnseenEnd);
  settleUnseenEndRef.current = settleUnseenEnd;

  // Tracks whether this panel is still mounted. Flipped to false ONLY on a
  // real unmount (empty-deps cleanup) — never on the benign teardowns that an
  // inline `apiEndpoints` / `requestHeaders` prop churn or a StrictMode
  // double-invoke trigger. The restore effect below reads it so an in-flight
  // `/chat/sessions` response that outlives the panel — the host renders
  // `<ChatPanel />` conditionally and the user closes it mid-request — can't
  // call `setMessages` / `updateConversationId` after unmount, while a restore
  // merely interrupted by a re-render still lands. Re-set to true on setup so
  // StrictMode's mount → unmount → remount of the same instance leaves it true.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load conversation history when agent is selected
  useEffect(() => {
    // Skip session history if disabled, using single endpoint mode, or non-REST backend
    if (apiEndpoints?.sessions === null || apiEndpoints?.singleEndpoint || backendType === 'legacy' || backendType === 'ag-ui') return;
    // No conversation means a fresh chat — "New conversation", or an agent
    // switch, both of which null the id. Drop the restored thread's agent with
    // it, or the new chat would keep wearing the old one's name.
    if (!conversationId) {
      setConversationAgentName(null);
      setHistorySettledId(null);
      return;
    }
    if (historyLoadedRef.current) {
      // Created by this panel, or already restored: nothing to wait for.
      if (restoringIdRef.current !== conversationId && historySettledId !== conversationId) setHistorySettledId(conversationId);
      // A history held back behind a turn opens the gate when it is put on screen.
      if (restoringIdRef.current !== conversationId && eventsReadyId !== conversationId && restorePostponed?.conversationId !== conversationId) {
        setEventsReadyId(conversationId);
      }
      return;
    }
    // The agent goes with the restore, so it waits for one - unless the host
    // serves no agent list at all. A list that failed or holds none restores
    // nothing, yet the panel is not left waiting: the id is kept for a later try.
    if (!selectedAgent && !agentsDisabled) {
      if (agentsSettled && historySettledId !== conversationId) setHistorySettledId(conversationId);
      return;
    }
    historyLoadedRef.current = true;
    restoringIdRef.current = conversationId;
    setHistorySettledId(null);
    const sessionsUrl = `${apiBaseUrl}${apiEndpoints?.sessions ?? '/chat/sessions'}`;

    // The conversation this restore is being issued for. A host re-render that
    // churns an inline `apiEndpoints` / `requestHeaders` prop, or a React
    // StrictMode double-invoke, tears this effect down and re-runs it while the
    // request is still in flight — but the conversation itself hasn't changed.
    // We must NOT drop the restore in those benign cases (doing so left the
    // panel looking like a brand-new chat, randomly, on reload). Only a real
    // change — the user starting a new chat or switching agent, both of which
    // reset the id via `handleNewChat()` — should abandon the response, so it
    // can't resurrect a dead id or overwrite the freshly-started conversation.
    // Compare the live ref at apply time (not a blanket teardown flag) so the
    // legitimate restore always lands while a superseded one is still ignored —
    // and bail out entirely once the panel has actually unmounted, so a late
    // response can't write to localStorage / state after the panel is gone.
    const requestedConversationId = conversationId;
    const isStale = () => !isMountedRef.current || conversationIdRef.current !== requestedConversationId;
    const requestedHeadersKey = requestHeadersKey(requestHeaders);
    // What a turn that ended out of sight is told of this read-back (see `settleUnseenEnd`).
    const readFor = historyReloadNonce;

    panelFetch(sessionsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(requestHeaders ?? {}) },
      body: JSON.stringify({
        conversation_id: conversationId,
        agent_slug: selectedAgent?.slug,
        supports_artifacts: true,
      }),
    })
      .then((res) => {
        if (isStale()) return null;
        if (!res.ok) {
          settleUnseenEndRef.current(readFor, null);
          // Stale or invalid stored id (e.g. the platform was reset but the
          // browser kept an old id) — silently reset so a fresh conversation
          // is created on the next message instead of surfacing an error and
          // forcing the user to click "New conversation". A backend that is
          // down or unreachable through its gateway says nothing of the id,
          // which is kept and read back once it answers.
          // Credentials refused (an expired token) say nothing of the id
          // either: it is kept, with what the backend said, until the host's
          // credentials change or the user retries.
          if (RESTORE_REFUSED_STATUSES.has(res.status)) {
            return readRefusalDetail(res).then((detail) => {
              if (!isStale()) setRestoreRefused({ conversationId: requestedConversationId, detail, headersKey: requestedHeadersKey });
              return null;
            });
          }
          if (BACKEND_DOWN_STATUSES.has(res.status)) setRestoreOwedId(requestedConversationId);
          else updateConversationId(null);
          return null;
        }
        restoreAttemptsRef.current = 0;
        setRestoreOwedId(null);
        setRestoreRefused(null);
        return res.json();
      })
      .then((data) => {
        if (!data || isStale()) return;
        // The backend resolves the session: it returns the same id when the
        // conversation still exists, or transparently creates a fresh one and
        // returns its NEW id when the stored id is stale. Adopt whatever id it
        // returns (and persist it) so we never send subsequent messages
        // against a dead conversation — which would 404 with
        // "conversation does not exist".
        if (typeof data.conversation_id === 'string' && data.conversation_id && data.conversation_id !== requestedConversationId) {
          updateConversationId(data.conversation_id);
        }
        // Null is meaningful and different from absent: it says the backend
        // knows this conversation has no agent (one predating per-conversation
        // routing), where a missing key means an older backend that cannot
        // tell us. Both land on the selected-agent fallback, but only the
        // first is a deliberate answer.
        setConversationAgentName(typeof data.agent_name === 'string' ? data.agent_name : null);
        const restored = parseRestoredMessages(data.messages);
        settleUnseenEndRef.current(readFor, restored);
        // Read back for a relayed turn the reopened event stream replayed: the
        // segments it closed meanwhile go into it, and it runs on.
        if (mergeTurnHistoryRef.current(restored)) return;
        // A turn started meanwhile is on screen: the history waits for it to
        // end, and so does the event stream, which follows that history.
        if (isLoadingNowRef.current) {
          setRestorePostponed({ conversationId: requestedConversationId, data });
          return;
        }
        applyRestoredHistory(requestedConversationId, data, false);
      })
      // Unreachable: nothing is known of the conversation, whose id is kept.
      .catch(() => {
        if (isStale()) return;
        settleUnseenEndRef.current(readFor, null);
        setRestoreOwedId(requestedConversationId);
      })
      .finally(() => {
        if (restoringIdRef.current === requestedConversationId) restoringIdRef.current = null;
        if (!isStale()) setHistorySettledId(requestedConversationId);
      });
  }, [
    conversationId,
    selectedAgent,
    agentsSettled,
    historySettledId,
    messagesPageBase,
    apiBaseUrl,
    apiEndpoints,
    backendType,
    restorePostponed,
    // Re-runs the restore when the hook asks for one — the only way a turn
    // resumed without a stream can ever show its answer.
    historyReloadNonce,
    historyLoadedRef,
    conversationIdRef,
    isMountedRef,
    requestHeaders,
    setMessages,
    setContextUsage,
    updateConversationId,
  ]);

  // A send from the handle runs against the render it lands in, not the one
  // that built the handle.
  const handleSendMessageRef = useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;
  const handleNewChatRef = useRef(handleNewChat);
  handleNewChatRef.current = handleNewChat;
  const handleSwitchConversationRef = useRef(handleSwitchConversation);
  handleSwitchConversationRef.current = handleSwitchConversation;
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const selectedAgentRef = useRef(selectedAgent);
  selectedAgentRef.current = selectedAgent;

  // Ready once the agent is chosen and the conversation on screen is read back:
  // what the host does through the handle before then waits for it.
  const ready = agentsSettled && !restoringHistory;
  const onReady = useLatestCallback(onReadyProp);
  const readyAnnouncedRef = useRef(false);
  useEffect(() => {
    if (!ready || readyAnnouncedRef.current) return;
    readyAnnouncedRef.current = true;
    onReady?.();
  }, [ready, onReady]);
  // Handle calls run one per render, in order: a new conversation's agent is
  // in place before the send that follows it.
  // A call the panel never gets to (it unmounts first) is let go of with `drop`.
  const queueRef = useRef<{ run: () => void; drop?: () => void }[]>([]);
  const [queueTick, setQueueTick] = useState(0);
  const enqueue = (run: () => void, drop?: () => void) => {
    queueRef.current.push({ run, drop });
    setQueueTick((n) => n + 1);
  };
  useEffect(() => {
    if (!ready || queueRef.current.length === 0) return;
    const call = queueRef.current.shift()!;
    call.run();
    if (queueRef.current.length > 0) setQueueTick((n) => n + 1);
  }, [ready, queueTick]);
  // Let go of once the panel is gone for good: StrictMode's simulated
  // unmount is followed at once by the remount, which runs them.
  useEffect(
    () => () => {
      queueMicrotask(() => {
        if (isMountedRef.current) return;
        for (const call of queueRef.current.splice(0)) call.drop?.();
      });
    },
    [],
  );

  // The handle stays the same object for the panel's life: its calls read the latest state.
  const handleSwitchAgentRef = useRef(handleSwitchAgent);
  handleSwitchAgentRef.current = handleSwitchAgent;
  const handleStopGeneratingRef = useRef(handleStopGenerating);
  handleStopGeneratingRef.current = handleStopGenerating;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  // The composer's text for `getDraft`: as last rendered, or as `setDraft` just set it.
  const draftRef = useRef(inputValue);
  draftRef.current = inputValue;

  // The voice call: questions go out through the panel's own send, and the
  // answer is read off its streams. A question addresses the conversation's
  // agent: the one it was transferred to, the restored conversation's, or the
  // one picked.
  const addressedAgentId =
    transferredAgent?.id ??
    (conversationAgentName ? agents.find((a) => a.name === conversationAgentName)?.id : undefined) ??
    selectedAgent?.id ??
    null;
  const voice = useVoiceCall({
    send: (text, hooks) =>
      handleSendMessageRef.current({ text, source: 'voice', onSent: hooks.onAccepted, onNotSent: hooks.onNotSent, onSteered: hooks.onSteered }),
    stopTurn: () => handleStopGeneratingRef.current(),
    // Whether the turn still runs, read where a paused turn is recovered from.
    readTurnState: readPendingApprovals
      ? async () => {
          const convId = conversationIdRef.current;
          const state = convId ? await readPendingApprovals(convId) : null;
          return state && { running: state.turnRunning };
        }
      : undefined,
    addressedAgentId: () => addressedAgentId,
    speakable: (text) => speakableText(answerMarkdownSources(text, markerKindList)),
    present: (text) =>
      transformMessageText ? transformMessageText(text, { id: 'voice-call', role: 'assistant', content: text, timestamp: new Date() }) : text,
    tts: ttsRoute,
    locale,
  });
  voiceFrameRef.current = voice.onFrame;

  const onSwitchAgent = (agent: typeof selectedAgent) => {
    if (!agent) return;
    handleSwitchAgent(agent, () => {
      handleNewChat();
    });
  };

  useImperativeHandle(
    ref,
    () => ({
      send: (text, options) =>
        readOnlyRef.current
          ? Promise.resolve('dropped' as const)
          : new Promise<ChatSendOutcome>((resolve) =>
              enqueue(
                () => {
                  if (readOnlyRef.current) {
                    resolve('dropped');
                    return;
                  }
                  // A new turn resolves once the backend takes it, not when its answer ends.
                  handleSendMessageRef
                    .current({ text, extras: options?.extras, displayText: options?.displayText, onSent: () => resolve('sent') })
                    .then(resolve, () => resolve('failed'));
                },
                () => resolve('dropped'),
              ),
            ),
      newConversation: (options) =>
        enqueue(() => {
          const agent = findAgent(agentsRef.current, options?.agent);
          if (agent && agent.id !== selectedAgentRef.current?.id) handleSwitchAgentRef.current(agent);
          handleNewChatRef.current(options?.workspaceId);
        }),
      selectConversation: (id) => enqueue(() => handleSwitchConversationRef.current(id)),
      setDraft: (text) => {
        draftRef.current = text;
        setInputValue(text);
      },
      getDraft: () => draftRef.current,
      focusComposer: () => rootRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus(),
      stop: () => {
        // A question a voice call awaits goes with its turn.
        voice.cancel();
        handleStopGeneratingRef.current();
      },
      startVoiceCall: () => !readOnlyRef.current && voice.start(),
      reloadAgents,
      scrollToMessage: (messageId) => {
        const target = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [])].find(
          (el) => el.dataset.messageId === messageId,
        );
        if (!target) return false;
        target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        target.classList.add('filigran-chat-highlight');
        window.setTimeout(() => target.classList.remove('filigran-chat-highlight'), HIGHLIGHT_MS);
        return true;
      },
    }),
    // setInputValue, reloadAgents and the voice call's controls are stable; everything else goes through a ref.
    [],
  );

  const containerClasses = (() => {
    const base = 'filigran-chatbot';
    switch (mode) {
      case 'sidebar':
        return `${base} fixed right-0 bottom-0 flex flex-col chat-surface-raised border-l chat-border z-[1200]`;
      case 'floating':
        return `${base} fixed bottom-5 right-5 flex flex-col chat-surface-raised rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[1300] border chat-border`;
      case 'fullscreen':
        return `${base} fixed right-0 bottom-0 left-0 flex flex-col chat-surface z-[1400]`;
      case 'inline':
        return `${base} relative flex flex-col h-full w-full min-h-0 chat-surface`;
      default:
        return base;
    }
  })();

  const containerStyle: React.CSSProperties = {
    ...cssVars,
    ...(mode === 'sidebar'
      ? { top: topOffset, width: resizable ? sidebarWidth : defaultWidth }
      : mode === 'floating'
        ? { width: FLOATING_WIDTH, height: FLOATING_HEIGHT }
        : mode === 'inline'
          ? {}
          : { top: topOffset }),
  };

  return (
    <div ref={rootRef} className={containerClasses} style={containerStyle} data-testid="filigran-chat-panel">
      {mode === 'sidebar' && resizable && (
        <div onMouseDown={handleResizeStart} className="absolute top-0 -left-1 bottom-0 w-2 cursor-col-resize z-10 group">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bottom-0 w-0.5 rounded-sm bg-[var(--chat-accent)] opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
        </div>
      )}
      <ChatHeader
        mode={mode}
        agentName={agentName}
        agents={agents}
        agentsLoading={agentsLoading}
        agentsError={agentsError}
        selectedAgent={selectedAgent}
        transferredFrom={transferredAgent ? selectedAgent?.name : undefined}
        agentMenuOpen={agentMenuOpen}
        onAgentMenuToggle={() => setAgentMenuOpen((p) => !p)}
        onAgentMenuClose={() => setAgentMenuOpen(false)}
        onSwitchAgent={onSwitchAgent}
        modeMenuOpen={modeMenuOpen}
        onModeMenuToggle={() => setModeMenuOpen((p) => !p)}
        onModeMenuClose={() => setModeMenuOpen(false)}
        onModeChange={onModeChange}
        onNewChat={handleNewChat}
        onClose={onClose}
        logoIcon={resolvedLogo}
        actions={headerActions}
        agentDashboardUrl={agentDashboardUrl}
        historyEnabled={historyEnabled && !showConversationSidebar}
        historyMenuOpen={historyMenuOpen}
        onHistoryMenuToggle={handleHistoryMenuToggle}
        onHistoryMenuClose={() => setHistoryMenuOpen(false)}
        conversations={conversations}
        conversationsLoading={conversationsLoading}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={(id) => void handleDeleteConversation(id)}
        onClearAll={clearConversations ? () => void handleClearAll() : undefined}
        t={t}
      />
      {/* Fullscreen puts the conversation list beside the thread. The header
          stays full width above both: it carries the agent picker, the mode
          switcher and close, which belong to the panel rather than to either
          column. `min-h-0` lets the thread scroll instead of growing the row. */}
      <div className={showConversationSidebar ? 'flex flex-1 min-h-0' : 'contents'}>
        {showConversationSidebar && (
          <ConversationSidebar
            conversations={conversations}
            loading={conversationsLoading}
            activeConversationId={conversationId}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            onSelect={handleSelectConversation}
            onDelete={(id) => void handleDeleteConversation(id)}
            onRename={(id, title) => void renameConversation(id, title)}
            onNewChat={handleNewChat}
            workspaces={
              workspacesEnabled
                ? {
                    list: workspaces,
                    pendingWorkspaceId,
                    onCreate: createWorkspace,
                    onRename: renameWorkspace,
                    onDelete: async (id) => {
                      const result = await deleteWorkspace(id);
                      if (result.ok) {
                        // The next conversation must not be created in it.
                        clearPendingWorkspace(id);
                        // Its conversations are back in no workspace (`workspace_id: null`).
                        void refreshConversations();
                      }
                      return result;
                    },
                    onMove: moveConversation,
                    onNewChat: (workspaceId) => {
                      handleNewChat(workspaceId);
                      // Still there? Deleted elsewhere, the list drops it and
                      // the pending workspace with it, before the first send.
                      void refreshWorkspaces();
                    },
                  }
                : undefined
            }
            storageKeyPrefix={storageKeyPrefix}
            rowActions={sidebarRowActions}
            headerActions={sidebarHeaderActions}
            sections={sidebarSections}
            onClearAll={clearConversations ? () => void handleClearAll() : undefined}
            t={t}
          />
        )}
        <div className={showConversationSidebar ? 'relative flex flex-1 flex-col min-w-0' : 'contents'} {...dropHandlers}>
          {dropping && (
            <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--chat-accent)] bg-[var(--chat-accent)]/10 text-sm font-medium text-[var(--chat-accent)]">
              {t('Drop files to attach them')}
            </div>
          )}
          {banner && <div className="shrink-0">{banner}</div>}
          {messages.length === 0 && restoringHistory ? (
            <div data-testid="filigran-chat-loading" className="flex-1 flex flex-col gap-4 px-4 py-6" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`h-10 rounded-xl bg-gray-200/70 dark:bg-white/[0.06] animate-pulse ${i % 2 ? 'w-1/3' : 'w-2/3'}`} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 && refusedRestore ? (
            <div
              data-testid="filigran-chat-restore-error"
              role="alert"
              className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-6 text-center"
            >
              <AlertTriangleIcon size={18} className="text-amber-500 dark:text-amber-400" />
              <p className="max-w-sm text-[0.8125rem] leading-6 text-gray-600 dark:text-white/60">
                {refusedRestore.detail ?? t('This conversation could not be loaded.')}
              </p>
              <button
                type="button"
                onClick={retryRefusedRestore}
                className="rounded-md border chat-border px-3 py-1 text-[0.75rem] font-medium text-gray-700 dark:text-white/80 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06]"
              >
                {t('Retry')}
              </button>
            </div>
          ) : messages.length === 0 ? (
            welcome ? (
              <div className="flex-1 min-h-0 overflow-y-auto filigran-chat-scrollable">{welcome}</div>
            ) : (
              <ChatWelcome
                firstName={firstName}
                logoIcon={resolvedLogo}
                // The agent's own suggestions when the backend serves them, the
                // host's list otherwise, this package's list when there is neither —
                // never an empty section.
                promptSuggestions={suggestions}
                suggestionsLoading={suggestionsLoading}
                agentName={selectedAgent?.name}
                agentDescription={selectedAgent?.description}
                onPromptClick={readOnly ? undefined : setInputValue}
                t={t}
              />
            )
          ) : (
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              agentStatus={agentStatus}
              agentName={agentName}
              logoIcon={resolvedLogo}
              onRelativeLinkClick={onRelativeLinkClick}
              onDownloadFile={canDownload ? handleDownloadFile : undefined}
              resolveAttachmentUrl={canDownload && !disableImagePreviews ? resolveAttachmentUrl : undefined}
              onDownloadArtifact={artifactsBase ? handleDownloadArtifact : undefined}
              onRefreshArtifact={artifactsBase ? handleRefreshArtifact : undefined}
              requestHeaders={requestHeaders}
              miniGameEnabled={miniGameEnabled}
              onPlayWaitingGame={onPlayWaitingGame}
              waitingGameUrl={playUrl}
              onMessageFeedback={onMessageFeedback}
              feedbackUrl={feedbackBaseUrl(apiBaseUrl, apiEndpoints, backendType)}
              conversationId={conversationId}
              locale={locale}
              isResumingAfterDecision={isResumingAfterDecision}
              onSkipWait={skipWait ?? undefined}
              pendingApprovals={pendingApprovals}
              onSubmitApprovalDecisions={submitApprovalDecisions}
              isSubmittingApproval={isSubmittingApproval}
              approvalError={approvalError}
              openableConversationIds={openableConversationIds}
              onOpenConversation={onOpenConversation}
              markerRenderers={markerRenderers}
              markerKindList={markerKindList}
              codeBlockRenderers={codeBlockRenderers}
              transformMessageText={transformMessageText}
              onArtifactOpen={onArtifactOpen}
              renderMessageExtras={renderMessageExtras}
              messageFooterActions={messageFooterActions}
              transcriptFooter={transcriptFooter}
              onLoadEarlier={serverHasEarlier ? loadEarlier : undefined}
              ttsRoute={ttsRoute}
              thinking={thinking}
              t={t}
            />
          )}
          {readOnly ? (
            readOnlyNotice && (
              <div className="px-4 py-3 border-t chat-border text-sm text-gray-500 dark:text-white/50">{readOnlyNotice}</div>
            )
          ) : (
            <ChatInput
              header={composerHeader}
              sendsHeld={sendsHeld}
              steerAttachments={steerAttachments}
              canHold={holdSendsDuringTurn}
              heldMessage={heldMessage}
              notice={notice}
              onCancelHeld={cancelHeldMessage}
              agentMentions={agentMentionsEnabled && agents.length > 0 ? { agents, mentions: agentMentions, onPick: addAgentMention } : undefined}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={handleSendMessage}
              onStop={handleStopGenerating}
              isLoading={isLoading}
              canSteer={canSteer}
              attachedFiles={disableFileManagement ? [] : attachedFiles}
              onFileAdd={disableFileManagement ? undefined : handleFileAdd}
              onFileRemove={disableFileManagement ? undefined : (i) => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
              onPaste={disableFileManagement ? undefined : handlePaste}
              t={t}
              mode={mode}
              separatorColor={draftBorderColor}
              prompts={prompts}
              quota={quota}
              contextUsage={contextUsageEnabled ? contextUsage : null}
              composerToolbar={composerToolbar}
              conversationReferences={
                conversationReferencesSearchUrl
                  ? { url: conversationReferencesSearchUrl, requestHeaders, conversationId, refs: conversationRefs, onPick: addConversationRef }
                  : undefined
              }
            />
          )}
        </div>
      </div>
      {voice.snapshot && (
        <ChatVoiceCall
          call={voice.snapshot}
          agentName={agentName}
          logoIcon={resolvedLogo}
          processingLabel={statusLineText(agentStatus, t, statusLabel)}
          onInterrupt={voice.interrupt}
          onToggleMute={voice.toggleMute}
          onEnd={voice.end}
          t={t}
        />
      )}
    </div>
  );
});
