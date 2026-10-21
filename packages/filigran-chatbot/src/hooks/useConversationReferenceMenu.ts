import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { ChatConversationRef, ChatConversationReferenceCandidate, XtmAgent } from '../types';
import { agentCandidates, type AgentMention } from '../utils/agentMentions';
import {
  insertConversationReference,
  refAsCandidate,
  referenceMenuView,
  rememberAnswer,
  rememberCandidates,
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
  /** The agents `@` can mention, above the conversations; omitted when mentions are off. */
  agentMentions?: { agents: XtmAgent[]; onPick: (mention: AgentMention) => void };
}

/** A row of the `@` menu. */
export type ReferenceMenuItem = { type: 'agent'; mention: AgentMention } | { type: 'conversation'; candidate: ChatConversationReferenceCandidate };

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
  agentMentions,
}: UseConversationReferenceMenuOptions) {
  const enabled = url !== null || !!agentMentions;
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

  // Every conversation the menu has offered, matched locally by key and title
  // (`referenceMenuView`'s `known`), with the draft's picks.
  // A settled answer also drops the remembered rows it should have listed
  // (deleted, unshared since); another conversation starts from nothing.
  const [seen, setSeen] = useState<ChatConversationReferenceCandidate[]>([]);
  useEffect(() => {
    setSeen([]);
  }, [conversationId]);
  useEffect(() => {
    setSeen((prev) => rememberAnswer(prev, search, conversationId));
  }, [search, conversationId]);
  const known = useMemo(() => rememberCandidates(refs.map(refAsCandidate), seen), [refs, seen]);

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
    known,
  });
  const dismissed = trigger !== null && trigger.anchor === dismissedAnchor;
  const agentRows = useMemo(
    () => (agentMentions && trigger && !dismissed ? agentCandidates(agentMentions.agents, trigger.query) : []),
    [agentMentions, trigger, dismissed],
  );
  const items: ReferenceMenuItem[] = [
    ...agentRows.map((mention) => ({ type: 'agent' as const, mention })),
    ...(url !== null && view.kind === 'results' ? view.items.map((candidate) => ({ type: 'conversation' as const, candidate })) : []),
  ];
  const active = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const pick = (item: ReferenceMenuItem) => {
    if (!trigger) return;
    const key = item.type === 'agent' ? item.mention.key : item.candidate.key;
    const inserted = insertConversationReference(text, trigger, key);
    if (item.type === 'agent') agentMentions?.onPick(item.mention);
    else onPick({ conversationId: item.candidate.id, title: item.candidate.title, key, isOwn: item.candidate.isOwn });
    pendingCaretRef.current = inserted.caret;
    onTextChange(inserted.text);
    setTrigger(null);
  };

  /** The menu's keys; true when the key was the menu's to handle. */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if ((view.kind === 'closed' && items.length === 0) || !trigger || e.nativeEvent.isComposing) return false;
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
        'aria-controls': items.length > 0 ? listboxId : undefined,
        'aria-activedescendant': items.length > 0 ? optionId(active) : undefined,
      }
    : {};

  // Without conversation references, an agent-only menu: no conversation states to say.
  const shownView: ReferenceMenuView = url === null ? { kind: 'closed' } : view;
  return { view: shownView, items, activeIndex: active, setActiveIndex, listboxId, optionId, sync, close, pick, onKeyDown, textareaAria };
}
