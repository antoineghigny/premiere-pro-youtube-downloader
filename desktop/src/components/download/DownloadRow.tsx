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
    <div className="group flex items-center h-[32px] border-b border-rv-border-inset bg-rv-panel hover:bg-rv-raised transition-colors px-2 gap-4 select-none">
      {/* Thumbnail / Icon */}
      <div className="w-[40px] h-[22px] bg-black rounded-[1px] overflow-hidden shrink-0 border border-rv-border-inset">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <Icon icon={isComplete ? CheckCircle2 : isFailed ? AlertCircle : Clock} size={12} />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className={cn(
          "text-[11px] truncate font-medium",
          isComplete ? "text-rv-text-strong" : isFailed ? "text-rv-error" : "text-rv-text"
        )}>
          {item.title}
        </span>
      </div>

      {/* Progress */}
      <div className="w-[180px] flex flex-col justify-center gap-1">
        <ProgressBar item={item} />
        <div className="flex justify-between text-[8px] text-rv-text-disabled uppercase tracking-tighter">
          <span>{item.percentageLabel || (item.indeterminate ? "Working" : `${Math.round(item.progress)}%`)}</span>
          <span className="truncate max-w-[100px] text-right">{item.stage}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="w-[80px] text-[10px] text-rv-text-muted font-mono text-right">
        {formatBytes(item.totalBytes)}
      </div>
      
      <div className="w-[100px] text-[10px] text-rv-text-muted font-mono text-right truncate">
        {isComplete ? "DONE" : isFailed ? "FAILED" : formatRepresentativeSpeed(item.speedPoints, item.speed)}
      </div>

      <div className="w-[60px] text-[10px] text-rv-text-muted font-mono text-right">
        {item.eta || formatElapsed(item.startedAt, item.completedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" disabled={!isComplete} onClick={() => onReveal(item)} title="Open File">
          <Icon icon={FolderOpen} size={12} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onRetry(item)} title="Retry">
          <Icon icon={RefreshCcw} size={12} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(item)} title="Remove">
          <Icon icon={Trash2} size={12} />
        </Button>
      </div>
    </div>
  );
}
