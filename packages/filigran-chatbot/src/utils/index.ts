export function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

export const identity = (key: string) => key;

/** Matches the `[[FILE:<id>]]` deliverable markers agents embed in prose. */
const FILE_MARKER_RE = /\[\[FILE:[^\]]+\]\]/g;

/**
 * Strip the `[[FILE:<id>]]` markers an agent embeds in its reply to point at
 * generated files. The actual files render as separate download chips, so the
 * raw markers must be removed from the prose. Whitespace/blank lines left
 * behind by the removal are collapsed.
 *
 * Applied to assistant content only — user-typed text is never touched, so a
 * user who literally types `[[FILE:x]]` still sees their own text.
 */
export function stripFileMarkers(content: string): string {
  if (!content) return content;
  return content
    .replace(FILE_MARKER_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
