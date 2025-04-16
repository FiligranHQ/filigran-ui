import {FileInput, FormControl, FormItem, FormMessage} from '../../clients'
import AutoFormTooltip from '../common/tooltip'
import type {AutoFormInputComponentProps} from '../types'
export default function AutoFormFile({
  fieldConfigItem,
  fieldProps,
}: AutoFormInputComponentProps) {
  const {showLabel: _showLabel, ...fieldPropsWithoutShowLabel} = fieldProps

  return (
    <FormItem>
      <FormControl>
        <FileInput {...fieldPropsWithoutShowLabel} />
      </FormControl>

      <AutoFormTooltip fieldConfigItem={fieldConfigItem} />
      <FormMessage />
    </FormItem>
  )
}
