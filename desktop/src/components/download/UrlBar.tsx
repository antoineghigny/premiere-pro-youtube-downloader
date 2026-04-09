import { Download, FolderOpen, Scissors, SlidersHorizontal, Sparkles } from 'lucide-react';

import type { OutputTarget, VideoInfo } from '../../api/types';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';

type UrlBarProps = {
  url: string;
  info: VideoInfo | null;
  infoLoading: boolean;
  infoError: string;
  quality: string;
  outputTarget: OutputTarget;
  ffmpegOpen: boolean;
  clipOpen: boolean;
  onUrlChange: (value: string) => void;
  onQualityChange: (value: string) => void;
  onOutputTargetChange: (value: OutputTarget) => void;
  onToggleFFmpeg: () => void;
  onToggleClip: () => void;
  onPickFolder: () => void;
  onSubmit: () => void;
};

export function UrlBar({
  url,
  info,
  infoLoading,
  infoError,
  quality,
  outputTarget,
  ffmpegOpen,
  clipOpen,
  onUrlChange,
  onQualityChange,
  onOutputTargetChange,
  onToggleFFmpeg,
  onToggleClip,
  onPickFolder,
  onSubmit,
}: UrlBarProps) {
  const t = useTranslation();
  const showPreview = Boolean(url.trim() || info || infoLoading || infoError);

  return (
    <div className="panel-surface space-y-4 px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <input
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder={t('urlBar.placeholder')}
            className="h-14 w-full rounded-[1.35rem] border border-white/10 bg-white/5 pl-5 pr-48 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--color-main)] focus:bg-white/8"
          />
          <div className="absolute right-2 top-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleClip}
              className={clipOpen ? 'toolbar-chip toolbar-chip-active' : 'toolbar-chip'}
              title={t('urlBar.toggleClip')}
            >
              <Scissors className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleFFmpeg}
              className={ffmpegOpen ? 'toolbar-chip toolbar-chip-active' : 'toolbar-chip'}
              title={t('urlBar.showExportOptions')}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onPickFolder}
              className="toolbar-chip"
              title={t('urlBar.chooseFolder')}
            >
              <FolderOpen className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-3 xl:w-[520px]">
          <div className="w-36">
            <Dropdown
              value={quality}
              options={[
                { value: 'highest', label: t('urlBar.highest') },
                { value: '2160', label: '4K' },
                { value: '1440', label: '1440p' },
                { value: '1080', label: '1080p' },
                { value: '720', label: '720p' },
                { value: '480', label: '480p' },
              ]}
              onChange={(event) => onQualityChange(event.target.value)}
              className="h-14"
            />
          </div>
          <div className="w-48">
            <Dropdown
              value={outputTarget}
              options={[
                { value: 'downloadFolder', label: t('dropdowns.downloadsFolder') },
                { value: 'premiereProject', label: t('dropdowns.premiereProject') },
              ]}
              onChange={(event) => onOutputTargetChange(event.target.value as OutputTarget)}
              className="h-14"
            />
          </div>
          <Button
            className="h-14 flex-1 rounded-[1.35rem]"
            icon={<Download className="h-4 w-4" />}
            onClick={onSubmit}
          >
            {t('urlBar.queue')}
          </Button>
        </div>
      </div>
      {showPreview ? (
        <div className="flex min-h-20 flex-wrap items-center gap-4 rounded-[1.35rem] border border-white/8 bg-[linear-gradient(120deg,rgba(255,255,255,0.06),rgba(97,22,255,0.12))] px-4 py-3">
          {info?.thumbnail ? (
            <img
              src={info.thumbnail}
              alt={info.title}
              className="h-16 w-28 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-16 w-28 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/4">
              <Sparkles className="h-5 w-5 text-[var(--text-muted)]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              {infoLoading ? t('urlBar.resolvingMetadata') : infoError ? t('urlBar.metadataUnavailable') : t('urlBar.videoPreview')}
            </div>
            <div className="truncate text-base font-semibold text-white">
              {info?.title || (infoError ? infoError : t('urlBar.pasteToPreview'))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
              {info?.channel ? <span>{info.channel}</span> : null}
              {info?.duration ? <span>{Math.round(info.duration)} {t('urlBar.seconds')}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
