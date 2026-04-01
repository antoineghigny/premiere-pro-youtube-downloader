import { getVideoElement } from '../utils/pageUtils';
import { DownloadButton } from './downloadBtn';
import { AudioButton } from './audioBtn';
import { ClipMarkers } from './clipMarkers';
import { ClipButton } from './clipBtn';
import { ClipOverlay } from './clipOverlay';
import { getSocket, setProgressCallbacks } from '../api/serverApi';

export class ControlBar {
  private container: HTMLDivElement;
  private downloadBtn: DownloadButton;
  private audioBtn: AudioButton;
  private clipMarkers: ClipMarkers;
  private clipBtn: ClipButton;
  private clipOverlay: ClipOverlay;
  private attached = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'yt2pp-controls';

    this.clipOverlay = new ClipOverlay();

    this.downloadBtn = new DownloadButton();
    this.audioBtn = new AudioButton();
    this.clipMarkers = new ClipMarkers((inTime, outTime) => {
      this.clipBtn.updateMarkers(inTime, outTime);
      this.clipOverlay.update(inTime, outTime, this.getVideoDuration());
    });
    this.clipBtn = new ClipButton(() => this.clipMarkers.reset());

    // Build: [Download] [Audio] | [IN] [OUT] [CLIP]
    this.container.appendChild(this.downloadBtn.getElement());
    this.container.appendChild(this.audioBtn.getElement());

    // Separator between download group and clip group
    const sep = document.createElement('div');
    sep.className = 'yt2pp-separator';
    this.container.appendChild(sep);

    this.container.appendChild(this.clipMarkers.getInElement());
    this.container.appendChild(this.clipMarkers.getOutElement());
    this.container.appendChild(this.clipBtn.getElement());

    // Initialize socket connection
    getSocket();

    // Set up progress callbacks
    setProgressCallbacks(
      (pct) => {
        this.downloadBtn.setProgress(pct);
        this.audioBtn.setProgress(pct);
        this.clipBtn.setProgress(pct);
      },
      () => {
        this.downloadBtn.setComplete();
        this.audioBtn.setComplete();
        this.clipBtn.setComplete();
      },
      (msg) => {
        console.error('[YT2PP] Download failed:', msg);
        this.downloadBtn.setError();
        this.audioBtn.setError();
        this.clipBtn.setError();
      }
    );
  }

  private getVideoDuration(): number {
    const video = getVideoElement();
    return video ? video.duration : 0;
  }

  private getRightControls(): HTMLElement | null {
    // Inject into .ytp-right-controls (next to settings, fullscreen, etc.)
    // Avoid preview player controls
    const allControls = document.querySelectorAll('.ytp-right-controls');
    for (const el of allControls) {
      if (el.closest('#inline-preview-player') || el.closest('.ytp-preview')) continue;
      return el as HTMLElement;
    }
    return null;
  }

  attach() {
    const controls = this.getRightControls();
    if (controls && !controls.contains(this.container)) {
      // Insert at the BEGINNING of right controls (leftmost position in that group)
      controls.insertBefore(this.container, controls.firstChild);
      this.clipOverlay.attach();
      this.attached = true;
    }
  }

  detach() {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.clipOverlay.detach();
    this.clipMarkers.reset();
    this.attached = false;
  }

  ensureAttached() {
    if (!this.attached) return;
    const controls = this.getRightControls();
    if (controls && !controls.contains(this.container)) {
      controls.insertBefore(this.container, controls.firstChild);
      this.clipOverlay.attach();
    }
  }
}
