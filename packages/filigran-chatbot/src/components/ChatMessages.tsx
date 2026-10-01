import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  AgentStatusState,
  ChatAttachment,
  ChatConversationRef,
  ChatMessage,
  MessageFeedback,
  ToolApprovalDecision,
  ToolApprovalProposal,
} from '../types';
import { feedbackKeyOf, useMessageFeedback, type FeedbackEntry } from '../hooks/useMessageFeedback';
import { useSpeechReader } from '../hooks/useSpeechReader';
import { answerMarkdownSources, splitFileMarkers, stripFileMarkers } from '../utils';
import { FEEDBACK_COMMENT_MAX_LENGTH, feedbackModeOf, shownFeedback, type FeedbackMode } from '../utils/feedback';
import { formatMessageTime } from '../utils/messageTime';
import {
  createScrollFollower,
  innerBoxScrollsUp,
  keyScrollsUp,
  nextTouchAnchor,
  pressTakesScrollbar,
  singleTouchY,
  swipeScrollsUp,
  wheelScrollsUp,
} from '../utils/scrollFollow';
import { hasSpeakableWords } from '../utils/speech';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  InfoIcon,
  MessageSquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  VolumeIcon,
  VolumeOffIcon,
} from './icons';
import { ChatApprovalPrompt } from './ChatApprovalPrompt';
import { ChatImage } from './ChatImage';
import { ChatThinking } from './ChatThinking';
import { MarkdownMessage } from './MarkdownMessage';
import { ReasoningDetailsDialog } from './ReasoningDetailsDialog';
import { Tooltip } from './Tooltip';

/**
 * Windowed thread rendering: only the most recent slice of the thread is
 * mounted, and "Load earlier messages" walks the window back a step at a time.
 * A long restored conversation would otherwise mount hundreds of markdown
 * subtrees at once, which stalls the panel on open and on every streamed frame.
 */
const INITIAL_RENDER_WINDOW = 150;
const RENDER_WINDOW_STEP = 50;

/** How long the copy affordance stays in its confirmed state. */
const COPY_FEEDBACK_DELAY = 2000;

const parentOf = (node: Element) => node.parentElement;
const overflowYOf = (node: Element) => getComputedStyle(node).overflowY;

/** Arrows and Page Up move the caret of a field (the feedback comment), not the thread. */
function isTypingTarget(target: EventTarget): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select'));
}

const CONTROLS = 'a[href], button, summary, label, input, textarea, select, [role="button"], [role="link"]';

