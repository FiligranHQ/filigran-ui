import * as z from 'zod'
import {
  FormControl,
  FormItem,
  FormMessage, MultiSelectFormField,
} from '../../clients'
import AutoFormLabel from '../common/label'
import AutoFormTooltip from '../common/tooltip'
import type {AutoFormInputComponentProps} from '../types'
import {getBaseSchema} from '../utils'

export default function AutoFormMultiSelect({
                                       label,
                                       isRequired,
                                       field,
                                       fieldConfigItem,
                                       zodItem,
                                       fieldProps,
                                     }: AutoFormInputComponentProps) {
  const baseValues = (getBaseSchema(zodItem) as unknown as z.ZodEnum<any>)._def.values

  let values: [string, string][] = []
  if (!Array.isArray(baseValues)) {
    values = Object.values(baseValues).map((value) => ({
      label: value.replaceAll('_', ' '),
      value
    }));
  } else {
    values = baseValues.map((value) => ({
      value,
        label: value
    }))
  }

  return (
    <FormItem>
      <AutoFormLabel
        label={fieldConfigItem?.label || label}
        isRequired={isRequired}
      />
      <FormControl>
          <MultiSelectFormField
            options={values}
            placeholder={'Select an option'}
            noResultString={'Not found'}
            onValueChange={field.onChange}
            defaultValue={field.value}
          {...fieldProps}/>

      </FormControl>
      <AutoFormTooltip fieldConfigItem={fieldConfigItem} />
      <FormMessage />
    </FormItem>
  )
}
