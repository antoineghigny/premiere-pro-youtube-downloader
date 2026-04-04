import clsx from 'clsx';
import { FolderOpen, LoaderCircle, RefreshCcw, Trash2 } from 'lucide-react';

import type { DownloadItem } from '../../api/types';
import { useTranslation } from '../../i18n';
import { formatBytes, formatElapsed, formatRepresentativeSpeed } from '../../utils/format';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { getDownloadAvailabilityLabel } from './downloadLabels';
import { ProgressBar } from './ProgressBar';
import { SpeedGraph } from './SpeedGraph';

type DownloadRowProps = {
  item: DownloadItem;
  onRetry: (item: DownloadItem) => void;
  onRemove: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
  onMove: (sourceId: string, targetId: string) => void;
};

export function DownloadRow({ item, onRetry, onRemove, onReveal, onMove }: DownloadRowProps) {
  const t = useTranslation();
  const isComplete = item.status === 'complete';
  const isRunning = item.status === 'running' || item.status === 'starting';
  const availabilityLabel = getDownloadAvailabilityLabel(item, t);

  return (
    <div
      draggable={item.status === 'queued'}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', item.requestId)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const sourceId = event.dataTransfer.getData('text/plain');
        if (sourceId) {
          onMove(sourceId, item.requestId);
        }
      }}
      className="group grid items-center gap-4 rounded-[1.25rem] border border-white/6 bg-white/[0.035] px-4 py-3 transition hover:border-[var(--color-main)]/28 hover:bg-white/[0.06] xl:grid-cols-[72px_minmax(0,1.8fr)_1.25fr_0.65fr_0.7fr_0.5fr_0.5fr_auto]"
    >
      <div className="h-12 w-[72px] overflow-hidden rounded-2xl bg-white/6">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{item.title}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Badge
            color={
              item.status === 'complete'
                ? 'green'
                : item.status === 'failed'
                  ? 'red'
                  : item.stage === 'downloading' || item.stage === 'clipping' || item.stage === 'importing'
                    ? 'purple'
                    : 'neutral'
            }
          >
            {isComplete ? t('download.ready') : item.status === 'failed' ? t('download.failed') : t('download.running')}
          </Badge>
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-100">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              {availabilityLabel}
            </span>
          ) : null}
          <span className="truncate">{item.detail || item.url}</span>
        </div>
      </div>
      <div className="space-y-2">
        <ProgressBar item={item} />
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>{item.percentageLabel || (item.indeterminate ? t('download.working') : `${item.progress.toFixed(0)}%`)}</span>
          <span className={clsx(item.status === 'failed' && 'text-red-200')}>
            {item.error || availabilityLabel}
          </span>
        </div>
      </div>
      <div className="text-sm text-[var(--text-muted)]">{formatBytes(item.totalBytes)}</div>
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <SpeedGraph points={item.speedPoints} />
        <span>{formatRepresentativeSpeed(item.speedPoints, item.speed)}</span>
      </div>
      <div className="text-sm text-[var(--text-muted)]">{item.eta || '--'}</div>
      <div className="text-sm text-[var(--text-muted)]">{formatElapsed(item.startedAt, item.completedAt)}</div>
      <div className="flex items-center justify-end gap-2 opacity-100 transition group-hover:opacity-100 xl:opacity-0">
        <Button
          size="sm"
          variant="ghost"
          disabled={!isComplete}
          onClick={() => onReveal(item)}
          icon={<FolderOpen className="h-4 w-4" />}
          title={isComplete ? t('download.openFile') : t('download.availableWhenComplete')}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRetry(item)}
          icon={<RefreshCcw className="h-4 w-4" />}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(item)}
          icon={<Trash2 className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
