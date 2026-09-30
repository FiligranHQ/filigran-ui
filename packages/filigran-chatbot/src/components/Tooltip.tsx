import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findChatbotRoot } from '../utils';

interface TooltipProps {
  title: string;
  children: React.ReactElement;
}

// Approximate rendered tooltip height (text-xs + py-1) plus the 4px gap.
// Used to decide whether a top-placed tooltip would overflow the panel.
const TOOLTIP_CLEARANCE = 28;

/** Space kept between a tooltip and the side of the panel it would cross. */
const EDGE_MARGIN = 4;

export const Tooltip = ({ title, children }: TooltipProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [below, setBelow] = useState(false);
  const [shift, setShift] = useState(0);

  // Centred on its anchor, a long tooltip on a control near the panel's side
  // (the time under a message) would run past it - into the host page, or off
  // the screen. Measured once shown, since its width is the text's.
  useLayoutEffect(() => {
    if (!show || !tipRef.current || !ref.current) return;
    const tip = tipRef.current.getBoundingClientRect();
    const root = findChatbotRoot(ref.current).getBoundingClientRect();
    const minLeft = Math.max(root.left, 0) + EDGE_MARGIN;
    const maxRight = Math.min(root.right, window.innerWidth) - EDGE_MARGIN;
    const left = pos.left - tip.width / 2;
    if (left < minLeft) setShift(minLeft - left);
    else if (left + tip.width > maxRight) setShift(maxRight - (left + tip.width));
    else setShift(0);
  }, [show, pos, title]);

  if (!title) return children;

  const open = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // Flip below the anchor when a top-placed tooltip would extend above the
    // chatbot panel's top edge. The tooltip lives inside the panel's stacking
    // context (z-[1200] in sidebar mode), so anything drawn above the panel
    // lands in the host app's top-bar zone and is hidden whenever the host
    // bar stacks higher (e.g. OpenAEV's AppBar at theme.zIndex.drawer + 1).
    const rootTop = findChatbotRoot(ref.current).getBoundingClientRect().top;
    const flip = rect.top - rootTop < TOOLTIP_CLEARANCE;
    setBelow(flip);
    setShift(0);
    setPos({
      top: flip ? rect.bottom + 4 : rect.top - 4,
      left: rect.left + rect.width / 2,
    });
    setShow(true);
  };

  // A keyboard user reaches the control without hovering it, so its tooltip
  // opens on focus too - on keyboard focus only: a click also focuses, and the
  // hover has already shown the tooltip then.
  const handleFocus = (event: React.FocusEvent) => {
    const target = event.target as HTMLElement;
    if (typeof target.matches === 'function' && target.matches(':focus-visible')) open();
  };

  return (
    <span
      ref={ref}
      className="inline-flex"
      onMouseEnter={open}
      onMouseLeave={() => setShow(false)}
      onFocus={handleFocus}
      onBlur={() => setShow(false)}
    >
      {children}
      {show &&
        createPortal(
          <span
            ref={tipRef}
            className={`pointer-events-none fixed z-[10001] -translate-x-1/2 ${below ? '' : '-translate-y-full'} whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs text-white dark:text-gray-900 shadow-lg`}
            style={{ top: pos.top, left: pos.left + shift }}
            role="tooltip"
          >
            {title}
          </span>,
          findChatbotRoot(ref.current),
        )}
    </span>
  );
};
