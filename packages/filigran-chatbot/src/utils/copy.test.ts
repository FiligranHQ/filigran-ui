/**
 * Copy out of the transcript and paste into the composer - `yarn test`.
 * A triple-click on a message's last paragraph selects up to the start of the
 * next block, and the browser writes every block boundary it crosses as a line
 * break: Sam pasted a sentence followed by five or six empty lines.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installDom } from '../../test/dom.ts';
import { cleanCopiedText, copyTranscriptSelection, pastedText, spliceText, trimBlankLines } from './copy.ts';

installDom();

test('a selection ending on a block copies its text alone, without the blank lines after it', () => {
  assert.equal(cleanCopiedText('The last sentence of the answer.\n\n\n\n\n\n'), 'The last sentence of the answer.');
  assert.equal(cleanCopiedText('\r\n\r\nA list item\r\n \r\n\u00a0\r\n'), 'A list item');
  assert.equal(cleanCopiedText('One cell\t\n\n'), 'One cell\t', 'a tab inside the line is kept');
});

test('paragraphs keep one blank line between them, and a code block keeps its indentation', () => {
  assert.equal(cleanCopiedText('First paragraph.\n\n\n\nSecond paragraph.\n\n'), 'First paragraph.\n\nSecond paragraph.');
  assert.equal(cleanCopiedText('def f():\n    return 1\n\n\n'), 'def f():\n    return 1');
  assert.equal(trimBlankLines('\n\n  indented first line\nend\n\n'), '  indented first line\nend');
});

test('a paste inserts the clipboard without the line breaks that close it; a clean one is left to the browser', () => {
  assert.equal(pastedText('The sentence.\n\n\n\n\n'), 'The sentence.');
  assert.equal(pastedText('\n\nThe sentence.\r\n\r\n'), 'The sentence.');
  assert.equal(pastedText('The sentence.'), null);
  assert.equal(pastedText('Line one\nline two'), null);
  assert.equal(pastedText(''), null);
});

test('the pasted text replaces the selection of the draft and the caret lands after it', () => {
  assert.deepEqual(spliceText('Hello world', 6, 11, 'there'), { value: 'Hello there', caret: 11 });
  assert.deepEqual(spliceText('Typed ', 6, 6, 'pasted'), { value: 'Typed pasted', caret: 12 });
  assert.deepEqual(spliceText('abc', 10, 20, 'd'), { value: 'abcd', caret: 4 });
});

/** A `copy` event on *root* whose selection is *range*; what it wrote. */
function copyFrom(root: HTMLElement, select: (range: Range) => void, target: EventTarget = root) {
  const range = document.createRange();
  select(range);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const written: Record<string, string> = {};
  let prevented = false;
  const handled = copyTranscriptSelection({
    target,
    currentTarget: root,
    clipboardData: { setData: (format: string, value: string) => void (written[format] = value) } as unknown as DataTransfer,
    preventDefault: () => void (prevented = true),
  });
  return { handled, prevented, written };
}

test('a copy out of the transcript leaves the time, the buttons and the screen-reader labels out of the HTML', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<div><p id="last">The last sentence.</p></div>' +
    '<div class="select-none"><time><span aria-hidden="true">20:21</span><span class="sr-only">10 Nov 2026 20:21</span></time><button>Copy response</button></div>';
  document.body.appendChild(root);
  try {
    const { handled, prevented, written } = copyFrom(root, (range) => range.selectNodeContents(root));
    assert.ok(handled && prevented, 'the transcript writes the clipboard itself');
    assert.equal(written['text/plain'], cleanCopiedText(document.getSelection()!.toString()));
    assert.ok(!/\n$/.test(written['text/plain']), 'no line break closes the text');
    assert.match(written['text/html'], /The last sentence\./);
    assert.doesNotMatch(written['text/html'], /20:21|Copy response|<button|<time/);
  } finally {
    root.remove();
  }
});

test('nothing selected, or a selection in a field, is left to the browser', () => {
  const root = document.createElement('div');
  root.innerHTML = '<p>Text</p><textarea>comment</textarea>';
  document.body.appendChild(root);
  try {
    assert.equal(copyFrom(root, (range) => range.setStart(root, 0)).handled, false, 'a collapsed selection');
    const field = root.querySelector('textarea')!;
    assert.equal(copyFrom(root, (range) => range.selectNodeContents(root), field).handled, false, 'the feedback comment');
  } finally {
    root.remove();
  }
});
