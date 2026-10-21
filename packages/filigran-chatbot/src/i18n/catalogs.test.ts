/**
 * Unit tests for the panel's own translations - `yarn test`: every key the
 * source translates is in every catalog, with its placeholders, and a host's
 * own translation wins over the catalog.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { catalogFor, createTranslate, PANEL_LANGUAGES } from './index.ts';
import { panelKeys } from './keys.ts';

const keys = panelKeys(fileURLToPath(new URL('..', import.meta.url)));
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();

test('the source translates a known set of keys', () => {
  assert.ok(keys.length > 200, `found only ${keys.length} keys: the extraction patterns no longer match the source`);
});

for (const language of PANEL_LANGUAGES) {
  test(`the ${language} catalog holds every key, and nothing else`, () => {
    const catalog = catalogFor(language)!;
    assert.deepEqual(
      keys.filter((k) => !(k in catalog)),
      [],
      'missing',
    );
    assert.deepEqual(
      Object.keys(catalog).filter((k) => !keys.includes(k)),
      [],
      'no longer used',
    );
  });

  test(`the ${language} catalog keeps every placeholder and leaves nothing blank`, () => {
    const catalog = catalogFor(language)!;
    for (const key of keys) {
      assert.ok(catalog[key]?.trim(), `${key} is blank`);
      assert.equal(placeholders(catalog[key]), placeholders(key), `${key} → ${catalog[key]}`);
    }
  });
}

test('a locale picks its language, whatever its region', () => {
  assert.equal(catalogFor('fr-CA'), catalogFor('fr'));
  assert.equal(catalogFor('ja_JP'), catalogFor('ja'));
  assert.equal(catalogFor('en-US'), undefined);
  assert.equal(catalogFor('pt-BR'), undefined);
});

test("the host's translation wins; a key it returns unchanged falls back to the catalog", () => {
  const french = catalogFor('fr')!;
  const host = (key: string) => (key === 'Send' ? 'Envoyer maintenant' : key);
  const t = createTranslate(host, 'fr-FR');
  assert.equal(t('Send'), 'Envoyer maintenant');
  assert.equal(t('Stopped'), french.Stopped);
  assert.equal(createTranslate(undefined, 'en')('Stopped'), 'Stopped');
  assert.equal(createTranslate(undefined, 'fr')('A key no catalog has'), 'A key no catalog has');
});

test("without t or locale, the panel speaks the browser's language; with t and no locale, English", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { language: 'ja-JP' }, configurable: true });
  try {
    assert.equal(createTranslate(undefined, undefined)('Stopped'), catalogFor('ja')!.Stopped);
    assert.equal(createTranslate((key) => key, undefined)('Stopped'), 'Stopped');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
});
