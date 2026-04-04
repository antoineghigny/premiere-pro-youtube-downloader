import '../styles/popup.css';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../api/contracts';
import { initLanguage, setLanguage, t } from '../i18n';

type RuntimeResponse = {
  healthy?: boolean;
};

let currentSettings: ExtensionSettings = { ...DEFAULT_SETTINGS };

function getVideoOnlyCheckbox() {
  return document.getElementById('videoOnly') as HTMLInputElement;
}

function getAskDownloadPathEachTimeCheckbox() {
  return document.getElementById('askDownloadPathEachTime') as HTMLInputElement;
}

function getDownloadPathInput() {
  return document.getElementById('downloadPath') as HTMLInputElement;
}

function getOutputTargetSelect() {
  return document.getElementById('outputTarget') as HTMLSelectElement;
}

function syncToggleOptionStyles() {
  document.querySelectorAll<HTMLElement>('[data-toggle-option]').forEach((option) => {
    const input = option.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    option.classList.toggle('is-selected', Boolean(input?.checked));
  });
}

/** Apply translations to all elements with data-i18n / data-i18n-placeholder attributes. */
function applyTranslations() {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      (el as HTMLInputElement).placeholder = t(key);
    }
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
    const response = await sendRuntimeMessage<RuntimeResponse>({ type: 'CHECK_BACKEND_HEALTH' });
    dot.className = response.healthy ? 'status-dot online' : 'status-dot offline';
  } catch {
    dot.className = 'status-dot offline';
  }
}

async function loadSettings() {
  const items = await sendRuntimeMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  currentSettings = {
    ...DEFAULT_SETTINGS,
    ...items,
  };

  // Apply language from settings
  if (currentSettings.language) {
    setLanguage(currentSettings.language);
    applyTranslations();
  }

  (document.getElementById('resolution') as HTMLSelectElement).value = currentSettings.resolution;
  getDownloadPathInput().value = currentSettings.downloadPath;
  getOutputTargetSelect().value = currentSettings.outputTarget;
  getVideoOnlyCheckbox().checked = Boolean(currentSettings.videoOnly);
  getAskDownloadPathEachTimeCheckbox().checked = Boolean(currentSettings.askDownloadPathEachTime);
  syncToggleOptionStyles();
}

async function saveSettings() {
  currentSettings = {
    ...currentSettings,
    resolution: (document.getElementById('resolution') as HTMLSelectElement).value,
    downloadPath: getDownloadPathInput().value.trim(),
    outputTarget: getOutputTargetSelect().value as ExtensionSettings['outputTarget'],
    videoOnly: getVideoOnlyCheckbox().checked,
    askDownloadPathEachTime: getAskDownloadPathEachTimeCheckbox().checked,
  };

  await sendRuntimeMessage<{ success?: boolean }>({ type: 'SAVE_SETTINGS', settings: currentSettings });

  const btn = document.getElementById('save-btn')!;
  const span = btn.querySelector('span[data-i18n]') ?? btn;
  span.textContent = t('popup.saved');
  setTimeout(() => (span.textContent = t('popup.saveSettings')), 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  getVideoOnlyCheckbox().addEventListener('change', syncToggleOptionStyles);
  getAskDownloadPathEachTimeCheckbox().addEventListener('change', syncToggleOptionStyles);

  // Initialize language, then translate the popup
  void initLanguage().then(() => applyTranslations());

  void checkStatus();
  void loadSettings().catch(() => {
    currentSettings = { ...DEFAULT_SETTINGS };
    (document.getElementById('resolution') as HTMLSelectElement).value = DEFAULT_SETTINGS.resolution;
    getDownloadPathInput().value = DEFAULT_SETTINGS.downloadPath;
    getOutputTargetSelect().value = DEFAULT_SETTINGS.outputTarget;
    getVideoOnlyCheckbox().checked = DEFAULT_SETTINGS.videoOnly;
    getAskDownloadPathEachTimeCheckbox().checked = DEFAULT_SETTINGS.askDownloadPathEachTime;
    syncToggleOptionStyles();
  });
  document.getElementById('save-btn')!.addEventListener('click', () => {
    void saveSettings();
  });
  setInterval(() => {
    void checkStatus();
  }, 5000);
});
