"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "../../lib/utils";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "../servers";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

interface ComboboxProps {
  dataTab: { value: string; label: string }[];
  order: string;
  placeholder: string;
  emptyCommand: string;
  onValueChange: (value: string) => void;
  value?: string;
}

function Combobox({
  dataTab,
  order,
  placeholder,
  emptyCommand,
  onValueChange,
  value = "",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value ? "" : currentValue;
    setOpen(false);
    onValueChange(newValue);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          onClick={() => setOpen(!open)}
        >
          {value ? dataTab.find((data) => data.value === value)?.label : order}
          <ChevronDown className="h-4 cursor-pointer text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyCommand}</CommandEmpty>
            <CommandGroup>
              {dataTab.map((data) => (
                <CommandItem
                  key={data.value}
                  value={data.value}
                  onSelect={() => handleSelect(data.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === data.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-sm text-muted-foreground mx-3">
                    {data.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { Combobox };
