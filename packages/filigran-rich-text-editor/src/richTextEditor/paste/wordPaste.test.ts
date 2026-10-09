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

test('Word desktop: a marker held entirely inside a supportLists comment still sets the list type and start', () => {
  const html = "<p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><!--[if !supportLists]><span style='mso-list:Ignore'>3.<span>&nbsp;</span></span><![endif]-->Three</p>";
  assert.equal(parseHtml(transformWordHtml(html, '')).body.innerHTML, '<ol start="3"><li><p>Three</p></li></ol>');
});

test('Word desktop: list instances sharing a definition but not an lfo stay separate lists', () => {
  const marker = (text: string) => `<![if !supportLists]><span style='mso-list:Ignore'>${text}<span>&nbsp;</span></span><![endif]>`;
  const item = (lfo: string, text: string, content: string) => `<p class=MsoListParagraph style='mso-list:l0 level1 ${lfo}'>${marker(text)}${content}</p>`;
  const html = item('lfo1', '1.', 'A') + item('lfo1', '2.', 'B') + item('lfo2', '1.', 'C');
  assert.equal(parseHtml(transformWordHtml(html, '')).body.innerHTML, '<ol><li><p>A</p></li><li><p>B</p></li></ol><ol><li><p>C</p></li></ol>');
});

test('Word desktop: a negative RTF binary length does not stall the picture scan', () => {
  const html = '<p class=MsoNormal><img src="file:///C:/Temp/clip_image001.png"></p>';
  const source = parseHtml(transformWordHtml(html, '{\\rtf1{\\pict\\pngblip\\bin-7 89504e47}}')).querySelector('img')?.getAttribute('src');
  assert.equal(source, `data:image/png;base64,${Buffer.from('89504e47', 'hex').toString('base64')}`);
});

test('Word for the web: rebuilt ordered lists keep their numbering style', () => {
  const list = (attributes: string) => `<div class="ListContainerWrapper"><ol class="NumberListStyle1" role="list" ${attributes}>`
    + '<li data-aria-level="1" data-listid="5" class="OutlineElement"><p class="Paragraph"><span class="TextRun">Item</span></p></li></ol></div>';
  const fromAttribute = parseHtml(transformWordHtml(list('type="a"'), '')).querySelector('ol');
  const fromStyle = parseHtml(transformWordHtml(list('style="list-style-type: upper-roman"'), '')).querySelector('ol');
  assert.equal(fromAttribute?.getAttribute('type'), 'a');
  assert.equal(fromStyle?.getAttribute('type'), 'I');
});

test('Word desktop: binary RTF picture payloads are embedded, and pictures altered on the clipboard are dropped', () => {
  const html = '<p class=MsoNormal><img src="file:///C:/Temp/clip_image001.png"></p>';
  const header = Buffer.from('89504e470d0a1a0a', 'hex');
  const binary = String.fromCharCode(...header);
  const embedded = parseHtml(transformWordHtml(html, `{\\rtf1{\\pict\\pngblip\\bin${header.length} ${binary}}}`)).querySelector('img');
  assert.equal(embedded?.getAttribute('src'), `data:image/png;base64,${header.toString('base64')}`);
  const altered = parseHtml(transformWordHtml(html, `{\\rtf1{\\pict\\pngblip\\bin2 \u20ac\u20ac}}`)).querySelector('img');
  assert.equal(altered, null);
});

const png = (hex: string) => `data:image/png;base64,${Buffer.from(hex, 'hex').toString('base64')}`;

test('Word desktop: a drawn shape without a bitmap is dropped instead of receiving another picture', () => {
  const html = `<p class=MsoNormal><img width=96 height=64 src="${png('89504e47')}"> <img width=200 height=100 src="file:///C:/Temp/clip_image002.png"></p>`;
  const rtf = '{\\rtf1{\\*\\shppict{\\pict\\picwgoal1440\\pichgoal960\\pngblip 89504e47}}{\\nonshppict{\\pict\\wmetafile8 0100}}}';
  const sources = Array.from(parseHtml(transformWordHtml(html, rtf)).querySelectorAll('img')).map((image) => image.getAttribute('src'));
  assert.deepEqual(sources, [png('89504e47')]);
});

