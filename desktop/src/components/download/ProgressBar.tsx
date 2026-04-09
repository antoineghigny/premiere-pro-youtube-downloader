import clsx from 'clsx';

import type { DownloadItem } from '../../api/types';
import { useTranslation } from '../../i18n';
import { getDownloadStageLabel } from './downloadLabels';

type ProgressBarProps = {
  item: DownloadItem;
};

function stageToneClassName(item: DownloadItem): string {
  switch (item.stage) {
    case 'downloading':
      return 'bg-[linear-gradient(90deg,#1d7de3,#38bdf8)]';
    case 'clipping':
      return 'bg-[linear-gradient(90deg,#00a8ff,#4bcffa)]';
    case 'importing':
      return 'bg-[linear-gradient(90deg,#6116FF,#8a6cff)]';
    case 'complete':
      return 'bg-[linear-gradient(90deg,#0f9f74,#20c997)]';
    case 'failed':
      return 'bg-[linear-gradient(90deg,#ff5a7a,#ff3d3d)]';
    default:
      return 'bg-[linear-gradient(90deg,#5c677d,#98a6b3)]';
  }
}

export function ProgressBar({ item }: ProgressBarProps) {
  const t = useTranslation();
  const isWorking = item.indeterminate && item.status !== 'complete' && item.status !== 'failed';
  const progress = item.status === 'complete'
    ? 100
    : item.indeterminate
      ? 0
      : Math.min(100, Math.max(item.progress, item.progress > 0 ? 2 : 0));

  return (
    <div className="relative h-4 overflow-hidden rounded-full border border-white/8 bg-white/8">
      <div
        className={clsx(
          'h-full rounded-full transition-[width,background] duration-500 ease-out',
          stageToneClassName(item)
        )}
        style={{ width: `${progress}%` }}
      />
      {isWorking ? (
        <div className="yt2pp-progress-runner absolute inset-y-[1px] left-0 w-[14%] rounded-full bg-white/36" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-[9px] font-medium uppercase tracking-[0.16em] text-white/65">
        <span className="truncate">{getDownloadStageLabel(item, t)}</span>
      </div>
    </div>
  );
}
