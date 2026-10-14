/**
 * Performing one `act_on_page` action on the host page (#5559). The element is
 * one a snapshot listed (`pageSnapshot.ts`); navigation goes through the host's
 * own router callback, never a page load, which would end the chat turn.
 */

export type PageAction =
  | { type: 'snapshot' }
  | { type: 'navigate'; path: string }
  | { type: 'click'; ref: string }
  | { type: 'type'; ref: string; text: string }
  | { type: 'open'; ref: string };

/**
 * Whether the panel may declare `supports_page_actions` (#5559): the host has
 * an approve path for the answers, and hands the panel its in-app navigation.
 * The second is the host's opt-in. A host whose proxy relays tool approvals
 * but not page answers would otherwise be offered the tool, and every step
 * would wait out its timeout on an answer the proxy refused.
 */
export function hostTakesPageActions(approveUrl: string | null, onNavigate?: (path: string) => void): boolean {
  return approveUrl !== null && typeof onNavigate === 'function';
}

export interface PageActionResult {
  ok: boolean;
  error?: string;
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

/** Whether *act* adds anything to the page within *ms*: a menu that opened. */
function addsContent(doc: Document, act: () => void, ms = 300): Promise<boolean> {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  const Observer = view?.MutationObserver ?? globalThis.MutationObserver;
  if (!Observer) {
    act();
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const observer = new Observer((records) => {
      if (!records.some((r) => r.addedNodes.length > 0)) return;
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
 * Open the menu *el* triggers: on hover where it opens on hover (OpenCTI's
 * navigation), else on click, when hovering added nothing to the page and
 * left the element closed.
 */
async function openMenu(el: Element): Promise<void> {
  const opened = await addsContent(el.ownerDocument, () => hover(el));
  if (!opened && el.getAttribute('aria-expanded') !== 'true') (el as HTMLElement).click();
}

const TEXT_FIELDS = 'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"]';

/**
 * Whether Enter in *el* asks for what was typed - a search, or a form of that
 * one field - rather than sending a form of several fields, which only its
 * own button does: typing an agent's name must not create the agent.
 */
function entersSearch(el: Element): boolean {
  if (el.getAttribute('role') === 'searchbox' || (el as HTMLInputElement).type === 'search' || el.closest('[role="search"]')) return true;
  const form = (el as HTMLInputElement).form;
  return !!form && form.querySelectorAll(TEXT_FIELDS).length === 1;
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

export async function performPageAction(
  action: PageAction,
  refs: Map<string, Element>,
  onNavigate?: (path: string) => void,
): Promise<PageActionResult> {
  try {
    if (action.type === 'snapshot') return { ok: true };
    if (action.type === 'navigate') {
      if (!onNavigate) return { ok: false, error: 'navigation_unavailable' };
      onNavigate(action.path);
      return { ok: true };
    }
    const el = refs.get(action.ref);
    if (!el || !el.isConnected) return { ok: false, error: 'unknown_ref' };
    if (action.type === 'open') {
      await openMenu(el);
      return { ok: true };
    }
    if (action.type === 'click') {
      (el as HTMLElement).click();
      return { ok: true };
    }
    (el as HTMLElement).focus?.();
    setValue(el, action.text);
    if (entersSearch(el)) pressEnter(el);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) };
  }
}

/** Resolve once the page has not changed for *quietMs*, or after *maxMs* at most. */
export function waitForDomSettle(doc: Document, { quietMs = 300, maxMs = 3000 }: { quietMs?: number; maxMs?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    const view = doc.defaultView as (Window & typeof globalThis) | null;
    const Observer = view?.MutationObserver ?? globalThis.MutationObserver;
    let quiet: ReturnType<typeof setTimeout>;
    const done = () => {
      clearTimeout(quiet);
      clearTimeout(cap);
      observer?.disconnect();
      resolve();
    };
    const observer = Observer
      ? new Observer(() => {
          clearTimeout(quiet);
          quiet = setTimeout(done, quietMs);
        })
      : null;
    observer?.observe(doc.body ?? doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    quiet = setTimeout(done, quietMs);
    const cap = setTimeout(done, maxMs);
  });
}
