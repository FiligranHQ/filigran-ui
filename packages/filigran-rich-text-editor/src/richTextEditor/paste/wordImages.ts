interface RtfPicture {
  mimeType: string | null;
  hex: string[];
  lossy: boolean;
  widthTwips: number | null;
  heightTwips: number | null;
  scaleX: number;
  scaleY: number;
  cropTwips: { left: number; right: number; top: number; bottom: number };
}

interface RtfGroup {
  picture: RtfPicture | null;
  insidePicture: boolean;
  alternative: boolean;
}

const MIME_TYPE_BY_BLIP: Record<string, string> = {
  pngblip: 'image/png',
  jpegblip: 'image/jpeg',
};

const ALTERNATIVE_DESTINATIONS = ['nonshppict', 'shprslt'];
const TWIPS_PER_PIXEL = 15;
const SIZE_TOLERANCE = 0.1;
const LOCAL_IMAGE_SOURCE_PATTERN = /^file:/i;
const HTML_LOCAL_IMAGE_PATTERN = /src\s*=\s*["']?file:/i;
const CONTROL_WORD_PATTERN = /\\([a-z]+)(-?\d+)? ?/iy;
const TEXT_RUN_PATTERN = /[^\\{}]+/y;
const BASE64_CHUNK_SIZE = 0x8000;
const MAX_BYTE_VALUE = 0xff;
const VML_SHAPE_SELECTOR = 'v\\:shape';
const VML_IMAGE_DATA_SELECTOR = 'v\\:imagedata';
const VML_TAG_PREFIX = 'V:';
const VML_ELEMENT_PATTERN = /<v:[a-z]/i;
const PIXELS_PER_UNIT: Record<string, number> = { px: 1, pt: 4 / 3, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 };
const CSS_LENGTH_PATTERN = /^([\d.]+)(pt|px|in|cm|mm)?$/i;
const PAGE_RULE_PATTERN = /@page\s+WordSection1\s*\{([^}]*)\}/i;
// A picture at least this share of the Word column wide spans the column.
const FULL_WIDTH_RATIO = 0.95;
const ZIP_LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP_LOCAL_HEADER_LENGTH = 30;
const ZIP_STORED = 0;
const GFXDATA_MEDIA_PATTERN = /^clipboard\/media\/[^/]+\.(png|jpe?g)$/i;

const bytesToHex = (payload: string): string | null => {
  const codes = Array.from(payload, (char) => char.charCodeAt(0));
  if (codes.some((code) => code > MAX_BYTE_VALUE)) return null;
  return codes.map((code) => code.toString(16).padStart(2, '0')).join('');
};

