import type { IconProps } from '../../types';

export const FloatingIcon = ({ className, size = 24 }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M11 13H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7" />
    <rect width="12" height="12" x="10" y="10" rx="2" />
  </svg>
);
