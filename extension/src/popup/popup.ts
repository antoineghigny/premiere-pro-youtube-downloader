import '../styles/popup.css';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../api/contracts';

function getAudioOnlyCheckbox() {
  return document.getElementById('audioOnly') as HTMLInputElement;
}

function getVideoOnlyCheckbox() {
  return document.getElementById('videoOnly') as HTMLInputElement;
}

function syncToggleOptionStyles() {
  document.querySelectorAll<HTMLElement>('[data-toggle-option]').forEach((option) => {
    const input = option.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    option.classList.toggle('is-selected', Boolean(input?.checked));
  });
}

function sendRuntimeMessage<T>(message: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve((response ?? {}) as T);
    });
  });
}

async function checkStatus() {
  const dot = document.getElementById('status-dot')!;

  try {
    const response = await sendRuntimeMessage<{ healthy?: boolean }>({ type: 'CHECK_BACKEND_HEALTH' });
    dot.className = response.healthy ? 'status-dot online' : 'status-dot offline';
  } catch {
    dot.className = 'status-dot offline';
  }
}

async function loadSettings() {
  const items = await sendRuntimeMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  const audioOnly = Boolean(items.audioOnly ?? items.downloadMP3);

  (document.getElementById('resolution') as HTMLSelectElement).value = items.resolution;
  (document.getElementById('downloadPath') as HTMLInputElement).value = items.downloadPath;
  getAudioOnlyCheckbox().checked = audioOnly;
  getVideoOnlyCheckbox().checked = Boolean(items.videoOnly) && !audioOnly;
  (document.getElementById('secondsBefore') as HTMLInputElement).value = items.secondsBefore;
  (document.getElementById('secondsAfter') as HTMLInputElement).value = items.secondsAfter;
  syncToggleOptionStyles();
}

async function saveSettings() {
  const audioOnly = getAudioOnlyCheckbox().checked;
  const settings: ExtensionSettings = {
    resolution: (document.getElementById('resolution') as HTMLSelectElement).value,
    downloadPath: (document.getElementById('downloadPath') as HTMLInputElement).value,
    audioOnly,
    downloadMP3: audioOnly,
    videoOnly: getVideoOnlyCheckbox().checked && !audioOnly,
    secondsBefore: (document.getElementById('secondsBefore') as HTMLInputElement).value,
    secondsAfter: (document.getElementById('secondsAfter') as HTMLInputElement).value,
  };

  await sendRuntimeMessage<{ success?: boolean }>({ type: 'SAVE_SETTINGS', settings });

  const btn = document.getElementById('save-btn')!;
  btn.textContent = 'Saved!';
  setTimeout(() => (btn.textContent = 'Save Settings'), 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  getAudioOnlyCheckbox().addEventListener('change', () => {
    if (getAudioOnlyCheckbox().checked) {
      getVideoOnlyCheckbox().checked = false;
    }
    syncToggleOptionStyles();
  });

  getVideoOnlyCheckbox().addEventListener('change', () => {
    if (getVideoOnlyCheckbox().checked) {
      getAudioOnlyCheckbox().checked = false;
    }
    syncToggleOptionStyles();
  });

  void checkStatus();
  void loadSettings().catch(() => {
    const audioOnly = DEFAULT_SETTINGS.audioOnly;
    (document.getElementById('resolution') as HTMLSelectElement).value = DEFAULT_SETTINGS.resolution;
    (document.getElementById('downloadPath') as HTMLInputElement).value = DEFAULT_SETTINGS.downloadPath;
    getAudioOnlyCheckbox().checked = audioOnly;
    getVideoOnlyCheckbox().checked = DEFAULT_SETTINGS.videoOnly && !audioOnly;
    (document.getElementById('secondsBefore') as HTMLInputElement).value = DEFAULT_SETTINGS.secondsBefore;
    (document.getElementById('secondsAfter') as HTMLInputElement).value = DEFAULT_SETTINGS.secondsAfter;
    syncToggleOptionStyles();
  });
  document.getElementById('save-btn')!.addEventListener('click', () => {
    void saveSettings();
  });
  setInterval(() => {
    void checkStatus();
  }, 5000);
});
