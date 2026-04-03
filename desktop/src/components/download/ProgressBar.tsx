import clsx from 'clsx';

import type { DownloadItem } from '../../api/types';

type ProgressBarProps = {
  item: DownloadItem;
};

function stageLabel(item: DownloadItem): string {
  switch (item.stage) {
    case 'downloading':
      return 'Downloading';
    case 'clipping':
      return 'Processing';
    case 'importing':
      return 'Importing';
    case 'complete':
      return 'Complete';
    case 'failed':
      return 'Failed';
    default:
      return 'Preparing';
  }
}

export function ProgressBar({ item }: ProgressBarProps) {
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
          item.stage === 'downloading' && 'bg-[linear-gradient(90deg,#1dd1a1,#20c997)]',
          item.stage === 'clipping' && 'bg-[linear-gradient(90deg,#00a8ff,#4bcffa)]',
          item.stage === 'importing' && 'bg-[linear-gradient(90deg,#6116FF,#8a6cff)]',
          item.stage === 'failed' && 'bg-[linear-gradient(90deg,#ff5a7a,#ff3d3d)]',
          (item.stage === 'preparing' || item.stage === 'resolving' || item.stage === 'complete') &&
            'bg-[linear-gradient(90deg,#7f8c8d,#b2bec3)]'
        )}
        style={{ width: `${progress}%` }}
      />
      {isWorking ? (
        <div className="yt2pp-progress-runner absolute inset-y-[1px] left-0 w-[14%] rounded-full bg-white/40" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-[9px] font-medium uppercase tracking-[0.16em] text-white/65">
        <span className="truncate">{stageLabel(item)}</span>
      </div>
    </div>
  );
}
