import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clipboardFiles, type ClipboardPayload } from './clipboard.ts';
import { clipboardOf, PASTE_CASES } from '../../test/clipboard.ts';

for (const c of PASTE_CASES) {
  test(`a paste attaches what it should: ${c.name}`, () => {
    assert.deepEqual(
      clipboardFiles(clipboardOf(c)).map((f) => f.name),
      c.attached,
    );
  });
}

test('a clipboard that cannot be read attaches nothing, and text that cannot be read holds back no file', () => {
  assert.deepEqual(clipboardFiles(null), []);
  const throwing: ClipboardPayload = {
    items: [{ kind: 'file', type: 'image/png', getAsFile: () => new File(['x'], 'image.png', { type: 'image/png' }) }],
    getData: () => {
      throw new Error('denied');
    },
  };
  assert.deepEqual(
    clipboardFiles(throwing).map((f) => f.name),
    ['image.png'],
  );
});
