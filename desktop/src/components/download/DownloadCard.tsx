import React from 'react';
import { FolderOpen, RefreshCcw, Trash2, CheckCircle2 } from 'lucide-react';
import type { DownloadItem } from '../../api/types';
import { useTranslation } from '../../i18n';
import { formatRepresentativeSpeed } from '../../utils/format';
import { Button } from '../common/Button';
import { ProgressBar } from './ProgressBar';
import { Icon } from '../common/Icon';
import { cn } from '@/lib/utils';

type DownloadCardProps = {
  item: DownloadItem;
  onRetry: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
};

export function DownloadCard({ item, onRetry, onDelete, onReveal }: DownloadCardProps) {
  const t = useTranslation();
  const isComplete = item.status === 'complete';
  const isFailed = item.status === 'failed';

  return (
    <div className="bg-rv-panel border border-rv-border-inset flex flex-col group h-full select-none">
      <div className="aspect-video bg-black relative overflow-hidden shrink-0">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-rv-text-disabled uppercase text-[10px] tracking-widest">
            No Preview
          </div>
        )}
        {isComplete && (
          <div className="absolute top-1 right-1 bg-rv-ok text-black rounded-full p-0.5">
            <Icon icon={CheckCircle2} size={10} strokeWidth={3} />
          </div>
        )}
      </div>
      
      <div className="p-2 flex flex-col gap-2 flex-1">
        <div className="text-[11px] font-medium text-rv-text-strong line-clamp-2 leading-tight min-h-[2.4em]">
          {item.title}
        </div>
        
        <div className="mt-auto space-y-1">
          <ProgressBar item={item} />
          <div className="flex justify-between text-[9px] text-rv-text-muted uppercase tracking-tighter">
            <span>{Math.round(item.progress)}%</span>
            <span>{isComplete ? "Done" : formatRepresentativeSpeed(item.speedPoints, item.speed)}</span>
          </div>
        </div>

        <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="flex-1 h-6" disabled={!isComplete} onClick={() => onReveal(item)}>
            <Icon icon={FolderOpen} size={12} />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRetry(item)}>
            <Icon icon={RefreshCcw} size={12} />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(item)}>
            <Icon icon={Trash2} size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
