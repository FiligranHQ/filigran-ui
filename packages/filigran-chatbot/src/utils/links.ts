/**
 * An address a host gives the panel to open in place: an http(s) URL as
 * written, or a path that stays on the page's own origin; `undefined` for
 * anything else. Read as the browser will: it drops tabs and line breaks from
 * a URL, so `/\t/evil.example` is the protocol-relative `//evil.example`.
 */
export function inPlaceHref(raw: string | undefined, origin: string): string | undefined {
  const href = raw?.replace(/[\t\n\r]/g, '').trim();
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  if (!href.startsWith('/')) return undefined;
  try {
    return new URL(href, origin).origin === new URL(origin).origin ? href : undefined;
  } catch {
    return undefined;
  }
}
