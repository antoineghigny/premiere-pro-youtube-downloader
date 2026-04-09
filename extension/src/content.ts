import './styles/content.css';
import { initLanguage } from './i18n';
import { ControlBar } from './player/controlBar';
import { getVideoId, isVideoPage } from './utils/pageUtils';

let controlBar: ControlBar | null = null;
let lastUrl = '';
let lastVideoId: string | null = null;
let checkInterval: ReturnType<typeof setInterval> | null = null;

function init() {
  const currentVideoId = isVideoPage() ? getVideoId() : null;

  if (currentVideoId) {
    if (!controlBar || currentVideoId !== lastVideoId) {
      controlBar?.dispose();
      controlBar = new ControlBar();
      lastVideoId = currentVideoId;
    }
    controlBar.attach();
  } else {
    if (controlBar) {
      controlBar.dispose();
      controlBar = null;
    }
    lastVideoId = null;
  }
}

function checkUrlChange() {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // Small delay to let YouTube's SPA finish rendering
    setTimeout(init, 500);
  }
}

// Initialize i18n, then set up controls
void initLanguage().then(() => {
  lastUrl = window.location.href;
  init();
});

// Poll for URL changes (YouTube SPA navigation)
checkInterval = setInterval(checkUrlChange, 500);

// Also observe DOM mutations for YouTube's dynamic content loading
const observer = new MutationObserver(() => {
  if (isVideoPage() && controlBar) {
    controlBar.ensureAttached();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
