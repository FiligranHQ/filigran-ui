/**
 * The date groups of the conversation list: Pinned, Today, Yesterday, Previous
 * 7 days, Previous 30 days, then one group per month, most recent first, as
 * the desktop assistants list their history.
 */
import type { Translate } from '../types';

/** A group of the list: its stable key, its sticky header and its conversations, in list order. */
export interface DateGroup<C> {
  key: string;
  label: string;
  conversations: C[];
}

const DAY_MS = 86_400_000;

/** Local midnight of *date*. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * The key of the group *iso* falls in, seen from *now*: `today`, `yesterday`,
 * `week` (2 to 7 days ago), `month` (8 to 30 days ago), else `YYYY-MM`;
 * `undated` for a missing or unparseable timestamp.
 */
export function dateGroupKey(iso: string | undefined, now: Date): string {
  if (!iso) return 'undated';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'undated';
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return `${then.getFullYear()}-${String(then.getMonth() + 1).padStart(2, '0')}`;
}

/** The header of group *key*: a month in the user's language, with its year when not the current one. */
function dateGroupLabel(key: string, now: Date, t: Translate): string {
  switch (key) {
    case 'pinned':
      return t('Pinned');
    case 'today':
      return t('Today');
    case 'yesterday':
      return t('Yesterday');
    case 'week':
      return t('Previous 7 days');
    case 'month':
      return t('Previous 30 days');
    case 'undated':
      return t('Older');
    default: {
      const [year, month] = key.split('-').map(Number);
      const options: Intl.DateTimeFormatOptions = year === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' };
      const label = new Date(year, month - 1, 1).toLocaleDateString(undefined, options);
      return label.charAt(0).toLocaleUpperCase() + label.slice(1);
    }
  }
}

/**
 * *conversations* (most recent first, as the backend lists them) cut into
 * date groups, in the order they come; a group holds at least one conversation.
 * The ones *isPinned* says are pinned come first, in their own Pinned group.
 */
export function groupByDate<C extends { updatedAt?: string }>(
  conversations: C[],
  now: Date,
  t: Translate,
  isPinned?: (conversation: C) => boolean,
): DateGroup<C>[] {
  const groups: DateGroup<C>[] = [];
  const byKey = new Map<string, DateGroup<C>>();
  const pinned = isPinned ? conversations.filter(isPinned) : [];
  if (pinned.length > 0) groups.push({ key: 'pinned', label: dateGroupLabel('pinned', now, t), conversations: pinned });
  for (const c of conversations) {
    if (isPinned?.(c)) continue;
    const key = dateGroupKey(c.updatedAt, now);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dateGroupLabel(key, now, t), conversations: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.conversations.push(c);
  }
  return groups;
}

/** Whether the rows show their agent's icon: only when the list holds conversations with more than one agent. */
export function showsSeveralAgents(conversations: { agentName?: string }[]): boolean {
  const names = new Set(conversations.map((c) => c.agentName).filter((name): name is string => !!name));
  return names.size > 1;
}

/** The text a row shows: its title, else the first words of its last message, else none (the caller's fallback). */
export function rowTitle(conversation: { title?: string; lastMessagePreview?: string }): string {
  const title = conversation.title?.trim();
  if (title) return title;
  const words = conversation.lastMessagePreview?.trim().split(/\s+/).slice(0, 8).join(' ');
  return words ?? '';
}
