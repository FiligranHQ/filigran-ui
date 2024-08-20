'use client'
import {Button, useToast} from 'filigran-ui'

export function ExampleToast() {
  const {toast} = useToast()

  return (
    <Button
      onClick={() => {
        toast({
          title: 'A title',
          description: 'My description',
        })
      }}>
      Show Toast
    </Button>
  )
}
