import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/**
 * The top-level blocks of a streamed markdown answer.
 *
 * The live answer is re-rendered every time the stream delivers text, and
 * parsing it whole costs ~14 ms at 8K characters and ~75 ms at 40K, on the
 * host application's main thread: past a few thousand characters its frames
 * go to re-parsing text that is already on screen. Rendered block by block
 * with a memoized renderer per block, only the blocks that can still change
 * are parsed again.
 *
 * The boundaries come from the parser the panel renders with (remark-parse +
 * remark-gfm; remark-breaks only rewrites line breaks inside a block), so
 * rendering the blocks one after the other produces what one parse of the
 * whole text produces. A block is final once a later top-level block starts
 * after a blank line with a complete first line: a blank line closes a
 * paragraph, and a written line after one cannot rejoin a list, a quote or an
 * indented block, whatever is appended to it. A block that starts without a
 * blank line before it stays open with its predecessor (`#` alone is a heading
 * that interrupts the paragraph above; `#x` is that paragraph's next line).
 * Link reference definitions and footnote definitions resolve across the whole
 * document, from a quote or a list item too, so a text holding one renders as
 * one block. They are read off the tree the split parses anyway rather than
 * matched by a line pattern: a pattern misses a label spanning lines, and
 * keeps whole a text that only looks like a definition (a TypeScript index
 * signature in a code block, a regex's `[^a-z]`).
 *
 * XTM One's web chat splits its streaming answer by the same rules; a fix to
 * one belongs in the other.
 */

const blockParser = unified().use(remarkParse).use(remarkGfm).freeze();

type BlockNode = ReturnType<typeof blockParser.parse>['children'][number];

export interface MarkdownBlocks {
  /** The text the blocks cover; `blocks.join('') === source`. */
  source: string;
  /** What to render: the top-level blocks, or the whole text when it holds a definition. */
  blocks: string[];
  /** Offset of each top-level block in `source`, kept when the text renders whole. */
  starts: number[];
  /** Top-level blocks `[0, settled)` are final while text is appended to `source`. */
  settled: number;
  /** The first top-level block holding a link reference or footnote definition, `-1` for none. */
  firstDefinition: number;
}

/** Whether *node* is or contains a link reference or footnote definition. */
function holdsDefinition(node: BlockNode): boolean {
  switch (node.type) {
    case 'definition':
    case 'footnoteDefinition':
      return true;
    case 'blockquote':
    case 'list':
    case 'listItem':
      return node.children.some(holdsDefinition);
    default:
      return false;
  }
}

function lineStart(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

/**
 * Whether the blocks before the one at *start* are final: it starts after a
 * blank line, and its first line is complete - while that line is still being
 * written it can turn into a continuation of the block above (`1` is a
 * paragraph, `10.` the next item of the ordered list before it).
 */
function settlesBefore(text: string, start: number): boolean {
  if (start < 2 || text.indexOf('\n', start) === -1) return false;
  const previousLine = text.slice(lineStart(text, start - 1), start - 1);
  return previousLine.trim() === '';
}

/**
 * Whether the region ends on an indented line (4 spaces or a tab). micromark
 * keeps an indented code block open across the blank lines after it and parses
 * the next line as if it interrupted it - `2. two` is text there and an ordered
 * list on its own - so the next block is rendered with it.
 */
function endsIndented(text: string, start: number, end: number): boolean {
  const lines = text.slice(start, end).split('\n');
  for (let index = lines.length - 1; index >= 0; index--) {
    if (lines[index].trim()) return /^(?: {4}|\t)/.test(lines[index]);
  }
  return false;
}

function single(text: string): MarkdownBlocks {
  return { source: text, blocks: text ? [text] : [], starts: text ? [0] : [], settled: 0, firstDefinition: -1 };
}

/**
 * Split *text* into top-level markdown blocks.
 *
 * With *previous* - the split of a text that *text* extends - the settled
 * blocks are reused and only the rest is parsed again. Any other *previous* (a
 * retracted answer, a normalizer that rewrote earlier lines) is ignored.
 */
export function splitMarkdownBlocks(text: string, previous?: MarkdownBlocks | null): MarkdownBlocks {
  if (!text.trim()) return single(text);

  const reuse = previous && previous.settled > 0 && text.startsWith(previous.source) ? previous.settled : 0;
  const from = reuse ? previous!.starts[reuse] : 0;
  const tail = text.slice(from);

  const starts = previous && reuse ? previous.starts.slice(0, reuse) : [];
  // A definition in a settled block stays one; none there means the first one,
  // if any, is in the part parsed now.
  let firstDefinition = previous && reuse && previous.firstDefinition < reuse ? previous.firstDefinition : -1;
  starts.push(from);
  for (const node of blockParser.parse(tail).children) {
    const offset = node.position?.start.offset;
    if (offset !== undefined) {
      const start = from + lineStart(tail, offset);
      const last = starts[starts.length - 1];
      if (start > last && !endsIndented(text, last, start)) starts.push(start);
    }
    if (firstDefinition < 0 && holdsDefinition(node)) firstDefinition = starts.length - 1;
  }

  let settled = reuse;
  for (let index = starts.length - 1; index > reuse; index--) {
    if (settlesBefore(text, starts[index])) {
      settled = index;
      break;
    }
  }

  const blocks = firstDefinition < 0 ? starts.map((start, index) => text.slice(start, starts[index + 1] ?? text.length)) : [text];
  return { source: text, blocks, starts, settled, firstDefinition };
}

/**
 * {@link splitMarkdownBlocks} with the previous split kept between calls, so a
 * text that grows by a few characters per call is re-parsed from its last open
 * block only. Correctness never depends on the kept split: a text that does not
 * extend it is split from the start.
 */
export class MarkdownBlockSplitter {
  private last: MarkdownBlocks | null = null;

  split(text: string): string[] {
    if (this.last?.source !== text) this.last = splitMarkdownBlocks(text, this.last);
    return this.last.blocks;
  }
}
