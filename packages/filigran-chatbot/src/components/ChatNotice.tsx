import type { ReactNode } from 'react';
import { AlertTriangleIcon, CloseIcon, InfoIcon, XCircleIcon } from './icons';

/** How serious a notice is: its colour and its icon follow. */
export type ChatNoticeTone = 'error' | 'warning' | 'info';

interface ChatNoticeProps {
  tone: ChatNoticeTone;
  children: ReactNode;
  /** Closes the notice; without it the notice has no close button (it lives as long as its cause). */
  onDismiss?: () => void;
  /** The close button's accessible name, translated. */
  dismissLabel?: string;
  /** `alert` for what just failed (read out at once), `status` for a standing warning. */
  role?: 'alert' | 'status';
  className?: string;
  'data-testid'?: string;
}

// One tinted container per tone: a light wash, a border of the same hue, the
// text a step darker in light mode and lighter in dark mode, so it reads on
// every surface the panel is mounted on.
const TONE_CLASS: Record<ChatNoticeTone, string> = {
  error: 'border-red-500/25 bg-red-500/[0.06] text-red-700 dark:text-red-300',
  warning: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-800 dark:text-amber-200',
  info: 'border-[var(--chat-accent-40)] bg-[var(--chat-accent-10)] chat-text-secondary-700/80',
};

const TONE_ICON: Record<ChatNoticeTone, typeof InfoIcon> = {
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

/**
 * Every error, warning and notice of the panel: an icon, the words, and a
 * close button when the notice is not tied to a live state. Never raw coloured
 * text (XTM-One-Platform/xtm-one#10910).
 */
export const ChatNotice = ({
  tone,
  children,
  onDismiss,
  dismissLabel,
  role = tone === 'error' ? 'alert' : 'status',
  className = '',
  ...rest
}: ChatNoticeProps) => {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role={role}
      data-tone={tone}
      data-testid={rest['data-testid']}
      className={`filigran-chat-notice flex items-start gap-2 chat-radius-md border px-2.5 py-1.5 text-[0.75rem] leading-5 ${TONE_CLASS[tone]} ${className}`}
    >
      <Icon size={14} className="mt-[3px] shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          title={dismissLabel}
          className="-mr-1 mt-px shrink-0 chat-radius-sm p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
        >
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  );
};
