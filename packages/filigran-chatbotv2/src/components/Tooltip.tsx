import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  title: string;
  children: React.ReactElement;
}

export const Tooltip = ({ title, children }: TooltipProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  if (!title) return children;

  const handleEnter = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.top - 4,
      left: rect.left + rect.width / 2,
    });
    setShow(true);
  };

  return (
    <span
      ref={ref}
      className="inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show &&
        createPortal(
          <span
            className="pointer-events-none fixed z-[10001] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs text-white dark:text-gray-900 shadow-lg"
            style={{ top: pos.top, left: pos.left }}
            role="tooltip"
          >
            {title}
          </span>,
          document.body,
        )}
    </span>
  );
};
