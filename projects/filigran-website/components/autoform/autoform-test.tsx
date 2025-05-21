'use client'
import {z} from 'zod'
import React from 'react'
import {Button} from 'filigran-ui/servers'
import {AutoForm} from 'filigran-ui'

type JSONSchema = {
  type: string
  properties?: Record<string, JSONSchema>
  optional?: string[]
  items?: JSONSchema
  enum?: any[]
  [key: string]: any
}
const fileListCheck = (file: FileList | undefined) => file && file.length > 0

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

const testSchema = z.object({
  username: z
    .string()
    // You can use zod's built-in validation as normal
    .min(2, {
      message: 'Username must be at least 2 characters.',
    }),
  password: z
    .string({
      required_error: 'Password is required.',
    })
    // Use the "describe" method to set the label
    // If no label is set, the field name will be used
    // and un-camel-cased
    .min(8, {
      message: 'Password must be at least 8 characters.',
    })
    .describe('Your secure password'),

  favouriteNumber: z.coerce // When using numbers and dates, you must use coerce
    .number({
      invalid_type_error: 'Favourite number must be a number.',
    })
    .min(1, {
      message: 'Favourite number must be at least 1.',
    })
    .max(10, {
      message: 'Favourite number must be at most 10.',
    })
    .default(5) // You can set a default value
    .optional(),

  acceptTerms: z
    .boolean()
    .refine((value) => value, {
      message: 'You must accept the terms and conditions.',
      path: ['acceptTerms'],
    })
    .describe('Accept terms and conditions'),

  // Date will show a date picker
  birthday: z.coerce.date().optional(),

  sendMeMails: z
    .boolean()
    .optional()
    .refine((value) => value, {
      params: {
        fieldType: 'switch',
      },
    }),

  // Enum will show a select
  color: z.enum(['red', 'green', 'blue']),

  // Create sub-objects to create accordion sections
  address: z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string(),
  }),
  invitedGuests: z
    .array(
      // Define the fields for each item
      z.object({
        name: z.string(),
        age: z.coerce.number(),
      })
    )
    // Optionally set a custom label - otherwise this will be inferred from the field name
    .describe('Guests invited to the party'),
  document: z.custom<FileList>(fileListCheck).optional(),
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
        fieldConfig={{
          sendMeMails: {
            // Booleans use a checkbox by default, you can use a switch instead
            label: 'Send me mail test',
            fieldType: 'switch',
          },
          document: {
            label: 'Add a file',
            fieldType: 'file',
            inputProps: {
              allowedTypes: 'application/json',
              // @ts-ignore
              multiple: 'multiple',
            },
          },
        }}>
        <Button>Submit</Button>
      </AutoForm>
    </>
  )
}
