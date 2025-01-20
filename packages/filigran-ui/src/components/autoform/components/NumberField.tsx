import type {AutoFormFieldProps} from '@autoform/react'
import React from 'react'
import {Input} from '../../servers'

export const NumberField: React.FC<AutoFormFieldProps> = ({
  inputProps,
  error,
  id,
}) => {
  const {key, ...props} = inputProps

  return (
    <Input
      id={id}
      type="number"
      className={error ? 'border-destructive' : ''}
      {...props}
    />
  )
}
