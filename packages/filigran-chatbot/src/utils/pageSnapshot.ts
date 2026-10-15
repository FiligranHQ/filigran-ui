/**
 * The host page as `act_on_page` reads it (#5559): one line per element a user
 * could act on, keyed by a reference the next action names it by. The panel
 * itself is never part of it. The line format is in the README, under "Acting
 * on the host page".
 */

export const MAX_SNAPSHOT_CHARS = 20_000;
const MAX_NAME_CHARS = 80;
const MAX_URL_CHARS = 500;
const TRUNCATION_MARKER = '[truncated]';

export interface PageSnapshot {
  text: string;
  url: string;
  title: string;
  /** Reference → element, valid until the next snapshot. */
  refs: Map<string, Element>;
}

const EXPLICIT_ROLES = new Set([
  'button',
  'link',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'checkbox',
  'radio',
  'switch',
  'textbox',
  'searchbox',
  'combobox',
  'treeitem',
]);

/** Anything that could carry an actionable role, for the descent test below. */
const MAYBE_ACTIONABLE = 'a[href], button, summary, select, textarea, input, [contenteditable="true"], [role]';

/**
 * Whether an actionable element wraps further controls - a link row holding an
 * Edit button, a `div[role="combobox"]` holding the real input, a `treeitem`
 * holding its children. Those must get references of their own; a plain link
 * or button is named by its contents instead, and a native `<select>`'s
 * options are not controls.
 */
function wrapsControls(el: Element): boolean {
  if (el.tagName.toLowerCase() === 'select') return false;
  for (const child of Array.from(el.querySelectorAll(MAYBE_ACTIONABLE))) {
    if (actionableRole(child)) return true;
  }
  return false;
}

/** The role an element is acted on as, or `null` when it is not actionable. */
function actionableRole(el: Element): string | null {
  const explicit = el.getAttribute('role');
  if (explicit && EXPLICIT_ROLES.has(explicit)) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' && el.hasAttribute('href')) return 'link';
  if (tag === 'button' || tag === 'summary') return 'button';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'hidden') return null;
    if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
    if (type === 'checkbox' || type === 'radio') return type;
    if (type === 'search') return 'searchbox';
    return 'textbox';
  }
  if (el.getAttribute('contenteditable') === 'true') return 'textbox';
  return null;
}

function headingLevel(el: Element): number | null {
  const m = /^h([1-6])$/i.exec(el.tagName);
  return m ? Number(m[1]) : null;
}

/**
 * The element's text with a space wherever a non-inline element starts or
 * ends. `textContent` glues a table row's cells together ("AdministratorZone de
 * danger1"), and a name whose first cell is not a word cannot be matched.
 */
function spacedText(el: Element): string {
  const view = el.ownerDocument.defaultView;
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      out += node.textContent ?? '';
    } else if (node.nodeType === 1) {
      // The walk skips hidden subtrees; without the same test here they would
      // come back as part of a visible ancestor's name.
      if (hidden(node as Element)) continue;
      const display = view?.getComputedStyle(node as Element).display ?? '';
      // An unknown display (no layout engine) is read as inline: never split a word.
      const inline = display === '' || display === 'inline' || display === 'contents';
      out += inline ? spacedText(node as Element) : ` ${spacedText(node as Element)} `;
    }
  }
  return out;
}

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** The name a user reads for *el*, in the accessible-name order. */
function accessibleName(el: Element): string {
  const doc = el.ownerDocument;
  const fromAttr = clean(el.getAttribute('aria-label'));
  if (fromAttr) return fromAttr;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    // Read even when hidden: a visually-hidden span is how an icon button
    // usually gets its name, and skipping it would leave `button ""`.
    const text = clean(
      labelledBy
        .split(/\s+/)
        .map((id) => doc.getElementById(id)?.textContent ?? '')
        .join(' '),
    );
    if (text) return text;
  }
  const id = el.getAttribute('id');
  const label = (id && Array.from(doc.getElementsByTagName('label')).find((l) => l.htmlFor === id)) || el.closest('label');
  if (label) {
    // The label's own words, not the options of a select it wraps.
    const own = clean(
      Array.from(label.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(' '),
    );
    if (own || clean(label.textContent)) return own || clean(label.textContent);
  }
  const alt = clean(el.getAttribute('alt')) || clean(el.querySelector('img[alt]')?.getAttribute('alt'));
  if (alt) return alt;
  const placeholder = clean(el.getAttribute('placeholder'));
  if (placeholder) return placeholder;
  const title = clean(el.getAttribute('title'));
  if (title) return title;
  // Falling back to the contents would hand over what `value()` just masked:
  // an unlabelled one-time code would arrive as the element's name.
  if (isSecret(el)) return '';
  return clean(spacedText(el));
}

function quote(text: string): string {
  // JSON quoting, so a newline in a textarea value cannot split one control
  // across lines or make its text read as another `[e2] button "…"` row.
  return JSON.stringify(text.slice(0, MAX_NAME_CHARS));
}

