import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentStatusState, ChatAttachment, ChatMessage, MessageFeedback } from '../types';
import { splitFileMarkers, stripFileMarkers } from '../utils';
import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, CopyIcon, DownloadIcon, FileIcon, InfoIcon, ThumbsDownIcon, ThumbsUpIcon } from './icons';
import { ChatImage } from './ChatImage';
import { ChatThinking } from './ChatThinking';
import { MarkdownMessage } from './MarkdownMessage';
import { ReasoningDetailsDialog } from './ReasoningDetailsDialog';

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
  /** Host-level override for the waiting mini-game / dynamic messages. */
  miniGameEnabled?: boolean;
  /** Enables the 👍/👎 affordance on completed assistant messages. */
  onMessageFeedback?: (messageId: string, feedback: MessageFeedback | null, message: ChatMessage) => void;
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

/** Copies the assistant's answer as plain text. Revealed on message hover. */
const MessageCopyButton = ({ text, t }: { text: string; t: (key: string) => string }) => {
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

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`p-1 rounded-lg transition-opacity ${
        copied
          ? 'opacity-100 text-green-500 dark:text-green-400'
          : 'opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100 hover:text-[var(--chat-accent)] focus-visible:text-[var(--chat-accent)]'
      }`}
    >
    </button>
  );
};

