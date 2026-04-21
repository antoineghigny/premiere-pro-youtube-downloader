import {
  discoverBackendPort,
  invalidateBackendPortCache,
  listActiveDownloads,
  listHyperframesJobs,
} from './client';
import type { ActiveDownloadState, SocketEvent } from './types';

type Listener = (event: SocketEvent) => void;

function activeDownloadToSocketEvent(download: ActiveDownloadState): SocketEvent {
  if (download.stage === 'complete') {
    return {
      type: 'complete',
      requestId: download.requestId,
      jobKind: download.jobKind,
      path: download.path ?? '',
      percentage: download.percentage,
    };
  }

  if (download.stage === 'failed') {
    return {
      type: 'failed',
      requestId: download.requestId,
      jobKind: download.jobKind,
      message: download.message ?? 'Download failed',
      stage: download.stage,
      indeterminate: download.indeterminate,
    };
  }

  return {
    type: 'progress',
    requestId: download.requestId,
    jobKind: download.jobKind,
    stage: download.stage,
    percentage: download.percentage,
    speed: download.speed,
    eta: download.eta,
    detail: download.detail,
    indeterminate: download.indeterminate,
  };
}

class DownloadSocketClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private subscriptions = new Set<string>();
  private reconnectTimer: number | null = null;
  private retryDelay = 1000;
  private connectingPromise: Promise<void> | null = null;

  addListener(listener: Listener) {
    this.listeners.add(listener);
    void this.ensureConnected();
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribe(requestId: string) {
    this.subscriptions.add(requestId);
    void this.ensureConnected().then(() => {
      this.send({ type: 'subscribe', requestId });
    });
  }

  unsubscribe(requestId: string) {
    this.subscriptions.delete(requestId);
    this.send({ type: 'unsubscribe', requestId });
  }

  private async ensureConnected() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      if (this.connectingPromise) {
        await this.connectingPromise;
      }
      return;
    }

    if (this.connectingPromise) {
      await this.connectingPromise;
      return;
    }

    this.connectingPromise = (async () => {
      const port = await discoverBackendPort();
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        this.socket = socket;

        const timeoutId = window.setTimeout(() => {
          socket.close();
          reject(new Error('WebSocket connection timed out'));
        }, 5000);

        socket.addEventListener('open', () => {
          window.clearTimeout(timeoutId);
          this.retryDelay = 1000;
          this.clearReconnectTimer();
          for (const requestId of this.subscriptions) {
            this.send({ type: 'subscribe', requestId });
          }
          void this.resyncActiveDownloads();
          resolve();
        }, { once: true });

        socket.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(event.data) as SocketEvent;
            for (const listener of this.listeners) {
              listener(payload);
            }
          } catch (error) {
            console.error('[YT2PP] Invalid WebSocket payload:', error);
          }
        });

        socket.addEventListener('error', () => {
          window.clearTimeout(timeoutId);
          reject(new Error('WebSocket connection failed'));
        }, { once: true });

        socket.addEventListener('close', () => {
          this.socket = null;
          invalidateBackendPortCache();
          this.scheduleReconnect();
        });
      });
    })().finally(() => {
      this.connectingPromise = null;
    });

    await this.connectingPromise;
  }

  private async resyncActiveDownloads() {
    try {
      const [downloads, hyperframes] = await Promise.all([
        listActiveDownloads(),
        listHyperframesJobs(),
      ]);
      const items = [...downloads.items, ...hyperframes.items];
      for (const download of items.filter((item) => this.subscriptions.has(item.requestId))) {
        const event = activeDownloadToSocketEvent(download);
        for (const listener of this.listeners) {
          listener(event);
        }
      }
    } catch (error) {
      console.error('[YT2PP] Could not resync active downloads:', error);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null || this.subscriptions.size === 0) {
      return;
    }

    const delay = this.retryDelay;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.retryDelay = Math.min(this.retryDelay * 2, 30000);
      void this.ensureConnected().catch((error) => {
        console.error('[YT2PP] WebSocket reconnect failed:', error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(payload: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}

export const socketClient = new DownloadSocketClient();
