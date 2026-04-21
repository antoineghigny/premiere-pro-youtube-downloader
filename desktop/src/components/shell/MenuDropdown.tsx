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
        <button className="px-3 hover:bg-rv-raised h-full flex items-center outline-none select-none text-[11px] font-medium tracking-wide text-rv-text-muted hover:text-rv-text-strong transition-colors border-r border-rv-border-inset">
          {trigger}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content 
          className="min-w-[220px] bg-rv-panel border border-rv-border-inset shadow-[0_15px_35px_rgba(0,0,0,0.6)] z-[100] p-1 animate-in fade-in zoom-in duration-75 rounded-[1px]"
          align="start"
          sideOffset={1}
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
      "flex items-center justify-between px-3 py-1 text-[11px] outline-none cursor-default select-none transition-colors rounded-[1px]",
      "text-rv-text-strong hover:bg-rv-accent hover:text-white data-[highlighted]:bg-rv-accent data-[highlighted]:text-white",
      "data-[disabled]:text-rv-text-disabled data-[disabled]:pointer-events-none",
      className
    )}
  >
    <span className="font-medium">{children}</span>
    {shortcut && <span className="ml-8 text-[9px] font-mono opacity-50 tracking-tighter tabular-nums">{shortcut}</span>}
  </DropdownMenu.Item>
));

MenuItem.displayName = 'MenuItem';

export const MenuSeparator = () => (
  <DropdownMenu.Separator className="h-px bg-rv-border-inset my-1 mx-1" />
);
