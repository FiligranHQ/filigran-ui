import { Button, Spinner } from '@filigran/design-system';
import { useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import type { ChatContextUsage, ChatConversationRef, ChatFile, ChatPanelMode, ChatPromptTemplate, ChatQuotaStatus, XtmAgent } from '../types';
import { mentionedAgentIds, type AgentMention } from '../utils/agentMentions';
import { AttachFileIcon, CloseIcon, FileIcon, MicIcon, MicOffIcon, SendIcon, StopCircleIcon, XCircleIcon } from './icons';
import { ChatIconButton } from './ChatIconButton';
import { ChatNotice } from './ChatNotice';
import { useMentionMenu } from '../hooks/useMentionMenu';
import { useDictation } from '../hooks/useDictation';
import type { ChatHeldReason } from '../hooks/useChat';
import { referencedConversations } from '../utils/conversationRefs';
import { hasFailedUpload } from '../utils/failedUpload';
import { isComposing } from '../utils/keyboard';
import { pastedText, spliceText } from '../utils/copy';
import { translate } from '../utils';
import { ContextUsageIndicator } from './ContextUsageIndicator';
import { MentionMenu } from './MentionMenu';
import { PromptPicker } from './PromptPicker';
import { QuotaIndicator } from './QuotaIndicator';
import { Tooltip } from './Tooltip';

interface ChatInputProps {
  /** The host's content above the composer (`composerHeader`). */
  header?: React.ReactNode;
  /** Uploaded files may steer the running turn. */
  steerAttachments?: boolean;
  /** A message that cannot steer is held until the turn ends. */
  canHold?: boolean;
  /** The message held, shown (in the words its bubble will show) with a way to take it back. */
  heldMessage?: { text: string; displayText?: string } | null;
  /** Why the held message waits beyond the running answer: said under it. */
  heldReason?: ChatHeldReason | null;
  /** What the backend said when it refused a steer or a Stop. */
  notice?: string | null;
  /** Which files the last attach refused, and why. */
  fileNotice?: string | null;
  /** Closes `notice`; without it the notice has no close button. */
  onDismissNotice?: () => void;
  /** Closes `fileNotice`; without it the notice has no close button. */
  onDismissFileNotice?: () => void;
  /** The conversation's agent is meant for assignments rather than chat (`XtmAgent.disableChat`); an agent the draft mentions is warned of too. */
  agentNotForChat?: boolean;
  onCancelHeld?: () => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  /**
   * Mid-run steering availability: while the agent is generating, the typed
   * text can be dispatched immediately (Enter / accent Send button) and is
   * injected into the running run instead of waiting for it to finish.
   * Attachments keep the legacy wait behavior.
   */
  canSteer?: boolean;
  attachedFiles?: ChatFile[];
  onFileAdd?: (files: FileList | null) => void;
  onFileRemove?: (index: number) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  t: (key: string) => string;
  mode?: ChatPanelMode;
  separatorColor?: string;
  /** Saved prompt templates; omitted entirely when the host serves none. */
  prompts?: ChatPromptTemplate[] | null;
  /** Agentic quota headroom; omitted entirely when the host serves none. */
  quota?: ChatQuotaStatus | null;
  /** Context-window occupancy; omitted until the backend reports it. */
  contextUsage?: ChatContextUsage | null;
  /** Host-supplied controls appended to the toolbar (see `composerToolbar`). */
  composerToolbar?: React.ReactNode;
  /**
   * The `@` conversation menu (`apiEndpoints.conversationReferences`), absent
   * while the feature is off: `@` is then plain text.
   */
  conversationReferences?: {
    /** `conversationReferencesUrl(...)`. */
    url: string;
    requestHeaders?: Record<string, string>;
    /** The conversation written in: never offered. */
    conversationId?: string | null;
    /** The picks the composer holds (see `useChat`). */
    refs: ChatConversationRef[];
    onPick: (ref: ChatConversationRef) => void;
  };
  /** The agents `@` mentions, and the mentions the composer holds; absent while mentions are off. */
  agentMentions?: { agents: XtmAgent[]; mentions: AgentMention[]; onPick: (mention: AgentMention) => void };
  /** The file picker's `accept`; any type when absent. */
  accept?: string;
  /** The text field's placeholder, over "Ask a question...". */
  placeholder?: string;
  /** Changes when the field should take the focus (a conversation switched to), unless it is elsewhere. */
  focusRequest?: number;
}

/**
 * Whether the composer may take the focus from where it is: nowhere, or a
 * control of the panel itself. Never from a field, a dialog, or the host's
 * page.
 */
function focusIsFree(field: HTMLElement): boolean {
  const active = document.activeElement;
  if (!active || active === document.body || active === field) return true;
  const panel = field.closest('.filigran-chatbot');
  if (!panel?.contains(active) || active.closest('[role="dialog"], [role="alertdialog"], dialog')) return false;
  const editable =
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active as HTMLElement).isContentEditable;
  return !editable;
}

