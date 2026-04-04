import type { Translations } from './en';

const fr: Translations = {
  titleBar: {
    appName: 'YT2Premiere Desktop',
    subtitle: 'Gestionnaire de téléchargement pour bureau, navigateur et Premiere',
    ready: 'Prêt',
    offline: 'Hors ligne',
    importReady: 'Import prêt',
    premiereReady: '{name} prêt',
    settings: 'Paramètres',
  },

  menuBar: {
    filterPlaceholder: 'Filtrer par titre ou URL…',
    clearCompleted: 'Effacer terminés',
    resetHistory: 'Réinitialiser l’historique',
  },

  statusBar: {
    downloads: 'téléchargements',
    active: 'actifs',
    done: 'terminés',
    errors: 'erreurs',
    queued: 'en attente',
    queue: 'File',
    processed: '{percent} % traité',
    noDownloads: 'Aucun téléchargement',
    legendDone: 'Vert = terminé',
    legendDownloading: 'Bleu = en cours',
    legendErrors: 'Rouge = erreurs',
  },

  urlBar: {
    placeholder: 'Coller une URL + Entrée pour ajouter…',
    toggleClip: 'Activer le mode clip',
    showExportOptions: 'Options d’export',
    chooseFolder: 'Choisir le dossier',
    highest: 'Maximale',
    queue: 'Ajouter',
    resolvingMetadata: 'Résolution des métadonnées…',
    metadataUnavailable: 'Métadonnées indisponibles',
    videoPreview: 'Aperçu vidéo',
    pasteToPreview: 'Collez une URL pour prévisualiser le titre et la miniature',
    seconds: 'sec',
  },

  ffmpegPanel: {
    original: 'Original',
    matchSource: 'Comme la source',
    auto: 'Auto',
    copyStream: 'Copie directe',
    loadPreset: 'Charger un préréglage',
    saveThumbnail: 'Enregistrer la miniature',
    saveSubtitles: 'Enregistrer les sous-titres',
    subtitlesEn: 'Sous-titres EN',
    subtitlesFr: 'Sous-titres FR',
    subtitlesEs: 'Sous-titres ES',
    addToPremiere: 'Ajouter à Premiere',
    savePreset: 'Enregistrer le préréglage',
  },

  clipPanel: {
    clipRange: 'Plage de clip',
  },

  downloadTable: {
    thumb: 'Miniature',
    title: 'Titre',
    progress: 'Progression',
    total: 'Total',
    speed: 'Vitesse',
    eta: 'Temps restant',
    elapsed: 'Durée',
    actions: 'Actions',
    emptyTitle: 'Collez une URL ci-dessus pour télécharger',
    emptyDescription: 'Collez un lien vidéo pour lancer un téléchargement et le suivre ici.',
  },

  downloadGrid: {
    emptyTitle: 'Rien en file d’attente',
    emptyDescription:
      'Ajoutez des téléchargements depuis la barre d’URL pour remplir le tableau avec les miniatures, la progression et le statut Premiere.',
  },

  download: {
    ready: 'prêt',
    failed: 'échoué',
    running: 'en cours',
    working: 'En cours…',
    openFile: 'Ouvrir le fichier',
    availableWhenComplete: 'Disponible une fois le téléchargement terminé',
    open: 'Ouvrir',
    runningLabel: 'En cours',
  },

  stages: {
    preparing: 'Préparation',
    resolving: 'Vérification du média',
    downloading: 'Téléchargement',
    clipping: 'Finalisation',
    importing: 'Ajout à Premiere',
    complete: 'Prêt',
    failed: 'Téléchargement échoué',
  },

  availabilityStages: {
    preparing: 'Préparation',
    resolving: 'Vérification du média',
    downloading: 'Téléchargement',
    clipping: 'Finalisation du fichier',
    importing: 'Ajout à Premiere',
    complete: 'Prêt',
    failed: 'Téléchargement échoué',
  },

  presetManager: {
    title: 'Préréglages enregistrés',
    empty: 'Aucun préréglage enregistré.',
  },

  settings: {
    preferencesLabel: 'Préférences',
    desktopDefaults: 'Paramètres par défaut',
    defaultResolution: 'Résolution par défaut',
    concurrentDownloads: 'Téléchargements simultanés',
    defaultDownloadFolder: 'Dossier par défaut',
    browse: 'Choisir',
    defaultDestination: 'Destination par défaut',
    downloadsFolder: 'Téléchargements',
    currentPremiereProject: 'Projet Premiere',
    theme: 'Thème',
    dark: 'Sombre',
    light: 'Clair',
    language: 'Langue',
    videoOnlyDefault: 'Vidéo seule par défaut',
    askDownloadPath: 'Demander le dossier à chaque fois',
    askAudioPath: 'Demander le dossier audio à chaque fois',
    autoImportPremiere: 'Import auto quand Premiere est prêt',
    appsBrowser: 'Apps & navigateur',
    premierePro: 'Premiere Pro',
    checkingPremiere: 'Vérification de Premiere…',
    premiereConflicts: 'D’anciens panneaux Premiere ont été trouvés. Supprimez-les puis redémarrez Premiere.',
    premiereReady: 'Premiere est prêt pour l’import en un clic.',
    premiereFinishSetup: 'Premiere a été détecté. Ajoutez le panneau pour activer l’import.',
    premiereNotFound: 'Premiere n’a pas été trouvé sur cet ordinateur.',
    refreshPremiereSetup: 'Réinstaller',
    setupPremiere: 'Ajouter à Premiere',
    openPanelFolder: 'Ouvrir le dossier',
    chromeExtension: 'Extension navigateur',
    checkingBrowser: 'Vérification du navigateur…',
    browserReady: 'Le dossier de l’extension est prêt pour Chrome.',
    browserDetected: 'Préparez le dossier puis chargez-le dans Chrome.',
    browserNotDetected: 'Préparez le dossier puis chargez-le dans un navigateur Chromium.',
    openExtensionFolder: 'Ouvrir le dossier',
    prepareBrowserExtension: 'Ajouter à Chrome',
    olderPanelsNeedCleanup: 'D’anciens panneaux Premiere à nettoyer',
    cepFolder: 'Dossier CEP',
    openFolder: 'Ouvrir',
    premiereActionReady: 'Premiere est prêt. Ouvrez YT2Premiere via Fenêtre > Extensions (Legacy).',
    premiereActionConflicts: 'Le panneau a été mis à jour. Supprimez les anciens panneaux listés ci-dessous puis redémarrez Premiere.',
    browserActionReady: 'Le dossier de l’extension est prêt. Activez le mode développeur dans Chrome puis chargez le dossier qui vient de s’ouvrir.',
    cancel: 'Annuler',
    saveSettings: 'Enregistrer',
  },

  app: {
    invalidUrl: 'Entrez une URL http(s) valide avant d’ajouter.',
    invalidClipRange: 'Entrez une plage de clip valide avant d’ajouter.',
    presetNamePrompt: 'Nom du préréglage',
    couldNotPreparePremiere: 'Impossible de préparer Premiere',
    couldNotPrepareBrowser: 'Impossible de préparer l’extension navigateur',
  },

  dropdowns: {
    downloadsFolder: 'Téléchargements',
    premiereProject: 'Projet Premiere',
  },
} as const;

export default fr;
