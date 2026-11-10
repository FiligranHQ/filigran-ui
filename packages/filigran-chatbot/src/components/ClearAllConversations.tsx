import { useState } from 'react';
import type { Translate } from '../types';
import { CheckIcon, CloseIcon, TrashIcon } from './icons';

interface ClearAllConversationsProps {
  /** Called once the user confirmed. */
  onClear: () => void;
  /** What clearing does to the conversations, as the row words it. Default: `'delete'`. */
  action?: 'delete' | 'archive';
  /** The row's layout where it stands. */
  className: string;
  /** The look of the confirm and cancel buttons where it stands. */
  iconButtonClass: string;
  t: Translate;
}

// Each wording a literal call on `t`, so key extraction finds it.
const wording = {
  delete: (t: Translate) => ({ offer: t('Clear all conversations'), ask: t('Delete all conversations?'), confirm: t('Delete all conversations') }),
  archive: (t: Translate) => ({
    offer: t('Archive all conversations'),
    ask: t('Archive all conversations?'),
    confirm: t('Archive all conversations'),
  }),
};

/** "Clear all conversations", asked again in place before anything is deleted or archived. */
export function ClearAllConversations({ onClear, action = 'delete', className, iconButtonClass, t }: ClearAllConversationsProps) {
  const [confirming, setConfirming] = useState(false);
  const words = wording[action](t);
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {confirming ? (
        <>
          <span className="flex-1 text-[0.7rem] text-red-600 dark:text-red-400">{words.ask}</span>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onClear();
            }}
            aria-label={words.confirm}
            className={`${iconButtonClass} hover:text-red-500`}
          >
            <CheckIcon size={13} />
          </button>
          <button type="button" onClick={() => setConfirming(false)} aria-label={t('Cancel')} className={iconButtonClass}>
            <CloseIcon size={13} />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex items-center gap-1.5 chat-radius-sm px-1 py-0.5 text-[0.7rem] chat-text-muted-400/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <TrashIcon size={12} />
          {words.offer}
        </button>
      )}
    </div>
  );
}
