/** One clipboard entry, as a `DataTransferItem` exposes it. */
export interface ClipboardEntry {
  kind: string;
  type: string;
  getAsFile(): File | null;
}

/** What a paste hands over, as the `DataTransfer` of a `paste` event exposes it. */
export interface ClipboardPayload {
  items: ArrayLike<ClipboardEntry>;
  getData(format: string): string;
}

function readClipboardText(data: ClipboardPayload, format: string): string {
  try {
    return data.getData(format) ?? '';
  } catch {
    return '';
  }
}

/** Whether an HTML fragment shows any text: not only markup, styles, comments or an `<img>`. */
function htmlCarriesText(html: string): boolean {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(head|style|script|title|template|xml)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|#160|#xa0);/gi, ' ');
  return /\S/.test(text);
}

/**
 * The files a paste attaches: any file, as drag and drop and the attach button
 * take any file, except the picture an app adds as a rendering of the text it
 * copied.
 *
 * Office suites and spreadsheets copy a selection as its text, its HTML and an
 * image of it, which the browser hands over as a file. That paste is the text:
 * attaching the image would put a picture of the selection in the message and,
 * as attaching cancels the paste, drop the text. So images that come with plain
 * text and an HTML fragment showing text are not attached. A browser's "Copy
 * image" (its HTML is the `<img>` alone, maybe with the image address as text)
 * and a file manager's copy (the file, with its name or path as text, no HTML)
 * still attach.
 *
 * Empty when the paste attaches nothing: it then reaches the text box untouched.
 */
export function clipboardFiles(data: ClipboardPayload | null | undefined): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  if (files.length === 0) return files;
  const renderingOfText =
    files.every((file) => file.type.startsWith('image/')) &&
    /\S/.test(readClipboardText(data, 'text/plain')) &&
    htmlCarriesText(readClipboardText(data, 'text/html'));
  return renderingOfText ? [] : files;
}
