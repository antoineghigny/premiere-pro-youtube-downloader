import { getRepresentativeTransferRate } from './speedHistory';

export function formatBytes(value?: number): string {
  if (!value || Number.isNaN(value)) {
    return '--';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || Number.isNaN(seconds)) {
    return '--';
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function formatElapsed(isoDate: string, completedAt?: string): string {
  const start = Date.parse(isoDate);
  const end = completedAt ? Date.parse(completedAt) : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return '--';
  }

  return formatDuration((end - start) / 1000);
}

export function parsePercentageLabel(label?: string): number {
  if (!label) {
    return 0;
  }

  const parsed = Number.parseFloat(label.replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseTransferRate(rate?: string): number {
  if (!rate) {
    return 0;
  }

  const match = rate.match(/([\d.]+)\s*(B|KB|MB|GB|KIB|MIB|GIB)\/s/i);
  if (!match) {
    return 0;
  }

  const [, valueString, unit] = match;
  const value = Number.parseFloat(valueString);
  if (!Number.isFinite(value)) {
    return 0;
  }

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 * 1024,
    MIB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    GIB: 1024 * 1024 * 1024,
  };

  return value * multipliers[unit.toUpperCase()];
}

export function formatTransferRate(rate?: number): string {
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    return '--';
  }

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
  let value = rate;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatSpeed(rate?: string): string {
  return rate?.trim() || '--';
}

export function formatRepresentativeSpeed(points: number[], fallback?: string): string {
  const representativePoint = getRepresentativeTransferRate(points);
  if (representativePoint > 0) {
    return formatTransferRate(representativePoint);
  }

  return formatSpeed(fallback);
}
