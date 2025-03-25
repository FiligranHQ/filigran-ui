'use client'
import {z} from 'zod'
import React from 'react'
import {AutoForm} from 'filigran-ui/auto-form'
import {Button} from 'filigran-ui/servers'
import {AutoJsonForm, JSONSchema} from 'filigran-ui'
import TestJson from './test.json'
import { AutoFormInputComponentProps } from '../../../../packages/filigran-ui/src/components/auto-form/types'


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
  images: z.custom<FileList>(),

})

// export const zodSchemaProvider = new ZodProvider(testSchema)

export const AutoFormTest = () => {
  const onSubmit = (data: unknown) => {
    console.log('Submitted ', data)
  }
  return (
    <>

      <h2>Example Autofom with Zod schema</h2>
      <AutoForm
        onSubmit={onSubmit}
        formSchema={testSchema}
        fieldConfig={ {
          images: {
            fieldType: ({
                          label,
                          isRequired,
                          field,
                          fieldConfigItem,
                          fieldProps,
                        }: AutoFormInputComponentProps) => (
                          <div>Hello world test coucou</div>
            ),
          }
      }}
      >
        <Button>Submit</Button>
      </AutoForm>
    </>
  )
}
