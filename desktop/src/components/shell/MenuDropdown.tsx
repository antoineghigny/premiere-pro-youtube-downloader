import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

interface MenuDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
}

export const MenuDropdown: React.FC<MenuDropdownProps> = ({ trigger, children }) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="px-3 hover:bg-rv-button-hover h-full flex items-center outline-none select-none text-rv-text hover:text-rv-text-strong transition-colors">
          {trigger}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content 
          className="min-w-[200px] bg-rv-panel border border-rv-border-inset shadow-lg z-50 p-1 animate-in fade-in zoom-in duration-75"
          align="start"
          sideOffset={0}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export const MenuItem = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; onClick?: () => void; shortcut?: string; disabled?: boolean; className?: string }
>(({ children, onClick, shortcut, disabled, className }, ref) => (
  <DropdownMenu.Item
    ref={ref}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex items-center justify-between px-2 py-1 text-xs outline-none cursor-default select-none transition-colors",
      "text-rv-text hover:bg-rv-accent hover:text-black",
      "data-[disabled]:text-rv-text-disabled data-[disabled]:pointer-events-none",
      className
    )}
  >
    <span>{children}</span>
    {shortcut && <span className="ml-4 text-[10px] opacity-60">{shortcut}</span>}
  </DropdownMenu.Item>
));

export const MenuSeparator = () => (
  <DropdownMenu.Separator className="h-px bg-rv-border-inset my-1 mx-1" />
);
