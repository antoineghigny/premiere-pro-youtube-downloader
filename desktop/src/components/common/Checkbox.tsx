import { type ChangeEvent, type InputHTMLAttributes } from 'react';

import { Checkbox as ShadcnCheckbox } from '@/components/ui/checkbox';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export function Checkbox({ className, checked, label, onChange, ...props }: CheckboxProps) {
  return (
    <label className={className ? `inline-flex items-center gap-3 text-sm text-white ${className}` : 'inline-flex items-center gap-3 text-sm text-white'}>
      <ShadcnCheckbox
        id={props.id}
        checked={Boolean(checked)}
        disabled={props.disabled}
        required={props.required}
        onCheckedChange={(nextValue) => {
          onChange?.({
            target: { checked: Boolean(nextValue) },
          } as ChangeEvent<HTMLInputElement>);
        }}
      />
      <span className="text-[var(--text-muted)]">{label}</span>
    </label>
  );
}
