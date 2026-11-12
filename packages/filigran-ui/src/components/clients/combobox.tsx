'use client'

import {CheckIcon, CloseIcon, ArrowDropDownIcon} from '@filigran/icon'
import * as React from 'react'
import {cn} from '../../lib/utils'
import {Button} from '../servers'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'
import {Popover, PopoverContent, PopoverTrigger} from './popover'

export interface ComboboxItem {
  value: string
  label: string
}

interface ComboboxProps<T> {
  dataTab: T[]
  order: string
  placeholder: string
  emptyCommand: string
  onValueChange: (value: T | undefined) => void
  onInputChange?: (value: string) => void
  value?: T
  className?: string
  keyValue?: keyof T | 'value'
  keyLabel?: keyof T | 'label'
  shouldFilter?: boolean
  disabled?: boolean
}

function Combobox<T>({
  dataTab,
  order,
  placeholder,
  emptyCommand,
  onValueChange,
  onInputChange,
  value,
  className,
  keyLabel = 'label',
  keyValue = 'value',
  shouldFilter = true,
  disabled,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false)

  // Every open-state change goes through here: the CommandInput is unmounted on
  // close without firing a change event, so the search term is reset explicitly.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      onInputChange?.('')
    }
  }

  const handleSelect = (selectedItem: T) => {
    handleOpenChange(false)
    onValueChange(selectedItem)
  }

  const handleSearchInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onInputChange && onInputChange(event.target.value)
  }

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange(undefined)
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'normal-case w-full justify-between bg-input-bg-default border-none',
            className
          )}>
          {value ? (
            String(value[keyLabel as keyof T])
          ) : (
            <span className="text-muted-foreground">{order}</span>
          )}
          <div className="flex items-center gap-s">
            {value && (
              <CloseIcon
                className="h-2.5 w-2.5 cursor-pointer text-muted-foreground"
                onClick={handleReset}
              />
            )}
            <ArrowDropDownIcon className="size-5 cursor-pointer text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 popover-content-width-same-as-its-trigger">
        {/* Set shouldFilter to false when options are already filtered server-side */}
        <Command
          onChange={handleSearchInputChange}
          shouldFilter={shouldFilter}>
          <CommandInput placeholder={placeholder} />
          <CommandList
            onWheel={(e) => {
              e.currentTarget.scrollTop += e.deltaY
              e.stopPropagation()
            }}>
            <CommandEmpty>{emptyCommand}</CommandEmpty>
            <CommandGroup>
              {dataTab.map((data) => (
                <CommandItem
                  key={String(data[keyValue as keyof T])}
                  value={String(data[keyValue as keyof T])}
                  keywords={[String(data[keyLabel as keyof T])]}
                  onSelect={() => handleSelect(data)}>
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.[keyValue as keyof T] === data[keyValue as keyof T]
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <span className="mx-3 text-sm text-foreground">
                    {String(data[keyLabel as keyof T])}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export {Combobox}
