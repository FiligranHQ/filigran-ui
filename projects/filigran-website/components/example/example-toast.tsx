'use client'
import {Button, useToast} from 'filigran-ui'

export function ExampleToast() {
  const {toast} = useToast()

  return (
    <div className="flex gap-s">
      <Button
        onClick={() => {
          toast({
            title: 'A title',
            description: 'My description',
          })
        }}>
        Show Toast
      </Button>
      <Button
        onClick={() => {
          toast({
            description: 'My description',
          })
        }}>
        Show Toast without title
      </Button>
      <Button
        onClick={() => {
          toast({
            title: 'A title',
          })
        }}>
        Show Toast with title only
      </Button>
      <Button
        variant="destructive"
        onClick={() => {
          toast({
            title: 'A title',
            variant: 'destructive',
            description: 'My description',
          })
        }}>
        Show Destructive Toast
      </Button>
      <Button
        variant="destructive"
        onClick={() => {
          toast({
            variant: 'destructive',
            description: 'My description',
          })
        }}>
        Toast without title
      </Button>

      <Button
        onClick={() => {
          toast({
            title: 'Button with button',
            description: 'My description',
            action: <Button variant="outline">Click me</Button>,
          })
        }}>
        Show Toast with action
      </Button>
    </div>
  )
}
