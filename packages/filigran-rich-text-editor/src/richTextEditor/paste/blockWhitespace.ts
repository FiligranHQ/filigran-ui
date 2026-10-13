const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th';
const LEADING_SPACE_PATTERN = /^[ \t\r\n]+/;
const TRAILING_SPACE_PATTERN = /[ \t\r\n]+$/;
const BLANK_PATTERN = /^[ \t\r\n]*$/;

// The editor keeps the spaces that open or close a paragraph when they are pasted, but drops them when the saved HTML
// is loaded again: removed at paste time, they no longer make the saved HTML change on its first reload. Non-breaking
// spaces are content and are kept.
export const trimBlockSpaces = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;
  doc.body.querySelectorAll(BLOCK_SELECTOR).forEach((block) => {
    const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!BLANK_PATTERN.test(node.data) && node.parentElement?.closest(BLOCK_SELECTOR) === block) texts.push(node);
    }
    const first = texts[0];
    const last = texts[texts.length - 1];
    if (first && LEADING_SPACE_PATTERN.test(first.data)) {
      first.data = first.data.replace(LEADING_SPACE_PATTERN, '');
      changed = true;
    }
    if (last && TRAILING_SPACE_PATTERN.test(last.data)) {
      last.data = last.data.replace(TRAILING_SPACE_PATTERN, '');
      changed = true;
    }
  });
  return changed ? doc.documentElement.outerHTML : html;
};
