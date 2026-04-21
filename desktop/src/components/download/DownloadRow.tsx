import React from 'react';
import { FolderOpen, RefreshCcw, Trash2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { DownloadItem } from '../../api/types';
import { useTranslation } from '../../i18n';
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
  const t = useTranslation();
  const isComplete = item.status === 'complete';
  const isFailed = item.status === 'failed';
  const isRunning = item.status === 'running' || item.status === 'starting';

  return (
    <div className="group flex items-center h-[36px] border-b border-rv-border-inset bg-rv-panel hover:bg-[#2a2a2a] transition-colors px-3 gap-4 select-none">
      {/* Status Icon */}
      <div className="w-[24px] flex items-center justify-center shrink-0">
         <Icon 
           icon={isComplete ? CheckCircle2 : isFailed ? AlertCircle : isRunning ? ActivityIcon : Clock} 
           size={14} 
           className={cn(
             isComplete ? "text-rv-ok" : isFailed ? "text-rv-error" : isRunning ? "text-rv-accent" : "text-rv-text-disabled"
           )} 
         />
      </div>

      {/* Thumbnail */}
      <div className="w-[44px] h-[26px] bg-black rounded-[1px] overflow-hidden shrink-0 border border-rv-border-inset shadow-inner">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-10">
            <Icon icon={Clock} size={12} />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className={cn(
          "text-[11px] truncate font-semibold tracking-tight",
          isComplete ? "text-rv-text-strong" : isFailed ? "text-rv-error" : "text-rv-text"
        )}>
          {item.title}
        </span>
        <span className="text-[9px] text-rv-text-disabled truncate uppercase tracking-tighter">
          {item.stage} {item.detail ? `• ${item.detail}` : ''}
        </span>
      </div>

      {/* Progress */}
      <div className="w-[140px] flex flex-col justify-center gap-1.5">
        <ProgressBar item={item} className="h-1.5" />
        <div className="flex justify-between text-[9px] font-mono text-rv-text-muted">
          <span>{item.percentageLabel || (item.indeterminate ? "---" : `${Math.round(item.progress)}%`)}</span>
          <span className="text-rv-text-disabled uppercase text-[8px] tracking-widest">{item.status}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="w-[70px] text-[10px] text-rv-text-muted font-mono text-right">
        {formatBytes(item.totalBytes)}
      </div>
      
      <div className="w-[90px] text-[10px] text-rv-text-muted font-mono text-right truncate">
        {isComplete ? "FINISHED" : isFailed ? "FAILED" : formatRepresentativeSpeed(item.speedPoints, item.speed)}
      </div>

      <div className="w-[60px] text-[10px] text-rv-text-muted font-mono text-right">
        {item.eta || formatElapsed(item.startedAt, item.completedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
        <Button size="icon" variant="ghost" disabled={!isComplete} onClick={() => onReveal(item)} title="Reveal in Explorer">
          <Icon icon={FolderOpen} size={12} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onRetry(item)} title="Restart Download">
          <Icon icon={RefreshCcw} size={12} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(item)} title="Remove Item">
          <Icon icon={Trash2} size={12} className="text-rv-error/70" />
        </Button>
      </div>
    </div>
  );
}

const ActivityIcon = ({ className, size, strokeWidth: _strokeWidth, ...props }: any) => (
  <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }} {...props}>
    <div className="absolute inset-0 border-2 border-rv-accent/20 rounded-full" />
    <div className="absolute inset-0 border-2 border-rv-accent border-t-transparent rounded-full animate-spin" />
  </div>
);