function states(el: Element): string[] {
  const out: string[] = [];
  // `:disabled` also covers a control disabled by its `<fieldset>`, which has
  // no attribute of its own; the snapshot would otherwise call it enabled.
  const fieldset = el.closest?.('fieldset[disabled]');
  const byFieldset = !!fieldset && !fieldset.querySelector('legend')?.contains(el);
  if (el.hasAttribute('disabled') || byFieldset || el.getAttribute('aria-disabled') === 'true') out.push('disabled');
  if (el.getAttribute('aria-selected') === 'true') out.push('selected');
  if ((el as HTMLInputElement).checked || el.getAttribute('aria-checked') === 'true') out.push('checked');
  if (el.getAttribute('aria-expanded') === 'true') out.push('expanded');
  // A menu that opens on hover or click and is closed now: its items are not
  // in the page until it opens (`open` action), so the snapshot says it is there.
  else if ((el.getAttribute('aria-haspopup') ?? 'false') !== 'false') out.push('menu');
  // A closed disclosure (a collapsed navigation group): what it holds appears
  // once it is clicked, which its name alone does not say.
  else if (el.getAttribute('aria-expanded') === 'false') out.push('collapsed');
  if (el.getAttribute('aria-pressed') === 'true') out.push('pressed');
  const current = el.getAttribute('aria-current');
  if (current && current !== 'false') out.push('current');
  return out;
}

/**
 * Secret fields, by autocomplete: `type=password` alone misses a revealed
 * password, card fields and one-time codes.
 */
const SECRET_AUTOCOMPLETE = /^(current-password|new-password|one-time-code|cc-)/;

function isSecret(el: Element): boolean {
  if ((el.getAttribute('type') || '').toLowerCase() === 'password') return true;
  // The attribute may carry section/billing tokens before the field name.
  return (el.getAttribute('autocomplete') || '')
    .toLowerCase()
    .split(/\s+/)
    .some((token) => SECRET_AUTOCOMPLETE.test(token));
}

function value(el: Element, role: string): string | null {
  if (!['textbox', 'searchbox', 'combobox'].includes(role)) return null;
  if (isSecret(el)) return null;
  // `spacedText`, not `textContent`: a contenteditable's hidden descendants
  // are excluded from the walk and its name, and must not return as its value.
  const v = 'value' in el ? String((el as HTMLInputElement).value ?? '') : clean(spacedText(el));
  return v ? v : null;
}

/**
 * Where an element with an address within the host goes (` -> /path?query`), so a link named for a
 * section ("Analyses") still says it leads to the page asked for. Nothing for a
 * link to another site: its address would only be text the host never shows.
 */
function destination(el: Element): string {
  const href = el.getAttribute('href');
  const loc = el.ownerDocument.defaultView?.location;
  if (!href || !loc) return '';
  try {
    const url = new URL(href, loc.href);
    return url.origin === loc.origin ? ` -> ${url.pathname}${url.search}` : '';
  } catch {
    return '';
  }
}

function hidden(el: Element): boolean {
  if (el.classList.contains('filigran-chatbot')) return true;
  if ((el as HTMLElement).hidden || el.hasAttribute('inert')) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  return style?.display === 'none' || style?.visibility === 'hidden';
}

export function takePageSnapshot(doc: Document, maxChars = MAX_SNAPSHOT_CHARS): PageSnapshot {
  const loc = doc.defaultView?.location;
  const url = (loc ? `${loc.pathname}${loc.search}` : '').slice(0, MAX_URL_CHARS);
  const title = clean(doc.title).slice(0, MAX_NAME_CHARS);
  // Without a marker the agent reads a list cut off at the cap as the whole
  // page, so its room is taken out of the budget before anything is listed -
  // as is the header's, which a long title and path could otherwise blow on
  // their own.
  const budget = Math.max(0, maxChars - (TRUNCATION_MARKER.length + 1));
  let truncated = false;
  let header = `# ${title} — ${url}`;
  if (header.length > budget) {
    header = header.slice(0, budget);
    truncated = true;
  }
  const lines = [header];
  let size = header.length;
  const refs = new Map<string, Element>();

  const walk = (node: Element): boolean => {
    for (const el of Array.from(node.children)) {
      if (hidden(el)) continue;
      const role = actionableRole(el);
      const level = headingLevel(el);
      let line: string | null = null;
      if (role) {
        const ref = `e${refs.size + 1}`;
        const v = value(el, role);
        const st = states(el);
        line = `[${ref}] ${role} ${quote(accessibleName(el))}${st.length ? ` (${st.join(', ')})` : ''}${v ? ` = ${quote(v)}` : ''}${destination(el)}`;
        if (size + line.length + 1 > budget) {
          truncated = true;
          return false;
        }
        refs.set(ref, el);
      } else if (level) {
        line = `heading ${quote(clean(spacedText(el)))} (level ${level})`;
        if (size + line.length + 1 > budget) {
          truncated = true;
          return false;
        }
      }
      if (line) {
        lines.push(line);
        size += line.length + 1;
      }
      // An actionable element's own content is its name, not more elements -
      // unless it wraps controls of its own, which need their own references.
      if ((!role || wrapsControls(el)) && !walk(el)) return false;
    }
    return true;
  };
  if (doc.body && !truncated) walk(doc.body);
  if (truncated) lines.push(TRUNCATION_MARKER);

  return { text: lines.join('\n'), url, title, refs };
}
