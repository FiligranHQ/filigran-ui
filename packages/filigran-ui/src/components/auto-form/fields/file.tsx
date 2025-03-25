import {type ChangeEvent, useState} from 'react'
import {FileInput, FormControl, FormItem, FormMessage} from '../../clients'
import {Input} from '../../servers'
import AutoFormLabel from '../common/label'
import AutoFormTooltip from '../common/tooltip'
import type {AutoFormInputComponentProps} from '../types'
import {CloseIcon} from 'filigran-icon'
export default function AutoFormFile({
  label,
  isRequired,
  fieldConfigItem,
  fieldProps,
  field,
}: AutoFormInputComponentProps) {
  const {showLabel: _showLabel, ...fieldPropsWithoutShowLabel} = fieldProps
  const showLabel = _showLabel === undefined ? true : _showLabel


  console.log({fieldPropsWithoutShowLabel})
  return (
    <FormItem>
      {showLabel && (
        <AutoFormLabel
          label={fieldConfigItem?.label || label}
          isRequired={isRequired}
        />
      )}
      <FormControl>
      <FileInput
        {...fieldPropsWithoutShowLabel}
      />
      </FormControl>
      <AutoFormTooltip fieldConfigItem={fieldConfigItem} />
      <FormMessage />
    </FormItem>
  )
}
