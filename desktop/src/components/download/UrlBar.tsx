import React from 'react';
import { Download, FolderOpen, Link2, Sparkles } from 'lucide-react';
import type { OutputTarget, VideoInfo, DesktopSettings, PremiereStatusResponse } from '../../api/types';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';
import { Icon } from '../common/Icon';
import { cn } from '@/lib/utils';

type UrlBarProps = {
  url: string;
  onUrlChange: (value: string) => void;
  onQueueDownload: () => void;
  info: VideoInfo | null;
  infoLoading: boolean;
  infoError: string;
  quality: string;
  onQualityChange: (value: string) => void;
  outputTarget: OutputTarget;
  onOutputTargetChange: (value: OutputTarget) => void;
  folderOverride: string;
  onFolderOverrideChange: (value: string) => void;
  onPickFolder: () => void;
  settings: DesktopSettings;
  premiereStatus: PremiereStatusResponse;
};

export function UrlBar({
  url,
  onUrlChange,
  onQueueDownload,
  info,
  infoLoading,
  infoError,
  quality,
  onQualityChange,
  outputTarget,
  onOutputTargetChange,
  folderOverride,
  onFolderOverrideChange,
  onPickFolder,
  settings,
  premiereStatus,
}: UrlBarProps) {
  const t = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      {/* URL Input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Source URL</label>
        <div className="relative group">
          <Icon icon={Link2} size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-rv-text-disabled group-focus-within:text-rv-accent transition-colors" />
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onQueueDownload()}
            placeholder={t('urlBar.placeholder')}
            className="rv-input w-full pl-8 h-[28px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Quality */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Resolution</label>
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
            onChange={(e) => onQualityChange(e.target.value)}
            className="h-[28px]"
          />
        </div>

        {/* Target */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Destination</label>
          <Dropdown
            value={outputTarget}
            options={[
              { value: 'downloadFolder', label: t('dropdowns.downloadsFolder') },
              { value: 'premiereProject', label: t('dropdowns.premiereProject') },
            ]}
            onChange={(e) => onOutputTargetChange(e.target.value as OutputTarget)}
            className="h-[28px]"
          />
        </div>
      </div>

      {/* Folder Override */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Folder Override</label>
        <div className="flex gap-1">
          <input 
            value={folderOverride}
            onChange={(e) => onFolderOverrideChange(e.target.value)}
            placeholder={settings.downloadPath}
            className="rv-input flex-1 h-[28px]"
          />
          <Button size="icon" onClick={onPickFolder} title="Browse">
            <Icon icon={FolderOpen} size={14} />
          </Button>
        </div>
      </div>

      {/* Preview Card */}
      <div className="mt-2 bg-rv-input/30 border border-rv-border-inset rounded-[2px] overflow-hidden flex flex-col min-h-[140px]">
        <div className="aspect-video bg-black flex items-center justify-center relative overflow-hidden">
          {info?.thumbnail ? (
            <img src={info.thumbnail} alt={info.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Icon icon={Sparkles} size={24} className="text-rv-text-disabled" />
          )}
          {infoLoading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] uppercase tracking-widest text-rv-text-muted animate-pulse">
              Resolving...
            </div>
          )}
        </div>
        <div className="p-2 space-y-1">
          <div className="text-[11px] font-medium truncate text-rv-text-strong">
            {info?.title || (infoError ? "Error: " + infoError : "Ready to Queue")}
          </div>
          <div className="flex justify-between items-center text-[9px] text-rv-text-muted uppercase tracking-tight">
            <span>{info?.channel || "Source"}</span>
            <span>{info?.duration ? Math.round(info.duration) + "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <Button 
        variant="primary" 
        className="w-full h-[32px] mt-2 font-semibold tracking-wider"
        onClick={onQueueDownload}
        disabled={!url.trim() || infoLoading}
      >
        <Icon icon={Download} size={14} />
        QUEUE DOWNLOAD
      </Button>

      {/* Alerts/Status */}
      {outputTarget === 'premiereProject' && !premiereStatus.canImport && (
        <div className="mt-2 text-[10px] bg-rv-error/10 border border-rv-error/30 text-rv-error p-2 rounded-[2px] leading-tight">
          <strong>IMPORT BLOCKED:</strong> {premiereStatus.reason}
        </div>
      )}
    </div>
  );
}
