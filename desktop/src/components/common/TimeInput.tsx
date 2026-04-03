import clsx from 'clsx';
import { type InputHTMLAttributes } from 'react';

type TimeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function TimeInput({ className, ...props }: TimeInputProps) {
  return (
    <input
      type="text"
      className={clsx(
        'h-10 w-full rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--color-main)] focus:bg-white/8',
        className
      )}
      {...props}
    />
  );
}
