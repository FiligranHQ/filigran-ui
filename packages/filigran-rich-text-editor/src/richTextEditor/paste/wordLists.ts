import { cssLengthToPixels, styleDeclaration } from './htmlHelpers.ts';
import { listItemAlignment } from './listNesting.ts';

type ListElement = HTMLOListElement | HTMLUListElement;

interface OpenList {
  element: ListElement;
  instance: string;
  level: number;
}

const MSO_LIST_PATTERN = /mso-list:\s*(l\d+)\s+level(\d+)(?:\s+(lfo\d+))?/i;
const MSO_LIST_IGNORE_PATTERN = /mso-list:\s*ignore/i;
const LIST_LEVEL_RULE_PATTERN = /@list\s+(l\d+):level(\d+)\s*\{([^}]*)\}/gi;
const NUMBER_FORMAT_PATTERN = /mso-level-number-format:\s*([\w-]+)/i;
const SUPPORT_LISTS_START_PATTERN = /^\[if !supportLists\]$/i;
const SUPPORT_LISTS_END_PATTERN = /^\[endif\]$/i;
const COMMENTED_MARKER_PATTERN = /^\[if !supportLists\]>([\s\S]*)<!\[endif\]$/i;
const LETTER_MARKER_PATTERN = /^\(?[a-z]+[.)]$/i;
const LAST_COUNTER_PATTERN = /([0-9]+|[a-z]+)[.)]?$/i;
const ROMAN_PATTERN = /^[ivxlcdm]+$/i;

const OL_TYPE_BY_NUMBER_FORMAT: Record<string, string> = {
  'alpha-lower': 'a',
  'lower-alpha': 'a',
  'alpha-upper': 'A',
  'upper-alpha': 'A',
  'roman-lower': 'i',
  'lower-roman': 'i',
  'roman-upper': 'I',
  'upper-roman': 'I',
};

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

// mso-level-number-format values that do not number the items: typed or picture bullets, and no marker at all.
const UNNUMBERED_FORMATS = ['bullet', 'image', 'none'];

// Word bullet markers, typed in the Symbol or Wingdings fonts, and the bullet styles they stand for.
const BULLET_STYLE_BY_MARKER: Record<string, string> = { '·': 'disc', '•': 'disc', o: 'circle', '§': 'square', '▪': 'square', '■': 'square' };

// Browsers indent each list level by 40px: Word's paragraph margin beyond that is kept on the list.
const LIST_INDENT_PX = 40;

const marginLeftPx = (element: Element): number | null => {
  const margin = styleDeclaration(element.getAttribute('style') ?? '', 'margin-left');
  return margin ? cssLengthToPixels(margin) : null;
};

interface TopLevelIndent {
  margin: number | null | undefined;
}

const parseNumberFormats = (doc: Document): Map<string, string> => {
  const formats = new Map<string, string>();
  doc.querySelectorAll('style').forEach((style) => {
    for (const [, listId, level, declarations] of style.textContent?.matchAll(LIST_LEVEL_RULE_PATTERN) ?? []) {
      const format = NUMBER_FORMAT_PATTERN.exec(declarations)?.[1];
      if (format) formats.set(`${listId}:${level}`, format.toLowerCase());
    }
  });
  return formats;
};

const isListParagraph = (element: Element | null): element is HTMLParagraphElement =>
  element?.tagName === 'P' && MSO_LIST_PATTERN.test(element.getAttribute('style') ?? '') && !element.closest('li');

const extractMarker = (paragraph: HTMLParagraphElement): string => {
  const doc = paragraph.ownerDocument;
  const walker = doc.createTreeWalker(paragraph, NodeFilter.SHOW_COMMENT);
  let start: Comment | null = null;
  for (let node = walker.nextNode() as Comment | null; node; node = walker.nextNode() as Comment | null) {
    const data = node.data.trim();
    const commented = start ? null : COMMENTED_MARKER_PATTERN.exec(data);
    if (commented) {
      const holder = doc.createElement('div');
      holder.innerHTML = commented[1];
      node.remove();
      return (holder.textContent ?? '').replace(/\s/g, '');
    }
    if (!start && SUPPORT_LISTS_START_PATTERN.test(data)) {
      start = node;
    } else if (start && SUPPORT_LISTS_END_PATTERN.test(data)) {
      const range = doc.createRange();
      range.setStartAfter(start);
      range.setEndBefore(node);
      const marker = range.toString();
      range.deleteContents();
      start.remove();
      node.remove();
      return marker.replace(/\s/g, '');
    }
  }
  const ignored = Array.from(paragraph.querySelectorAll('[style]')).find((element) =>
    MSO_LIST_IGNORE_PATTERN.test(element.getAttribute('style') ?? ''));
  if (!ignored) return '';
  const marker = ignored.textContent ?? '';
  ignored.remove();
  return marker.replace(/\s/g, '');
};

