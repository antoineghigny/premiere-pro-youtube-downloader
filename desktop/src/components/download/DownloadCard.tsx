import { FolderOpen, RefreshCcw, Trash2 } from 'lucide-react';

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
            onClick={() => onReveal(item)}
          >
            Open
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
