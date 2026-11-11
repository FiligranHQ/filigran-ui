/**
 * What a copy out of the transcript puts on the clipboard, and what a paste
 * into the composer inserts. A selection that ends a message (a triple-click
 * on its last paragraph) runs into the blocks after it: the browser writes
 * each block boundary it crosses as a line break, so the text copied ended
 * with five or six empty lines (Sam, 10 Nov 2026). Copy and paste behave as in
 * the reference assistants: exactly the text selected, never a phantom line.
 */

/** Chat chrome a copy leaves out of the HTML: controls, times, labels read by a screen reader only. */
const COPY_EXCLUDED = 'button, time, .sr-only, .select-none, [aria-hidden="true"]';

/** A line holding only spaces, tabs or no-break spaces. */
const BLANK_LINE = /^[ \t\u00a0]*$/;

/** *text* with `\n` line breaks and without the blank lines that open or close it. Spaces inside a line are kept. */
export function trimBlankLines(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^(?:[ \t\u00a0]*\n)+/, '')
    .replace(/(?:\n[ \t\u00a0]*)+$/, '');
}

/**
 * The plain text of a transcript selection: no blank line before its first or
 * after its last line shown, and no run of empty lines longer than one (each
 * nested block boundary adds one). A code block's indentation is kept.
 */
export function cleanCopiedText(text: string): string {
  const kept: string[] = [];
  for (const line of trimBlankLines(text).split('\n')) {
    const blank = BLANK_LINE.test(line);
    if (blank && kept[kept.length - 1] === '') continue;
    kept.push(blank ? '' : line);
  }
  return kept.join('\n');
}

/**
 * The text a paste into the composer inserts when the clipboard's own needs
 * fixing: the line breaks that open or close it removed. Only the inserted
 * text changes, never what the user typed. `null` when nothing needs fixing.
 */
export function pastedText(clipboard: string): string | null {
  if (!clipboard) return null;
  const trimmed = trimBlankLines(clipboard);
  return trimmed === clipboard ? null : trimmed;
}

/** *value* with *inserted* in place of the characters from *start* to *end*, and where the caret goes. */
export function spliceText(value: string, start: number, end: number, inserted: string): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  return { value: value.slice(0, from) + inserted + value.slice(to), caret: from + inserted.length };
}

/** The HTML of a selection's fragment, the chat chrome removed. */
export function copiedHtml(fragment: DocumentFragment): string {
  fragment.querySelectorAll(COPY_EXCLUDED).forEach((node) => node.remove());
  const holder = (fragment.ownerDocument ?? document).createElement('div');
  holder.appendChild(fragment);
  return holder.innerHTML;
}

/** The parts of a `copy` event the transcript handler reads (a React or a DOM event). */
export interface CopyEventLike {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  clipboardData: DataTransfer | null;
  preventDefault(): void;
}

/**
 * The transcript's `copy` handler: writes exactly the text selected, without
 * the blank lines of the blocks the selection ends on, and its HTML without
 * the chat chrome. Nothing selected, a selection in a field (the feedback
 * comment), or a selection of chrome alone: the browser copies as usual.
 * Whether it wrote the clipboard.
 */
export function copyTranscriptSelection(e: CopyEventLike): boolean {
  const target = e.target as Element | null;
  if (target?.closest?.('input, textarea, [contenteditable="true"]')) return false;
  const doc = (e.currentTarget as Node | null)?.ownerDocument;
  const selection = doc?.getSelection();
  if (!doc || !selection || selection.isCollapsed || selection.rangeCount === 0 || !e.clipboardData) return false;
  const text = cleanCopiedText(selection.toString());
  if (!text) return false;
  const fragment = doc.createDocumentFragment();
  for (let i = 0; i < selection.rangeCount; i += 1) fragment.appendChild(selection.getRangeAt(i).cloneContents());
  e.preventDefault();
  e.clipboardData.setData('text/plain', text);
  e.clipboardData.setData('text/html', copiedHtml(fragment));
  return true;
}
