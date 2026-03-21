import { useEffect, useRef, useState } from 'react';
import type { AgentStatusState, ChatMessage } from '../types';
import { FileIcon, InfoIcon } from './icons';
import { ChatThinking } from './ChatThinking';
import { MarkdownMessage } from './MarkdownMessage';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  agentStatus: AgentStatusState | null;
  agentName: string;
  logoIcon: React.ReactNode;
  t: (key: string) => string;
}

export const ChatMessages = ({ messages, isLoading, agentStatus, agentName, logoIcon, t }: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [toolDetailMsgId, setToolDetailMsgId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 filigran-chat-scrollable">
      {messages.map((msg) => {
        const isAssistant = msg.role === 'assistant';
        const isEmpty = !msg.content;
        const isThinking = isAssistant && isEmpty && isLoading;

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

            <div
              className={`max-w-[90%] ${
                isAssistant
                  ? 'pl-1 py-1 text-[0.8125rem] leading-7'
                  : 'px-3.5 py-2 rounded-[14px_14px_4px_14px] bg-[var(--chat-accent-dark)] text-white text-[0.8125rem] leading-6'
              }`}
            >
              {isAssistant ? <MarkdownMessage content={msg.content} /> : msg.content}
              {isAssistant && isEmpty && !isLoading && <span className="text-[0.8125rem] text-gray-400 dark:text-white/40 italic">...</span>}
              {isAssistant && !isEmpty && isLoading && (
                <span className="inline-block w-1.5 h-4 bg-[var(--chat-accent)]/70 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>

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
