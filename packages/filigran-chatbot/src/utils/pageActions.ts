/**
 * Performing one `act_on_page` action on the host page (#5559). Navigation goes
 * through the host's router, never a page load, which would end the chat turn —
 * so a link is followed by routing its href, not by clicking it.
 */

export type PageAction =
  | { type: 'snapshot' }
  | { type: 'navigate'; path: string }
  | { type: 'click'; ref: string }
  | { type: 'type'; ref: string; text: string }
  | { type: 'open'; ref: string }
  /** A frame naming an action this version does not know (backend ahead of the panel). */
  | { type: 'unsupported'; requested: string };

/**
 * Whether the panel may declare `supports_page_actions` (#5559). Passing
 * `onRelativeLinkClick` is the host's opt-in: a proxy that relays tool
 * approvals but not page answers would stall every step on its timeout.
 */
export function hostTakesPageActions(approveUrl: string | null, onNavigate?: (path: string) => void): boolean {
  return approveUrl !== null && typeof onNavigate === 'function';
}

/** The document's own address, which every href is resolved against. */
function baseHref(doc?: Document): string | undefined {
  return doc?.defaultView?.location?.href ?? (typeof window === 'undefined' ? undefined : window.location.href);
}

/**
 * The host-internal form of *href*, or null when it leads anywhere else.
 * Resolved and origin-compared even when it looks relative: `/\evil.com` and
 * ` //evil.com` do not, and resolve to another origin.
 */
export const toInternalHref = (href?: string, base?: string): string | null => {
  const from = base ?? baseHref();
  if (!href || !from) return null;
  try {
    const url = new URL(href, from);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.origin !== new URL(from).origin) return null;
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return null;
  }
};

/**
 * Whether *href* is *written* as a relative reference. Not a safety boundary -
 * `toInternalHref` is - but the shape a link was authored in: a same-origin
 * absolute link still opens in a new tab when the host routes nothing.
 */
export const isRelativeHref = (href?: string): boolean => {
  if (!href) return false;
  if (href.startsWith('//')) return false;
  return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href);
};

export interface PageActionResult {
  ok: boolean;
  error?: string;
}

/** The panel's own subtree, whose mutations must never count as the page reacting. */
const PANEL_SELECTOR = '.filigran-chatbot';

function insidePanel(node: Node | null): boolean {
  // Duck-typed: `instanceof Element` throws where there is no such global, and
  // the observer swallows the throw, losing the mutation.
  const el = (node && 'closest' in node ? node : node?.parentElement) as Element | null | undefined;
  return !!el?.closest?.(PANEL_SELECTOR);
}

/**
 * Fields `type` may write to. A `<select>`, link or button would otherwise fall
 * through to `textContent` and lose its options or its children. Password is
 * left out on purpose: the panel neither reads nor fills credentials.
 */
const TYPEABLE =
  'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"]';

function isTypeable(el: Element): boolean {
  return el.matches?.(TYPEABLE) ?? false;
}

/** Set *text* the way a user's typing does, so a React-controlled field sees it. */
function setValue(el: Element, text: string): void {
  const view = el.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  if (view && (el instanceof view.HTMLInputElement || el instanceof view.HTMLTextAreaElement)) {
    // React tracks the value it last rendered on the element itself; only the
    // prototype's setter goes around that tracker, so the input event below
    // reaches the component as a change.
    const proto = el instanceof view.HTMLInputElement ? view.HTMLInputElement.prototype : view.HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, text);
  } else {
    el.textContent = text;
  }
  el.dispatchEvent(new (view?.Event ?? Event)('input', { bubbles: true }));
  el.dispatchEvent(new (view?.Event ?? Event)('change', { bubbles: true }));
}

/** Hover *el* the way a pointer does: what opens a menu on hover opens. */
function hover(el: Element): void {
  const view = el.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const init = { bubbles: true, cancelable: true, view: view ?? undefined, pointerType: 'mouse' };
  const Pointer = view?.PointerEvent ?? view?.MouseEvent ?? MouseEvent;
  const Mouse = view?.MouseEvent ?? MouseEvent;
  el.dispatchEvent(new Pointer('pointerover', init));
  el.dispatchEvent(new Pointer('pointerenter', { ...init, bubbles: false }));
  el.dispatchEvent(new Mouse('mouseover', init));
  el.dispatchEvent(new Mouse('mouseenter', { ...init, bubbles: false }));
}

/**
 * Whether *act* adds anything to the page within *ms*: a menu that opened.
 * The panel's own re-render (the "Acting on the page…" status) lands inside the
 * same window, so its subtree is ignored or every hover would look successful.
 */
function addsContent(doc: Document, act: () => void, ms = 300): Promise<boolean> {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  const Observer = view?.MutationObserver ?? globalThis.MutationObserver;
  if (!Observer) {
    act();
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const observer = new Observer((records) => {
      const added = records.some(
        (r) => r.addedNodes.length > 0 && !insidePanel(r.target) && Array.from(r.addedNodes).some((n) => !insidePanel(n)),
      );
      if (!added) return;
      observer.disconnect();
      clearTimeout(timer);
      resolve(true);
    });
    observer.observe(doc.body ?? doc.documentElement, { subtree: true, childList: true });
    act();
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, ms);
  });
}

/**
 * Click *el*, except where clicking would leave the page and end the turn: an
 * anchor is routed through the host instead. Only *el* itself, never an
 * ancestor — a `role="button"` inside a link row has its own handler, and
 * routing the row's href would skip it.
 */
