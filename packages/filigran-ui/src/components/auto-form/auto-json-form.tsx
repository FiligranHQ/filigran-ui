import {type JSONSchema, mapJsonSchemaToZod} from './json-schema-to-zod'
import {AutoForm, type AutoFormProps} from './auto-form'
import type {ZodObjectOrWrapped} from './utils'

interface AutoJsonFormProps<T extends ZodObjectOrWrapped> extends Omit<AutoFormProps<T>, 'formSchema'> {
  jsonSchema: JSONSchema
}

export const AutoJsonForm = <T extends ZodObjectOrWrapped>({
                                   jsonSchema,
                                   ...props
                                 }: AutoJsonFormProps<T>) => {
  const formSchema = mapJsonSchemaToZod(jsonSchema) as T
  return <AutoForm formSchema={formSchema} {...props} />
}
