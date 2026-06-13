import { useEffect, useRef } from 'react';

/**
 * A turn must run at least this long before its completion is worth an
 * away-notification — instant replies never raise one.
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
 * even from another tab. The flash is stopped (and the title restored) the
 * moment the tab regains focus by the hook-scoped listeners below. Title
 * flashing needs no permission and is the reliable baseline of the completion
 * notification.
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
 * unprompted: the title flash (and host toast) cover the case where OS
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
  /** Host hook fired on an away-completion (e.g. to raise an in-app toast). */
  onComplete?: () => void;
}

/**
 * Raise a discreet notification when a long-running turn finishes while the
 * user is away (tab hidden / multitasking). When the user is actively
 * watching, the streamed answer is itself the feedback, so nothing fires.
 */
export function useAwayCompletionNotice({ isLoading, agentName, t, enabled = true, onComplete }: UseAwayCompletionNoticeOptions): void {
  const wasLoadingRef = useRef(false);
  const startRef = useRef(0);
  const sawHiddenRef = useRef(false);

  // Stop the flash and restore the title as soon as the user returns to the
  // tab. Bound only while the feature is enabled and torn down on unmount (or
  // when the host disables it), so we never leak listeners or leave the title
  // flashing after the panel is gone.
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const clearOnReturn = () => {
      if (!document.hidden) stopTitleFlash();
    };
    document.addEventListener('visibilitychange', clearOnReturn);
    window.addEventListener('focus', clearOnReturn);
    return () => {
      document.removeEventListener('visibilitychange', clearOnReturn);
      window.removeEventListener('focus', clearOnReturn);
      stopTitleFlash();
    };
  }, [enabled]);

  // Track whether the tab was hidden at any point during the turn. Skipped
  // entirely when the feature is disabled.
  useEffect(() => {
    if (!enabled || !isLoading) return;
    const onVisibility = () => {
      if (document.hidden) sawHiddenRef.current = true;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, isLoading]);

  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = isLoading;

    if (isLoading && !wasLoading) {
      startRef.current = Date.now();
      sawHiddenRef.current = typeof document !== 'undefined' && document.hidden;
      return;
    }

    if (!isLoading && wasLoading && enabled) {
      const elapsed = Date.now() - startRef.current;
      const away = sawHiddenRef.current || (typeof document !== 'undefined' && document.hidden);
      if (elapsed >= MIN_NOTICE_MS && away) {
        const title = t('Response ready');
        const body = agentName ? `${agentName} ${t('has finished')}` : t('Your answer is ready');
        startTitleFlash(title);
        notifyOS(title, body);
        onComplete?.();
      }
    }
  }, [isLoading, enabled, agentName, t, onComplete]);
}
