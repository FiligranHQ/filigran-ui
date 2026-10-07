import type { Attribute } from '@tiptap/core';

const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;
const INVISIBLE_BORDER_STYLES = ['none', 'hidden'];
const LIGHT_BACKGROUND_MIN_LUMINANCE = 0.179;
const COLOR_SENTINELS = ['#000000', '#ffffff'];

let colorContext: CanvasRenderingContext2D | null | undefined;

const parseBorderSide = (element: HTMLElement, side: typeof BORDER_SIDES[number]): string | null => {
  const style = element.style.getPropertyValue(`border-${side}-style`);
  if (!style) return null;
  if (INVISIBLE_BORDER_STYLES.includes(style)) return `border-${side}: ${style}`;
  const width = element.style.getPropertyValue(`border-${side}-width`);
  const color = element.style.getPropertyValue(`border-${side}-color`).replace(/\bwindowtext\b/gi, 'currentcolor');
  return `border-${side}: ${[width, style, color].filter(Boolean).join(' ')}`;
};

const toRgba = (color: string): number[] | null => {
  colorContext ??= document.createElement('canvas').getContext('2d');
  const context = colorContext;
  if (!context) return null;
  const [normalized, other] = COLOR_SENTINELS.map((sentinel) => {
    context.fillStyle = sentinel;
    context.fillStyle = color;
    return String(context.fillStyle);
  });
  if (normalized !== other) return null;
  if (normalized.startsWith('#')) {
    return [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16)).concat(1);
  }
  const channels = /rgba?\(([^)]+)\)/.exec(normalized)?.[1].split(',').map((value) => parseFloat(value));
  return channels ? [...channels.slice(0, 3), channels[3] ?? 1] : null;
};

const relativeLuminance = ([red, green, blue]: number[]): number => {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const backgroundTone = (color: string): 'light' | 'dark' | null => {
  const rgba = toRgba(color);
  if (!rgba || rgba[3] < 1) return null;
  return relativeLuminance(rgba) > LIGHT_BACKGROUND_MIN_LUMINANCE ? 'light' : 'dark';
};

const toBackgroundColor = (value: string | null, doc: Document): string | null => {
  if (!value) return null;
  const probe = doc.createElement('span');
  probe.style.backgroundColor = value;
  return probe.style.backgroundColor || null;
};

const toBorder = (element: HTMLElement): string | null => {
  const declarations = BORDER_SIDES.map((side) => parseBorderSide(element, side)).filter(Boolean);
  return declarations.length > 0 ? declarations.join('; ') : null;
};

export const tableCellStyleAttributes: Record<string, Attribute> = {
  backgroundColor: {
    default: null,
    parseHTML: (element: HTMLElement) =>
      toBackgroundColor(element.style.backgroundColor || element.getAttribute('bgcolor'), element.ownerDocument),
    renderHTML: (attributes) => {
      const backgroundColor = toBackgroundColor(attributes.backgroundColor, document);
      if (!backgroundColor) return {};
      const tone = backgroundTone(backgroundColor);
      return {
        style: `background-color: ${backgroundColor}`,
        ...(tone ? { 'data-cell-background': tone } : {}),
      };
    },
  },
  border: {
    default: null,
    parseHTML: (element: HTMLElement) => toBorder(element),
    renderHTML: (attributes) => {
      if (!attributes.border) return {};
      const probe = document.createElement('span');
      probe.setAttribute('style', attributes.border);
      const border = toBorder(probe);
      return border ? { style: border } : {};
    },
  },
};
