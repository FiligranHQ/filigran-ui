'use client'
import {z} from 'zod'
import React from 'react'
import {Button} from 'filigran-ui/servers'
import {JSONSchemaToZod} from 'filigran-ui/auto-form'
import {
  AutoForm,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from 'filigran-ui'
import jsonTest from './test.json'

export enum UserServiceOrderingEnum {
  EMAIL = 'email',
  FIRST_NAME = 'first_name',
  LAST_NAME = 'last_name',
  ORDERING = 'ordering',
  SERVICE_DESCRIPTION = 'service_description',
  SERVICE_NAME = 'service_name',
  SERVICE_PROVIDER = 'service_provider',
  SERVICE_TYPE = 'service_type',
  SUBSCRIPTION_STATUS = 'subscription_status',
}
const zFileList = z.custom<FileList>(
  (data): data is FileList => {
    if (typeof window === 'undefined') return false
    return data instanceof FileList
  },
  {
    message: 'Invalid file list',
  }
)
const convertJson = JSONSchemaToZod.convert(jsonTest)

const fileListCheck = (file: FileList | undefined) => file && file.length > 0

const intlTranslations = {
  en: {
    username: 'Username',
    password: 'Your secure password',
    'Your secure password': 'Your secure password',
    favouriteNumber: 'Favourite number',
    acceptTerms: 'Accept terms and conditions',
    'Accept terms and conditions': 'Accept terms and conditions',
    birthday: 'Birthday',
    sendMeMails: 'Send me mails',
    'Send me mails': 'Send me mails',
    color: 'Color',
    address: 'Address',
    street: 'Street',
    city: 'City',
    zip: 'Zip code',
    invitedGuests: 'Guests invited to the party',
    'Guests invited to the party': 'Guests invited to the party',
    document: 'Document',
  },
  fr: {
    username: "Nom d'utilisateur",
    password: 'Votre mot de passe sécurisé',
    'Your secure password': 'Votre mot de passe sécurisé',
    favouriteNumber: 'Nombre préféré',
    acceptTerms: 'Accepter les termes et conditions',
    'Send me mails': 'Accepter les termes et conditions',
    'Accept terms and conditions': 'Accepter les termes et conditions',
    birthday: 'Date de naissance',
    sendMeMails: "M'envoyer des e-mails",
    color: 'Couleur',
    address: 'Adresse',
    street: 'Rue',
    city: 'Ville',
    zip: 'Code postal',
    invitedGuests: 'Invités à la fête',
    'Guests invited to the party': 'Invités à la fête',
    document: 'Document',
  },
}
export const intlTranslation =
  <K extends string = string>(locale: keyof typeof intlTranslations) =>
  (key: K): string => {
    const translations = intlTranslations[locale] as Record<string, string>
    return translations[key] ?? key
  }

const testSchema = z.object({
  username: z
    .string()
    // You can use zod's built-in validation as normal
    .min(2, {
      error: 'Username must be at least 2 characters.',
    }),
  password: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'Password is required.' : undefined,
    })
    // Use the "describe" method to set the label
    // If no label is set, the field name will be used
    // and un-camel-cased
    .min(8, {
      error: 'Password must be at least 8 characters.',
    })
    .describe('Your secure password'),

  favouriteNumber: z.coerce // When using numbers and dates, you must use coerce
    .number({
      error: (issue) =>
        issue.input === undefined
          ? undefined
          : 'Favourite number must be a number.',
    })
    .min(1, {
      error: 'Favourite number must be at least 1.',
    })
    .max(10, {
      error: 'Favourite number must be at most 10.',
    })
    .default(5) // You can set a default value
    .optional(),
  userServiceEnum: z.enum(UserServiceOrderingEnum),
  acceptTerms: z
    .boolean()
    .refine((value) => value, {
      path: ['acceptTerms'],
      error: 'You must accept the terms and conditions.',
    })
    .describe('Accept terms and conditions'),

  // Date will show a date picker
  birthday: z.date().optional(),

  sendMeMails: z
    .boolean()
    .optional()
    .refine((value) => value, {
      params: {
        fieldType: 'switch',
      },
    }),

  // Enum will show a select
  color: z.enum(['red', 'green', 'blue']).optional(),

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
    .describe('Guests invited to the party')
    .optional(),

  document: zFileList
    .refine((files) => files.length > 0, {
      message: 'Please select at least one file',
    })
    .optional(),
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
        intlTranslation={intlTranslation('fr')}
        onSubmit={onSubmit}
        formSchema={testSchema}
        fieldConfig={{
          sendMeMails: {
            // Booleans use a checkbox by default, you can use a switch instead
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
          userServiceEnum: {
            label: 'User Service',
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