/** A link, a button or a field: a middle click opens it, Shift+Space presses it. */
function isControl(target: EventTarget): boolean {
  return target instanceof Element && !!target.closest(CONTROLS);
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  agentStatus: AgentStatusState | null;
  agentName: string;
  logoIcon: React.ReactNode;
  onRelativeLinkClick?: (href: string) => void;
  /** Download an agent-generated file via the host app's backend proxy. */
  onDownloadFile?: (attachment: ChatAttachment) => void;
  /**
   * Resolve the host-proxied URL of an attachment, used to preview image
   * attachments inline. Attachments stay chips/cards when omitted.
   */
  resolveAttachmentUrl?: (attachment: ChatAttachment) => string | undefined;
  /** Auth headers used when fetching previewed images (see `ChatImage`). */
  requestHeaders?: Record<string, string>;
  /** Host-level override for the waiting panel (messages and the invitation to play). */
  miniGameEnabled?: boolean;
  /** Opens the XTM One arcade in place; wins over `waitingGameUrl`. */
  onPlayWaitingGame?: () => void;
  /** Where the XTM One arcade is played, opened in a new tab. */
  waitingGameUrl?: string | null;
  /** Enables the 👍/👎 affordance on completed assistant messages (see `feedbackUrl`). */
  onMessageFeedback?: (messageId: string, feedback: MessageFeedback | null, message: ChatMessage) => void;
  /**
   * Where the panel stores ratings itself (`feedbackBaseUrl`): shows the thumbs
   * on every answer the backend identified, whether or not `onMessageFeedback`
   * is passed.
   */
  feedbackUrl?: string | null;
  /** The conversation on screen; its ratings are stored against it. */
  conversationId?: string | null;
  /** BCP 47 tag the times are formatted in and answers are read aloud in. */
  locale?: string;
  /**
   * True while a turn answered after a reload is finishing without a stream.
   * Rendered as the ordinary working indicator: from the user's side nothing
   * about it is unusual, and a decision that visibly leads nowhere reads as a
   * broken button.
   */
  isResumingAfterDecision?: boolean;
  /**
   * Tool calls the running turn has paused on, awaiting a decision. Rendered
   * below the transcript, since the pause belongs to the turn rather than to
   * any one bubble.
   */
  pendingApprovals?: ToolApprovalProposal[] | null;
  onSubmitApprovalDecisions?: (decisions: ToolApprovalDecision[]) => void;
  isSubmittingApproval?: boolean;
  approvalError?: string | null;
  /**
   * The conversations the panel can open, by id: the loaded conversation list.
   * A referenced conversation's chip opens it through `onOpenConversation`
   * when it is there, and is a plain label otherwise.
   */
  openableConversationIds?: ReadonlySet<string>;
  onOpenConversation?: (conversationId: string) => void;
  t: (key: string) => string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short uppercase extension label for a file chip (e.g. `report.pdf` → `PDF`). */
function fileExtensionLabel(filename: string): string | undefined {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return undefined;
  const ext = filename.slice(dot + 1);
  return ext.length <= 8 ? ext.toUpperCase() : undefined;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);

/**
 * True when an attachment is worth previewing inline rather than showing as a
 * download card. The MIME type is authoritative; the short `type` label and the
 * filename extension are fallbacks for backends that omit it.
 */
function isImageAttachment(att: ChatAttachment): boolean {
  if (att.contentType?.toLowerCase().startsWith('image/')) return true;
  const label = att.type?.toLowerCase();
  if (label && IMAGE_EXTENSIONS.has(label)) return true;
  const dot = att.filename.lastIndexOf('.');
  return dot > 0 && IMAGE_EXTENSIONS.has(att.filename.slice(dot + 1).toLowerCase());
}

/**
 * The footer's secondary controls show while the message is hovered or holds
 * the focus, and always where nothing hovers (a touch screen). A keyboard user
 * tabbing onto one sees it through `focus-visible` / `focus-within`.
 */
const REVEAL_ON_HOVER =
  'opacity-0 group-hover/msg:opacity-100 group-focus-within/msg:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100';
const FOOTER_BUTTON = 'p-1 rounded-lg transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)]';
const REVEALED_BUTTON = `${REVEAL_ON_HOVER} hover:text-[var(--chat-accent)] focus-visible:text-[var(--chat-accent)]`;
/** A control in its "on" state (the given rating, the message being read) stays in view. */
const ACTIVE_BUTTON = 'opacity-100 text-[var(--chat-accent)]';

/** When the message was sent; the tooltip spells the date out. */
const MessageTime = ({ timestamp, locale }: { timestamp: Date; locale?: string }) => {
  const time = formatMessageTime(timestamp, locale);
  if (!time) return null;
  return (
    <Tooltip title={time.full}>
      <time dateTime={time.iso} className="px-1 text-[0.65rem] tabular-nums text-gray-400 dark:text-white/40 select-none">
        <span aria-hidden="true">{time.label}</span>
        <span className="sr-only">{time.full}</span>
      </time>
    </Tooltip>
  );
};

/** Copies a message as plain text. Revealed on message hover. */
const MessageCopyButton = ({ text, label, t }: { text: string; label: string; t: (key: string) => string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DELAY);
    } catch {
      /* Clipboard unavailable (insecure context / denied permission) — the
         button simply doesn't confirm rather than throwing at the user. */
    }
  };

  const name = copied ? t('Copied!') : label;
  return (
    <Tooltip title={name}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={name}
        className={`${FOOTER_BUTTON} ${copied ? 'opacity-100 text-green-500 dark:text-green-400' : REVEALED_BUTTON}`}
      >
        {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      </button>
    </Tooltip>
  );
};

/**
 * 👍/👎 on a completed answer. Clicking the active value clears it. A rating
 * given before the conversation was reopened is final: only it is shown.
 */
const MessageFeedbackButtons = ({
  value,
  locked,
  pending,
  onChange,
  downRef,
  t,
}: {
  value: MessageFeedback | null;
  locked: boolean;
  pending: boolean;
  onChange: (next: MessageFeedback | null) => void;
  downRef: React.RefObject<HTMLButtonElement | null>;
  t: (key: string) => string;
}) => {
  const lockedId = useId();
  const inert = locked || pending;

  const button = (target: MessageFeedback, label: string) => {
    const active = value === target;
    if (locked && !active) return null;
    const Icon = target === 'up' ? ThumbsUpIcon : ThumbsDownIcon;
    return (
      <Tooltip title={locked ? t('Feedback already submitted') : label}>
        <button
          ref={target === 'down' ? downRef : undefined}
          type="button"
          onClick={() => {
            if (!inert) onChange(active ? null : target);
          }}
          aria-label={label}
          aria-pressed={active}
          // Not `disabled`: a disabled button takes no focus and no hover, so
          // it could not say why it does not answer.
          aria-disabled={inert || undefined}
          aria-describedby={locked ? lockedId : undefined}
          className={`${FOOTER_BUTTON} ${active ? ACTIVE_BUTTON : REVEALED_BUTTON} ${inert ? 'cursor-default' : ''}`}
        >
          <Icon size={14} filled={active} />
        </button>
      </Tooltip>
    );
  };

  return (
    <>
      {button('up', t('Good response'))}
      {button('down', t('Bad response'))}
      {locked && (
        <span id={lockedId} className="sr-only">
          {t('Feedback already submitted')}
        </span>
      )}
    </>
  );
};

