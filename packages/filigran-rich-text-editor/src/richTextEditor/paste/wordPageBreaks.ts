import { isBlank } from './htmlHelpers.ts';

const PAGE_BREAK_PATTERN = /page-break-before\s*:\s*always/i;
const PAGE_BREAK_CLASS = 'page-break';

// Word writes a page break as <br style="page-break-before:always">, usually alone in a span between two paragraphs.
// It becomes the editor page break, in place of the outermost element that holds nothing else.
export const convertWordPageBreaks = (html: string): string => {
  if (!PAGE_BREAK_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const breaks = Array.from(doc.body.querySelectorAll('br')).filter((lineBreak) => PAGE_BREAK_PATTERN.test(lineBreak.getAttribute('style') ?? ''));
  if (breaks.length === 0) return html;
  breaks.forEach((lineBreak) => {
    let target: Element = lineBreak;
    while (target.parentElement && target.parentElement !== doc.body && isBlank(target.parentElement)) target = target.parentElement;
    const pageBreak = doc.createElement('div');
    pageBreak.className = PAGE_BREAK_CLASS;
    target.replaceWith(pageBreak);
  });
  return doc.documentElement.outerHTML;
};
