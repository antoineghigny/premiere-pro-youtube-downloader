import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="panel-surface flex min-h-[240px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/6">
        <Inbox className="h-7 w-7 text-[var(--text-muted)]" />
      </div>
      <div className="space-y-2">
        <div className="text-lg font-semibold text-white">{title}</div>
        <p className="max-w-lg text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      </div>
    </div>
  );
}
