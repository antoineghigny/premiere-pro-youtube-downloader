import React from 'react';
import { cn } from '@/lib/utils';
import type { DownloadItem } from '../../api/types';

type ProgressBarProps = {
  item: DownloadItem;
  className?: string;
};

export function ProgressBar({ item, className }: ProgressBarProps) {
  const isFailed = item.status === 'failed';
  const isComplete = item.status === 'complete';
  const progress = isComplete ? 100 : item.indeterminate ? 8 : Math.max(0, Math.min(100, item.progress));

  return (
    <div className={cn("relative h-1 bg-rv-input overflow-hidden rounded-[1px]", className)}>
      <div 
        className={cn(
          "h-full transition-[width] duration-300 ease-out",
          isFailed ? "bg-rv-error" : isComplete ? "bg-rv-ok" : "bg-rv-accent"
        )}
        style={{ width: `${progress}%` }}
      />
      {item.indeterminate && !isComplete && !isFailed && (
        <div className="absolute inset-0 bg-white/10 animate-pulse" />
      )}
    </div>
  );
}
