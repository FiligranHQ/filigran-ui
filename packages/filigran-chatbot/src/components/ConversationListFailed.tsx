import { Button } from '@filigran/design-system';

import type { Translate } from '../types';

interface ConversationListFailedProps {
  /** Reads the list again. */
  onRetry: () => void;
  /** The block's layout where it stands. */
  className: string;
  t: Translate;
}

/** What the conversation list shows when it could not be read, with a retry. */
export function ConversationListFailed({ onRetry, className, t }: ConversationListFailedProps) {
  return (
    <div role="alert" data-testid="filigran-chat-conversation-list-error" className={`flex flex-col items-start gap-2 ${className}`}>
      <p className="m-0 text-[0.75rem] chat-text-secondary-600/60">{t('Could not load your conversations.')}</p>
      <Button priority="secondary" size="sm" onClick={onRetry}>
        {t('Retry')}
      </Button>
    </div>
  );
}
