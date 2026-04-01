import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';

let socket: Socket | null = null;
let onPercentage: ((pct: string) => void) | null = null;
let onComplete: (() => void) | null = null;
let onFailed: ((msg: string) => void) | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => console.log('[YT2PP] Connected to backend'));
    socket.on('disconnect', () => console.log('[YT2PP] Disconnected from backend'));

    socket.on('percentage', (data: { percentage: string }) => {
      if (onPercentage) onPercentage(data.percentage.trim());
    });

    socket.on('download-complete', () => {
      if (onComplete) onComplete();
    });

    socket.on('download-failed', (data: { message: string }) => {
      if (onFailed) onFailed(data.message);
    });
  }
  return socket;
}

export function setProgressCallbacks(
  percentageCb: (pct: string) => void,
  completeCb: () => void,
  failedCb: (msg: string) => void
) {
  onPercentage = percentageCb;
  onComplete = completeCb;
  onFailed = failedCb;
}

export interface DownloadRequest {
  videoUrl: string;
  downloadType: 'full' | 'audio' | 'clip';
  audioOnly?: boolean;
  downloadMP3?: boolean;
  clipIn?: number;
  clipOut?: number;
  currentTime?: number;
  downloadPath?: string;
  secondsBefore?: number;
  secondsAfter?: number;
  videoOnly?: boolean;
  resolution?: string;
}

export async function sendDownloadRequest(req: DownloadRequest): Promise<boolean> {
  try {
    const payload = {
      ...req,
      downloadMP3: req.audioOnly ?? req.downloadMP3 ?? false,
    };

    const response = await fetch(`${BACKEND_URL}/handle-video-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[YT2PP] Request failed:', data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[YT2PP] Network error:', err);
    return false;
  }
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(BACKEND_URL, { method: 'GET', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
