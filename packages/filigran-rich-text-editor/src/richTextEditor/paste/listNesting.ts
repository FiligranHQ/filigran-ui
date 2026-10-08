const LIST_PATTERN = /<(?:ul|ol)\b/i;
const LIST_TAGS = ['UL', 'OL'];

const isBlank = (element: Element): boolean => (element.textContent ?? '').trim() === '' && !element.querySelector('img');

const previousItem = (list: Element): Element | null => {
  let previous = list.previousElementSibling;
  while (previous && previous.tagName !== 'LI' && isBlank(previous)) previous = previous.previousElementSibling;
  return previous?.tagName === 'LI' ? previous : null;
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
