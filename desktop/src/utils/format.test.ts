import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatBytes,
  formatDuration,
  formatElapsed,
  formatRepresentativeSpeed,
  formatSpeed,
  formatTransferRate,
  parsePercentageLabel,
  parseTransferRate,
} from './format';

describe('formatBytes', () => {
  it('formats byte sizes across units', () => {
    expect(formatBytes()).toBe('--');
    expect(formatBytes(Number.NaN)).toBe('--');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(12 * 1024 * 1024)).toBe('12 MB');
  });
});

describe('formatDuration', () => {
  it('formats minute and hour durations', () => {
    expect(formatDuration()).toBe('--');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

describe('formatElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T12:00:10.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses completedAt when present and falls back to now otherwise', () => {
    expect(formatElapsed('2026-04-03T12:00:00.000Z')).toBe('0:10');
    expect(formatElapsed('2026-04-03T12:00:00.000Z', '2026-04-03T12:00:05.000Z')).toBe('0:05');
    expect(formatElapsed('invalid')).toBe('--');
  });
});

describe('percentage and speed parsing', () => {
  it('parses percentages safely', () => {
    expect(parsePercentageLabel('75.5%')).toBeCloseTo(75.5);
    expect(parsePercentageLabel('bad')).toBe(0);
    expect(parsePercentageLabel(undefined)).toBe(0);
  });

  it('parses transfer rates with units', () => {
    expect(parseTransferRate('512 B/s')).toBe(512);
    expect(parseTransferRate('1.5 KB/s')).toBe(1536);
    expect(parseTransferRate('2 MB/s')).toBe(2 * 1024 * 1024);
    expect(parseTransferRate('2.5 MiB/s')).toBe(2.5 * 1024 * 1024);
    expect(parseTransferRate('0.5 GB/s')).toBe(0.5 * 1024 * 1024 * 1024);
    expect(parseTransferRate('bad value')).toBe(0);
  });

  it('formats speed labels', () => {
    expect(formatSpeed(' 2 MB/s ')).toBe('2 MB/s');
    expect(formatSpeed()).toBe('--');
    expect(formatTransferRate(1.5 * 1024 * 1024)).toBe('1.5 MB/s');
    expect(formatRepresentativeSpeed([0, 1024, 2 * 1024])).toBe('1.5 KB/s');
    expect(formatRepresentativeSpeed([], ' 2 MB/s ')).toBe('2 MB/s');
  });
});
