'use client'
import {z} from 'zod'
import AutoForm from 'filigran-ui/auto-form'
import React from 'react'

const testSchema = z.object({
  name: z.string().min(2, {message: 'Name must be at least 2 characters.'}),
  age: z.number().min(0, {message: 'Age must be positive.'}),
  birthdate: z.date(),
})

// export const zodSchemaProvider = new ZodProvider(testSchema)

export const AutoFormTest = () => {
  const onSubmit = (data: z.infer<typeof testSchema>) => {
    console.log('Submitted ', data)
  }

  return (
    <AutoForm
      schema={testSchema}
      onSubmit={onSubmit}
    />
  )
}
