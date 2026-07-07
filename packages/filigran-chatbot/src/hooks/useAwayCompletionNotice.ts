import { useEffect, useRef } from 'react';

/**
 * A turn must run at least this long before its completion is worth a
 * notification — instant replies never raise one.
 */
const MIN_NOTICE_MS = 4000;
/** Document-title flash cadence while the user is away. */
const TITLE_FLASH_MS = 1200;

// The document title is a single page-global resource, so the flash is shared
// across hook instances on purpose (per-hook timers would fight over the one
// `document.title` and clobber each other's saved title). `activeHooks` ref-
// counts mounted, enabled instances so one panel unmounting never cancels a
// flash another panel still owns — only the last one to leave restores it.
let flashTimer: number | null = null;
let originalTitle: string | null = null;
let activeHooks = 0;

/** Stop flashing and restore the page title captured when the flash began. */
function stopTitleFlash(): void {
  if (flashTimer !== null) {
    window.clearInterval(flashTimer);
    flashTimer = null;
  }
  if (originalTitle !== null) {
    document.title = originalTitle;
    originalTitle = null;
  }
}

/**
 * Flash the document title so a multitasking user notices the answer landed
 * even from another tab or window. The flash is stopped (and the title
 * restored) the moment the tab is visible AND focused again, by the
 * hook-scoped listeners below. Title flashing needs no permission and is the
 * reliable baseline of the completion notification.
 */
function startTitleFlash(message: string): void {
  if (typeof document === 'undefined') return;
  if (originalTitle === null) originalTitle = document.title;
  if (flashTimer !== null) window.clearInterval(flashTimer);
  let showMessage = true;
  document.title = message;
  flashTimer = window.setInterval(() => {
    showMessage = !showMessage;
    document.title = showMessage ? message : (originalTitle ?? message);
  }, TITLE_FLASH_MS);
}

/**
 * Best-effort OS notification — only fired when the user has already granted
 * permission. We deliberately never call `Notification.requestPermission()`
 * unprompted: the title flash (and the host toast) cover the case where OS
 * notifications are unavailable.
 */
function notifyOS(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, { body, tag: 'filigran-chat-complete' });
  } catch {
    /* Notification constructor can throw on some platforms — ignore. */
  }
}

interface UseAwayCompletionNoticeOptions {
  /** True while a response is being generated. */
  isLoading: boolean;
  /** Name of the answering agent, used in the notification body. */
  agentName: string;
  t: (key: string) => string;
  /** Master switch (default true). */
  enabled?: boolean;
  /**
   * Host hook fired when a long turn finishes and the user is not actively
   * watching the chat — either away (tab hidden / another window) or in-app
   * with the chat surface closed/hidden (`isViewingChat` reports not-viewing).
   * Lets the host raise its own in-app toast (the chatbot has no toast surface
   * of its own). Receives the translated strings.
   */
  onComplete?: (title: string, body: string) => void;
  /**
   * Returns true when the chat surface is on screen for the user (the panel is
   * open and visible) — NOT merely whether focus sits inside it. When provided,
   * the notice also fires if the chat surface is hidden/closed while the tab is
   * still focused (e.g. a docked sidebar the host has collapsed). It must NOT
   * key on focus-within: in sidebar/floating mode the user reads a streamed
   * answer while their focus stays in the host app, and pinging them for an
   * answer they can already see is exactly the noise this guards against. When
   * omitted, only the away case (tab hidden / window unfocused) triggers it.
   */
  isViewingChat?: () => boolean;
}

/**
 * Notify the user when a long-running turn finishes and they are not watching
 * the chat. State is read at completion (never latched mid-turn) so someone who
 * stepped away but returned before the turn finished is not pinged:
 *  - **Away** (tab hidden or another window/app focused): document-title flash +
 *    OS notification (when granted) + host toast.
 *  - **Surface not visible** (window focused & tab visible, but the chat panel
 *    is closed/hidden — only when `isViewingChat` reports not-viewing): host
 *    toast only.
 *  - **Actively watching** (tab visible, window focused, panel on screen):
 *    nothing — the streamed answer is itself the feedback.
 */
export function useAwayCompletionNotice({
  isLoading,
  agentName,
  t,
  enabled = true,
  onComplete,
  isViewingChat,
}: UseAwayCompletionNoticeOptions): void {
  const wasLoadingRef = useRef(false);
  const startRef = useRef(0);

  // Stop the flash and restore the title as soon as the user returns to a
  // visible, focused tab. Bound only while enabled and torn down on unmount (or
  // when the host disables it), so we never leak listeners or leave the title
  // flashing after the panel is gone.
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    activeHooks += 1;
    const clearOnReturn = () => {
      if (!document.hidden && document.hasFocus()) stopTitleFlash();
    };
    document.addEventListener('visibilitychange', clearOnReturn);
    window.addEventListener('focus', clearOnReturn);
    return () => {
      document.removeEventListener('visibilitychange', clearOnReturn);
      window.removeEventListener('focus', clearOnReturn);
      activeHooks = Math.max(0, activeHooks - 1);
      // Only restore the title once the last consumer leaves, so unmounting one
      // panel never cancels another panel's in-flight flash.
      if (activeHooks === 0) stopTitleFlash();
    };
  }, [enabled]);

  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = isLoading;

    if (isLoading && !wasLoading) {
      startRef.current = Date.now();
      return;
    }

    if (!isLoading && wasLoading && enabled) {
      const elapsed = Date.now() - startRef.current;
      if (elapsed < MIN_NOTICE_MS) return;
      const hidden = typeof document !== 'undefined' && document.hidden;
      const unfocused = typeof document !== 'undefined' && !document.hasFocus();
      const away = hidden || unfocused;
      const viewingChat = isViewingChat ? isViewingChat() : true;
      // Focused tab + looking at the chat → the streamed answer is the feedback.
      if (!away && viewingChat) return;
      const title = t('Response ready');
      const body = agentName ? `${agentName} ${t('has finished')}` : t('Your answer is ready');
      if (away) {
        startTitleFlash(title);
        notifyOS(title, body);
      }
      onComplete?.(title, body);
    }
  }, [isLoading, enabled, agentName, t, onComplete, isViewingChat]);
}
