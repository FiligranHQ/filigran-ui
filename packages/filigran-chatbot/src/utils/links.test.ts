/**
 * Unit tests of the addresses a host gives the panel to open - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { inPlaceHref } from './links.ts';

const PAGE = 'https://app.example/chat?c=c1';

test('an http(s) URL or a path of the page’s origin is followed', () => {
  assert.equal(inPlaceHref('https://xtm.example/agents/a1', PAGE), 'https://xtm.example/agents/a1');
  assert.equal(inPlaceHref(' /agents/a1?tab=chat ', PAGE), '/agents/a1?tab=chat');
});

test('an address that leaves the origin once the browser reads it links nothing', () => {
  for (const raw of ['/\t/evil.example', '/\n/evil.example', '//evil.example', '/\\evil.example', '/\\\\evil.example']) {
    assert.equal(inPlaceHref(raw, PAGE), undefined, JSON.stringify(raw));
  }
});

test('any other scheme, or a relative address, links nothing', () => {
  for (const raw of ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'agents/a1', '', undefined]) {
    assert.equal(inPlaceHref(raw, PAGE), undefined, String(raw));
  }
});

test('a page with an opaque origin still follows its paths, and still refuses another host', () => {
  for (const page of ['file:///opt/app/index.html', 'about:srcdoc']) {
    assert.equal(inPlaceHref('/agents/a1', page), '/agents/a1', page);
    assert.equal(inPlaceHref('//evil.example', page), undefined, page);
    assert.equal(inPlaceHref('/\\evil.example', page), undefined, page);
  }
});

test('a path the browser reads as a malformed host links nothing, and throws nothing', () => {
  for (const raw of ['//[', '//a b/x', '/\\[']) {
    assert.equal(inPlaceHref(raw, PAGE), undefined, JSON.stringify(raw));
  }
});
