import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseHtml } from './testDom.ts';
import { transformWordHtml } from './wordPaste.ts';

const wordWebFixture = readFileSync(new URL('./__fixtures__/word-web.html', import.meta.url), 'utf8');
const wordWeb = transformWordHtml(wordWebFixture, '');
const wordWebDocument = parseHtml(wordWeb);

test('Word for the web: headings are rebuilt from role="heading" and aria-level', () => {
  const headings = Array.from(wordWebDocument.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) => heading.tagName);
  assert.deepEqual(headings, ['H1', 'H2', 'H2']);
});

test('Word for the web: consecutive list containers become one list', () => {
  const lists = wordWebDocument.querySelectorAll('ul, ol');
  assert.equal(lists.length, 1);
  assert.equal(lists[0].tagName, 'UL');
  assert.equal(lists[0].querySelectorAll(':scope > li').length, 7);
  assert.equal(wordWebDocument.querySelectorAll('li[data-aria-level]').length, 0);
});

test('Word for the web: layout wrappers and hidden elements are removed', () => {
  assert.equal(wordWebDocument.querySelectorAll('div').length, 0);
  assert.equal(wordWebDocument.querySelectorAll('.EOP, .WACAltTextDescribedBy').length, 0);
});

test('Word for the web: only meaningful styles are kept', () => {
  assert.doesNotMatch(wordWeb, /!important|user-select|z-index|position:|font-family/);
  assert.doesNotMatch(wordWeb, /(?<![-\w])color: (?:rgb\(0, 0, 0\)|windowtext)/);
  assert.equal(wordWebDocument.querySelector('table')?.getAttribute('style'), null);
  const headerCell = wordWebDocument.querySelector('td');
  assert.equal(headerCell?.style.backgroundColor, 'rgb(31, 56, 100)');
  assert.equal(headerCell?.style.width, '186px');
  assert.equal(headerCell?.style.borderTopStyle, 'solid');
});

test('Word for the web: pasted images keep their embedded data', () => {
  assert.match(wordWebDocument.querySelector('img')?.getAttribute('src') ?? '', /^data:image\/png;base64,/);
});

test('Word desktop: mso-list paragraphs become nested lists without typed-out markers', () => {
  const marker = (text: string) => `<![if !supportLists]><span style='mso-list:Ignore'>${text}<span>&nbsp;</span></span><![endif]>`;
  const html = `<p class=MsoListParagraph style='mso-list:l0 level1 lfo1'>${marker('1.')}One</p>`
    + `<p class=MsoListParagraph style='mso-list:l0 level2 lfo1'>${marker('o')}Nested</p>`;
  assert.equal(parseHtml(transformWordHtml(html, '')).body.innerHTML, '<ol><li><p>One</p><ul><li><p>Nested</p></li></ul></li></ol>');
});

test('Word desktop: local pictures are embedded from the RTF flavor, skipping alternative renderings', () => {
  const html = '<p class=MsoNormal>Text <img src="file:///C:/Temp/msohtmlclip1/01/clip_image001.png"></p>';
  const rtf = '{\\rtf1{\\*\\shppict{\\pict{\\*\\blipuid 0011}\\pngblip 89504e47\r\n0d0a1a0a}}{\\nonshppict{\\pict\\wmetafile8 01000900}}}';
  const source = parseHtml(transformWordHtml(html, rtf)).querySelector('img')?.getAttribute('src');
  assert.equal(source, `data:image/png;base64,${Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')}`);
});
