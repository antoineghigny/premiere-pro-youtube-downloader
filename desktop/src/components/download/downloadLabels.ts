import type { DownloadItem, DownloadItemStatus, DownloadStage } from '../../api/types';

const STAGE_LABELS = {
  preparing: 'Getting ready',
  resolving: 'Checking media',
  downloading: 'Downloading',
  clipping: 'Finalizing',
  importing: 'Adding to Premiere',
  complete: 'Ready',
  failed: 'Download failed',
} satisfies Record<DownloadStage, string>;

const AVAILABILITY_STAGE_LABELS = {
  preparing: 'Getting ready',
  resolving: 'Checking media',
  downloading: 'Downloading',
  clipping: 'Finalizing file',
  importing: 'Adding to Premiere',
  complete: 'Ready',
  failed: 'Download failed',
} satisfies Record<DownloadStage, string>;

const STATUS_STAGE_OVERRIDES = {
  queued: null,
  starting: null,
  running: null,
  complete: 'complete',
  failed: 'failed',
} satisfies Record<DownloadItemStatus, DownloadStage | null>;

function resolveDisplayStage(item: DownloadItem): DownloadStage {
  return STATUS_STAGE_OVERRIDES[item.status] ?? item.stage;
}

export function getDownloadStageLabel(item: DownloadItem): string {
  return STAGE_LABELS[resolveDisplayStage(item)];
}

export function getDownloadAvailabilityLabel(item: DownloadItem): string {
  return AVAILABILITY_STAGE_LABELS[resolveDisplayStage(item)];
}
