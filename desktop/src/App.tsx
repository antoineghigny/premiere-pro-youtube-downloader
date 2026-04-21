import { useEffect, useMemo, useState } from 'react';

import {
  getBackendHealth,
  getIntegrationStatus,
  installPremiereIntegration,
  openBrowserSetup,
  pickFolder,
  revealFile,
} from './api/client';
import {
  DEFAULT_FFMPEG_OPTIONS,
  type DesktopSettings,
  type FFmpegOptions,
  type FFmpegPreset,
  type IntegrationActionResponse,
  type IntegrationStatus,
} from './api/types';
import { createT, type TFunction, TranslationProvider } from './i18n';
import { SettingsModal } from './components/settings/SettingsModal';
import { DownloadWorkspace } from './components/workspace/DownloadWorkspace';
import { MotionStudioWorkspace } from './components/workspace/MotionStudioWorkspace';
import { useDownloads } from './hooks/useDownloads';
import { useMotionStudio } from './hooks/useMotionStudio';
import { usePremiereStatus } from './hooks/usePremiereStatus';
import { useSettings } from './hooks/useSettings';
import { useVideoInfo } from './hooks/useVideoInfo';
import { buildQueueStatusSummary } from './utils/statusSummary';
import { isLikelyRemoteUrl, parseTimecode } from './utils/validation';

function buildPresetName(options: FFmpegOptions) {
  return `${options.outputFormat.toUpperCase()} / ${options.videoCodec.toUpperCase()} / ${options.audioCodec.toUpperCase()}`;
}

function buildPremiereIntegrationMessage(t: TFunction, result: IntegrationActionResponse): string {
  if (result.status.conflicts.length > 0) {
    return t('settings.premiereActionConflicts');
  }

  if (result.status.premierePanelInstalled) {
    return t('settings.premiereActionReady');
  }

  return result.message;
}

function buildBrowserIntegrationMessage(t: TFunction, result: IntegrationActionResponse): string {
  if (result.status.browserAddonReady) {
    return t('settings.browserActionReady');
  }

  return result.message;
}

