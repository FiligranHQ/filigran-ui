'use client'
import {z} from 'zod'
import React from 'react'
import {Button} from 'filigran-ui/servers'
import {JSONSchemaToZod} from 'filigran-ui/auto-form'
import {AutoForm} from 'filigran-ui'
import jsonTest from './test.json';


const convertJson = JSONSchemaToZod.convert(jsonTest);

const fileListCheck = (file: FileList | undefined) => file && file.length > 0

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


export const AutoFormTest = () => {
  const onSubmit = (data: z.infer<typeof testSchema>) => {
    console.log('Submitted ', data)
  }

  const onSubmit2 = (data: z.infer<typeof convertJson>) => {
    console.log('Submitted ', data)
  }
  return (
    <div className="space-y-xl">
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
      <AutoForm
        onSubmit={onSubmit2}
        formSchema={convertJson}>
        <Button>Submit</Button>
      </AutoForm>
    </div>
  )
}
