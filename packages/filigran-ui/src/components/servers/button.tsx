import {Slot} from '@radix-ui/react-slot'
import {cva, type VariantProps} from 'class-variance-authority'
import * as React from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded font-normal text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/75 focus-visible:ring-primary/50',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/75 focus-visible:ring-destructive/50',
        outline: 'border border-border-medium bg-transparent hover:bg-hover',
        'outline-primary': 'border border-primary bg-transparent hover:bg-hover text-primary focus-visible:ring-primary/50',
        'outline-destructive': 'border border-destructive/75 bg-transparent hover:bg-hover text-destructive focus-visible:ring-destructive/50',
        'outline-secondary': 'border border-secondary bg-transparent hover:bg-hover text-secondary focus-visible:ring-secondary/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/75 focus-visible:ring-secondary/50',
        ghost: 'hover:bg-hover',
        'ghost-primary': 'hover:bg-hover text-primary focus-visible:ring-primary/50',
        'ghost-destructive': 'hover:bg-hover text-destructive focus-visible:ring-destructive/50',
        'ghost-secondary': 'hover:bg-hover text-secondary focus-visible:ring-secondary/50',
        link: 'text-primary underline-offset-4 hover:underline normal-case',
        'link-primary':
          'text-primary underline-offset-4 hover:underline normal-case focus-visible:ring-primary/50',
        'link-destructive':
          'text-destructive underline-offset-4 hover:underline normal-case focus-visible:ring-destructive/50',
        'link-secondary':
          'text-secondary underline-offset-4 hover:underline normal-case focus-visible:ring-secondary/50',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded px-3',
        lg: 'h-10 rounded px-8',
        icon: 'h-9 w-9',
        'icon-rounded': 'h-9 w-9 rounded-[100%]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)


import {cn} from '../../lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant, size, asChild = false, ...props}, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({variant, size, className}))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export {Button, buttonVariants}
