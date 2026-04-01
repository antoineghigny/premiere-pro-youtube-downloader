import type { DownloadRequest } from './contracts';

type DownloadHandlers = {
  onProgress: (pct: string) => void;
  onComplete: () => void;
  onFailed: (msg: string) => void;
};

type RuntimeResponse = {
  success?: boolean;
  error?: string;
  healthy?: boolean;
  requestId?: string;
};

const downloadHandlers = new Map<string, DownloadHandlers>();
let runtimeListenerInitialized = false;

function ensureRuntimeListener() {
  if (runtimeListenerInitialized) return;

  chrome.runtime.onMessage.addListener((message) => {
    const requestId = typeof message?.requestId === 'string' ? message.requestId : '';
    if (!requestId) return;

    const handlers = downloadHandlers.get(requestId);
    if (!handlers) return;

    if (message.type === 'DOWNLOAD_PROGRESS') {
      handlers.onProgress(String(message.percentage ?? '0%').trim());
      return;
    }

    if (message.type === 'DOWNLOAD_COMPLETE') {
      downloadHandlers.delete(requestId);
      handlers.onComplete();
      return;
    }

    if (message.type === 'DOWNLOAD_FAILED') {
      downloadHandlers.delete(requestId);
      handlers.onFailed(String(message.message ?? 'Unknown error'));
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
  downloadHandlers.set(requestId, handlers);
}

export function unregisterDownloadHandlers(requestId: string) {
  downloadHandlers.delete(requestId);
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
