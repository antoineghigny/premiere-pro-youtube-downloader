import { Download, FolderOpen, Scissors, SlidersHorizontal, Sparkles } from 'lucide-react';

import type { VideoInfo } from '../../api/types';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';

type UrlBarProps = {
  url: string;
  info: VideoInfo | null;
  infoLoading: boolean;
  infoError: string;
  quality: string;
  ffmpegOpen: boolean;
  clipOpen: boolean;
  onUrlChange: (value: string) => void;
  onQualityChange: (value: string) => void;
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
  ffmpegOpen,
  clipOpen,
  onUrlChange,
  onQualityChange,
  onToggleFFmpeg,
  onToggleClip,
  onPickFolder,
  onSubmit,
}: UrlBarProps) {
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
            placeholder="Paste URL + Enter to queue..."
            className="h-14 w-full rounded-[1.35rem] border border-white/10 bg-white/5 pl-5 pr-48 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--color-main)] focus:bg-white/8"
          />
          <div className="absolute right-2 top-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleClip}
              className={clipOpen ? 'toolbar-chip toolbar-chip-active' : 'toolbar-chip'}
              title="Toggle clip mode"
            >
              <Scissors className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleFFmpeg}
              className={ffmpegOpen ? 'toolbar-chip toolbar-chip-active' : 'toolbar-chip'}
              title="Toggle FFmpeg options"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onPickFolder}
              className="toolbar-chip"
              title="Choose download folder"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-3 xl:w-[320px]">
          <div className="w-36">
            <Dropdown
              value={quality}
              options={[
                { value: 'highest', label: 'Highest' },
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
          <Button
            className="h-14 flex-1 rounded-[1.35rem]"
            icon={<Download className="h-4 w-4" />}
            onClick={onSubmit}
          >
            Queue
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
              {infoLoading ? 'Resolving metadata...' : infoError ? 'Metadata unavailable' : 'Video preview'}
            </div>
            <div className="truncate text-base font-semibold text-white">
              {info?.title || (infoError ? infoError : 'Paste a supported URL to preview title and thumbnail')}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
              {info?.channel ? <span>{info.channel}</span> : null}
              {info?.duration ? <span>{Math.round(info.duration)} sec</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
