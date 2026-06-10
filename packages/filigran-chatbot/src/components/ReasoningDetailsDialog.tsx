import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChatMessage, ToolCallTraceEntry } from '../types';
import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  BotIcon,
  BrainIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloseIcon,
  WrenchIcon,
  XCircleIcon,
} from './icons';
import { cleanReasoningText } from './ChatThinking';

/** Inputs longer than this are shown raw instead of pretty-printed JSON. */
const TRACE_INPUT_PRETTY_LIMIT = 10_000;

function findChatbotRoot(el: HTMLElement | null): HTMLElement {
  let node = el;
  while (node) {
    if (node.classList.contains('filigran-chatbot')) return node;
    node = node.parentElement;
  }
  return document.body;
}

function toolDisplayName(name: string): string {
  return name.replace(/_/g, ' ');
}

/** Expandable row for a single tool call in the reasoning-details dialog. */
const ToolCallRow = ({ entry, index, t }: { entry: ToolCallTraceEntry; index: number; t: (key: string) => string }) => {
  const [expanded, setExpanded] = useState(false);

  const inputDisplay = useMemo(() => {
    if (!entry.input) return '';
    if (entry.input.length > TRACE_INPUT_PRETTY_LIMIT) return entry.input;
    try {
      return JSON.stringify(JSON.parse(entry.input), null, 2);
    } catch {
      return entry.input;
    }
  }, [entry.input]);
  const hasInput = !!inputDisplay && inputDisplay !== '{}';

  return (
    <div className="border border-gray-200 dark:border-white/[0.06] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--chat-accent)]/10 text-[0.65rem] font-medium text-[var(--chat-accent)]">
          {index + 1}
        </span>
        {entry.success ? (
          <CheckCircleIcon size={12} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
        ) : (
          <XCircleIcon size={12} className="shrink-0 text-red-500 dark:text-red-400" />
        )}
        <span className="flex-1 min-w-0 text-[0.8125rem] text-gray-700 dark:text-white/80 truncate font-mono">{toolDisplayName(entry.name)}</span>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-gray-400 dark:text-white/50 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-white/[0.06]">
          {hasInput && (
            <div className="px-3 py-2 border-b border-gray-100 dark:border-white/[0.04] bg-gray-50/50 dark:bg-white/[0.01]">
              <p className="m-0 mb-1.5 text-[0.6rem] text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">{t('Input')}</p>
              <pre className="m-0 text-[0.7rem] text-gray-600 dark:text-white/60 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto filigran-chat-scrollable">
                {inputDisplay}
              </pre>
            </div>
          )}
          <div className="px-3 py-2 bg-gray-50/50 dark:bg-white/[0.01]">
            <p className="m-0 mb-1.5 text-[0.6rem] text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">{t('Output')}</p>
            <pre className="m-0 text-[0.7rem] text-gray-600 dark:text-white/60 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto filigran-chat-scrollable">
              {entry.output || t('(no output)')}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

interface ReasoningDetailsDialogProps {
  msg: ChatMessage;
  onClose: () => void;
  t: (key: string) => string;
}

/**
 * Modal dialog with the full reasoning details of an assistant message —
 * mirrors the XTM One web chat dialog (truncation warning, model reasoning,
 * expandable per-tool-call trace, transfer chain). Rendered as an overlay
 * covering the chatbot panel so it works in every mode and host without
 * depending on the host app's stacking order.
 */
export const ReasoningDetailsDialog = ({ msg, onClose, t }: ReasoningDetailsDialogProps) => {
  const hostRef = useRef<HTMLSpanElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(findChatbotRoot(hostRef.current));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Move initial keyboard focus into the modal (aria-modal) once the portal
  // is mounted, and hand it back to the trigger when the dialog closes.
  useEffect(() => {
    if (!root) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus({ preventScroll: true });
  }, [root]);

  // Prefer the backend's explicit count, then the detailed trace (what the
  // dialog body actually renders), then the flat tool-name list — keeps the
  // header summary consistent with the rows below.
  const totalCalls = msg.toolCallCount ?? msg.toolCallTrace?.length ?? msg.toolNames?.length ?? 0;
  const tools = msg.toolNames ?? [];
  const iterations = msg.iterations ?? 1;
  const transfers = msg.transferChain ?? [];
  const trace = msg.toolCallTrace ?? [];
  const reasoning = (msg.reasoning ?? '').trim();

  const summaryParts = [
    iterations > 1 ? `${iterations} ${t('iterations')}` : '',
    `${totalCalls} ${totalCalls === 1 ? t('tool call') : t('tool calls')}`,
    transfers.length > 0 ? `${transfers.length} ${transfers.length === 1 ? t('transfer') : t('transfers')}` : '',
  ].filter(Boolean);

  return (
    <span ref={hostRef} className="hidden">
      {root &&
        createPortal(
          <div
            className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/30 dark:bg-black/50 p-4"
            onClick={onClose}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t('Reasoning details')}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-full flex flex-col rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e2e] shadow-[0_8px_32px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            >
              <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <WrenchIcon size={15} className="text-[var(--chat-accent)]" />
                  <span className="flex-1 text-[0.875rem] font-semibold text-gray-900 dark:text-white">{t('Reasoning details')}</span>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    aria-label={t('Close')}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
                <p className="m-0 mt-0.5 text-[0.72rem] text-gray-500 dark:text-white/40">{summaryParts.join(' · ')}</p>
              </div>

              <div className="px-4 py-3 overflow-y-auto filigran-chat-scrollable flex flex-col gap-3">
                {msg.isTruncated && (
                  <div className="flex items-start gap-2.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[0.72rem] text-amber-600 dark:text-amber-300/90">
                    <AlertTriangleIcon size={14} className="shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                    <span>
                      <span className="font-semibold">{t('Turn limit reached.')}</span>{' '}
                      {t(
                        "The agent's iteration budget was exhausted - execution stopped before completing all planned steps. The final response is a best-effort summary of work done so far.",
                      )}
                    </span>
                  </div>
                )}

                {reasoning && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <BrainIcon size={13} className="text-[var(--chat-accent)]/70" />
                      <span className="text-[0.72rem] font-medium text-gray-500 dark:text-white/50">{t('Model reasoning')}</span>
                    </div>
                    <div className="rounded-md border border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.01] px-2.5 py-2 max-h-44 overflow-y-auto filigran-chat-scrollable">
                      <p className="m-0 whitespace-pre-wrap break-words text-[0.72rem] leading-5 text-gray-500 dark:text-white/45">
                        {cleanReasoningText(reasoning)}
                      </p>
                    </div>
                  </div>
                )}

                {trace.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {trace.map((entry, i) => (
                      <ToolCallRow key={`${entry.name}-${i}`} entry={entry} index={i} t={t} />
                    ))}
                  </div>
                ) : (
                  tools.length > 0 && (
                    // Fallback when no detailed trace is available (legacy
                    // messages / backends without trace support).
                    <div>
                      {tools.map((tn, i) => (
                        <div
                          key={`${tn}-${i}`}
                          className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--chat-accent)]/10 text-[0.65rem] font-medium text-[var(--chat-accent)]">
                            {i + 1}
                          </span>
                          <WrenchIcon size={12} className="shrink-0 text-gray-400 dark:text-white/50" />
                          <span className="text-[0.8125rem] text-gray-700 dark:text-white/80 truncate font-mono">{toolDisplayName(tn)}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {transfers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ArrowRightLeftIcon size={13} className="text-[var(--chat-accent)]/70" />
                      <span className="text-[0.72rem] font-medium text-gray-500 dark:text-white/50">{t('Transfer chain')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {transfers.map((tr, i) => (
                        // Composite key: the same agent can appear twice in a
                        // chain (A -> B -> A) and older payloads have no id.
                        <div key={`${tr.agentId}-${i}`} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-gray-300 dark:text-white/30 text-[0.72rem]">→</span>}
                          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--chat-accent)]/10 px-2 py-0.5 text-[0.72rem] font-medium text-[var(--chat-accent)]">
                            <BotIcon size={12} />
                            {tr.agentName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          root,
        )}
    </span>
  );
};
