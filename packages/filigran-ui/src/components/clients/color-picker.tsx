'use client'

import {forwardRef, useMemo, useState} from 'react'
import {SketchPicker} from 'react-color'
import {cn} from '../../lib/utils'
import {Button, type ButtonProps, Input} from '../servers'
import {Popover, PopoverContent, PopoverTrigger} from './popover'

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
}

const ColorPicker = forwardRef<
  HTMLInputElement,
  Omit<ButtonProps, 'value' | 'onChange' | 'onBlur'> & ColorPickerProps
>(
  (
    {disabled, value, onChange, onBlur, name, className, ...props},
    forwardedRef
  ) => {
    const [open, setOpen] = useState(false)

    const parsedValue = useMemo(() => {
      return value || '#FFFFFF'
    }, [value])

    return (
      <Popover
        onOpenChange={setOpen}
        open={open}>
        <div className="flex gap-2 items-center relative">
          <Input
            maxLength={7}
            onChange={(e) => {
              onChange(e?.currentTarget?.value)
            }}
            ref={forwardedRef}
            value={parsedValue}
          />
          <PopoverTrigger
            asChild
            disabled={disabled}
            onBlur={onBlur}>
            <Button
              {...props}
              className={cn('block', className, 'size-5 absolute right-2')}
              name={name}
              onClick={() => {
                setOpen(true)
              }}
              size="icon-rounded"
              style={{
                backgroundColor: parsedValue,
              }}
              variant="outline">
              <div />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-full">
          <SketchPicker
            color={parsedValue}
            onChangeComplete={(v: {hex: string}) => onChange(v.hex)}
          />
        </PopoverContent>
      </Popover>
    )
  }
)
ColorPicker.displayName = 'ColorPicker'

export {ColorPicker}
