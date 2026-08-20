import { useEffect, useId, useRef, useState } from 'react';
import type { ToolApprovalDecision, ToolApprovalProposal, ToolApprovalVerdict } from '../types';
import { AlertTriangleIcon, CheckIcon, WrenchIcon, XCircleIcon } from './icons';

interface ChatApprovalPromptProps {
  proposals: ToolApprovalProposal[];
  /** Sends one decision per proposal — the backend refuses a partial set. */
  onSubmit: (decisions: ToolApprovalDecision[]) => void;
  isSubmitting?: boolean;
  /** Why the last submission failed. Non-null re-arms the controls for a retry. */
  error?: string | null;
  t: (key: string) => string;
}

/** Shape of one argument as described by the tool's own JSON Schema. */
interface ArgumentSchema {
  description?: string;
  type?: string;
}

/**
 * Pull `{ description, type }` for one argument out of a JSON Schema, tolerating
 * a schema that is absent or shaped unexpectedly — an unlabelled argument still
 * renders, it just carries less.
 */
function argumentSchema(inputSchema: Record<string, unknown> | undefined, name: string): ArgumentSchema {
  const properties = inputSchema?.properties;
  if (!properties || typeof properties !== 'object') return {};
  const entry = (properties as Record<string, unknown>)[name];
  if (!entry || typeof entry !== 'object') return {};
  const e = entry as Record<string, unknown>;
  return {
    description: typeof e.description === 'string' ? e.description : undefined,
    type: typeof e.type === 'string' ? e.type : undefined,
  };
}

/** Render an argument value as something a person can read. */
function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    // Cyclic or otherwise unstringifiable — the reviewer still needs to see
    // that the argument is there, so degrade rather than blank the card.
    return String(value);
  }
}

/**
 * Scroll `ref` into view when `active` becomes true, and on each later
 * transition into it.
 *
 * Every control here is revealed rather than always present: the prompt itself
 * arrives at the bottom of a thread that has just grown by a whole turn, "No"
 * opens a reason box under the card, and "Yes, always" opens a warning under the
 * list. In each case the click can look like it did nothing — and on a *paused*
 * turn a stalled reviewer stalls the agent too. rAF because the revealed node
 * must be laid out before it can be scrolled to.
 */
function useRevealIntoView<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return ref;
}

const BUTTON_BASE =
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

interface ApprovalCardProps {
  proposal: ToolApprovalProposal;
  decision: ToolApprovalDecision | undefined;
  onDecide: (decision: ToolApprovalDecision) => void;
  disabled?: boolean;
  t: (key: string) => string;
}

/**
 * One proposed call: what the agent wants to run, what it does, and every
 * argument labelled with the tool's own description of it.
 *
 * Those descriptions are the difference between a control and a rubber stamp.
 * `cascade: true` is unjudgeable; "cascade — also delete linked entities" is a
 * decision someone can actually make.
 */
const ApprovalCard = ({ proposal, decision, onDecide, disabled, t }: ApprovalCardProps) => {
  // Declining asks why before it sends. With argument editing deliberately
  // absent, a rejection IS the correction channel — it is the agent's only
  // signal to adapt. Optional, so a reviewer with nothing to add just confirms.
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  // Every proposal in a batch renders its own reason box, so the association
  // needs an id unique to this card rather than a constant.
  const reasonId = useId();
  const rejectPanelRef = useRevealIntoView<HTMLDivElement>(rejecting);

  const verdict = decision?.verdict;
  const argumentNames = Object.keys(proposal.arguments ?? {});

  const decide = (next: ToolApprovalVerdict) => {
    onDecide({
      toolCallId: proposal.toolCallId,
      verdict: next,
      ...(next === 'reject' && reason.trim() ? { rejectionReason: reason.trim() } : {}),
    });
  };

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <WrenchIcon size={13} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-gray-800 dark:text-white/85">{proposal.toolName}</p>
            {proposal.toolDescription && <p className="mt-0.5 text-[0.7rem] text-gray-600 dark:text-white/60">{proposal.toolDescription}</p>}
            {proposal.source && <p className="mt-0.5 text-[0.65rem] text-gray-400 dark:text-white/35">{proposal.source}</p>}
          </div>
        </div>
        {verdict && (
          <span
            className={
              'shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-medium ' +
              (verdict === 'reject' ? 'bg-red-500/15 text-red-600 dark:text-red-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')
            }
          >
            {verdict === 'reject' ? t('Declined') : verdict === 'approve_always' ? t('Always allowed') : t('Approved')}
          </span>
        )}
      </div>

      {argumentNames.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {argumentNames.map((name) => {
            const schema = argumentSchema(proposal.inputSchema, name);
            return (
              <div key={name} className="text-[0.7rem]">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-mono text-gray-700 dark:text-white/75">{name}</span>
                  {schema.description && <span className="text-gray-500 dark:text-white/45">— {schema.description}</span>}
                </div>
                <pre className="mt-0.5 whitespace-pre-wrap break-all font-mono text-gray-600 dark:text-white/60">
                  {formatValue(proposal.arguments?.[name])}
                </pre>
              </div>
            );
          })}
        </div>
      )}

      {!verdict && rejecting && (
        <div ref={rejectPanelRef} className="flex flex-col gap-1.5">
          <label htmlFor={reasonId} className="text-[0.7rem] text-gray-500 dark:text-white/45">
            {t('Why not? The agent sees this and can adapt (optional)')}
          </label>
          <textarea
            id={reasonId}
            autoFocus
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('e.g. wrong environment — use staging instead')}
            className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1 text-[0.7rem] text-gray-800 outline-none focus:border-[var(--chat-accent)]/50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => decide('reject')}
              className={`${BUTTON_BASE} bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-300`}
            >
              <XCircleIcon size={13} />
              {t('Decline this call')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              className={`${BUTTON_BASE} text-gray-500 hover:bg-gray-100 dark:text-white/50 dark:hover:bg-white/5`}
            >
              {t('Back')}
            </button>
          </div>
        </div>
      )}

      {!verdict && !rejecting && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRejecting(true)}
            className={`${BUTTON_BASE} text-red-600 hover:bg-red-500/10 dark:text-red-300`}
          >
            <XCircleIcon size={13} />
            {t('No')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => decide('approve')}
            className={`${BUTTON_BASE} bg-[var(--chat-accent)] text-white hover:opacity-90`}
          >
            <CheckIcon size={13} />
            {t('Yes')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => decide('approve_always')}
            /* Disclosed on the control itself rather than buried in a tooltip:
               this is the one verdict whose effect outlives the turn. */
            title={t('Also applies to your scheduled runs, until you revoke it')}
            className={`${BUTTON_BASE} border border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5`}
          >
            {t('Yes, always')}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Collects a verdict for every call a paused turn is waiting on.
 *
 * Submission is all-or-nothing because the backend requires it: resuming with
 * an undecided call would leave its `tool_use` block without a `tool_result`,
 * which the model providers reject outright. That condition is met the moment
 * the last card is decided, so the set submits itself there — a verdict is
 * final once clicked (a decided card shows a badge, not buttons), so a separate
 * confirm would gate work already committed to.
 *
 * "Yes, always" is the exception and the only click that earns a confirm step:
 * it saves a standing preference for this user that applies to unattended runs
 * too, and that has to be read before it is committed.
 */
