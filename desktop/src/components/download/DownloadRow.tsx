import React from 'react';
import { FolderOpen, RefreshCcw, Trash2, CheckCircle2, AlertCircle, Clock, Activity } from 'lucide-react';
import { formatBytes, formatElapsed, formatRepresentativeSpeed } from '../../utils/format';
import { ProgressBar } from './ProgressBar';
import { Icon } from '../common/Icon';
import { cn } from '@/lib/utils';
import type { DownloadItem } from '../../api/types';

interface DownloadRowProps {
  item: DownloadItem;
  onRetry: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
}

export const DownloadRow: React.FC<DownloadRowProps> = ({ item, onRetry, onDelete, onReveal }) => {
  const isComplete = item.status === 'complete';
  const isFailed = item.status === 'failed';
  const isRunning = item.status === 'running' || item.status === 'starting';

  return (
    <div className="group flex items-center h-[28px] border-b border-rv-border-inset hover:bg-rv-raised/40 px-3 gap-3 select-none cursor-pointer transition-colors">
      <div className="w-4 flex items-center justify-center shrink-0">
         <Icon 
           icon={isComplete ? CheckCircle2 : isFailed ? AlertCircle : isRunning ? Activity : Clock} 
           size={11} 
           className={cn(
             isComplete ? "text-rv-ok" : isFailed ? "text-rv-error" : isRunning ? "text-rv-accent animate-pulse" : "text-rv-text-disabled"
           )} 
         />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn(
          "text-[10px] truncate font-bold uppercase tracking-tight",
          isComplete ? "text-rv-text-strong" : isFailed ? "text-rv-error" : "text-rv-text"
        )}>
          {item.title}
        </span>
      </div>

      <div className="w-24 flex items-center px-2">
        <ProgressBar item={item} className="h-0.5" />
      </div>

      <div className="w-16 text-[9px] text-rv-text-muted font-mono text-right tabular-nums uppercase">
        {formatBytes(item.totalBytes)}
      </div>
      
      <div className="w-20 text-[9px] text-rv-text-muted font-mono text-right tabular-nums uppercase">
        {formatRepresentativeSpeed(item.speedPoints, item.speed)}
      </div>

      <div className="w-14 text-[9px] text-rv-text-muted font-mono text-right tabular-nums uppercase">
        {item.eta || formatElapsed(item.startedAt, item.completedAt)}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity w-16 justify-end">
        <button onClick={() => onReveal(item)} className="p-1 hover:text-rv-accent text-rv-text-disabled disabled:opacity-0" disabled={!isComplete}>
          <Icon icon={FolderOpen} size={12} />
        </button>
        <button onClick={() => onRetry(item)} className="p-1 hover:text-rv-text-strong text-rv-text-disabled">
          <Icon icon={RefreshCcw} size={12} />
        </button>
        <button onClick={() => onDelete(item)} className="p-1 hover:text-rv-error text-rv-text-disabled">
          <Icon icon={Trash2} size={12} />
        </button>
      </div>
    </div>
  );
}
