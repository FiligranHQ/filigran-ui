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
  /**
   * `tertiary` (the default) on the panel's own surface; `secondary` (outlined)
   * for a standing control set such as the voice call's; `primary` (the brand
   * or error fill) for the main action of a set, and over a picture or a scrim,
   * where a transparent button has no ground.
   */
  priority?: 'primary' | 'secondary' | 'tertiary';
  /** `md` (36 px) in the header and the composer, `sm` (24 px) inside a row or a chip. */
  size?: 'sm' | 'md';
  /**
   * `false`: the tooltip says nothing (while a menu the button opens is open).
   * A string: the tooltip says more than the name (the send button's shortcut).
   */
  tooltip?: boolean | string;
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
  ({ label, icon, variant = 'default', priority = 'tertiary', size = 'md', tooltip = true, anchorClassName, ...props }, ref) => (
    <Tooltip title={typeof tooltip === 'string' ? tooltip : tooltip ? label : ''} className={anchorClassName ?? 'inline-flex shrink-0'}>
      <IconButton ref={ref} aria-label={label} icon={icon} variant={variant} priority={priority} size={size} {...props} />
    </Tooltip>
  ),
);
ChatIconButton.displayName = 'ChatIconButton';
