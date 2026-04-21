import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type DaVinciButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type DaVinciButtonSize = 'sm' | 'md' | 'icon' | 'lg';

export interface DaVinciButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DaVinciButtonVariant;
  size?: DaVinciButtonSize;
  icon?: ReactNode;
  active?: boolean;
}

export const DaVinciButton = forwardRef<HTMLButtonElement, DaVinciButtonProps>(({
  children,
  className,
  icon,
  size = 'md',
  variant = 'secondary',
  active,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "rv-button gap-1.5 shrink-0 uppercase tracking-[0.1em] font-bold text-[10px]",
        variant === 'primary' && "rv-button-primary",
        variant === 'danger' && "text-rv-error border-rv-error/40 hover:bg-rv-error/10",
        variant === 'ghost' && "bg-transparent border-transparent hover:bg-rv-raised/50 hover:border-rv-border-inset",
        size === 'sm' && "h-[20px] px-1.5",
        size === 'lg' && "h-[32px] px-4 text-[11px]",
        size === 'icon' && "w-[24px] p-0 flex items-center justify-center",
        active && "rv-button-active",
        className
      )}
      aria-pressed={active}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

DaVinciButton.displayName = 'DaVinciButton';
