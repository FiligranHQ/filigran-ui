import { useState } from 'react';
import { Button } from '@filigran/design-system';
import type { Translate } from '../types';
import { ChatIconButton } from './ChatIconButton';
import { CheckIcon, CloseIcon, TrashIcon } from './icons';

interface ClearAllConversationsProps {
  /** Called once the user confirmed. */
  onClear: () => void;
  /** What clearing does to the conversations, as the row words it. Default: `'delete'`. */
  action?: 'delete' | 'archive';
  /** The row's layout where it stands. */
  className: string;
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
export function ClearAllConversations({ onClear, action = 'delete', className, t }: ClearAllConversationsProps) {
  const [confirming, setConfirming] = useState(false);
  const words = wording[action](t);
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {confirming ? (
        <>
          <span className="flex-1 text-[0.75rem] text-[var(--chat-danger)]">{words.ask}</span>
          <ChatIconButton
            label={words.confirm}
            icon={<CheckIcon size={16} />}
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirming(false);
              onClear();
            }}
          />
          <ChatIconButton label={t('Cancel')} icon={<CloseIcon size={16} />} size="sm" onClick={() => setConfirming(false)} />
        </>
      ) : (
        <Button variant="destructive" priority="tertiary" size="sm" startIcon={<TrashIcon size={16} />} onClick={() => setConfirming(true)}>
          {words.offer}
        </Button>
      )}
    </div>
  );
}
