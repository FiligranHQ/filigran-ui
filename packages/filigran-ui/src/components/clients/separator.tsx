'use client'

import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as React from 'react'

import {cn} from '../../lib/utils'

type SeparatorProps = React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
  label?: string
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(
  (
    {className, orientation = 'horizontal', decorative = true, label, ...props},
    ref
  ) => {
    const hasLabel = typeof label === 'string' && label.trim().length > 0 && orientation === 'horizontal'

    if (hasLabel) {
      return (
        <div ref={ref} className={cn('flex items-center', className)} {...props}>
          <SeparatorPrimitive.Root
            decorative
            orientation="horizontal"
            className="h-[1px] flex-1 bg-border-light"
          />
          <span className="mx-4 whitespace-nowrap text-sm text-muted-foreground">{label}</span>
          <SeparatorPrimitive.Root
            decorative
            orientation="horizontal"
            className="h-[1px] flex-1 bg-border-light"
          />
        </div>
      )
    }

    return (
      <SeparatorPrimitive.Root
        ref={ref}
        decorative={decorative}
        orientation={orientation}
        className={cn(
          'shrink-0 bg-border-light',
          orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
          className
        )}
        {...props}
      />
    )
  }
)
Separator.displayName = SeparatorPrimitive.Root.displayName ?? 'Separator'

export {Separator}
