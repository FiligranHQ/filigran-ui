/**
 * Unit tests for what the composer attaches - `yarn test`: the file types
 * `accept` takes, the limits, and the size a limit reads as.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { acceptsFile, admitFiles, refusalMessage, type AttachmentLimits } from './attachments.ts';
import { formatFileSize } from './index.ts';
import type { ChatFile } from '../types.ts';

const file = (name: string, size: number, type = '') => ({ name, size, type });
const LIMITS: AttachmentLimits = { maxFileCount: 3, maxTotalSize: 100, maxFileSize: Infinity };

test('accept reads extensions by the name, wildcards and types by the MIME type, any type when empty', () => {
  assert.ok(acceptsFile('.pdf, image/*', file('Report.PDF', 1)));
  assert.ok(acceptsFile('.pdf,image/*', file('shot', 1, 'image/png')));
  assert.ok(acceptsFile('text/csv', file('a.csv', 1, 'text/csv')));
  assert.ok(!acceptsFile('.pdf,image/*', file('run.exe', 1, 'application/x-msdownload')));
  assert.ok(!acceptsFile('text/csv', file('a.txt', 1, 'text/plain')));
  assert.ok(acceptsFile('', file('run.exe', 1)));
  assert.ok(acceptsFile(undefined, file('run.exe', 1)));
});

test('a file the browser gave no type passes a MIME token, and an extension token still decides it by name', () => {
  // Chrome on Windows leaves `.md` and `.yaml` untyped, though the picker offered them.
  assert.ok(acceptsFile('text/markdown', file('notes.md', 1)));
  assert.ok(acceptsFile('.pdf,text/*', file('config.yaml', 1)));
  assert.ok(!acceptsFile('.pdf', file('notes.md', 1)));
  assert.ok(acceptsFile('.md', file('notes.md', 1)));
  assert.ok(!acceptsFile('text/markdown', file('notes.md', 1, 'application/octet-stream')));
});

test('each file refused says why, and one too large for the room left keeps no smaller one after it out', () => {
  const attached = [{ name: 'a', type: '', size: 40 }] as ChatFile[];
  const incoming = [file('big', 70), file('small', 50), file('one-more', 1), file('past-count', 1)];
  const { accepted, refused } = admitFiles(attached, incoming, LIMITS);
  assert.deepEqual(
    accepted.map((f) => f.name),
    ['small', 'one-more'],
  );
  assert.deepEqual(
    refused.map(({ file: f, reason }) => [f.name, reason]),
    [
      ['big', 'total-size'],
      ['past-count', 'file-count'],
    ],
  );
});

test('the per-file limit and the type come before the count and the total', () => {
  const { accepted, refused } = admitFiles([], [file('huge', 60), file('run.exe', 1), file('ok.pdf', 50)], {
    ...LIMITS,
    maxFileSize: 55,
    accept: '.pdf',
  });
  assert.deepEqual(
    accepted.map((f) => f.name),
    ['ok.pdf'],
  );
  assert.deepEqual(
    refused.map(({ reason }) => reason),
    ['file-type', 'file-type'],
  );
  const sized = admitFiles([], [file('huge.pdf', 60), file('ok.pdf', 50)], { ...LIMITS, maxFileSize: 55, accept: '.pdf' });
  assert.deepEqual(
    sized.refused.map(({ file: f, reason }) => [f.name, reason]),
    [['huge.pdf', 'file-size']],
  );
});

test('a size reads as the transcript shows a file: bytes, whole KB, MB to one decimal', () => {
  assert.equal(formatFileSize(50 * 1024 * 1024), '50.0 MB');
  assert.equal(formatFileSize(1.5 * 1024 * 1024), '1.5 MB');
  assert.equal(formatFileSize(200 * 1024), '200 KB');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(0), '');
  assert.equal(formatFileSize(undefined), '');
});

test('the refusal names the file and the limit it went past', () => {
  const t = (key: string) => key;
  const limits = { ...LIMITS, maxFileSize: 10 * 1024 * 1024, maxTotalSize: 50 * 1024 * 1024 };
  assert.equal(refusalMessage(t, 'scan.iso', 'file-size', limits), 'scan.iso was not attached: a file may be at most 10.0 MB.');
  assert.equal(refusalMessage(t, 'b.pdf', 'total-size', limits), 'b.pdf was not attached: the files of a message may add up to at most 50.0 MB.');
  assert.equal(refusalMessage(t, 'c.pdf', 'file-count', limits), 'c.pdf was not attached: a message holds at most 3 files.');
  assert.equal(refusalMessage(t, 'run.exe', 'file-type', limits), 'run.exe was not attached: this type of file is not accepted.');
});
