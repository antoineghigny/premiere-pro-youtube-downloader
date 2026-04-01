import { getVideoElement } from '../utils/pageUtils';
import { formatTime } from '../utils/timeUtils';

// Material Design "first_page" icon (vertical bar + left chevron = "jump to start")
const ICON_IN = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"/></svg>`;
// Material Design "last_page" icon (vertical bar + right chevron = "jump to end")
const ICON_OUT = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/></svg>`;

export class ClipMarkers {
  private inBtn: HTMLButtonElement;
  private outBtn: HTMLButtonElement;
  private inTime: number | null = null;
  private outTime: number | null = null;
  private onChange: (inTime: number | null, outTime: number | null) => void;

  constructor(onChange: (inTime: number | null, outTime: number | null) => void) {
    this.onChange = onChange;

    this.inBtn = document.createElement('button');
    this.inBtn.className = 'ytp-button yt2pp-btn yt2pp-in-btn';
    this.inBtn.addEventListener('click', () => this.setIn());

    this.outBtn = document.createElement('button');
    this.outBtn.className = 'ytp-button yt2pp-btn yt2pp-out-btn';
    this.outBtn.addEventListener('click', () => this.setOut());

    this.renderButton(this.inBtn, ICON_IN, 'Set clip IN point');
    this.renderButton(this.outBtn, ICON_OUT, 'Set clip OUT point');
  }

  getInElement(): HTMLButtonElement {
    return this.inBtn;
  }

  getOutElement(): HTMLButtonElement {
    return this.outBtn;
  }

  getInTime(): number | null {
    return this.inTime;
  }

  getOutTime(): number | null {
    return this.outTime;
  }

  private renderButton(button: HTMLButtonElement, icon: string, tooltip: string) {
    button.title = tooltip;
    button.innerHTML = `
      <span class="yt2pp-btn-surface">
        ${icon}
      </span>
      <div class="yt2pp-tooltip">${tooltip}</div>
    `;
  }

  private setIn() {
    const video = getVideoElement();
    if (!video) return;
    this.inTime = video.currentTime;
    this.inBtn.classList.add('yt2pp-marker-set');
    this.renderButton(this.inBtn, ICON_IN, `IN: ${formatTime(this.inTime)}`);
    this.onChange(this.inTime, this.outTime);
  }

  private setOut() {
    const video = getVideoElement();
    if (!video) return;
    this.outTime = video.currentTime;
    this.outBtn.classList.add('yt2pp-marker-set');
    this.renderButton(this.outBtn, ICON_OUT, `OUT: ${formatTime(this.outTime)}`);
    this.onChange(this.inTime, this.outTime);
  }

  reset() {
    this.inTime = null;
    this.outTime = null;
    this.inBtn.classList.remove('yt2pp-marker-set');
    this.outBtn.classList.remove('yt2pp-marker-set');
    this.renderButton(this.inBtn, ICON_IN, 'Set clip IN point');
    this.renderButton(this.outBtn, ICON_OUT, 'Set clip OUT point');
    this.onChange(null, null);
  }
}
