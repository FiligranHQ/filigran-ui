import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { parseHtml } from './paste/testDom.ts';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions/editorExtensions.ts';

// Each fixture is HTML saved by an earlier editor, a fintel template, or this editor.
// <name>.expected.html is what getData() returns once it is loaded. Review any change to it:
// it changes the HTML stored in OpenCTI, its templates and its PDF exports.
// Run with UPDATE_FIXTURES=1 to rewrite the expected files.
const FIXTURES = new URL('./__fixtures__/existing/', import.meta.url);
const UPDATE = process.env.UPDATE_FIXTURES === '1';

const loadAndSave = (html: string): string => {
  const editor = new Editor({ extensions: createEditorExtensions({ placeholder: '' }), content: html });
  const saved = editor.getHTML();
  editor.destroy();
  return saved;
};

const readFixture = (name: string): string => readFileSync(new URL(name, FIXTURES), 'utf8');

const fixtures = readdirSync(FIXTURES).filter((name) => name.endsWith('.html') && !name.endsWith('.expected.html'));

fixtures.forEach((name) => {
  const expectedName = name.replace(/\.html$/, '.expected.html');

  test(`existing content: ${name} is saved as expected once loaded`, () => {
    const saved = loadAndSave(readFixture(name));
    if (UPDATE) writeFileSync(new URL(expectedName, FIXTURES), saved);
    assert.equal(saved, readFixture(expectedName));
  });

  test(`existing content: ${name} does not change when it is loaded and saved again`, () => {
    const expected = readFixture(expectedName);
    assert.equal(loadAndSave(expected), expected);
  });
});

test('existing content: a checked task of a legacy to-do list stays checked', () => {
  const saved = parseHtml(loadAndSave(readFixture('legacy-task-list.html')));
  const tasks = Array.from(saved.querySelectorAll('li[data-type="taskItem"]'), (task) => [task.textContent, task.getAttribute('data-checked')]);
  assert.deepEqual(tasks, [['Done task', 'true'], ['Open task', 'false']]);
});

test('existing content: a legacy table keeps its header row and its border', () => {
  const table = parseHtml(loadAndSave(readFixture('legacy-tables.html'))).querySelector('table') as HTMLTableElement;
  assert.equal(table.tHead?.rows.length, 1);
  assert.equal(table.tBodies[0].rows.length, 3);
  // Its pure black border follows the text color, so it stays visible in the dark theme.
  assert.match(table.getAttribute('style') ?? '', /border-width: 1px; border-style: solid; border-color: currentcolor/);
});

test('existing content: links are saved without a theme color', () => {
  const saved = loadAndSave('<p><a href="https://example.com" style="color: #00b1ff">link</a></p>');
  assert.equal(saved, '<p><a target="_blank" rel="noopener noreferrer" href="https://example.com">link</a></p>');
});

test('existing content: the list indentation and bullet style of a stored list are kept', () => {
  const saved = loadAndSave('<ul style="margin-left:32px;list-style-type:square;"><li>Item</li></ul>');
  assert.equal(saved, '<ul style="margin-left: 32px; list-style-type: square;"><li><p>Item</p></li></ul>');
  assert.equal(loadAndSave(saved), saved);
});

test('existing content: a span whose style the editor does not keep is not saved as a bare span', () => {
  assert.equal(loadAndSave('<p><span style="mso-bookmark:OLE_LINK1">Text</span> <span style="color: #ff0000">red</span></p>'),
    '<p>Text <span style="color: rgb(255, 0, 0);">red</span></p>');
});

test('existing content: a span styled with the font shorthand keeps its font family and size', () => {
  const span = parseHtml(loadAndSave('<p><span style="font: 12px Arial">Text</span></p>')).querySelector('span');
  assert.equal(span?.style.fontSize, '12px');
  assert.equal(span?.style.fontFamily, 'Arial');
});
