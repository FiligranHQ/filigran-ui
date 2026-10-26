import { useState } from 'react';
import type { Translate } from '../types';
import { CheckIcon, CloseIcon, TrashIcon } from './icons';

interface ClearAllConversationsProps {
  /** Called once the user confirmed. */
  onClear: () => void;
  /** The row's layout where it stands. */
  className: string;
  /** The look of the confirm and cancel buttons where it stands. */
  iconButtonClass: string;
  t: Translate;
}

/** "Clear all conversations", asked again in place before anything is deleted. */
export function ClearAllConversations({ onClear, className, iconButtonClass, t }: ClearAllConversationsProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {confirming ? (
        <>
          <span className="flex-1 text-[0.7rem] text-red-600 dark:text-red-400">{t('Delete all conversations?')}</span>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onClear();
            }}
            aria-label={t('Delete all conversations')}
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
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[0.7rem] text-gray-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <TrashIcon size={12} />
          {t('Clear all conversations')}
        </button>
      )}
    </div>
  );
}
