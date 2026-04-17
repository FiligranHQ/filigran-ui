import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckIcon, CopyIcon } from './icons';

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage = ({ content }: MarkdownMessageProps) => {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBlock(code);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-7 break-words text-[0.8125rem] text-gray-900 dark:text-white/90">{children}</p>,
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');
          if (match) {
            return (
              <div className="my-3 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden bg-gray-50 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/[0.03]">
                  <span className="text-[0.7rem] text-gray-500 dark:text-white/40 font-mono">{match[1]}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(codeStr)}
                    className="p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  >
                    {copiedBlock === codeStr ? (
                      <CheckIcon size={14} className="text-green-500" />
                    ) : (
                      <CopyIcon size={14} className="text-gray-400 dark:text-white/40" />
                    )}
                  </button>
                </div>
                <pre className="m-0 px-3 py-2 overflow-x-auto">
                  <code className="font-mono text-xs leading-[1.7] text-gray-800 dark:text-white/90 whitespace-pre">{codeStr}</code>
                </pre>
              </div>
            );
          }
          return (
            <code className="bg-gray-100 dark:bg-white/[0.08] px-1.5 py-0.5 rounded-sm font-mono text-xs text-[var(--chat-accent)]">{children}</code>
          );
        },
        ul: ({ children }) => (
          <ul className="pl-5 mb-3 text-[0.8125rem] text-gray-900 dark:text-white/90 [&_li]:mb-1 marker:text-[var(--chat-accent)]/50">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="pl-5 mb-3 text-[0.8125rem] text-gray-900 dark:text-white/90 [&_li]:mb-1 marker:text-[var(--chat-accent)]/50">{children}</ol>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-[var(--chat-accent)]/30 bg-[var(--chat-accent)]/[0.03] pl-4 pr-3 py-2 rounded-r-md italic text-gray-500 dark:text-white/60">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--chat-accent)] underline underline-offset-2 hover:brightness-125"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => <h1 className="mt-4 first:mt-0 mb-2 font-bold text-base text-gray-900 dark:text-white">{children}</h1>,
        h2: ({ children }) => <h2 className="mt-3 first:mt-0 mb-2 font-bold text-[0.9rem] text-gray-900 dark:text-white">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-3 first:mt-0 mb-1.5 font-semibold text-[0.85rem] text-gray-900 dark:text-white">{children}</h3>,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border-b border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80">{children}</td>
        ),
      }}
    >
      {content}
    </Markdown>
  );
};
