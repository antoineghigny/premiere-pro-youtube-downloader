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
import { formatDuration } from '../utils/timeUtils';
import { getProgressLabel } from './progressUi';

type ButtonState = 'disabled' | 'ready' | 'loading' | 'progress' | 'complete' | 'error';

// Reverting to Material-style scissors icon
const ICON_CLIP = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/></svg>`;

export class ClipButton {
  private element: HTMLButtonElement;
  private state: ButtonState = 'disabled';
  private inTime: number | null = null;
  private outTime: number | null = null;
  private isActive = false;
  private onComplete: () => void;
  private progress = 0;
  private progressLabel = '';
  private isIndeterminate = false;
  private activeRequestId: string | null = null;

  constructor(onComplete: () => void) {
    this.onComplete = onComplete;
    this.element = document.createElement('button');
    this.element.className = 'ytp-button yt2pp-btn yt2pp-clip-btn yt2pp-disabled';
    this.element.disabled = true;
    this.render();
    this.element.addEventListener('click', () => this.handleClick());
  }

  private render() {
    const tooltipText = this.inTime !== null && this.outTime !== null
      ? `Download Clip (${formatDuration(Math.min(this.inTime, this.outTime), Math.max(this.inTime, this.outTime))})`
      : 'Download Clip (set IN and OUT first)';

    const progressScale = this.state === 'disabled' || this.state === 'ready'
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
      ${ICON_CLIP}
      <div class="yt2pp-tooltip">${tooltipText}</div>
    `;
  }

  getElement(): HTMLButtonElement {
    return this.element;
  }

  updateMarkers(inTime: number | null, outTime: number | null) {
    this.inTime = inTime;
    this.outTime = outTime;

    if (inTime !== null && outTime !== null) {
      this.state = 'ready';
      this.element.disabled = false;
      this.element.classList.remove('yt2pp-disabled');
      this.element.classList.add('yt2pp-ready');
    } else {
      this.state = 'disabled';
      this.element.disabled = true;
      this.element.classList.add('yt2pp-disabled');
      this.element.classList.remove('yt2pp-ready');
    }
    this.render();
  }

  private async handleClick() {
    if (this.state !== 'ready' || this.isActive) return;
    if (this.inTime === null || this.outTime === null) return;

    const url = getVideoUrl();
    if (!url) return;

    try {
      const settings = await getExtensionSettings();
      let downloadPath = String(settings.downloadPath ?? '').trim();
      if (settings.askDownloadPathEachTime) {
        const pickedPath = await pickDownloadFolder(
          'Choose folder for clip downloads',
          downloadPath,
        );
        if (!pickedPath) {
          this.progress = 0;
          this.progressLabel = '';
          this.isIndeterminate = false;
          this.updateMarkers(this.inTime, this.outTime);
          this.isActive = false;
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
          console.error('[YT2PP] Clip download failed:', msg);
          this.setError();
        },
      });

      const ok = await sendDownloadRequest({
        requestId,
        videoUrl: url,
        downloadType: 'clip',
        clipIn: Math.min(this.inTime!, this.outTime!),
        clipOut: Math.max(this.inTime!, this.outTime!),
        videoOnly,
        resolution: settings.resolution,
        downloadPath,
      });
      if (!ok) {
        unsubscribeFromDownload(requestId);
        if (this.activeRequestId === requestId) {
          this.activeRequestId = null;
        }
        this.setError();
      }
    } catch (error) {
      console.error('[YT2PP] Clip action failed:', error);
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
    setTimeout(() => {
      this.isActive = false;
      this.progress = 0;
      this.progressLabel = '';
      this.isIndeterminate = false;
      this.inTime = null;
      this.outTime = null;
      this.state = 'disabled';
      this.element.disabled = true;
      this.element.classList.add('yt2pp-disabled');
      this.element.classList.remove('yt2pp-ready');
      this.render();
      this.onComplete();
    }, 1400);
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
    setTimeout(() => {
      this.progress = 0;
      this.progressLabel = '';
      this.isIndeterminate = false;
      this.updateMarkers(this.inTime, this.outTime);
    }, 3000);
  }

  dispose() {
    if (this.activeRequestId) {
      unsubscribeFromDownload(this.activeRequestId);
      this.activeRequestId = null;
    }
    this.isActive = false;
    this.progress = 0;
    this.progressLabel = '';
    this.isIndeterminate = false;
    this.updateMarkers(this.inTime, this.outTime);
  }
}
