import * as React from 'react'
import {cva, type VariantProps} from 'class-variance-authority'
import {cn} from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2.5 py-0.5 text-xs border-current bg-[color-mix(in_srgb,currentColor_10%,transparent)] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-[color-mix(in_srgb,currentColor_20%,transparent)]',
  {
    variants: {
      variant: {
        default: 'text-primary',
        secondary: 'text-secondary',
        destructive: 'text-destructive',
        outline: ' bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({className, variant, ...props}: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({variant}), className)}
      {...props}
    />
  )
}

export {Badge, badgeVariants}
