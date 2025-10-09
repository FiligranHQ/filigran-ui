import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {Button} from '@/components/ui/button'
import {Separator} from '@/components/ui/separator'
import {Plus, Trash} from 'lucide-react'
import {useFieldArray, useForm} from 'react-hook-form'
import * as z from 'zod'
import {beautifyObjectName} from '../utils'
import AutoFormObject from './object'

/**
 * Check if a schema is a ZodArray
 */
function isZodArray(schema: z.ZodTypeAny): schema is z.ZodArray<any> {
  return (schema as any)._def?.typeName === 'ZodArray'
}

/**
 * Check if a schema is a ZodDefault
 */
function isZodDefault(schema: z.ZodTypeAny): schema is z.ZodDefault<any> {
  return (schema as any)._def?.typeName === 'ZodDefault'
}

/**
 * Get the item type from an array schema
 */
function getArrayItemType(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  const def = (schema as any)._def

  // Direct ZodArray
  if (def?.typeName === 'ZodArray') {
    return def.type
  }

  // ZodDefault wrapping a ZodArray
  if (def?.typeName === 'ZodDefault') {
    const innerDef = def.innerType?._def
    if (innerDef?.typeName === 'ZodArray') {
      return innerDef.type
    }
  }

  // ZodOptional or ZodNullable wrapping a ZodArray
  if (def?.typeName === 'ZodOptional' || def?.typeName === 'ZodNullable') {
    return getArrayItemType(def.innerType)
  }

  // ZodEffects wrapping a ZodArray
  if (def?.typeName === 'ZodEffects') {
    return getArrayItemType(def.schema)
  }

  return null
}

/**
 * Get default value for array append
 */
function getDefaultItemValue(itemType: z.ZodTypeAny): any {
  const def = (itemType as any)._def

  // If it's a ZodObject, return empty object
  if (def?.typeName === 'ZodObject') {
    const shape = (itemType as z.ZodObject<any>).shape
    const defaultObj: Record<string, any> = {}

    // Try to get default values for each field
    for (const key in shape) {
      const fieldSchema = shape[key]
      const fieldDef = (fieldSchema as any)._def

      // Check for default value
      if (fieldDef?.typeName === 'ZodDefault') {
        defaultObj[key] = fieldDef.defaultValue()
      }
    }

    return defaultObj
  }

  // For primitives, return appropriate default
  switch (def?.typeName) {
    case 'ZodString':
      return ''
    case 'ZodNumber':
      return 0
    case 'ZodBoolean':
      return false
    case 'ZodDate':
      return new Date()
    default:
      return {}
  }
}

export default function AutoFormArray({
  name,
  item,
  form,
  path = [],
  fieldConfig,
}: {
  name: string
  item: z.ZodTypeAny // Changed from z.ZodArray<any> | z.ZodDefault<any>
  form: ReturnType<typeof useForm>
  path?: string[]
  fieldConfig?: any
}) {
  const {fields, append, remove} = useFieldArray({
    control: form.control,
    name: [...path, name].join('.'), // Ensure proper path for nested arrays
  })

  // Get description from the schema
  const def = (item as any)._def
  const title = def?.description ?? beautifyObjectName(name)

  // Get the type of items in the array
  const itemType = getArrayItemType(item)

  if (!itemType) {
    console.warn(`Could not determine array item type for field: ${name}`)
    return null
  }

  // Get default value for new items
  const defaultItemValue = getDefaultItemValue(itemType)

  return (
    <AccordionItem
      value={name}
      className="border-none">
      <AccordionTrigger>{title}</AccordionTrigger>
      <AccordionContent>
        {fields.map((_field, index) => {
          const key = _field.id
          const itemPath = [...path, name, index.toString()]

          return (
            <div
              className="mt-4 flex flex-col"
              key={key}>
              {/* Check if itemType is a ZodObject before rendering AutoFormObject */}
              {(itemType as any)._def?.typeName === 'ZodObject' ? (
                <AutoFormObject
                  schema={
                    itemType as z.ZodObject<any, any> | z.ZodType<any, any, any>
                  }
                  form={form}
                  fieldConfig={fieldConfig?.[name]}
                  path={itemPath}
                />
              ) : (
                // For non-object types, you might want to render a different component
                <div className="p-4 border rounded">
                  <span className="text-sm text-muted-foreground">
                    Array item {index + 1}
                  </span>
                </div>
              )}

              <div className="my-4 flex justify-end">
                <Button
                  variant="secondary"
                  size="icon"
                  type="button"
                  className="hover:bg-zinc-300 hover:text-black focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-white dark:text-black dark:hover:bg-zinc-300 dark:hover:text-black dark:hover:ring-0 dark:hover:ring-offset-0 dark:focus-visible:ring-0 dark:focus-visible:ring-offset-0"
                  onClick={() => remove(index)}
                  aria-label={`Remove item ${index + 1}`}>
                  <Trash className="size-4" />
                </Button>
              </div>

              {index < fields.length - 1 && <Separator />}
            </div>
          )
        })}

        <Button
          type="button"
          variant="secondary"
          onClick={() => append(defaultItemValue)}
          className="mt-4 flex items-center">
          <Plus
            className="mr-2"
            size={16}
          />
          Add {title}
        </Button>
      </AccordionContent>
    </AccordionItem>
  )
}
