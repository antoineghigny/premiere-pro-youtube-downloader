import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Sparkles } from 'lucide-react';

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
import { createT, TranslationProvider } from './i18n';
import { SettingsModal } from './components/settings/SettingsModal';
import { useDownloads } from './hooks/useDownloads';
import { useMotionStudio } from './hooks/useMotionStudio';
import { usePremiereStatus } from './hooks/usePremiereStatus';
import { useSettings } from './hooks/useSettings';
import { useVideoInfo } from './hooks/useVideoInfo';
import { isLikelyRemoteUrl, parseTimecode } from './utils/validation';

import { AppShell } from './components/shell/AppShell';
import { MediaPage } from './pages/MediaPage';
import { FusionPage } from './pages/FusionPage';

function buildPresetName(options: FFmpegOptions) {
  return `${options.outputFormat.toUpperCase()} / ${options.videoCodec.toUpperCase()} / ${options.audioCodec.toUpperCase()}`;
}

export default function App() {
  const { settings, setSettings, persistSettings } = useSettings();
  const premiereStatus = usePremiereStatus();
  const downloads = useDownloads(settings);
  const motionStudio = useMotionStudio();
  const premiereReady = premiereStatus.canImport;

  const [pageId, setPageId] = useState<'media' | 'fusion'>('media');
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
      if (isMounted) setBackendConnected(healthy);
    };
    poll();
    const intervalId = window.setInterval(poll, 4000);
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
        if (!cancelled) setIntegrationStatus(status);
      } catch (error) {
        console.error('[YT2PP] Could not load integration status:', error);
      } finally {
        if (!cancelled) setIntegrationLoading(false);
      }
    };
    syncIntegrations();
    return () => { cancelled = true; };
  }, []);

  const handlePickFolder = async () => {
    const selected = await pickFolder(folder || settings.downloadPath);
    if (selected) setFolder(selected);
  };

  const handleQueueDownload = async () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) return;
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

    const audioFormats = new Set(['wav', 'mp3', 'flac', 'aac', 'opus']);
    const downloadType = clipOpen ? 'clip' : audioFormats.has(ffmpegOptions.outputFormat.toLowerCase()) ? 'audio' : 'full';
    
    let resolvedOutputTarget = outputTarget;
    let resolvedDownloadPath = folder || settings.downloadPath;

    if (resolvedOutputTarget === 'premiereProject') {
      if (!premiereStatus.running || !premiereStatus.cepRegistered || !premiereStatus.projectOpen) {
        setUrlError(premiereStatus.reason);
        return;
      }
      if (!premiereStatus.projectSaved) {
        const selected = await pickFolder(resolvedDownloadPath);
        if (!selected) return;
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
        audioOnly: audioFormats.has(ffmpegOptions.outputFormat.toLowerCase()),
        downloadMP3: ffmpegOptions.outputFormat.toLowerCase() === 'mp3',
        ffmpeg: { ...ffmpegOptions },
      },
      info
    );
    setUrl('');
  };

  const pages = [
    { id: 'media', label: 'Media', icon: FolderOpen },
    { id: 'fusion', label: 'Fusion', icon: Sparkles },
  ];

  return (
    <TranslationProvider value={t}>
      <AppShell
        pages={pages}
        currentPageId={pageId}
        onPageChange={(id) => setPageId(id as 'media' | 'fusion')}
        onOpenSettings={() => downloads.setSettingsOpen(true)}
        onQuit={() => window.close()}
      >
        {pageId === 'media' ? (
          <MediaPage 
            url={url}
            onUrlChange={(val) => { setUrl(val); setUrlError(''); }}
            onQueueDownload={handleQueueDownload}
            info={info}
            infoLoading={infoLoading}
            infoError={urlError || infoError}
            quality={quality}
            onQualityChange={setQuality}
            outputTarget={outputTarget}
            onOutputTargetChange={setOutputTarget}
            folderOverride={folder}
            onFolderOverrideChange={setFolder}
            onPickFolder={handlePickFolder}
            ffmpegOptions={ffmpegOptions}
            onFFmpegOptionsChange={setFFmpegOptions}
            clipEnabled={clipOpen}
            onClipEnabledChange={setClipOpen}
            clipStart={clipStart}
            onClipStartChange={setClipStart}
            clipEnd={clipEnd}
            onClipEndChange={setClipEnd}
            downloads={downloads}
            settings={settings}
            premiereStatus={premiereStatus}
          />
        ) : (
          <FusionPage studio={motionStudio} settings={settings} />
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
            const preset = settings.ffmpegPresets.find((p) => p.id === presetId);
            if (preset) setFFmpegOptions(preset.options);
          }}
          onDeletePreset={async (presetId) => {
            const nextSettings: DesktopSettings = {
              ...settings,
              ffmpegPresets: settings.ffmpegPresets.filter((p) => p.id !== presetId),
            };
            const saved = await persistSettings(nextSettings);
            setSettings(saved);
            return saved.ffmpegPresets;
          }}
          onRevealPath={revealFile}
          integrationStatus={integrationStatus}
          integrationLoading={integrationLoading}
          integrationMessage={integrationMessage}
          integrationBusy={integrationBusy}
          onInstallPremiere={async () => {
             setIntegrationBusy('premiere');
             try {
               const result = await installPremiereIntegration();
               setIntegrationStatus(result.status);
             } catch (e) { console.error(e); }
             finally { setIntegrationBusy(null); }
          }}
          onOpenBrowserSetup={async () => {
             setIntegrationBusy('browser');
             try {
               const result = await openBrowserSetup();
               setIntegrationStatus(result.status);
             } catch (e) { console.error(e); }
             finally { setIntegrationBusy(null); }
          }}
        />
      </AppShell>
    </TranslationProvider>
  );
}
