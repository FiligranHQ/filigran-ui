/**
 * Unit tests for where a tooltip is drawn - `yarn test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ANCHOR_GAP, EDGE_MARGIN, placeTooltip, tooltipMaxWidth, tooltipOpening } from './tooltipPlacement.ts';

// A 360px side panel docked on the right of a 1280px window, below a 64px top bar.
const panel = { top: 64, bottom: 800, left: 920, right: 1280 };
const anchorAt = (left: number, top = 400) => ({ top, bottom: top + 20, left, right: left + 20 });
const LINE = 24;

/** The tooltip's box on screen: centred on its anchor, then shifted. */
function drawn(left: number, width: number, top = 400) {
  const opening = tooltipOpening(anchorAt(left, top), panel, 1280);
  const drawnWidth = Math.min(width, tooltipMaxWidth(opening));
  const { shift, below } = placeTooltip(opening, { width: drawnWidth, height: LINE });
  const start = opening.center + shift - drawnWidth / 2;
  return { start, end: start + drawnWidth, below, opening };
}

test('a tooltip with room is centred on its anchor', () => {
  const { start, end, opening } = drawn(1090, 100);
  assert.equal(start, opening.center - 50);
  assert.equal(end, opening.center + 50);
});

test('a tooltip near a side of the panel is shifted back inside it', () => {
  const right = drawn(1250, 200);
  assert.equal(right.end, panel.right - EDGE_MARGIN);
  const left = drawn(925, 200);
  assert.equal(left.start, panel.left + EDGE_MARGIN);
});

test('a tooltip wider than the panel is capped to it and fits whatever its anchor', () => {
  const opening = tooltipOpening(anchorAt(1250), panel, 1280);
  assert.equal(tooltipMaxWidth(opening), 360 - 2 * EDGE_MARGIN);
  for (const left of [925, 1090, 1250]) {
    const { start, end } = drawn(left, 900);
    assert.equal(start, panel.left + EDGE_MARGIN);
    assert.equal(end, panel.right - EDGE_MARGIN);
  }
});

test('the room ends at the viewport when the panel runs past it', () => {
  const opening = tooltipOpening(anchorAt(10), { top: -50, bottom: 700, left: -40, right: 2000 }, 1280);
  assert.equal(opening.minLeft, EDGE_MARGIN);
  assert.equal(opening.maxRight, 1280 - EDGE_MARGIN);
  assert.equal(opening.minTop, 0);
});

test('a tooltip opens below its anchor only when there is no room above', () => {
  assert.equal(drawn(1090, 100, 400).below, false);
  assert.equal(drawn(1090, 100, panel.top + LINE + ANCHOR_GAP).below, false);
  assert.equal(drawn(1090, 100, panel.top + LINE).below, true);
  // A label wrapped on three lines needs three lines of room.
  const opening = tooltipOpening(anchorAt(1090, panel.top + 2 * LINE), panel, 1280);
  assert.equal(placeTooltip(opening, { width: 300, height: 3 * LINE }).below, true);
  assert.equal(placeTooltip(opening, { width: 300, height: LINE }).below, false);
});
