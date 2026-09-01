import * as React from 'react'
import {cva, type VariantProps} from 'class-variance-authority'
import {cn} from '../../lib/utils'

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded bg-input-bg-default px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize',
      },
    },
    defaultVariants: {
      resize: 'vertical',
    },
  }
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({className, resize, ...props}, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({resize}), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export {Textarea, textareaVariants}
