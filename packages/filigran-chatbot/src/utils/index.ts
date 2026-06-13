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

/**
 * GFM renders a pipe table only when the delimiter row (`|---|---|`) has the
 * SAME number of columns as the header row. LLMs frequently miscount (e.g. a
 * 4-column header followed by a 3-column delimiter), and a server-side guard can
 * corrupt the delimiter — in either case the whole table silently degrades to
 * raw `| … |` text. This repairs a mismatched delimiter row to the header's
 * column count (preserving any alignment colons) so the table renders.
 *
 * It only rewrites a delimiter that is ACTUALLY mismatched, so already-valid
 * tables are never touched. Fenced code blocks are skipped, and setext headings
 * (underlines with no `|`) are never mistaken for a table.
 */
export function normalizeMarkdownTables(raw: string): string {
  if (!raw || raw.indexOf('|') === -1) return raw;
  const lines = raw.split('\n');

  const splitCells = (row: string): string[] => {
    let s = row.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/);
  };
  const isDelimiterRow = (row: string): boolean => row.includes('|') && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(row);
  const alignOf = (cell: string): string => {
    const c = cell.trim();
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    return left && right ? ':-:' : right ? '--:' : left ? ':--' : '---';
  };

  let fence: string | null = null;
  for (let i = 0; i < lines.length - 1; i++) {
    const fenceMatch = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const header = lines[i];
    const delim = lines[i + 1];
    if (!header.includes('|') || isDelimiterRow(header) || !isDelimiterRow(delim)) continue;

    const headerCols = splitCells(header).length;
    const delimCells = splitCells(delim);
    if (headerCols < 2 || delimCells.length === headerCols) continue;

    const aligns: string[] = [];
    for (let c = 0; c < headerCols; c++) aligns.push(delimCells[c] ? alignOf(delimCells[c]) : '---');
    lines[i + 1] = `| ${aligns.join(' | ')} |`;
  }
  return lines.join('\n');
}

export const identity = (key: string) => key;

/**
 * Nearest chatbot panel root (`.filigran-chatbot`) for portal-based overlays
 * (tooltips, dropdowns, dialogs), so they stay inside the panel's stacking
 * context instead of competing with the host app's z-indexes. Falls back to
 * `document.body` when rendered outside a panel.
 */
export function findChatbotRoot(el: HTMLElement | null): HTMLElement {
  let node = el;
  while (node) {
    if (node.classList.contains('filigran-chatbot')) return node;
    node = node.parentElement;
  }
  return document.body;
}

/**
 * Compact relative-time label for the conversation history menu
 * ("just now", "5m ago", "3h ago", "2d ago", then a short date).
 * Returns an empty string for missing/unparseable timestamps so the row
 * simply omits the label instead of showing "Invalid Date".
 */
export function timeAgo(iso: string | undefined, t: (key: string) => string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('just now');
  if (minutes < 60) return `${minutes}${t('m ago')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t('h ago')}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${t('d ago')}`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
