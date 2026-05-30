import { useEffect, useRef, useState } from 'react';
import type { AgentStatusState, ChatAttachment, ChatMessage } from '../types';
import { splitFileMarkers } from '../utils';
import { DownloadIcon, FileIcon, InfoIcon } from './icons';
import { ChatThinking, ThinkingTextBubble } from './ChatThinking';
import { MarkdownMessage } from './MarkdownMessage';

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

export const ChatMessages = ({ messages, isLoading, agentStatus, agentName, logoIcon, onRelativeLinkClick, onDownloadFile, t }: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [toolDetailMsgId, setToolDetailMsgId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            <span className="text-[0.65rem] text-gray-400 dark:text-white/40 uppercase">
              {[att.type, sizeLabel].filter(Boolean).join(' · ')}
            </span>
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

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 filigran-chat-scrollable">
      {messages.map((msg, index) => {
        const isAssistant = msg.role === 'assistant';
        const isEmpty = !msg.content;
        const isThinking = isAssistant && isEmpty && isLoading;
        // The streaming response is always the last message, so the live
        // cursor / thinking bubble must be gated on it — otherwise every
        // previously completed assistant message would also show them while a
        // *later* response is streaming.
        const isStreamingMessage = isLoading && index === messages.length - 1;

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

            {isAssistant && !isEmpty && isStreamingMessage && agentStatus?.thinkingContent && <ThinkingTextBubble content={agentStatus.thinkingContent} />}

            {msg.files && msg.files.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {msg.files.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-[0.7rem] text-gray-600 dark:text-white/60"
                  >
                    <FileIcon size={14} />
                    {f.name}
                  </span>
                ))}
              </div>
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

            {isAssistant && !isEmpty && !isLoading && msg.toolNames && msg.toolNames.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setToolDetailMsgId(toolDetailMsgId === msg.id ? null : msg.id)}
                  className="mt-0.5 p-1 rounded-lg opacity-50 hover:opacity-100 hover:text-[var(--chat-accent)] transition-opacity"
                  title={t('Reasoning details')}
                >
                  <InfoIcon size={14} />
                </button>
                {toolDetailMsgId === msg.id && (
                  <div className="mt-1.5 p-3 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10">
                    <p className="text-[0.7rem] text-gray-500 dark:text-white/40 mb-1.5">
                      {msg.iterations && msg.iterations > 1 ? `${msg.iterations} iterations · ` : ''}
                      {msg.toolCallCount ?? msg.toolNames.length}{' '}
                      {(msg.toolCallCount ?? msg.toolNames.length) === 1 ? t('tool call') : t('tool calls')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(msg.toolNames)).map((tn) => (
                        <span
                          key={tn}
                          className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-[0.68rem] font-mono text-gray-500 dark:text-white/40"
                        >
                          {tn.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
