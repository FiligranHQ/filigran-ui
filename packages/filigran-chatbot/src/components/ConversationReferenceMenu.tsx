import { useLayoutEffect, useRef } from 'react';
import type { ReferenceMenuItem } from '../hooks/useConversationReferenceMenu';
import { translate } from '../utils';
import { MAX_REFERENCED_CONVERSATIONS, type ReferenceMenuView } from '../utils/conversationRefs';
import { BotIcon, MessageSquareIcon } from './icons';

interface ConversationReferenceMenuProps {
  view: ReferenceMenuView;
  /** The rows, agents first: what the arrows walk through. */
  items: ReferenceMenuItem[];
  activeIndex: number;
  listboxId: string;
  optionId: (index: number) => string;
  onHover: (index: number) => void;
  onPick: (item: ReferenceMenuItem) => void;
  t: (key: string) => string;
}

/**
 * The composer's `@` menu, driven by `useConversationReferenceMenu`: the
 * conversations a message can reference, opened above the field. The field
 * keeps the focus - the rows are options it points at, picked on `mousedown`
 * so a click never takes the focus away from the text being written.
 */
export const ConversationReferenceMenu = ({ view, items, activeIndex, listboxId, optionId, onHover, onPick, t }: ConversationReferenceMenuProps) => {
  const listRef = useRef<HTMLDivElement>(null);

  // The row the arrows reached stays in view in a list longer than the menu.
  useLayoutEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, view.kind]);

  if (view.kind === 'closed' && items.length === 0) return null;
  const hasAgents = items.some((item) => item.type === 'agent');
  // Agents come first, under their own heading; conversations follow under theirs.
  const heading = hasAgents ? t('Mention an agent') : t('Reference a conversation');

  return (
    <div className="absolute left-0 right-0 bottom-full mb-1.5 z-20 rounded-[10px] overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2a2a3e] shadow-xl">
      <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">{heading}</span>

      {items.length > 0 && (
        <div ref={listRef} id={listboxId} role="listbox" aria-label={heading} className="max-h-[240px] overflow-y-auto pb-1 filigran-chat-scrollable">
          {items.map((item, i) => {
            const active = i === activeIndex;
            const startsConversations = item.type === 'conversation' && hasAgents && items[i - 1]?.type === 'agent';
            return (
              <div key={item.type === 'agent' ? `agent-${item.mention.agentId}` : item.candidate.id}>
                {startsConversations && (
                  <span className="block px-4 pt-2 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">
                    {t('Reference a conversation')}
                  </span>
                )}
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(item);
                  }}
                  // On a move, not on enter: a menu opening under a still pointer
                  // must not take the selection off its first row.
                  onMouseMove={() => {
                    if (!active) onHover(i);
                  }}
                  className={`flex items-center gap-2.5 px-4 py-1.5 cursor-pointer transition-colors ${active ? 'bg-gray-100 dark:bg-white/10' : ''}`}
                >
                  <span className="shrink-0 text-[var(--chat-accent)]">
                    {item.type === 'agent' ? <BotIcon size={14} /> : <MessageSquareIcon size={14} />}
                  </span>
                  {item.type === 'agent' ? (
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[0.8125rem] text-gray-900 dark:text-white truncate">{item.mention.name}</span>
                      <span className="text-[0.7rem] text-gray-500 dark:text-white/40 truncate">@{item.mention.key}</span>
                    </span>
                  ) : (
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[0.8125rem] text-gray-900 dark:text-white truncate">
                        {item.candidate.title || t('Untitled conversation')}
                      </span>
                      <span className="text-[0.7rem] text-gray-500 dark:text-white/40 truncate">
                        @{item.candidate.key}
                        {!item.candidate.isOwn && ` · ${t('Shared with you')}`}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view.kind === 'empty' && items.length === 0 && (
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
