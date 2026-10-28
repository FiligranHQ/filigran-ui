/**
 * The stylesheet the package ships, compiled as the build compiles it, must
 * restyle nothing of the page that loads it: every rule is scoped to the panel
 * (`.filigran-chatbot`, its `filigran-chat-*` classes), and no variable is
 * declared on the host document.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { stylesheetPlugins } from './pipeline.js';

const SOURCE = fileURLToPath(new URL('../src/assets/index.css', import.meta.url));
const PANEL_SCOPE = ':is(.filigran-chatbot, .filigran-chatbot *)';

// `optimize` as the production build has it (flattened nesting), unminified so
// a failure names a readable selector.
const { root } = await postcss(stylesheetPlugins({ optimize: { minify: false } })).process(readFileSync(SOURCE, 'utf8'), { from: SOURCE });

function inKeyframes(rule) {
  for (let node = rule.parent; node; node = node.parent) if (node.type === 'atrule' && /keyframes$/i.test(node.name)) return true;
  return false;
}

const rules = [];
root.walkRules((rule) => {
  if (!inKeyframes(rule)) rules.push(rule);
});
const declaresVariables = (rule) => rule.nodes.some((node) => node.type === 'decl' && node.prop.startsWith('--'));
const hasClass = (selector, name) => new RegExp(`\\.${name}(?![\\w\\\\-])`).test(selector);

test('the stylesheet compiles to rules', () => {
  assert.ok(rules.length > 100, `only ${rules.length} rules`);
});

test('every rule of the stylesheet is scoped to the panel', () => {
  const unscoped = rules.flatMap((rule) => rule.selectors.filter((selector) => !selector.includes('.filigran-chat')));
  assert.deepEqual(unscoped, []);
});

test('the utilities a host also defines (.flex, .hidden, .grid) apply inside the panel only', () => {
  for (const name of ['flex', 'hidden', 'grid']) {
    const selectors = rules.flatMap((rule) => rule.selectors.filter((selector) => hasClass(selector, name)));
    if (name !== 'grid') assert.ok(selectors.length > 0, `.${name} is compiled`);
    for (const selector of selectors) assert.ok(selector.includes(PANEL_SCOPE), `unscoped .${name}: ${selector}`);
  }
});

test("the user bubble's line breaks and word wrapping compile, inside the panel", () => {
  for (const [name, prop, value] of [
    ['whitespace-pre-wrap', 'white-space', 'pre-wrap'],
    ['break-words', 'overflow-wrap', 'break-word'],
  ]) {
    const matching = rules.filter((rule) => rule.selectors.some((selector) => hasClass(selector, name)));
    assert.ok(matching.length > 0, `.${name} is compiled`);
    for (const rule of matching) {
      for (const selector of rule.selectors) assert.ok(selector.includes(PANEL_SCOPE), `unscoped .${name}: ${selector}`);
      assert.ok(
        rule.nodes.some((node) => node.type === 'decl' && node.prop === prop && node.value === value),
        `.${name} sets ${prop}: ${value}`,
      );
    }
  }
});

test('no variable is declared on the host document, and the theme is declared on the panel root', () => {
  const documentRules = rules.filter((rule) => rule.selectors.some((selector) => /:root|:host|^\s*(html|body|\*)\b/.test(selector)));
  assert.deepEqual(
    documentRules.map((rule) => rule.selector),
    [],
  );
  const variableRules = rules.filter(declaresVariables);
  for (const rule of variableRules) {
    for (const selector of rule.selectors) assert.ok(selector.includes('.filigran-chatbot'), `variables declared outside the panel: ${selector}`);
  }
  const theme = variableRules.find((rule) => rule.selector === '.filigran-chatbot');
  assert.ok(theme, 'the theme rule');
  for (const variable of ['--font-sans', '--spacing', '--radius-lg']) {
    assert.ok(
      theme.nodes.some((node) => node.prop === variable),
      `${variable} on the panel root`,
    );
  }
});

test('every overlay the panel portals is mounted inside the panel root, where the theme is declared', () => {
  const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
  const files = readdirSync(srcDir, { recursive: true }).filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));
  const portalling = files.filter((path) => readFileSync(join(srcDir, path), 'utf8').includes('createPortal('));
  assert.ok(portalling.length > 0, 'the panel portals its overlays');
  for (const path of portalling) {
    assert.ok(readFileSync(join(srcDir, path), 'utf8').includes('findChatbotRoot('), `${path} portals outside the panel root`);
  }
});

test("each theme utility reads its host variable and falls back to the panel's own look, light and dark", () => {
  // The utility, the variable it reads, and whether it has a dark default of its own.
  const utilities = [
    ['chat-surface', '--filigran-chat-surface', true],
    ['chat-surface-raised', '--filigran-chat-surface-raised', true],
    ['chat-header-surface', '--filigran-chat-header-background', false],
    ['chat-text', '--filigran-chat-text', true],
    ['chat-text-muted', '--filigran-chat-text-muted', true],
    ['chat-border', '--filigran-chat-border', true],
    ['chat-answer-text', '--filigran-chat-text-size', false],
    ['chat-user-bubble', '--filigran-chat-user-background', false],
    ['chat-code', '--filigran-chat-font-mono', false],
    ['chat-code-block', '--filigran-chat-code-surface', true],
    ['chat-code-inline', '--filigran-chat-code-surface', true],
  ];
  for (const [name, variable, darkDefault] of utilities) {
    const own = rules.filter((rule) => rule.selectors.some((selector) => hasClass(selector, name)));
    const reads = (rule) => rule.nodes.some((node) => node.type === 'decl' && node.value.includes(`var(${variable},`));
    const light = own.filter((rule) => !rule.selector.includes('.dark'));
    assert.ok(light.some(reads), `.${name} reads ${variable} with a fallback`);
    if (darkDefault)
      assert.ok(
        own.some((rule) => rule.selector.includes('.dark') && reads(rule)),
        `.${name} has a dark fallback`,
      );
  }
});
