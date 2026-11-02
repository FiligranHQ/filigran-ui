/** Input types that take dropped text. */
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', 'password']);

/** The parts of a drop target that say whether it takes dropped text. */
interface DropTargetLike {
  tagName?: string;
  type?: string;
  readOnly?: boolean;
  disabled?: boolean;
  isContentEditable?: boolean;
}

/**
 * Whether a drag carrying *types* lands on *target* as text: a picture or link
 * dragged from a page also carries `Files`, and a text field takes its address.
 */
export function dropsAsText(types: ArrayLike<string>, target: EventTarget | null): boolean {
  const list = Array.from(types);
  if (!list.includes('text/uri-list') && !list.includes('text/plain')) return false;
  const el = target as DropTargetLike | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  // A read-only or disabled field inserts nothing: the browser would open the drop.
  if (el.readOnly || el.disabled) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((el.type ?? 'text').toLowerCase());
}