export default function App() {
  const { settings, setSettings, persistSettings } = useSettings();
  const premiereStatus = usePremiereStatus();
  const downloads = useDownloads(settings);
  const motionStudio = useMotionStudio();
  const premiereReady = premiereStatus.canImport;

  const [workspace, setWorkspace] = useState<'downloads' | 'motionStudio'>('motionStudio');
  const [backendConnected, setBackendConnected] = useState(false);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [folder, setFolder] = useState('');
  const [quality, setQuality] = useState(settings.resolution);
  const [outputTarget, setOutputTarget] = useState(settings.outputTarget);
  const [ffmpegOpen, setFFmpegOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const [clipStart, setClipStart] = useState('00:00:00.000');
  const [clipEnd, setClipEnd] = useState('00:00:30.000');
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationBusy, setIntegrationBusy] = useState<'premiere' | 'browser' | null>(null);
  const [integrationMessage, setIntegrationMessage] = useState('');
  const [ffmpegOptions, setFFmpegOptions] = useState<FFmpegOptions>({
    ...DEFAULT_FFMPEG_OPTIONS,
    importToPremiere: settings.defaultImportToPremiere && premiereReady,
  });

  const t = useMemo(() => createT(settings.language), [settings.language]);
  const { info, loading: infoLoading, error: infoError } = useVideoInfo(url);

  useEffect(() => {
    setFolder(settings.downloadPath);
    setQuality(settings.resolution);
    setOutputTarget(settings.outputTarget);
    setFFmpegOptions((current) => ({
      ...current,
      importToPremiere: settings.defaultImportToPremiere && premiereReady,
    }));
  }, [premiereReady, settings.defaultImportToPremiere, settings.downloadPath, settings.outputTarget]);

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      const healthy = await getBackendHealth();
      if (isMounted) {
        setBackendConnected(healthy);
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncIntegrations = async () => {
      setIntegrationLoading(true);
      try {
        const status = await getIntegrationStatus();
        if (!cancelled) {
          setIntegrationStatus(status);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[YT2PP] Could not load integration status:', error);
        }
      } finally {
        if (!cancelled) {
          setIntegrationLoading(false);
        }
      }
    };

    void syncIntegrations();

    return () => {
      cancelled = true;
    };
  }, []);

  const queueSummary = useMemo(() => buildQueueStatusSummary(downloads.allItems), [downloads.allItems]);

  const handlePickFolder = async () => {
    const selected = await pickFolder(folder || settings.downloadPath);
    if (selected) {
      setFolder(selected);
    }
  };

  const handleQueueDownload = async () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      return;
    }

    if (!isLikelyRemoteUrl(normalizedUrl)) {
      setUrlError(t('app.invalidUrl'));
      return;
    }

    const clipIn = clipOpen ? parseTimecode(clipStart) : undefined;
    const clipOut = clipOpen ? parseTimecode(clipEnd) : undefined;
    if (clipOpen && (clipIn === undefined || clipOut === undefined || clipOut <= clipIn)) {
      setUrlError(t('app.invalidClipRange'));
      return;
    }

    const outputFormat = ffmpegOptions.outputFormat.toLowerCase();
    const audioFormats = new Set(['wav', 'mp3', 'flac', 'aac', 'opus']);
    const downloadType = clipOpen ? 'clip' : audioFormats.has(outputFormat) ? 'audio' : 'full';
    let resolvedOutputTarget = outputTarget;
    let resolvedDownloadPath = folder || settings.downloadPath;

    if (resolvedOutputTarget === 'premiereProject') {
      if (!premiereStatus.running || !premiereStatus.cepRegistered || !premiereStatus.projectOpen) {
        setUrlError(premiereStatus.reason);
        return;
      }

      if (!premiereStatus.projectSaved) {
        const selected = await pickFolder(resolvedDownloadPath);
        if (!selected) {
          return;
        }
        resolvedDownloadPath = selected;
        resolvedOutputTarget = 'downloadFolder';
      }
    }

    setUrlError('');
    downloads.queueDownload(
      {
        videoUrl: normalizedUrl,
        downloadType,
        downloadPath: resolvedDownloadPath,
        outputTarget: resolvedOutputTarget,
        resolution: quality,
        videoOnly: settings.videoOnly,
        importToPremiere: ffmpegOptions.importToPremiere && premiereReady,
        clipIn,
        clipOut,
        audioOnly: audioFormats.has(outputFormat),
        downloadMP3: outputFormat === 'mp3',
        ffmpeg: {
          ...ffmpegOptions,
        },
      },
      info
    );
    setUrl('');
  };

  const handleSavePreset = async () => {
    const name = window.prompt(t('app.presetNamePrompt'), buildPresetName(ffmpegOptions));
    if (!name) {
      return;
    }
    const nextPreset: FFmpegPreset = {
      id: crypto.randomUUID(),
      name,
      options: ffmpegOptions,
    };
    const nextSettings: DesktopSettings = {
      ...settings,
      ffmpegPresets: [nextPreset, ...settings.ffmpegPresets],
    };
    const saved = await persistSettings(nextSettings);
    setSettings(saved);
  };

  const handleDeletePreset = async (presetId: string) => {
    const nextSettings: DesktopSettings = {
      ...settings,
      ffmpegPresets: settings.ffmpegPresets.filter((preset) => preset.id !== presetId),
    };
    const saved = await persistSettings(nextSettings);
    setSettings(saved);
    return saved.ffmpegPresets;
  };

  const handleInstallPremiere = async () => {
    setIntegrationBusy('premiere');
    setIntegrationMessage('');
    try {
      const result = await installPremiereIntegration();
      setIntegrationStatus(result.status);
      setIntegrationMessage(buildPremiereIntegrationMessage(t, result));
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? error.message : t('app.couldNotPreparePremiere'));
    } finally {
      setIntegrationBusy(null);
    }
  };

  useEffect(() => {
    if (!downloads.settingsOpen) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setIntegrationLoading(true);
      try {
        const status = await getIntegrationStatus();
        if (!cancelled) {
          setIntegrationStatus(status);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[YT2PP] Could not refresh integration status:', error);
        }
      } finally {
        if (!cancelled) {
          setIntegrationLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [downloads.settingsOpen]);

  const handleOpenBrowserSetup = async () => {
    setIntegrationBusy('browser');
    setIntegrationMessage('');
    try {
      const result = await openBrowserSetup();
      setIntegrationStatus(result.status);
      setIntegrationMessage(buildBrowserIntegrationMessage(t, result));
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? error.message : t('app.couldNotPrepareBrowser'));
    } finally {
      setIntegrationBusy(null);
    }
  };

  return (
    <TranslationProvider value={t}>
      <>
        {workspace === 'downloads' ? (
          <DownloadWorkspace
          backendConnected={backendConnected}
            clipEnabled={clipOpen}
            clipEnd={clipEnd}
            clipStart={clipStart}
            downloads={downloads}
            ffmpegOptions={ffmpegOptions}
            folderOverride={folder}
            info={info}
            infoError={urlError || infoError}
            infoLoading={infoLoading}
            openAdvanced={ffmpegOpen}
            outputTarget={outputTarget}
            premiereStatus={premiereStatus}
            quality={quality}
            queueSummary={queueSummary}
            settings={settings}
            url={url}
            workspace={workspace}
            onClipEnabledChange={setClipOpen}
            onClipEndChange={setClipEnd}
            onClipStartChange={setClipStart}
            onDeletePreset={async (presetId) => {
              await handleDeletePreset(presetId);
            }}
            onFFmpegOptionsChange={setFFmpegOptions}
            onFolderOverrideChange={setFolder}
            onOpenAdvancedChange={setFFmpegOpen}
            onOutputTargetChange={setOutputTarget}
            onPickFolder={handlePickFolder}
            onQualityChange={setQuality}
            onQueueDownload={handleQueueDownload}
            onSavePreset={handleSavePreset}
            onUrlChange={(nextValue) => {
              setUrl(nextValue);
              if (urlError) {
                setUrlError('');
              }
            }}
            onWorkspaceChange={setWorkspace}
          />
        ) : (
          <MotionStudioWorkspace
            backendConnected={backendConnected}
            settings={settings}
            studio={motionStudio}
            workspace={workspace}
            onOpenSettings={() => downloads.setSettingsOpen(true)}
            onWorkspaceChange={setWorkspace}
          />
        )}
        <SettingsModal
          open={downloads.settingsOpen}
          settings={settings}
          onClose={() => {
            downloads.setSettingsOpen(false);
            setIntegrationMessage('');
          }}
          onSave={async (nextSettings) => {
            const saved = await persistSettings(nextSettings);
            setSettings(saved);
          }}
          onPickFolder={(currentPath) => pickFolder(currentPath)}
          onLoadPreset={(presetId) => {
            const preset = settings.ffmpegPresets.find((candidate) => candidate.id === presetId);
            if (preset) {
              setFFmpegOptions(preset.options);
            }
          }}
          onDeletePreset={handleDeletePreset}
          onRevealPath={revealFile}
          integrationStatus={integrationStatus}
          integrationLoading={integrationLoading}
          integrationMessage={integrationMessage}
          integrationBusy={integrationBusy}
          onInstallPremiere={handleInstallPremiere}
          onOpenBrowserSetup={handleOpenBrowserSetup}
        />
      </>
    </TranslationProvider>
  );
}
