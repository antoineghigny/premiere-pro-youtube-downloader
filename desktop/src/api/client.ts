import { invoke } from '@tauri-apps/api/core';

import {
  DEFAULT_DESKTOP_SETTINGS,
  type ActiveDownloadsResponse,
  type DesktopSettings,
  type DownloadRequestPayload,
  type DownloadRequestResponse,
  type HistoryResponse,
  type HyperframesActionResponse,
  type HyperframesArtifact,
  type HyperframesArtifactDetail,
  type HyperframesCatalogItem,
  type HyperframesContext,
  type HyperframesDesignDocument,
  type HyperframesGenerateRequest,
  type IntegrationActionResponse,
  type IntegrationStatus,
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
let cachedDesktopAuthToken: string | null = null;
let pendingDesktopAuthToken: Promise<string> | null = null;

export class ApiError extends Error {
  duplicate = false;
  folderSelectionRequired = false;
  requestId?: string;
  status?: string;
  outputPath?: string;

  constructor(
    message: string,
    options?: {
      duplicate?: boolean;
      folderSelectionRequired?: boolean;
      requestId?: string;
      status?: string;
      outputPath?: string;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.duplicate = Boolean(options?.duplicate);
    this.folderSelectionRequired = Boolean(options?.folderSelectionRequired);
    this.requestId = options?.requestId;
    this.status = options?.status;
    this.outputPath = options?.outputPath;
  }
}

export function invalidateBackendPortCache() {
  cachedBackendPort = null;
}

async function getDesktopAuthToken(): Promise<string> {
  if (cachedDesktopAuthToken !== null) {
    return cachedDesktopAuthToken;
  }

  if (pendingDesktopAuthToken) {
    return pendingDesktopAuthToken;
  }

  pendingDesktopAuthToken = invoke<string>('get_desktop_auth_token')
    .then((token) => {
      cachedDesktopAuthToken = token;
      return token;
    })
    .finally(() => {
      pendingDesktopAuthToken = null;
    });

  return pendingDesktopAuthToken;
}

async function pingBackendPort(port: number): Promise<BackendCandidate> {
  const desktopAuthToken = await getDesktopAuthToken();
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'GET',
    headers: {
      'X-YT2PP-Desktop': '1',
      'X-YT2PP-Desktop-Token': desktopAuthToken,
    },
    signal: AbortSignal.timeout(2000),
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
  const desktopAuthToken = await getDesktopAuthToken();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-YT2PP-Desktop': '1',
      'X-YT2PP-Desktop-Token': desktopAuthToken,
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
        'X-YT2PP-Desktop-Token': desktopAuthToken,
        ...(init?.headers ?? {}),
      },
    });
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(String(data.error ?? 'Request failed'), {
      duplicate: Boolean(data.duplicate),
      folderSelectionRequired: Boolean(data.folderSelectionRequired),
      requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
      status: typeof data.status === 'string' ? data.status : undefined,
      outputPath: typeof data.outputPath === 'string' ? data.outputPath : undefined,
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

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const response = await apiRequest<{ status: IntegrationStatus }>('/integrations/status', {
    method: 'GET',
  });
  return response.status;
}

export async function installPremiereIntegration(): Promise<IntegrationActionResponse> {
  return apiRequest<IntegrationActionResponse>('/integrations/install-premiere', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function openBrowserSetup(): Promise<IntegrationActionResponse> {
  return apiRequest<IntegrationActionResponse>('/integrations/open-browser-setup', {
    method: 'POST',
    body: JSON.stringify({}),
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

export async function getHyperframesContext(): Promise<HyperframesContext> {
  const response = await apiRequest<{ context: HyperframesContext }>('/hyperframes/context', {
    method: 'GET',
  });
  return response.context;
}

export async function getHyperframesCatalog(): Promise<HyperframesCatalogItem[]> {
  const response = await apiRequest<{ items: HyperframesCatalogItem[] }>('/hyperframes/catalog', {
    method: 'GET',
  });
  return response.items;
}

export async function getHyperframesDesign(): Promise<HyperframesDesignDocument> {
  return apiRequest<HyperframesDesignDocument>('/hyperframes/design', {
    method: 'GET',
  });
}

export async function saveHyperframesDesign(content: string): Promise<HyperframesDesignDocument> {
  const response = await apiRequest<{ success: boolean; path: string }>('/hyperframes/design', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return {
    path: response.path,
    content,
  };
}

export async function listHyperframesJobs(): Promise<ActiveDownloadsResponse> {
  return apiRequest<ActiveDownloadsResponse>('/hyperframes/jobs', {
    method: 'GET',
  });
}

export async function listHyperframesArtifacts(): Promise<HyperframesArtifact[]> {
  const response = await apiRequest<{ items: HyperframesArtifact[] }>('/hyperframes/artifacts', {
    method: 'GET',
  });
  return response.items;
}

export async function getHyperframesArtifact(jobId: string): Promise<HyperframesArtifactDetail> {
  return apiRequest<HyperframesArtifactDetail>(`/hyperframes/artifacts/${jobId}`, {
    method: 'GET',
  });
}

export async function generateOverlay(
  request: HyperframesGenerateRequest
): Promise<HyperframesActionResponse> {
  return apiRequest<HyperframesActionResponse>('/hyperframes/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function renderOverlay(jobId: string): Promise<HyperframesActionResponse> {
  return apiRequest<HyperframesActionResponse>('/hyperframes/render', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  });
}

export async function importOverlay(jobId: string): Promise<void> {
  await apiRequest<void>('/hyperframes/import', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
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
