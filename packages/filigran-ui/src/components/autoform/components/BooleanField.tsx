import type {AutoFormFieldProps} from '@autoform/react'
import React from 'react'
import {Checkbox, Label} from '../../clients'

export const BooleanField: React.FC<AutoFormFieldProps> = ({
  field,
  label,
  id,
  inputProps,
  value,
}) => (
  <div className="flex items-center space-x-2">
    <Checkbox
      id={id}
      onCheckedChange={(checked) => {
        // react-hook-form expects an event object
        const event = {
          target: {
            name: field.key,
            value: checked,
          },
        }
        inputProps.onChange(event)
      }}
      checked={value}
    />
    <Label htmlFor={id}>
      {label}
      {field.required && <span className="text-destructive"> *</span>}
    </Label>
  </div>
)
