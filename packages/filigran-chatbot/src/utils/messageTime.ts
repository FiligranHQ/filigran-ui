/**
 * The time shown under a chat message.
 *
 * A message from today reads as its time alone (`14:05`); an older one leads
 * with a short date (`29 Sept, 14:05`), and one from another year carries the
 * year, so a restored conversation says when each answer was given without
 * anyone having to hover. The tooltip spells the whole date out.
 *
 * Kept free of local imports so `node --test` runs it as is.
 */

export interface MessageTime {
  /** What the footer shows. */
  label: string;
  /** The complete date and time, for the tooltip. */
  full: string;
  /** Machine-readable, for the `dateTime` attribute of a `<time>` element. */
  iso: string;
}

type FormatKind = 'time' | 'date' | 'dateWithYear' | 'full';

const FORMAT_OPTIONS: Record<FormatKind, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit' },
  date: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
  dateWithYear: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  full: { dateStyle: 'full', timeStyle: 'short' },
};

// Every row of a transcript formats with the same few formatters, and building
// one costs far more than using it.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string | undefined, kind: FormatKind): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${kind}`;
  let cached = formatters.get(key);
  if (!cached) {
    try {
      cached = new Intl.DateTimeFormat(locale || undefined, FORMAT_OPTIONS[kind]);
    } catch {
      // A malformed tag throws a RangeError: fall back to the browser's own
      // language rather than losing the time.
      cached = new Intl.DateTimeFormat(undefined, FORMAT_OPTIONS[kind]);
    }
    formatters.set(key, cached);
  }
  return cached;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * The footer time of a message sent at `date`, in `locale` (browser default
 * when absent), read against `now`. `null` for a date that is not one, so a
 * backend sending an unparseable `created_at` loses the time, not the row.
 */
export function formatMessageTime(date: Date, locale?: string, now: Date = new Date()): MessageTime | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const kind: FormatKind = sameDay(date, now) ? 'time' : date.getFullYear() === now.getFullYear() ? 'date' : 'dateWithYear';
  return {
    label: formatter(locale, kind).format(date),
    full: formatter(locale, 'full').format(date),
    iso: date.toISOString(),
  };
}
