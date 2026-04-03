import { FolderOpen, LoaderCircle, RefreshCcw, Trash2 } from 'lucide-react';

import type { DownloadItem } from '../../api/types';
import { formatRepresentativeSpeed } from '../../utils/format';
import { Button } from '../common/Button';
import { ProgressBar } from './ProgressBar';

type DownloadCardProps = {
  item: DownloadItem;
  onRetry: (item: DownloadItem) => void;
  onRemove: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
};

export function DownloadCard({ item, onRetry, onRemove, onReveal }: DownloadCardProps) {
  const isComplete = item.status === 'complete';
  const isRunning = item.status === 'running' || item.status === 'starting';
  const runningLabel = item.stage === 'clipping'
    ? 'Processing'
    : item.stage === 'importing'
      ? 'Importing'
      : item.stage === 'downloading'
        ? 'Downloading'
        : 'Starting';

  return (
    <div className="group panel-surface overflow-hidden p-0">
      <div className="relative aspect-video overflow-hidden bg-white/6">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(8,8,14,0.92))] p-4">
          <div className="line-clamp-2 text-sm font-semibold text-white">{item.title}</div>
        </div>
      </div>
      <div className="space-y-4 px-4 py-4">
        {isRunning ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-100">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            {runningLabel}
          </div>
        ) : null}
        <ProgressBar item={item} />
        <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>{item.percentageLabel || `${Math.round(item.progress)}%`}</span>
          <span>{formatRepresentativeSpeed(item.speedPoints, item.speed) || item.stage}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            icon={<FolderOpen className="h-4 w-4" />}
            disabled={!isComplete}
            onClick={() => onReveal(item)}
            title={isComplete ? 'Open file' : 'Available when the download is complete'}
          >
            {isComplete ? 'Open' : 'Running'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCcw className="h-4 w-4" />}
            onClick={() => onRetry(item)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => onRemove(item)}
          />
        </div>
      </div>
    </div>
  );
}
