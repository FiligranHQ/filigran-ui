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

test("the design system IconButton's classes compile inside the panel, reading the host's design-system tokens first", () => {
  for (const [name, prop, token] of [
    ['text-icon-highlight', 'color', '--icon-highlight'],
    ['h-9', 'height', null],
    ['rounded-sm', 'border-radius', null],
    ['text-feedback-error-primary', 'color', '--color-feedback-error-primary'],
    ['hover\\\\:bg-filigran-brand-primary-transparency-10', 'background-color', '--color-filigran-brand-primary-transparency-10'],
    // The design system Chip of the welcome screen's suggestions (xtm-one#10911 UX round 2, B1).
    ['bg-feedback-neutral-secondary-transparency-30', 'background-color', '--color-feedback-neutral-secondary-transparency-30'],
    ['h-6', 'height', null],
    // The design system Button of the approval, artifact and retry actions (chatbot 3.23.0, slice 2).
    ['bg-filigran-brand-primary', 'background-color', '--color-filigran-brand-primary'],
    ['text-negative-primary', 'color', '--text-negative-primary'],
    ['hover\\\\:bg-filigran-brand-tertiary', 'background-color', '--color-filigran-brand-tertiary'],
    ['border-filigran-brand-primary-transparency-55', 'border-color', '--color-filigran-brand-primary-transparency-55'],
    ['text-content-button', 'font-size', '--text-content-button'],
    // The design system Menu of the view switcher (chatbot 3.23.0, slice 2).
    ['bg-elevation-highlight', 'background-color', '--bg-elevation-highlight'],
    ['data-\\\\\\[highlighted\\\\\\]\\\\:bg-input-hover', 'background-color', '--bg-input-hover'],
    ['text-input-value', 'color', '--text-input-value'],
    ['min-h-9', 'min-height', null],
    // Its group rule (the conversation row's move-to-workspace menu, slice 2).
    ['border-elevation-subtle', 'border-color', '--border-elevation-subtle'],
    // The one elevation shadow of every floating surface (menus, the floating panel, the reasoning dialog; slice 3).
    ['shadow-global-shadow', '--tw-shadow', '--shadow-global-shadow'],
    // The design-system type scale of every chat text (slice 3).
    ['text-content-compact', 'font-size', '--text-content-compact'],
    ['text-content-base', 'font-size', '--text-content-base'],
    ['text-title-jumbo', 'font-size', '--text-title-jumbo'],
    ['text-title-sm', 'font-size', '--text-title-sm'],
    ['text-title-md', 'font-size', '--text-title-md'],
  ]) {
    const matching = rules.filter((rule) => rule.selectors.some((selector) => hasClass(selector, name)));
    assert.ok(matching.length > 0, `.${name} is compiled`);
    for (const rule of matching) {
      for (const selector of rule.selectors) assert.ok(selector.includes(PANEL_SCOPE), `unscoped .${name}: ${selector}`);
      const decl = rule.nodes.find((node) => node.type === 'decl' && node.prop === prop);
      assert.ok(decl, `.${name} sets ${prop}`);
      if (token) assert.match(decl.value, new RegExp(`var\\(${token},`), `.${name} reads ${token} with a fallback: ${decl.value}`);
    }
  }
});

// Surfaces follow the design system (chatbot 3.23.0, slice 3): a colour literal
// lives only in the copy of its palette (`--chat-ds-*`) or in the code colours
// it has no token for (`--chat-default-hl-*`); every other rule reads a token.
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;
const LITERAL_ALLOWED = /^--chat-(?:ds-|default-hl-)/;

test('no colour literal in the stylesheet outside the design-system palette copy and the code colours', () => {
  const sourceRoot = postcss.parse(readFileSync(SOURCE, 'utf8'));
  const offending = [];
  sourceRoot.walkDecls((decl) => {
    if (COLOUR_LITERAL.test(decl.value) && !LITERAL_ALLOWED.test(decl.prop)) offending.push(`${decl.prop}: ${decl.value}`);
  });
  assert.deepEqual(offending, []);
});

