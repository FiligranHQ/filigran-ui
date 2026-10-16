import { test } from 'node:test';
import assert from 'node:assert/strict';

import './testDom.ts';
import { clipboardImageFile, hasTextContent } from './clipboardImage.ts';

const picture = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'image.png', { type: 'image/png' });

const clipboard = (html: string, files: File[] = [picture]) => ({
  getData: (type: string) => (type === 'text/html' ? html : ''),
  items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })) as unknown as DataTransferItemList,
});

test('paste: HTML holding text is pasted, even when the clipboard also holds a picture of the selection', () => {
  assert.equal(clipboardImageFile(clipboard('<p>Hello <strong>bold</strong></p>')), null);
  assert.equal(clipboardImageFile(clipboard('<table><tr><td>Excel cell</td></tr></table>')), null);
});

test('paste: the picture is pasted when the HTML is missing or only wraps a picture', () => {
  assert.equal(clipboardImageFile(clipboard('')), picture);
  assert.equal(clipboardImageFile(clipboard('<img src="https://example.com/a.png">')), picture);
  assert.equal(clipboardImageFile(clipboard('<p class=MsoNormal><img src="file:///C:/Temp/clip_image001.png"></p>')), picture);
  assert.equal(clipboardImageFile(clipboard('', [])), null);
});

test('paste: style and script blocks are not text', () => {
  assert.equal(hasTextContent('<body><img src="a.png"><style>p { color: red }</style></body>'), false);
  assert.equal(hasTextContent('<body><p>Text</p><style>p { color: red }</style></body>'), true);
});
