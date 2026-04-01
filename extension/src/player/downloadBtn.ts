import { getVideoUrl } from '../utils/pageUtils';
import { sendDownloadRequest } from '../api/serverApi';

type ButtonState = 'idle' | 'loading' | 'progress' | 'complete' | 'error';

// YouTube style download icon
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24"><path d="M17 18V19H7V18H17ZM16.5 11.4L15.8 10.7L12.5 13.9V5H11.5V13.9L8.2 10.7L7.5 11.4L12 15.9L16.5 11.4Z"/></svg>`;

export class DownloadButton {
  private element: HTMLButtonElement;
  private state: ButtonState = 'idle';
  private isActive = false;
  private progress = 0;

  constructor() {
    this.element = document.createElement('button');
    this.element.className = 'ytp-button yt2pp-btn yt2pp-download-btn';
    this.element.title = 'Download Video';
    this.render();
    this.element.addEventListener('click', () => this.handleClick());
  }

  private render() {
    const progressScale = this.state === 'idle' ? 0 : Math.max(0, Math.min(100, this.progress)) / 100;
    this.element.classList.toggle('yt2pp-busy', this.state === 'loading' || this.state === 'progress');
    this.element.classList.toggle('yt2pp-complete', this.state === 'complete');
    this.element.classList.toggle('yt2pp-error', this.state === 'error');

    this.element.innerHTML = `
      <span class="yt2pp-btn-progress-fill" style="transform: scaleX(${progressScale.toFixed(4)})"></span>
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

    this.isActive = true;
    this.state = 'loading';
    this.progress = 12;
    this.render();

    chrome.storage.sync.get({ videoOnly: false, resolution: '1080', downloadPath: '' }, async (items) => {
      const ok = await sendDownloadRequest({
        videoUrl: url,
        downloadType: 'full',
        audioOnly: false,
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
    setTimeout(() => this.reset(), 2000);
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
