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
  const isRunning = item.status === 'running' || item.status === 'starting';

  return (
    <div className={cn(
      "bg-rv-panel border border-rv-border-inset flex flex-col group h-full select-none relative transition-all",
      isRunning && "border-rv-accent/50 ring-1 ring-rv-accent/20"
    )}>
      {/* Thumbnail Area */}
      <div className="aspect-video bg-black relative overflow-hidden shrink-0 border-b border-rv-border-inset">
        {item.thumbnail ? (
          <img 
            src={item.thumbnail} 
            alt="" 
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              isComplete ? "opacity-90 group-hover:opacity-100" : "opacity-40 grayscale group-hover:opacity-60"
            )} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-rv-text-disabled uppercase text-[8px] tracking-[0.2em] font-bold">
            No Preview Available
          </div>
        )}
        
        {/* Status Overlays */}
        {isComplete && (
          <div className="absolute bottom-1 right-1 bg-rv-ok/90 text-white px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-[1px] shadow-sm flex items-center gap-1">
            <Icon icon={CheckCircle2} size={8} strokeWidth={3} />
            Ready
          </div>
        )}
        
        {isRunning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
             <div className="w-full px-4 flex flex-col items-center gap-2">
                <div className="w-full h-1 bg-rv-border-inset rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-rv-accent shadow-[0_0_8px_rgba(0,120,215,0.8)] transition-all duration-300" 
                     style={{ width: `${item.progress}%` }} 
                   />
                </div>
                <span className="text-[9px] font-mono text-rv-accent font-bold drop-shadow-md">
                   {Math.round(item.progress)}%
                </span>
             </div>
          </div>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-rv-error/20 backdrop-blur-[1px]">
             <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white bg-rv-error px-2 py-1 shadow-lg">
                Download Failed
             </span>
          </div>
        )}
      </div>
      
      {/* Info Area */}
      <div className="p-1.5 flex flex-col gap-1 flex-1 bg-rv-raised/30">
        <div className="text-[10px] font-bold text-rv-text-strong line-clamp-1 leading-tight uppercase tracking-tight">
          {item.title}
        </div>
        
        <div className="flex justify-between items-center text-[8px] text-rv-text-muted font-mono uppercase tracking-tighter">
          <span>{formatRepresentativeSpeed(item.speedPoints, item.speed)}</span>
          <span className="opacity-60">{item.eta || '00:00:00'}</span>
        </div>

        {/* Action Toolbar (Visible on Hover) */}
        <div className="flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
          <button 
            disabled={!isComplete} 
            onClick={() => onReveal(item)}
            className="flex-1 h-5 bg-rv-button border border-rv-border-inset hover:bg-rv-button-hover flex items-center justify-center text-rv-text disabled:opacity-0 transition-colors"
          >
            <Icon icon={FolderOpen} size={10} />
          </button>
          <button 
            onClick={() => onRetry(item)}
            className="w-6 h-5 bg-rv-button border border-rv-border-inset hover:bg-rv-button-hover flex items-center justify-center text-rv-text transition-colors"
          >
            <Icon icon={RefreshCcw} size={10} />
          </button>
          <button 
            onClick={() => onDelete(item)}
            className="w-6 h-5 bg-rv-button border border-rv-border-inset hover:bg-rv-error/20 hover:text-rv-error flex items-center justify-center text-rv-text transition-colors"
          >
            <Icon icon={Trash2} size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
