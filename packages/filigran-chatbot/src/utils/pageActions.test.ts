/**
 * Unit tests for performing an `act_on_page` action on the host page (#5559) -
 * `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

import { hostTakesPageActions, performPageAction, waitForDomSettle } from './pageActions.ts';

function page(html: string) {
  const window = new Window({ url: 'http://opencti.test/dashboard' });
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

test('a click reaches the element', async () => {
  const doc = page('<button id="b">Go</button>');
  let clicked = 0;
  const el = doc.getElementById('b')!;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]])), { ok: true });
  assert.equal(clicked, 1);
});

test('typing sets the value through the native setter, fires input, then presses Enter', async () => {
  const doc = page('<input id="q">');
  const el = doc.getElementById('q') as HTMLInputElement;
  const seen: string[] = [];
  el.addEventListener('input', () => seen.push(`input:${el.value}`));
  el.addEventListener('keydown', (e) => seen.push(`keydown:${(e as KeyboardEvent).key}`));
  const result = await performPageAction({ type: 'type', ref: 'e1', text: 'apt28' }, new Map([['e1', el]]));
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(seen, ['input:apt28', 'keydown:Enter']);
});

test('navigating goes through the host callback, and fails without one', async () => {
  const paths: string[] = [];
  const ok = await performPageAction({ type: 'navigate', path: '/dashboard/x' }, new Map(), (p) => paths.push(p));
  assert.deepEqual(ok, { ok: true });
  assert.deepEqual(paths, ['/dashboard/x']);
  assert.deepEqual(await performPageAction({ type: 'navigate', path: '/x' }, new Map()), {
    ok: false,
    error: 'navigation_unavailable',
  });
});

test('an unknown reference is refused', async () => {
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e9' }, new Map()), { ok: false, error: 'unknown_ref' });
});

test('a snapshot request does nothing', async () => {
  assert.deepEqual(await performPageAction({ type: 'snapshot' }, new Map()), { ok: true });
});

test('the settle wait ends once the page is quiet, and never later than its cap', async () => {
  const doc = page('<div id="d"></div>');
  const quiet = Date.now();
  await waitForDomSettle(doc, { quietMs: 50, maxMs: 1000 });
  assert.ok(Date.now() - quiet < 500);

  const busy = setInterval(() => doc.getElementById('d')!.append(doc.createElement('span')), 10);
  const start = Date.now();
  await waitForDomSettle(doc, { quietMs: 50, maxMs: 200 });
  clearInterval(busy);
  assert.ok(Date.now() - start < 600);
});

test('opening a menu hovers its trigger the way a pointer does', async () => {
  const doc = page('<a id="m" href="/x" aria-haspopup="menu">Analyses</a>');
  const el = doc.getElementById('m')!;
  const seen: string[] = [];
  for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) el.addEventListener(t, () => seen.push(t));
  assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]])), { ok: true });
  assert.deepEqual(seen, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']);
});

test('page actions are declared only to a host that answers them and lets the panel navigate', () => {
  const navigate = () => undefined;
  assert.equal(hostTakesPageActions('/chat/messages/approve', navigate), true);
  // A host proxying the approve route but keeping its navigation to itself
  // (OpenAEV, OpenCRQ today) never receives a page action.
  assert.equal(hostTakesPageActions('/chat/messages/approve', undefined), false);
  assert.equal(hostTakesPageActions(null, navigate), false);
});
