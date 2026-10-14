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

test('typing in a search field sets the value through the native setter, fires input, then presses Enter', async () => {
  const doc = page('<input id="q" type="search">');
  const el = doc.getElementById('q') as HTMLInputElement;
  const seen: string[] = [];
  el.addEventListener('input', () => seen.push(`input:${el.value}`));
  el.addEventListener('keydown', (e) => seen.push(`keydown:${(e as KeyboardEvent).key}`));
  const result = await performPageAction({ type: 'type', ref: 'e1', text: 'apt28' }, new Map([['e1', el]]));
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(seen, ['input:apt28', 'keydown:Enter']);
});

test('typing in a field of a form with several fields never presses Enter, which would send the form', async () => {
  const doc = page('<form id="f"><input id="name"><textarea id="persona"></textarea><button>Create</button></form>');
  const el = doc.getElementById('name') as HTMLInputElement;
  let submitted = 0;
  const keys: string[] = [];
  doc.getElementById('f')!.addEventListener('submit', (e) => {
    e.preventDefault();
    submitted++;
  });
  el.addEventListener('keydown', (e) => keys.push((e as KeyboardEvent).key));
  await performPageAction({ type: 'type', ref: 'e1', text: 'Ladybug Sunday' }, new Map([['e1', el]]));
  assert.equal(el.value, 'Ladybug Sunday');
  assert.deepEqual([keys, submitted], [[], 0]);
});

test('typing in the only field of a form presses Enter and sends it, as a search form expects', async () => {
  const doc = page('<form id="f"><input id="q"><button>Go</button></form>');
  const el = doc.getElementById('q') as HTMLInputElement;
  let submitted = 0;
  doc.getElementById('f')!.addEventListener('submit', (e) => {
    e.preventDefault();
    submitted++;
  });
  await performPageAction({ type: 'type', ref: 'e1', text: 'apt28' }, new Map([['e1', el]]));
  assert.equal(submitted, 1);
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

test('opening a menu hovers its trigger the way a pointer does, and stops there when the menu opens', async () => {
  const doc = page('<a id="m" href="/x" aria-haspopup="menu">Analyses</a>');
  const el = doc.getElementById('m')!;
  const seen: string[] = [];
  for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'click']) el.addEventListener(t, () => seen.push(t));
  el.addEventListener('mouseenter', () => doc.body.append(doc.createElement('ul')));
  assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]])), { ok: true });
  assert.deepEqual(seen, ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']);
});

test('a menu that opens on click is clicked when hovering opens nothing', async () => {
  const doc = page('<button id="m" aria-haspopup="menu" aria-expanded="false">Version</button>');
  const el = doc.getElementById('m')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]])), { ok: true });
  assert.equal(clicked, 1);
});

test('a hover that marks the menu expanded is not followed by a click, which would close it', async () => {
  const doc = page('<button id="m" aria-haspopup="menu" aria-expanded="false">Tools</button>');
  const el = doc.getElementById('m')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  el.addEventListener('pointerenter', () => el.setAttribute('aria-expanded', 'true'));
  await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]));
  assert.equal(clicked, 0);
});

test('page actions are declared only to a host that answers them and lets the panel navigate', () => {
  const navigate = () => undefined;
  assert.equal(hostTakesPageActions('/chat/messages/approve', navigate), true);
  // A host proxying the approve route but keeping its navigation to itself
  // (OpenAEV, OpenCRQ today) never receives a page action.
  assert.equal(hostTakesPageActions('/chat/messages/approve', undefined), false);
  assert.equal(hostTakesPageActions(null, navigate), false);
});
