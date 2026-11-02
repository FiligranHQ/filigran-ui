/** What a paste hands over, as the `DataTransfer` of a `paste` event exposes it. */
export interface ClipboardPayload {
  files: ArrayLike<File>;
  getData(format: string): string;
}

function readClipboardText(data: ClipboardPayload, format: string): string {
  try {
    return data.getData(format) ?? '';
  } catch {
    return '';
  }
}

/** Elements whose content shows no text. */
const HIDDEN_BLOCK = /<(head|style|script|title|template|xml)\b/iy;
const SPACE_ENTITY = /&(?:nbsp|#160|#xa0);/iy;
const SPACE = /\s/;

/**
 * Where the tag opening at *start* ends, past its `>`; -1 when it never closes.
 * A quoted attribute may hold a `>` (`alt="Revenue > costs"`).
 */
function tagEnd(html: string, start: number): number {
  for (let i = start + 1; i < html.length; i += 1) {
    const c = html[i];
    if (c === '>') return i + 1;
    if (c === '"' || c === "'") {
      const close = html.indexOf(c, i + 1);
      if (close < 0) return -1;
      i = close;
    }
  }
  return -1;
}

/**
 * Whether an HTML fragment shows any text: not only markup, styles, comments
 * or an `<img>`. One pass that stops at the first character shown, as a paste
 * can carry megabytes of HTML.
 */
function htmlCarriesText(html: string): boolean {
  const unclosed = new Set<string>();
  let i = 0;
  while (i < html.length) {
    const c = html[i];
    if (c === '<') {
      if (html.startsWith('<!--', i)) {
        const close = html.indexOf('-->', i + 4);
        if (close >= 0) {
          i = close + 3;
          continue;
        }
      }
      HIDDEN_BLOCK.lastIndex = i;
      const name = HIDDEN_BLOCK.exec(html)?.[1].toLowerCase();
      if (name && !unclosed.has(name)) {
        const close = new RegExp(`</${name}\\s*>`, 'gi');
        close.lastIndex = i;
        if (close.exec(html)) {
          i = close.lastIndex;
          continue;
        }
        // Not searched again: the fragment holds no closing tag after this one.
        unclosed.add(name);
      }
      const end = tagEnd(html, i);
      // A `<` that opens no tag is text.
      if (end < 0) return true;
      i = end;
      continue;
    }
    if (c === '&') {
      SPACE_ENTITY.lastIndex = i;
      if (SPACE_ENTITY.test(html)) {
        i = SPACE_ENTITY.lastIndex;
        continue;
      }
    }
    if (!SPACE.test(c)) return true;
    i += 1;
  }
  return false;
}

/**
 * The files a paste attaches. Office suites copy a selection as its text, its
 * HTML and a picture of it: images that come with plain text and HTML showing
 * text are that picture, not attached, so the text is pasted instead.
 */
export function clipboardFiles(data: ClipboardPayload | null | undefined): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []);
  if (files.length === 0) return files;
  const renderingOfText =
    files.every((file) => file.type.startsWith('image/')) &&
    /\S/.test(readClipboardText(data, 'text/plain')) &&
    htmlCarriesText(readClipboardText(data, 'text/html'));
  return renderingOfText ? [] : files;
}