/** The optional word on what went wrong, asked once a thumbs down is stored. */
const FeedbackComment = ({
  pending,
  onSave,
  onSkip,
  t,
}: {
  pending: boolean;
  onSave: (text: string) => void;
  onSkip: () => void;
  t: (key: string) => string;
}) => {
  const [text, setText] = useState('');
  const id = useId();
  const canSave = !pending && !!text.trim();

  return (
    <div className="mt-1 flex w-full max-w-[90%] flex-col gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] p-2">
      <label htmlFor={id} className="text-[0.7rem] text-gray-600 dark:text-white/60">
        {t('Tell us what went wrong (optional)')}
      </label>
      <textarea
        id={id}
        // Opened by the user's own thumbs down, to be typed into.
        autoFocus
        rows={2}
        maxLength={FEEDBACK_COMMENT_MAX_LENGTH}
        value={text}
        // Read-only rather than disabled while saving, so the focus stays here.
        readOnly={pending}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (!pending) onSkip();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (canSave) onSave(text);
          }
        }}
        placeholder={t('What could be improved?')}
        className="w-full resize-y rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-2 py-1 text-[0.75rem] leading-5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)]"
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (!pending) onSkip();
          }}
          aria-disabled={pending || undefined}
          className="rounded-md px-2 py-0.5 text-[0.7rem] text-gray-500 dark:text-white/50 transition-colors hover:text-[var(--chat-accent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)]"
        >
          {t('Skip')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (canSave) onSave(text);
          }}
          aria-disabled={!canSave || undefined}
          className={`rounded-md px-2 py-0.5 text-[0.7rem] text-white bg-[var(--chat-accent)] transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)] ${canSave ? 'hover:opacity-90' : 'opacity-50 cursor-default'}`}
        >
          {t('Save')}
        </button>
      </div>
    </div>
  );
};

/** Reads the answer aloud; the same button stops it. */
const ReadAloudButton = ({ speaking, onToggle, t }: { speaking: boolean; onToggle: () => void; t: (key: string) => string }) => {
  const name = speaking ? t('Stop reading') : t('Read aloud');
  return (
    <Tooltip title={name}>
      <button type="button" onClick={onToggle} aria-label={name} className={`${FOOTER_BUTTON} ${speaking ? ACTIVE_BUTTON : REVEALED_BUTTON}`}>
        {speaking ? <VolumeOffIcon size={14} /> : <VolumeIcon size={14} />}
      </button>
    </Tooltip>
  );
};

interface MessageRowProps {
  msg: ChatMessage;
  /** True only for the message currently being streamed. */
  isStreaming: boolean;
  agentName: string;
  logoIcon: React.ReactNode;
  onRelativeLinkClick?: (href: string) => void;
  onDownloadFile?: (attachment: ChatAttachment) => void;
  resolveAttachmentUrl?: (attachment: ChatAttachment) => string | undefined;
  requestHeaders?: Record<string, string>;
  /** How this answer's thumbs work, or null for none (`feedbackModeOf`). */
  feedbackMode: FeedbackMode | null;
  /** What the user did to its rating in this session. */
  feedback: FeedbackEntry | undefined;
  onRate: (msg: ChatMessage, next: MessageFeedback | null, current: FeedbackEntry | undefined) => void;
  onSaveComment: (msg: ChatMessage, text: string, current: FeedbackEntry) => void;
  onSkipComment: (msg: ChatMessage, current: FeedbackEntry) => void;
  locale?: string;
  /** The browser can read aloud. */
  canSpeak: boolean;
  /** This message is being read aloud. */
  isSpeaking: boolean;
  onToggleSpeech: (id: string, documents: readonly string[]) => void;
  /** Given only to a message referencing conversations (see `ChatMessagesProps`). */
  openableConversationIds?: ReadonlySet<string>;
  onOpenConversation?: (conversationId: string) => void;
  t: (key: string) => string;
}

/**
 * One message in the thread.
 *
 * Memoized: the parent re-renders on every streamed frame, and without this
 * every settled message would re-run its markdown parse and re-mount its
 * attachment cards on each frame.
 */
