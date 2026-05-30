export function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

export const identity = (key: string) => key;

/** Matches a complete `[[FILE:<id>]]` deliverable marker agents embed in prose. */
const FILE_MARKER_RE = /\[\[FILE:[^\]]+\]\]/g;

/**
 * Matches an INCOMPLETE marker at the very end of the string. SSE streams can
 * split a `[[FILE:<id>]]` token before the closing `]]` arrives, so the tail
 * may be `[[FILE`, `[[FILE:`, `[[FILE:abc`, or `[[FILE:abc]` mid-stream. We
 * anchor on the literal `[[FILE` prefix (which is vanishingly unlikely to
 * appear legitimately at the end of prose) so it never clips real content.
 */
const PARTIAL_FILE_MARKER_RE = /\[\[FILE(?::[^\]]*)?\]?$/;

/**
 * Strip the `[[FILE:<id>]]` markers an agent embeds in its reply to point at
 * generated files. The actual files render as separate download chips, so the
 * raw markers must be removed from the prose. Complete markers are removed
 * anywhere; an incomplete marker at the end is also removed so a partially
 * streamed token never flickers as raw `[[FILE:...` text. Whitespace/blank
 * lines left behind by the removal are collapsed.
 *
 * Applied to assistant content only — user-typed text is never touched, so a
 * user who literally types `[[FILE:x]]` still sees their own text.
 */
export function stripFileMarkers(content: string): string {
  if (!content) return content;
  return content
    .replace(FILE_MARKER_RE, '')
    .replace(PARTIAL_FILE_MARKER_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
