import {FormControl, FormItem, FormLabel, FormMessage} from '../../clients'
import {RadioGroup, RadioGroupItem} from '../../clients/radio-group'
import AutoFormLabel from '../common/label'
import AutoFormTooltip from '../common/tooltip'
import type {AutoFormInputComponentProps} from '../types'
import {getBaseSchema} from '../utils'

export default function AutoFormRadioGroup({
  label,
  isRequired,
  field,
  zodItem,
  fieldProps,
  fieldConfigItem,
}: AutoFormInputComponentProps) {
  const baseSchema = getBaseSchema(zodItem)
  let values: string[] = []

  if (baseSchema) {
    const def = (baseSchema as any)._def

    if (def.typeName === 'enum' && def.values) {
      const baseValues = def.values

      if (!Array.isArray(baseValues)) {
        values = Object.entries(baseValues).map(([key, value]) => key)
      } else {
        values = baseValues
      }
    }
  }

  return (
    <div>
      <FormItem>
        <AutoFormLabel
          label={fieldConfigItem?.label || label}
          isRequired={isRequired}
        />
        <FormControl>
          <RadioGroup
            onValueChange={field.onChange}
            defaultValue={field.value}
            {...fieldProps}>
            {values?.map((value: any) => (
              <FormItem
                key={value}
                className="mb-2 flex items-center gap-3 space-y-0">
                <FormControl>
                  <RadioGroupItem value={value} />
                </FormControl>
                <FormLabel className="font-normal">{value}</FormLabel>
              </FormItem>
            ))}
          </RadioGroup>
        </FormControl>
        <FormMessage />
      </FormItem>
      <AutoFormTooltip fieldConfigItem={fieldConfigItem} />
    </div>
  )
}
