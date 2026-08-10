import type { ChatQuotaStatus } from '../types';
import { Tooltip } from './Tooltip';

interface QuotaIndicatorProps {
  quota: ChatQuotaStatus;
  t: (key: string) => string;
}

/** Compact count: 1200 → 1.2k, so the indicator never widens the toolbar. */
function compact(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/**
 * Agentic quota headroom, as a small bar plus counts.
 *
 * Colour is earned, not decorative: neutral until 75%, amber past it, red once
 * the allowance is spent — the point is to warn before a turn is refused, not
 * to decorate the composer.
 */
export const QuotaIndicator = ({ quota, t }: QuotaIndicatorProps) => {
  const { used, limit, period } = quota;

  // No ceiling: report consumption without implying a limit that isn't there.
  if (limit === null) {
    return (
      <Tooltip title={period ? `${t('Usage')} · ${period}` : t('Usage')}>
        <span className="text-[0.68rem] tabular-nums text-gray-400 dark:text-white/30">{compact(used)}</span>
      </Tooltip>
    );
  }

  // Guard a zero/negative limit rather than dividing by it.
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 1;
  const exhausted = limit > 0 ? used >= limit : true;
  const nearLimit = ratio >= 0.75;

  const barColor = exhausted ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-[var(--chat-accent)]/60';
  const textColor = exhausted
    ? 'text-red-500 dark:text-red-400'
    : nearLimit
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-gray-400 dark:text-white/30';

  const label = `${compact(used)}/${compact(limit)}`;
  const title = [exhausted ? t('Quota reached') : t('Quota'), period].filter(Boolean).join(' · ');

  return (
    <Tooltip title={title}>
      <span className="flex items-center gap-1.5" role="img" aria-label={`${title} ${label}`}>
        <span className="h-1 w-10 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
          <span className={`block h-full rounded-full transition-[width] duration-300 ${barColor}`} style={{ width: `${ratio * 100}%` }} />
        </span>
        <span className={`text-[0.68rem] tabular-nums ${textColor}`}>{label}</span>
      </span>
    </Tooltip>
  );
};
