'use client'
import {z} from 'zod'
import React from 'react'
import {AutoForm} from 'filigran-ui/auto-form'

type JSONSchema = {
  type: string
  properties?: Record<string, JSONSchema>
  optional?: string[]
  items?: JSONSchema
  enum?: any[]
  [key: string]: any
}

const convertJsonSchemaToZod = (jsonSchema: JSONSchema): any => {
  switch (jsonSchema.type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'integer':
      return z.number().int()
    case 'boolean':
      return z.boolean()
    case 'array':
      if (!jsonSchema.items) {
        throw new Error("Array type must have 'items' defined")
      }
      return z.array(convertJsonSchemaToZod(jsonSchema.items))
    case 'object':
      const properties = jsonSchema.properties || {}
      const optional = new Set(jsonSchema.optional || [])
      const shape = Object.fromEntries(
        Object.entries(properties).map(([key, value]) => {
          const schema = convertJsonSchemaToZod(value)
          return [key, optional.has(key) ? schema.optional() : schema]
        })
      )
      return z.object(shape).partial()
    default:
      throw new Error(`Unsupported JSON Schema type: ${jsonSchema.type}`)
  }
}

// Example Usage
const exampleJsonSchema: JSONSchema = {
  type: 'object',
  properties: {
    name: {type: 'string'},
    age: {type: 'integer'},
    hobbies: {
      type: 'array',
      items: {type: 'string'},
    },
    isActive: {type: 'boolean'},
  },
  optional: ['name', 'age'],
}

const zodSchemaFromJSON = convertJsonSchemaToZod(exampleJsonSchema)

const testSchema = z.object({
  name: z.string().min(2, {message: 'Name must be at least 2 characters.'}),
  age: z.number().min(0, {message: 'Age must be positive.'}),
  oldAge: z.number().min(0, {message: 'Age must be positive.'}),
  birthdate: z.date(),
})

// export const zodSchemaProvider = new ZodProvider(testSchema)

export const AutoFormTest = () => {
  const onSubmit = (data: z.infer<typeof testSchema>) => {
    console.log('Submitted ', data)
  }
  return (
    <>
      <AutoForm
        onSubmit={onSubmit}
        formSchema={testSchema}
      />
      <AutoForm
        onSubmit={onSubmit}
        formSchema={zodSchemaFromJSON}
      />
    </>
  )
}
