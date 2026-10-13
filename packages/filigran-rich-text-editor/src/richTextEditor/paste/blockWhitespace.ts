const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th';
const TRAILING_SPACE_PATTERN = /[ \t\r\n]+$/;
const BLANK_PATTERN = /^[ \t\r\n]*$/;

// The editor keeps a paragraph's trailing spaces when they are pasted, but drops them when the saved HTML is
// loaded again: removed at paste time, they no longer make the saved HTML change on its first reload.
export const trimBlockEndSpaces = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;
  doc.body.querySelectorAll(BLOCK_SELECTOR).forEach((block) => {
    const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!BLANK_PATTERN.test(node.data) && node.parentElement?.closest(BLOCK_SELECTOR) === block) last = node;
    }
    if (!last || !TRAILING_SPACE_PATTERN.test(last.data)) return;
    last.data = last.data.replace(TRAILING_SPACE_PATTERN, '');
    changed = true;
  });
  return changed ? doc.documentElement.outerHTML : html;
};
