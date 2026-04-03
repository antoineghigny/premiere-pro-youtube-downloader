import { type ReactNode } from 'react';

import { Badge as ShadcnBadge } from '@/components/ui/badge';

type BadgeProps = {
  color?: 'purple' | 'green' | 'blue' | 'red' | 'neutral';
  children: ReactNode;
};

export function Badge({ color = 'neutral', children }: BadgeProps) {
  const className =
    color === 'purple'
      ? 'border-[var(--color-main)]/40 bg-[var(--color-main)]/14 text-[var(--color-grey-light)]'
      : color === 'green'
        ? 'border-emerald-400/30 bg-emerald-500/14 text-emerald-100'
        : color === 'blue'
          ? 'border-sky-400/30 bg-sky-500/14 text-sky-100'
          : color === 'red'
            ? 'border-red-400/30 bg-red-500/14 text-red-100'
            : 'border-white/10 bg-white/5 text-[var(--text-muted)]';

  return (
    <ShadcnBadge className={className}>
      {children}
    </ShadcnBadge>
  );
}
