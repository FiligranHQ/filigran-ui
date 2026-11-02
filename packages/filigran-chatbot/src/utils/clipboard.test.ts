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
    files: [new File(['x'], 'image.png', { type: 'image/png' })],
    getData: () => {
      throw new Error('denied');
    },
  };
  assert.deepEqual(
    clipboardFiles(throwing).map((f) => f.name),
    ['image.png'],
  );
});

test('what HTML shows: entities of a space, comments and hidden blocks show nothing; a stray < or an unclosed style shows text', () => {
  const picture = () => new File(['x'], 'image.png', { type: 'image/png' });
  const attached = (html: string) =>
    clipboardFiles({ files: [picture()], getData: (f) => (f === 'text/plain' ? 'caption' : f === 'text/html' ? html : '') }).length;
  assert.equal(attached('<p>&nbsp;&#160;&#xA0;</p><!-- a -->'), 1);
  assert.equal(attached('<HEAD><Title>t</TITLE></head><img src="a.png" alt=\'b > c\'>'), 1);
  assert.equal(attached('<p>1 < 2</p>'), 0);
  assert.equal(attached('<style>p { color: red }'), 0);
  assert.equal(attached('<script>x</script><script>y</script><p>z</p>'), 0);
});
