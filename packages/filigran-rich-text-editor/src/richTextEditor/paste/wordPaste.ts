import { trimBlockEndSpaces } from './blockWhitespace.ts';
import { alignListItemParagraphs, mergeAdjacentLists, nestLooseLists } from './listNesting.ts';
import { removeWordComments } from './wordComments.ts';
import { embedWordImages, liftPictureParagraphs } from './wordImages.ts';
import type { PasteReport } from './wordImages.ts';
import { convertWordLists } from './wordLists.ts';
import { convertWordPageBreaks } from './wordPageBreaks.ts';
import { convertWordWeb } from './wordWeb.ts';

export type { PasteReport };

const WORD_DESKTOP_PATTERN = /urn:schemas-microsoft-com:office:word/i;

export const transformWordHtml = (html: string, rtf: string, report?: PasteReport): string => {
  const lists = nestLooseLists(convertWordLists(removeWordComments(convertWordPageBreaks(convertWordWeb(html)))));
  if (!WORD_DESKTOP_PATTERN.test(html)) return embedWordImages(lists, rtf, report);
  return liftPictureParagraphs(embedWordImages(trimBlockEndSpaces(mergeAdjacentLists(alignListItemParagraphs(lists))), rtf, report));
};
