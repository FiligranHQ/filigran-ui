interface RtfPicture {
  mimeType: string | null;
  hex: string[];
  lossy: boolean;
  widthTwips: number | null;
  heightTwips: number | null;
  scaleX: number;
  scaleY: number;
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
        group.picture = { mimeType: null, hex: [], lossy: false, widthTwips: null, heightTwips: null, scaleX: 100, scaleY: 100 };
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
  const pictureWidth = (picture.widthTwips * picture.scaleX) / 100 / TWIPS_PER_PIXEL;
  const pictureHeight = (picture.heightTwips * picture.scaleY) / 100 / TWIPS_PER_PIXEL;
  return relativeGap(width, pictureWidth) <= SIZE_TOLERANCE && relativeGap(height, pictureHeight) <= SIZE_TOLERANCE;
};

const pictureSource = ({ mimeType, hex, lossy }: RtfPicture): string | null => {
  const data = hex.join('');
  return mimeType && data && !lossy ? `data:${mimeType};base64,${hexToBase64(data)}` : null;
};

export const embedWordImages = (html: string, rtf: string): string => {
  if (!rtf || !HTML_LOCAL_IMAGE_PATTERN.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));
  if (!images.some(isLocalImage)) return html;
  const pictures = extractRtfPictures(rtf);
  let next = 0;
  images.forEach((image) => {
    const found = pictures.findIndex((picture, index) => index >= next && sizesMatch(picture, image));
    if (found >= 0) next = found + 1;
    if (!isLocalImage(image)) return;
    const source = found >= 0 ? pictureSource(pictures[found]) : null;
    if (source) {
      image.setAttribute('src', source);
    } else {
      image.remove();
    }
  });
  return doc.documentElement.outerHTML;
};
