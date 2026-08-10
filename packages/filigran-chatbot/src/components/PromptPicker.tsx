import { useRef, useState } from 'react';
import type { ChatPromptTemplate } from '../types';
import { SparklesIcon } from './icons';
import { Dropdown } from './Dropdown';
import { Tooltip } from './Tooltip';

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
  const filtered = q
    ? prompts.filter((p) => p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
    : prompts;

  return (
    <>
      <Tooltip title={t('Insert prompt template')}>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-label={t('Insert prompt template')}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            open
              ? 'text-[var(--chat-accent)] bg-[var(--chat-accent)]/10'
              : 'text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10'
          }`}
        >
          <SparklesIcon size={15} />
        </button>
      </Tooltip>

      <Dropdown open={open} onClose={close} anchorRef={anchorRef} width={280}>
        <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">
          {t('Insert prompt template')}
        </span>

        {prompts.length > SEARCH_THRESHOLD && (
          <div className="px-3 pb-2 pt-1">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close();
              }}
              placeholder={t('Search prompts...')}
              aria-label={t('Search prompts...')}
              className="w-full h-7 px-2 rounded-md bg-gray-100 dark:bg-white/[0.06] text-[0.75rem] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 outline-hidden focus:ring-1 focus:ring-[var(--chat-accent)]"
            />
          </div>
        )}

        <div className="max-h-[240px] overflow-y-auto filigran-chat-scrollable">
          {filtered.length === 0 && <div className="px-4 py-3 text-[0.75rem] text-gray-400 dark:text-white/40">{t('No prompt matches')}</div>}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p.content);
                close();
              }}
              className="w-full px-4 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <div className="text-[0.8125rem] text-gray-900 dark:text-white truncate">{p.title}</div>
              {p.description && <div className="text-[0.7rem] text-gray-500 dark:text-white/40 truncate">{p.description}</div>}
            </button>
          ))}
        </div>
      </Dropdown>
    </>
  );
};