const extractRtfPictures = (rtf: string): RtfPicture[] => {
  const pictures: RtfPicture[] = [];
  const stack: RtfGroup[] = [{ picture: null, insidePicture: false, alternative: false }];
  let index = 0;
  while (index < rtf.length) {
    const group = stack[stack.length - 1];
    const char = rtf[index];
    if (char === '{') {
      stack.push({ picture: null, insidePicture: group.insidePicture || group.picture !== null, alternative: group.alternative });
      index += 1;
    } else if (char === '}') {
      if (stack.length > 1) stack.pop();
      index += 1;
    } else if (char === '\\') {
      CONTROL_WORD_PATTERN.lastIndex = index;
      const match = CONTROL_WORD_PATTERN.exec(rtf);
      if (!match) {
        index += rtf[index + 1] === "'" ? 4 : 2;
        continue;
      }
      const [, word, parameter] = match;
      index = CONTROL_WORD_PATTERN.lastIndex;
      if (ALTERNATIVE_DESTINATIONS.includes(word)) {
        group.alternative = true;
      } else if (word === 'pict' && !group.insidePicture) {
        group.picture = { mimeType: null, hex: [], lossy: false, widthTwips: null, heightTwips: null, scaleX: 100, scaleY: 100, cropTwips: { left: 0, right: 0, top: 0, bottom: 0 } };
        if (!group.alternative) pictures.push(group.picture);
      } else if (word === 'bin') {
        const length = parseInt(parameter ?? '0', 10);
        if (length > 0) {
          const payload = rtf.slice(index, index + length);
          const hex = payload.length === length ? bytesToHex(payload) : null;
          if (group.picture && hex !== null) group.picture.hex.push(hex);
          if (group.picture && hex === null) group.picture.lossy = true;
          index += length;
        }
      } else if (group.picture && MIME_TYPE_BY_BLIP[word]) {
        group.picture.mimeType = MIME_TYPE_BY_BLIP[word];
      } else if (group.picture && parameter !== undefined) {
        const value = parseInt(parameter, 10);
        if (word === 'picwgoal') group.picture.widthTwips = value;
        if (word === 'pichgoal') group.picture.heightTwips = value;
        if (word === 'picscalex') group.picture.scaleX = value;
        if (word === 'picscaley') group.picture.scaleY = value;
        if (word === 'piccropl') group.picture.cropTwips.left = value;
        if (word === 'piccropr') group.picture.cropTwips.right = value;
        if (word === 'piccropt') group.picture.cropTwips.top = value;
        if (word === 'piccropb') group.picture.cropTwips.bottom = value;
      }
    } else {
      TEXT_RUN_PATTERN.lastIndex = index;
      const run = TEXT_RUN_PATTERN.exec(rtf)?.[0] ?? char;
      if (group.picture) group.picture.hex.push(run.replace(/[^0-9a-f]/gi, ''));
      index += run.length;
    }
  }
  return pictures;
};

const hexToBase64 = (hex: string): string => {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  let binary = '';
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
};

const isLocalImage = (image: Element): boolean => LOCAL_IMAGE_SOURCE_PATTERN.test(image.getAttribute('src') ?? '');

const relativeGap = (first: number, second: number): number => Math.abs(first - second) / Math.max(first, second);

const sizesMatch = (picture: RtfPicture, image: Element): boolean => {
  const width = parseFloat(image.getAttribute('width') ?? '');
  const height = parseFloat(image.getAttribute('height') ?? '');
  if (!(width > 0 && height > 0) || !picture.widthTwips || !picture.heightTwips) return true;
  // Word shows the cropped picture, scaled: the HTML gives that displayed size.
  const { left, right, top, bottom } = picture.cropTwips;
  const pictureWidth = ((picture.widthTwips - left - right) * picture.scaleX) / 100 / TWIPS_PER_PIXEL;
  const pictureHeight = ((picture.heightTwips - top - bottom) * picture.scaleY) / 100 / TWIPS_PER_PIXEL;
  return relativeGap(width, pictureWidth) <= SIZE_TOLERANCE && relativeGap(height, pictureHeight) <= SIZE_TOLERANCE;
};

const pictureSource = ({ mimeType, hex, lossy }: RtfPicture): string | null => {
  const data = hex.join('');
  return mimeType && data && !lossy ? `data:${mimeType};base64,${hexToBase64(data)}` : null;
};

const readUint16 = (binary: string, offset: number): number => binary.charCodeAt(offset) | (binary.charCodeAt(offset + 1) << 8);

const readUint32 = (binary: string, offset: number): number => (readUint16(binary, offset) | (readUint16(binary, offset + 2) << 16)) >>> 0;

