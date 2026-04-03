import { Switch } from '@/components/ui/switch';

type ToggleProps = {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  );
}
