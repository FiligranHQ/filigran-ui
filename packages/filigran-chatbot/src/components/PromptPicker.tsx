import { useRef, useState } from 'react';
import type { ChatPromptTemplate } from '../types';
import { isComposing } from '../utils/keyboard';
import { SparklesIcon } from './icons';
import { Dropdown } from './Dropdown';
import { ChatIconButton } from './ChatIconButton';

interface PromptPickerProps {
  prompts: ChatPromptTemplate[];
  /** Receives the template body; the composer decides how to place it. */
  onPick: (content: string) => void;
  t: (key: string) => string;
}

/** Above this many entries the list is worth filtering rather than scrolling. */
const SEARCH_THRESHOLD = 5;

/**
 * Inserts a saved prompt template into the composer. Mirrors the XTM One web
 * chat's "Insert prompt template" affordance.
 */
export const PromptPicker = ({ prompts, onPick, t }: PromptPickerProps) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const close = () => {
    setOpen(false);
    // Reset on close: re-opening on a stale filter looks like the library
    // lost most of its entries.
    setQuery('');
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? prompts.filter((p) => p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)) : prompts;

  return (
    <>
      {/* Same control as every other composer action (attach, dictate, send):
          the design system's 36 px IconButton with a 20 px glyph. */}
      <ChatIconButton
        ref={anchorRef}
        label={t('Insert prompt template')}
        icon={<SparklesIcon size={20} />}
        tooltip={!open}
        active={open}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      />

      <Dropdown open={open} onClose={close} anchorRef={anchorRef} width={280}>
        <span className="block px-4 pt-3 pb-1 text-content-compact tracking-[1px] uppercase chat-text-muted-400/40">{t('Insert prompt template')}</span>

        {prompts.length > SEARCH_THRESHOLD && (
          <div className="px-3 pb-2 pt-1">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !isComposing(e)) close();
              }}
              placeholder={t('Search prompts...')}
              aria-label={t('Search prompts...')}
              className="w-full h-7 px-2 chat-radius-sm chat-surface-subtle-100/6 text-content-compact chat-text-900/100 placeholder:chat-text-muted-400/40 outline-hidden focus:ring-1 focus:ring-[var(--chat-accent)]"
            />
          </div>
        )}

        <div className="max-h-[240px] overflow-y-auto filigran-chat-scrollable">
          {filtered.length === 0 && <div className="px-4 py-3 text-content-compact chat-text-muted-400/40">{t('No prompt matches')}</div>}
          {filtered.map((p) => (
            <button
              data-ds-exempt="prompt-option-row"
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p.content);
                close();
              }}
              className="w-full px-4 py-1.5 text-left hover:chat-surface-hover-100/10 transition-colors"
            >
              <div className="text-content-base chat-text-900/100 truncate">{p.title}</div>
              {p.description && <div className="text-content-compact chat-text-secondary-500/40 truncate">{p.description}</div>}
            </button>
          ))}
        </div>
      </Dropdown>
    </>
  );
};
