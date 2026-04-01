import { getVideoUrl } from '../utils/pageUtils';
import { sendDownloadRequest } from '../api/serverApi';

type ButtonState = 'idle' | 'loading' | 'progress' | 'complete' | 'error';

// YouTube style music icon
const ICON_AUDIO = `<svg viewBox="0 0 24 24"><path d="M15,3l-9,2v12.2C5.4,17.1,4.7,17,4,17c-2.2,0-4,1.8-4,4s1.8,4,4,4s4-1.8,4-4V7l7-1.6V12.2c-0.6-0.1-1.3-0.2-2-0.2 c-2.2,0-4,1.8-4,4s1.8,4,4,4s4-1.8,4-4V3L15,3z"/></svg>`;

export class AudioButton {
  private element: HTMLButtonElement;
  private state: ButtonState = 'idle';
  private isActive = false;
  private progress = 0;

  constructor() {
    this.element = document.createElement('button');
    this.element.className = 'ytp-button yt2pp-btn yt2pp-audio-btn';
    this.element.title = 'Download Audio';
    this.render();
    this.element.addEventListener('click', () => this.handleClick());
  }

  private render() {
    const progressScale = this.state === 'idle' ? 0 : Math.max(0, Math.min(100, this.progress)) / 100;
    const showProgressLabel = this.state === 'loading' || this.state === 'progress' || this.state === 'complete';
    const progressLabel = `${Math.max(0, Math.round(this.progress))}%`;

    this.element.classList.toggle('yt2pp-busy', this.state === 'loading' || this.state === 'progress');
    this.element.classList.toggle('yt2pp-complete', this.state === 'complete');
    this.element.classList.toggle('yt2pp-error', this.state === 'error');
    this.element.classList.toggle('yt2pp-show-progress', showProgressLabel);

    this.element.innerHTML = `
      <span class="yt2pp-btn-surface">
        <span class="yt2pp-btn-progress-fill" style="transform: scaleX(${progressScale.toFixed(4)})"></span>
        ${showProgressLabel ? `<span class="yt2pp-btn-progress-label">${progressLabel}</span>` : ''}
        ${ICON_AUDIO}
      </span>
      <div class="yt2pp-tooltip">Download Audio</div>
    `;
  }

  getElement(): HTMLButtonElement {
    return this.element;
  }

  private async handleClick() {
    if (this.isActive) return;
    const url = getVideoUrl();
    if (!url) return;

    this.isActive = true;
    this.state = 'loading';
    this.progress = 4;
    this.render();

    chrome.storage.sync.get({ downloadPath: '' }, async (items) => {
      const ok = await sendDownloadRequest({
        videoUrl: url,
        downloadType: 'audio',
        audioOnly: true,
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
    setTimeout(() => this.reset(), 1400);
  }

  setError() {
    if (!this.isActive) return;
    this.state = 'error';
    this.isActive = false;
    this.progress = Math.max(this.progress, 18);
    this.render();
    setTimeout(() => this.reset(), 3000);
  }

  private reset() {
    this.isActive = false;
    this.state = 'idle';
    this.progress = 0;
    this.render();
  }
}
