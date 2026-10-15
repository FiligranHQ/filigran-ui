const WORD_COMMENT_PATTERN = /MsoCommentReference|msocomanchor|mso-element:\s*comment/i;
const COMMENT_SELECTOR = 'a.msocomanchor, .msocomoff, [style*="mso-element:comment"], [style*="mso-element: comment"]';
const COMMENT_REFERENCE_SELECTOR = '.MsoCommentReference';

export const removeWordComments = (html: string): string => {
  if (!WORD_COMMENT_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(COMMENT_SELECTOR).forEach((element) => element.remove());
  // A comment reference holds the comment marker, removed above, but Word can also wrap document text in it.
  doc.querySelectorAll(COMMENT_REFERENCE_SELECTOR).forEach((reference) => {
    if ((reference.textContent ?? '').trim() === '') reference.remove();
    else reference.replaceWith(...Array.from(reference.childNodes));
  });
  return doc.documentElement.outerHTML;
};
