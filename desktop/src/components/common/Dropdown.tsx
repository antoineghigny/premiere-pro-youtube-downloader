import { type ChangeEvent, useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

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
}: DropdownProps) {
  return (
    <Select.Root
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={(nextValue) => {
        onChange?.({
          target: { value: nextValue },
        } as ChangeEvent<HTMLSelectElement>);
      }}
    >
      <Select.Trigger
        className={cn(
          "rv-input w-full flex items-center justify-between gap-2 px-2 disabled:opacity-50 disabled:cursor-not-allowed group transition-colors hover:border-rv-border-strong",
          className
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <Icon icon={ChevronDown} size={12} className="text-rv-text-disabled group-hover:text-rv-text-muted" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="bg-rv-panel border border-rv-border-inset shadow-lg z-[100] p-1 animate-in fade-in zoom-in duration-75 overflow-hidden rounded-[2px]"
          position="popper"
          sideOffset={2}
        >
          <Select.Viewport className="p-0">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={cn(
                  "flex items-center justify-between px-2 py-1 text-xs outline-none cursor-default select-none transition-colors",
                  "text-rv-text hover:bg-rv-accent hover:text-black data-[highlighted]:bg-rv-accent data-[highlighted]:text-black"
                )}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Icon icon={Check} size={12} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
