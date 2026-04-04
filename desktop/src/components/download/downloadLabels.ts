import type { DownloadItem, DownloadItemStatus, DownloadStage } from '../../api/types';
import type { TFunction } from '../../i18n';

const STAGE_KEYS: Record<DownloadStage, string> = {
  preparing: 'stages.preparing',
  resolving: 'stages.resolving',
  downloading: 'stages.downloading',
  clipping: 'stages.clipping',
  importing: 'stages.importing',
  complete: 'stages.complete',
  failed: 'stages.failed',
};

const AVAILABILITY_STAGE_KEYS: Record<DownloadStage, string> = {
  preparing: 'availabilityStages.preparing',
  resolving: 'availabilityStages.resolving',
  downloading: 'availabilityStages.downloading',
  clipping: 'availabilityStages.clipping',
  importing: 'availabilityStages.importing',
  complete: 'availabilityStages.complete',
  failed: 'availabilityStages.failed',
};

const STATUS_STAGE_OVERRIDES: Record<DownloadItemStatus, DownloadStage | null> = {
  queued: null,
  starting: null,
  running: null,
  complete: 'complete',
  failed: 'failed',
};

function resolveDisplayStage(item: DownloadItem): DownloadStage {
  return STATUS_STAGE_OVERRIDES[item.status] ?? item.stage;
}

export function getDownloadStageLabel(item: DownloadItem, t: TFunction): string {
  return t(STAGE_KEYS[resolveDisplayStage(item)]);
}

export function getDownloadAvailabilityLabel(item: DownloadItem, t: TFunction): string {
  return t(AVAILABILITY_STAGE_KEYS[resolveDisplayStage(item)]);
}
