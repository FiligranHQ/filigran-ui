import {cva, type VariantProps} from 'class-variance-authority'
import * as React from 'react'
import {cn} from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded border border-current bg-[color-mix(in_srgb,currentColor_10%,transparent)] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'text-primary',
        secondary: 'text-secondary',
        warning: 'text-orange',
        destructive: 'text-destructive',
        outline: ' bg-transparent',
      },
      size: {
        default: 'px-s h-6 text-xs',
        sm: 'px-xs h-4 text-2xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({className, variant, size, color, ...props}: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({variant, size}), className)}
      style={color ? { borderColor: color } : {}}
      {...props}>
      <div className="inline-flex items-center text-foreground" style={color ? { color } : {}}>
        {props.children}
      </div>
    </div>
  )
}

export {Badge, badgeVariants}
