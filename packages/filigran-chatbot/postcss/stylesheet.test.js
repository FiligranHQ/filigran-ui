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

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
/** The source files of the panel, tests left out. */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
const declarations = rules.flatMap((rule) => rule.nodes.filter((node) => node.type === 'decl'));

test("every theme entry is read by a rule, with the panel's own look to fall back to", () => {
  const variables = [...readFileSync(join(SRC, 'utils/theme.ts'), 'utf8').matchAll(/'(--filigran-chat-[a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(variables.length > 10, `found only ${variables.length} theme variables`);
  for (const variable of variables) {
    assert.ok(
      declarations.some((decl) => decl.value.includes(`var(${variable},`)),
      `${variable} is read by no rule, or with no fallback`,
    );
  }
});

test('every chat-* class the components use is compiled', () => {
  const used = new Set(
    sourceFiles(SRC).flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/(?<![\w[-])chat-[a-z0-9-]+(?:\/\d+)?(?![\w-])/g)].map((m) => m[0])),
  );
  // Keyframe names (an inline `animation`) are no classes.
  for (const [, name] of readFileSync(SOURCE, 'utf8').matchAll(/@keyframes (chat-[a-z0-9-]+)/g)) used.delete(name);
  assert.ok(used.size > 20, `found only ${used.size} chat-* classes`);
  // In a selector a shade's alpha is escaped (`.chat-text-secondary-700\\/80`), and a
  // class behind a variant follows its escaped colon (`.hover\\:chat-x:hover`).
  const compiled = (selector, name) => {
    const escaped = name.replace('/', '\\/');
    for (let at = selector.indexOf(escaped); at !== -1; at = selector.indexOf(escaped, at + 1)) {
      const before = selector[at - 1];
      const after = selector[at + escaped.length] ?? '';
      if ((before === '.' || before === ':') && !/[\w\\-]/.test(after)) return true;
    }
    return false;
  };
  const missing = [...used].filter((name) => !rules.some((rule) => rule.selectors.some((selector) => compiled(selector, name))));
  assert.deepEqual(missing, []);
});

test("every default of the panel's own look is declared for both modes on the panel root", () => {
  const declared = (match) =>
    new Set(
      rules
        .filter((rule) => rule.selectors.some(match))
        .flatMap((rule) => rule.nodes.filter((node) => node.type === 'decl').map((node) => node.prop)),
    );
  const light = declared((selector) => /^\.filigran-chatbot$/.test(selector.trim()));
  const dark = declared((selector) => /^\.dark \.filigran-chatbot$/.test(selector.trim()));
  const read = new Set(declarations.flatMap((decl) => [...decl.value.matchAll(/var\((--chat-default-[a-z0-9-]+)/g)].map((m) => m[1])));
  assert.ok(read.size > 5, `found only ${read.size} defaults read`);
  assert.ok(light.has('--chat-dark') && dark.has('--chat-dark'), 'the mode switch is declared for both modes');
  for (const token of read) {
    assert.ok(light.has(token), `${token} has no light default`);
    assert.ok(dark.has(token), `${token} has no dark default`);
  }
});
