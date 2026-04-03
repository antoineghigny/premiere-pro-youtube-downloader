import { getVideoUrl } from '../utils/pageUtils';
import type { DownloadProgressState } from '../api/contracts';
import {
  createRequestId,
  getExtensionSettings,
  pickDownloadFolder,
  registerDownloadHandlers,
  saveExtensionSettings,
  sendDownloadRequest,
  unsubscribeFromDownload,
} from '../api/serverApi';
import { getProgressLabel } from './progressUi';

type ButtonState = 'idle' | 'loading' | 'progress' | 'complete' | 'error';

// YouTube style download icon
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24"><path d="M17 18V19H7V18H17ZM16.5 11.4L15.8 10.7L12.5 13.9V5H11.5V13.9L8.2 10.7L7.5 11.4L12 15.9L16.5 11.4Z"/></svg>`;

export class DownloadButton {
  private element: HTMLButtonElement;
  private state: ButtonState = 'idle';
  private isActive = false;
  private progress = 0;
  private progressLabel = '';
  private isIndeterminate = false;
  private activeRequestId: string | null = null;

  constructor() {
    this.element = document.createElement('button');
    this.element.className = 'ytp-button yt2pp-btn yt2pp-download-btn';
    this.element.title = 'Download Video';
    this.render();
    this.element.addEventListener('click', () => this.handleClick());
  }

  private render() {
    const progressScale = this.state === 'idle'
      ? 0
      : this.isIndeterminate
        ? 1
        : Math.max(0, Math.min(100, this.progress)) / 100;
    const showProgressLabel = this.state === 'loading' || this.state === 'progress' || this.state === 'complete';
    const progressLabel = this.progressLabel || `${Math.max(0, Math.round(this.progress))}%`;

    this.element.classList.toggle('yt2pp-busy', this.state === 'loading' || this.state === 'progress');
    this.element.classList.toggle('yt2pp-complete', this.state === 'complete');
    this.element.classList.toggle('yt2pp-error', this.state === 'error');
    this.element.classList.toggle('yt2pp-show-progress', showProgressLabel);
    this.element.classList.toggle('yt2pp-indeterminate', showProgressLabel && this.isIndeterminate);

    this.element.innerHTML = `
      <span class="yt2pp-btn-progress-fill" style="transform: scaleX(${progressScale.toFixed(4)})"></span>
      ${showProgressLabel ? `<span class="yt2pp-btn-progress-label">${progressLabel}</span>` : ''}
      ${ICON_DOWNLOAD}
      <div class="yt2pp-tooltip">Download Video</div>
    `;
  }

  getElement(): HTMLButtonElement {
    return this.element;
  }

  private async handleClick() {
    if (this.isActive) return;
    const url = getVideoUrl();
    if (!url) return;

    try {
      const settings = await getExtensionSettings();
      let downloadPath = String(settings.downloadPath ?? '').trim();
      if (settings.outputTarget === 'downloadFolder' && settings.askDownloadPathEachTime) {
        const pickedPath = await pickDownloadFolder(
          'Choose folder for video downloads',
          downloadPath,
        );
        if (!pickedPath) {
          this.reset();
          return;
        }
        downloadPath = pickedPath;
        if (downloadPath !== settings.downloadPath) {
          await saveExtensionSettings({
            ...settings,
            downloadPath,
          });
        }
      }
      const requestId = createRequestId();
      const videoOnly = Boolean(settings.videoOnly);

      this.isActive = true;
      this.state = 'loading';
      this.progress = 0;
      this.progressLabel = 'Prep';
      this.isIndeterminate = true;
      this.render();
      this.activeRequestId = requestId;
      registerDownloadHandlers(requestId, {
        onProgress: (status) => this.setProgress(status),
        onComplete: () => this.setComplete(),
        onFailed: (msg) => {
          console.error('[YT2PP] Download failed:', msg);
          this.setError();
        },
      });

      const ok = await sendDownloadRequest({
        requestId,
        videoUrl: url,
        downloadType: 'full',
        audioOnly: false,
        videoOnly,
        resolution: settings.resolution,
        downloadPath,
        outputTarget: settings.outputTarget,
      });
      if (!ok.ok) {
        unsubscribeFromDownload(requestId);
        if (this.activeRequestId === requestId) {
          this.activeRequestId = null;
        }
        if (ok.cancelled) {
          this.reset();
          return;
        }
        if (ok.duplicate) {
          this.setComplete();
          return;
        }
        this.setError();
      }
    } catch (error) {
      console.error('[YT2PP] Video action failed:', error);
      this.setError();
    }
  }

  setProgress(status: DownloadProgressState) {
    if (!this.isActive) return;
    const parsed = Number.parseFloat(String(status.percentage ?? ''));
    if (Number.isFinite(parsed)) {
      this.progress = Math.max(this.progress, Math.min(parsed, 100));
    }
    this.isIndeterminate = Boolean(status.indeterminate);
    this.progressLabel = getProgressLabel(status, this.progress);
    this.state = this.isIndeterminate ? 'loading' : 'progress';
    this.render();
  }

  setComplete() {
    if (!this.isActive) return;
    if (this.activeRequestId) {
      this.activeRequestId = null;
    }
    this.state = 'complete';
    this.progress = 100;
    this.progressLabel = '100%';
    this.isIndeterminate = false;
    this.render();
    setTimeout(() => this.reset(), 1400);
  }

  setError() {
    if (!this.isActive) return;
    if (this.activeRequestId) {
      this.activeRequestId = null;
    }
    this.state = 'error';
    this.isActive = false;
    this.progress = Math.max(this.progress, this.isIndeterminate ? 0 : 18);
    this.progressLabel = 'Error';
    this.isIndeterminate = true;
    this.render();
    setTimeout(() => this.reset(), 3000);
  }

  dispose() {
    if (this.activeRequestId) {
      unsubscribeFromDownload(this.activeRequestId);
      this.activeRequestId = null;
    }
    this.reset();
  }

  private reset() {
    this.isActive = false;
    this.state = 'idle';
    this.progress = 0;
    this.progressLabel = '';
    this.isIndeterminate = false;
    this.render();
  }
}
