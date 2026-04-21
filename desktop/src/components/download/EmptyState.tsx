import React from 'react';
import { Inbox } from 'lucide-react';
import { Icon } from '../common/Icon';

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full min-h-[200px] text-center p-8 bg-rv-panel/50 border border-dashed border-rv-border-inset rounded-[2px] m-4">
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-rv-raised border border-rv-border-inset">
        <Icon icon={Inbox} size={20} className="text-rv-text-disabled" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[14px] font-semibold text-rv-text-muted uppercase tracking-wider">{title}</h3>
        <p className="max-w-xs text-[11px] text-rv-text-disabled">{description}</p>
      </div>
    </div>
  );
}
