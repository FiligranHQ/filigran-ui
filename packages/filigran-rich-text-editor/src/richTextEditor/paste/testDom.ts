import { JSDOM } from 'jsdom';

const { window } = new JSDOM('');

// jsdom has no canvas. This 2D context normalizes colors the way browsers do (named colors, hsl(),
// rgb() and hex all come out as #rrggbb or rgba()), which is what TableCellStyleAttributes relies on
// to compute data-cell-background in tests. jsdom's computed style does the color parsing.
const colorProbe = window.document.createElement('span');
window.document.body.append(colorProbe);

const toCanvasColor = (value: string): string | null => {
  colorProbe.style.backgroundColor = '';
  colorProbe.style.backgroundColor = value;
  if (!colorProbe.style.backgroundColor) return null;
  const rgba = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(window.getComputedStyle(colorProbe).backgroundColor);
  if (!rgba) return null;
  const channels = rgba.slice(1, 4).map(Number);
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  if (alpha === 1) return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${channels.join(', ')}, ${alpha})`;
};

window.HTMLCanvasElement.prototype.getContext = function getContext() {
  let fillStyle = '#000000';
  return {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = toCanvasColor(String(value)) ?? fillStyle;
    },
  };
} as unknown as typeof window.HTMLCanvasElement.prototype.getContext;

Object.assign(globalThis, {
  window,
  document: window.document,
  DOMParser: window.DOMParser,
  HTMLElement: window.HTMLElement,
  NodeFilter: window.NodeFilter,
});

export const parseHtml = (html: string): Document => new window.DOMParser().parseFromString(html, 'text/html');
