/**
 * Unit tests for the markers of an answer and the artifact cards - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChatArtifact } from '../types.ts';
import {
  answerMarkdownSources,
  artifactDownloadLabel,
  artifactFacts,
  artifactFileExtension,
  artifactKey,
  artifactLink,
  filenameFromContentDisposition,
  formatVideoDuration,
  isRenderInProgress,
  splitAnswerMarkers,
  stripAnswerMarkers,
  videoRenderLabel,
} from './index.ts';

const DECK = '11111111-1111-4111-8111-111111111111';
const t = (key: string) => key;

test('an answer splits into prose, file and artifact parts in source order', () => {
  const parts = splitAnswerMarkers(`Deck [[PRESENTATION:${DECK.toUpperCase()}#/s-2]] then [[FILE:f1]] and [[report:R1]] and [[VIDEO:v1]] end`);
  assert.deepEqual(parts, [
    { type: 'text', value: 'Deck ' },
    { type: 'artifact', kind: 'presentation', id: DECK, slideRef: 's-2' },
    { type: 'text', value: ' then ' },
    { type: 'file', fileId: 'f1' },
    { type: 'text', value: ' and ' },
    { type: 'artifact', kind: 'report', id: 'r1', slideRef: undefined },
    { type: 'text', value: ' and ' },
    { type: 'artifact', kind: 'video', id: 'v1', slideRef: undefined },
    { type: 'text', value: ' end' },
  ]);
});

test('a marker cut short at the end of a streamed answer never shows', () => {
  for (const tail of ['[[VIDEO', '[[PRESENTATION:', `[[REPORT:${DECK}`, '[[FILE:abc]']) {
    assert.deepEqual(splitAnswerMarkers(`Working on it ${tail}`), [{ type: 'text', value: 'Working on it ' }], tail);
  }
  assert.equal(stripAnswerMarkers('Rendering [[VIDEO:abc'), 'Rendering');
});

test('copy and read aloud skip every marker, and ordinary prose is left untouched', () => {
  assert.equal(stripAnswerMarkers(`Here is the deck.\n\n[[PRESENTATION:${DECK}]]\n\n[[FILE:a]]`), 'Here is the deck.');
  assert.equal(stripAnswerMarkers('  indented\n'), '  indented\n');
  assert.deepEqual(answerMarkdownSources(`First.[[REPORT:${DECK}]]Second`), ['First.', 'Second']);
});

test('a marker finds its descriptor whatever the case of its id', () => {
  assert.equal(artifactKey('presentation', DECK.toUpperCase()), `presentation:${DECK}`);
});

const video = (fields: Partial<ChatArtifact>): ChatArtifact => ({ kind: 'video', id: 'v', title: 'Film', downloads: [], ...fields });

test('a card says what it holds', () => {
  assert.equal(artifactFacts({ kind: 'presentation', id: 'p', title: 'D', slideCount: 7, downloads: [] }, t), '7 slides');
  assert.equal(artifactFacts({ kind: 'report', id: 'r', title: 'R', sectionCount: 9, downloads: [] }, t), '9 sections');
  assert.equal(artifactFacts(video({ sceneCount: 6, durationMs: 65000 }), t), '6 scenes · 1:05');
  assert.equal(artifactFacts(video({}), t), '');
  assert.equal(formatVideoDuration(0), undefined);
  assert.equal(formatVideoDuration(9400), '0:09');
});

test('a video card follows its render and says when it cannot be downloaded', () => {
  assert.equal(isRenderInProgress(video({ status: 'running' })), true);
  assert.equal(isRenderInProgress(video({ status: 'pending' })), true);
  assert.equal(isRenderInProgress(video({ status: 'ready', downloads: ['mp4'] })), false);
  assert.equal(isRenderInProgress({ kind: 'report', id: 'r', title: 'R', status: 'running', downloads: [] }), false);
  assert.equal(videoRenderLabel(video({ status: 'running', progress: 41.6 }), t), 'Rendering 42%');
  assert.equal(videoRenderLabel(video({ status: 'pending' }), t), 'Waiting to render');
  assert.equal(videoRenderLabel(video({ status: 'ready', downloads: ['mp4'] }), t), undefined);
  assert.equal(videoRenderLabel(video({ status: 'failed', downloads: ['mp4'] }), t), undefined, 'an older render still plays');
  assert.equal(videoRenderLabel(video({ status: 'failed' }), t), 'The render did not finish');
  assert.equal(videoRenderLabel(video({}), t), 'Not rendered yet');
});

test('downloads are labelled and saved with the right extension', () => {
  assert.deepEqual(
    ['pdf', 'pptx', 'pptx_native', 'mp4', 'odp'].map((f) => artifactDownloadLabel(f, t)),
    ['PDF', 'PowerPoint', 'PowerPoint (editable)', 'MP4', 'ODP'],
  );
  assert.equal(artifactFileExtension('pptx_native'), 'pptx');
  assert.equal(artifactFileExtension('mp4'), 'mp4');
});

test('only an http(s) page is linked', () => {
  assert.equal(artifactLink(video({ url: 'https://xtm.example/videos/v' })), 'https://xtm.example/videos/v');
  assert.equal(artifactLink(video({ url: 'javascript:alert(1)' })), undefined);
  assert.equal(artifactLink(video({ url: '/videos/v' })), undefined);
  assert.equal(artifactLink(video({})), undefined);
});

test('the saved name is read from Content-Disposition', () => {
  assert.equal(
    filenameFromContentDisposition(`attachment; filename="Q3 readout.pdf"; filename*=UTF-8''Q3%20readout%20%C3%A9t%C3%A9.pdf`),
    'Q3 readout été.pdf',
  );
  assert.equal(filenameFromContentDisposition('attachment; filename="deck.pptx"'), 'deck.pptx');
  assert.equal(filenameFromContentDisposition('attachment; filename=film.mp4'), 'film.mp4');
  assert.equal(filenameFromContentDisposition('attachment'), undefined);
  assert.equal(filenameFromContentDisposition(null), undefined);
});
