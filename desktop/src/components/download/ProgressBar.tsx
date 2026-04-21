import React from 'react';
import { DownloadItem } from '../../api/types';
import { cn } from '@/lib/utils';

type ProgressBarProps = {
  item: DownloadItem;
  className?: string;
  showText?: boolean;
};

export function ProgressBar({ item, className, showText = false }: ProgressBarProps) {
  const isComplete = item.status === 'complete';
  const isFailed = item.status === 'failed';
  const isRunning = item.status === 'running' || item.status === 'starting';
  const progress = item.progress;

  return (
    <div className={cn("relative flex flex-col gap-1 w-full", className)}>
      <div className="h-[4px] w-full bg-rv-input border border-rv-border-inset rounded-full overflow-hidden shadow-inner">
        <div
          className={cn(
            "h-full transition-all duration-300",
            isComplete ? "bg-rv-ok" : isFailed ? "bg-rv-error" : isRunning ? "bg-rv-accent" : "bg-rv-text-disabled"
          )}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
        {isRunning && item.indeterminate && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rv-accent/50 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
        )}
      </div>
      {showText && (
        <div className="flex justify-between text-[8px] font-bold uppercase tracking-[0.1em] tabular-nums">
           <span className={cn(isComplete ? "text-rv-ok" : isFailed ? "text-rv-error" : "text-rv-text-muted")}>
             {isComplete ? "COMPLETED" : isFailed ? "FAILED" : item.stage.toUpperCase() || "IDLE"}
           </span>
           <span className="text-rv-text-strong">
             {item.percentageLabel || (item.indeterminate ? "WAITING..." : `${Math.round(progress)}%`)}
           </span>
        </div>
      )}
    </div>
  );
}