const MessageRow = memo(
  ({
    msg,
    isStreaming,
    agentName,
    logoIcon,
    onRelativeLinkClick,
    onDownloadFile,
    resolveAttachmentUrl,
    requestHeaders,
    feedbackMode,
    feedback,
    onRate,
    onSaveComment,
    onSkipComment,
    locale,
    canSpeak,
    isSpeaking,
    onToggleSpeech,
    openableConversationIds,
    onOpenConversation,
    t,
  }: MessageRowProps) => {
    const [showReasoning, setShowReasoning] = useState(false);
    const isAssistant = msg.role === 'assistant';
    const isEmpty = !msg.content;
    const downRef = useRef<HTMLButtonElement>(null);

    // The comment question takes the focus when it opens; when it closes with
    // the focus still in it (the element is gone, so the page lost it), the
    // focus goes back to the thumb that opened it rather than to the page.
    const commentOpen = !!feedback?.commentOpen;
    const wasCommentOpen = useRef(commentOpen);
    useLayoutEffect(() => {
      const closed = wasCommentOpen.current && !commentOpen;
      wasCommentOpen.current = commentOpen;
      if (closed && (!document.activeElement || document.activeElement === document.body)) downRef.current?.focus();
    }, [commentOpen]);

    const renderAttachmentCard = (att: ChatAttachment, key: string) => {
      // An image the host can resolve a URL for is shown, not filed away.
      const previewUrl = resolveAttachmentUrl && isImageAttachment(att) ? resolveAttachmentUrl(att) : undefined;
      if (previewUrl) {
        return <ChatImage key={key} src={previewUrl} alt={att.filename} requestHeaders={requestHeaders} maxHeightClass="max-h-[200px]" t={t} />;
      }

      const isWorking = att.fileTag === 'working_file';
      const sizeLabel = formatFileSize(att.size);
      return (
        <button
          key={key}
          type="button"
          onClick={() => onDownloadFile?.(att)}
          title={t('Download')}
          className={`group flex items-center gap-2 text-left rounded-lg border px-2.5 py-1.5 transition-colors cursor-pointer max-w-[90%] ${
            isWorking
              ? 'border-gray-200 dark:border-white/10 bg-transparent'
              : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] hover:border-[var(--chat-accent)] hover:bg-[var(--chat-accent)]/5'
          }`}
        >
          <span className={`shrink-0 ${isWorking ? 'text-gray-400 dark:text-white/40' : 'text-[var(--chat-accent)]'}`}>
            <FileIcon size={16} />
          </span>
          <span className="flex flex-col min-w-0 flex-1">
            <span className="truncate text-[0.75rem] text-gray-900 dark:text-white">{att.filename}</span>
            {(att.type || sizeLabel) && (
              <span className="text-[0.65rem] text-gray-400 dark:text-white/40 uppercase">{[att.type, sizeLabel].filter(Boolean).join(' · ')}</span>
            )}
          </span>
          <span className="shrink-0 text-gray-400 dark:text-white/30 group-hover:text-[var(--chat-accent)]">
            <DownloadIcon size={15} />
          </span>
        </button>
      );
    };

    // A user-uploaded file shown as a non-clickable chip — used while the upload
    // is still in flight (no server `fileId` yet) or when no download handler is
    // wired by the host.
    const renderFileChip = (name: string, key: string) => (
      <span
        key={key}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-[0.7rem] text-gray-600 dark:text-white/60"
      >
        <FileIcon size={14} />
        {name}
      </span>
    );

    // Render assistant content as an ordered interleave of prose segments and
    // download cards, so a reply with markers like
    // `text [[FILE:a]] more text [[FILE:b]]` keeps the cards at their source
    // position. Cards only render when a download handler is wired
    // (`onDownloadFile`); attachments whose marker isn't found in the prose are
    // appended as a fallback. During streaming the attachments aren't hydrated
    // yet, so only prose (markers stripped) renders.
    const buildAssistantBlocks = (): React.ReactNode[] => {
      const parts = splitFileMarkers(msg.content);
      const attByFileId = new Map((msg.attachments ?? []).map((a) => [a.fileId, a] as const));
      const used = new Set<string>();
      const blocks: React.ReactNode[] = [];

      parts.forEach((part, i) => {
        if (part.type === 'text') {
          if (part.value.trim()) {
            blocks.push(
              <div key={`t-${i}`} className="max-w-[90%] pl-1 py-1 text-[0.8125rem] leading-7">
                <MarkdownMessage
                  content={part.value}
                  streaming={isStreaming}
                  onRelativeLinkClick={onRelativeLinkClick}
                  requestHeaders={requestHeaders}
                  t={t}
                />
              </div>,
            );
          }
        } else if (onDownloadFile) {
          const att = attByFileId.get(part.fileId);
          if (att) {
            used.add(part.fileId);
            blocks.push(renderAttachmentCard(att, `f-${part.fileId}-${i}`));
          }
        }
      });

      if (onDownloadFile) {
        (msg.attachments ?? []).forEach((att) => {
          if (!used.has(att.fileId)) {
            blocks.push(renderAttachmentCard(att, `orphan-${att.fileId}`));
          }
        });
      }

      // An assistant reply that is *only* a file marker leaves no prose; show a
      // subtle ellipsis (not an empty padded bubble) when nothing else rendered
      // and we're not still streaming.
      if (blocks.length === 0 && !isStreaming) {
        blocks.push(
          <span key="empty" className="pl-1 text-[0.8125rem] text-gray-400 dark:text-white/40 italic">
            ...
          </span>,
        );
      }

      return blocks;
    };

    // Build the file cards shown on a user message. A successfully-uploaded file
    // carries a server `fileId`, so it renders as the same download card as an
    // agent-generated attachment (re-using the host download proxy via
    // `onDownloadFile`) — uploaded files must stay downloadable, not just
    // displayed. Files still uploading (no `fileId` / not `done`) or hosts
    // without a download handler fall back to a static chip. On conversation
    // restore the backend re-surfaces user uploads as `attachments` (there are
    // no live `files`), so those are rendered too.
    const buildUserFileBlocks = (): React.ReactNode[] => {
      const blocks: React.ReactNode[] = [];
      const seen = new Set<string>();

      (msg.files ?? []).forEach((f, i) => {
        const downloadable = !!(onDownloadFile && f.fileId && f.uploadStatus === 'done');
        if (downloadable && f.fileId) {
          seen.add(f.fileId);
          blocks.push(
            renderAttachmentCard(
              { fileId: f.fileId, filename: f.name, type: fileExtensionLabel(f.name), size: f.size, contentType: f.type },
              `file-${f.fileId}-${i}`,
            ),
          );
        } else {
          blocks.push(renderFileChip(f.name, `file-${i}`));
        }
      });

      (msg.attachments ?? []).forEach((att, i) => {
        if (seen.has(att.fileId)) return;
        seen.add(att.fileId);
        blocks.push(onDownloadFile ? renderAttachmentCard(att, `att-${att.fileId}-${i}`) : renderFileChip(att.filename, `att-${i}`));
      });

      return blocks;
    };

    // A conversation the message referenced with `@`: it opens in the panel
    // when the panel can open it, and otherwise just says what was referenced.
    const renderConversationRef = (ref: ChatConversationRef, i: number) => {
      const label = ref.title || (ref.key ? `@${ref.key}` : t('Untitled conversation'));
      const chip = 'inline-flex items-center gap-1 max-w-[240px] px-2 py-0.5 rounded-full border text-[0.7rem]';
      const content = (
        <>
          <MessageSquareIcon size={13} className="shrink-0" />
          <span className="truncate">{label}</span>
        </>
      );
      if (onOpenConversation && openableConversationIds?.has(ref.conversationId)) {
        return (
          <Tooltip key={`ref-${ref.conversationId}-${i}`} title={t('Open conversation')}>
            <button
              type="button"
              onClick={() => onOpenConversation(ref.conversationId)}
              className={`${chip} border-[var(--chat-accent-40)] text-[var(--chat-accent)] hover:bg-[var(--chat-accent)]/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)]`}
            >
              {content}
            </button>
          </Tooltip>
        );
      }
      return (
        <Tooltip key={`ref-${ref.conversationId}-${i}`} title={ref.key ? `@${ref.key}` : ''}>
          <span className={`${chip} border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60`}>{content}</span>
        </Tooltip>
      );
    };

    const hasReasoningDetails =
      (msg.toolNames && msg.toolNames.length > 0) ||
      !!(msg.reasoning ?? '').trim() ||
      (msg.toolCallTrace && msg.toolCallTrace.length > 0) ||
      (msg.transferChain && msg.transferChain.length > 0) ||
      msg.isTruncated;

    // Actions only make sense on a finished answer, so they stay hidden while
    // the message is still streaming.
    const showActions = isAssistant && !isEmpty && !isStreaming;
    const plainText = stripFileMarkers(msg.content);
    const speechDocuments = useMemo(
      () => (showActions && canSpeak ? answerMarkdownSources(msg.content) : null),
      [showActions, canSpeak, msg.content],
    );
    const shown = shownFeedback(feedback, msg.feedback);
    const speechKey = feedbackKeyOf(msg);

    return (
      <div className={`group/msg flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
        {isAssistant && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--chat-accent)]/20 to-[var(--chat-accent)]/5">
              <span className="text-[var(--chat-accent)] [&>svg]:w-3 [&>svg]:h-3">{logoIcon}</span>
            </div>
            {/*
              The message's own agent wins over the panel-wide one. That name is
              whoever is selected right now, which is simply wrong for history —
              a thread that changed hands mid-way must keep each answer under
              the agent that wrote it.
            */}
            <span className="font-semibold text-xs text-gray-900 dark:text-white">{msg.agentName ?? agentName}</span>
          </div>
        )}

        {!isAssistant && ((msg.files?.length ?? 0) > 0 || (msg.attachments?.length ?? 0) > 0) && (
          <div className="flex gap-1.5 flex-wrap mb-1.5 justify-end">{buildUserFileBlocks()}</div>
        )}

        {!isAssistant && (msg.conversationRefs?.length ?? 0) > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-1.5 justify-end max-w-[90%]">{msg.conversationRefs!.map(renderConversationRef)}</div>
        )}

        {isAssistant ? (
          <div className="flex flex-col gap-1.5 w-full items-start">
            {buildAssistantBlocks()}
            {!isEmpty && isStreaming && <span className="inline-block w-1.5 h-4 bg-[var(--chat-accent)]/70 rounded-xs ml-1 animate-pulse" />}
          </div>
        ) : (
          <div className="max-w-[90%] px-3.5 py-2 rounded-[14px_14px_4px_14px] bg-[var(--chat-accent-dark)] text-white text-[0.8125rem] leading-6">
            {msg.content}
          </div>
        )}

        {/* The user's side mirrors the answer's: the time hugs the bubble's edge. */}
        {!isAssistant && (
          <div className="mt-0.5 flex items-center justify-end gap-0.5 text-gray-400 dark:text-white/40">
            {!!msg.content.trim() && <MessageCopyButton text={msg.content} label={t('Copy message')} t={t} />}
            {!msg.timestampUnknown && <MessageTime timestamp={msg.timestamp} locale={locale} />}
          </div>
        )}

        {showActions && (
          <div className="mt-0.5 flex flex-wrap items-center gap-0.5 text-gray-400 dark:text-white/40">
            {!msg.timestampUnknown && <MessageTime timestamp={msg.timestamp} locale={locale} />}
            {hasReasoningDetails && (
              <Tooltip title={msg.isTruncated ? t('Reasoning details — turn limit reached') : t('Reasoning details')}>
                <button
                  type="button"
                  onClick={() => setShowReasoning((v) => !v)}
                  className={`${FOOTER_BUTTON} ${
                    msg.isTruncated
                      ? // A truncated turn must be visible at a glance (not gated
                        // on hover) so the user notices the warning — mirrors the
                        // XTM One web chat affordance.
                        'opacity-100 text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                      : 'opacity-50 hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--chat-accent)] focus-visible:text-[var(--chat-accent)]'
                  }`}
                  aria-label={msg.isTruncated ? t('Reasoning details — turn limit reached') : t('Reasoning details')}
                  aria-haspopup="dialog"
                  aria-expanded={showReasoning}
                >
                  {msg.isTruncated ? <AlertTriangleIcon size={14} /> : <InfoIcon size={14} />}
                </button>
              </Tooltip>
            )}
            <MessageCopyButton text={plainText} label={t('Copy response')} t={t} />
            {feedbackMode && (
              <MessageFeedbackButtons
                value={shown.value}
                locked={shown.locked}
                pending={!!feedback?.pending}
                onChange={(next) => onRate(msg, next, feedback)}
                downRef={downRef}
                t={t}
              />
            )}
            {speechDocuments && hasSpeakableWords(speechDocuments) && (
              <ReadAloudButton speaking={isSpeaking} onToggle={() => onToggleSpeech(speechKey, speechDocuments)} t={t} />
            )}
          </div>
        )}
        {showActions && feedback?.commentOpen && (
          <FeedbackComment
            pending={feedback.pending}
            onSave={(text) => onSaveComment(msg, text, feedback)}
            onSkip={() => onSkipComment(msg, feedback)}
            t={t}
          />
        )}
        {showActions && feedback?.error && (
          <p role="alert" className="mt-0.5 pl-1 text-[0.7rem] text-red-600 dark:text-red-400">
            {feedback.error}
          </p>
        )}
        {showReasoning && <ReasoningDetailsDialog msg={msg} onClose={() => setShowReasoning(false)} t={t} />}
      </div>
    );
  },
);

MessageRow.displayName = 'MessageRow';

export const ChatMessages = ({
  messages,
  isLoading,
  agentStatus,
  agentName,
  logoIcon,
  onRelativeLinkClick,
  onDownloadFile,
  resolveAttachmentUrl,
  requestHeaders,
  miniGameEnabled = true,
  onPlayWaitingGame,
  waitingGameUrl,
  onMessageFeedback,
  isResumingAfterDecision,
  pendingApprovals,
  onSubmitApprovalDecisions,
  isSubmittingApproval,
  approvalError,
  feedbackUrl,
  conversationId,
  locale,
  openableConversationIds,
  onOpenConversation,
  t,
}: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [renderWindow, setRenderWindow] = useState(INITIAL_RENDER_WINDOW);
  const {
    entries: feedbackEntries,
    rate,
    saveComment,
    skipComment,
  } = useMessageFeedback({
    feedbackUrl,
    conversationId,
    requestHeaders,
    onMessageFeedback,
    t,
  });
  const speech = useSpeechReader(locale);

  // Keeps the end of the conversation in view while the reader is at the
  // bottom (see `createScrollFollower`). It holds no React state: its timer
  // firing after unmount finds no container and does nothing.
  const [follower] = useState(() => createScrollFollower(() => scrollRef.current));
  // The highest point of the touch in progress: a swipe is measured from it,
  // so a finger that turns back down counts from where it turned.
  const touchAnchorRef = useRef<number | null>(null);

  // A gesture toward the top is the reader leaving the bottom — but only where
  // it moves the thread itself: an overlay portalled out of it (the image
  // lightbox) still bubbles its events here through React and scrolls nothing
  // of ours, and a box inside it that can still go up takes the gesture first.
  const leaveFrom = (container: HTMLDivElement, target: EventTarget) => {
    if (!(target instanceof Element) || !container.contains(target)) return;
    if (innerBoxScrollsUp<Element>(target, container, parentOf, overflowYOf)) return;
    follower.leave();
  };
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (wheelScrollsUp(event)) leaveFrom(event.currentTarget, event.target);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !keyScrollsUp(event) || isTypingTarget(event.target)) return;
    if (event.key === ' ' && isControl(event.target)) return;
    leaveFrom(event.currentTarget, event.target);
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const press = {
      button: event.button,
      onContainer: event.target === container,
      onControl: isControl(event.target),
      x: event.clientX - rect.left - container.clientLeft,
      y: event.clientY - rect.top - container.clientTop,
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    };
    if (pressTakesScrollbar(press)) leaveFrom(container, event.target);
  };
  // A second finger ends the swipe: a pinch is no scroll, and the swipe of
  // the finger left on the screen is measured afresh from its next move.
  const handleTouchStart = (event: React.TouchEvent) => {
    touchAnchorRef.current = singleTouchY(event.touches);
  };
  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const y = singleTouchY(event.touches);
    const anchor = touchAnchorRef.current;
    if (y !== null && anchor !== null && swipeScrollsUp(anchor, y)) leaveFrom(event.currentTarget, event.target);
    touchAnchorRef.current = nextTouchAnchor(anchor, y);
  };

  // Switching conversation (restore / new chat) replaces the whole array, so
  // the window must snap back to the tail instead of keeping a widened one.
  const firstMessageId = messages[0]?.id;
  useEffect(() => {
    setRenderWindow(INITIAL_RENDER_WINDOW);
  }, [firstMessageId]);

  // A message the user just sent (a steer included) and a conversation just
  // opened are scrolled into view smoothly, and the view follows again.
  // Anything else — mostly the streamed answer, which changes `messages` on
  // every frame — keeps the bottom in view only while the view follows, so a
  // reader who scrolled up stays where they are.
  let userMessageCount = 0;
  for (const m of messages) if (m.role === 'user') userMessageCount += 1;
  const seenRef = useRef<{ firstMessageId?: string; userMessageCount: number } | null>(null);
  useLayoutEffect(() => {
    const seen = seenRef.current;
    seenRef.current = { firstMessageId, userMessageCount };
    if (!seen || seen.firstMessageId !== firstMessageId || userMessageCount > seen.userMessageCount) {
      follower.reveal();
    } else {
      follower.keepUp();
    }
  }, [messages, firstMessageId, userMessageCount, follower]);

  // Keep the bottom in view while the reasoning window below the status
  // bubble grows: thinking prose streams in without any `messages` change,
  // so without this the growing window slides under the fold and the user
  // stops seeing the live reasoning.
  const thinkingLen = agentStatus?.thinkingContent?.length ?? 0;
  useLayoutEffect(() => {
    if (thinkingLen) follower.keepUp();
  }, [thinkingLen, follower]);

  const hasEarlierMessages = messages.length > renderWindow;
  const visibleMessages = useMemo(
    () => (hasEarlierMessages ? messages.slice(messages.length - renderWindow) : messages),
    [messages, renderWindow, hasEarlierMessages],
  );

  // Reading aloud is about the message on screen: it stops when the user
  // sends a new one, opens another conversation, or the message goes away.
  const { speakingId, stop: stopSpeech } = speech;
  const spokenStillShown = speakingId === null || messages.some((m) => feedbackKeyOf(m) === speakingId);
  const speechScope = useRef({ conversationId, userMessageCount });
  useEffect(() => {
    const previous = speechScope.current;
    speechScope.current = { conversationId, userMessageCount };
    if (previous.conversationId !== conversationId || userMessageCount > previous.userMessageCount || !spokenStillShown) stopSpeech();
  }, [conversationId, userMessageCount, spokenStillShown, stopSpeech]);

  // The streaming response is the LAST ASSISTANT message — not necessarily
  // the last message overall: a mid-run steering send appends an optimistic
  // user bubble after the assistant message that is still streaming. Gating
  // on `messages.length - 1` would then drop the live cursor / ChatThinking
  // state the moment the user steers.
  let streamingMessageId: string | null = null;
  if (isLoading) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        streamingMessageId = messages[i].id;
        break;
      }
    }
  }

  // Only a prompt something can actually answer counts: without a submit
  // handler the controls would collect verdicts with nowhere to send them.
  const awaitingApproval = !!pendingApprovals?.length && !!onSubmitApprovalDecisions;

  // A tab stop of its own, so the keys scroll the thread (and are read as
  // leaving the bottom) without first focusing something inside it.
  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={t('Conversation transcript')}
      tabIndex={0}
      onScroll={follower.onScroll}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 filigran-chat-scrollable outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chat-accent-50)]"
    >
      {hasEarlierMessages && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setRenderWindow((w) => w + RENDER_WINDOW_STEP)}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-white/10 px-3 py-1 text-[0.7rem] text-gray-500 dark:text-white/50 transition-colors hover:border-[var(--chat-accent)]/40 hover:text-[var(--chat-accent)]"
          >
            <ChevronDownIcon size={13} className="rotate-180" />
            {t('Load earlier messages')}
          </button>
        </div>
      )}

      {visibleMessages.map((msg) => {
        const isStreamingMessage = msg.id === streamingMessageId;
        // An assistant message with no content yet is the "agent is working"
        // placeholder, replaced by the live status bubble.
        if (msg.role === 'assistant' && !msg.content && isStreamingMessage) {
          // A turn paused for approval is not working, it is waiting on the
          // person reading it — so the progress bubble (and the waiting game
          // it grows into) gives way to the prompt rendered below.
          if (awaitingApproval) return null;
          return (
            <div key={msg.id}>
              <ChatThinking
                agentStatus={agentStatus}
                logoIcon={logoIcon}
                t={t}
                miniGameEnabled={miniGameEnabled}
                onPlayWaitingGame={onPlayWaitingGame}
                waitingGameUrl={waitingGameUrl}
                keepEndInView={follower.keepUp}
              />
            </div>
          );
        }

        return (
          <MessageRow
            key={msg.id}
            msg={msg}
            isStreaming={isStreamingMessage}
            agentName={agentName}
            logoIcon={logoIcon}
            onRelativeLinkClick={onRelativeLinkClick}
            onDownloadFile={onDownloadFile}
            resolveAttachmentUrl={resolveAttachmentUrl}
            requestHeaders={requestHeaders}
            feedbackMode={msg.role === 'assistant' ? feedbackModeOf(msg.serverId, feedbackUrl, conversationId, !!onMessageFeedback) : null}
            feedback={feedbackEntries[feedbackKeyOf(msg)]}
            onRate={rate}
            onSaveComment={saveComment}
            onSkipComment={skipComment}
            locale={locale}
            canSpeak={speech.supported}
            isSpeaking={speakingId === feedbackKeyOf(msg)}
            onToggleSpeech={speech.toggle}
            // Only to a row that needs them: a new list of openable
            // conversations must not re-render every row of the thread.
            openableConversationIds={msg.conversationRefs?.length ? openableConversationIds : undefined}
            onOpenConversation={msg.conversationRefs?.length ? onOpenConversation : undefined}
            t={t}
          />
        );
      })}
      {/* Not tied to a placeholder message like the streaming indicator: a
          restore replaces the whole transcript on every poll, so there is no
          bubble of ours left to hang it on. */}
      {isResumingAfterDecision && !awaitingApproval && (
        <ChatThinking
          agentStatus={agentStatus}
          logoIcon={logoIcon}
          t={t}
          miniGameEnabled={miniGameEnabled}
          onPlayWaitingGame={onPlayWaitingGame}
          waitingGameUrl={waitingGameUrl}
          keepEndInView={follower.keepUp}
        />
      )}
      {awaitingApproval && (
        <ChatApprovalPrompt
          // A second pause in the same turn is a new question, not a continuation
          // of the answered one: remounting drops the verdicts and the
          // already-submitted guard the previous set left behind.
          key={pendingApprovals!.map((p) => p.toolCallId).join('|')}
          proposals={pendingApprovals!}
          onSubmit={onSubmitApprovalDecisions!}
          isSubmitting={isSubmittingApproval}
          error={approvalError}
          t={t}
        />
      )}
      {/* Holds the list's gap below its last item. */}
      <div />
    </div>
  );
};
