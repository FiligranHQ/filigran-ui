import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseHtml } from '../paste/testDom.ts';
import { tableCellStyleAttributes } from './TableCellStyleAttributes.ts';

const cell = (attributes: string) => parseHtml(`<table><tr><td ${attributes}>x</td></tr></table>`).querySelector('td') as HTMLElement;
const parse = (name: string, element: HTMLElement) => (tableCellStyleAttributes[name].parseHTML as (element: HTMLElement) => unknown)(element);
const render = (name: string, value: string) => (tableCellStyleAttributes[name].renderHTML as (attributes: Record<string, unknown>) => unknown)({ [name]: value });

test('table cells: bgcolor only gives a background color, never other CSS', () => {
  assert.equal(parse('backgroundColor', cell('bgcolor="#FFFF00"')), 'rgb(255, 255, 0)');
  assert.equal(parse('backgroundColor', cell('bgcolor="red;background-image:url(https://example.com/t.png);position:fixed;inset:0;z-index:9999"')), null);
});

test('table cells: stored styles are rendered through the CSS parser', () => {
  assert.deepEqual(render('backgroundColor', 'red; position: fixed'), {});
  assert.deepEqual(render('border', 'border-top: 1px solid red; position: fixed; z-index: 9999'), { style: 'border-top: 1px solid red' });
});
