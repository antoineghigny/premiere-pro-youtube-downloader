import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeProps = {
  variant?: 'ok' | 'warn' | 'error' | 'neutral' | 'accent';
  children: ReactNode;
  className?: string;
};

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] uppercase font-medium border leading-none tracking-tight",
      variant === 'ok' && "bg-rv-ok/10 border-rv-ok/30 text-rv-ok",
      variant === 'warn' && "bg-rv-warn/10 border-rv-warn/30 text-rv-warn",
      variant === 'error' && "bg-rv-error/10 border-rv-error/30 text-rv-error",
      variant === 'accent' && "bg-rv-accent/10 border-rv-accent/30 text-rv-accent",
      variant === 'neutral' && "bg-rv-input border-rv-border-inset text-rv-text-muted",
      className
    )}>
      {children}
    </div>
  );
}
