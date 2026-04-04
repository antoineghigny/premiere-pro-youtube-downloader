const en = {
  // ── TitleBar ──────────────────────────────────────────────
  titleBar: {
    appName: 'YT2Premiere Desktop',
    subtitle: 'Download manager for desktop, browser, and Premiere',
    ready: 'Ready',
    offline: 'Offline',
    importReady: 'Import ready',
    premiereReady: '{name} ready',
    settings: 'Settings',
  },

  // ── MenuBar ───────────────────────────────────────────────
  menuBar: {
    filterPlaceholder: 'Filter title or URL...',
    clearCompleted: 'Clear completed',
    resetHistory: 'Reset history',
  },

  // ── StatusBar ─────────────────────────────────────────────
  statusBar: {
    downloads: 'downloads',
    active: 'active',
    done: 'done',
    errors: 'errors',
    queued: 'queued',
    queue: 'Queue',
    processed: '{percent}% processed',
    noDownloads: 'No downloads yet',
    legendDone: 'Green = done',
    legendDownloading: 'Blue = downloading',
    legendErrors: 'Red = errors',
  },

  // ── UrlBar ────────────────────────────────────────────────
  urlBar: {
    placeholder: 'Paste URL + Enter to queue...',
    toggleClip: 'Toggle clip mode',
    showExportOptions: 'Show export options',
    chooseFolder: 'Choose download folder',
    highest: 'Highest',
    queue: 'Queue',
    resolvingMetadata: 'Resolving metadata...',
    metadataUnavailable: 'Metadata unavailable',
    videoPreview: 'Video preview',
    pasteToPreview: 'Paste a supported URL to preview title and thumbnail',
    seconds: 'sec',
  },

  // ── FFmpegPanel ───────────────────────────────────────────
  ffmpegPanel: {
    original: 'Original',
    matchSource: 'Match source',
    auto: 'Auto',
    copyStream: 'Copy stream',
    loadPreset: 'Load preset',
    saveThumbnail: 'Save thumbnail',
    saveSubtitles: 'Save subtitles',
    subtitlesEn: 'Subtitles EN',
    subtitlesFr: 'Subtitles FR',
    subtitlesEs: 'Subtitles ES',
    addToPremiere: 'Add to Premiere',
    savePreset: 'Save preset',
  },

  // ── ClipPanel ─────────────────────────────────────────────
  clipPanel: {
    clipRange: 'Clip range',
  },

  // ── DownloadTable / Grid columns ─────────────────────────
  downloadTable: {
    thumb: 'Thumb',
    title: 'Title',
    progress: 'Progress',
    total: 'Total',
    speed: 'Speed',
    eta: 'ETA',
    elapsed: 'Elapsed',
    actions: 'Actions',
    emptyTitle: 'Paste a supported URL above to start downloading',
    emptyDescription: 'Paste a video link to start a download and track it here.',
  },

  downloadGrid: {
    emptyTitle: 'Nothing queued yet',
    emptyDescription:
      'Queue downloads from the URL bar to fill the board with live thumbnails, progress, and Premiere status.',
  },

  // ── DownloadRow / Card ────────────────────────────────────
  download: {
    ready: 'ready',
    failed: 'failed',
    running: 'running',
    working: 'Working...',
    openFile: 'Open file',
    availableWhenComplete: 'Available when the download is complete',
    open: 'Open',
    runningLabel: 'Running',
  },

  // ── Download stage labels ─────────────────────────────────
  stages: {
    preparing: 'Getting ready',
    resolving: 'Checking media',
    downloading: 'Downloading',
    clipping: 'Finalizing',
    importing: 'Adding to Premiere',
    complete: 'Ready',
    failed: 'Download failed',
  },

  availabilityStages: {
    preparing: 'Getting ready',
    resolving: 'Checking media',
    downloading: 'Downloading',
    clipping: 'Finalizing file',
    importing: 'Adding to Premiere',
    complete: 'Ready',
    failed: 'Download failed',
  },

  // ── PresetManager ─────────────────────────────────────────
  presetManager: {
    title: 'Saved presets',
    empty: 'No presets saved yet.',
  },

  // ── SettingsModal ─────────────────────────────────────────
  settings: {
    preferencesLabel: 'Preferences',
    desktopDefaults: 'Desktop defaults',
    defaultResolution: 'Default resolution',
    concurrentDownloads: 'Concurrent downloads',
    defaultDownloadFolder: 'Default folder',
    browse: 'Choose',
    defaultDestination: 'Default destination',
    downloadsFolder: 'Downloads',
    currentPremiereProject: 'Premiere project',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    language: 'Language',
    videoOnlyDefault: 'Video only by default',
    askDownloadPath: 'Ask download path each time',
    askAudioPath: 'Ask audio path each time',
    autoImportPremiere: 'Auto-import when Premiere is ready',
    appsBrowser: 'Apps & browser',
    premierePro: 'Premiere Pro',
    checkingPremiere: 'Checking Premiere setup...',
    premiereConflicts: 'Older Premiere panels were found. Clean them up, then restart Premiere.',
    premiereReady: 'Premiere is ready for one-click import.',
    premiereFinishSetup: 'Premiere was found. Add the panel to enable imports.',
    premiereNotFound: 'Premiere was not found on this computer.',
    refreshPremiereSetup: 'Reinstall panel',
    setupPremiere: 'Add to Premiere',
    openPanelFolder: 'Open folder',
    chromeExtension: 'Browser extension',
    checkingBrowser: 'Checking browser setup...',
    browserReady: 'The extension folder is ready for Chrome.',
    browserDetected: 'Prepare the folder, then load it in Chrome.',
    browserNotDetected: 'Prepare the folder, then load it in a Chromium browser.',
    openExtensionFolder: 'Open folder',
    prepareBrowserExtension: 'Add to Chrome',
    olderPanelsNeedCleanup: 'Older Premiere panels need cleanup',
    cepFolder: 'CEP folder',
    openFolder: 'Open',
    premiereActionReady: 'Premiere is ready. Open YT2Premiere from Window > Extensions (Legacy).',
    premiereActionConflicts: 'The panel was updated. Remove the older Premiere panels listed below, then restart Premiere.',
    browserActionReady: 'The extension folder is ready. In Chrome, enable Developer mode and load the folder that just opened.',
    cancel: 'Cancel',
    saveSettings: 'Save settings',
  },

  // ── App-level messages ────────────────────────────────────
  app: {
    invalidUrl: 'Enter a valid http(s) URL before queueing.',
    invalidClipRange: 'Enter a valid clip range before queueing.',
    presetNamePrompt: 'Preset name',
    couldNotPreparePremiere: 'Could not prepare Premiere',
    couldNotPrepareBrowser: 'Could not prepare the browser extension',
  },

  // ── Shared dropdown labels ────────────────────────────────
  dropdowns: {
    downloadsFolder: 'Downloads',
    premiereProject: 'Premiere project',
  },
} satisfies Translations;

export type TranslationLeaf = string;
export type TranslationNode = { [key: string]: TranslationLeaf | TranslationNode };
export type Translations = {
  titleBar: TranslationNode;
  menuBar: TranslationNode;
  statusBar: TranslationNode;
  urlBar: TranslationNode;
  ffmpegPanel: TranslationNode;
  clipPanel: TranslationNode;
  downloadTable: TranslationNode;
  downloadGrid: TranslationNode;
  download: TranslationNode;
  stages: TranslationNode;
  availabilityStages: TranslationNode;
  presetManager: TranslationNode;
  settings: TranslationNode;
  app: TranslationNode;
  dropdowns: TranslationNode;
};
export default en;
