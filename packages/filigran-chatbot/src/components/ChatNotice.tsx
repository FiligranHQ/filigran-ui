import type { ReactNode } from 'react';
import { AlertTriangleIcon, CloseIcon, InfoIcon, XCircleIcon } from './icons';
import { Tooltip } from './Tooltip';

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
      className={`filigran-chat-notice flex items-start gap-2 chat-radius-md border px-2.5 py-1.5 text-[0.75rem] leading-5 ${TONE_CLASS[tone]} ${className}`}
    >
      <Icon size={14} className="mt-[3px] shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onDismiss && (
        // A 24 px hit area (WCAG 2.5.8) around the 12 px glyph, pulled into the
        // padding so the notice keeps its height; the panel's own tooltip.
        <Tooltip title={dismissLabel ?? ''}>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            data-testid="filigran-chat-notice-dismiss"
            className="-my-0.5 -mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center chat-radius-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
          >
            <CloseIcon size={12} />
          </button>
        </Tooltip>
      )}
    </div>
  );
};
