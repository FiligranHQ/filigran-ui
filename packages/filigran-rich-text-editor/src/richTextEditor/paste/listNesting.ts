import { ELEMENT_NODE, isBlank } from './htmlHelpers.ts';

const LIST_PATTERN = /<(?:ul|ol)\b/i;
const LIST_TAGS = ['UL', 'OL'];

const previousItem = (list: Element): Element | null => {
  let previous = list.previousElementSibling;
  while (previous && previous.tagName !== 'LI' && isBlank(previous)) previous = previous.previousElementSibling;
  return previous?.tagName === 'LI' ? previous : null;
};

const ALIGNMENT_PATTERN = /(?:^|;)\s*text-align\s*:\s*(center|right|justify)\b/i;
const BLOCK_TAGS = ['P', 'DIV', 'UL', 'OL', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'FIGURE'];

// The alignment worth keeping on a list item: left is the default.
export const listItemAlignment = (element: Element): string | null =>
  ALIGNMENT_PATTERN.exec(element.getAttribute('style') ?? '')?.[1].toLowerCase() ?? null;

// The editor aligns paragraphs, not list items: an aligned <li> passes its alignment to its paragraphs,
// wrapping its leading inline content in one.
export const alignListItemParagraphs = (html: string): string => {
  if (!/<li\b[^>]*text-align/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('li').forEach((item) => {
    const alignment = listItemAlignment(item);
    if (!alignment) return;
    const inline: ChildNode[] = [];
    for (const child of Array.from(item.childNodes)) {
      if (child.nodeType === ELEMENT_NODE && BLOCK_TAGS.includes((child as Element).tagName)) break;
      inline.push(child);
    }
    if (inline.some((node) => (node.textContent ?? '').trim() !== '' || (node.nodeType === ELEMENT_NODE && (node as Element).querySelector('img')))) {
      const paragraph = doc.createElement('p');
      item.insertBefore(paragraph, inline[0]);
      paragraph.append(...inline);
    }
    Array.from(item.children).filter((child) => child.tagName === 'P' && !listItemAlignment(child))
      .forEach((paragraph) => paragraph.setAttribute('style', `${paragraph.getAttribute('style') ?? ''};text-align: ${alignment}`.replace(/^;/, '')));
  });
  return doc.documentElement.outerHTML;
};

const listStart = (list: Element): number => parseInt(list.getAttribute('start') ?? '1', 10) || 1;

// What two lists must share to be joined: their indentation and their bullet or numbering type.
const listLook = (list: Element): string =>
  `${/margin-left\s*:\s*([^;]+)/i.exec(list.getAttribute('style') ?? '')?.[1].trim() ?? ''}|${(list.getAttribute('type') ?? '').toLowerCase()}`;

// An ordered list joins the previous one only when its numbering carries on from it.
const continues = (previous: Element, list: Element): boolean => listLook(previous) === listLook(list) && (list.tagName === 'UL'
  || listStart(list) === listStart(previous) + Array.from(previous.children).filter((child) => child.tagName === 'LI').length);

// Word can write one visual list as list paragraphs followed by a real list, or as several lists in a row.
// Lists of the same type that follow each other directly are joined.
export const mergeAdjacentLists = (html: string): string => {
  if (!LIST_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let merged = false;
  Array.from(doc.body.querySelectorAll('ul, ol')).forEach((list) => {
    let sibling = list.previousSibling;
    while (sibling && sibling.nodeType !== ELEMENT_NODE && (sibling.textContent ?? '').trim() === '') sibling = sibling.previousSibling;
    const previous = sibling?.nodeType === ELEMENT_NODE ? (sibling as Element) : null;
    if (!previous || previous.tagName !== list.tagName || !continues(previous, list)) return;
    previous.append(...Array.from(list.childNodes));
    list.remove();
    merged = true;
  });
  return merged ? doc.documentElement.outerHTML : html;
};

export const nestLooseLists = (html: string): string => {
  if (!LIST_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const looseLists = Array.from(doc.body.querySelectorAll('ul, ol'))
    .filter((list) => LIST_TAGS.includes(list.parentElement?.tagName ?? ''));
  if (looseLists.length === 0) return html;
  looseLists.forEach((list) => {
    const previous = previousItem(list);
    if (previous) {
      previous.appendChild(list);
      return;
    }
    const item = doc.createElement('li');
    list.before(item);
    item.appendChild(list);
  });
  return doc.documentElement.outerHTML;
};
