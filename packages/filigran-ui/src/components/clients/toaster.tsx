'use client'

import {useToast} from './use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast'
import {CheckIndeterminateIcon, TaskIcon} from 'filigran-icon'

export function Toaster() {
  const {toasts} = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant = 'success',
        ...props
      }) {
        return (
          <Toast
            key={id}
            variant={variant}
            {...props}>
            <div className="flex items-center gap-m">
              {variant === 'destructive' && (
                <CheckIndeterminateIcon className="h-5 w-5 text-red" />
              )}
              {variant === 'success' && (
                <TaskIcon className="h-5 w-5 text-green" />
              )}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
