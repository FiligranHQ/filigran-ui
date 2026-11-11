import type { ChatPanelMode } from '../types';

/**
 * How the panel lays its conversation out, by the room it is given rather
 * than by the screen: a page (`inline`, the host's own page) and full screen
 * read like a document, a reading column centred at a bounded width; a docked
 * side panel (`sidebar`) and a floating window fill what they have with
 * compact gutters. The widths below are the design system's spacing scale
 * (`max-w-200` = 800 px, `max-w-220` = 880 px, the second from a 1536 px wide
 * panel on), read through a container query on the panel, so a resized panel
 * keeps the rules by its own width.
 */
export type ChatDisplayMode = 'page' | 'fullscreen' | 'docked' | 'floating';

export function chatDisplayMode(mode: ChatPanelMode): ChatDisplayMode {
  switch (mode) {
    case 'inline':
      return 'page';
    case 'fullscreen':
      return 'fullscreen';
    case 'sidebar':
      return 'docked';
    default:
      return 'floating';
  }
}

/** A page or full screen: a reading column, never full bleed. */
export function readsAsColumn(display: ChatDisplayMode): boolean {
  return display === 'page' || display === 'fullscreen';
}

/**
 * The classes of the reading column the transcript and the composer share,
 * so their left edges align at every width. Empty in a docked panel or a
 * floating window: the column fills them.
 */
export function chatColumnClass(display: ChatDisplayMode): string {
  return readsAsColumn(display) ? 'mx-auto w-full max-w-200 @min-[96rem]:max-w-220' : 'w-full';
}

/** The transcript's side gutters: roomy around a reading column, compact in a panel. */
export function chatGutterClass(display: ChatDisplayMode): string {
  return readsAsColumn(display) ? 'px-6' : 'px-3 @min-[28rem]:px-4';
}

/**
 * The conversation list's width (page and full screen only), in px: 260 by
 * default, dragged between 220 and the smaller of 360 and a quarter of the
 * panel, and a double-click puts 260 back.
 */
export const LIST_WIDTH = { min: 220, default: 260, max: 360 } as const;
/** The narrowest the conversation itself may get beside the list. */
export const MIN_CHAT_COLUMN = 680;
/** The collapsed list: a 48 px rail of icon buttons (`w-12`). */
export const LIST_RAIL_WIDTH = 48;

export interface ListLayout {
  /** The widest the list may be dragged in this panel. */
  max: number;
  /** The width it is drawn at. */
  width: number;
  /** No room for the list beside a readable conversation: it shows as its rail. */
  rail: boolean;
}

/**
 * Where the list's edge may go in a panel `panelWidth` px wide, for the width
 * the user chose: never wider than 360 px nor a quarter of the panel, and
 * never so wide the conversation beside it falls under 680 px. Short of room
 * it shrinks to its minimum, then folds to its rail. An unknown panel width
 * (not measured yet) leaves the user's choice within the fixed bounds.
 */
export function listLayout(panelWidth: number | null, chosen: number): ListLayout {
  const fixed = Math.round(Math.min(Math.max(chosen, LIST_WIDTH.min), LIST_WIDTH.max));
  if (panelWidth === null || !Number.isFinite(panelWidth) || panelWidth <= 0) {
    return { max: LIST_WIDTH.max, width: fixed, rail: false };
  }
  const room = Math.floor(Math.min(LIST_WIDTH.max, panelWidth / 4, panelWidth - MIN_CHAT_COLUMN));
  // Not even its minimum fits beside a readable conversation: the rail.
  if (room < LIST_WIDTH.min) return { max: LIST_WIDTH.min, width: LIST_RAIL_WIDTH, rail: true };
  return { max: room, width: Math.min(fixed, room), rail: false };
}
