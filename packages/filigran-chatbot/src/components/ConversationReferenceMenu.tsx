import { useLayoutEffect, useRef } from 'react';
import type { ChatConversationReferenceCandidate } from '../types';
import { translate } from '../utils';
import { MAX_REFERENCED_CONVERSATIONS, type ReferenceMenuView } from '../utils/conversationRefs';
import { MessageSquareIcon } from './icons';

interface ConversationReferenceMenuProps {
  view: ReferenceMenuView;
  activeIndex: number;
  listboxId: string;
  optionId: (index: number) => string;
  onHover: (index: number) => void;
  onPick: (candidate: ChatConversationReferenceCandidate) => void;
  t: (key: string) => string;
}

/**
 * The composer's `@` menu, driven by `useConversationReferenceMenu`: the
 * conversations a message can reference, opened above the field. The field
 * keeps the focus - the rows are options it points at, picked on `mousedown`
 * so a click never takes the focus away from the text being written.
 */
export const ConversationReferenceMenu = ({ view, activeIndex, listboxId, optionId, onHover, onPick, t }: ConversationReferenceMenuProps) => {
  const listRef = useRef<HTMLDivElement>(null);

  // The row the arrows reached stays in view in a list longer than the menu.
  useLayoutEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, view.kind]);

  if (view.kind === 'closed') return null;
  const heading = t('Reference a conversation');

  return (
    <div className="absolute left-0 right-0 bottom-full mb-1.5 z-20 rounded-[10px] overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2a2a3e] shadow-xl">
      <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">{heading}</span>

      {view.kind === 'results' && (
        <div ref={listRef} id={listboxId} role="listbox" aria-label={heading} className="max-h-[240px] overflow-y-auto pb-1 filigran-chat-scrollable">
          {view.items.map((c, i) => {
            const active = i === activeIndex;
            return (
              <div
                key={c.id}
                id={optionId(i)}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(c);
                }}
                // On a move, not on enter: a menu opening under a still pointer
                // must not take the selection off its first row.
                onMouseMove={() => {
                  if (!active) onHover(i);
                }}
                className={`flex items-center gap-2.5 px-4 py-1.5 cursor-pointer transition-colors ${active ? 'bg-gray-100 dark:bg-white/10' : ''}`}
              >
                <span className="shrink-0 text-[var(--chat-accent)]">
                  <MessageSquareIcon size={14} />
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-[0.8125rem] text-gray-900 dark:text-white truncate">{c.title || t('Untitled conversation')}</span>
                  <span className="text-[0.7rem] text-gray-500 dark:text-white/40 truncate">
                    @{c.key}
                    {!c.isOwn && ` · ${t('Shared with you')}`}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {view.kind === 'empty' && (
        <div role="status" className="px-4 pt-1 pb-3 text-[0.75rem] text-gray-400 dark:text-white/40">
          {t('No conversation matches')}
        </div>
      )}

      {view.kind === 'full' && (
        <div role="status" className="px-4 pt-1 pb-3 text-[0.75rem] text-gray-400 dark:text-white/40">
          {translate(t, 'A message references at most {count} conversations', { count: MAX_REFERENCED_CONVERSATIONS })}
        </div>
      )}
    </div>
  );
};
