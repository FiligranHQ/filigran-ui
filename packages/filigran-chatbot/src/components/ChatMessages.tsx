import { useEffect, useRef, useState } from 'react';
import type { AgentStatusState, ChatAttachment, ChatMessage } from '../types';
import { splitFileMarkers } from '../utils';
import { AlertTriangleIcon, DownloadIcon, FileIcon, InfoIcon } from './icons';
import { ChatThinking } from './ChatThinking';
import { MarkdownMessage } from './MarkdownMessage';
import { ReasoningDetailsDialog } from './ReasoningDetailsDialog';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  agentStatus: AgentStatusState | null;
  agentName: string;
  logoIcon: React.ReactNode;
  onRelativeLinkClick?: (href: string) => void;
  /** Download an agent-generated file via the host app's backend proxy. */
  onDownloadFile?: (attachment: ChatAttachment) => void;
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

export const ChatMessages = ({
  messages,
  isLoading,
  agentStatus,
  agentName,
  logoIcon,
  onRelativeLinkClick,
  onDownloadFile,
  t,
}: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [toolDetailMsgId, setToolDetailMsgId] = useState<string | null>(null);

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

  const renderAttachmentCard = (att: ChatAttachment, key: string) => {
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

  // Render assistant content as an ordered interleave of prose segments and
  // download cards, so a reply with markers like
  // `text [[FILE:a]] more text [[FILE:b]]` keeps the cards at their source
  // position. Cards only render when a download handler is wired
  // (`onDownloadFile`); attachments whose marker isn't found in the prose are
  // appended as a fallback. During streaming the attachments aren't hydrated
  // yet, so only prose (markers stripped) renders.
  const buildAssistantBlocks = (msg: ChatMessage, loading: boolean): React.ReactNode[] => {
    const parts = splitFileMarkers(msg.content);
    const attByFileId = new Map((msg.attachments ?? []).map((a) => [a.fileId, a] as const));
    const used = new Set<string>();
    const blocks: React.ReactNode[] = [];

    parts.forEach((part, i) => {
      if (part.type === 'text') {
        if (part.value.trim()) {
          blocks.push(
            <div key={`t-${i}`} className="max-w-[90%] pl-1 py-1 text-[0.8125rem] leading-7">
              <MarkdownMessage content={part.value} onRelativeLinkClick={onRelativeLinkClick} />
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
    if (blocks.length === 0 && !loading) {
      blocks.push(
        <span key="empty" className="pl-1 text-[0.8125rem] text-gray-400 dark:text-white/40 italic">
          ...
        </span>,
      );
    }

    return blocks;
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

  // Build the file cards shown on a user message. A successfully-uploaded file
  // carries a server `fileId`, so it renders as the same download card as an
  // agent-generated attachment (re-using the host download proxy via
  // `onDownloadFile`) — uploaded files must stay downloadable, not just
  // displayed. Files still uploading (no `fileId` / not `done`) or hosts
  // without a download handler fall back to a static chip. On conversation
  // restore the backend re-surfaces user uploads as `attachments` (there are
  // no live `files`), so those are rendered too.
  const buildUserFileBlocks = (msg: ChatMessage): React.ReactNode[] => {
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

  // The streaming response is the LAST ASSISTANT message — not necessarily
  // the last message overall: a mid-run steering send appends an optimistic
  // user bubble after the assistant message that is still streaming. Gating
  // on `messages.length - 1` would then drop the live cursor / ChatThinking
  // state the moment the user steers.
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 filigran-chat-scrollable">
      {messages.map((msg, index) => {
        const isAssistant = msg.role === 'assistant';
        const isEmpty = !msg.content;
        // The live cursor / thinking bubble / ChatThinking state — and,
        // conversely, the hiding of the completed-message affordances (the
        // reasoning "i" button) — must be gated on the streaming message.
        // Gating those on the global `isLoading` instead made the blinking
        // cursor leak onto every prior assistant message and the "i" button
        // vanish from all of them while a *later* response was streaming.
        const isStreamingMessage = isLoading && index === lastAssistantIndex;
        const isThinking = isAssistant && isEmpty && isStreamingMessage;

        if (isThinking) {
          return (
            <div key={msg.id}>
              <ChatThinking agentStatus={agentStatus} logoIcon={logoIcon} t={t} />
            </div>
          );
        }

        return (
          <div key={msg.id} className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
            {isAssistant && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--chat-accent)]/20 to-[var(--chat-accent)]/5">
                  <span className="text-[var(--chat-accent)] [&>svg]:w-3 [&>svg]:h-3">{logoIcon}</span>
                </div>
                <span className="font-semibold text-xs text-gray-900 dark:text-white">{agentName}</span>
              </div>
            )}

            {!isAssistant && ((msg.files?.length ?? 0) > 0 || (msg.attachments?.length ?? 0) > 0) && (
              <div className="flex gap-1.5 flex-wrap mb-1.5 justify-end">{buildUserFileBlocks(msg)}</div>
            )}

            {isAssistant ? (
              <div className="flex flex-col gap-1.5 w-full items-start">
                {buildAssistantBlocks(msg, isStreamingMessage)}
                {!isEmpty && isStreamingMessage && (
                  <span className="inline-block w-1.5 h-4 bg-[var(--chat-accent)]/70 rounded-xs ml-1 animate-pulse" />
                )}
              </div>
            ) : (
              <div className="max-w-[90%] px-3.5 py-2 rounded-[14px_14px_4px_14px] bg-[var(--chat-accent-dark)] text-white text-[0.8125rem] leading-6">
                {msg.content}
              </div>
            )}

            {isAssistant &&
              !isEmpty &&
              !isStreamingMessage &&
              ((msg.toolNames && msg.toolNames.length > 0) || (msg.reasoning ?? '').trim() || msg.isTruncated) && (
                <>
                  <button
                    type="button"
                    onClick={() => setToolDetailMsgId(toolDetailMsgId === msg.id ? null : msg.id)}
                    className={`mt-0.5 p-1 rounded-lg transition-opacity ${
                      msg.isTruncated
                        ? // A truncated turn must be visible at a glance (not
                          // gated on hover) so the user notices the warning —
                          // mirrors the XTM One web chat affordance.
                          'opacity-100 text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                        : 'opacity-50 hover:opacity-100 hover:text-[var(--chat-accent)]'
                    }`}
                    title={msg.isTruncated ? t('Reasoning details — turn limit reached') : t('Reasoning details')}
                  >
                    {msg.isTruncated ? <AlertTriangleIcon size={14} /> : <InfoIcon size={14} />}
                  </button>
                  {toolDetailMsgId === msg.id && <ReasoningDetailsDialog msg={msg} onClose={() => setToolDetailMsgId(null)} t={t} />}
                </>
              )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
