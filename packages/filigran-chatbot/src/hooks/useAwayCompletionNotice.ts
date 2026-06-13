import { useEffect, useRef } from 'react';

/**
 * A turn must run at least this long before its completion is worth a
 * notification — instant replies never raise one.
 */
const MIN_NOTICE_MS = 4000;
/** Document-title flash cadence while the user is away. */
const TITLE_FLASH_MS = 1200;

let flashTimer: number | null = null;
let originalTitle: string | null = null;

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
   * but focused elsewhere. Lets the host raise its own in-app toast (the
   * chatbot has no toast surface of its own). Receives the translated strings.
   */
  onComplete?: (title: string, body: string) => void;
  /**
   * Returns true when the user's focus is within the chat surface. When
   * provided, the toast also fires if the user is in the app but looking
   * elsewhere (panel open in a corner while they work in the main app). When
   * omitted, only the away case triggers it.
   */
  isViewingChat?: () => boolean;
}

/**
 * Notify the user when a long-running turn finishes and they are not watching
 * the chat. State is read at completion (never latched mid-turn) so someone who
 * stepped away but returned before the turn finished is not pinged:
 *  - **Away** (tab hidden or another window/app focused): document-title flash +
 *    OS notification (when granted) + host toast.
 *  - **In-app but elsewhere** (window focused, focus outside the chat — only
 *    when `isViewingChat` is supplied): host toast only.
 *  - **Actively watching**: nothing — the streamed answer is the feedback.
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
    const clearOnReturn = () => {
      if (!document.hidden && document.hasFocus()) stopTitleFlash();
    };
    document.addEventListener('visibilitychange', clearOnReturn);
    window.addEventListener('focus', clearOnReturn);
    return () => {
      document.removeEventListener('visibilitychange', clearOnReturn);
      window.removeEventListener('focus', clearOnReturn);
      stopTitleFlash();
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
