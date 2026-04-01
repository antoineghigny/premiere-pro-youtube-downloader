export function getPlayerControls(): HTMLElement | null {
  // Get the main player's left controls, avoiding preview player
  const players = document.querySelectorAll('.ytp-left-controls');
  for (const player of players) {
    // Skip inline preview player controls
    if (player.closest('#inline-preview-player') || player.closest('.ytp-preview')) {
      continue;
    }
    return player as HTMLElement;
  }
  return null;
}

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
}

export function getProgressBar(): HTMLElement | null {
  const bars = document.querySelectorAll('.ytp-progress-bar');
  for (const bar of bars) {
    if (bar.closest('#inline-preview-player') || bar.closest('.ytp-preview')) {
      continue;
    }
    return bar as HTMLElement;
  }
  return null;
}

export function isVideoPage(): boolean {
  return window.location.pathname === '/watch' && new URLSearchParams(window.location.search).has('v');
}

export function getVideoId(): string | null {
  return new URLSearchParams(window.location.search).get('v');
}

export function getVideoUrl(): string | null {
  const videoId = getVideoId();
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}