/** 👍/👎 on a completed answer. Clicking the active value clears it. */
const MessageFeedbackButtons = ({
  value,
  onChange,
  t,
}: {
  value: MessageFeedback | null;
  onChange: (next: MessageFeedback | null) => void;
  t: (key: string) => string;
}) => {
  const buttonClass = (active: boolean) =>
    `p-1 rounded-lg transition-opacity ${active ? 'opacity-100 text-[var(--chat-accent)]' : 'opacity-0 group-hover/msg:opacity-100 hover:text-[var(--chat-accent)]'}`;

  return (
    <>
      <button
        type="button"
        onClick={() => onChange(value === 'up' ? null : 'up')}
        title={t('Good response')}
        aria-label={t('Good response')}
        aria-pressed={value === 'up'}
        className={buttonClass(value === 'up')}
      >
        <ThumbsUpIcon size={14} filled={value === 'up'} />
      </button>
      <button
        type="button"
        onClick={() => onChange(value === 'down' ? null : 'down')}
        title={t('Bad response')}
        aria-label={t('Bad response')}
        aria-pressed={value === 'down'}
        className={buttonClass(value === 'down')}
      >
        <ThumbsDownIcon size={14} filled={value === 'down'} />
      </button>
    </>
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
  feedback: MessageFeedback | null;
  onFeedbackChange?: (messageId: string, feedback: MessageFeedback | null, message: ChatMessage) => void;
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
    feedback,
    onFeedbackChange,
    t,
  }: MessageRowProps) => {
    const [showReasoning, setShowReasoning] = useState(false);
    const isAssistant = msg.role === 'assistant';
    const isEmpty = !msg.content;

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
                <MarkdownMessage content={part.value} onRelativeLinkClick={onRelativeLinkClick} requestHeaders={requestHeaders} t={t} />
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

    const hasReasoningDetails =
      (msg.toolNames && msg.toolNames.length > 0) ||
      !!(msg.reasoning ?? '').trim() ||
      (msg.toolCallTrace && msg.toolCallTrace.length > 0) ||
      (msg.transferChain && msg.transferChain.length > 0) ||
      msg.isTruncated;

    // Actions only make sense on a finished answer, so they stay hidden while
    // the message is still streaming.
    const showActions = isAssistant && !isEmpty && !isStreaming;

    return (
      <div className={`group/msg flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
        {isAssistant && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--chat-accent)]/20 to-[var(--chat-accent)]/5">
              <span className="text-[var(--chat-accent)] [&>svg]:w-3 [&>svg]:h-3">{logoIcon}</span>
            </div>
            <span className="font-semibold text-xs text-gray-900 dark:text-white">{agentName}</span>
          </div>
        )}

        {!isAssistant && ((msg.files?.length ?? 0) > 0 || (msg.attachments?.length ?? 0) > 0) && (
          <div className="flex gap-1.5 flex-wrap mb-1.5 justify-end">{buildUserFileBlocks()}</div>
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

        {showActions && (
          <div className="mt-0.5 flex items-center gap-0.5 text-gray-400 dark:text-white/40">
            <MessageCopyButton text={stripFileMarkers(msg.content)} t={t} />
            {onFeedbackChange && (
              <MessageFeedbackButtons value={feedback} onChange={(next) => onFeedbackChange(msg.id, next, msg)} t={t} />
            )}
            {hasReasoningDetails && (
              <button
                type="button"
                onClick={() => setShowReasoning((v) => !v)}
                className={`p-1 rounded-lg transition-opacity ${
                  msg.isTruncated
                    ? // A truncated turn must be visible at a glance (not gated
                      // on hover) so the user notices the warning — mirrors the
                      // XTM One web chat affordance.
                      'opacity-100 text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                    : 'opacity-50 hover:opacity-100 hover:text-[var(--chat-accent)]'
                }`}
                title={msg.isTruncated ? t('Reasoning details — turn limit reached') : t('Reasoning details')}
                aria-label={msg.isTruncated ? t('Reasoning details — turn limit reached') : t('Reasoning details')}
                aria-haspopup="dialog"
                aria-expanded={showReasoning}
              >
                {msg.isTruncated ? <AlertTriangleIcon size={14} /> : <InfoIcon size={14} />}
              </button>
            )}
          </div>
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
  onMessageFeedback,
  t,
}: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [renderWindow, setRenderWindow] = useState(INITIAL_RENDER_WINDOW);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, MessageFeedback>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep the bottom in view while the reasoning window below the status
  // bubble grows: thinking prose streams in without any `messages` change,
  // so without this the growing window slides under the fold and the user
  // stops seeing the live reasoning. `behavior: 'instant'` (CSSOM View,
  // Baseline-supported) forces a non-animated jump — this fires on every
  // reasoning chunk and smooth animations would queue up; 'auto' would not
  // do, since a `scroll-behavior: smooth` ancestor turns it smooth again.
  const thinkingLen = agentStatus?.thinkingContent?.length ?? 0;
  useEffect(() => {
    if (!thinkingLen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [thinkingLen]);

  // Switching conversation (restore / new chat) replaces the whole array, so
  // the window must snap back to the tail instead of keeping a widened one.
  const firstMessageId = messages[0]?.id;
  useEffect(() => {
    setRenderWindow(INITIAL_RENDER_WINDOW);
  }, [firstMessageId]);

  const hasEarlierMessages = messages.length > renderWindow;
  const visibleMessages = useMemo(
    () => (hasEarlierMessages ? messages.slice(messages.length - renderWindow) : messages),
    [messages, renderWindow, hasEarlierMessages],
  );

  const handleFeedbackChange = useCallback(
    (messageId: string, next: MessageFeedback | null, message: ChatMessage) => {
      setFeedbackByMessage((prev) => {
        if (next !== null) return { ...prev, [messageId]: next };
        if (!(messageId in prev)) return prev;
        const rest = { ...prev };
        delete rest[messageId];
        return rest;
      });
      onMessageFeedback?.(messageId, next, message);
    },
    [onMessageFeedback],
  );

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

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 filigran-chat-scrollable">
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
          return (
            <div key={msg.id}>
              <ChatThinking agentStatus={agentStatus} logoIcon={logoIcon} t={t} miniGameEnabled={miniGameEnabled} />
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
            feedback={feedbackByMessage[msg.id] ?? null}
            onFeedbackChange={onMessageFeedback ? handleFeedbackChange : undefined}
            t={t}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
