import type { DownloadItem } from '../api/types';

export type QueueStatusSummary = {
  totalCount: number;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  completedPercent: number;
  activePercent: number;
  failedPercent: number;
  queuedPercent: number;
  processedPercent: number;
};

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress));
}

export function buildQueueStatusSummary(items: DownloadItem[]): QueueStatusSummary {
  let totalCount = 0;
  let activeCount = 0;
  let queuedCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let activeCompletedUnits = 0;

  for (const item of items) {
    totalCount += 1;

    if (item.status === 'complete') {
      completedCount += 1;
      continue;
    }

    if (item.status === 'failed') {
      failedCount += 1;
      continue;
    }

    if (item.status === 'queued') {
      queuedCount += 1;
      continue;
    }

    activeCount += 1;
    activeCompletedUnits += clampProgress(item.progress) / 100;
  }

  const totalUnits = Math.max(totalCount, 1);
  const completedUnits = completedCount + activeCompletedUnits;
  const activeUnits = Math.max(0, activeCount - activeCompletedUnits);
  const failedUnits = failedCount;
  const queuedUnits = queuedCount;

  return {
    totalCount,
    activeCount,
    queuedCount,
    completedCount,
    failedCount,
    completedPercent: (completedUnits / totalUnits) * 100,
    activePercent: (activeUnits / totalUnits) * 100,
    failedPercent: (failedUnits / totalUnits) * 100,
    queuedPercent: (queuedUnits / totalUnits) * 100,
    processedPercent: (completedUnits / totalUnits) * 100,
  };
}
