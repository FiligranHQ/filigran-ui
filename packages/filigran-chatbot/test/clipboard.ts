/** The clipboard paste cases (`clipboard-paste-cases.json`) and the clipboard of each. */
import { readFileSync } from 'node:fs';

import type { ClipboardPayload } from '../src/utils/clipboard.ts';

export interface PasteCase {
  name: string;
  data: Record<string, string>;
  files: { name: string; type: string }[];
  attached: string[];
}

export const PASTE_CASES: PasteCase[] = JSON.parse(readFileSync(new URL('./clipboard-paste-cases.json', import.meta.url), 'utf8')).cases;

/** The clipboard of *c*, as a paste event's `clipboardData` exposes it. */
export function clipboardOf(c: PasteCase): ClipboardPayload & { files: File[]; types: string[] } {
  const files = c.files.map((f) => new File(['x'], f.name, { type: f.type }));
  return {
    items: [
      ...Object.keys(c.data).map((type) => ({ kind: 'string', type, getAsFile: () => null })),
      ...files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
    ],
    files,
    types: [...Object.keys(c.data), ...(files.length > 0 ? ['Files'] : [])],
    getData: (format) => c.data[format] ?? '',
  };
}
