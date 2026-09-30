import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findChatbotRoot } from '../utils';
import { ANCHOR_GAP, placeTooltip, tooltipMaxWidth, tooltipOpening, type TooltipOpening } from '../utils/tooltipPlacement';

interface TooltipProps {
  title: string;
  children: React.ReactElement;
}

export const Tooltip = ({ title, children }: TooltipProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
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

  if (!title) return children;

  const open = () => {
    if (!ref.current) return;
    const panel = findChatbotRoot(ref.current).getBoundingClientRect();
    setOpening(tooltipOpening(ref.current.getBoundingClientRect(), panel, window.innerWidth));
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
      onMouseLeave={() => setOpening(null)}
      onFocus={handleFocus}
      onBlur={() => setOpening(null)}
    >
      {children}
      {opening &&
        createPortal(
          <span
            ref={tipRef}
            className={`pointer-events-none fixed z-[10001] w-max -translate-x-1/2 ${placement.below ? '' : '-translate-y-full'} whitespace-normal break-words rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs text-white dark:text-gray-900 shadow-lg`}
            style={{
              top: placement.below ? opening.bottom + ANCHOR_GAP : opening.top - ANCHOR_GAP,
              left: opening.center + placement.shift,
              maxWidth: tooltipMaxWidth(opening),
            }}
            role="tooltip"
          >
            {title}
          </span>,
          findChatbotRoot(ref.current),
        )}
    </span>
  );
};
