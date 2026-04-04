type TranslationMap = Record<string, string>;

const en: TranslationMap = {
  // Popup
  'popup.resolution': 'Resolution',
  'popup.videoClipPath': 'Video / Clip folder',
  'popup.downloadPathPlaceholder': 'Default folder',
  'popup.sendDownloadsTo': 'Destination',
  'popup.downloadsFolder': 'Downloads',
  'popup.premiereProject': 'Premiere project',
  'popup.videoOnly': 'Video Only',
  'popup.videoOnlyMeta': 'Skip audio for video and clip downloads',
  'popup.askFolder': 'Ask every time',
  'popup.askFolderMeta': 'Open the folder picker before each download',
  'popup.saveSettings': 'Save Settings',
  'popup.saved': 'Saved!',

  // Player buttons
  'player.downloadVideo': 'Download Video',
  'player.downloadAudio': 'Download Audio',
  'player.downloadClip': 'Download Clip',
  'player.clipSetInOut': 'Download Clip (set IN and OUT first)',
  'player.setIn': 'Set clip IN point',
  'player.setOut': 'Set clip OUT point',
  'player.prep': 'Prep',
  'player.error': 'Error',

  // Stage labels
  'stage.preparing': 'Prep',
  'stage.resolving': 'Resolve',
  'stage.downloading': 'DL',
  'stage.clipping': 'Clip',
  'stage.importing': 'Import',
  'stage.complete': 'Done',
  'stage.failed': 'Error',
  'stage.wait': 'Wait',

  // Folder picker
  'folder.video': 'Choose folder for video downloads',
  'folder.audio': 'Choose folder for audio downloads',
  'folder.clip': 'Choose folder for clip downloads',
  'folder.download': 'Choose a folder for this download',
};

const fr: TranslationMap = {
  // Popup
  'popup.resolution': 'Résolution',
  'popup.videoClipPath': 'Dossier vidéo / clip',
  'popup.downloadPathPlaceholder': 'Dossier par défaut',
  'popup.sendDownloadsTo': 'Destination',
  'popup.downloadsFolder': 'Téléchargements',
  'popup.premiereProject': 'Projet Premiere',
  'popup.videoOnly': 'Vidéo seule',
  'popup.videoOnlyMeta': 'Sans audio pour les vidéos et les clips',
  'popup.askFolder': 'Choisir à chaque fois',
  'popup.askFolderMeta': 'Ouvrir le sélecteur avant chaque téléchargement',
  'popup.saveSettings': 'Enregistrer',
  'popup.saved': 'Enregistré !',

  // Player buttons
  'player.downloadVideo': 'Télécharger la vidéo',
  'player.downloadAudio': 'Télécharger l’audio',
  'player.downloadClip': 'Télécharger le clip',
  'player.clipSetInOut': 'Télécharger le clip (définir IN et OUT)',
  'player.setIn': 'Définir le point IN',
  'player.setOut': 'Définir le point OUT',
  'player.prep': 'Prép.',
  'player.error': 'Erreur',

  // Stage labels
  'stage.preparing': 'Prép.',
  'stage.resolving': 'Résol.',
  'stage.downloading': 'DL',
  'stage.clipping': 'Clip',
  'stage.importing': 'Import',
  'stage.complete': 'Fini',
  'stage.failed': 'Erreur',
  'stage.wait': 'Attente',

  // Folder picker
  'folder.video': 'Choisir le dossier des vidéos',
  'folder.audio': 'Choisir le dossier audio',
  'folder.clip': 'Choisir le dossier des clips',
  'folder.download': 'Choisir un dossier pour ce téléchargement',
};

const locales: Record<string, TranslationMap> = { en, fr };

let currentLang = 'en';

export function setLanguage(lang: string): void {
  currentLang = locales[lang] ? lang : 'en';
}

export function getLanguage(): string {
  return currentLang;
}

export function t(key: string): string {
  return locales[currentLang]?.[key] ?? en[key] ?? key;
}

export async function initLanguage(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(['language']);
    const lang = String(result.language ?? '');
    if (lang && locales[lang]) {
      currentLang = lang;
      return;
    }
  } catch {
    // Storage not available (e.g. in content script context) - detect from browser.
  }

  const browserLang = (navigator.language || '').split('-')[0].toLowerCase();
  if (locales[browserLang]) {
    currentLang = browserLang;
  }
}
