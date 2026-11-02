/**
 * Unit tests for what the composer attaches - `yarn test`: the file types
 * `accept` takes, the limits, and the size a limit reads as.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { acceptsFile, admitFiles, formatByteLimit, refusalMessage, type AttachmentLimits } from './attachments.ts';
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

test('a limit reads in the largest unit it fills, without a trailing .0', () => {
  assert.equal(formatByteLimit(50 * 1024 * 1024), '50 MB');
  assert.equal(formatByteLimit(1.5 * 1024 ** 3), '1.5 GB');
  assert.equal(formatByteLimit(200 * 1024), '200 KB');
  assert.equal(formatByteLimit(512), '512 B');
});

test('the refusal names the file and the limit it went past', () => {
  const t = (key: string) => key;
  const limits = { ...LIMITS, maxFileSize: 10 * 1024 * 1024, maxTotalSize: 50 * 1024 * 1024 };
  assert.equal(refusalMessage(t, 'scan.iso', 'file-size', limits), 'scan.iso was not attached: a file may be at most 10 MB.');
  assert.equal(refusalMessage(t, 'b.pdf', 'total-size', limits), 'b.pdf was not attached: the files of a message may add up to at most 50 MB.');
  assert.equal(refusalMessage(t, 'c.pdf', 'file-count', limits), 'c.pdf was not attached: a message holds at most 3 files.');
  assert.equal(refusalMessage(t, 'run.exe', 'file-type', limits), 'run.exe was not attached: this type of file is not accepted.');
});