function clickOrRoute(el: Element, onNavigate?: (path: string) => void, base?: string): PageActionResult {
  // A fragment is an in-page trigger (`<a href="#">` carrying a handler), not
  // a destination, so it is clicked like anything else.
  const href = el.matches?.('a[href]') ? el.getAttribute('href') ?? '' : '';
  if (href && !href.startsWith('#')) {
    const internal = toInternalHref(href, base);
    if (!internal) return { ok: false, error: 'external_link' };
    const target = el.getAttribute('target');
    if (target && target !== '_self') return { ok: false, error: 'opens_new_tab' };
    if (onNavigate) {
      onNavigate(internal);
      return { ok: true };
    }
  }
  (el as HTMLElement).click();
  return { ok: true };
}

/**
 * Open the menu *el* triggers: on hover where it opens on hover (OpenCTI's
 * navigation), else on click, when hovering added nothing and left it closed.
 */
async function openMenu(el: Element, onNavigate?: (path: string) => void, base?: string, signal?: AbortSignal): Promise<PageActionResult> {
  const opened = await addsContent(el.ownerDocument, () => hover(el));
  if (opened || el.getAttribute('aria-expanded') === 'true') return { ok: true };
  // The turn may have been stopped during the hover wait; the click below would
  // land on the user's page after they asked for it to end.
  if (signal?.aborted) return { ok: false, error: 'aborted' };
  // Through the same guard as a click: a menu trigger is often an anchor, and
  // clicking it raw would load a page and end the turn.
  return clickOrRoute(el, onNavigate, base);
}

/** Everything in a form a user fills in; Enter is only safe when there is one. */
const SUBMITTABLE =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea, [contenteditable="true"]';

/**
 * Whether Enter in *el* asks for what was typed - a search, or a form of that
 * one field - rather than sending a form of several fields, which only its own
 * button does: typing an agent's name must not create the agent. Counting only
 * text inputs would read a username + password form as a single field.
 */
function entersSearch(el: Element): boolean {
  if (el.getAttribute('role') === 'searchbox' || (el as HTMLInputElement).type === 'search' || el.closest('[role="search"]')) return true;
  const form = (el as HTMLInputElement).form;
  return !!form && form.querySelectorAll(SUBMITTABLE).length === 1;
}

function pressEnter(el: Element): void {
  const view = el.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const Keyboard = view?.KeyboardEvent ?? KeyboardEvent;
  const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  const down = new Keyboard('keydown', init);
  el.dispatchEvent(down);
  el.dispatchEvent(new Keyboard('keyup', init));
  // A synthetic key event never triggers the browser's implicit submission, so
  // a form the field belongs to is submitted unless a handler took the key.
  const form = (el as HTMLInputElement).form;
  if (form && !down.defaultPrevented) form.requestSubmit?.();
}

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
}

export async function performPageAction(
  action: PageAction,
  refs: Map<string, Element>,
  onNavigate?: (path: string) => void,
  doc?: Document,
  signal?: AbortSignal,
): Promise<PageActionResult> {
  try {
    if (signal?.aborted) return { ok: false, error: 'aborted' };
    if (action.type === 'snapshot') return { ok: true };
    if (action.type === 'unsupported') return { ok: false, error: `unsupported_action: ${action.requested}`.slice(0, 500) };
    if (action.type === 'navigate') {
      if (!onNavigate) return { ok: false, error: 'navigation_unavailable' };
      const path = toInternalHref(action.path, baseHref(doc));
      if (!path) return { ok: false, error: 'external_path' };
      onNavigate(path);
      return { ok: true };
    }
    const el = refs.get(action.ref);
    if (!el || !el.isConnected) return { ok: false, error: 'unknown_ref' };
    if (isDisabled(el)) return { ok: false, error: 'disabled' };
    if (action.type === 'open') return openMenu(el, onNavigate, baseHref(doc ?? el.ownerDocument), signal);
    if (action.type === 'click') return clickOrRoute(el, onNavigate, baseHref(doc ?? el.ownerDocument));
    if (!isTypeable(el)) return { ok: false, error: 'not_a_text_field' };
    (el as HTMLElement).focus?.();
    setValue(el, action.text);
    if (entersSearch(el)) pressEnter(el);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) };
  }
}

/**
 * Resolve once the page has not changed for *quietMs*, or after *maxMs* at most.
 * The panel's own subtree is ignored: its status re-renders would otherwise keep
 * resetting the quiet timer until the cap.
 */
export function waitForDomSettle(
  doc: Document,
  { quietMs = 300, maxMs = 3000, signal }: { quietMs?: number; maxMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise((resolve) => {
    // Before anything is set up: a stopped turn has nothing to wait for.
    if (signal?.aborted) return resolve();
    const view = doc.defaultView as (Window & typeof globalThis) | null;
    const Observer = view?.MutationObserver ?? globalThis.MutationObserver;
    let quiet: ReturnType<typeof setTimeout>;
    const done = () => {
      clearTimeout(quiet);
      clearTimeout(cap);
      observer?.disconnect();
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const observer = Observer
      ? new Observer((records) => {
          if (!records.some((r) => !insidePanel(r.target))) return;
          clearTimeout(quiet);
          quiet = setTimeout(done, quietMs);
        })
      : null;
    observer?.observe(doc.body ?? doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    quiet = setTimeout(done, quietMs);
    const cap = setTimeout(done, maxMs);
    signal?.addEventListener('abort', done);
  });
}
