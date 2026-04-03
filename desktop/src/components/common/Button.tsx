import { type ButtonHTMLAttributes, type ReactNode } from 'react';

import { Button as ShadcnButton } from '@/components/ui/button';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
};

export function Button({
  children,
  className,
  icon,
  size = 'md',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const resolvedVariant =
    variant === 'primary'
      ? 'default'
      : variant === 'secondary'
        ? 'secondary'
        : variant === 'danger'
          ? 'destructive'
          : 'ghost';

  return (
    <ShadcnButton
      className={className}
      variant={resolvedVariant}
      size={size === 'sm' ? 'sm' : 'lg'}
      {...props}
    >
      {icon}
      {children}
    </ShadcnButton>
  );
}
