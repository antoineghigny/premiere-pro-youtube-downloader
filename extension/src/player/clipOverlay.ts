import { getProgressBar, getVideoElement } from '../utils/pageUtils';
import { formatDuration } from '../utils/timeUtils';

export class ClipOverlay {
  private overlay: HTMLDivElement;
  private inMarker: HTMLDivElement;
  private outMarker: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private inTime: number | null = null;
  private outTime: number | null = null;
  private duration: number = 0;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'yt2pp-clip-overlay';

    this.inMarker = document.createElement('div');
    this.inMarker.className = 'yt2pp-clip-marker yt2pp-clip-marker-in';

    this.outMarker = document.createElement('div');
    this.outMarker.className = 'yt2pp-clip-marker yt2pp-clip-marker-out';

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'yt2pp-clip-tooltip';
    this.overlay.appendChild(this.tooltip);

    this.overlay.addEventListener('mouseenter', () => {
      if (this.inTime !== null && this.outTime !== null) {
        this.tooltip.style.display = 'block';
      }
    });
    this.overlay.addEventListener('mouseleave', () => {
      this.tooltip.style.display = 'none';
    });
  }

  attach() {
    const progressBar = getProgressBar();
    if (progressBar && !progressBar.contains(this.overlay)) {
      progressBar.style.position = 'relative';
      progressBar.appendChild(this.overlay);
      progressBar.appendChild(this.inMarker);
      progressBar.appendChild(this.outMarker);
    }
  }

  detach() {
    this.overlay.remove();
    this.inMarker.remove();
    this.outMarker.remove();
  }

  update(inTime: number | null, outTime: number | null, duration: number) {
    this.inTime = inTime;
    this.outTime = outTime;
    this.duration = duration;

    if (duration <= 0) {
      this.hide();
      return;
    }

    if (inTime !== null) {
      const leftPct = (inTime / duration) * 100;
      this.inMarker.style.left = `${leftPct}%`;
      this.inMarker.style.display = 'block';
    } else {
      this.inMarker.style.display = 'none';
    }

    if (outTime !== null) {
      const leftPct = (outTime / duration) * 100;
      this.outMarker.style.left = `${leftPct}%`;
      this.outMarker.style.display = 'block';
    } else {
      this.outMarker.style.display = 'none';
    }

    if (inTime !== null && outTime !== null) {
      const start = Math.min(inTime, outTime);
      const end = Math.max(inTime, outTime);
      const leftPct = (start / duration) * 100;
      const widthPct = ((end - start) / duration) * 100;
      this.overlay.style.left = `${leftPct}%`;
      this.overlay.style.width = `${widthPct}%`;
      this.overlay.style.display = 'block';
      this.tooltip.textContent = formatDuration(start, end);
    } else {
      this.overlay.style.display = 'none';
    }
  }

  private hide() {
    this.overlay.style.display = 'none';
    this.inMarker.style.display = 'none';
    this.outMarker.style.display = 'none';
  }
}
