import {cva, type VariantProps} from 'class-variance-authority'
import {CheckIcon, CloseIcon, KeyboardArrowDownIcon} from 'filigran-icon'
import * as React from 'react'
import {cn} from '../../lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '../clients'
import {Badge, Button} from '../servers'

const multiSelectVariants = cva('', {
  variants: {
    variant: {
      default:
        'border-foreground/10 drop-shadow-md text-primary-foreground bg-primary hover:bg-primary/80',
      secondary:
        'border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive:
        'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
      inverted: 'inverted',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface MultiSelectFormFieldProps<T extends Record<string, any> = Record<string, any>>
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
  asChild?: boolean
  options: T[]
  keyLabel?: keyof T
  keyValue?: keyof T
  defaultValue?: string[]
  disabled?: boolean
  placeholder: string
  noResultString: string
  className?: string
  onValueChange: (value: string[]) => void
}

const MultiSelectFormField = React.forwardRef<
  HTMLButtonElement,
  MultiSelectFormFieldProps
>(
  (
    {
      className,
      variant,
      asChild = false,
      options,
      keyLabel = 'label',
      keyValue = 'value',
      defaultValue,
      onValueChange,
      disabled,
      placeholder,
      noResultString = 'No results found',
      ...props
    },
    ref
  ) => {
    const [selectedValues, setSelectedValues] = React.useState<string[]>(
      defaultValue || []
    )
    const selectedValuesSet = React.useRef(new Set(selectedValues))
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)

    React.useEffect(() => {
      setSelectedValues(defaultValue || [])
      selectedValuesSet.current = new Set(defaultValue)
    }, [defaultValue])

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
    ) => {
      const target = event.target as HTMLInputElement
      if (event.key === 'Enter') {
        setIsPopoverOpen(true)
      } else if (event.key === 'Backspace' && !target.value) {
        if (selectedValues.length > 0) {
          const newValues = [...selectedValues]
          const lastValue = newValues.pop() || ''
          setSelectedValues(newValues)
          selectedValuesSet.current.delete(lastValue)
          onValueChange(newValues)
        }
      }
    }

    const toggleOption = (value: string) => {
      if (selectedValuesSet.current.has(value)) {
        selectedValuesSet.current.delete(value)
        setSelectedValues(selectedValues.filter((v) => v !== value))
      } else {
        selectedValuesSet.current.add(value)
        setSelectedValues([...selectedValues, value])
      }
      onValueChange(Array.from(selectedValuesSet.current))
    }

    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            {...props}
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            className="flex h-auto min-h-9 w-full items-center justify-between rounded border border-input bg-inherit p-1 hover:bg-hover">
            {selectedValues.length > 0 ? (
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-wrap items-center gap-s">
                  {selectedValues.map((value) => {
                    const option = options.find((o) => String(o[keyValue]) === value)

                    return (
                      <Badge
                        key={value}
                        className={cn(
                          multiSelectVariants({variant, className})
                        )}>
                        {option ? String(option[keyLabel]) : value}
                        <span
                          className="ml-s flex items-center justify-center"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleOption(value)
                          }}
                          aria-label={`Remove ${option ? String(option[keyLabel]) : value}`}>
                          <CloseIcon
                            className="h-3 w-3 cursor-pointer"
                          />
                        </span>
                      </Badge>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="flex items-center justify-center"
                    onClick={(event) => {
                      setSelectedValues([])
                      selectedValuesSet.current.clear()
                      onValueChange([])
                      event.stopPropagation()
                    }}
                    aria-label="Clear all selections">
                    <CloseIcon
                      className="mx-s h-3 cursor-pointer text-muted-foreground"
                    />
                  </button>
                  <Separator
                    orientation="vertical"
                    className="flex h-full min-h-6"
                  />
                  <KeyboardArrowDownIcon className="mx-2 w-2.5 h-2.5 cursor-pointer text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full items-center justify-between">
                <span className="mx-3 text-sm text-muted-foreground normal-case" role="textbox" aria-readonly="true">
                  {placeholder}
                </span>
                <KeyboardArrowDownIcon className="mx-2 w-2.5 h-2.5 cursor-pointer text-muted-foreground" aria-hidden="true" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-0 drop-shadow-sm"
          align="start"
          onEscapeKeyDown={() => setIsPopoverOpen(false)}>
          <Command>
            <CommandInput
              placeholder="Search..."
              onKeyDown={handleInputKeyDown}
            />
            <CommandList>
              <CommandEmpty>{noResultString}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const optionValue = String(option[keyValue])
                  const isSelected = selectedValuesSet.current.has(optionValue)
                  return (
                    <CommandItem
                      key={optionValue}
                      onSelect={() => toggleOption(optionValue)}
                      style={{
                        pointerEvents: 'auto',
                        opacity: 1,
                      }}
                      className="cursor-pointer">
                      {isSelected ? (
                        <div className="mr-2 flex h-4 w-4 min-w-4 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground">
                          <CheckIcon className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="mr-2 flex h-4 w-4 min-w-4 items-center justify-center rounded-sm border border-primary opacity-50">
                        </div>
                      )}

                      <span>{String(option[keyLabel])}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center justify-between">
                  {selectedValues.length > 0 && (
                    <>
                      <CommandItem
                        onSelect={() => {
                          setSelectedValues([])
                          selectedValuesSet.current.clear()
                          onValueChange([])
                        }}
                        style={{
                          pointerEvents: 'auto',
                          opacity: 1,
                        }}
                        className="flex-1 cursor-pointer justify-center uppercase">
                        Clear
                      </CommandItem>
                      <Separator
                        orientation="vertical"
                        className="flex h-full min-h-6"
                      />
                    </>
                  )}
                  <CommandSeparator />
                  <CommandItem
                    onSelect={() => setIsPopoverOpen(false)}
                    style={{
                      pointerEvents: 'auto',
                      opacity: 1,
                    }}
                    className="flex-1 cursor-pointer justify-center uppercase">
                    Close
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }
)

MultiSelectFormField.displayName = 'MultiSelectFormField'

export {MultiSelectFormField}
