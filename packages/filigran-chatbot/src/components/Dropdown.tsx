import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '../hooks/useClickOutside';
import { findChatbotRoot } from '../utils';

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: 'bottom-start' | 'bottom-end';
  width?: number;
  children: React.ReactNode;
}

/** Breathing room between the anchor and the panel, and from the viewport edge. */
const GAP = 4;
const EDGE_MARGIN = 8;

export const Dropdown = ({ open, onClose, anchorRef, placement = 'bottom-start', width = 280, children }: DropdownProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const stableOnClose = useCallback(() => onClose(), [onClose]);
  useClickOutside(panelRef, stableOnClose, open);

  // `useLayoutEffect`, not `useEffect`: the panel is measured after it mounts
  // and then moved, so doing it after paint would show it in the wrong place
  // for a frame.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 0;

    // Flip above the anchor when there isn't room below and there is more room
    // above. The composer toolbar sits at the bottom of the panel, so its
    // menus would otherwise open straight off the bottom edge and be
    // unreachable — the anchor's own position decides, so callers don't have
    // to know where they are.
    const spaceBelow = window.innerHeight - rect.bottom - EDGE_MARGIN;
    const spaceAbove = rect.top - EDGE_MARGIN;
    const flipUp = panelHeight > 0 && spaceBelow < panelHeight && spaceAbove > spaceBelow;
    const top = flipUp ? Math.max(EDGE_MARGIN, rect.top - panelHeight - GAP) : rect.bottom + GAP;

    // Keep it inside the viewport horizontally too: the floating panel is
    // narrow, so a menu anchored near its right edge would otherwise hang off.
    const preferredLeft = placement === 'bottom-end' ? rect.right - width : rect.left;
    const left = Math.max(EDGE_MARGIN, Math.min(preferredLeft, window.innerWidth - width - EDGE_MARGIN));

    setPos({ top, left });
  }, [open, anchorRef, placement, width, children]);

  if (!open) return null;

  const portalTarget = findChatbotRoot(anchorRef.current);

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[10000] rounded-[10px] overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2a2a3e] shadow-xl"
      style={{ top: pos.top, left: pos.left, width }}
    >
      {children}
    </div>,
    portalTarget,
  );
};
