import { useRef, useState } from 'react';
import type { ChatContextBreakdown, ChatContextUsage } from '../types';
import { compactCount } from '../utils';
import { Dropdown } from './Dropdown';
import { Tooltip } from './Tooltip';

interface ContextUsageIndicatorProps {
  usage: ChatContextUsage;
  t: (key: string) => string;
}

// Thresholds are the agent loop's own gates, not design choices: at 80 %
// utilization the backend compacts the session (older turns are distilled into
// a summary), and past 95 % it emergency-prunes. Colouring anywhere else would
// warn about a moment that never comes, or arrive after it has passed.
const COMPACTION_RATIO = 0.8;
const PRUNE_RATIO = 0.95;

// Geometry of the ring. Kept at the text's own scale so the gauge reads as part
// of the label rather than as an icon beside it.
const SIZE = 14;
const STROKE = 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Rows of the detail popover, in a FIXED order that mirrors how the prompt is
 * assembled — instructions, then tools, then the conversation and what the
 * backend has done to it. Fixed rather than sorted by size so the same bucket
 * stays in the same place as a chat grows: a legend whose rows reshuffle between
 * two glances cannot be compared against itself.
 *
 * `color` is both the swatch and the stacked-bar segment, so the bar is readable
 * without a legend lookup. Labels name what the user can act on, not the
 * backend's internals: "Tool results" rather than "role=tool messages".
 */
const ROWS: ReadonlyArray<{ field: keyof ChatContextBreakdown; label: string; color: string }> = [
  { field: 'system', label: 'System prompt', color: '#9ca3af' },
  { field: 'tools', label: 'Tool definitions', color: '#a78bfa' },
  { field: 'dynamicTools', label: 'MCP & dynamic tools', color: '#f0abfc' },
  { field: 'summary', label: 'Summarized conversation', color: '#fb7185' },
  { field: 'toolResults', label: 'Tool results', color: '#34d399' },
  { field: 'conversation', label: 'Conversation', color: '#a1a1aa' },
];

/**
 * Context-window occupancy for the current conversation, as a small ring plus
 * percentage — the affordance Cursor popularised — opening a breakdown of where
 * the context went.
 *
 * It answers one question: is this conversation about to get shorter than the
 * user thinks? Long chats do not fail at the window, they get silently
 * summarised, and a user who cannot see that coming reads the summary's gaps as
 * the assistant forgetting. So the gauge is deliberately a *forecast* of the
 * next turn, and its colours are the backend's real thresholds.
 */
export const ContextUsageIndicator = ({ usage, t }: ContextUsageIndicatorProps) => {
  const { used, limit, breakdown } = usage;
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  // The parser guarantees a positive limit; clamp anyway so a future producer
  // cannot draw a ring past full or a negative arc.
  const ratio = Math.min(Math.max(used / limit, 0), 1);
  const pruning = ratio >= PRUNE_RATIO;
  const compacting = ratio >= COMPACTION_RATIO;

  const ringColor = pruning ? 'text-red-500' : compacting ? 'text-amber-500' : 'text-[var(--chat-accent)]';
  const textColor = pruning
    ? 'text-red-500 dark:text-red-400'
    : compacting
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-gray-400 dark:text-white/30';

  const percent = Math.round(ratio * 100);
  const counts = `${compactCount(used)}/${compactCount(limit)}`;
  // Naming the consequence beats naming the state: "80 % full" leaves the user
  // to guess what happens next, which is the whole reason the gauge exists.
  const headline = pruning
    ? t('Context full — older turns are being dropped')
    : compacting
      ? t('Context nearly full — older turns are being summarized')
      : t('Context used');
  const summary = `${headline} · ${counts} ${t('tokens')}`;

  const rows = breakdown ? ROWS.filter((r) => (breakdown[r.field] ?? 0) > 0) : [];
  // Without a breakdown there is nothing to open, so the readout stays inert
  // rather than offering a click that does nothing.
  const expandable = rows.length > 0;

  const gauge = (
    <span className="flex items-center gap-1.5">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className={ringColor} aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-gray-200 dark:stroke-white/15"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          /* Start at twelve o'clock: a gauge that fills from the side reads
             as a spinner. */
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className={`text-[0.68rem] tabular-nums ${textColor}`}>{percent}%</span>
    </span>
  );

  if (!expandable) {
    return (
      <Tooltip title={summary}>
        <span className="flex items-center" role="img" aria-label={`${summary} (${percent}%)`}>
          {gauge}
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title={open ? '' : `${summary} — ${t('click for details')}`}>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={`${summary} (${percent}%)`}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex items-center rounded-md px-1 -mx-1 py-0.5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
        >
          {gauge}
        </button>
      </Tooltip>

      <Dropdown open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement="bottom-end" width={296}>
        <div className="px-3.5 pt-3 pb-1 flex items-baseline justify-between gap-3">
          <span className={`text-[0.8125rem] tabular-nums ${textColor}`}>{t('{percent}% full').replace('{percent}', String(percent))}</span>
          {/* The tilde is load-bearing: these are char-derived estimates, and a
              bare "168k/200k" would read as a measured count. */}
          <span className="text-[0.7rem] tabular-nums text-gray-400 dark:text-white/40 shrink-0">
            ~{counts} {t('tokens')}
          </span>
        </div>

        {/* One stacked bar over the whole window: the segments are the legend's
            own colours, so proportions are readable without matching numbers to
            rows. The trailing gap is the headroom left. */}
        <div className="px-3.5 pb-2.5 pt-1.5">
          <span className="flex h-1.5 w-full gap-px rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            {rows.map((row) => (
              <span
                key={row.field}
                className="h-full first:rounded-l-full"
                style={{ width: `${((breakdown?.[row.field] ?? 0) / limit) * 100}%`, backgroundColor: row.color }}
              />
            ))}
          </span>
        </div>

        <div className="px-3.5 pb-1">
          {rows.map((row) => (
            <div key={row.field} className="flex items-center gap-2 py-[3px]">
              {/* Radius set inline: the panel's reset rounds small spans to a
                  pill, which turns the swatches into dots that read as bullets
                  rather than as keys to the bar's segments. */}
              <span className="h-2 w-2 shrink-0" style={{ backgroundColor: row.color, borderRadius: 2 }} aria-hidden="true" />
              <span className="text-[0.75rem] text-gray-700 dark:text-white/70 truncate">{t(row.label)}</span>
              <span className="ml-auto text-[0.7rem] tabular-nums text-gray-500 dark:text-white/40 shrink-0">{compactCount(breakdown?.[row.field] ?? 0)}</span>
            </div>
          ))}
        </div>

        {compacting && (
          // The one line that turns a readout into something actionable: at this
          // point the backend is already dropping detail from older turns.
          <p className={`px-3.5 pt-1 pb-3 text-[0.68rem] leading-snug ${textColor}`}>{headline}</p>
        )}
      </Dropdown>
    </>
  );
};
