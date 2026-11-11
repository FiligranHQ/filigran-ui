import { IconButton } from '@filigran/design-system';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { Tooltip } from './Tooltip';

type DsIconButtonProps = ComponentPropsWithoutRef<typeof IconButton>;

interface ChatIconButtonProps extends Omit<DsIconButtonProps, 'aria-label' | 'icon' | 'priority' | 'variant' | 'size'> {
  /** The accessible name and the tooltip: an icon-only control has no visible text. */
  label: string;
  /** A design-system glyph (`<Icon>` or one of ./icons). */
  icon: ReactNode;
  /** `destructive` for a delete; `default` otherwise. */
  variant?: 'default' | 'destructive';
  /** `md` (36 px) in the header and the composer, `sm` (24 px) inside a row or a chip. */
  size?: 'sm' | 'md';
  /** The tooltip says nothing while a menu the button opens is open. */
  tooltip?: boolean;
  /** Layout of the tooltip's anchor (`inline-flex shrink-0` unless the row needs more). */
  anchorClassName?: string;
}

/**
 * Every icon-only control of the panel: the design system's `IconButton`
 * (tertiary priority, its hover, active, focus ring and disabled states) with
 * the panel's tooltip, drawn as the design system's `TooltipContent` and kept
 * inside the panel's stacking context (see ./Tooltip). The label is both the
 * accessible name and the tooltip, so the two never drift apart.
 */
export const ChatIconButton = forwardRef<HTMLButtonElement, ChatIconButtonProps>(
  ({ label, icon, variant = 'default', size = 'md', tooltip = true, anchorClassName, ...props }, ref) => (
    <Tooltip title={tooltip ? label : ''} className={anchorClassName ?? 'inline-flex shrink-0'}>
      <IconButton ref={ref} aria-label={label} icon={icon} variant={variant} priority="tertiary" size={size} {...props} />
    </Tooltip>
  ),
);
ChatIconButton.displayName = 'ChatIconButton';
