/**
 * Unit tests for the decks, reports and videos an answer made - `yarn test`.
 *
 * `artifacts` on `done` and on a restored answer, and the answer of
 * `GET {artifacts}/{kind}/{id}`, are a cross-repo contract: XTM One sends them
 * (`services/platform_chat_artifacts.py`) and the product proxies forward them
 * unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ProtocolContext } from './types.ts';
import { parseArtifact, parseArtifacts, parseRestEvent, parseRestoredMessages } from './parseRestEvent.ts';

const deck = {
  kind: 'presentation',
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Weekly threats',
  slide_count: 7,
  slide_ref: 's-3',
  url: 'https://xtm.example/presentations/11111111-1111-4111-8111-111111111111#/s-3',
  downloads: ['pdf', 'pptx', 'pptx_native'],
};
const video = {
  kind: 'video',
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Explainer',
  scene_count: 6,
  duration_ms: 45000,
  status: 'running',
  progress: 42,
  downloads: [],
};

test('a descriptor reads every field XTM One sends', () => {
  assert.deepEqual(parseArtifact(deck), {
    kind: 'presentation',
    id: deck.id,
    title: 'Weekly threats',
    url: deck.url,
    slideRef: 's-3',
    slideCount: 7,
    sectionCount: undefined,
    sceneCount: undefined,
    durationMs: undefined,
    status: undefined,
    progress: undefined,
    downloads: ['pdf', 'pptx', 'pptx_native'],
  });
  const film = parseArtifact(video);
  assert.equal(film?.status, 'running');
  assert.equal(film?.progress, 42);
  assert.equal(film?.durationMs, 45000);
  assert.deepEqual(film?.downloads, []);
});

test('a descriptor without a known kind or an id is dropped, and odd fields are read defensively', () => {
  assert.equal(parseArtifact({ kind: 'spreadsheet', id: 'x' }), undefined);
  assert.equal(parseArtifact({ kind: 'report' }), undefined);
  assert.equal(parseArtifact('report'), undefined);
  const report = parseArtifact({ kind: 'report', id: 'r', section_count: -1, downloads: ['pdf', 3, ''] });
  assert.equal(report?.title, '');
  assert.equal(report?.sectionCount, undefined);
  assert.deepEqual(report?.downloads, ['pdf']);
  assert.equal(parseArtifacts([{ kind: 'nope', id: 'x' }]), undefined);
  assert.equal(parseArtifacts('not a list'), undefined);
});

test('the done frame carries the answer artifacts', () => {
  const ctx = { hasUsedTools: false } as ProtocolContext;
  const parsed = parseRestEvent({ type: 'done', content: 'Here [[VIDEO:x]]', artifacts: [video, { kind: 'x' }] }, ctx);
  assert.equal(parsed.action, 'done');
  if (parsed.action !== 'done') return;
  assert.deepEqual(
    parsed.artifacts?.map((a) => a.kind),
    ['video'],
  );
  const bare = parseRestEvent({ type: 'done', content: 'No artifact' }, ctx);
  assert.equal(bare.action === 'done' ? bare.artifacts : 'not done', undefined);
});

test('a restored answer keeps its artifacts and a user message never takes any', () => {
  const [user, answer] = parseRestoredMessages([
    { role: 'user', content: 'a deck please', artifacts: [deck] },
    { role: 'assistant', content: 'Here it is', artifacts: [deck] },
  ]);
  assert.equal(user.artifacts, undefined);
  assert.equal(answer.artifacts?.[0].slideRef, 's-3');
});