export const ChatApprovalPrompt = ({ proposals, onSubmit, isSubmitting, error, t }: ChatApprovalPromptProps) => {
  const [decisions, setDecisions] = useState<Record<string, ToolApprovalDecision>>({});
  // Guards the auto-submit against a double fire: React may re-render between
  // the last verdict and the parent flipping `isSubmitting`, and answering the
  // same pause twice would decide a turn that is already resuming.
  const submitted = useRef(false);
  // The same fact as state, because a ref cannot re-render the footer button.
  const [sent, setSent] = useState(false);

  // A failed submission is the one case where the prompt survives its own send:
  // the turn is still paused, so the controls have to come back for a retry.
  useEffect(() => {
    if (!error) return;
    submitted.current = false;
    setSent(false);
  }, [error]);

  const busy = isSubmitting || sent;

  const submit = (all: ToolApprovalDecision[]) => {
    if (submitted.current || isSubmitting) return;
    submitted.current = true;
    setSent(true);
    onSubmit(all);
  };

  const decidedCount = proposals.filter((p) => decisions[p.toolCallId]).length;
  const allDecided = decidedCount === proposals.length && proposals.length > 0;
  const willRunAlways = Object.values(decisions).some((d) => d.verdict === 'approve_always');

  // The warning and the confirm sit *below* the cards, so an "always" click can
  // push them past the fold — exactly what must be read before confirming.
  const footerRef = useRevealIntoView<HTMLDivElement>(willRunAlways);
  // The prompt arrives at the bottom of a thread that just grew by a whole
  // turn. Always true: the mount is the reveal.
  const rootRef = useRevealIntoView<HTMLDivElement>(true);

  return (
    <div ref={rootRef} className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.02] p-3">
      <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangleIcon size={13} className="mt-0.5 shrink-0" />
        {proposals.length === 1 ? t('The agent needs your approval to run a tool:') : t('The agent needs your approval to run these tools:')}
      </p>

      {proposals.map((proposal) => (
        <ApprovalCard
          key={proposal.toolCallId}
          proposal={proposal}
          decision={decisions[proposal.toolCallId]}
          disabled={busy}
          t={t}
          onDecide={(decision) => {
            const next = { ...decisions, [decision.toolCallId]: decision };
            setDecisions(next);
            // Safe to read `decisions` from the closure: each verdict is its
            // own click, so this handler always sees the state the previous
            // one set.
            const all = proposals.map((p) => next[p.toolCallId]);
            if (all.every(Boolean) && !all.some((d) => d.verdict === 'approve_always')) {
              submit(all);
            }
          }}
        />
      ))}

      {willRunAlways && (
        <p className="flex items-start gap-1.5 text-[0.7rem] text-amber-700 dark:text-amber-300/90">
          <AlertTriangleIcon size={13} className="mt-0.5 shrink-0" />
          {t(
            '“Yes, always” saves a preference for you. That tool will then run without asking — including on scheduled runs nobody is watching — until you revoke it.',
          )}
        </p>
      )}

      {error && <p className="text-[0.7rem] text-red-600 dark:text-red-300">{error}</p>}

      <div ref={footerRef} className="flex items-center justify-between gap-2">
        {/* The counter earns its place only when there is more than one thing
            to count; on a single proposal it reads as a progress bar for a
            one-step process. */}
        <span className="text-[0.7rem] text-gray-500 dark:text-white/40">
          {proposals.length > 1 ? `${decidedCount}/${proposals.length} ${t('decided')}` : ''}
        </span>
        <button
          type="button"
          disabled={!allDecided || busy}
          onClick={() => submit(proposals.map((p) => decisions[p.toolCallId]))}
          className={`${BUTTON_BASE} bg-[var(--chat-accent)] text-white hover:opacity-90`}
        >
          {busy ? t('Sending…') : t('Confirm')}
        </button>
      </div>
    </div>
  );
};
