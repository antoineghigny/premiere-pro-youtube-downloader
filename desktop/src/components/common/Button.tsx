import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'icon';
  icon?: ReactNode;
  active?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
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
        "rv-button gap-1.5",
        variant === 'primary' && "text-rv-accent border-rv-accent/30",
        variant === 'danger' && "text-rv-error border-rv-error/30",
        variant === 'ghost' && "bg-transparent border-transparent hover:bg-rv-button-hover hover:border-rv-border-inset",
        size === 'sm' && "h-[18px] px-1.5 text-[10px]",
        size === 'icon' && "w-[22px] p-0 flex items-center justify-center",
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

Button.displayName = 'Button';
