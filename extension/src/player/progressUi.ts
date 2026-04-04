import type { DownloadProgressState, DownloadStage } from '../api/contracts';
import { t } from '../i18n';

const STAGE_KEYS: Record<DownloadStage, string> = {
  preparing: 'stage.preparing',
  resolving: 'stage.resolving',
  downloading: 'stage.downloading',
  clipping: 'stage.clipping',
  importing: 'stage.importing',
  complete: 'stage.complete',
  failed: 'stage.failed',
};

export function getStageLabel(stage: DownloadStage): string {
  return t(STAGE_KEYS[stage] ?? 'stage.wait');
}

export function getProgressLabel(status: DownloadProgressState, currentProgress: number): string {
  if (!status.indeterminate) {
    const parsed = Number.parseFloat(String(status.percentage ?? ''));
    if (Number.isFinite(parsed)) {
      return `${Math.round(Math.max(currentProgress, parsed))}%`;
    }
  }
  return getStageLabel(status.stage);
}
