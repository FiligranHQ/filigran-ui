type ListElement = HTMLOListElement | HTMLUListElement;

interface ListEntry {
  item: Element;
  level: number;
  listId: string;
  ordered: boolean;
  start: string | null;
}

interface OpenList {
  element: ListElement;
  level: number;
  listId: string;
  ordered: boolean;
}

const WORD_WEB_PATTERN = /class="[^"]*\b(?:OutlineElement|NormalTextRun|TextRun)\b/;
const REMOVED_SELECTOR = '.WACAltTextDescribedBy, .EOP';
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
const AUTOMATIC_COLORS = ['rgb(0, 0, 0)', 'windowtext', 'black', '#000000', '#000'];
const TRANSPARENT_COLORS = ['transparent', 'rgba(0, 0, 0, 0)'];
const SPAN_PROPERTIES = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration-line', 'vertical-align', 'font-size'];
const CELL_PROPERTY_PATTERN = /^(?:width|background-color|border-(?:top|right|bottom|left)-(?:width|style|color))$/;
const BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

const isAllowedProperty = (element: HTMLElement, property: string): boolean => {
  if (element.tagName === 'SPAN') return SPAN_PROPERTIES.includes(property);
  if (element.tagName === 'TD' || element.tagName === 'TH') return CELL_PROPERTY_PATTERN.test(property);
  if (BLOCK_TAGS.includes(element.tagName)) return property === 'text-align';
  return false;
};

const isMeaningfulValue = (element: HTMLElement, property: string): boolean => {
  const value = element.style.getPropertyValue(property).toLowerCase();
  if (property === 'color') return !AUTOMATIC_COLORS.includes(value);
  if (property === 'background-color') {
    return !TRANSPARENT_COLORS.includes(value)
      && element.style.getPropertyPriority(property) !== 'important'
      && !element.classList.contains('Selected');
  }
  if (property === 'font-size') return !element.closest(HEADING_SELECTOR);
  return true;
};

const cleanStyle = (element: HTMLElement) => {
  const declarations = Array.from(element.style)
    .filter((property) => isAllowedProperty(element, property) && isMeaningfulValue(element, property))
    .map((property) => `${property}: ${element.style.getPropertyValue(property)}`);
  if (declarations.length > 0) {
    element.setAttribute('style', declarations.join('; '));
  } else {
    element.removeAttribute('style');
  }
};

const convertHeadings = (doc: Document) => {
  doc.querySelectorAll('p[role="heading"][aria-level]').forEach((paragraph) => {
    const level = Math.min(Math.max(parseInt(paragraph.getAttribute('aria-level') ?? '', 10) || 1, 1), 6);
    const heading = doc.createElement(`h${level}`);
    heading.append(...Array.from(paragraph.childNodes));
    const align = (paragraph as HTMLElement).style.textAlign;
    if (align) heading.style.textAlign = align;
    paragraph.replaceWith(heading);
  });
};

const isWordWebList = (element: Element | null): element is ListElement =>
  (element?.tagName === 'UL' || element?.tagName === 'OL') && element.querySelector(':scope > li[data-aria-level]') !== null;

const toListEntries = (list: ListElement): ListEntry[] => Array.from(list.children)
  .filter((child) => child.tagName === 'LI')
  .map((item) => ({
    item,
    level: parseInt(item.getAttribute('data-aria-level') ?? '', 10) || 1,
    listId: item.getAttribute('data-listid') ?? '',
    ordered: list.tagName === 'OL',
    start: list.getAttribute('start'),
  }));

const rebuildListRun = (doc: Document, lists: ListElement[]) => {
  const anchor = lists[0];
  let stack: OpenList[] = [];
  lists.flatMap(toListEntries).forEach((entry) => {
    while (stack.length > 0 && stack[stack.length - 1].level > entry.level) stack.pop();
    const top = stack[stack.length - 1];
    if (top && top.level === entry.level && (top.listId !== entry.listId || top.ordered !== entry.ordered)) stack.pop();
    let current = stack[stack.length - 1];
    if (!current || current.level < entry.level) {
      const element = doc.createElement(entry.ordered ? 'ol' : 'ul');
      if (entry.ordered && entry.start && entry.start !== '1') element.setAttribute('start', entry.start);
      const parentItem = current?.element.lastElementChild;
      if (parentItem) {
        parentItem.appendChild(element);
      } else {
        anchor.before(element);
      }
      current = { element, level: entry.level, listId: entry.listId, ordered: entry.ordered };
      stack = [...stack, current];
    }
    Array.from(entry.item.attributes).forEach((attribute) => entry.item.removeAttribute(attribute.name));
    current.element.appendChild(entry.item);
  });
  lists.forEach((list) => list.remove());
};

const convertLists = (doc: Document) => {
  const runs: ListElement[][] = [];
  Array.from(doc.body.querySelectorAll('ul, ol')).filter(isWordWebList).forEach((list) => {
    const previous = list.previousElementSibling;
    const run = runs[runs.length - 1];
    if (run && previous === run[run.length - 1]) {
      run.push(list);
    } else {
      runs.push([list]);
    }
  });
  runs.forEach((run) => rebuildListRun(doc, run));
};

export const convertWordWeb = (html: string): string => {
  if (!WORD_WEB_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(REMOVED_SELECTOR).forEach((element) => element.remove());
  convertHeadings(doc);
  doc.body.querySelectorAll('div').forEach((div) => div.replaceWith(...Array.from(div.childNodes)));
  convertLists(doc);
  doc.body.querySelectorAll<HTMLElement>('[style]').forEach(cleanStyle);
  return doc.documentElement.outerHTML;
};
