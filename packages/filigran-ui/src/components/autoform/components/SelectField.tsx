import type {AutoFormFieldProps} from '@autoform/react'
import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../clients'

export const SelectField: React.FC<AutoFormFieldProps> = ({
  field,
  inputProps,
  error,
  id,
}) => {
  const {key, ...props} = inputProps

  return (
    <Select {...props}>
      <SelectTrigger
        id={id}
        className={error ? 'border-destructive' : ''}>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        {(field.options || []).map(([key, label]) => (
          <SelectItem
            key={key}
            value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
