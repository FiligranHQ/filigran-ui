import { trimBlockSpaces } from './blockWhitespace.ts';
import { alignListItemParagraphs, mergeAdjacentLists, nestLooseLists } from './listNesting.ts';
import { removeWordComments } from './wordComments.ts';
import { embedWordImages, splitPictureParagraphs } from './wordImages.ts';
import type { PasteReport } from './wordImages.ts';
import { convertWordLists } from './wordLists.ts';
import { convertWordPageBreaks } from './wordPageBreaks.ts';
import { cleanWordStyles } from './wordStyles.ts';
import { convertWordWeb } from './wordWeb.ts';

export type { PasteReport };

type Step = (html: string) => string;

const WORD_DESKTOP_PATTERN = /urn:schemas-microsoft-com:office:word/i;

// Run on every pasted HTML. Each step returns its input untouched when the markup it handles is absent.
const COMMON_STEPS: Step[] = [convertWordWeb, convertWordPageBreaks, removeWordComments, convertWordLists, nestLooseLists];

// Run only on Word desktop HTML, recognised by its namespace, to keep the layout Word gave it. They come after
// the steps that read Word's mso- properties, since cleanWordStyles drops them.
const WORD_DESKTOP_STEPS: Step[] = [alignListItemParagraphs, mergeAdjacentLists, cleanWordStyles];

// Run on Word desktop HTML once its pictures are embedded: splitting a paragraph around its pictures can leave spaces at
// the edges of its parts, which trimBlockSpaces then removes.
const WORD_DESKTOP_FINAL_STEPS: Step[] = [splitPictureParagraphs, trimBlockSpaces];

const run = (steps: Step[], html: string): string => steps.reduce((current, step) => step(current), html);

export const transformWordHtml = (html: string, rtf: string, report?: PasteReport): string => {
  if (!WORD_DESKTOP_PATTERN.test(html)) return embedWordImages(run(COMMON_STEPS, html), rtf, report);
  const withPictures = embedWordImages(run([...COMMON_STEPS, ...WORD_DESKTOP_STEPS], html), rtf, report);
  return run(WORD_DESKTOP_FINAL_STEPS, withPictures);
};
