import type { DownloadItem, DownloadItemStatus, DownloadStage } from '../../api/types';
import type { TFunction } from '../../i18n';

const STAGE_KEYS: Record<DownloadStage, string> = {
  preparing: 'stages.preparing',
  resolving: 'stages.resolving',
  downloading: 'stages.downloading',
  clipping: 'stages.clipping',
  importing: 'stages.importing',
  context: 'stages.preparing',
  design: 'stages.preparing',
  generating: 'stages.preparing',
  validating: 'stages.preparing',
  previewReady: 'stages.complete',
  rendering: 'stages.clipping',
  encoding: 'stages.clipping',
  complete: 'stages.complete',
  failed: 'stages.failed',
};

const AVAILABILITY_STAGE_KEYS: Record<DownloadStage, string> = {
  preparing: 'availabilityStages.preparing',
  resolving: 'availabilityStages.resolving',
  downloading: 'availabilityStages.downloading',
  clipping: 'availabilityStages.clipping',
  importing: 'availabilityStages.importing',
  context: 'availabilityStages.preparing',
  design: 'availabilityStages.preparing',
  generating: 'availabilityStages.preparing',
  validating: 'availabilityStages.preparing',
  previewReady: 'availabilityStages.complete',
  rendering: 'availabilityStages.clipping',
  encoding: 'availabilityStages.clipping',
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
