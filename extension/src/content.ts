import './styles/content.css';
import { ControlBar } from './player/controlBar';

let controlBar: ControlBar | null = null;
let lastUrl = '';
let checkInterval: ReturnType<typeof setInterval> | null = null;

function isVideoPage(): boolean {
  return window.location.pathname === '/watch' && new URLSearchParams(window.location.search).has('v');
}

function getVideoId(): string | null {
  return new URLSearchParams(window.location.search).get('v');
}

function init() {
  if (isVideoPage()) {
    if (!controlBar) {
      controlBar = new ControlBar();
    }
    controlBar.attach();
  } else {
    if (controlBar) {
      controlBar.detach();
      controlBar = null;
    }
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

// Initial setup
lastUrl = window.location.href;
init();

// Poll for URL changes (YouTube SPA navigation)
checkInterval = setInterval(checkUrlChange, 500);

// Also observe DOM mutations for YouTube's dynamic content loading
const observer = new MutationObserver(() => {
  if (isVideoPage() && controlBar) {
    controlBar.ensureAttached();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
