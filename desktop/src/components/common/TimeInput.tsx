import { cn } from '@/lib/utils';
import { type InputHTMLAttributes } from 'react';

type TimeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function TimeInput({ className, onMouseDown, onPointerDown, ...props }: TimeInputProps) {
  return (
    <input
      type="text"
      className={cn(
        'rv-input w-full font-mono text-center',
        className
      )}
      onMouseDown={(event) => {
        event.stopPropagation();
        onMouseDown?.(event);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
}