const isOrderedMarker = (marker: string): boolean => /[0-9]/.test(marker) || LETTER_MARKER_PATTERN.test(marker);

const typeFromMarker = (marker: string): string | null => {
  const counter = LAST_COUNTER_PATTERN.exec(marker)?.[1] ?? '';
  if (/^[0-9]*$/.test(counter)) return null;
  const isRoman = ROMAN_PATTERN.test(counter) && (counter.length > 1 || /^[iI]$/.test(counter));
  const isUpper = counter === counter.toUpperCase();
  if (isRoman) return isUpper ? 'I' : 'i';
  return isUpper ? 'A' : 'a';
};

const parseRoman = (roman: string): number => {
  const values = roman.toLowerCase().split('').map((char) => ROMAN_VALUES[char]);
  return values.reduce((total, value, index) => (value < (values[index + 1] ?? 0) ? total - value : total + value), 0);
};

const parseLetters = (letters: string): number =>
  letters.toLowerCase().split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 96, 0);

const counterValue = (marker: string, type: string | null): number => {
  const counter = LAST_COUNTER_PATTERN.exec(marker)?.[1] ?? '';
  if (type === 'i' || type === 'I') return ROMAN_PATTERN.test(counter) ? parseRoman(counter) : 1;
  if (type === 'a' || type === 'A') return /^[a-z]+$/i.test(counter) ? parseLetters(counter) : 1;
  return /^[0-9]+$/.test(counter) ? parseInt(counter, 10) : 1;
};

// A level declared by the @list rule decides the list kind; the marker text is the fallback when there is no rule.
const isBulletLevel = (marker: string, format: string | undefined): boolean =>
  (format ? UNNUMBERED_FORMATS.includes(format) : !isOrderedMarker(marker));

const createList = (doc: Document, marker: string, format: string | undefined): ListElement => {
  const mappedType = format ? OL_TYPE_BY_NUMBER_FORMAT[format] : undefined;
  if (isBulletLevel(marker, format)) {
    const list = doc.createElement('ul');
    const bulletStyle = BULLET_STYLE_BY_MARKER[marker];
    if (bulletStyle) list.setAttribute('type', bulletStyle);
    return list;
  }
  const list = doc.createElement('ol');
  const type = mappedType ?? (format ? null : typeFromMarker(marker));
  if (type) list.setAttribute('type', type);
  const start = counterValue(marker, type);
  if (start > 1) list.setAttribute('start', String(start));
  return list;
};

export const convertWordLists = (html: string): string => {
  if (!MSO_LIST_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const formats = parseNumberFormats(doc);
  const paragraphs = Array.from(doc.body.querySelectorAll('p')).filter(isListParagraph);
  const startsRun = paragraphs.map((paragraph) => !isListParagraph(paragraph.previousElementSibling));
  let stack: OpenList[] = [];
  const topLevelIndents = new Map<ListElement, TopLevelIndent>();
  paragraphs.forEach((paragraph, index) => {
    const [, listId, levelText, lfo = ''] = MSO_LIST_PATTERN.exec(paragraph.getAttribute('style') ?? '') ?? [];
    const instance = `${listId}:${lfo}`;
    const level = parseInt(levelText, 10);
    const marker = extractMarker(paragraph);
    if (startsRun[index]) stack = [];
    while (stack.length > 0 && stack[stack.length - 1].level > level) stack.pop();
    const top = stack[stack.length - 1];
    if (top && top.level === level && top.instance !== instance) stack.pop();
    let current = stack[stack.length - 1];
    if (!current || current.level < level) {
      const element = createList(doc, marker, formats.get(`${listId}:${level}`));
      const parentItem = current?.element.lastElementChild;
      if (parentItem) {
        parentItem.appendChild(element);
      } else {
        paragraph.before(element);
      }
      current = { element, instance, level };
      stack.push(current);
      if (stack.length === 1) topLevelIndents.set(element, { margin: undefined });
    }
    // A top-level list takes its items' margin when they all share it; otherwise it keeps none.
    const indent = stack.length === 1 ? topLevelIndents.get(current.element) : undefined;
    if (indent && indent.margin !== null) {
      const margin = marginLeftPx(paragraph);
      const listMargin = margin === null ? null : Math.round(margin - LIST_INDENT_PX);
      indent.margin = indent.margin === undefined || indent.margin === listMargin ? listMargin : null;
    }
    const alignment = listItemAlignment(paragraph);
    paragraph.removeAttribute('style');
    paragraph.removeAttribute('class');
    if (alignment) paragraph.setAttribute('style', `text-align: ${alignment}`);
    const item = doc.createElement('li');
    current.element.appendChild(item);
    item.appendChild(paragraph);
  });
  topLevelIndents.forEach(({ margin }, list) => {
    if (margin) list.setAttribute('style', `margin-left: ${margin}px`);
  });
  return doc.documentElement.outerHTML;
};
