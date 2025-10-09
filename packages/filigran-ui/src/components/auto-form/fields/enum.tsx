import {Select} from '@radix-ui/react-select'
import * as z from 'zod'
import {
  FormControl,
  FormItem,
  FormMessage,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../clients'
import AutoFormLabel from '../common/label'
import AutoFormTooltip from '../common/tooltip'
import type {AutoFormInputComponentProps} from '../types'
import {getBaseSchema} from '../utils'

export default function AutoFormEnum({
  label,
  isRequired,
  field,
  fieldConfigItem,
  zodItem,
  fieldProps,
}: AutoFormInputComponentProps) {
  const baseSchema = getBaseSchema(zodItem) as unknown as z.ZodEnum<any>

  let values: [string, string][] = []
  if (baseSchema) {
    const def = (baseSchema as any)._def

    if (def.typeName === 'ZodEnum' && def.values) {
      const baseValues = def.values

      if (!Array.isArray(baseValues)) {
        values = Object.entries(baseValues)
      } else {
        values = baseValues.map((value: string) => [value, value])
      }
    } else if (def.typeName === 'ZodNativeEnum' && def.values) {
      values = Object.entries(def.values)
        .filter(([key, value]) => typeof value === 'string')
        .map(([key, value]) => [value as string, value as string])
    } else if (def.typeName === 'ZodUnion' && def.options) {
      values = def.options
        .filter((opt: any) => opt._def.typeName === 'ZodLiteral')
        .map((opt: any) => {
          const value = opt._def.value
          return [value, value]
        })
    }
  }

  function findItem(value: any) {
    return values.find((item) => item[0] === value)
  }

  return (
    <FormItem>
      <AutoFormLabel
        label={fieldConfigItem?.label || label}
        isRequired={isRequired}
      />
      <FormControl>
        <Select
          onValueChange={field.onChange}
          defaultValue={field.value}
          {...fieldProps}>
          <SelectTrigger className={fieldProps.className}>
            <SelectValue placeholder={fieldConfigItem.inputProps?.placeholder}>
              {field.value ? findItem(field.value)?.[1] : 'Select an option'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {values.map(([value, label]) => (
              <SelectItem
                value={label}
                key={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <AutoFormTooltip fieldConfigItem={fieldConfigItem} />
      <FormMessage />
    </FormItem>
  )
}
