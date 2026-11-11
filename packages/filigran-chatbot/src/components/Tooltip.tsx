import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { findChatbotRoot } from '../utils';
import {
  ANCHOR_GAP,
  TOOLTIP_OPEN_DELAY_MS,
  placeTooltip,
  tooltipMaxWidth,
  tooltipOpening,
  type TooltipOpening,
} from '../utils/tooltipPlacement';

interface TooltipProps {
  title: string;
  children: ReactElement;
  /**
   * For a label cut with an ellipsis: the tooltip says the whole text only
   * while its child is actually cut, and the wrapper may shrink with it.
   */
  truncated?: boolean;
  /** Layout of the wrapper, which is the anchor: `inline-flex` unless the control needs more (a width, a position). */
  className?: string;
}

/** Whether a label shows less than its text (an ellipsis is drawn). */
export const isCut = (el: Element | null): boolean => !!el && el.scrollWidth > el.clientWidth;

/** The design system's tooltip width. */
const TOOLTIP_MAX_WIDTH = 300;

/**
 * The panel's tooltip, drawn as the Filigran design system's `TooltipContent`:
 * the same surface (`bg-tooltip`), text colour, radius, padding, shadow,
 * typography (content-compact), 300px width, 8px offset and 300ms delay. Every
 * control of the panel uses it; a native `title` (the browser's white bubble)
 * is never used for a tooltip.
 *
 * The look is the `chat-tooltip` utility (assets/index.css), which reads the
 * design system's own tokens when the host loads them (`--border-elevation-subtle`,
 * `--text-default-primary`, ...), so the bubble is the host's tooltip exactly,
 * and falls back to the design system's values otherwise. It is not the
 * library component itself: that one portals to `document.body`, outside the
 * panel's stacking context, where a host bar would hide it (below).
 */
export const Tooltip = ({ title, children, truncated = false, className = 'inline-flex' }: TooltipProps) => {
  const wrapperClassName = truncated ? 'flex min-w-0 max-w-full' : className;
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opening, setOpening] = useState<TooltipOpening | null>(null);
  const [placement, setPlacement] = useState({ below: false, shift: 0 });

  // Its size is its text's, wrapped to the room there is: measured once shown,
  // before the browser paints it. The tooltip lives inside the panel's stacking
  // context (z-[1200] in sidebar mode), so anything drawn above the panel lands
  // in the host app's top-bar zone and is hidden whenever the host bar stacks
  // higher (e.g. OpenAEV's AppBar at theme.zIndex.drawer + 1).
  useLayoutEffect(() => {
    if (!opening || !tipRef.current) return;
    const { width, height } = tipRef.current.getBoundingClientRect();
    setPlacement(placeTooltip(opening, { width, height }));
  }, [opening, title]);

  useEffect(() => () => cancel(), []);

  // Escape closes it, as the design system's does.
  useEffect(() => {
    if (!opening) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpening(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [opening]);

  if (!title) return wrapperClassName === 'inline-flex' ? children : <span className={wrapperClassName}>{children}</span>;

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  const open = () => {
    cancel();
    if (!ref.current) return;
    if (truncated && !isCut(ref.current.firstElementChild)) return;
    const panel = findChatbotRoot(ref.current).getBoundingClientRect();
    setOpening(tooltipOpening(ref.current.getBoundingClientRect(), panel, window.innerWidth));
  };

  // A pointer passing over the controls does not flash every tooltip on its way.
  const openSoon = () => {
    cancel();
    timer.current = setTimeout(open, TOOLTIP_OPEN_DELAY_MS);
  };

  const close = () => {
    cancel();
    setOpening(null);
  };

  // A keyboard user reaches the control without hovering it, so its tooltip
  // opens on focus too - on keyboard focus only: a click also focuses, and the
  // hover has already shown the tooltip then.
  const handleFocus = (event: FocusEvent) => {
    const target = event.target as HTMLElement;
    if (typeof target.matches === 'function' && target.matches(':focus-visible')) open();
  };

  return (
    <span ref={ref} className={wrapperClassName} onMouseEnter={openSoon} onMouseLeave={close} onFocus={handleFocus} onBlur={close}>
      {children}
      {opening &&
        createPortal(
          <span
            ref={tipRef}
            className={`chat-tooltip pointer-events-none fixed z-[10001] w-max -translate-x-1/2 ${placement.below ? '' : '-translate-y-full'} whitespace-normal break-words`}
            style={{
              top: placement.below ? opening.bottom + ANCHOR_GAP : opening.top - ANCHOR_GAP,
              left: opening.center + placement.shift,
              maxWidth: Math.min(TOOLTIP_MAX_WIDTH, tooltipMaxWidth(opening)),
            }}
            role="tooltip"
            data-testid="filigran-chat-tooltip"
          >
            {title}
          </span>,
          findChatbotRoot(ref.current),
        )}
    </span>
  );
};
