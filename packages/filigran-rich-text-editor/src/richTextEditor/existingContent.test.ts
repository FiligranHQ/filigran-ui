import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { parseHtml } from './paste/testDom.ts';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions/editorExtensions.ts';

// Each fixture is HTML saved by an earlier editor (CKEditor, a fintel template, or this editor).
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

test('existing content: a task checked in CKEditor stays checked', () => {
  const saved = parseHtml(loadAndSave(readFixture('ckeditor-task-list.html')));
  const tasks = Array.from(saved.querySelectorAll('li[data-type="taskItem"]'), (task) => [task.textContent, task.getAttribute('data-checked')]);
  assert.deepEqual(tasks, [['Done task', 'true'], ['Open task', 'false']]);
});

test('existing content: a CKEditor table keeps its header row and its border', () => {
  const table = parseHtml(loadAndSave(readFixture('ckeditor-tables.html'))).querySelector('table') as HTMLTableElement;
  assert.equal(table.tHead?.rows.length, 1);
  assert.equal(table.tBodies[0].rows.length, 3);
  assert.equal(table.style.borderTop, '1px solid rgb(0, 0, 0)');
});

test('existing content: links are saved without a theme color', () => {
  const saved = loadAndSave('<p><a href="https://example.com" style="color: #00b1ff">link</a></p>');
  assert.equal(saved, '<p><a target="_blank" rel="noopener noreferrer" href="https://example.com">link</a></p>');
});
