const WORD_COMMENT_PATTERN = /MsoCommentReference|msocomanchor|mso-element:\s*comment/i;
const COMMENT_SELECTOR = '.MsoCommentReference, a.msocomanchor, .msocomoff, [style*="mso-element:comment"], [style*="mso-element: comment"]';

export const removeWordComments = (html: string): string => {
  if (!WORD_COMMENT_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(COMMENT_SELECTOR).forEach((element) => element.remove());
  return doc.documentElement.outerHTML;
};
