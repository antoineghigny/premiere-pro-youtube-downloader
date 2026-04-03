import {
  BACKEND_PORTS,
  parseBackendCandidate,
  pickPreferredBackend,
  type BackendCandidate,
  type BackendHealthPayload,
} from './backendDiscovery';
import {
  DEFAULT_SETTINGS,
  type DownloadProgressState,
  type DownloadRequest,
  type ExtensionSettings,
} from './api/contracts';

type ActiveDownloadState = {
  requestId: string;
  stage: DownloadProgressState['stage'];
  percentage?: string;
  speed?: string;
  eta?: string;
  detail?: string;
  indeterminate: boolean;
  path?: string;
  message?: string;
  updatedAt?: string;
};

type RuntimeMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: ExtensionSettings }
  | { type: 'CHECK_BACKEND_HEALTH' }
  | { type: 'PICK_FOLDER'; title: string; initialPath?: string }
  | { type: 'START_DOWNLOAD'; request: DownloadRequest }
  | { type: 'GET_DOWNLOAD_STATUS'; requestId: string }
  | { type: 'STOP_TRACKING_DOWNLOAD'; requestId: string };

type ActiveDownload = {
  tabId: number;
  status: DownloadProgressState;
  cleanupTimeoutId: ReturnType<typeof setTimeout> | null;
};

type BackendStartResponse = {
  success: boolean;
  error?: string;
  duplicate?: boolean;
  requestId?: string;
  status?: string;
  outputPath?: string;
  folderSelectionRequired?: boolean;
};

const activeDownloads = new Map<string, ActiveDownload>();
const DOWNLOAD_STATUS_RETENTION_MS = 60000;
const LEGACY_SETTING_KEYS = ['secondsBefore', 'secondsAfter', 'audioOnly', 'downloadMP3', 'clipAudioOnly'];

let cachedBackendPort: number | null = null;

setInterval(() => {
  const now = Date.now();
  for (const [id, download] of activeDownloads.entries()) {
    const age = now - (download.status.updatedAt ?? 0);
    if (age > DOWNLOAD_STATUS_RETENTION_MS * 2) {
      stopTrackingDownload(id);
    }
  }
}, 30000);

setInterval(() => {
  if (activeDownloads.size === 0) {
    return;
  }

  void resyncActiveDownloads();
}, 750);

function backendBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

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

function getStoredBackendPort(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['backendPort'], (result) => {
      const port = Number(result.backendPort);
      resolve(Number.isInteger(port) && BACKEND_PORTS.includes(port) ? port : null);
    });
  });
}

function storeBackendPort(port: number): Promise<void> {
  return chrome.storage.local.set({ backendPort: port });
}

async function scanBackendPorts(): Promise<number> {
  const settled = await Promise.allSettled(BACKEND_PORTS.map((candidate) => pingBackendPortDetailed(candidate)));
  const candidates = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  return pickPreferredBackend(candidates).port;
}

async function pingBackendPortDetailed(port: number): Promise<BackendCandidate> {
  const response = await fetch(`${backendBaseUrl(port)}/`, {
    method: 'GET',
    signal: AbortSignal.timeout(800),
  });
  if (!response.ok) {
    throw new Error(`Port ${port} is unavailable`);
  }

  return parseBackendCandidate(port, (await response.json()) as BackendHealthPayload);
}

async function discoverBackendPort(forceRefresh = false): Promise<number> {
  if (!forceRefresh && cachedBackendPort !== null) {
    return cachedBackendPort;
  }

  if (!forceRefresh) {
    const stored = await getStoredBackendPort();
    if (stored !== null) {
      try {
        const candidate = await pingBackendPortDetailed(stored);
        if (candidate.instanceKind === 'development') {
          cachedBackendPort = candidate.port;
          return candidate.port;
        }
      } catch {
        cachedBackendPort = null;
      }
    }
  }

  const port = await scanBackendPorts();
  cachedBackendPort = port;
  await storeBackendPort(port);
  return port;
}

async function fetchBackend(path: string, init?: RequestInit, allowRetry = true): Promise<Response> {
  const port = await discoverBackendPort();

  try {
    return await fetch(`${backendBaseUrl(port)}${path}`, init);
  } catch (error) {
    if (!allowRetry) {
      throw error;
    }

    cachedBackendPort = null;
    const fallbackPort = await discoverBackendPort(true);
    return fetch(`${backendBaseUrl(fallbackPort)}${path}`, init);
  }
}

