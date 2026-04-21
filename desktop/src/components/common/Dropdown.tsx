import { type ChangeEvent } from 'react';
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
          "rv-input w-full flex items-center justify-between gap-2 px-2 disabled:opacity-40 disabled:cursor-not-allowed group transition-colors hover:border-rv-border-strong font-medium uppercase tracking-[0.05em]",
          className
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <Icon icon={ChevronDown} size={11} className="text-rv-text-disabled group-hover:text-rv-text-muted" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="bg-rv-panel border border-rv-border-inset shadow-[0_10px_25px_rgba(0,0,0,0.5)] z-[100] p-1 animate-in fade-in zoom-in duration-75 overflow-hidden rounded-[1px]"
          position="popper"
          sideOffset={2}
        >
          <Select.Viewport className="p-0 min-w-[120px]">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={cn(
                  "flex items-center justify-between px-3 py-1 text-[10px] outline-none cursor-default select-none uppercase tracking-wide font-semibold",
                  "text-rv-text-muted hover:bg-rv-accent hover:text-white data-[highlighted]:bg-rv-accent data-[highlighted]:text-white transition-colors"
                )}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="ml-4">
                  <Icon icon={Check} size={11} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
