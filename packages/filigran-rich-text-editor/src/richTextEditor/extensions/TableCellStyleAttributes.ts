import type { Attribute } from '@tiptap/core';

const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;
const INVISIBLE_BORDER_STYLES = ['none', 'hidden'];

const parseBorderSide = (element: HTMLElement, side: typeof BORDER_SIDES[number]): string | null => {
  const style = element.style.getPropertyValue(`border-${side}-style`);
  if (!style) return null;
  if (INVISIBLE_BORDER_STYLES.includes(style)) return `border-${side}: ${style}`;
  const width = element.style.getPropertyValue(`border-${side}-width`);
  const color = element.style.getPropertyValue(`border-${side}-color`).replace(/\bwindowtext\b/gi, 'currentcolor');
  return `border-${side}: ${[width, style, color].filter(Boolean).join(' ')}`;
};

export const tableCellStyleAttributes: Record<string, Attribute> = {
  backgroundColor: {
    default: null,
    parseHTML: (element: HTMLElement) => element.style.backgroundColor || element.getAttribute('bgcolor') || null,
    renderHTML: (attributes) => (attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {}),
  },
  border: {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const declarations = BORDER_SIDES.map((side) => parseBorderSide(element, side)).filter(Boolean);
      return declarations.length > 0 ? declarations.join('; ') : null;
    },
    renderHTML: (attributes) => (attributes.border ? { style: attributes.border } : {}),
  },
};
