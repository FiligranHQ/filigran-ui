/**
 * Where a tooltip is drawn.
 *
 * It is centred above its anchor. Near the side of the panel (the time under a
 * message) it would run past it - into the host page, or off the screen - and
 * near the top it would run above it, into the host app's top bar. So its width
 * is capped to the room there is (a long label wraps instead), it is shifted back
 * inside, and it opens below its anchor when there is no room above.
 */

/** Space between a tooltip and its anchor. */
export const ANCHOR_GAP = 4;

/** Space kept between a tooltip and the side of the panel it would cross. */
export const EDGE_MARGIN = 4;

/** A box in viewport coordinates, as `getBoundingClientRect` returns it. */
export interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** A tooltip's anchor and the room it may take: the part of the panel inside the viewport, less the margins. */
export interface TooltipOpening {
  readonly top: number;
  readonly bottom: number;
  readonly center: number;
  readonly minTop: number;
  readonly minLeft: number;
  readonly maxRight: number;
}

export interface TooltipPlacement {
  /** Drawn below its anchor instead of above. */
  readonly below: boolean;
  /** Horizontal offset from the anchor's centre that keeps it inside. */
  readonly shift: number;
}

export function tooltipOpening(anchor: Box, panel: Box, viewportWidth: number): TooltipOpening {
  return {
    top: anchor.top,
    bottom: anchor.bottom,
    center: (anchor.left + anchor.right) / 2,
    minTop: Math.max(panel.top, 0),
    minLeft: Math.max(panel.left, 0) + EDGE_MARGIN,
    maxRight: Math.min(panel.right, viewportWidth) - EDGE_MARGIN,
  };
}

/** The widest a tooltip may be drawn: wider than that, it would cross the panel's side whatever its shift. */
export function tooltipMaxWidth(opening: TooltipOpening): number {
  return Math.max(opening.maxRight - opening.minLeft, 0);
}

/** Places a tooltip of the measured size, drawn no wider than `tooltipMaxWidth`. */
export function placeTooltip(opening: TooltipOpening, size: { readonly width: number; readonly height: number }): TooltipPlacement {
  const left = opening.center - size.width / 2;
  let shift = 0;
  if (left < opening.minLeft) shift = opening.minLeft - left;
  else if (left + size.width > opening.maxRight) shift = opening.maxRight - (left + size.width);
  return { below: opening.top - ANCHOR_GAP - size.height < opening.minTop, shift };
}
