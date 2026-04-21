import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface DaVinciInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const DaVinciInput = forwardRef<HTMLInputElement, DaVinciInputProps>(({
  className,
  ...props
}, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "rv-input",
        className
      )}
      {...props}
    />
  );
});

DaVinciInput.displayName = 'DaVinciInput';
