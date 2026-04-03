import { type ChangeEvent, useEffect, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface DropdownOption {
  value: string;
  label: string;
}

type DropdownProps = {
  className?: string;
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  name?: string;
  resetOnSelect?: boolean;
};

export function Dropdown({
  className,
  options,
  value,
  defaultValue,
  placeholder,
  onChange,
  disabled,
  resetOnSelect,
}: DropdownProps) {
  const [internalValue, setInternalValue] = useState<string | undefined>(value ?? defaultValue);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  return (
    <Select
      value={value !== undefined ? value : internalValue}
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (value === undefined) {
          setInternalValue(resetOnSelect ? defaultValue : nextValue);
        }
        onChange?.({
          target: { value: nextValue },
        } as ChangeEvent<HTMLSelectElement>);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