async function resyncActiveDownloads(): Promise<void> {
  if (activeDownloads.size === 0) {
    return;
  }

  try {
    const response = await fetchBackend('/active-downloads', {
      method: 'GET',
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { items?: ActiveDownloadState[] };
    for (const download of data.items ?? []) {
      if (!activeDownloads.has(download.requestId)) {
        continue;
      }

      if (download.stage === 'complete') {
        updateDownloadStatus(download.requestId, {
          stage: 'complete',
          indeterminate: false,
          percentage: download.percentage ?? '100%',
          speed: undefined,
          eta: undefined,
          path: download.path ?? '',
          message: undefined,
        });
        void relayToTab(download.requestId, {
          type: 'DOWNLOAD_COMPLETE',
          requestId: download.requestId,
          path: download.path ?? '',
          stage: 'complete',
          percentage: download.percentage ?? '100%',
          indeterminate: false,
        }).finally(() => scheduleDownloadCleanup(download.requestId));
        continue;
      }

      if (download.stage === 'failed') {
        updateDownloadStatus(download.requestId, {
          stage: 'failed',
          indeterminate: true,
          speed: undefined,
          eta: undefined,
          message: download.message ?? 'Unknown error',
        });
        void relayToTab(download.requestId, {
          type: 'DOWNLOAD_FAILED',
          requestId: download.requestId,
          message: download.message ?? 'Unknown error',
          stage: 'failed',
          indeterminate: true,
        }).finally(() => scheduleDownloadCleanup(download.requestId));
        continue;
      }

      updateDownloadStatus(download.requestId, {
        stage: download.stage,
        indeterminate: Boolean(download.indeterminate),
        percentage: download.percentage ?? undefined,
        speed: download.speed ?? undefined,
        eta: download.eta ?? undefined,
        detail: download.detail ?? undefined,
      });
      void relayToTab(download.requestId, {
        type: 'DOWNLOAD_PROGRESS',
        requestId: download.requestId,
        percentage: download.percentage ?? '',
        speed: download.speed ?? '',
        eta: download.eta ?? '',
        stage: download.stage,
        indeterminate: Boolean(download.indeterminate),
        detail: download.detail ?? '',
      });
    }
  } catch (error) {
    console.warn('[YT2PP] Active download resync failed:', error);
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
  return fetchBackend(path, {
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
    await discoverBackendPort(true);
    return true;
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

async function submitDownloadRequest(requestId: string, request: DownloadRequest): Promise<BackendStartResponse> {
  const response = await postJson('/handle-video-url', {
    ...request,
    requestId,
    downloadMP3: request.audioOnly ?? request.downloadMP3 ?? false,
  });

  if (response.ok) {
    return { success: true, requestId };
  }

  const data = await response.json().catch(() => ({ error: 'Unknown error' } as BackendStartResponse));
  return {
    success: false,
    error: data.error ?? 'Request failed.',
    duplicate: Boolean(data.duplicate),
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
    outputPath: typeof data.outputPath === 'string' ? data.outputPath : undefined,
    folderSelectionRequired: Boolean(data.folderSelectionRequired),
  };
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

  try {
    let response = await submitDownloadRequest(requestId, request);

    if (!response.success && response.folderSelectionRequired) {
      const pickedFolder = await pickFolder(
        'Choose a folder for this download',
        String(request.downloadPath ?? '')
      );
      if (pickedFolder.cancelled) {
        stopTrackingDownload(requestId);
        return { success: false, cancelled: true };
      }
      if (!pickedFolder.success) {
        stopTrackingDownload(requestId);
        return { success: false, error: pickedFolder.error ?? 'Could not choose a folder' };
      }

      response = await submitDownloadRequest(requestId, {
        ...request,
        downloadPath: pickedFolder.path ?? '',
        outputTarget: 'downloadFolder',
      });
    }

    if (!response.success) {
      stopTrackingDownload(requestId);
      return {
        success: false,
        error: response.error ?? 'Request failed.',
        duplicate: response.duplicate,
        requestId: response.requestId,
        status: response.status,
        outputPath: response.outputPath,
      };
    }

    void resyncActiveDownloads();
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
