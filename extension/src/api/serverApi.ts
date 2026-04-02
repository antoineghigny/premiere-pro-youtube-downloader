import {
  DEFAULT_SETTINGS,
  type DownloadProgressState,
  type DownloadRequest,
  type ExtensionSettings,
} from './contracts';

type DownloadHandlers = {
  onProgress: (status: DownloadProgressState) => void;
  onComplete: () => void;
  onFailed: (msg: string) => void;
};

type DownloadSubscription = {
  handlers: DownloadHandlers;
  lastSignature: string;
  pollIntervalId: number | null;
};

type RuntimeResponse = {
  success?: boolean;
  error?: string;
  healthy?: boolean;
  requestId?: string;
  found?: boolean;
  status?: DownloadProgressState;
};

const downloadHandlers = new Map<string, DownloadSubscription>();
let runtimeListenerInitialized = false;

function buildStatusSignature(status: DownloadProgressState): string {
  return [
    status.stage ?? '',
    String(status.indeterminate ?? ''),
    status.percentage ?? '',
    status.detail ?? '',
    status.path ?? '',
    status.message ?? '',
    String(status.updatedAt ?? ''),
  ].join('|');
}

function stopPolling(subscription: DownloadSubscription) {
  if (subscription.pollIntervalId !== null) {
    window.clearInterval(subscription.pollIntervalId);
    subscription.pollIntervalId = null;
  }
}

function unregisterDownloadHandlers(requestId: string) {
  const subscription = downloadHandlers.get(requestId);
  if (!subscription) return;
  stopPolling(subscription);
  downloadHandlers.delete(requestId);
}

function dispatchDownloadStatus(requestId: string, status: DownloadProgressState) {
  const subscription = downloadHandlers.get(requestId);
  if (!subscription) return;

  const signature = buildStatusSignature(status);
  if (signature === subscription.lastSignature) {
    return;
  }
  subscription.lastSignature = signature;

  if (status.stage === 'complete') {
    unregisterDownloadHandlers(requestId);
    subscription.handlers.onComplete();
    return;
  }

  if (status.stage === 'failed') {
    unregisterDownloadHandlers(requestId);
    subscription.handlers.onFailed(String(status.message ?? 'Unknown error'));
    return;
  }

  subscription.handlers.onProgress(status);
}

async function getDownloadStatus(requestId: string): Promise<DownloadProgressState | null> {
  const response = await sendRuntimeMessage<RuntimeResponse>({
    type: 'GET_DOWNLOAD_STATUS',
    requestId,
  });

  if (!response.success || !response.found) {
    return null;
  }

  return response.status ?? null;
}

async function pollDownloadStatus(requestId: string): Promise<void> {
  if (!downloadHandlers.has(requestId)) return;

  try {
    const status = await getDownloadStatus(requestId);
    if (!status) return;
    dispatchDownloadStatus(requestId, status);
  } catch {
    // Ignore transient background/runtime errors and keep polling.
  }
}

function startPolling(requestId: string) {
  const subscription = downloadHandlers.get(requestId);
  if (!subscription || subscription.pollIntervalId !== null) {
    return;
  }

  subscription.pollIntervalId = window.setInterval(() => {
    void pollDownloadStatus(requestId);
  }, 750);

  void pollDownloadStatus(requestId);
}

function ensureRuntimeListener() {
  if (runtimeListenerInitialized) return;

  chrome.runtime.onMessage.addListener((message) => {
    const requestId = typeof message?.requestId === 'string' ? message.requestId : '';
    if (!requestId) return;

    if (message.type === 'DOWNLOAD_PROGRESS') {
      dispatchDownloadStatus(requestId, {
        stage: (String(message.stage ?? 'downloading').trim() as DownloadProgressState['stage']),
        indeterminate: Boolean(message.indeterminate ?? false),
        percentage: String(message.percentage ?? '').trim() || undefined,
        detail: String(message.detail ?? '').trim() || undefined,
      });
      return;
    }

    if (message.type === 'DOWNLOAD_COMPLETE') {
      dispatchDownloadStatus(requestId, {
        stage: 'complete',
        indeterminate: false,
        percentage: String(message.percentage ?? '100%').trim(),
        path: String(message.path ?? ''),
      });
      return;
    }

    if (message.type === 'DOWNLOAD_FAILED') {
      dispatchDownloadStatus(requestId, {
        stage: 'failed',
        indeterminate: true,
        message: String(message.message ?? 'Unknown error'),
      });
    }
  });

  runtimeListenerInitialized = true;
}

function sendRuntimeMessage<T extends RuntimeResponse>(message: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve((response ?? {}) as T);
    });
  });
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function registerDownloadHandlers(requestId: string, handlers: DownloadHandlers) {
  ensureRuntimeListener();
  const existing = downloadHandlers.get(requestId);
  if (existing) {
    stopPolling(existing);
  }
  downloadHandlers.set(requestId, {
    handlers,
    lastSignature: '',
    pollIntervalId: null,
  });
  startPolling(requestId);
}

export function unsubscribeFromDownload(requestId: string) {
  unregisterDownloadHandlers(requestId);
  void sendRuntimeMessage({ type: 'STOP_TRACKING_DOWNLOAD', requestId }).catch(() => {});
}

export async function sendDownloadRequest(req: DownloadRequest): Promise<boolean> {
  try {
    const response = await sendRuntimeMessage<RuntimeResponse>({
      type: 'START_DOWNLOAD',
      request: req,
    });

    if (!response.success) {
      console.error('[YT2PP] Request failed:', response.error ?? 'Unknown error');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[YT2PP] Network error:', error);
    return false;
  }
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await sendRuntimeMessage<RuntimeResponse>({ type: 'CHECK_BACKEND_HEALTH' });
    return Boolean(response.healthy);
  } catch {
    return false;
  }
}

export async function getExtensionSettings(): Promise<ExtensionSettings> {
  try {
    const response = await sendRuntimeMessage<RuntimeResponse & Partial<ExtensionSettings>>({ type: 'GET_SETTINGS' });
    return {
      ...DEFAULT_SETTINGS,
      ...response,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
