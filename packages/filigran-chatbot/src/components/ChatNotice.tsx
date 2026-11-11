import type { ReactNode } from 'react';
import { ChatIconButton } from './ChatIconButton';
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

// One tinted container per tone: a light wash, a border of the same hue and
// the text in the tone itself. The tones are theme variables (index.css:
// `--chat-danger`, `--chat-warning`, the host's design-system colours when it
// passes them), each a step darker in light mode and lighter in dark mode.
const TONE_CLASS: Record<ChatNoticeTone, string> = {
  error: 'border-[var(--chat-danger)]/25 bg-[var(--chat-danger)]/[0.06] text-[var(--chat-danger)]',
  warning: 'border-[var(--chat-warning)]/25 bg-[var(--chat-warning)]/[0.06] text-[var(--chat-warning)]',
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
      className={`filigran-chat-notice flex items-start gap-2 chat-radius-md border px-2.5 py-1.5 text-content-compact leading-5 ${TONE_CLASS[tone]} ${className}`}
    >
      <Icon size={14} className="mt-[3px] shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onDismiss && (
        // The design system's small icon button (24 px, WCAG 2.5.8), pulled into
        // the padding so the notice keeps its height.
        <ChatIconButton
          label={dismissLabel ?? ''}
          icon={<CloseIcon size={16} />}
          size="sm"
          onClick={onDismiss}
          data-testid="filigran-chat-notice-dismiss"
          anchorClassName="-my-0.5 -mr-1.5 inline-flex shrink-0"
        />
      )}
    </div>
  );
};
