import '../styles/popup.css';
import { BACKEND_URL } from '../config';

function getAudioOnlyCheckbox() {
  return document.getElementById('audioOnly') as HTMLInputElement;
}

function getVideoOnlyCheckbox() {
  return document.getElementById('videoOnly') as HTMLInputElement;
}

async function checkStatus() {
  const dot = document.getElementById('status-dot')!;
  try {
    const res = await fetch(BACKEND_URL, { signal: AbortSignal.timeout(3000) });
    dot.className = res.ok ? 'status-dot online' : 'status-dot offline';
  } catch {
    dot.className = 'status-dot offline';
  }
}

function loadSettings() {
  chrome.storage.sync.get(
    {
      resolution: '1080',
      downloadPath: '',
      audioOnly: false,
      downloadMP3: false,
      videoOnly: false,
      secondsBefore: '15',
      secondsAfter: '15',
    },
    (items: Record<string, any>) => {
      const audioOnly = Boolean(items.audioOnly ?? items.downloadMP3);
      (document.getElementById('resolution') as HTMLSelectElement).value = items.resolution;
      (document.getElementById('downloadPath') as HTMLInputElement).value = items.downloadPath;
      getAudioOnlyCheckbox().checked = audioOnly;
      getVideoOnlyCheckbox().checked = Boolean(items.videoOnly) && !audioOnly;
      (document.getElementById('secondsBefore') as HTMLInputElement).value = items.secondsBefore;
      (document.getElementById('secondsAfter') as HTMLInputElement).value = items.secondsAfter;
    }
  );
}

function saveSettings() {
  const audioOnly = getAudioOnlyCheckbox().checked;
  const settings = {
    resolution: (document.getElementById('resolution') as HTMLSelectElement).value,
    downloadPath: (document.getElementById('downloadPath') as HTMLInputElement).value,
    audioOnly,
    downloadMP3: audioOnly,
    videoOnly: getVideoOnlyCheckbox().checked && !audioOnly,
    secondsBefore: (document.getElementById('secondsBefore') as HTMLInputElement).value,
    secondsAfter: (document.getElementById('secondsAfter') as HTMLInputElement).value,
  };

  chrome.storage.sync.set(settings, () => {
    // Also sync to backend
    fetch(`${BACKEND_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch(() => {});

    const btn = document.getElementById('save-btn')!;
    btn.textContent = 'Saved!';
    setTimeout(() => (btn.textContent = 'Save Settings'), 1500);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  getAudioOnlyCheckbox().addEventListener('change', () => {
    if (getAudioOnlyCheckbox().checked) {
      getVideoOnlyCheckbox().checked = false;
    }
  });

  getVideoOnlyCheckbox().addEventListener('change', () => {
    if (getVideoOnlyCheckbox().checked) {
      getAudioOnlyCheckbox().checked = false;
    }
  });

  checkStatus();
  loadSettings();
  document.getElementById('save-btn')!.addEventListener('click', saveSettings);
  setInterval(checkStatus, 5000);
});
