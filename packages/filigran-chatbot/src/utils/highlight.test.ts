/**
 * Unit tests for the panel's code highlighter - `yarn test`: every language an
 * agent writes most is coloured, the tokens always join back to the input, and
 * an unknown language or a keyword inside a longer word stays plain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { highlightCode, highlightLanguage, MAX_HIGHLIGHT_LENGTH, type HighlightToken } from './highlight.ts';

const of = (tokens: HighlightToken[], type: HighlightToken['type']) => tokens.filter((token) => token.type === type).map((token) => token.text);
const joined = (tokens: HighlightToken[]) => tokens.map((token) => token.text).join('');

const SAMPLES: Record<string, string> = {
  python: 'import os\n\n@cache\ndef load(path: str) -> dict:\n    """Read it."""\n    # one line\n    return {"path": path, "size": 42, "ok": True}\n',
  typescript: "export async function fetchAll(ids: string[]): Promise<number> {\n  // count them\n  const total = ids.length * 2;\n  return `${total}` ? total : null;\n}\n",
  json: '{\n  "name": "panel",\n  "count": 3,\n  "enabled": true,\n  "tags": ["a", null]\n}\n',
  bash: '#!/usr/bin/env bash\n# install\nexport TOKEN="$HOME/.token"\nif [ -f $TOKEN ]; then\n  curl -sS --fail https://example.com | grep -c ok\nfi\n',
  sql: "-- top users\nSELECT u.id, COUNT(*) AS total\nFROM users u\nWHERE u.name = 'it''s' AND u.age > 18\nGROUP BY u.id ORDER BY total DESC LIMIT 10;\n",
};

for (const [language, code] of Object.entries(SAMPLES)) {
  test(`${language}: the tokens join back to the code, and some are coloured`, () => {
    const tokens = highlightCode(code, language);
    assert.equal(joined(tokens), code);
    assert.ok(tokens.some((token) => token.type !== 'plain'));
  });
}

test('python: keywords, strings, comments, numbers, literals and decorators', () => {
  const tokens = highlightCode(SAMPLES.python, 'python');
  assert.deepEqual(of(tokens, 'keyword'), ['import', 'def', 'return']);
  assert.ok(of(tokens, 'string').includes('"""Read it."""'));
  assert.deepEqual(of(tokens, 'comment'), ['# one line']);
  assert.deepEqual(of(tokens, 'number'), ['42']);
  assert.deepEqual(of(tokens, 'literal'), ['True']);
  assert.ok(of(tokens, 'function').includes('cache'));
  assert.ok(of(tokens, 'function').includes('load'));
});

test('typescript: keywords, template strings, comments and function names', () => {
  const tokens = highlightCode(SAMPLES.typescript, 'ts');
  for (const keyword of ['export', 'async', 'function', 'const', 'return']) assert.ok(of(tokens, 'keyword').includes(keyword), keyword);
  assert.deepEqual(of(tokens, 'comment'), ['// count them']);
  assert.ok(of(tokens, 'string').includes('`${total}`'));
  assert.deepEqual(of(tokens, 'function'), ['fetchAll']);
  assert.deepEqual(of(tokens, 'literal'), ['null']);
});

test('json: keys are properties, values strings, numbers and literals', () => {
  const tokens = highlightCode(SAMPLES.json, 'json');
  assert.deepEqual(of(tokens, 'property'), ['"name"', '"count"', '"enabled"', '"tags"']);
  assert.deepEqual(of(tokens, 'string'), ['"panel"', '"a"']);
  assert.deepEqual(of(tokens, 'number'), ['3']);
  assert.deepEqual(of(tokens, 'literal'), ['true', 'null']);
});

test('bash: comments, variables, flags, keywords and commands', () => {
  const tokens = highlightCode(SAMPLES.bash, 'sh');
  assert.deepEqual(of(tokens, 'comment'), ['#!/usr/bin/env bash', '# install']);
  assert.ok(of(tokens, 'variable').includes('$TOKEN'));
  assert.ok(of(tokens, 'property').includes('--fail'));
  for (const keyword of ['export', 'if', 'then', 'fi']) assert.ok(of(tokens, 'keyword').includes(keyword), keyword);
  assert.ok(of(tokens, 'builtin').includes('curl'));
});

test('sql: case-insensitive keywords, escaped quotes, functions and comments', () => {
  const tokens = highlightCode(SAMPLES.sql, 'postgresql');
  assert.deepEqual(of(tokens, 'comment'), ['-- top users']);
  assert.deepEqual(of(tokens, 'string'), ["'it''s'"]);
  assert.deepEqual(of(tokens, 'builtin'), ['COUNT']);
  for (const keyword of ['SELECT', 'AS', 'FROM', 'WHERE', 'AND', 'GROUP', 'BY', 'ORDER', 'DESC', 'LIMIT']) assert.ok(of(tokens, 'keyword').includes(keyword), keyword);
  assert.deepEqual(of(tokens, 'number'), ['18', '10']);
});

test('a keyword inside a longer word stays plain', () => {
  const tokens = highlightCode('classify(important, format)', 'python');
  assert.deepEqual(of(tokens, 'keyword'), []);
  assert.deepEqual(of(tokens, 'function'), ['classify']);
});

test('an unknown language, an empty block and an oversized block stay plain', () => {
  assert.equal(highlightLanguage('brainfuck'), null);
  assert.deepEqual(highlightCode('+[-->-[>>+>-----<<]<--<---]', 'brainfuck'), [{ type: 'plain', text: '+[-->-[>>+>-----<<]<--<---]' }]);
  assert.deepEqual(highlightCode('', 'python'), []);
  const large = 'x = 1\n'.repeat(MAX_HIGHLIGHT_LENGTH / 6 + 1);
  assert.deepEqual(highlightCode(large, 'python'), [{ type: 'plain', text: large }]);
});

test('an unterminated string or comment while streaming still joins back', () => {
  for (const [code, language] of [
    ['print("half', 'python'],
    ['/* open', 'ts'],
    ["SELECT 'open", 'sql'],
    ['echo "${HOME', 'bash'],
  ]) {
    assert.equal(joined(highlightCode(code, language)), code);
  }
});

test('aliases resolve to their language', () => {
  assert.equal(highlightLanguage('TSX'), 'javascript');
  assert.equal(highlightLanguage('py'), 'python');
  assert.equal(highlightLanguage('shell'), 'bash');
  assert.equal(highlightLanguage('yml'), 'yaml');
  assert.equal(highlightLanguage(undefined), null);
});
