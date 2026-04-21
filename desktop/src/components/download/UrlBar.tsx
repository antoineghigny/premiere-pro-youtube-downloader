import React from 'react';
import { Download, FolderOpen, Link2 } from 'lucide-react';
import type { OutputTarget, VideoInfo, DesktopSettings, PremiereStatusResponse } from '../../api/types';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';
import { Icon } from '../common/Icon';

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
  infoLoading,
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
    <div className="flex flex-col gap-5">
      {/* URL Input */}
      <div className="flex flex-col gap-2">
        <label className="rv-label">Ingest Link</label>
        <div className="relative group">
          <Icon icon={Link2} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rv-text-disabled group-focus-within:text-rv-accent transition-colors" />
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onQueueDownload()}
            placeholder={t('urlBar.placeholder')}
            className="rv-input w-full pl-9 h-[28px] font-sans"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Quality */}
        <div className="flex flex-col gap-2">
          <label className="rv-label">Format</label>
          <Dropdown
            value={quality}
            options={[
              { value: 'highest', label: t('urlBar.highest') },
              { value: '2160', label: 'UHD 2160p' },
              { value: '1440', label: 'QHD 1440p' },
              { value: '1080', label: 'HD 1080p' },
              { value: '720', label: 'HD 720p' },
              { value: '480', label: 'SD 480p' },
            ]}
            onChange={(e) => onQualityChange(e.target.value)}
            className="h-[26px]"
          />
        </div>

        {/* Target */}
        <div className="flex flex-col gap-2">
          <label className="rv-label">Storage</label>
          <Dropdown
            value={outputTarget}
            options={[
              { value: 'downloadFolder', label: 'DISK' },
              { value: 'premiereProject', label: 'PROJECT' },
            ]}
            onChange={(e) => onOutputTargetChange(e.target.value as OutputTarget)}
            className="h-[26px]"
          />
        </div>
      </div>

      {/* Folder Override */}
      <div className="flex flex-col gap-2">
        <label className="rv-label">Override Path</label>
        <div className="flex gap-1.5">
          <input 
            value={folderOverride}
            onChange={(e) => onFolderOverrideChange(e.target.value)}
            placeholder={settings.downloadPath || "DEFAULT PATH"}
            className="rv-input flex-1 h-[26px] font-mono text-[10px] uppercase opacity-70 focus:opacity-100"
          />
          <Button size="icon" className="h-[26px] w-[26px]" onClick={onPickFolder} title="Browse">
            <Icon icon={FolderOpen} size={13} />
          </Button>
        </div>
      </div>

      {/* Submit */}
      <Button 
        variant="primary" 
        className="w-full h-[36px] mt-2 tracking-[0.2em] font-black text-[11px]"
        onClick={onQueueDownload}
        disabled={!url.trim() || infoLoading}
      >
        <Icon icon={Download} size={14} className="mr-1" />
        ADD TO MEDIA POOL
      </Button>

      {/* Alerts/Status */}
      {outputTarget === 'premiereProject' && !premiereStatus.canImport && (
        <div className="mt-2 text-[9px] bg-rv-error/10 border border-rv-error/30 text-rv-error p-3 rounded-[1px] leading-tight font-bold uppercase tracking-widest shadow-inner">
          <span className="opacity-60 block mb-1">Warning:</span>
          {premiereStatus.reason}
        </div>
      )}
    </div>
  );
}
