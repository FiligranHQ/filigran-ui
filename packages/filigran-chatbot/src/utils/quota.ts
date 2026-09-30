import type { ChatQuotaStatus, Translate } from '../types';

/**
 * The quota the composer indicator shows, as the quota route sends it.
 *
 * Kept free of local runtime imports so `node --test` runs it as is.
 */

/** Defensive parse: an unexpected payload shows no indicator rather than a wrong one. */
export function parseQuota(data: unknown): ChatQuotaStatus | null {
  if (!data || typeof data !== 'object') return null;
  const q = data as Record<string, unknown>;
  if (typeof q.used !== 'number') return null;
  return {
    used: q.used,
    // Explicitly nullable: absent and null both mean "no ceiling".
    limit: typeof q.limit === 'number' ? q.limit : null,
    period: typeof q.period === 'string' ? q.period : '',
    ...(q.scope === 'global' || q.scope === 'user' ? { scope: q.scope } : {}),
  };
}

/**
 * The period a limit applies to, as the tooltip words it: the periods XTM One
 * sets a quota for are translated, anything else is shown as sent.
 */
export function quotaPeriodLabel(period: string, t: Translate): string {
  switch (period) {
    case 'daily':
      return t('today');
    case 'monthly':
      return t('this month');
    case 'yearly':
      return t('this year');
    default:
      return period;
  }
}
