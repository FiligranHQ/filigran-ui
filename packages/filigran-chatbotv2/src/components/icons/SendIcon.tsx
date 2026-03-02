import type { IconProps } from '../../types';

export const SendIcon = ({ className, size = 24 }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="m22 2-11 11" />
  </svg>
);
