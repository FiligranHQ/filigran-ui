import assert from 'node:assert/strict';
import { test } from 'node:test';
import postcss from 'postcss';
import isolateFromHost, { scopeToPanel } from './isolate-from-host.js';

const SCOPE = ':is(.filigran-chatbot, .filigran-chatbot *)';

const run = (css) => postcss([isolateFromHost()]).process(css, { from: undefined }).css;

test('a utility is scoped to the panel, its own element included', () => {
  assert.equal(scopeToPanel('.opacity-0'), `.opacity-0${SCOPE}`);
  assert.equal(scopeToPanel('.dark .dark\\:text-white\\/40'), `.dark .dark\\:text-white\\/40${SCOPE}`);
  assert.equal(
    scopeToPanel('.group-hover\\/msg\\:opacity-100:is(:where(.group\\/msg):hover *)'),
    `.group-hover\\/msg\\:opacity-100:is(:where(.group\\/msg):hover *)${SCOPE}`,
  );
});

test('the scope goes before a pseudo-element, which nothing may follow', () => {
  assert.equal(scopeToPanel('.placeholder\\:text-gray-400::placeholder'), `.placeholder\\:text-gray-400${SCOPE}::placeholder`);
  assert.equal(scopeToPanel('.before\\:content-x:before'), `.before\\:content-x${SCOPE}:before`);
  assert.equal(scopeToPanel('.x:hover::after'), `.x:hover${SCOPE}::after`);
});

test('colons and pseudo-element names inside escapes, brackets, functions and strings are not pseudo-elements', () => {
  assert.equal(scopeToPanel('.hover\\:x\\:\\:before:hover'), `.hover\\:x\\:\\:before:hover${SCOPE}`);
  assert.equal(scopeToPanel('.x:not(.y::before)'), `.x:not(.y::before)${SCOPE}`);
  assert.equal(scopeToPanel('.x[data-a="b::before"]'), `.x[data-a="b::before"]${SCOPE}`);
  assert.equal(scopeToPanel(':where(.space-y-2>:not(:last-child))'), `:where(.space-y-2>:not(:last-child))${SCOPE}`);
});

test('utilities leave their layer, variants and at-rules kept, every selector of a rule scoped', () => {
  const out = run(
    '@layer theme, base, components, utilities;' +
      '@layer utilities{.opacity-0{opacity:0}@media (hover:hover){.a:hover,.b:hover{opacity:1}}@keyframes spin{to{rotate:1turn}}}',
  );
  assert.ok(!out.includes('@layer utilities{'), out);
  assert.ok(out.includes(`.opacity-0${SCOPE}{opacity:0}`), out);
  assert.ok(out.includes(`@media (hover:hover){.a:hover${SCOPE},.b:hover${SCOPE}{opacity:1}}`), out);
  assert.ok(out.includes('@keyframes spin{to{rotate:1turn}}'), out);
});

test('a nested rule is scoped through its parent only', () => {
  const out = run('@layer utilities{.hover\\:x{&:hover{opacity:1}}}');
  assert.ok(out.includes(`.hover\\:x${SCOPE}{&:hover{opacity:1}}`), out);
});

test('the theme variables are declared on the panel root too, out of reach of a host :root', () => {
  const out = run('@layer theme{:root,:host{--radius-lg:.5rem}}');
  assert.ok(out.includes('@layer theme{:root,:host,.filigran-chatbot{--radius-lg:.5rem}}'), out);
  assert.equal(run(out), out);
});

test('the base layer and rules outside any layer are left alone', () => {
  const css = '@layer base{:where(.filigran-chatbot) button{padding:0}}.filigran-chat-scrollable{scrollbar-width:thin}';
  assert.equal(run(css), css);
});
