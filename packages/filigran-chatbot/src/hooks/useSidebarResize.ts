import { useEffect, useRef, useState } from 'react';
import type { ChatMode } from '../types';

const SIDEBAR_WIDTH = 400;
const SIDEBAR_WIDTH_STORAGE_KEY = 'filigranChatSidebarWidth';
const MAX_SIDEBAR_RATIO = 0.4;

interface UseSidebarResizeOptions {
  mode: ChatMode;
  resizable: boolean;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

interface UseSidebarResizeReturn {
  sidebarWidth: number;
  handleResizeStart: (e: React.MouseEvent) => void;
  defaultWidth: number;
}

export function useSidebarResize({
  mode,
  resizable,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: UseSidebarResizeOptions): UseSidebarResizeReturn {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return SIDEBAR_WIDTH;
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed >= SIDEBAR_WIDTH) return parsed;
    }
    return SIDEBAR_WIDTH;
  });

  const isResizingRef = useRef(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;
  const onResizeEndRef = useRef(onResizeEnd);
  onResizeEndRef.current = onResizeEnd;

  // Notify parent of sidebar width when entering sidebar mode
  useEffect(() => {
    if (mode === 'sidebar' && resizable) {
      onWidthChangeRef.current?.(sidebarWidthRef.current);
    }
  }, [mode, resizable]);

  // Resize event handlers
  useEffect(() => {
    if (mode !== 'sidebar' || !resizable) return undefined;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      e.preventDefault();
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = window.innerWidth * MAX_SIDEBAR_RATIO;
      const clamped = Math.min(Math.max(newWidth, SIDEBAR_WIDTH), maxWidth);
      setSidebarWidth(clamped);
      sidebarWidthRef.current = clamped;
      onWidthChangeRef.current?.(clamped);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthRef.current));
      onResizeEndRef.current?.();
    };

    const handleWindowResize = () => {
      const maxWidth = window.innerWidth * MAX_SIDEBAR_RATIO;
      if (sidebarWidthRef.current > maxWidth) {
        const clamped = Math.max(maxWidth, SIDEBAR_WIDTH);
        setSidebarWidth(clamped);
        sidebarWidthRef.current = clamped;
        onWidthChangeRef.current?.(clamped);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [mode, resizable]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    onResizeStart?.();
  };

  return {
    sidebarWidth,
    handleResizeStart,
    defaultWidth: SIDEBAR_WIDTH,
  };
}
