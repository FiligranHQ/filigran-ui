import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '../hooks/useClickOutside';

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: 'bottom-start' | 'bottom-end';
  width?: number;
  children: React.ReactNode;
}

export const Dropdown = ({ open, onClose, anchorRef, placement = 'bottom-start', width = 280, children }: DropdownProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const stableOnClose = useCallback(() => onClose(), [onClose]);
  useClickOutside(panelRef, stableOnClose, open);

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const left = placement === 'bottom-end' ? rect.right - width : rect.left;
    setPos({ top: rect.bottom + 4, left });
  }, [open, anchorRef, placement, width]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[10000] rounded-[10px] overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2a2a3e] shadow-xl"
      style={{ top: pos.top, left: pos.left, width }}
    >
      {children}
    </div>,
    document.body,
  );
};
