import { invoke } from '@tauri-apps/api/core';

import {
  DEFAULT_DESKTOP_SETTINGS,
  type ActiveDownloadsResponse,
  type DesktopSettings,
  type DownloadRequestPayload,
  type DownloadRequestResponse,
  type HistoryResponse,
  type PremiereStatusResponse,
  type VideoInfo,
} from './types';
import {
  BACKEND_PORTS,
  parseBackendCandidate,
  pickPreferredBackend,
  type BackendCandidate,
  type BackendHealthPayload,
} from './backendDiscovery';

let cachedBackendPort: number | null = null;
let pendingBackendPort: Promise<number> | null = null;

export class ApiError extends Error {
  duplicate = false;
  requestId?: string;
  status?: string;

  constructor(
    message: string,
    options?: {
      duplicate?: boolean;
      requestId?: string;
      status?: string;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.duplicate = Boolean(options?.duplicate);
    this.requestId = options?.requestId;
    this.status = options?.status;
  }
}

export function invalidateBackendPortCache() {
  cachedBackendPort = null;
}

async function pingBackendPort(port: number): Promise<BackendCandidate> {
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'GET',
    headers: {
      'X-YT2PP-Desktop': '1',
    },
    signal: AbortSignal.timeout(800),
  });

  if (!response.ok) {
    throw new Error(`Backend on ${port} is unavailable`);
  }

  return parseBackendCandidate(port, (await response.json()) as BackendHealthPayload);
}

async function scanBackendPorts(): Promise<number> {
  const settled = await Promise.allSettled(BACKEND_PORTS.map((candidate) => pingBackendPort(candidate)));
  const candidates = settled
    .flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));

  return pickPreferredBackend(candidates).port;
}

export async function discoverBackendPort(forceRefresh = false): Promise<number> {
  if (!forceRefresh && cachedBackendPort !== null) {
    return cachedBackendPort;
  }

  if (!forceRefresh && pendingBackendPort) {
    return pendingBackendPort;
  }

  pendingBackendPort = (async () => {
    try {
      const port = await invoke<number>('get_server_port');
      if (typeof port === 'number' && port >= 3001 && port <= 3010) {
        const candidate = await pingBackendPort(port);
        cachedBackendPort = candidate.port;
        return candidate.port;
      }
    } catch {
      // Ignore IPC lookup failures and fall back to network discovery.
    }

    const port = await scanBackendPorts();
    cachedBackendPort = port;
    return port;
  })().finally(() => {
    pendingBackendPort = null;
  });

  return pendingBackendPort;
}

async function apiRequest<T>(path: string, init?: RequestInit, allowRetry = true): Promise<T> {
  const port = await discoverBackendPort();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-YT2PP-Desktop': '1',
      ...(init?.headers ?? {}),
    },
  }).catch(async (error) => {
    if (!allowRetry) {
      throw error;
    }

    invalidateBackendPortCache();
    return fetch(`http://127.0.0.1:${await discoverBackendPort(true)}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-YT2PP-Desktop': '1',
        ...(init?.headers ?? {}),
      },
    });
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(String(data.error ?? 'Request failed'), {
      duplicate: Boolean(data.duplicate),
      requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
      status: typeof data.status === 'string' ? data.status : undefined,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getBackendHealth(): Promise<boolean> {
  try {
    await discoverBackendPort(true);
    return true;
  } catch {
    return false;
  }
}

export async function getSettings(): Promise<DesktopSettings> {
  const response = await apiRequest<{ settings: DesktopSettings }>('/settings', { method: 'GET' });
  return { ...DEFAULT_DESKTOP_SETTINGS, ...response.settings };
}

export async function saveSettings(settings: DesktopSettings): Promise<DesktopSettings> {
  const response = await apiRequest<{ settings: DesktopSettings }>('/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
  return { ...DEFAULT_DESKTOP_SETTINGS, ...response.settings };
}

export async function pickFolder(initialPath = ''): Promise<string | null> {
  const response = await apiRequest<{ success: boolean; cancelled?: boolean; path?: string }>('/pick-folder', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Select folder',
      initialPath,
    }),
  });

  if (response.cancelled) {
    return null;
  }

  return response.path?.trim() || null;
}

export async function getVideoInfo(videoUrl: string): Promise<VideoInfo> {
  const response = await apiRequest<{ info: VideoInfo }>('/video-info', {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
  });
  return response.info;
}

export async function getPremiereStatus(): Promise<PremiereStatusResponse> {
  return apiRequest<PremiereStatusResponse>('/premiere-status', {
    method: 'GET',
  });
}

export async function getHistory(page = 1, pageSize = 100): Promise<HistoryResponse> {
  return apiRequest<HistoryResponse>(`/history?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
  });
}

export async function listActiveDownloads(): Promise<ActiveDownloadsResponse> {
  return apiRequest<ActiveDownloadsResponse>('/active-downloads', {
    method: 'GET',
  });
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await apiRequest<void>(`/history/${id}`, {
    method: 'DELETE',
  });
}

export async function clearHistoryEntries(): Promise<void> {
  await apiRequest<void>('/history', {
    method: 'DELETE',
  });
}

export async function revealFile(path: string): Promise<void> {
  await apiRequest<void>('/reveal-file', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

export async function startDownload(request: DownloadRequestPayload): Promise<DownloadRequestResponse> {
  return apiRequest<DownloadRequestResponse>('/handle-video-url', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
