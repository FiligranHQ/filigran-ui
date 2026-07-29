'use client'
import {Button, useToast} from '@filigran/ui'

export function ExampleToast() {
  const {toast} = useToast()

  return (
    <div className="space-y-m">
      <div className="content-body-base-bold">Toast variants</div>
      <div className="flex flex-wrap gap-s">
        <Button
          variant="secondary"
          className="border-feedback-info-primary text-feedback-info-primary"
          onClick={() => {
            toast({
              title: 'Info toast',
              description: 'My description',
              variant: 'info',
              label: 'Info',
            })
          }}>
          Show Info
        </Button>
        <Button
          variant="secondary"
          className="border-feedback-success-primary text-feedback-success-primary"
          onClick={() => {
            toast({
              title: 'Success toast',
              description: 'My description',
              variant: 'success',
              label: 'Success',
            })
          }}>
          Show Success
        </Button>
        <Button
          variant="secondary"
          className="border-feedback-alert-primary text-feedback-alert-primary"
          onClick={() => {
            toast({
              title: 'Alert toast',
              description: 'My description',
              variant: 'alert',
              label: 'Alert',
            })
          }}>
          Show Alert
        </Button>
        <Button
          variant="secondary"
          className="border-feedback-warning-primary text-feedback-warning-primary"
          onClick={() => {
            toast({
              title: 'Warning toast',
              description: 'My description',
              variant: 'warning',
              label: 'Warning',
            })
          }}>
          Show Warning
        </Button>
        <Button
          variant="secondary"
          className="border-feedback-error-primary text-feedback-error-primary"
          onClick={() => {
            toast({
              title: 'Error toast',
              variant: 'error',
              description: 'My description',
              label: 'Error',
            })
          }}>
          Show Error
        </Button>
        <Button
          variant="secondary"
          className="border-feedback-info-primary text-feedback-info-primary"
          onClick={() => {
            toast({
              variant: 'info',
              label: 'Label',
              description: 'My description',
            })
          }}>
          Label only (no title)
        </Button>

        <Button
          variant="secondary"
          className="border-feedback-success-primary text-feedback-success-primary"
          onClick={() => {
            toast({
              title: 'Button with button',
              description: 'My description',
              variant: 'success',
              label: 'Action',
              action: (
                <Button
                  variant="secondary"
                  className="border-feedback-success-primary text-feedback-success-primary">
                  Click me
                </Button>
              ),
            })
          }}>
          Show Toast with action
        </Button>
      </div>
    </div>
  )
}
