import { useEffect, useMemo, useState } from 'react';

import { getBackendHealth, pickFolder } from './api/client';
import {
  DEFAULT_FFMPEG_OPTIONS,
  type DesktopSettings,
  type FFmpegOptions,
  type FFmpegPreset,
} from './api/types';
import { ClipPanel } from './components/download/ClipPanel';
import { DownloadGrid } from './components/download/DownloadGrid';
import { DownloadTable } from './components/download/DownloadTable';
import { FFmpegPanel } from './components/download/FFmpegPanel';
import { UrlBar } from './components/download/UrlBar';
import { MenuBar } from './components/layout/MenuBar';
import { StatusBar } from './components/layout/StatusBar';
import { TitleBar } from './components/layout/TitleBar';
import { SettingsModal } from './components/settings/SettingsModal';
import { useDownloads } from './hooks/useDownloads';
import { usePremiereStatus } from './hooks/usePremiereStatus';
import { useSettings } from './hooks/useSettings';
import { useVideoInfo } from './hooks/useVideoInfo';
import { buildQueueStatusSummary } from './utils/statusSummary';
import { isLikelyRemoteUrl, parseTimecode } from './utils/validation';

function buildPresetName(options: FFmpegOptions) {
  return `${options.outputFormat.toUpperCase()} / ${options.videoCodec.toUpperCase()} / ${options.audioCodec.toUpperCase()}`;
}

export default function App() {
  const { settings, setSettings, persistSettings } = useSettings();
  const { running: premiereRunning, cepRegistered } = usePremiereStatus();
  const downloads = useDownloads(settings);
  const premiereReady = premiereRunning && cepRegistered;

  const [backendConnected, setBackendConnected] = useState(false);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [folder, setFolder] = useState('');
  const [quality, setQuality] = useState(settings.resolution);
  const [ffmpegOpen, setFFmpegOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const [clipStart, setClipStart] = useState('00:00:00.000');
  const [clipEnd, setClipEnd] = useState('00:00:30.000');
  const [ffmpegOptions, setFFmpegOptions] = useState<FFmpegOptions>({
    ...DEFAULT_FFMPEG_OPTIONS,
    resolution: settings.resolution,
    importToPremiere: settings.defaultImportToPremiere && premiereReady,
  });

  const { info, loading: infoLoading, error: infoError } = useVideoInfo(url);

  useEffect(() => {
    setFolder(settings.downloadPath);
    setQuality(settings.resolution);
    setFFmpegOptions((current) => ({
      ...current,
      resolution: settings.resolution,
      importToPremiere: settings.defaultImportToPremiere && premiereReady,
    }));
  }, [premiereReady, settings.defaultImportToPremiere, settings.downloadPath, settings.resolution]);

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

  const queueSummary = useMemo(() => buildQueueStatusSummary(downloads.allItems), [downloads.allItems]);

  const handlePickFolder = async () => {
    const selected = await pickFolder(folder || settings.downloadPath);
    if (selected) {
      setFolder(selected);
    }
  };

  const handleQueueDownload = () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
      return;
    }

    if (!isLikelyRemoteUrl(normalizedUrl)) {
      setUrlError('Enter a valid http(s) URL before queueing.');
      return;
    }

    const clipIn = clipOpen ? parseTimecode(clipStart) : undefined;
    const clipOut = clipOpen ? parseTimecode(clipEnd) : undefined;
    if (clipOpen && (clipIn === undefined || clipOut === undefined || clipOut <= clipIn)) {
      setUrlError('Enter a valid clip range before queueing.');
      return;
    }

    const outputFormat = ffmpegOptions.outputFormat.toLowerCase();
    const audioFormats = new Set(['wav', 'mp3', 'flac', 'aac', 'opus']);
    const downloadType = clipOpen ? 'clip' : audioFormats.has(outputFormat) ? 'audio' : 'full';

    setUrlError('');
    downloads.queueDownload(
      {
        videoUrl: normalizedUrl,
        downloadType,
        downloadPath: folder || settings.downloadPath,
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
    const name = window.prompt('Preset name', buildPresetName(ffmpegOptions));
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#2a1b5f_0%,rgba(12,13,27,0.98)_36%,#06070e_100%)] px-4 py-4 text-white md:px-6">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1680px] flex-col gap-4">
        <TitleBar
          backendConnected={backendConnected}
          premiereRunning={premiereRunning}
          cepRegistered={cepRegistered}
          onOpenSettings={() => downloads.setSettingsOpen(true)}
        />
        <MenuBar
          viewMode={downloads.viewMode}
          filterText={downloads.filterText}
          onViewChange={downloads.setViewMode}
          onFilterChange={downloads.setFilterText}
          onClearCompleted={downloads.clearCompleted}
          onClearHistory={() => {
            void downloads.clearPersistedHistory();
          }}
        />
        <UrlBar
          url={url}
          info={info}
          infoLoading={infoLoading}
          infoError={urlError || infoError}
          quality={quality}
          ffmpegOpen={ffmpegOpen}
          clipOpen={clipOpen}
          onUrlChange={(nextValue) => {
            setUrl(nextValue);
            if (urlError) {
              setUrlError('');
            }
          }}
          onQualityChange={setQuality}
          onToggleFFmpeg={() => setFFmpegOpen((current) => !current)}
          onToggleClip={() => setClipOpen((current) => !current)}
          onPickFolder={() => {
            void handlePickFolder();
          }}
          onSubmit={handleQueueDownload}
        />
        <FFmpegPanel
          open={ffmpegOpen}
          value={ffmpegOptions}
          presets={settings.ffmpegPresets}
          premiereRunning={premiereRunning}
          cepRegistered={cepRegistered}
          onChange={(patch) => setFFmpegOptions((current) => ({ ...current, ...patch }))}
          onSavePreset={() => {
            void handleSavePreset();
          }}
          onLoadPreset={(presetId) => {
            const preset = settings.ffmpegPresets.find((candidate) => candidate.id === presetId);
            if (preset) {
              setFFmpegOptions(preset.options);
            }
          }}
        />
        <ClipPanel
          open={clipOpen}
          start={clipStart}
          end={clipEnd}
          onStartChange={setClipStart}
          onEndChange={setClipEnd}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1">
            {downloads.viewMode === 'list' ? (
              <DownloadTable
                items={downloads.items}
                onRetry={downloads.retryDownload}
                onRemove={(item) => {
                  void downloads.deleteDownload(item);
                }}
                onReveal={(item) => {
                  void downloads.revealDownload(item);
                }}
                onMove={downloads.moveDownload}
              />
            ) : (
              <DownloadGrid
                items={downloads.items}
                onRetry={downloads.retryDownload}
                onRemove={(item) => {
                  void downloads.deleteDownload(item);
                }}
                onReveal={(item) => {
                  void downloads.revealDownload(item);
                }}
              />
            )}
          </div>
        </div>
        <StatusBar
          totalCount={queueSummary.totalCount}
          activeCount={queueSummary.activeCount}
          queuedCount={queueSummary.queuedCount}
          completedCount={queueSummary.completedCount}
          failedCount={queueSummary.failedCount}
          completedPercent={queueSummary.completedPercent}
          activePercent={queueSummary.activePercent}
          failedPercent={queueSummary.failedPercent}
          queuedPercent={queueSummary.queuedPercent}
        />
      </div>
      <SettingsModal
        open={downloads.settingsOpen}
        settings={settings}
        onClose={() => downloads.setSettingsOpen(false)}
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
      />
    </div>
  );
}
