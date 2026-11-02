/**
 * Unit tests of the addresses a host gives the panel to open - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { inPlaceHref } from './links.ts';

const ORIGIN = 'https://app.example';

test('an http(s) URL or a path of the page’s origin is followed', () => {
  assert.equal(inPlaceHref('https://xtm.example/agents/a1', ORIGIN), 'https://xtm.example/agents/a1');
  assert.equal(inPlaceHref(' /agents/a1?tab=chat ', ORIGIN), '/agents/a1?tab=chat');
});

test('an address that leaves the origin once the browser reads it links nothing', () => {
  for (const raw of ['/\t/evil.example', '/\n/evil.example', '//evil.example', '/\\evil.example', '/\\\\evil.example']) {
    assert.equal(inPlaceHref(raw, ORIGIN), undefined, JSON.stringify(raw));
  }
});

test('any other scheme, or a relative address, links nothing', () => {
  for (const raw of ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'agents/a1', '', undefined]) {
    assert.equal(inPlaceHref(raw, ORIGIN), undefined, String(raw));
  }
});
