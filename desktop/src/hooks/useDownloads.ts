import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react';

import {
  ApiError,
  clearHistoryEntries,
  deleteHistoryEntry,
  getHistory,
  listActiveDownloads,
  revealFile,
  startDownload,
} from '../api/client';
import { socketClient } from '../api/socket';
import {
  type ActiveDownloadState,
  type DesktopSettings,
  type DownloadItem,
  type DownloadRequestPayload,
  type SocketEvent,
  type VideoInfo,
} from '../api/types';
import { useDownloadStore } from '../stores/downloadStore';
import { parsePercentageLabel, parseTransferRate } from '../utils/format';
import { updateSpeedHistory } from '../utils/speedHistory';
import { useSocket } from './useSocket';

type QueueDownloadInput = Omit<DownloadRequestPayload, 'requestId'>;

export function useDownloads(settings: DesktopSettings) {
  const pendingStartsRef = useRef<Set<string>>(new Set());
  const {
    items,
    viewMode,
    filterText,
    settingsOpen,
    setViewMode,
    setFilterText,
    setSettingsOpen,
    addQueuedDownload,
    updateDownload,
    markStarting,
    markFailed,
    markComplete,
    removeDownload,
    clearCompleted,
    moveDownload,
    hydrateHistory,
  } = useDownloadStore();

  const applyActiveDownloadState = useEffectEvent((download: ActiveDownloadState) => {
    const currentItem = items.find((item) => item.requestId === download.requestId);

    if (download.stage === 'complete') {
      socketClient.unsubscribe(download.requestId);
      markComplete(download.requestId, download.path ?? '');
      return;
    }

    if (download.stage === 'failed') {
      socketClient.unsubscribe(download.requestId);
      markFailed(download.requestId, download.message ?? 'Download failed');
      return;
    }

    const rawRate = parseTransferRate(download.speed);
    const speedHistory = updateSpeedHistory(
      {
        points: currentItem?.speedPoints ?? [],
        lastSampleAt: currentItem?.speedSampledAt,
        rollingRate: currentItem?.speedRollingRate,
      },
      rawRate
    );

    updateDownload(download.requestId, {
      status: 'running',
      stage: download.stage,
      progress: parsePercentageLabel(download.percentage),
      percentageLabel: download.percentage,
      detail: download.detail,
      indeterminate: download.indeterminate,
      speed: download.speed,
      eta: download.eta,
      speedPoints: speedHistory.points,
      speedSampledAt: speedHistory.lastSampleAt,
      speedRollingRate: speedHistory.rollingRate,
    });
  });

  const syncHistorySnapshot = useEffectEvent(async (pageSize = 100) => {
    const response = await getHistory(1, pageSize);
    hydrateHistory(response.items);
  });

  useEffect(() => {
    let cancelled = false;

    const syncHistory = async () => {
      try {
        await syncHistorySnapshot(100);
      } catch (error) {
        if (!cancelled) {
          console.error('[YT2PP] Could not load history:', error);
        }
      }
    };

    void syncHistory();
    const intervalId = window.setInterval(() => {
      void syncHistory();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hydrateHistory]);

  const handleSocketMessage = useEffectEvent((message: SocketEvent) => {
    if (message.type === 'progress') {
      applyActiveDownloadState({
        requestId: message.requestId,
        stage: message.stage,
        percentage: message.percentage,
        speed: message.speed,
        eta: message.eta,
        detail: message.detail,
        indeterminate: message.indeterminate,
        path: undefined,
        message: undefined,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (message.type === 'complete') {
      applyActiveDownloadState({
        requestId: message.requestId,
        stage: 'complete',
        percentage: message.percentage,
        speed: undefined,
        eta: undefined,
        detail: undefined,
        indeterminate: false,
        path: message.path,
        message: undefined,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    applyActiveDownloadState({
      requestId: message.requestId,
      stage: 'failed',
      percentage: undefined,
      speed: undefined,
      eta: undefined,
      detail: undefined,
      indeterminate: true,
      path: undefined,
      message: message.message,
      updatedAt: new Date().toISOString(),
    });
  });

  useSocket(handleSocketMessage);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const response = await listActiveDownloads();
        if (cancelled) {
          return;
        }

        for (const download of response.items) {
          applyActiveDownloadState(download);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[YT2PP] Could not resync active downloads:', error);
        }
      }
    };

    void sync();
    const intervalId = window.setInterval(() => {
      void sync();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyActiveDownloadState]);

  useEffect(() => {
    const runningCount = items.filter((item) => item.status === 'running' || item.status === 'starting').length;
    const queueLimit = Math.max(1, settings.concurrentDownloads || 2);
    if (runningCount >= queueLimit) {
      return;
    }

    const nextItem = items.find((item) => (
      item.status === 'queued' && !pendingStartsRef.current.has(item.requestId)
    ));
    if (!nextItem) {
      return;
    }

    pendingStartsRef.current.add(nextItem.requestId);

    void (async () => {
      markStarting(nextItem.requestId);
      socketClient.subscribe(nextItem.requestId);
      try {
        const response = await startDownload(nextItem.request);
        if (!response.success) {
          markFailed(nextItem.requestId, response.error ?? 'Could not start the download');
          socketClient.unsubscribe(nextItem.requestId);
          return;
        }
      } catch (error) {
        if (error instanceof ApiError && error.duplicate) {
          try {
            await syncHistorySnapshot(500);
          } catch (historyError) {
            console.error('[YT2PP] Could not resync duplicate history:', historyError);
          }

          socketClient.unsubscribe(nextItem.requestId);
          removeDownload(nextItem.requestId);
          return;
        }

        markFailed(nextItem.requestId, error instanceof Error ? error.message : 'Could not start the download');
        socketClient.unsubscribe(nextItem.requestId);
      } finally {
        pendingStartsRef.current.delete(nextItem.requestId);
      }
    })();
  }, [items, markFailed, markStarting, removeDownload, settings.concurrentDownloads, syncHistorySnapshot]);

  const queueDownload = useCallback(
    (request: QueueDownloadInput, preview?: VideoInfo | null) => {
      const requestId = crypto.randomUUID();
      addQueuedDownload({
        requestId,
        url: request.videoUrl,
        title: preview?.title || request.videoUrl,
        thumbnail: preview?.thumbnail,
        status: 'queued',
        stage: 'preparing',
        progress: 0,
        percentageLabel: undefined,
        indeterminate: true,
        speed: undefined,
        eta: undefined,
        outputPath: undefined,
        error: undefined,
        startedAt: new Date().toISOString(),
        completedAt: undefined,
        speedPoints: [],
        speedSampledAt: undefined,
        speedRollingRate: undefined,
        request: {
          ...request,
          requestId,
        },
      });
      return requestId;
    },
    [addQueuedDownload]
  );

  const retryDownload = useCallback(
    (item: DownloadItem) => {
      removeDownload(item.requestId);
      const { requestId: _requestId, ...requestWithoutId } = item.request;
      queueDownload(
        requestWithoutId,
        {
          id: item.requestId,
          title: item.title,
          thumbnail: item.thumbnail,
        }
      );
    },
    [queueDownload, removeDownload]
  );

  const deleteDownload = useCallback(
    async (item: DownloadItem) => {
      removeDownload(item.requestId);
      socketClient.unsubscribe(item.requestId);
      if (item.historyId) {
        try {
          await deleteHistoryEntry(item.historyId);
        } catch (error) {
          console.error('[YT2PP] Could not delete history entry:', error);
        }
      }
    },
    [removeDownload]
  );

  const clearPersistedHistory = useCallback(async () => {
    await clearHistoryEntries();
    clearCompleted();
  }, [clearCompleted]);

  const revealDownload = useCallback(async (item: DownloadItem) => {
    if (!item.outputPath) {
      return;
    }
    await revealFile(item.outputPath);
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    if (!normalizedFilter) {
      return items;
    }
    return items.filter((item) => {
      return item.title.toLowerCase().includes(normalizedFilter) || item.url.toLowerCase().includes(normalizedFilter);
    });
  }, [filterText, items]);

  return {
    items: filteredItems,
    allItems: items,
    viewMode,
    settingsOpen,
    setViewMode,
    filterText,
    setFilterText,
    setSettingsOpen,
    queueDownload,
    retryDownload,
    deleteDownload,
    clearCompleted,
    clearPersistedHistory,
    revealDownload,
    moveDownload,
  };
}
