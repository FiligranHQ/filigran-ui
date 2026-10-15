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

test('table cells: a named background color gets the tone a browser would compute', () => {
  assert.deepEqual(render('backgroundColor', 'yellow'), { style: 'background-color: yellow', 'data-cell-background': 'light' });
  assert.deepEqual(render('backgroundColor', 'navy'), { style: 'background-color: navy', 'data-cell-background': 'dark' });
});

test('table cells: white and grey-white backgrounds are marked near-white, tinted pale colors stay light', () => {
  assert.equal((render('backgroundColor', '#F2F2F2') as Record<string, string>)['data-cell-background'], 'near-white');
  assert.equal((render('backgroundColor', 'white') as Record<string, string>)['data-cell-background'], 'near-white');
  assert.equal((render('backgroundColor', '#D9E2F3') as Record<string, string>)['data-cell-background'], 'light');
  assert.equal((render('backgroundColor', '#FFF2CC') as Record<string, string>)['data-cell-background'], 'light');
});

test('table cells: pure black borders follow the text color, other colors are kept', () => {
  assert.equal(parse('border', cell('style="border: 1px solid #000000"')),
    'border-top: 1px solid currentcolor; border-right: 1px solid currentcolor; border-bottom: 1px solid currentcolor; border-left: 1px solid currentcolor');
  assert.equal(parse('border', cell('style="border-top: 1pt solid windowtext; border-bottom: 1px solid #4472C4"')),
    'border-top: 1pt solid currentcolor; border-bottom: 1px solid rgb(68, 114, 196)');
});
