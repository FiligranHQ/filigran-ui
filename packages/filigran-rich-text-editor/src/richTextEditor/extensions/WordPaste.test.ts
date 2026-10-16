import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseHtml } from '../paste/testDom.ts';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './editorExtensions.ts';

const png = (hex: string) => `data:image/png;base64,${Buffer.from(hex, 'hex').toString('base64')}`;

// Pastes through the editor view, as a browser Ctrl+V does: the plugin reads the RTF flavor from the paste event,
// then ProseMirror hands the HTML flavor to transformPastedHTML.
const paste = (flavors: Record<string, string>) => {
  const reports: number[] = [];
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({ element, extensions: createEditorExtensions({ placeholder: '', onPicturesLost: (count) => reports.push(count) }) });
  const event = new window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { types: Object.keys(flavors), items: [], files: [], getData: (type: string) => flavors[type] ?? '' },
  });
  editor.view.dom.dispatchEvent(event);
  const saved = editor.getHTML();
  editor.destroy();
  element.remove();
  return { saved, reports };
};

test('Word paste: a pasted Word picture is embedded from the RTF flavor of the same paste event', () => {
  const { saved, reports } = paste({
    'text/html': '<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><p class=MsoNormal>Text</p><p class=MsoNormal><img width=96 height=64 src="file:///C:/Temp/clip_image001.png"></p></body></html>',
    'text/rtf': '{\\rtf1{\\*\\shppict{\\pict\\picwgoal1440\\pichgoal960\\pngblip 89504e47}}}',
  });
  assert.equal(parseHtml(saved).querySelector('img')?.getAttribute('src'), png('89504e47'));
  assert.deepEqual(reports, [0]);
});

test('Word paste: pictures the clipboard does not hold are reported, and the next paste reports none', () => {
  const lost = paste({ 'text/html': '<p class=MsoNormal>Text <img width=96 height=64 src="file:///C:/Temp/clip_image001.png"></p>' });
  assert.equal(parseHtml(lost.saved).querySelector('img'), null);
  assert.deepEqual(lost.reports, [1]);
  assert.deepEqual(paste({ 'text/html': '<p>Plain text</p>' }).reports, [0]);
});
