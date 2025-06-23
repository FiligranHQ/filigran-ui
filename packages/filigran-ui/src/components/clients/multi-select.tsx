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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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

interface MultiSelectFormFieldProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
  asChild?: boolean
  options: {
    label: string
    value: string
  }[]
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
    const [visibleBadges, setVisibleBadges] = React.useState<number>(
      selectedValues.length
    )
    const badgesContainerRef = React.useRef<HTMLDivElement>(null)
    const measurementRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      setSelectedValues(defaultValue || [])
      selectedValuesSet.current = new Set(defaultValue)
    }, [defaultValue])

    const updateBadgeVisibility = React.useCallback(() => {
      if (!badgesContainerRef.current || !measurementRef.current) {
        return
      }

      const container = badgesContainerRef.current
      const measurementContainer = measurementRef.current
      const containerWidth = container.offsetWidth - 100 // Save space for controls

      let totalWidth = 0
      let lastVisibleIndex = 0

      const children = Array.from(
        measurementContainer.children
      ) as HTMLElement[]

      for (let i = 0; i < selectedValues.length; i++) {
        const child = children[i]
        if (child) {
          const childWidth = child.offsetWidth
          const overflowBadgeLength = 56
          if (totalWidth + childWidth + overflowBadgeLength > containerWidth) {
            break
          }

          totalWidth += childWidth
          lastVisibleIndex = i + 1
        }
      }

      setVisibleBadges(lastVisibleIndex)
    }, [selectedValues])

    React.useEffect(() => {
      updateBadgeVisibility()
    }, [selectedValues, updateBadgeVisibility])

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
    ) => {
      const target = event.target as HTMLInputElement
      if (event.key === 'Enter') {
        setIsPopoverOpen(true)
      } else if (event.key === 'Backspace' && !target) {
        selectedValues.pop()
        setSelectedValues([...selectedValues])
        selectedValuesSet.current.delete(
          selectedValues[selectedValues.length - 1]
        )
        onValueChange([...selectedValues])
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

    const hiddenCount = selectedValues.length - visibleBadges

    return (
      <TooltipProvider delayDuration={0}>
        <Popover
          open={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              {...props}
              onClick={() => setIsPopoverOpen(!isPopoverOpen)}
              className="flex h-9 w-full items-center justify-between rounded border border-input bg-inherit p-1 hover:bg-hover">
              {selectedValues.length > 0 ? (
                <div className="flex w-full items-center">
                  <div
                    ref={badgesContainerRef}
                    className="flex flex-1 items-center gap-s overflow-hidden">
                    <div
                      ref={measurementRef}
                      className="absolute invisible flex items-center gap-s"
                      aria-hidden="true">
                      {selectedValues.map((value) => {
                        const option = options.find((o) => o.value === value)
                        return (
                          <Badge
                            key={value}
                            className={cn(
                              multiSelectVariants({variant, className})
                            )}>
                            {option?.label}
                            <CloseIcon className="ml-s h-3 w-3" />
                          </Badge>
                        )
                      })}
                    </div>

                    {selectedValues.slice(0, visibleBadges).map((value) => {
                      const option = options.find((o) => o.value === value)

                      return (
                        <Badge
                          key={value}
                          className={cn(
                            multiSelectVariants({variant, className}),
                            'whitespace-nowrap'
                          )}>
                          {option?.label}
                          <CloseIcon
                            className="ml-s h-3 w-3 cursor-pointer"
                            onClick={(
                              event: React.MouseEvent<SVGSVGElement, MouseEvent>
                            ) => {
                              event.stopPropagation()
                              toggleOption(value)
                            }}
                          />
                        </Badge>
                      )
                    })}

                    {hiddenCount > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex">
                            <Badge>+{hiddenCount}...</Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="flex flex-wrap gap-s p-s">
                            {selectedValues
                              .slice(visibleBadges)
                              .map((value) => {
                                const hiddenValue = options.find(
                                  (option) => option.value === value
                                )
                                return (
                                  <Badge key={value}>
                                    {hiddenValue?.label}
                                  </Badge>
                                )
                              })}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <CloseIcon
                      className="mx-s h-3 cursor-pointer text-muted-foreground"
                      onClick={(
                        event: React.MouseEvent<SVGSVGElement, MouseEvent>
                      ) => {
                        setSelectedValues([])
                        selectedValuesSet.current.clear()
                        onValueChange([])
                        event.stopPropagation()
                      }}
                    />
                    <Separator
                      orientation="vertical"
                      className="h-6"
                    />
                    <KeyboardArrowDownIcon className="mx-2 w-2.5 h-2.5 cursor-pointer text-muted-foreground" />
                  </div>
                </div>
              ) : (
                <div className="flex w-full items-center justify-between">
                  <span className="mx-3 text-sm text-muted-foreground normal-case">
                    {placeholder}
                  </span>
                  <KeyboardArrowDownIcon className="mx-2 w-2.5 h-2.5 cursor-pointer text-muted-foreground" />
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[200px] p-0 drop-shadow-sm"
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
                  {options
                    .sort((valueA, valueB) =>
                      valueA.label.localeCompare(valueB.label)
                    )
                    .map((option) => {
                      const isSelected = selectedValuesSet.current.has(
                        option.value
                      )
                      return (
                        <CommandItem
                          key={option.value}
                          onSelect={() => toggleOption(option.value)}
                          style={{
                            pointerEvents: 'auto',
                            opacity: 1,
                          }}
                          className="cursor-pointer">
                          <div
                            className={cn(
                              'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'opacity-50 [&_svg]:invisible'
                            )}>
                            <CheckIcon className="h-4 w-4" />
                          </div>

                          <span>{option.label}</span>
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
      </TooltipProvider>
    )
  }
)

MultiSelectFormField.displayName = 'MultiSelectFormField'

export {MultiSelectFormField}
