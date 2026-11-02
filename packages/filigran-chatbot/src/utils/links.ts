/**
 * An address a host gives the panel to open in place: an http(s) URL as
 * written, or a path that stays on the page *pageHref* (an opaque origin such
 * as `file://` or a srcdoc frame included); `undefined` for anything else.
 * Read as the browser will: it drops tabs and line breaks from a URL, so
 * `/\t/evil.example` is the protocol-relative `//evil.example`.
 */
export function inPlaceHref(raw: string | undefined, pageHref: string): string | undefined {
  const href = raw?.replace(/[\t\n\r]/g, '').trim();
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  if (!href.startsWith('/')) return undefined;
  try {
    const page = new URL(pageHref);
    // An opaque origin ("null", e.g. file://) equals every other one: the
    // origins say nothing there, and the path rule below decides.
    if (page.origin !== 'null') return new URL(href, page).origin === page.origin ? href : undefined;
  } catch {
    // A page with no address to resolve against (a srcdoc frame).
  }
  // A path stays on the page unless the browser reads it as another host.
  return /^\/(?![/\\])/.test(href) ? href : undefined;
}
