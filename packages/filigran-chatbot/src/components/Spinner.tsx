interface SpinnerProps {
  size?: number;
  className?: string;
}

export const Spinner = ({ size = 16, className = '' }: SpinnerProps) => (
  <div
    className={`animate-spin rounded-full border-2 border-current/20 border-t-[var(--chat-accent)] ${className}`}
    style={{ width: size, height: size }}
  />
);
