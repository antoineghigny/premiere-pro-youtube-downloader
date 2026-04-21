import React from 'react';
import { FolderOpen, RefreshCcw, Trash2, CheckCircle2, AlertCircle, Clock, Activity } from 'lucide-react';
import type { DownloadItem } from '../../api/types';
import { formatBytes, formatElapsed, formatRepresentativeSpeed } from '../../utils/format';
import { Button } from '../common/Button';
import { ProgressBar } from './ProgressBar';
import { Icon } from '../common/Icon';
import { cn } from '@/lib/utils';

type DownloadRowProps = {
  item: DownloadItem;
  onRetry: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
};

export function DownloadRow({ item, onRetry, onDelete, onReveal }: DownloadRowProps) {
  const isComplete = item.status === 'complete';
  const isFailed = item.status === 'failed';
  const isRunning = item.status === 'running' || item.status === 'starting';

  return (
    <div className="group flex items-center h-[28px] border-b border-rv-border-inset bg-rv-panel hover:bg-rv-raised/30 transition-colors px-3 gap-4 select-none">
      {/* Status Icon */}
      <div className="w-[20px] flex items-center justify-center shrink-0">
         <Icon 
           icon={isComplete ? CheckCircle2 : isFailed ? AlertCircle : isRunning ? Activity : Clock} 
           size={12} 
           className={cn(
             isComplete ? "text-rv-ok" : isFailed ? "text-rv-error" : isRunning ? "text-rv-accent animate-pulse" : "text-rv-text-disabled"
           )} 
         />
      </div>

      {/* Thumbnail */}
      <div className="w-[40px] h-[20px] bg-black rounded-[1px] overflow-hidden shrink-0 border border-rv-border-inset">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-10 bg-rv-input">
            <Icon icon={Clock} size={10} />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn(
          "text-[10px] truncate font-bold tracking-tight uppercase",
          isComplete ? "text-rv-text-strong" : isFailed ? "text-rv-error" : "text-rv-text"
        )}>
          {item.title}
        </span>
        <span className="text-[8px] text-rv-text-disabled truncate uppercase tracking-widest font-black opacity-50 border border-rv-border-inset px-1 rounded-[1px]">
          {item.stage || "IDLE"}
        </span>
      </div>

      {/* Progress */}
      <div className="w-[120px] flex items-center gap-3">
        <ProgressBar item={item} className="h-1" />
        <span className="text-[9px] font-mono font-bold text-rv-text-muted w-8 text-right tabular-nums">
          {item.percentageLabel || (item.indeterminate ? "---" : `${Math.round(item.progress)}%`)}
        </span>
      </div>

      {/* Stats */}
      <div className="w-[60px] text-[9px] text-rv-text-muted font-mono text-right font-bold tabular-nums">
        {formatBytes(item.totalBytes)}
      </div>
      
      <div className="w-[80px] text-[9px] text-rv-text-muted font-mono text-right truncate font-bold tabular-nums opacity-80">
        {isComplete ? "OK" : isFailed ? "ERROR" : formatRepresentativeSpeed(item.speedPoints, item.speed)}
      </div>

      <div className="w-[50px] text-[9px] text-rv-text-muted font-mono text-right font-bold tabular-nums opacity-80">
        {item.eta || formatElapsed(item.startedAt, item.completedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pl-2 w-[80px] justify-end">
        <Button size="icon" variant="ghost" disabled={!isComplete} onClick={() => onReveal(item)} className="h-5 w-5" title="REVEAL">
          <Icon icon={FolderOpen} size={11} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onRetry(item)} className="h-5 w-5" title="RETRY">
          <Icon icon={RefreshCcw} size={11} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(item)} className="h-5 w-5" title="REMOVE">
          <Icon icon={Trash2} size={11} className="text-rv-error/70" />
        </Button>
      </div>
    </div>
  );
}
