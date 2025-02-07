'use client'

import {CheckIcon, KeyboardArrowDownIcon} from 'filigran-icon'
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

interface ComboboxProps {
  dataTab: {value: string; label: string}[]
  order: string
  placeholder: string
  emptyCommand: string
  onValueChange: (value: string) => void
  onInputChange: (value: string) => void
  value?: string
  className?: string
}

function Combobox({
  dataTab,
  order,
  placeholder,
  emptyCommand,
  onValueChange,
  onInputChange,
  value = '',
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value ? '' : currentValue
    setOpen(false)
    onValueChange(newValue)
  }

  const handleSearchInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onInputChange(event.target.value)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'normal-case w-full justify-between border-input',
            className
          )}
          onClick={() => setOpen(!open)}>
          {value ? (
            dataTab.find((data) => data.value === value)?.label
          ) : (
            <span className="text-muted-foreground">{order}</span>
          )}
          <KeyboardArrowDownIcon className="h-2.5 w-2.5 cursor-pointer text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 popover-content-width-same-as-its-trigger">
        <Command onChange={handleSearchInputChange}>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyCommand}</CommandEmpty>
            <CommandGroup>
              {dataTab.map((data) => (
                <CommandItem
                  key={data.value}
                  value={data.value}
                  onSelect={() => handleSelect(data.value)}>
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === data.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="mx-3 text-sm text-foreground">
                    {data.label}
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
