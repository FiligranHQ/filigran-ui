/**
 * Unit tests for performing an `act_on_page` action on the host page (#5559) -
 * `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

import { hostTakesPageActions, isDisabled, isSecretField, performPageAction, waitForDomSettle } from './pageActions.ts';
import { takePageSnapshot } from './pageSnapshot.ts';

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

test('a form of one plain field is not sent: it is as likely a create dialog as a search', async () => {
  const doc = page('<form id="f"><input id="q"><button>Go</button></form>');
  const el = doc.getElementById('q') as HTMLInputElement;
  let submitted = 0;
  doc.getElementById('f')!.addEventListener('submit', (e) => {
    e.preventDefault();
    submitted++;
  });
  await performPageAction({ type: 'type', ref: 'e1', text: 'apt28' }, new Map([['e1', el]]));
  assert.equal(submitted, 0);
});

test('a field that says it is a search is sent', async () => {
  for (const html of [
    '<form id="f"><input id="q" type="search"></form>',
    '<form id="f"><input id="q" role="searchbox"></form>',
    '<div role="search"><form id="f"><input id="q"></form></div>',
  ]) {
    const doc = page(html);
    const el = doc.getElementById('q') as HTMLInputElement;
    let submitted = 0;
    doc.getElementById('f')!.addEventListener('submit', (e) => {
      e.preventDefault();
      submitted++;
    });
    await performPageAction({ type: 'type', ref: 'e1', text: 'apt28' }, new Map([['e1', el]]));
    assert.equal(submitted, 1, html);
  }
});

test('navigating goes through the host callback, and fails without one', async () => {
  // The document is what the path is resolved against, so a host page is needed
  // to tell an in-host path from one that leaves.
  const doc = page('');
  const paths: string[] = [];
  const ok = await performPageAction({ type: 'navigate', path: '/dashboard/x' }, new Map(), (p) => paths.push(p), doc);
  assert.deepEqual(ok, { ok: true });
  assert.deepEqual(paths, ['/dashboard/x']);
  assert.deepEqual(await performPageAction({ type: 'navigate', path: '/x' }, new Map(), undefined, doc), {
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

test('type is refused on anything that is not a text field, instead of overwriting it', async () => {
  const doc = page('<select id="s"><option>a</option><option>b</option></select><a id="l" href="/x">Go</a>');
  const select = doc.getElementById('s')!;
  assert.deepEqual(await performPageAction({ type: 'type', ref: 'e1', text: 'x' }, new Map([['e1', select]])), {
    ok: false,
    error: 'not_a_text_field',
  });
  // The options are still there: nothing was written over them.
  assert.equal(select.querySelectorAll('option').length, 2);
  const link = doc.getElementById('l')!;
  assert.equal((await performPageAction({ type: 'type', ref: 'e1', text: 'x' }, new Map([['e1', link]]))).ok, false);
  assert.equal(link.textContent, 'Go');
});

test('Enter is withheld in a form of several fields, counting the ones a text selector misses', async () => {
  const doc = page('<form id="f"><input id="u" type="text"><input type="password"></form>');
  const el = doc.getElementById('u') as HTMLInputElement;
  let submitted = 0;
  doc.getElementById('f')!.addEventListener('submit', () => submitted++);
  await performPageAction({ type: 'type', ref: 'e1', text: 'admin' }, new Map([['e1', el]]));
  assert.equal(submitted, 0);
});

test('a read-only field is refused rather than written through the native setter', async () => {
  const doc = page('<input id="r" type="text" readonly value="kept"><textarea id="a" aria-readonly="true">kept</textarea>');
  for (const id of ['r', 'a']) {
    const el = doc.getElementById(id) as HTMLInputElement;
    assert.deepEqual(await performPageAction({ type: 'type', ref: 'e1', text: 'new' }, new Map([['e1', el]]), undefined, doc), {
      ok: false,
      error: 'read_only',
    });
  }
  assert.equal((doc.getElementById('r') as HTMLInputElement).value, 'kept');
});

test('a control disabled by its fieldset is refused like any other', async () => {
  const doc = page('<fieldset disabled><button id="b">Save</button></fieldset>');
  const el = doc.getElementById('b')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), undefined, doc), {
    ok: false,
    error: 'disabled',
  });
  assert.equal(clicked, 0);
});

test('a menu revealed without adding nodes is seen through aria-expanded, and a tooltip is not mistaken for one', async () => {
  // Says nothing changed in the DOM, but marks itself expanded: no click.
  const quiet = page('<button id="m" aria-haspopup="menu" aria-expanded="false">Tools</button>');
  const qe = quiet.getElementById('m')!;
  let quietClicks = 0;
  qe.addEventListener('click', () => quietClicks++);
  qe.addEventListener('pointerenter', () => qe.setAttribute('aria-expanded', 'true'));
  await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', qe]]), undefined, quiet);
  assert.equal(quietClicks, 0);

  // Adds a tooltip but stays closed: the trigger states itself, so the
  // fallback click still runs rather than trusting the addition.
  const tip = page('<button id="m" aria-haspopup="menu" aria-expanded="false">Version</button>');
  const te = tip.getElementById('m')!;
  let tipClicks = 0;
  te.addEventListener('click', () => tipClicks++);
  te.addEventListener('mouseenter', () => tip.body.append(tip.createElement('div')));
  await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', te]]), undefined, tip);
  assert.equal(tipClicks, 1);
});

test('navigate takes host paths only, never another site or a scheme', async () => {
  const doc = page('');
  const seen: string[] = [];
  const go = (p: string) => seen.push(p);
  const refs = new Map<string, Element>();
  assert.deepEqual(await performPageAction({ type: 'navigate', path: '/dashboard' }, refs, go, doc), { ok: true });
  for (const path of ['https://evil.test/x', '//evil.test/x', 'javascript:alert(1)']) {
    assert.deepEqual(await performPageAction({ type: 'navigate', path }, refs, go, doc), { ok: false, error: 'external_path' });
  }
  assert.deepEqual(seen, ['/dashboard']);
});

test('a path that only looks relative cannot leave the host', async () => {
  const doc = page('');
  const seen: string[] = [];
  const go = (p: string) => seen.push(p);
  const refs = new Map<string, Element>();
  // Each of these resolves to another origin although it starts with '/' or a space.
  for (const path of ['/\\evil.test/x', '/\t/evil.test/x', ' //evil.test/x']) {
    assert.deepEqual(await performPageAction({ type: 'navigate', path }, refs, go, doc), { ok: false, error: 'external_path' });
  }
  assert.deepEqual(seen, []);
});

test('a disabled target is reported rather than silently doing nothing', async () => {
  const doc = page('<button id="b" disabled>Save</button><button id="a" aria-disabled="true">Send</button>');
  for (const id of ['b', 'a']) {
    const el = doc.getElementById(id)!;
    let clicked = 0;
    el.addEventListener('click', () => clicked++);
    assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]])), { ok: false, error: 'disabled' });
    assert.equal(clicked, 0);
  }
});

test('clicking a link routes it through the host instead of loading a page, and refuses one that leaves', async () => {
  const doc = page('<a id="in" href="/dashboard/reports">R</a><a id="out" href="https://evil.test/x">X</a><a id="tab" href="/x" target="_blank">T</a>');
  const seen: string[] = [];
  const go = (p: string) => seen.push(p);
  let clicked = 0;
  for (const id of ['in', 'out', 'tab']) doc.getElementById(id)!.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', doc.getElementById('in')!]]), go, doc), { ok: true });
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', doc.getElementById('out')!]]), go, doc), {
    ok: false,
    error: 'external_link',
  });
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', doc.getElementById('tab')!]]), go, doc), {
    ok: false,
    error: 'opens_new_tab',
  });
  assert.deepEqual(seen, ['/dashboard/reports']);
  assert.equal(clicked, 0);
});

test('an action this version does not know is answered with an error, not left unanswered', async () => {
  const result = await performPageAction({ type: 'unsupported', requested: 'run_script' }, new Map());
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /unsupported_action: run_script/);
});

test('the panel re-rendering while an action runs does not read as the page reacting', async () => {
  const doc = page('<div class="filigran-chatbot"><span id="status">Thinking…</span></div><button id="m" aria-haspopup="menu" aria-expanded="false">Version</button>');
  const el = doc.getElementById('m')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  // Only the panel changes on hover: the menu opens on click, so the fallback must still run.
  el.addEventListener('mouseenter', () => doc.getElementById('status')!.append(doc.createElement('b')));
  await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]));
  assert.equal(clicked, 1);
});

test('a control inside a link row keeps its own click, rather than routing the row', async () => {
  const doc = page('<a id="row" href="/dashboard/row" aria-label="Row"><span id="btn" role="button">Edit</span></a>');
  const seen: string[] = [];
  let clicked = 0;
  doc.getElementById('btn')!.addEventListener('click', () => clicked++);
  // Through the snapshot's own reference map, so this also proves the walk
  // exposes the nested control at all.
  const { refs } = takePageSnapshot(doc);
  const entry = [...refs].find(([, el]) => el.getAttribute('role') === 'button');
  assert.ok(entry, 'the snapshot gave the nested control no reference');
  assert.deepEqual(await performPageAction({ type: 'click', ref: entry[0] }, refs, (p) => seen.push(p), doc), { ok: true });
  assert.equal(clicked, 1);
  assert.deepEqual(seen, []);
});

test('a fragment href is an in-page trigger, so it is clicked rather than routed', async () => {
  const doc = page('<a id="t" href="#">Toggle</a>');
  const seen: string[] = [];
  let clicked = 0;
  const el = doc.getElementById('t')!;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), (p) => seen.push(p), doc), { ok: true });
  assert.equal(clicked, 1);
  assert.deepEqual(seen, []);
});

test('a stopped turn does not click the page after its hover wait', async () => {
  const doc = page('<button id="m" aria-haspopup="menu" aria-expanded="false">Version</button>');
  const el = doc.getElementById('m')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  const controller = new AbortController();
  const run = performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]), undefined, doc, controller.signal);
  controller.abort();
  assert.deepEqual(await run, { ok: false, error: 'aborted' });
  assert.equal(clicked, 0);
});

test('an already aborted turn performs nothing at all', async () => {
  const doc = page('<button id="b">Go</button>');
  const el = doc.getElementById('b')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), undefined, doc, controller.signal), {
    ok: false,
    error: 'aborted',
  });
  assert.equal(clicked, 0);
});

test('the open fallback goes through the link guard rather than clicking an anchor raw', async () => {
  const doc = page('<a id="ext" href="https://evil.test/x" aria-haspopup="menu" aria-expanded="false">Out</a>');
  const el = doc.getElementById('ext')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]), () => {}, doc), {
    ok: false,
    error: 'external_link',
  });
  assert.equal(clicked, 0);
});

test('a fragment anchor that opens a tab is still refused', async () => {
  const doc = page('<a id="t" href="#" target="_blank">Toggle</a>');
  const el = doc.getElementById('t')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), () => {}, doc), {
    ok: false,
    error: 'opens_new_tab',
  });
  assert.equal(clicked, 0);
});

test('clicking a control inside a link runs its handler without activating the anchor', async () => {
  const doc = page('<a id="row" href="/dashboard/row"><span id="btn" role="button">Edit</span></a>');
  let clicked = 0;
  let anchorDefaultPrevented: boolean | null = null;
  doc.getElementById('btn')!.addEventListener('click', () => clicked++);
  doc.getElementById('row')!.addEventListener('click', (e) => {
    anchorDefaultPrevented = e.defaultPrevented;
  });
  const el = doc.getElementById('btn')!;
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), () => {}, doc), { ok: true });
  assert.equal(clicked, 1);
  assert.equal(anchorDefaultPrevented, true);
});

test('an empty href is clicked without the page reloading, a fragment keeps its jump', async () => {
  // An empty href reloads the page, so its default is cancelled.
  const empty = page('<a id="t" href="">Reload</a>');
  const emptyEl = empty.getElementById('t')!;
  let emptyPrevented: boolean | null = null;
  emptyEl.addEventListener('click', (e) => {
    emptyPrevented = e.defaultPrevented;
  });
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', emptyEl]]), () => {}, empty), { ok: true });
  assert.equal(emptyPrevented, true);

  // A fragment moves within the page: its default must stand, or the hash
  // never changes and nothing happens.
  for (const href of ['#section', '#/route']) {
    const doc = page(`<a id="t" href="${href}">Go</a>`);
    const el = doc.getElementById('t')!;
    let clicked = 0;
    let prevented: boolean | null = null;
    el.addEventListener('click', (e) => {
      clicked++;
      prevented = e.defaultPrevented;
    });
    assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), () => {}, doc), { ok: true });
    assert.equal(clicked, 1, href);
    assert.equal(prevented, false, href);
  }
});

test('a search form whose handler does not cancel submission still cannot unload the page', async () => {
  const doc = page('<form id="f" action="/search"><input id="q" type="search"></form>');
  const el = doc.getElementById('q') as HTMLInputElement;
  let submitted = 0;
  let defaultPrevented: boolean | null = null;
  // Deliberately no preventDefault: the host relies on the native submission.
  doc.getElementById('f')!.addEventListener('submit', (e) => {
    submitted++;
    defaultPrevented = e.defaultPrevented;
  });
  await performPageAction({ type: 'type', ref: 'e1', text: 'apt28' }, new Map([['e1', el]]), undefined, doc);
  assert.equal(submitted, 1);
  assert.equal(defaultPrevented, true);
});

test('a path normalising to a protocol-relative one is refused', async () => {
  const doc = page('');
  const seen: string[] = [];
  const go = (p: string) => seen.push(p);
  const refs = new Map<string, Element>();
  // Each passes an origin check but returns `//evil.test/x`, which a host
  // resolving the value again would send off-site.
  for (const path of ['/.//evil.test/x', '/..//evil.test/x']) {
    assert.deepEqual(await performPageAction({ type: 'navigate', path }, refs, go, doc), { ok: false, error: 'external_path' });
  }
  assert.deepEqual(seen, []);
});

test('clicking a submit control runs its handler without the form loading its action', async () => {
  for (const html of [
    '<form id="f" action="/save"><button id="b">Save</button></form>',
    '<form id="f" action="/save"><input id="b" type="submit" value="Save"></form>',
  ]) {
    const doc = page(html);
    const el = doc.getElementById('b')!;
    let submitted = 0;
    let defaultPrevented: boolean | null = null;
    // No preventDefault here: the host relies on the native submission.
    doc.getElementById('f')!.addEventListener('submit', (e) => {
      submitted++;
      defaultPrevented = e.defaultPrevented;
    });
    assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), undefined, doc), { ok: true });
    assert.equal(submitted, 1, html);
    assert.equal(defaultPrevented, true, html);
  }
});

test('a file input is refused rather than opening an operating-system chooser', async () => {
  const doc = page('<input id="f" type="file" aria-label="Attach">');
  const el = doc.getElementById('f')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), undefined, doc), {
    ok: false,
    error: 'opens_file_dialog',
  });
  assert.equal(clicked, 0);
});

test('a menu hidden by an ancestor is not mistaken for an open one', async () => {
  // With a stated collapsed state, and without one: neither may report success
  // without activating the trigger.
  for (const expanded of ['aria-expanded="false" ', '']) {
    const doc = page(
      `<button id="t" ${expanded}aria-controls="m">Tools</button><div style="display:none"><ul id="m"><li>Item</li></ul></div>`,
    );
    const el = doc.getElementById('t')!;
    let clicked = 0;
    el.addEventListener('click', () => clicked++);
    assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]), undefined, doc), { ok: true });
    assert.equal(clicked, 1, `expanded=${JSON.stringify(expanded)}`);
  }
});

test('a menu its trigger says is open is left alone', async () => {
  const doc = page('<button id="t" aria-expanded="true" aria-controls="m">Tools</button><ul id="m"><li>Item</li></ul>');
  const el = doc.getElementById('t')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]), undefined, doc), { ok: true });
  assert.equal(clicked, 0);
});

test('a masked field is not writable either', async () => {
  const doc = page('<input id="p" type="text" autocomplete="current-password" value="kept"><input id="o" type="text" autocomplete="one-time-code">');
  for (const id of ['p', 'o']) {
    const el = doc.getElementById(id)!;
    assert.deepEqual(await performPageAction({ type: 'type', ref: 'e1', text: 'new' }, new Map([['e1', el]]), undefined, doc), {
      ok: false,
      error: 'secret_field',
    });
  }
  assert.equal((doc.getElementById('p') as HTMLInputElement).value, 'kept');
});

test('the two secret tests agree, though the modules cannot share one', () => {
  const cases: Array<[string, boolean]> = [
    ['<input id="x" type="password" value="v">', true],
    ['<input id="x" type="text" autocomplete="current-password" value="v">', true],
    ['<input id="x" type="text" autocomplete="one-time-code" value="v">', true],
    ['<input id="x" type="text" autocomplete="billing cc-number" value="v">', true],
    ['<input id="x" type="text" autocomplete="username" value="v">', false],
  ];
  for (const [html, secret] of cases) {
    const doc = page(html);
    assert.equal(isSecretField(doc.getElementById('x')!), secret, html);
    // The snapshot's own test, seen through whether it shows the value.
    assert.equal(takePageSnapshot(doc).text.includes('"v"'), !secret, html);
  }
});

test('a stated trigger waits for its own state, not for whatever the hover adds', async () => {
  const doc = page('<button id="t" aria-haspopup="menu" aria-expanded="false">Tools</button>');
  const el = doc.getElementById('t')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  el.addEventListener('pointerenter', () => {
    // A tooltip at once, the menu only later: the early addition must not end the wait.
    doc.body.append(doc.createElement('div'));
    setTimeout(() => el.setAttribute('aria-expanded', 'true'), 100);
  });
  assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]), undefined, doc), { ok: true });
  assert.equal(clicked, 0);
});

test('a menu trigger that is an anchor runs its handler rather than following its href', async () => {
  const doc = page('<a id="t" href="/dashboard/tools" aria-haspopup="menu" aria-expanded="false">Tools</a>');
  const el = doc.getElementById('t')!;
  const seen: string[] = [];
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  assert.deepEqual(await performPageAction({ type: 'open', ref: 'e1' }, new Map([['e1', el]]), (p) => seen.push(p), doc), { ok: true });
  assert.equal(clicked, 1);
  assert.deepEqual(seen, []);
});

test('a control hidden since the snapshot is refused, not acted on', async () => {
  const doc = page('<div id="wrap"><button id="b">Save</button></div>');
  const el = doc.getElementById('b')!;
  let clicked = 0;
  el.addEventListener('click', () => clicked++);
  // The dialog closes between snapshot and action.
  doc.getElementById('wrap')!.setAttribute('style', 'display:none');
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', el]]), undefined, doc), {
    ok: false,
    error: 'not_visible',
  });
  assert.equal(clicked, 0);
  // Same for an ancestor gone inert.
  const inert = page('<div id="wrap"><button id="b">Save</button></div>');
  inert.getElementById('wrap')!.setAttribute('inert', '');
  assert.deepEqual(
    await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', inert.getElementById('b')!]]), undefined, inert),
    { ok: false, error: 'not_visible' },
  );
});

test('a click moves focus first, so an edit pending on blur is committed', async () => {
  const doc = page('<input id="q" type="text"><button id="save">Save</button>');
  const field = doc.getElementById('q') as HTMLInputElement;
  const order: string[] = [];
  field.addEventListener('blur', () => order.push('blur'));
  doc.getElementById('save')!.addEventListener('click', () => order.push('click'));
  await performPageAction({ type: 'type', ref: 'e1', text: 'apt28' }, new Map([['e1', field]]), undefined, doc);
  await performPageAction({ type: 'click', ref: 'e2' }, new Map([['e2', doc.getElementById('save')!]]), undefined, doc);
  assert.deepEqual(order, ['blur', 'click'], 'the field must blur before the button is activated');
});

test('a checkbox inside a link still toggles, and the link is not followed', async () => {
  const doc = page('<a id="row" href="/dashboard/row"><input id="c" type="checkbox"></a>');
  const box = doc.getElementById('c') as HTMLInputElement;
  const seen: string[] = [];
  let changed = 0;
  box.addEventListener('change', () => changed++);
  let anchorDefaultPrevented: boolean | null = null;
  doc.getElementById('row')!.addEventListener('click', (e) => {
    anchorDefaultPrevented = e.defaultPrevented;
  });
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', box]]), (p) => seen.push(p), doc), { ok: true });
  assert.equal(box.checked, true);
  assert.equal(changed, 1);
  assert.equal(anchorDefaultPrevented, true);
  assert.deepEqual(seen, []);
});

test('a disabled fieldset stops its native controls, not a link inside it', async () => {
  const doc = page('<fieldset disabled><legend><button id="l">Legend</button></legend><button id="b">Save</button><a id="a" href="/help">Help</a></fieldset>');
  // The native control it governs.
  assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', doc.getElementById('b')!]]), undefined, doc), {
    ok: false,
    error: 'disabled',
  });
  // A link is not a form control, and the first legend is exempt.
  for (const id of ['a', 'l']) {
    assert.deepEqual(await performPageAction({ type: 'click', ref: 'e1' }, new Map([['e1', doc.getElementById(id)!]]), undefined, doc), {
      ok: true,
    });
  }
});

test('a one-field form is sent when the field reads as a search, not when it reads as a dialog', async () => {
  const sends = ['<input id="q" type="text" placeholder="Search…">', '<input id="q" type="text" name="query">', '<input id="q" type="text" aria-label="Filter reports">'];
  const holds = ['<input id="q" type="text" placeholder="Agent name">', '<input id="q" type="text" name="title">'];
  for (const [list, expected] of [[sends, 1], [holds, 0]] as const) {
    for (const field of list) {
      const doc = page(`<form id="f">${field}</form>`);
      let submitted = 0;
      doc.getElementById('f')!.addEventListener('submit', (e) => {
        e.preventDefault();
        submitted++;
      });
      await performPageAction({ type: 'type', ref: 'e1', text: 'x' }, new Map([['e1', doc.getElementById('q')!]]), undefined, doc);
      assert.equal(submitted, expected, field);
    }
  }
});

test('the two disabled tests agree, though the modules cannot share one', () => {
  const cases: Array<[string, boolean]> = [
    ['<button id="x" disabled>Save</button>', true],
    ['<a id="x" href="/h" disabled>Help</a>', true],
    ['<button id="x" aria-disabled="true">Save</button>', true],
    ['<fieldset disabled><button id="x">Save</button></fieldset>', true],
    ['<fieldset disabled><a id="x" href="/h">Help</a></fieldset>', false],
    ['<fieldset disabled><legend><button id="x">Legend</button></legend></fieldset>', false],
    ['<button id="x">Save</button>', false],
  ];
  for (const [html, disabled] of cases) {
    const doc = page(html);
    assert.equal(isDisabled(doc.getElementById('x')!), disabled, html);
    // The snapshot's own test, seen through the state it prints.
    assert.equal(takePageSnapshot(doc).text.includes('(disabled)'), disabled, html);
  }
});
