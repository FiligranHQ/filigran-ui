'use client'
import {z} from 'zod'
import React from 'react'
import {AutoForm} from 'filigran-ui/auto-form'
import {Button} from 'filigran-ui/servers'
import {AutoJsonForm, JSONSchema} from 'filigran-ui'
import TestJson from './test.json'


const jsonSchema = {
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://www.filigran.io/mitre.schema.json",
  "title":"IpInfo connector",
  "description":"IpInfo enrichment connector",
  "container_image":"opencti/connector-ipinfo",
  "container_type":"INTERNAL_ENRICHMENT",
  "type":"object",
  "default":{
    "CONNECTOR_SCOPE":"IPv4-Addr",
    "CONNECTOR_AUTO":true,
    "IPINFO_MAX_TLP":"TLP:AMBER",
    "IPINFO_USE_ASN_NAME":false
  },
  "properties":{
    "CONNECTOR_SCOPE":{
      "description":"Scope",
      "type":"string"
    },
    "CONNECTOR_AUTO":{
      "description":"Auto trigger",
      "type":"boolean"
    },
    "IPINFO_TOKEN":{
      "description":"Token",
      "type":"string",
      "format":"password"
    },
    "IPINFO_MAX_TLP":{
      "description":"Max TLP",
      "type":"string"
    },
    "IPINFO_USE_ASN_NAME":{
      "description":"use ASN name",
      "type":"boolean"
    }
  },
  "required":[
    "IPINFO_TOKEN"
  ],
  "additionalProperties":false
};


const testSchema = z.object({
  username: z
    .string()
    // You can use zod's built-in validation as normal
    .min(2, {
      message: 'Username must be at least 2 characters.'
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
    .optional(),

  // Enum will show a select
  color: z.enum(['red', 'green', 'blue']),

  invitedGuests: z
    .array(
      // Define the fields for each item
      z.object({
        name: z.string(),
        age: z.coerce.number(),
      })
    )
    // Optionally set a custom label - otherwise this will be inferred from the field name
    .describe("Guests invited to the party"),
})

// export const zodSchemaProvider = new ZodProvider(testSchema)

export const AutoFormTest = () => {
  const onSubmit = (data: unknown) => {
    console.log('Submitted ', data)
  }
  return (
    <>
      <h2>Example Autoform with Json Schema</h2>
      <h3>Contracts </h3>
      {TestJson.contracts.map((jsonSchema) => {
        return <AutoJsonForm onSubmit={onSubmit}
                             key={jsonSchema.title}
                      jsonSchema={jsonSchema as unknown as JSONSchema}
                      fieldConfig={{
                        IPINFO_TOKEN: {
                          inputProps: {
                            type: 'password'
                          }
                        }}
                      }
        >
          <Button>Submit</Button>
        </AutoJsonForm>
      })}

      <h2>Example Autofom with Zod schema</h2>
      <AutoForm
        onSubmit={onSubmit}
        formSchema={testSchema}>
        <Button>Submit</Button>
      </AutoForm>
    </>
  )
}
