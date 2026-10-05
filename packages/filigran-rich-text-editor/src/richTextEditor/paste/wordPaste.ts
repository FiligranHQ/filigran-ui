import { embedWordImages } from './wordImages.ts';
import { convertWordLists } from './wordLists.ts';
import { convertWordWeb } from './wordWeb.ts';

export const transformWordHtml = (html: string, rtf: string): string =>
  embedWordImages(convertWordLists(convertWordWeb(html)), rtf);
