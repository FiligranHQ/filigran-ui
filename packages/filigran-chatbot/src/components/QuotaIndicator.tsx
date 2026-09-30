import type { ChatQuotaStatus } from '../types';
import { compactCount as compact, translate } from '../utils';
import { quotaPeriodLabel } from '../utils/quota';
import { Tooltip } from './Tooltip';

interface QuotaIndicatorProps {
  quota: ChatQuotaStatus;
  t: (key: string) => string;
}

/**
 * Agentic quota headroom, as a small bar plus counts.
 *
 * Colour is earned, not decorative: neutral until 75%, amber past it, red once
 * the allowance is spent — the point is to warn before a turn is refused, not
 * to decorate the composer.
 */
export const QuotaIndicator = ({ quota, t }: QuotaIndicatorProps) => {
  const { used, limit } = quota;
  const period = quotaPeriodLabel(quota.period, t);
  // One allowance for the whole platform: say so, or a user reads colleagues'
  // consumption as their own.
  const withScope = (title: string) => (quota.scope === 'global' ? translate(t, '{quota} (shared across all users)', { quota: title }) : title);

  // No ceiling: report consumption without implying a limit that isn't there.
  if (limit === null) {
    const title = withScope(period ? translate(t, 'Usage · {period}', { period }) : t('Usage'));
    return (
      <Tooltip title={title}>
        <span className="text-[0.68rem] tabular-nums text-gray-400 dark:text-white/30" role="img" aria-label={`${title} ${compact(used)}`}>
          {compact(used)}
        </span>
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
  const headline = exhausted ? t('Quota reached') : t('Quota');
  const title = withScope(period ? `${headline} · ${period}` : headline);

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
