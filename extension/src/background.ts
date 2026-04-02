import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './config';
import {
  DEFAULT_SETTINGS,
  type DownloadProgressState,
  type DownloadRequest,
  type ExtensionSettings,
} from './api/contracts';

type ActiveDownload = {
  tabId: number;
  status: DownloadProgressState;
  cleanupTimeoutId: ReturnType<typeof setTimeout> | null;
};

type RuntimeMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: ExtensionSettings }
  | { type: 'CHECK_BACKEND_HEALTH' }
  | { type: 'PICK_FOLDER'; title: string; initialPath?: string }
  | { type: 'START_DOWNLOAD'; request: DownloadRequest }
  | { type: 'GET_DOWNLOAD_STATUS'; requestId: string }
  | { type: 'STOP_TRACKING_DOWNLOAD'; requestId: string };

let socket: Socket | null = null;
const activeDownloads = new Map<string, ActiveDownload>();
const DOWNLOAD_STATUS_RETENTION_MS = 60000;
const LEGACY_SETTING_KEYS = ['secondsBefore', 'secondsAfter', 'audioOnly', 'downloadMP3', 'clipAudioOnly'];

function createInitialDownloadStatus(): DownloadProgressState {
  return {
    stage: 'preparing',
    indeterminate: true,
    detail: 'Queueing download',
    updatedAt: Date.now(),
  };
}

function clearCleanupTimer(activeDownload: ActiveDownload) {
  if (activeDownload.cleanupTimeoutId !== null) {
    clearTimeout(activeDownload.cleanupTimeoutId);
    activeDownload.cleanupTimeoutId = null;
  }
}

function updateDownloadStatus(requestId: string, patch: Partial<DownloadProgressState>) {
  const activeDownload = activeDownloads.get(requestId);
  if (!activeDownload) return;

  clearCleanupTimer(activeDownload);
  activeDownload.status = {
    ...activeDownload.status,
    ...patch,
    updatedAt: Date.now(),
  };
}

function scheduleDownloadCleanup(requestId: string) {
  const activeDownload = activeDownloads.get(requestId);
  if (!activeDownload) return;

  clearCleanupTimer(activeDownload);
  activeDownload.cleanupTimeoutId = setTimeout(() => {
    stopTrackingDownload(requestId);
  }, DOWNLOAD_STATUS_RETENTION_MS);
}

function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('[YT2PP] Background connected to backend');
      for (const requestId of activeDownloads.keys()) {
        void subscribeToDownload(requestId);
      }
    });

    socket.on('disconnect', () => {
      console.log('[YT2PP] Background disconnected from backend');
    });

    socket.on('connect_error', (error) => {
      console.error('[YT2PP] Backend socket connection error:', error);
    });

    socket.on('download-progress', (data: { requestId?: string; percentage?: string; stage?: string; indeterminate?: boolean; detail?: string }) => {
      const requestId = data.requestId?.trim();
      if (!requestId) return;
      const stage = (data.stage?.trim() || 'downloading') as DownloadProgressState['stage'];
      updateDownloadStatus(requestId, {
        stage,
        indeterminate: Boolean(data.indeterminate ?? false),
        percentage: data.percentage?.trim() || undefined,
        detail: data.detail?.trim() || undefined,
      });
      void relayToTab(requestId, {
        type: 'DOWNLOAD_PROGRESS',
        requestId,
        percentage: data.percentage?.trim() ?? '',
        stage,
        indeterminate: Boolean(data.indeterminate ?? false),
        detail: data.detail?.trim() ?? '',
      });
    });

    socket.on('download-complete', (data: { requestId?: string; path?: string; stage?: string; percentage?: string; indeterminate?: boolean }) => {
      const requestId = data.requestId?.trim();
      if (!requestId) return;
      updateDownloadStatus(requestId, {
        stage: 'complete',
        indeterminate: false,
        percentage: '100%',
        path: data.path ?? '',
        message: undefined,
      });
      void relayToTab(requestId, {
        type: 'DOWNLOAD_COMPLETE',
        requestId,
        path: data.path ?? '',
        stage: 'complete',
        percentage: '100%',
        indeterminate: false,
      }).finally(() => scheduleDownloadCleanup(requestId));
    });

    socket.on('download-failed', (data: { requestId?: string; message?: string; stage?: string; indeterminate?: boolean }) => {
      const requestId = data.requestId?.trim();
      if (!requestId) return;
      updateDownloadStatus(requestId, {
        stage: 'failed',
        indeterminate: true,
        message: data.message ?? 'Unknown error',
      });
      void relayToTab(requestId, {
        type: 'DOWNLOAD_FAILED',
        requestId,
        message: data.message ?? 'Unknown error',
        stage: 'failed',
        indeterminate: true,
      }).finally(() => scheduleDownloadCleanup(requestId));
    });
  }

  return socket;
}

