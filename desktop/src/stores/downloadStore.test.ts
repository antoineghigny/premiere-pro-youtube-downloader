import { beforeEach, describe, expect, it } from 'vitest';

import type { DownloadItem, HistoryEntry } from '../api/types';
import { useDownloadStore } from './downloadStore';

const initialState = useDownloadStore.getInitialState();

function makeItem(overrides: Partial<DownloadItem> = {}): DownloadItem {
  return {
    requestId: 'req-1',
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

function makeHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'hist-1',
    requestId: 'req-1',
    url: 'https://example.com/video',
    title: 'Persisted video',
    downloadType: 'full',
    outputPath: 'C:/Downloads/video.mp4',
    status: 'complete',
    startedAt: '2026-04-03T09:00:00.000Z',
    settings: {
      videoUrl: 'https://example.com/video',
      downloadType: 'full',
    },
    ...overrides,
  };
}

describe('useDownloadStore', () => {
  beforeEach(() => {
    useDownloadStore.setState(initialState, true);
  });

  it('marks downloads complete with output details', () => {
    useDownloadStore.getState().addQueuedDownload(makeItem());
    useDownloadStore.getState().markComplete('req-1', 'C:/Downloads/video.mp4');

    const [item] = useDownloadStore.getState().items;
    expect(item.status).toBe('complete');
    expect(item.stage).toBe('complete');
    expect(item.progress).toBe(100);
    expect(item.percentageLabel).toBe('100%');
    expect(item.outputPath).toBe('C:/Downloads/video.mp4');
    expect(item.completedAt).toBeTruthy();
  });

  it('does not move completedAt when completion is applied again', () => {
    useDownloadStore.getState().addQueuedDownload(makeItem());
    useDownloadStore.getState().markComplete('req-1', 'C:/Downloads/video.mp4');

    const firstCompletedAt = useDownloadStore.getState().items[0].completedAt;
    useDownloadStore.getState().markComplete('req-1', 'C:/Downloads/video.mp4');

    expect(useDownloadStore.getState().items[0].completedAt).toBe(firstCompletedAt);
  });

  it('keeps active items when clearing completed entries', () => {
    useDownloadStore.getState().addQueuedDownload(makeItem({ requestId: 'queued', status: 'queued' }));
    useDownloadStore.getState().addQueuedDownload(makeItem({ requestId: 'running', status: 'running' }));
    useDownloadStore.getState().addQueuedDownload(makeItem({ requestId: 'done', status: 'complete', stage: 'complete' }));

    useDownloadStore.getState().clearCompleted();

    expect(useDownloadStore.getState().items.map((item) => item.requestId)).toEqual(['running', 'queued']);
  });

  it('hydrates history without duplicating active items and sorts newest first', () => {
    useDownloadStore.getState().addQueuedDownload(
      makeItem({
        requestId: 'active',
        historyId: 'hist-active',
        startedAt: '2026-04-03T10:00:00.000Z',
      })
    );

    useDownloadStore.getState().hydrateHistory([
      makeHistoryEntry({
        id: 'hist-active',
        requestId: 'active',
        startedAt: '2026-04-03T08:00:00.000Z',
      }),
      makeHistoryEntry({
        id: 'hist-new',
        requestId: 'req-new',
        title: 'Recovered',
        status: 'interrupted',
        startedAt: '2026-04-03T11:00:00.000Z',
      }),
    ]);

    const items = useDownloadStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].historyId).toBe('hist-new');
    expect(items[0].error).toBe('Download interrupted');
    expect(items[1].historyId).toBe('hist-active');
  });

  it('preserves live runtime progress when history sync refreshes a running item', () => {
    useDownloadStore.getState().addQueuedDownload(
      makeItem({
        requestId: 'live',
        historyId: 'hist-live',
        status: 'running',
        stage: 'downloading',
        progress: 48,
        percentageLabel: '48%',
        detail: 'Downloading source',
        speed: '2.0 MB/s',
        eta: '00:12',
        speedPoints: [1024, 2048],
      })
    );

    useDownloadStore.getState().hydrateHistory([
      makeHistoryEntry({
        id: 'hist-live',
        requestId: 'live',
        status: 'running',
        title: 'Recovered title',
        startedAt: '2026-04-03T09:00:00.000Z',
      }),
    ]);

    const [item] = useDownloadStore.getState().items;
    expect(item.stage).toBe('downloading');
    expect(item.progress).toBe(48);
    expect(item.percentageLabel).toBe('48%');
    expect(item.detail).toBe('Downloading source');
    expect(item.speed).toBe('2.0 MB/s');
    expect(item.eta).toBe('00:12');
    expect(item.speedPoints).toEqual([1024, 2048]);
  });

  it('moves items within the queue by request id', () => {
    useDownloadStore.getState().addQueuedDownload(makeItem({ requestId: 'first', title: 'First' }));
    useDownloadStore.getState().addQueuedDownload(makeItem({ requestId: 'second', title: 'Second' }));
    useDownloadStore.getState().addQueuedDownload(makeItem({ requestId: 'third', title: 'Third' }));

    useDownloadStore.getState().moveDownload('first', 'third');

    expect(useDownloadStore.getState().items.map((item) => item.requestId)).toEqual([
      'first',
      'third',
      'second',
    ]);
  });
});
