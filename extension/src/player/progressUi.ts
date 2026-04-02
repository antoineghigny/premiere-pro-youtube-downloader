import type { DownloadProgressState, DownloadStage } from '../api/contracts';

const STAGE_LABELS: Record<DownloadStage, string> = {
  preparing: 'Prep',
  resolving: 'Resolve',
  downloading: 'DL',
  clipping: 'Clip',
  importing: 'Import',
  complete: 'Done',
  failed: 'Error',
};

export function getStageLabel(stage: DownloadStage): string {
  return STAGE_LABELS[stage] ?? 'Wait';
}

export function getProgressLabel(status: DownloadProgressState, currentProgress: number): string {
  if (!status.indeterminate) {
    const parsed = Number.parseFloat(String(status.percentage ?? ''));
    if (Number.isFinite(parsed)) {
      return `${Math.max(0, Math.round(Math.max(currentProgress, parsed)))}%`;
    }
  }
  return getStageLabel(status.stage);
}
