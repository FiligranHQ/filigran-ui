import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { ChatConversationRef, ChatConversationReferenceCandidate } from '../types';
import {
  insertConversationReference,
  referenceMenuView,
  referenceTrigger,
  referencedConversations,
  type ReferenceMenuView,
  type ReferenceTrigger,
} from '../utils/conversationRefs';
import { useConversationReferenceSearch } from './useConversationReferenceSearch';

interface UseConversationReferenceMenuOptions {
  /** `conversationReferencesUrl(...)`: null while the feature is off. */
  url: string | null;
  requestHeaders?: Record<string, string>;
  /** The conversation written in: never offered. */
  conversationId?: string | null;
  text: string;
  onTextChange: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** The picks the composer holds, to tell when the message is full. */
  refs: ChatConversationRef[];
  /** Called with a pick before the text changes, so pruning sees it inserted. */
  onPick: (ref: ChatConversationRef) => void;
}

const sameTrigger = (a: ReferenceTrigger | null, b: ReferenceTrigger | null) =>
  a === b || (!!a && !!b && a.anchor === b.anchor && a.query === b.query);

/**
 * The composer's `@` menu: what typing `@` offers, and how a pick lands in the
 * text.
 *
 * The menu follows the caret, read from the field after every change of the
 * text - typed, dictated, a template, the clear after a send - and after every
 * move of the caret the caller reports through `sync`. The field keeps the
 * focus throughout: the menu is driven from its keys, and a row is picked on
 * `mousedown`.
 */
export function useConversationReferenceMenu({
  url,
  requestHeaders,
  conversationId,
  text,
  onTextChange,
  textareaRef,
  refs,
  onPick,
}: UseConversationReferenceMenuOptions) {
  const enabled = url !== null;
  const [trigger, setTrigger] = useState<ReferenceTrigger | null>(null);
  // Escape closes the menu for the `@` it was open on; a new `@` opens it again.
  const [dismissedAnchor, setDismissedAnchor] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingCaretRef = useRef<number | null>(null);
  const listboxId = useId();
  const optionId = useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);

  /** Read the caret: open, narrow or close the menu. */
  const sync = useCallback(() => {
    const el = textareaRef.current;
    const next =
      enabled && el && document.activeElement === el && el.selectionStart === el.selectionEnd
        ? referenceTrigger(el.value.slice(0, el.selectionStart))
        : null;
    setTrigger((prev) => (sameTrigger(prev, next) ? prev : next));
  }, [enabled, textareaRef]);

  const close = useCallback(() => setTrigger(null), []);

  // After a pick the caret goes after the inserted key, before `sync` reads it.
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [text, textareaRef]);

  useEffect(() => {
    sync();
  }, [text, sync]);

  useEffect(() => {
    if (!trigger) setDismissedAnchor(null);
  }, [trigger]);

  const search = useConversationReferenceSearch({ url, query: trigger?.query ?? null, exclude: conversationId, requestHeaders });

  // Every new answer starts on its first row.
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  const view: ReferenceMenuView = referenceMenuView({
    trigger,
    dismissed: trigger !== null && trigger.anchor === dismissedAnchor,
    search,
    referenced: referencedConversations(refs, text).length,
    exclude: conversationId,
  });
  const items = view.kind === 'results' ? view.items : [];
  const active = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const pick = (candidate: ChatConversationReferenceCandidate) => {
    if (!trigger) return;
    const inserted = insertConversationReference(text, trigger, candidate.key);
    onPick({ conversationId: candidate.id, title: candidate.title, key: candidate.key });
    pendingCaretRef.current = inserted.caret;
    onTextChange(inserted.text);
    setTrigger(null);
  };

  /** The menu's keys; true when the key was the menu's to handle. */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (view.kind === 'closed' || !trigger || e.nativeEvent.isComposing) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      setDismissedAnchor(trigger.anchor);
      return true;
    }
    if (items.length === 0) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((active + step + items.length) % items.length);
      return true;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
      e.preventDefault();
      pick(items[active]);
      return true;
    }
    return false;
  };

  // The field stays the focus, so the list is announced through it.
  const textareaAria = enabled
    ? {
        'aria-autocomplete': 'list' as const,
        'aria-controls': view.kind === 'results' ? listboxId : undefined,
        'aria-activedescendant': view.kind === 'results' ? optionId(active) : undefined,
      }
    : {};

  return { view, activeIndex: active, setActiveIndex, listboxId, optionId, sync, close, pick, onKeyDown, textareaAria };
}