const MAX_TEXTAREA_HEIGHT = 120;
const NO_REFS: ChatConversationRef[] = [];

export const ChatInput = ({
  header,
  steerAttachments = false,
  canHold = false,
  heldMessage,
  heldReason,
  notice,
  fileNotice,
  onDismissNotice,
  onDismissFileNotice,
  agentNotForChat = false,
  onCancelHeld,
  inputValue,
  onInputChange,
  onSend,
  onStop,
  isLoading,
  canSteer = false,
  attachedFiles = [],
  onFileAdd,
  onFileRemove,
  onPaste,
  t,
  mode,
  separatorColor,
  prompts,
  quota,
  contextUsage,
  composerToolbar,
  conversationReferences,
  agentMentions,
  accept,
  placeholder,
  focusRequest,
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionAgents = agentMentions?.agents;
  const onPickMention = agentMentions?.onPick;
  const agentMentionOptions = useMemo(
    () => (mentionAgents && onPickMention ? { agents: mentionAgents, onPick: onPickMention } : undefined),
    [mentionAgents, onPickMention],
  );
  const mentionMenu = useMentionMenu({
    url: conversationReferences?.url ?? null,
    requestHeaders: conversationReferences?.requestHeaders,
    conversationId: conversationReferences?.conversationId,
    text: inputValue,
    onTextChange: onInputChange,
    textareaRef,
    refs: conversationReferences?.refs ?? NO_REFS,
    onPick: (ref) => conversationReferences?.onPick(ref),
    agentMentions: agentMentionOptions,
  });

  const focusComposer = () => {
    const el = textareaRef.current;
    if (el && focusIsFree(el)) el.focus();
  };
  // Not on mount: a panel opening does not take the focus from the page.
  const focusRequestSeen = useRef(focusRequest);
  useEffect(() => {
    if (focusRequest === focusRequestSeen.current) return;
    focusRequestSeen.current = focusRequest;
    focusComposer();
  });

  // A dictated phrase lands at the end of the draft while the focus is on the
  // mic, so nothing scrolls the field to it once the text outgrows the cap.
  const revealEndRef = useRef(false);

  // Dictation appends each finalised phrase, so speaking continues a draft
  // rather than replacing it — same contract as picking a template.
  const dictation = useDictation((finalText) => {
    revealEndRef.current = true;
    onInputChange(inputValue.trim() ? `${inputValue.trimEnd()} ${finalText}` : finalText);
  });

  // Sized from the value rather than from the textarea's own change event:
  // dictation, template picks, draft restores and the clear after a send all
  // change the text without one.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    if (revealEndRef.current) {
      revealEndRef.current = false;
      el.scrollTop = el.scrollHeight;
    }
  }, [inputValue]);

  // Append rather than replace: a user who has already started typing must not
  // lose it to a template pick. The blank line keeps the two blocks distinct.
  const handlePromptPick = (content: string) => {
    onInputChange(inputValue.trim() ? `${inputValue.trimEnd()}\n\n${content}` : content);
    textareaRef.current?.focus();
  };

  // A paste of text inserts it without the blank lines that open or close it
  // (a selection copied from a page that ended on a block): never a phantom
  // line. What the user typed is kept; a paste of files is the host's.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    onPaste?.(e);
    if (e.defaultPrevented) return;
    let text: string;
    try {
      text = e.clipboardData?.getData('text/plain') ?? '';
    } catch {
      return;
    }
    const inserted = pastedText(text);
    if (inserted === null) return;
    e.preventDefault();
    const el = e.currentTarget;
    const next = spliceText(inputValue, el.selectionStart ?? inputValue.length, el.selectionEnd ?? inputValue.length, inserted);
    onInputChange(next.value);
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = next.caret;
    });
  };

  // Attaching may be off while files attached before stay, shown and removable.
  const isFileManagementEnabled = Boolean(onFileAdd && onFileRemove && onPaste);
  const hasAttachments = attachedFiles.length > 0;
  const hasContent = inputValue.trim() || hasAttachments;
  const hasFilesUploading = attachedFiles.some((f) => f.uploadStatus === 'pending');
  // A file that failed to upload keeps the message from going until the user removes it.
  const failedFileWaits = hasFailedUpload(attachedFiles);
  const canSend = hasContent && !hasFilesUploading && !failedFileWaits;
  // A steer reaches the running loop as text alone, so the agent would never
  // read a conversation it references: such a message waits, like a file.
  // A mention routes the message to another agent: it waits for the turn too.
  const mentionedIds = agentMentions ? mentionedAgentIds(agentMentions.mentions, inputValue) : [];
  const waitsForTurn =
    (Boolean(conversationReferences) && referencedConversations(conversationReferences?.refs ?? NO_REFS, inputValue).length > 0) ||
    mentionedIds.length > 0;
  // The message goes to an agent not meant for chat: the conversation's, or one it mentions.
  const warnsNotForChat = agentNotForChat || mentionedIds.some((id) => agentMentions?.agents.find((a) => a.id === id)?.disableChat);
  // What the composer holds can steer the running agent: text, and
  // attachments only with steerAttachments. The accent Send button shows NEXT
  // to Stop while there is something to send, its files uploaded.
  const steerable = isLoading && canSteer && !waitsForTurn && (!hasAttachments || steerAttachments);
  const showSteerSend = steerable && !hasFilesUploading && !failedFileWaits && (hasAttachments || Boolean(inputValue.trim()));
  // What cannot steer waits for the turn to end, one message at a time.
  const showHoldSend = isLoading && canHold && !showSteerSend && !heldMessage && Boolean(canSend);

  // Every way of sending goes through here, and only when the matching button
  // would be enabled: Enter must not send while files upload, nor end a
  // dictation that nothing was sent from. Dictation is cancelled, not stopped:
  // a phrase still being recognised would land in the composer just emptied.
  const send = () => {
    if (!(isLoading ? showSteerSend || showHoldSend : canSend)) return;
    dictation.cancel();
    onSend();
    // The Send button had the focus: the next message is typed at once.
    focusComposer();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // The mention menu's keys too belong to a composing input method.
    if (isComposing(e)) return;
    // The menu's keys first (arrows, Enter / Tab, Escape) while it is open.
    if (mentionMenu.onKeyDown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape' && isLoading) {
      e.preventDefault();
      onStop();
    }
  };

  const status = showHoldSend
    ? t('Enter to send when the answer ends · Esc to stop')
    : failedFileWaits
      ? t('A file failed to upload: remove it to send the message')
      : steerable
        ? t('Enter to send now · Esc to stop')
        : isLoading && hasAttachments
          ? t('Attachments wait for the current response')
          : isLoading && waitsForTurn
            ? t('This message waits for the current response')
            : null;
  // One footer line under the composer, the same on every surface (inline,
  // sidebar, fullscreen, floating): a status when there is one, else the
  // disclaimer. How to send is the Send button's tooltip, not a line of its
  // own. The line keeps its height, so the composer never jumps.
  const footerLine = 'text-center text-content-compact chat-text-muted-400/30 opacity-70 mt-1.5 min-h-[1lh] truncate';
  const sendTooltip = hasFilesUploading ? t('Files uploading...') : t('Enter to send · Shift+Enter for new line');

  return (
    <div
      className={`px-4 py-3 border-t chat-border-200/10 ${mode === 'floating' ? 'chat-radius-b-md' : ''}`}
      style={separatorColor ? { borderTopColor: separatorColor, borderTopWidth: 1 } : undefined}
      data-testid="filigran-chat-composer"
    >
      {header && <div className="mb-2">{header}</div>}
      {notice && (
        <ChatNotice
          tone="warning"
          role="alert"
          data-testid="filigran-chat-composer-notice"
          className="mb-2"
          onDismiss={onDismissNotice}
          dismissLabel={t('Close')}
        >
          {notice}
        </ChatNotice>
      )}
      {fileNotice && (
        <ChatNotice
          tone="warning"
          role="alert"
          data-testid="filigran-chat-file-notice"
          className="mb-2"
          onDismiss={onDismissFileNotice}
          dismissLabel={t('Close')}
        >
          {fileNotice}
        </ChatNotice>
      )}
      {warnsNotForChat && (
        <ChatNotice tone="warning" data-testid="filigran-chat-agent-not-for-chat" className="mb-2">
          {t('This agent is designed for assignments, not direct chat. It may not respond well to conversational interactions.')}
        </ChatNotice>
      )}
      {heldMessage && (
        <div className="mb-2 flex items-center gap-2 chat-radius-md border border-dashed border-[var(--chat-accent-40)] px-2.5 py-1.5 text-content-compact">
          <span className="shrink-0 chat-text-secondary-500/50">{t('Sends when the answer ends:')}</span>
          <span className="min-w-0 flex-1 truncate chat-text-800/80">{heldMessage.displayText ?? (heldMessage.text || t('Attached files'))}</span>
          {onCancelHeld && (
            <Button variant="destructive" priority="tertiary" size="sm" className="shrink-0" onClick={onCancelHeld}>
              {t('Cancel')}
            </Button>
          )}
        </div>
      )}
      {heldMessage && heldReason && (
        <ChatNotice tone="info" data-testid="filigran-chat-held-reason" className="mb-2">
          {heldReason === 'mentions'
            ? t('The agents you mentioned are asked as soon as the current answer ends.')
            : heldReason === 'references'
              ? t('The conversations you referenced are read with your message once the current answer ends.')
              : t('Several agents are answering: your message is sent once they are done.')}
        </ChatNotice>
      )}
      {hasAttachments && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {attachedFiles.map((f, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-content-compact ${
                f.uploadStatus === 'error'
                  ? 'border-[var(--chat-danger)]/25 bg-[var(--chat-danger)]/[0.06] text-[var(--chat-danger)]'
                  : f.uploadStatus === 'pending'
                    ? 'chat-border-200/10 chat-text-muted-400/40'
                    : 'chat-border-200/10 chat-text-secondary-600/60'
              }`}
            >
              {f.uploadStatus === 'pending' && <Spinner size="sm" tone="inherit" />}
              {f.uploadStatus !== 'pending' && <FileIcon size={14} />}
              {f.name}
              {f.uploadStatus === 'error' && (
                <span data-testid="filigran-chat-upload-error" className="inline-flex min-w-0 items-center gap-1">
                  <XCircleIcon size={12} className="shrink-0" />
                  <Tooltip title={f.uploadError ?? t('Upload failed')} className="inline-flex min-w-0">
                    <span className="max-w-[16rem] truncate">{f.uploadError ?? t('Upload failed')}</span>
                  </Tooltip>
                </span>
              )}
              <ChatIconButton
                label={translate(t, 'Remove {name}', { name: f.name })}
                icon={<CloseIcon size={16} />}
                size="sm"
                onClick={() => onFileRemove?.(i)}
              />
            </span>
          ))}
        </div>
      )}

      {/* The field is a column: the text area grows on top, the action row
          sits at the bottom of the field and never moves (Sam, 10 Nov 2026:
          icons stay put as the text grows, as on the previous chat page).
          Left: what adds to the message (attach, templates, host controls).
          Right: readouts, then dictation and send, always last.
          `relative` anchors the @ menu, which opens above the field. */}
      <div
        data-testid="filigran-chat-composer-box"
        // The agent is working: the working glow plays, focused or not, and
        // the focus ring stands aside until the turn ends (index.css).
        data-working={isLoading ? '' : undefined}
        // Dictation keeps its red border; otherwise the border is the design
        // system Textarea's: none at rest, the hover tone under the pointer (index.css).
        data-listening={dictation.listening ? '' : undefined}
        className={`filigran-chat-composer-box relative flex flex-col border chat-composer-surface px-2 pt-1 pb-1.5 transition-colors ${
          dictation.listening ? 'border-[var(--chat-danger)]/50' : ''
        } ${isLoading ? 'filigran-chat-active-border' : ''}`}
      >
        <textarea
          ref={textareaRef}
          placeholder={dictation.listening ? t('Listening...') : (placeholder ?? t('Ask a question...'))}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          // The caret moved without the text changing: the @ menu follows it.
          onKeyUp={mentionMenu.sync}
          onClick={mentionMenu.sync}
          onFocus={mentionMenu.sync}
          onBlur={mentionMenu.close}
          {...mentionMenu.textareaAria}
          onPaste={handlePaste}
          rows={1}
          className="filigran-chat-composer-field w-full bg-transparent border-none outline-hidden resize-none text-content-base px-1 py-1.5 chat-text-900/100 placeholder:chat-text-muted-400/30 filigran-chat-scrollable"
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        />
        <MentionMenu
          view={mentionMenu.view}
          items={mentionMenu.items}
          activeIndex={mentionMenu.activeIndex}
          listboxId={mentionMenu.listboxId}
          optionId={mentionMenu.optionId}
          onHover={mentionMenu.setActiveIndex}
          onPick={mentionMenu.pick}
          t={t}
        />
        <div data-testid="filigran-chat-composer-actions" className="flex shrink-0 items-center gap-1 pt-1">
          {isFileManagementEnabled && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept={accept || undefined}
                onChange={(e) => {
                  onFileAdd?.(e.target.files);
                  e.target.value = '';
                }}
              />
              <ChatIconButton label={t('Attach files')} icon={<AttachFileIcon size={20} />} onClick={() => fileInputRef.current?.click()} />
            </>
          )}
          {prompts && prompts.length > 0 && <PromptPicker prompts={prompts} onPick={handlePromptPick} t={t} />}
          {composerToolbar}
          {/* Status readouts are not controls: pushed right, together, before
              dictation and send, so neither lands between two clickable things.
              Context before quota: "how full is this chat" is the one the user
              can still act on by starting a new one. The spacer stays when
              neither shows, so the send group is always at the right edge. */}
          <span className="ml-auto flex items-center gap-2.5 pr-1">
            {contextUsage && <ContextUsageIndicator usage={contextUsage} t={t} />}
            {quota && <QuotaIndicator quota={quota} t={t} />}
          </span>
          {dictation.supported && (
            // A toggle: the design system's pressed look, in the error tone while it listens.
            <ChatIconButton
              label={t('Dictate a message')}
              tooltip={dictation.listening ? t('Stop dictation') : t('Dictate a message')}
              icon={
                <span className="relative inline-flex">
                  {dictation.listening ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
                  {dictation.listening && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--chat-danger)] motion-safe:animate-pulse" />}
                </span>
              }
              variant={dictation.listening ? 'destructive' : 'default'}
              active={dictation.listening}
              onClick={dictation.toggle}
            />
          )}
          {showHoldSend && (
            <ChatIconButton label={t('Send when the answer ends')} icon={<SendIcon size={20} />} priority="secondary" onClick={send} />
          )}
          {showSteerSend && (
            <ChatIconButton label={t('Send now')} icon={<SendIcon size={20} />} priority="secondary" onClick={send} />
          )}
          {/* The main action of the row: the design system's primary IconButton (its own disabled look), the error tone to stop. */}
          <ChatIconButton
            label={isLoading ? t('Stop generating') : t('Send')}
            tooltip={isLoading ? t('Stop generating') : sendTooltip}
            icon={isLoading ? <StopCircleIcon size={20} /> : <SendIcon size={20} />}
            priority={isLoading ? 'secondary' : 'primary'}
            variant={isLoading ? 'destructive' : 'default'}
            disabled={!isLoading && !canSend}
            onClick={isLoading ? onStop : send}
          />
        </div>
      </div>

      {/* The footer's one line: words heard but not yet final, else a status,
          else the disclaimer. */}
      {dictation.interim ? (
        <p className="flex items-center justify-center gap-1.5 text-content-compact italic text-[var(--chat-danger)] mt-1.5 min-h-[1lh]">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--chat-danger)] motion-safe:animate-pulse" />
          <span className="truncate">{dictation.interim}</span>
        </p>
      ) : status ? (
        <p data-testid="filigran-chat-composer-hint" className={footerLine}>
          {status}
        </p>
      ) : (
        <p data-testid="filigran-chat-disclaimer" className={footerLine}>
          {t('Uses AI. Verify results.')}
        </p>
      )}
    </div>
  );
};
