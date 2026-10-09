import { nestLooseLists } from './listNesting.ts';
import { removeWordComments } from './wordComments.ts';
import { embedWordImages } from './wordImages.ts';
import { convertWordLists } from './wordLists.ts';
import { convertWordWeb } from './wordWeb.ts';

export const transformWordHtml = (html: string, rtf: string): string =>
  embedWordImages(nestLooseLists(convertWordLists(removeWordComments(convertWordWeb(html)))), rtf);
