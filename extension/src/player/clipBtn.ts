import { getVideoUrl } from '../utils/pageUtils';
import { sendDownloadRequest } from '../api/serverApi';
import { formatDuration } from '../utils/timeUtils';

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
      : Math.max(0, Math.min(100, this.progress)) / 100;
    const showProgressLabel = this.state === 'loading' || this.state === 'progress' || this.state === 'complete';
    const progressLabel = `${Math.max(0, Math.round(this.progress))}%`;

    this.element.classList.toggle('yt2pp-busy', this.state === 'loading' || this.state === 'progress');
    this.element.classList.toggle('yt2pp-complete', this.state === 'complete');
    this.element.classList.toggle('yt2pp-error', this.state === 'error');
    this.element.classList.toggle('yt2pp-show-progress', showProgressLabel);

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

    this.isActive = true;
    this.state = 'loading';
    this.progress = 4;
    this.render();

    chrome.storage.sync.get({ videoOnly: false, resolution: '1080', downloadPath: '' }, async (items) => {
      const ok = await sendDownloadRequest({
        videoUrl: url,
        downloadType: 'clip',
        audioOnly: false,
        clipIn: Math.min(this.inTime!, this.outTime!),
        clipOut: Math.max(this.inTime!, this.outTime!),
        videoOnly: items.videoOnly as boolean,
        resolution: items.resolution as string,
        downloadPath: items.downloadPath as string,
      });
      if (!ok) {
        this.setError();
      }
    });
  }

  setProgress(pct: string) {
    if (!this.isActive) return;
    const parsed = Number.parseFloat(pct);
    if (Number.isFinite(parsed)) {
      this.progress = Math.max(this.progress, Math.min(parsed, 100));
    }
    this.state = 'progress';
    this.render();
  }

  setComplete() {
    if (!this.isActive) return;
    this.state = 'complete';
    this.progress = 100;
    this.render();
    setTimeout(() => {
      this.isActive = false;
      this.progress = 0;
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
    this.state = 'error';
    this.isActive = false;
    this.progress = Math.max(this.progress, 18);
    this.render();
    setTimeout(() => {
      this.progress = 0;
      this.updateMarkers(this.inTime, this.outTime);
    }, 3000);
  }
}
