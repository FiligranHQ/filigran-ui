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
        <span className="text-content-compact tabular-nums chat-text-muted-400/30" role="img" aria-label={`${title} ${compact(used)}`}>
          {compact(used)}
        </span>
      </Tooltip>
    );
  }

  // Guard a zero/negative limit rather than dividing by it.
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 1;
  const exhausted = limit > 0 ? used >= limit : true;
  const nearLimit = ratio >= 0.75;

  const barColor = exhausted ? 'bg-[var(--chat-danger)]' : nearLimit ? 'bg-[var(--chat-warning)]' : 'bg-[var(--chat-accent)]/60';
  const textColor = exhausted ? 'text-[var(--chat-danger)]' : nearLimit ? 'text-[var(--chat-warning)]' : 'chat-text-muted-400/30';

  const label = `${compact(used)}/${compact(limit)}`;
  const headline = exhausted ? t('Quota reached') : t('Quota');
  const title = withScope(period ? `${headline} · ${period}` : headline);

  return (
    <Tooltip title={title}>
      <span className="flex items-center gap-1.5" role="img" aria-label={`${title} ${label}`}>
        <span className="h-1 w-10 rounded-full chat-border-fill-200/10 overflow-hidden">
          <span className={`block h-full rounded-full transition-[width] duration-300 ${barColor}`} style={{ width: `${ratio * 100}%` }} />
        </span>
        <span className={`text-content-compact tabular-nums ${textColor}`}>{label}</span>
      </span>
    </Tooltip>
  );
};