async function ensureSocketConnected(activeSocket: Socket): Promise<void> {
  if (activeSocket.connected) return;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      activeSocket.off('connect', handleConnect);
      activeSocket.off('connect_error', handleError);
      reject(new Error('Socket connection timed out'));
    }, 5000);

    const handleConnect = () => {
      clearTimeout(timeoutId);
      activeSocket.off('connect_error', handleError);
      resolve();
    };

    const handleError = (error: Error) => {
      clearTimeout(timeoutId);
      activeSocket.off('connect', handleConnect);
      reject(error);
    };

    activeSocket.once('connect', handleConnect);
    activeSocket.once('connect_error', handleError);
    activeSocket.connect();
  });
}

async function subscribeToDownload(requestId: string): Promise<boolean> {
  const activeSocket = getSocket();

  try {
    await ensureSocketConnected(activeSocket);
    await new Promise<void>((resolve, reject) => {
      activeSocket.timeout(5000).emit(
        'subscribe-download',
        { requestId },
        (err: Error | null, response?: { success?: boolean; message?: string }) => {
          if (err) {
            reject(err);
            return;
          }

          if (!response?.success) {
            reject(new Error(response?.message ?? 'Subscription rejected'));
            return;
          }

          resolve();
        }
      );
    });

    return true;
  } catch (error) {
    console.error('[YT2PP] Could not subscribe to download events:', error);
    return false;
  }
}

function unsubscribeFromDownload(requestId: string) {
  if (socket?.connected) {
    socket.emit('unsubscribe-download', { requestId });
  }
}

function sendMessageToTab(tabId: number, message: object): Promise<{ delivered: boolean; error?: string }> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      const runtimeError = chrome.runtime.lastError;
      resolve(runtimeError ? { delivered: false, error: runtimeError.message } : { delivered: true });
    });
  });
}

async function relayToTab(requestId: string, message: object): Promise<void> {
  const activeDownload = activeDownloads.get(requestId);
  if (!activeDownload) return;

  const result = await sendMessageToTab(activeDownload.tabId, message);
  if (!result.delivered) {
    const messageType = typeof (message as { type?: unknown }).type === 'string'
      ? String((message as { type?: unknown }).type)
      : 'UNKNOWN_MESSAGE';
    console.warn(
      `[YT2PP] Could not relay ${messageType} for ${requestId} to tab ${activeDownload.tabId}: ${result.error ?? 'Unknown error'}`
    );
  }
}

function stopTrackingDownload(requestId: string) {
  const activeDownload = activeDownloads.get(requestId);
  if (activeDownload) {
    clearCleanupTimer(activeDownload);
  }
  activeDownloads.delete(requestId);
  unsubscribeFromDownload(requestId);
}

function getStoredSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>, (settings) => {
      resolve({
        ...DEFAULT_SETTINGS,
        ...(settings as Partial<ExtensionSettings>),
        askAudioPathEachTime: Boolean(
          (settings as Partial<ExtensionSettings>).askAudioPathEachTime
          ?? DEFAULT_SETTINGS.askAudioPathEachTime
        ),
        askDownloadPathEachTime: Boolean(
          (settings as Partial<ExtensionSettings>).askDownloadPathEachTime
          ?? DEFAULT_SETTINGS.askDownloadPathEachTime
        ),
        videoOnly: Boolean((settings as Partial<ExtensionSettings>).videoOnly ?? DEFAULT_SETTINGS.videoOnly),
      });
    });
  });
}

function saveStoredSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(LEGACY_SETTING_KEYS, () => {
      chrome.storage.sync.set(settings as unknown as Record<string, unknown>, () => resolve());
    });
  });
}

async function postJson(path: string, payload: object): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function syncSettingsToBackend(settings: ExtensionSettings): Promise<boolean> {
  try {
    const response = await postJson('/settings', settings);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function pickFolder(title: string, initialPath = '') {
  try {
    const response = await postJson('/pick-folder', {
      title,
      initialPath,
    });
    const data = await response.json().catch(() => ({} as { success?: boolean; cancelled?: boolean; path?: string; error?: string }));
    if (!response.ok) {
      return {
        success: false,
        error: data.error ?? 'Folder picker request failed.',
      };
    }
    return {
      success: Boolean(data.success),
      cancelled: Boolean(data.cancelled),
      path: typeof data.path === 'string' ? data.path : '',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not open folder picker',
    };
  }
}

async function startDownload(sender: chrome.runtime.MessageSender, request: DownloadRequest) {
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return { success: false, error: 'Download requests must come from a tab context.' };
  }

  const requestId = String(request.requestId || crypto.randomUUID());
  activeDownloads.set(requestId, {
    tabId,
    status: createInitialDownloadStatus(),
    cleanupTimeoutId: null,
  });

  const subscribed = await subscribeToDownload(requestId);
  if (!subscribed) {
    stopTrackingDownload(requestId);
    return { success: false, error: 'Could not subscribe to download events.' };
  }

  try {
    const response = await postJson('/handle-video-url', {
      ...request,
      requestId,
      downloadMP3: request.audioOnly ?? request.downloadMP3 ?? false,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      stopTrackingDownload(requestId);
      return { success: false, error: data.error ?? 'Request failed.' };
    }

    return { success: true, requestId };
  } catch (error) {
    stopTrackingDownload(requestId);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [requestId, activeDownload] of activeDownloads.entries()) {
    if (activeDownload.tabId === tabId) {
      stopTrackingDownload(requestId);
    }
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  void (async () => {
    switch (message.type) {
      case 'GET_SETTINGS':
        sendResponse(await getStoredSettings());
        return;

      case 'SAVE_SETTINGS': {
        await saveStoredSettings(message.settings);
        const backendSynced = await syncSettingsToBackend(message.settings);
        sendResponse({ success: true, backendSynced });
        return;
      }

      case 'CHECK_BACKEND_HEALTH':
        sendResponse({ healthy: await checkBackendHealth() });
        return;

      case 'PICK_FOLDER':
        sendResponse(await pickFolder(message.title, message.initialPath ?? ''));
        return;

      case 'START_DOWNLOAD':
        sendResponse(await startDownload(sender, message.request));
        return;

      case 'GET_DOWNLOAD_STATUS': {
        const activeDownload = activeDownloads.get(message.requestId);
        sendResponse({
          success: true,
          found: Boolean(activeDownload),
          status: activeDownload?.status,
        });
        return;
      }

      case 'STOP_TRACKING_DOWNLOAD':
        stopTrackingDownload(message.requestId);
        sendResponse({ success: true });
        return;

      default:
        sendResponse({ success: false, error: 'Unsupported message type.' });
    }
  })().catch((error: unknown) => {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected background error',
    });
  });

  return true;
});
