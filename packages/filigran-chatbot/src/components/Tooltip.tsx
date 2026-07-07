import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findChatbotRoot } from '../utils';

interface TooltipProps {
  title: string;
  children: React.ReactElement;
}

// Approximate rendered tooltip height (text-xs + py-1) plus the 4px gap.
// Used to decide whether a top-placed tooltip would overflow the panel.
const TOOLTIP_CLEARANCE = 28;

export const Tooltip = ({ title, children }: TooltipProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [below, setBelow] = useState(false);

  if (!title) return children;

  const handleEnter = () => {
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
    setPos({
      top: flip ? rect.bottom + 4 : rect.top - 4,
      left: rect.left + rect.width / 2,
    });
    setShow(true);
  };

  return (
    <span ref={ref} className="inline-flex" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show &&
        createPortal(
          <span
            className={`pointer-events-none fixed z-[10001] -translate-x-1/2 ${below ? '' : '-translate-y-full'} whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs text-white dark:text-gray-900 shadow-lg`}
            style={{ top: pos.top, left: pos.left }}
            role="tooltip"
          >
            {title}
          </span>,
          findChatbotRoot(ref.current),
        )}
    </span>
  );
};