// o:gfxdata holds the shape as a small Office Open XML package (a ZIP). Bitmaps are usually stored uncompressed in it,
// which is the only case read here: inflating would need an asynchronous API.
const gfxdataPictureSource = (gfxdata: string): string | null => {
  let binary: string;
  try {
    binary = atob(gfxdata.replace(/\s+/g, ''));
  } catch {
    return null;
  }
  let offset = 0;
  while (offset + ZIP_LOCAL_HEADER_LENGTH <= binary.length && readUint32(binary, offset) === ZIP_LOCAL_HEADER_SIGNATURE) {
    const method = readUint16(binary, offset + 8);
    const size = readUint32(binary, offset + 18);
    const nameLength = readUint16(binary, offset + 26);
    const start = offset + ZIP_LOCAL_HEADER_LENGTH + nameLength + readUint16(binary, offset + 28);
    const extension = GFXDATA_MEDIA_PATTERN.exec(binary.slice(offset + ZIP_LOCAL_HEADER_LENGTH, offset + ZIP_LOCAL_HEADER_LENGTH + nameLength))?.[1];
    if (extension && method === ZIP_STORED && size > 0 && start + size <= binary.length) {
      const mimeType = extension.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${btoa(binary.slice(start, start + size))}`;
    }
    if (size === 0) return null;
    offset = start + size;
  }
  return null;
};

const lengthPx = (value: string): number | null => {
  const match = CSS_LENGTH_PATTERN.exec(value.trim());
  return match ? parseFloat(match[1]) * (PIXELS_PER_UNIT[(match[2] ?? 'px').toLowerCase()] ?? 1) : null;
};

// Width of the text column of the copied Word section, from its @page rule: page width minus side margins.
const wordColumnWidth = (doc: Document): number | null => {
  const rule = Array.from(doc.querySelectorAll('style')).map((style) => PAGE_RULE_PATTERN.exec(style.textContent ?? '')?.[1]).find(Boolean);
  if (!rule) return null;
  const pageWidth = lengthPx(/size\s*:\s*(\S+)/i.exec(rule)?.[1] ?? '');
  const margins = (/(?:^|;)\s*margin\s*:\s*([^;]+)/i.exec(rule)?.[1] ?? '').trim().split(/\s+/).map(lengthPx)
    .filter((margin): margin is number => margin !== null);
  if (!pageWidth || margins.length === 0) return null;
  // CSS margin shorthand: top, right, bottom, left, with right defaulting to top and left to right.
  const right = margins[1] ?? margins[0];
  const left = margins[3] ?? right;
  return pageWidth - left - right;
};

const shapeLength = (style: string, property: 'width' | 'height'): number | null => {
  const value = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(style)?.[1];
  const pixels = value ? lengthPx(value) : null;
  return pixels && pixels > 0 ? Math.round(pixels) : null;
};

interface VmlPictures {
  gfxdataSources: Map<Element, string>;
  fullWidth: Set<Element>;
  replaced: number;
}

// Word can describe a picture in VML alone, with no <img> fallback: with the "Rely on VML for displaying graphics
// in browsers" web option, and in Word for Mac. Each such shape is replaced by an <img> sized from the shape style.
// It also returns the pictures held by the shapes' o:gfxdata, when they can be read, and the pictures as wide as
// the Word column: those span the editor once their size has served to find their picture.
const replaceVmlPictures = (doc: Document): VmlPictures => {
  const gfxdataSources = new Map<Element, string>();
  const fullWidth = new Set<Element>();
  const columnWidth = wordColumnWidth(doc);
  let replaced = 0;
  const referencedShapes = new Set(
    Array.from(doc.querySelectorAll('img')).flatMap((image) => (image.getAttribute('v:shapes') ?? '').split(/\s+/).filter(Boolean)),
  );
  doc.querySelectorAll(VML_SHAPE_SELECTOR).forEach((shape) => {
    const source = shape.querySelector(VML_IMAGE_DATA_SELECTOR)?.getAttribute('src');
    if (!source || referencedShapes.has(shape.getAttribute('id') ?? '')) return;
    const image = doc.createElement('img');
    image.setAttribute('src', source);
    const style = shape.getAttribute('style') ?? '';
    const width = shapeLength(style, 'width');
    const height = shapeLength(style, 'height');
    if (width && height) {
      image.setAttribute('width', String(width));
      image.setAttribute('height', String(height));
      if (columnWidth && width >= columnWidth * FULL_WIDTH_RATIO) fullWidth.add(image);
    }
    const alt = shape.getAttribute('alt');
    if (alt) image.setAttribute('alt', alt);
    const gfxdata = shape.getAttribute('o:gfxdata');
    const gfxdataSource = gfxdata ? gfxdataPictureSource(gfxdata) : null;
    if (gfxdataSource) gfxdataSources.set(image, gfxdataSource);
    shape.replaceWith(image);
    replaced += 1;
  });
  return { gfxdataSources, fullWidth, replaced };
};

// What is left of VML once its pictures are taken out (drawn shapes, text boxes, shape types) is removed:
// Word shows that content positioned over the page, and outside Word it only adds stray blocks.
const removeVmlElements = (doc: Document): boolean => {
  const elements = Array.from(doc.body.querySelectorAll('*')).filter((element) => element.tagName.startsWith(VML_TAG_PREFIX));
  elements.forEach((element) => element.remove());
  return elements.length > 0;
};

export interface PasteReport {
  // Pictures dropped because the clipboard held no RTF to take them from (Word for Mac): the user should be told.
  // Pictures missing from an RTF that exists are drawn shapes, dropped on purpose, and are not counted.
  lostPictures: number;
}

export const embedWordImages = (html: string, rtf: string, report?: PasteReport): string => {
  const hasVml = VML_ELEMENT_PATTERN.test(html);
  if (!hasVml && !HTML_LOCAL_IMAGE_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const { gfxdataSources, fullWidth, replaced } = replaceVmlPictures(doc);
  const vmlChanged = removeVmlElements(doc) || replaced > 0;
  const images = Array.from(doc.querySelectorAll('img'));
  if (!images.some(isLocalImage)) return vmlChanged ? doc.documentElement.outerHTML : html;
  const pictures = extractRtfPictures(rtf);
  let next = 0;
  images.forEach((image) => {
    const found = pictures.findIndex((picture, index) => index >= next && sizesMatch(picture, image));
    if (found >= 0) next = found + 1;
    if (!isLocalImage(image)) return;
    const source = gfxdataSources.get(image) ?? (found >= 0 ? pictureSource(pictures[found]) : null);
    if (source) {
      image.setAttribute('src', source);
    } else {
      image.remove();
      if (report && rtf.trim() === '') report.lostPictures += 1;
    }
  });
  fullWidth.forEach((image) => {
    image.removeAttribute('width');
    image.removeAttribute('height');
  });
  return doc.documentElement.outerHTML;
};

// \s also matches the non-breaking spaces Word puts next to pictures.
const BLANK_TEXT_PATTERN = /^\s*$/;

const isBlankBetween = (doc: Document, setBoundaries: (range: Range) => void): boolean => {
  const range = doc.createRange();
  setBoundaries(range);
  return BLANK_TEXT_PATTERN.test(range.toString());
};

// Word puts each picture in a paragraph. The editor shows pictures as blocks, so the paragraph would be split around
// its picture and leave an empty paragraph behind. A picture that opens or closes its paragraph moves out before
// or after it, and a paragraph left empty is removed. In a list item the picture stays: an item has
// to start with a paragraph.
export const liftPictureParagraphs = (html: string): string => {
  if (!/<img\b/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;
  doc.body.querySelectorAll('p').forEach((paragraph) => {
    if (paragraph.closest('li')) return;
    const pictures = Array.from(paragraph.querySelectorAll('img'));
    if (pictures.length === 0) return;
    const before = pictures.filter((picture) => isBlankBetween(doc, (range) => {
      range.setStart(paragraph, 0);
      range.setEndBefore(picture);
    }));
    const after = pictures.filter((picture) => !before.includes(picture) && isBlankBetween(doc, (range) => {
      range.setStartAfter(picture);
      range.setEnd(paragraph, paragraph.childNodes.length);
    }));
    if (before.length === 0 && after.length === 0) return;
    paragraph.before(...before);
    paragraph.after(...after);
    if (BLANK_TEXT_PATTERN.test(paragraph.textContent ?? '') && !paragraph.querySelector('img')) paragraph.remove();
    changed = true;
  });
  return changed ? doc.documentElement.outerHTML : html;
};
