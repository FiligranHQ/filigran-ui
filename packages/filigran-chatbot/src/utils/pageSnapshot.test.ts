/**
 * Unit tests for the host-page snapshot of `act_on_page` (#5559) - `yarn test`.
 *
 * The snapshot is what the decision model reads: one line per element a user
 * could act on, with a reference the next action names it by.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

import { MAX_SNAPSHOT_CHARS, takePageSnapshot } from './pageSnapshot.ts';

function page(html: string): Document {
  const window = new Window({ url: 'http://opencti.test/dashboard/analyses/reports?sort=date' });
  window.document.title = 'Reports | OpenCTI';
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

test('each element a user can act on becomes one referenced line, under a header', () => {
  const snap = takePageSnapshot(
    page(`
      <h1>Reports</h1>
      <a href="/dashboard/analyses/reports/1">APT28 campaign</a>
      <button disabled>Create</button>
      <input type="search" placeholder="Search" value="apt28">
      <div role="tab" aria-selected="true">Overview</div>
    `),
  );
  assert.equal(
    snap.text,
    [
      '# Reports | OpenCTI — /dashboard/analyses/reports?sort=date',
      'heading "Reports" (level 1)',
      '[e1] link "APT28 campaign" -> /dashboard/analyses/reports/1',
      '[e2] button "Create" (disabled)',
      '[e3] searchbox "Search" = "apt28"',
      '[e4] tab "Overview" (selected)',
    ].join('\n'),
  );
  assert.equal(snap.url, '/dashboard/analyses/reports?sort=date');
  assert.equal(snap.title, 'Reports | OpenCTI');
  assert.equal(snap.refs.get('e1')?.textContent, 'APT28 campaign');
});

test('the chat panel, hidden and inert content are left out', () => {
  const snap = takePageSnapshot(
    page(`
      <div class="filigran-chatbot fixed"><button>Send</button></div>
      <div hidden><button>Hidden</button></div>
      <div aria-hidden="true"><button>Aria hidden</button></div>
      <div inert><button>Inert</button></div>
      <div style="display: none"><button>Not displayed</button></div>
      <button>Visible</button>
    `),
  );
  assert.deepEqual([...snap.refs.keys()], ['e1']);
  assert.match(snap.text, /\[e1\] button "Visible"/);
});

test('a password value is never written', () => {
  const snap = takePageSnapshot(page('<input type="password" aria-label="Password" value="hunter2">'));
  assert.doesNotMatch(snap.text, /hunter2/);
  assert.match(snap.text, /\[e1\] textbox "Password"$/m);
});

test('the name comes from the label the user reads, in the accessible-name order', () => {
  const snap = takePageSnapshot(
    page(`
      <button aria-label="Close dialog">x</button>
      <span id="lbl">Report name</span><input aria-labelledby="lbl">
      <label for="desc">Description</label><textarea id="desc"></textarea>
      <label>Confidence <select><option>High</option></select></label>
      <a href="/x"><img alt="Home"></a>
      <input placeholder="Filter">
      <button>${'very long '.repeat(20)}</button>
    `),
  );
  const names = snap.text
    .split('\n')
    .filter((l) => l.startsWith('['))
    .map((l) => /"(.*?)"/.exec(l)?.[1]);
  assert.deepEqual(names.slice(0, 6), ['Close dialog', 'Report name', 'Description', 'Confidence', 'Home', 'Filter']);
  assert.equal(names[6]?.length, 80);
});

test('a quote in a name cannot break its line', () => {
  const snap = takePageSnapshot(page('<button>Say "hi"</button>'));
  assert.match(snap.text, /\[e1\] button "Say \\"hi\\""$/m);
});

test('a large page stops at the size cap', () => {
  const links = Array.from({ length: 2000 }, (_, i) => `<a href="/r/${i}">Report number ${i}</a>`).join('');
  const snap = takePageSnapshot(page(links));
  assert.ok(snap.text.length <= MAX_SNAPSHOT_CHARS);
  assert.ok(snap.refs.size < 2000);
});

test('a pressed toggle and the current link say so, as a page marks them', () => {
  const snap = takePageSnapshot(
    page('<button aria-pressed="true">Sidebar</button><a href="/r" aria-current="page">Reports</a><button aria-pressed="false">Floating</button>'),
  );
  assert.match(snap.text, /\[e1\] button "Sidebar" \(pressed\)$/m);
  assert.match(snap.text, /\[e2\] link "Reports" \(current\) -> \/r$/m);
  assert.match(snap.text, /\[e3\] button "Floating"$/m);
});

test('a link within the host names where it goes; one to another site does not', () => {
  const snap = takePageSnapshot(
    page('<a href="/dashboard/analyses">Analyses</a><a href="https://example.com/x">Elsewhere</a><a href="reports?x=1">Relative</a>'),
  );
  assert.match(snap.text, /\[e1\] link "Analyses" -> \/dashboard\/analyses$/m);
  assert.match(snap.text, /\[e2\] link "Elsewhere"$/m);
  assert.match(snap.text, /\[e3\] link "Relative" -> \/dashboard\/analyses\/reports\?x=1$/m);
});

test('a closed menu says so, and its items once open say where they go', () => {
  const closed = takePageSnapshot(page('<a href="/dashboard/analyses" aria-haspopup="menu" aria-expanded="false">Analyses</a>'));
  assert.match(closed.text, /\[e1\] link "Analyses" \(menu\) -> \/dashboard\/analyses$/m);
  const open = takePageSnapshot(
    page(
      '<a href="/dashboard/analyses" aria-haspopup="menu" aria-expanded="true">Analyses</a><div role="menu"><a role="menuitem" href="/dashboard/analyses/groupings">Groupements</a></div>',
    ),
  );
  assert.match(open.text, /\[e1\] link "Analyses" \(expanded\) -> \/dashboard\/analyses$/m);
  assert.match(open.text, /\[e2\] menuitem "Groupements" -> \/dashboard\/analyses\/groupings$/m);
});

test('a collapsed group says so, and a menu stays a menu rather than collapsed', () => {
  const snap = takePageSnapshot(
    page('<button aria-expanded="false">Admin</button><button aria-haspopup="menu" aria-expanded="false">Version</button><button>Plain</button>'),
  );
  assert.match(snap.text, /^\[e1\] button "Admin" \(collapsed\)$/m);
  assert.match(snap.text, /^\[e2\] button "Version" \(menu\)$/m);
  assert.match(snap.text, /^\[e3\] button "Plain"$/m);
});

test('a row link keeps its cells apart, so its first cell reads as a word', () => {
  const snap = takePageSnapshot(page('<a href="/roles/1"><div>Administrator</div><div>Zone de danger</div><div>1</div><div>12 oct. 2026</div></a>'));
  assert.match(snap.text, /\[e1\] link "Administrator Zone de danger 1 12 oct\. 2026" -> \/roles\/1$/m);
});

test('an inline element does not split a word', () => {
  const snap = takePageSnapshot(page('<button>Re<b>ports</b></button>'));
  assert.match(snap.text, /\[e1\] button "Reports"$/m);
});

// --- #443 review ------------------------------------------------------------

test('a secret is masked by its autocomplete, not only by type=password', () => {
  const doc = page(`
    <input type="text" autocomplete="current-password" value="hunter2" aria-label="Password">
    <input type="text" autocomplete="one-time-code" value="123456" aria-label="Code">
    <input type="text" autocomplete="billing cc-number" value="4111111111111111" aria-label="Card">
    <input type="text" autocomplete="username" value="antoine" aria-label="User">
  `);
  const { text } = takePageSnapshot(doc);
  for (const secret of ['hunter2', '123456', '4111111111111111']) assert.ok(!text.includes(secret), `leaked ${secret}`);
  // A field that is not a secret still shows its value.
  assert.ok(text.includes('antoine'));
});

test('a snapshot cut off at the cap says so, so a partial list is not read as the whole page', () => {
  const doc = page(Array.from({ length: 200 }, (_, i) => `<button>Button number ${i}</button>`).join(''));
  const { text } = takePageSnapshot(doc, 400);
  assert.ok(text.endsWith('[truncated]'), text.slice(-80));
  const full = takePageSnapshot(doc);
  assert.ok(!full.text.includes('[truncated]'));
});

test('a composite control still lists the control inside it (#443 Copilot)', () => {
  const doc = page('<div role="combobox" aria-label="Agent"><input type="text" aria-label="Agent name" value="clef"></div>');
  const { text } = takePageSnapshot(doc);
  assert.ok(text.includes('combobox "Agent"'), text);
  assert.ok(text.includes('textbox "Agent name"'), text);
});

test('a native select still keeps its options out of the snapshot', () => {
  const doc = page('<select aria-label="Mode"><option>fast</option><option>slow</option></select>');
  const { text } = takePageSnapshot(doc);
  assert.equal(text.split('\n').filter((l) => l.startsWith('[')).length, 1);
});

test('hidden text cannot re-enter through a visible ancestor name (#443 Copilot)', () => {
  const doc = page('<button id="b">Open<span style="display:none">private text</span></button>');
  const { text } = takePageSnapshot(doc);
  assert.ok(text.includes('button "Open"'), text);
  assert.ok(!text.includes('private text'), text);
});

test("a secret's own contents are not handed over as its name", () => {
  const doc = page('<div contenteditable="true" autocomplete="one-time-code">123456</div>');
  const { text } = takePageSnapshot(doc);
  assert.ok(!text.includes('123456'), text);
});

test('an icon button keeps the name of its visually-hidden label (#443 re-review)', () => {
  const doc = page('<button aria-labelledby="lbl"><svg></svg></button><span id="lbl" style="display:none">Delete report</span>');
  const { text } = takePageSnapshot(doc);
  assert.ok(text.includes('button "Delete report"'), text);
});

test("a contenteditable's value leaves out its hidden descendants (#443 Copilot)", () => {
  const doc = page('<div contenteditable="true" aria-label="Notes">shown<span style="display:none">private text</span></div>');
  const { text } = takePageSnapshot(doc);
  assert.ok(text.includes('textbox "Notes"'), text);
  assert.ok(!text.includes('private text'), text);
});

test('the shapes named in review stay out of the snapshot, and nested items stay in', () => {
  // An unlabelled secret textarea: masked as a value, and not leaked as a name.
  const otp = page('<textarea autocomplete="one-time-code">123456</textarea>');
  assert.ok(!takePageSnapshot(otp).text.includes('123456'));
  // The `hidden` attribute and `aria-hidden`, not only `display:none`.
  for (const html of ['<button>Open<span hidden>private text</span></button>', '<button>Open<span aria-hidden="true">private text</span></button>']) {
    const { text } = takePageSnapshot(page(html));
    assert.ok(text.includes('button "Open"'), text);
    assert.ok(!text.includes('private text'), text);
  }
  // An expanded treeitem keeps its children.
  const tree = page('<div role="treeitem" aria-expanded="true" aria-label="Reports"><div role="treeitem" aria-label="APT28"></div></div>');
  const lines = takePageSnapshot(tree).text;
  assert.ok(lines.includes('treeitem "Reports"') && lines.includes('treeitem "APT28"'), lines);
});
