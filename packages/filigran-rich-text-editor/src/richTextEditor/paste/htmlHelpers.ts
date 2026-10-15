// Helpers shared by the paste transforms.

export const ELEMENT_NODE = 1;

// An element holding no text and no picture: Word's empty wrappers and bookmark spans.
export const isBlank = (element: Element): boolean => (element.textContent ?? '').trim() === '' && !element.querySelector('img');

const PIXELS_PER_UNIT: Record<string, number> = { px: 1, pt: 96 / 72, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 };
const CSS_LENGTH_PATTERN = /^(-?[\d.]+)(px|pt|in|cm|mm)?$/i;

// A CSS length in pixels, or null for another unit or a value that is not a length. A bare number is read as pixels.
export const cssLengthToPixels = (value: string): number | null => {
  const match = CSS_LENGTH_PATTERN.exec(value.trim());
  return match ? parseFloat(match[1]) * PIXELS_PER_UNIT[(match[2] ?? 'px').toLowerCase()] : null;
};

// The value of one declaration in a style text. The text is read as is, not through element.style: browsers drop the
// mso- properties and the VML styles Word relies on.
export const styleDeclaration = (style: string, property: string): string | null =>
  new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(style)?.[1].trim() ?? null;
