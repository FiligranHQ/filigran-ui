export function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * Markdown has no native support for nesting fenced code blocks of the same
 * length: per the CommonMark spec, the first inner ``` closes the outer block,
 * so everything after it renders *outside* the code block. LLMs constantly hit
 * this — when an agent shows a prompt or a full markdown document inside a
 * ```markdown … ``` fence, that document's own ``` fences shatter the snippet
 * into alternating code / prose fragments.
 *
 * The robust, spec-compliant fix is to make the *outer* fence longer than any
 * fence it contains: a 4-backtick fence is only closed by a run of ≥4
 * backticks, so all inner 3-backtick fences become literal content and the
 * whole document renders as one clean, copyable code block.
 *
 * We act only on the unambiguous, dominant case — a 3-backtick opener whose
 * info string is a markup language (markdown / md / mdx / markup) that actually
 * contains nested fences — so already-correct markdown is never rewritten
 * (a correctly authored nested block already uses a 4+-backtick opener, which
 * we skip).
 */
export function hardenNestedCodeFences(raw: string): string {
  if (!raw) return raw;
  const lines = raw.split('\n');
  const fenceRe = /^(\s*)(`{3,})(.*)$/;
  const markupLang = /^(markdown|md|mdx|markup)\b/i;

  let openerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(fenceRe);
    if (m && m[2].length === 3 && markupLang.test(m[3].trim())) {
      openerIdx = i;
      break;
    }
  }
  if (openerIdx === -1) return raw;

  let maxRun = 3;
  let nestedCount = 0;
  let lastBareFence = -1;
  for (let i = openerIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(fenceRe);
    if (!m) continue;
    nestedCount++;
    maxRun = Math.max(maxRun, m[2].length);
    if (m[3].trim() === '') lastBareFence = i;
  }
  if (nestedCount === 0) return raw;

  const fence = '`'.repeat(Math.max(maxRun + 1, 4));
  const om = lines[openerIdx].match(fenceRe)!;
  lines[openerIdx] = `${om[1]}${fence}${om[3]}`;
  if (lastBareFence > openerIdx) {
    const cm = lines[lastBareFence].match(fenceRe)!;
    lines[lastBareFence] = `${cm[1]}${fence}`;
  }
  return lines.join('\n');
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
 * streamed token never flickers as raw `[[FILE:...` text.
 *
 * When no marker is present the content is returned **untouched** — we must
 * not trim or collapse blank lines on ordinary prose, which would clobber
 * intentional leading/trailing whitespace (e.g. indented Markdown / code).
 * Whitespace is only normalized when a marker was actually removed.
 *
 * Applied to assistant content only — user-typed text is never touched, so a
 * user who literally types `[[FILE:x]]` still sees their own text.
 */
export function stripFileMarkers(content: string): string {
  if (!content) return content;
  const stripped = content.replace(FILE_MARKER_RE, '').replace(PARTIAL_FILE_MARKER_RE, '');
  if (stripped === content) return content;
  return stripped
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** An ordered piece of assistant content: prose text or a file marker. */
export type FileMarkerPart = { type: 'text'; value: string } | { type: 'file'; fileId: string };

/**
 * Split assistant content into ordered text/file parts around complete
 * `[[FILE:<id>]]` markers, so the renderer can place each download card at the
 * marker's source position (preserving interleaved order). A trailing
 * incomplete marker (an SSE token split mid-stream) is removed from the final
 * text part so it never shows as raw `[[FILE:...` text.
 */
export function splitFileMarkers(content: string): FileMarkerPart[] {
  if (!content) return [];
  const parts: FileMarkerPart[] = [];
  const re = /\[\[FILE:([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = re.exec(content);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'file', fileId: match[1] });
    lastIndex = re.lastIndex;
    match = re.exec(content);
  }
  const tail = content.slice(lastIndex).replace(PARTIAL_FILE_MARKER_RE, '');
  if (tail) parts.push({ type: 'text', value: tail });
  return parts;
}