test('no hand-written shadow or rgb colour in a component: the design-system elevation shadow only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/shadow-\[[^\]]*\]|\bshadow-(?:sm|md|lg|xl|2xl)\b|\brgba?\(/g)].map((m) => `${file.slice(SRC.length)}: ${m[0]}`);
  });
  assert.deepEqual(offending, []);
});

// Feedback colours read the panel's tones (`--chat-danger`, `--chat-warning`, `--chat-success`), which a host
// sets from its design system; a Tailwind palette shade (red-500, amber-600, emerald-400...) would ignore it.
test('no Tailwind palette shade in a component: the feedback tones and the design-system tokens only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [
      ...text.matchAll(
        /\b(?:text|bg|border|stroke|fill|ring|outline|from|to|via|decoration|divide|placeholder|caret)-(?:red|amber|emerald|green|yellow|orange|blue|gray|slate|zinc|neutral|stone|rose|pink|purple|violet|indigo|sky|cyan|teal|lime|fuchsia)-\d{2,3}\b/g,
      ),
    ].map((m) => `${file.slice(SRC.length)}: ${m[0]}`);
  });
  assert.deepEqual(offending, []);
});

// Busy indicators are the design-system Spinner (sizes, tone, reduced-motion stop): no hand-spun ring.
test('no hand-written spinner in a component: the design-system Spinner only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/\banimate-spin\b|from '\.\/Spinner'/g)].map((m) => `${file.slice(SRC.length)}: ${m[0]}`);
  });
  assert.deepEqual(offending, []);
});

// Chips and badges are the design-system Chip and Badge: no hand-drawn rounded, bordered, padded pill.
test('no hand-written pill in a component: the design-system Chip and Badge only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/rounded-full border[^"'`]*\bpx-|\bpx-1 [^"'`]*leading-4/g)].map((m) => `${file.slice(SRC.length)}: ${m[0]}`);
  });
  assert.deepEqual(offending, []);
});

// A size relative to its text (the footnote <sup> at 0.7em) is not a size of the scale and stays.
test('no arbitrary font size in a component: the design-system type scale only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/\btext-\[[0-9.]+(?:rem|px)\]/g)].map((m) => `${file.slice(SRC.length)}: ${m[0]}`);
  });
  assert.deepEqual(offending, []);
});

// UX round 1 of filigran-ui#521 (B5): the Tailwind size steps are not the design-system type scale either;
// a text uses a DS named style (text-content-compact / -base, text-title-sm / -md / -jumbo).
test('no Tailwind font size step in a component: the design-system named styles only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/(?<![\w-])text-(?:xs|sm|base|lg|[2-9]?xl)(?![\w-])/g)].map((m) => `${file.slice(SRC.length)}: ${m[0]}`);
  });
  assert.deepEqual(offending, []);
});

// UX round 2 of filigran-ui#521 (B2): an icon is drawn at a design-system Icon size (16 / 20 / 24),
// never forced to an arbitrary pixel size by its wrapper.
test('no arbitrary pixel size on an icon wrapper: the design-system Icon sizes only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/\[&>svg\]:(?:w|h|size)-\[[^\]]+\]/g)].map((m) => `${file.slice(SRC.length)}: ${m[0]}`);
  });
  assert.deepEqual(offending, []);
});

// UX round 2 of filigran-ui#521 (B1): a text field is the design-system Input (or SearchField / Textarea);
// the only raw <input>s left are the hidden file picker and the read-only markdown task checkbox.
test('no raw text input in a component: the design-system Input only', () => {
  const offending = sourceFiles(join(SRC, 'components')).flatMap((file) => {
    if (file.endsWith('.test.tsx') || file.endsWith('.test.ts')) return [];
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/<input\b[^>]*/g)]
      .filter((m) => !/type="(?:file|checkbox)"/.test(m[0]) && !/\n\s*type="file"/.test(text.slice(m.index, m.index + 400)))
      .map((m) => `${file.slice(SRC.length)}: ${m[0].slice(0, 40)}`);
  });
  assert.deepEqual(offending, []);
});
