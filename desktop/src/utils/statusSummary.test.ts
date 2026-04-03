import { describe, expect, it } from 'vitest';

import type { DownloadItem } from '../api/types';
import { buildQueueStatusSummary } from './statusSummary';

function createItem(overrides: Partial<DownloadItem>): DownloadItem {
  return {
    requestId: crypto.randomUUID(),
    url: 'https://example.com/video',
    title: 'Example video',
    status: 'queued',
    stage: 'preparing',
    progress: 0,
    indeterminate: true,
    startedAt: '2026-04-03T10:00:00.000Z',
    speedPoints: [],
    request: {
      videoUrl: 'https://example.com/video',
      downloadType: 'full',
    },
    ...overrides,
  };
}

describe('buildQueueStatusSummary', () => {
  it('summarizes counts and progress across queue states', () => {
    const summary = buildQueueStatusSummary([
      createItem({ status: 'complete', stage: 'complete', progress: 100 }),
      createItem({ status: 'running', stage: 'downloading', progress: 40 }),
      createItem({ status: 'starting', stage: 'resolving', progress: 0 }),
      createItem({ status: 'failed', stage: 'failed', progress: 0 }),
      createItem({ status: 'queued', stage: 'preparing', progress: 0 }),
    ]);

    expect(summary.totalCount).toBe(5);
    expect(summary.completedCount).toBe(1);
    expect(summary.activeCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    expect(summary.queuedCount).toBe(1);
    expect(summary.completedPercent).toBeCloseTo(28, 0);
    expect(summary.activePercent).toBeCloseTo(32, 0);
    expect(summary.failedPercent).toBeCloseTo(20, 0);
    expect(summary.queuedPercent).toBeCloseTo(20, 0);
  });

  it('returns an empty summary without NaN values', () => {
    const summary = buildQueueStatusSummary([]);

    expect(summary.totalCount).toBe(0);
    expect(summary.processedPercent).toBe(0);
    expect(summary.completedPercent).toBe(0);
    expect(summary.activePercent).toBe(0);
    expect(summary.failedPercent).toBe(0);
    expect(summary.queuedPercent).toBe(0);
  });
});