test('Word desktop: a floating picture is embedded from its shape, skipping the shape result rendering', () => {
  const html = `<p class=MsoNormal><img width=200 height=100 src="file:///C:/Temp/clip_image001.png"> <img width=96 height=64 src="${png('89504e48')}"></p>`;
  const rtf = '{\\rtf1{\\shp{\\*\\shpinst{\\sp{\\sn pib}{\\sv {\\pict\\picwgoal3000\\pichgoal1500\\pngblip 89504e47}}}}{\\shprslt{\\pict\\wmetafile8 0100}}}'
    + '{\\*\\shppict{\\pict\\picwgoal1440\\pichgoal960\\pngblip 89504e48}}{\\nonshppict{\\pict\\wmetafile8 0100}}}';
  const sources = Array.from(parseHtml(transformWordHtml(html, rtf)).querySelectorAll('img')).map((image) => image.getAttribute('src'));
  assert.deepEqual(sources, [png('89504e47'), png('89504e48')]);
});

test('Word desktop: HTML without a local picture is returned as is, whatever the RTF', () => {
  const html = `<p class=MsoNormal><!--[if gte vml 1]><v:imagedata src="file:///C:/Temp/clip_image001.png"/><![endif]--><img src="${png('89504e47')}"></p>`;
  assert.equal(transformWordHtml(html, '{\\rtf1{\\pict\\pngblip 00}}'), html);
});

test('Word for the web: underline and strikethrough are kept as text-decoration', () => {
  const html = '<div class="OutlineElement"><p class="Paragraph"><span class="TextRun" style="text-decoration: underline;">under</span>'
    + '<span class="TextRun" style="text-decoration: line-through;">struck</span></p></div>';
  const spans = Array.from(parseHtml(transformWordHtml(html, '')).querySelectorAll('span')).map((span) => span.getAttribute('style'));
  assert.deepEqual(spans, ['text-decoration: underline', 'text-decoration: line-through']);
  assert.match(wordWeb, /text-decoration: underline/);
});

const wordMacFixture = readFileSync(new URL('./__fixtures__/word-mac.html', import.meta.url), 'utf8');
const wordMac = parseHtml(transformWordHtml(wordMacFixture, ''));

test('Word desktop for Mac: headings, mso-list paragraphs and table shading are kept', () => {
  assert.equal(wordMac.querySelectorAll('h1').length, 1);
  assert.equal(wordMac.querySelectorAll('h4').length, 1);
  assert.equal(wordMac.querySelectorAll('p[style*="mso-list"]').length, 0);
  assert.ok(wordMac.querySelectorAll('li').length > 0);
  assert.ok(Array.from(wordMac.querySelectorAll('td')).some((cell) => /#A100FF/i.test(cell.getAttribute('style') ?? '')));
});

test('Word desktop for Mac: review comments are not pasted', () => {
  assert.equal(wordMac.querySelectorAll('a[href^="#_msocom"], [style*="mso-element:comment"]').length, 0);
});

test('Word desktop for Mac: a list written directly inside a list is nested in the previous item', () => {
  assert.equal(wordMac.querySelectorAll('ul > ul, ul > ol, ol > ul, ol > ol').length, 0);
  assert.equal(Array.from(wordMac.querySelectorAll('li')).filter((item) => ['UL', 'OL'].includes(item.firstElementChild?.tagName ?? '')).length, 0);
});

test('Word desktop for Mac: a VML picture is embedded from its o:gfxdata', { todo: 'VML pictures are not converted' }, () => {
  assert.match(wordMac.querySelector('img')?.getAttribute('src') ?? '', /^data:image\/png;base64,/);
});

test('Word desktop: removing review comments keeps the commented text', () => {
  const html = "<p class=MsoNormal><span style='mso-comment-continuation:1'>Kept text</span>"
    + "<span class=MsoCommentReference><![if !supportAnnotations]><a class=msocomanchor href=\"#_msocom_1\" name=\"_msoanchor_1\">[AB1]</a><![endif]>"
    + "<span style='mso-special-character:comment'>&nbsp;</span></span></p>"
    + "<div style='mso-element:comment-list'><div style='mso-element:comment'><p class=MsoCommentText>Reviewer remark</p></div></div>";
  assert.equal(parseHtml(transformWordHtml(html, '')).body.textContent, 'Kept text');
});

test('lists written directly inside a list are nested in the previous item, or in a new item when there is none', () => {
  const html = '<ul><ul><li>Orphan</li></ul><li>One</li><span style="mso-bookmark:OLE_LINK1"></span><ol><li>One.a</li></ol><li>Two</li></ul>';
  assert.equal(parseHtml(transformWordHtml(html, '')).body.innerHTML,
    '<ul><li><ul><li>Orphan</li></ul></li><li>One<ol><li>One.a</li></ol></li><span style="mso-bookmark:OLE_LINK1"></span><li>Two</li></ul>');
});
