import { create } from 'zustand';

import {
  type DownloadItem,
  type HistoryEntry,
  type ViewMode,
} from '../api/types';

function historyEntryToItem(entry: HistoryEntry): DownloadItem {
  const isFailedLike = entry.status === 'failed' || entry.status === 'interrupted';
  const isComplete = entry.status === 'complete';
  const isRunning = entry.status === 'running';
  const isQueued = entry.status === 'queued';

  return {
    requestId: entry.requestId || entry.id,
    jobKind: 'download',
    historyId: entry.id,
    url: entry.url,
    title: entry.title,
    thumbnail: entry.thumbnail,
    status: isComplete ? 'complete' : isRunning ? 'running' : isQueued ? 'queued' : 'failed',
    stage: isComplete ? 'complete' : isRunning ? 'preparing' : isQueued ? 'preparing' : 'failed',
    progress: isComplete ? 100 : 0,
    percentageLabel: isComplete ? '100%' : undefined,
    indeterminate: !isComplete && !isFailedLike,
    outputPath: entry.outputPath,
    detail: isRunning ? 'Download in progress' : isQueued ? 'Waiting to start' : undefined,
    error: isFailedLike ? (entry.status === 'interrupted' ? 'Download interrupted' : 'Download failed') : undefined,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    totalBytes: entry.fileSize,
    speedPoints: [],
    speedSampledAt: undefined,
    speedRollingRate: undefined,
    request: entry.settings,
  };
}

function shouldPreserveLiveRuntimeState(existing: DownloadItem, mapped: DownloadItem): boolean {
  const existingIsLive = existing.status === 'starting' || existing.status === 'running';
  const mappedIsBackendSnapshot = mapped.status === 'queued' || mapped.status === 'running';
  return existingIsLive && mappedIsBackendSnapshot;
}

type DownloadStore = {
  items: DownloadItem[];
  viewMode: ViewMode;
  filterText: string;
  settingsOpen: boolean;
  setViewMode: (viewMode: ViewMode) => void;
  setFilterText: (value: string) => void;
  setSettingsOpen: (open: boolean) => void;
  addQueuedDownload: (item: DownloadItem) => void;
  updateDownload: (requestId: string, patch: Partial<DownloadItem>) => void;
  markStarting: (requestId: string) => void;
  markRunning: (requestId: string) => void;
  markFailed: (requestId: string, message: string) => void;
  markComplete: (requestId: string, outputPath: string) => void;
  removeDownload: (requestId: string) => void;
  clearCompleted: () => void;
  moveDownload: (sourceId: string, targetId: string) => void;
  hydrateHistory: (entries: HistoryEntry[]) => void;
};

export const useDownloadStore = create<DownloadStore>((set) => ({
  items: [],
  viewMode: 'list',
  filterText: '',
  settingsOpen: false,
  setViewMode: (viewMode) => set({ viewMode }),
  setFilterText: (filterText) => set({ filterText }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  addQueuedDownload: (item) =>
    set((state) => ({
      items: [item, ...state.items],
    })),
  updateDownload: (requestId, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.requestId === requestId ? { ...item, ...patch } : item)),
    })),
  markStarting: (requestId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.requestId === requestId
          ? {
              ...item,
              status: 'starting',
              stage: 'resolving',
              detail: 'Resolving media',
              indeterminate: true,
            }
          : item
      ),
    })),
  markRunning: (requestId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.requestId === requestId
          ? {
              ...item,
              status: 'running',
            }
          : item
      ),
    })),
  markFailed: (requestId, message) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.requestId === requestId
          ? {
              ...item,
              status: 'failed',
              stage: 'failed',
              indeterminate: true,
              error: message,
              completedAt: item.completedAt ?? new Date().toISOString(),
            }
          : item
      ),
    })),
  markComplete: (requestId, outputPath) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.requestId === requestId
          ? {
              ...item,
              status: 'complete',
              stage: 'complete',
              progress: 100,
              percentageLabel: '100%',
              indeterminate: false,
              outputPath,
              completedAt: item.completedAt ?? new Date().toISOString(),
            }
          : item
      ),
    })),
  removeDownload: (requestId) =>
    set((state) => ({
      items: state.items.filter((item) => item.requestId !== requestId),
    })),
  clearCompleted: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status === 'running' || item.status === 'queued' || item.status === 'starting'),
    })),
  moveDownload: (sourceId, targetId) =>
    set((state) => {
      const items = [...state.items];
      const sourceIndex = items.findIndex((item) => item.requestId === sourceId);
      const targetIndex = items.findIndex((item) => item.requestId === targetId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return state;
      }
      const [item] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, item);
      return { items };
    }),
  hydrateHistory: (entries) =>
    set((state) => {
      const existingByHistoryId = new Map(
        state.items
          .filter((item) => item.historyId)
          .map((item) => [item.historyId as string, item])
      );
      const existingByRequestId = new Map(state.items.map((item) => [item.requestId, item]));

      const nextItems = [...state.items];

      for (const entry of entries) {
        const mapped = historyEntryToItem(entry);
        const existing = existingByHistoryId.get(entry.id) ?? existingByRequestId.get(entry.requestId);

        if (existing) {
          const index = nextItems.findIndex((item) => item.requestId === existing.requestId);
          if (index !== -1) {
            const currentItem = nextItems[index];
            nextItems[index] = shouldPreserveLiveRuntimeState(currentItem, mapped)
              ? {
                  ...currentItem,
                  historyId: mapped.historyId,
                  title: currentItem.title === currentItem.url ? mapped.title : currentItem.title,
                  thumbnail: currentItem.thumbnail ?? mapped.thumbnail,
                  totalBytes: mapped.totalBytes ?? currentItem.totalBytes,
                  request: mapped.request,
                }
              : {
                  ...currentItem,
                  ...mapped,
                  progress: currentItem.progress > 0 && mapped.progress === 0 ? currentItem.progress : mapped.progress,
                  percentageLabel: currentItem.percentageLabel ?? mapped.percentageLabel,
                  speed: currentItem.speed,
                  eta: currentItem.eta,
                  speedPoints: currentItem.speedPoints,
                  speedSampledAt: currentItem.speedSampledAt,
                  speedRollingRate: currentItem.speedRollingRate,
                };
          }
          continue;
        }

        nextItems.push(mapped);
      }

      return {
        items: nextItems.sort((left, right) =>
          right.startedAt.localeCompare(left.startedAt)
        ),
      };
    }),
}));
