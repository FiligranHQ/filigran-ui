import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/**
 * Reading an answer aloud through the browser's speech synthesis.
 *
 * What is spoken is the text a reader sees, never the markdown that draws it:
 * no `**`, no `#`, no table pipes, no code block, no image, and no bare URL
 * spelled out character by character. The text is parsed with the parser the
 * panel renders with (remark-parse + remark-gfm), so what counts as a heading,
 * a list or a link is what the screen shows. It reads the documents the
 * transcript renders (`answerMarkdownSources`), never the raw answer: the
 * renderer splits it at its file markers and repairs it first (`prepareMarkdown`).
 *
 * Kept free of local imports so `node --test` runs it as is.
 */

const parser = unified().use(remarkParse).use(remarkGfm).freeze();

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };

/** Blocks and inline nodes a listener has nothing to hear in. */
const SILENT = new Set(['code', 'html', 'image', 'imageReference', 'definition', 'footnoteDefinition', 'footnoteReference', 'thematicBreak']);

function inlineText(node: MdNode): string {
  if (SILENT.has(node.type)) return '';
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (node.type === 'break') return ' ';
  const text = (node.children ?? []).map(inlineText).join('');
  // A link written as its own address (a bare URL, an autolink) is noise when
  // read out; a link with words says those words.
  if (node.type === 'link' && node.url && (text === node.url || `mailto:${text}` === node.url)) return '';
  return text;
}

function collectLines(node: MdNode, lines: string[]): void {
  if (SILENT.has(node.type)) return;
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      lines.push(inlineText(node));
      return;
    case 'tableRow':
      lines.push(
        (node.children ?? [])
          .map(inlineText)
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(', '),
      );
      return;
    default:
      for (const child of node.children ?? []) collectLines(child, lines);
  }
}

/**
 * The words of an answer's markdown documents, one sentence-ending line per
 * block: a heading or a list item without its own punctuation gets a full
 * stop, so the voice pauses where the eye does. Each document is parsed on its own.
 */
export function speakableText(documents: readonly string[]): string {
  const lines: string[] = [];
  for (const markdown of documents) {
    if (markdown.trim()) collectLines(parser.parse(markdown) as MdNode, lines);
  }
  return lines
    .map((line) =>
      line
        .replace(/\s+/g, ' ')
        .replace(/ ([.,!?;:])/g, '$1')
        .trim(),
    )
    .filter((line) => /[\p{L}\p{N}]/u.test(line))
    .map((line) => (/[.!?;:\u3002\uff01\uff1f]$/.test(line) ? line : `${line}.`))
    .join('\n');
}

/**
 * A fenced code block: a run of 3+ backticks or tildes, closed by a bare run of
 * the same character at least as long (`prepareMarkdown` lengthens the fence
 * around nested ones), or by the end of an answer cut short.
 */
const FENCED_BLOCK_RE = /^[ \t]*((`|~)\2{2,})[\s\S]*?(?:^[ \t]*\1\2*[ \t]*$|(?![\s\S]))/gm;

/**
 * Whether an answer's markdown documents have words to read outside their code
 * blocks - what decides that it gets a "Read aloud" button. A cheap look rather
 * than `speakableText`: it runs for every message on screen, the full parse only on a click.
 */
export function hasSpeakableWords(documents: readonly string[]): boolean {
  return documents.some((markdown) => /[\p{L}\p{N}]/u.test(markdown.replace(FENCED_BLOCK_RE, '')));
}

/**
 * Longest utterance handed to the synthesiser. Chrome stops a single utterance
 * after roughly fifteen seconds without firing `end`, so a long answer is
 * queued as a series of short ones, cut between sentences.
 */
export const SPEECH_CHUNK_MAX_LENGTH = 220;

/** `text` cut into utterances of at most `maxLength` characters, between sentences first, then between words. */
export function chunkSpeech(text: string, maxLength: number = SPEECH_CHUNK_MAX_LENGTH): string[] {
  const sentences = text
    .split(/\n+|(?<=[.!?;:\u3002\uff01\uff1f])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pieces: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxLength) {
      pieces.push(sentence);
      continue;
    }
    let current = '';
    for (const word of sentence.split(' ')) {
      for (let start = 0; start < word.length; start += maxLength) {
        const part = word.slice(start, start + maxLength);
        if (!current) current = part;
        else if (current.length + 1 + part.length <= maxLength) current = `${current} ${part}`;
        else {
          pieces.push(current);
          current = part;
        }
      }
    }
    if (current) pieces.push(current);
  }
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length + 1 + piece.length <= maxLength) chunks[last] = `${chunks[last]} ${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

/** The part of `window.speechSynthesis` the controller uses. */
export interface SpeechSynthesisLike<U> {
  speak(utterance: U): void;
  cancel(): void;
}

/** Builds one utterance; `window.SpeechSynthesisUtterance` in the browser. */
export type CreateUtterance<U> = (text: string, options: { lang?: string; onEnd: () => void; onError: () => void }) => U;

export interface SpeechController {
  /**
   * Reads `chunks` as the message `id`, stopping whatever was being read.
   * Returns false, and reads nothing, when there is nothing to read.
   */
  speak(id: string, chunks: string[], lang?: string): boolean;
  /** Stops reading. A no-op when nothing is being read. */
  stop(): void;
  /** The message being read, or null. */
  readonly speakingId: string | null;
}

/**
 * One reader for the whole transcript: starting a message stops the previous
 * one, and `onChange` reports which message is being read (null once it ended,
 * failed or was stopped). The synthesiser reports the end of an utterance
 * asynchronously and, on `cancel()`, fails every queued one: each reading
 * carries a generation, and only the current one's events count.
 */
export function createSpeechController<U>(
  synth: SpeechSynthesisLike<U>,
  createUtterance: CreateUtterance<U>,
  onChange: (id: string | null) => void,
): SpeechController {
  let generation = 0;
  let speakingId: string | null = null;

  const finish = (gen: number) => {
    if (gen !== generation || speakingId === null) return;
    generation += 1;
    speakingId = null;
    onChange(null);
  };

  // Nothing of ours being read, nothing is cancelled: the synthesiser is the
  // page's, and the host may be using it.
  const stop = () => {
    if (speakingId === null) return;
    generation += 1;
    speakingId = null;
    synth.cancel();
    onChange(null);
  };

  const speak = (id: string, chunks: string[], lang?: string) => {
    stop();
    const parts = chunks.filter((c) => c.trim());
    if (!parts.length) return false;
    const gen = generation;
    speakingId = id;
    onChange(id);
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      const utterance = createUtterance(part, {
        lang,
        onEnd: () => {
          if (last) finish(gen);
        },
        onError: () => {
          if (gen !== generation) return;
          // Ends the reading before cancelling the rest of its queue, whose
          // failures then belong to a past generation.
          finish(gen);
          synth.cancel();
        },
      });
      synth.speak(utterance);
    });
    return true;
  };

  return {
    speak,
    stop,
    get speakingId() {
      return speakingId;
    },
  };
}
