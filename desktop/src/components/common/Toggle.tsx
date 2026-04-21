import { cn } from '@/lib/utils';
import { Button } from './Button';

type ToggleProps = {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function Toggle({ checked, onChange, disabled, label, className }: ToggleProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      active={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={className}
    >
      {label || (checked ? 'ON' : 'OFF')}
    </Button>
  );
}
