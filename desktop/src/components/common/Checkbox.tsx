import { type ChangeEvent, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Icon } from './Icon';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
};

export function Checkbox({ className, checked, label, onChange, disabled, ...props }: CheckboxProps) {
  return (
    <label className={cn(
      "inline-flex items-center gap-2 text-xs select-none",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      className
    )}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={onChange}
          {...props}
        />
        <div className={cn(
          "w-3.5 h-3.5 border rounded-[2px] transition-colors flex items-center justify-center",
          checked 
            ? "bg-rv-accent border-rv-accent text-black" 
            : "bg-rv-input border-rv-border-inset"
        )}>
          {checked && <Icon icon={Check} size={10} strokeWidth={3} />}
        </div>
      </div>
      {label && <span className="text-rv-text-muted">{label}</span>}
    </label>
  );
}
