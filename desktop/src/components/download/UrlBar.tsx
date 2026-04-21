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
    <div className="flex flex-col gap-4">
      {/* URL Input */}
      <div className="flex flex-col gap-1.5">
        <label className="rv-label">Source URL</label>
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
          <label className="rv-label">Resolution</label>
          <Dropdown
            value={quality}
            options={[
              { value: 'highest', label: t('urlBar.highest') },
              { value: '2160', label: '4K (2160p)' },
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
          <label className="rv-label">Destination</label>
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
        <label className="rv-label">Folder Override</label>
        <div className="flex gap-1">
          <input 
            value={folderOverride}
            onChange={(e) => onFolderOverrideChange(e.target.value)}
            placeholder={settings.downloadPath || "Default downloads folder"}
            className="rv-input flex-1 h-[28px]"
          />
          <Button size="icon" onClick={onPickFolder} title="Browse">
            <Icon icon={FolderOpen} size={14} />
          </Button>
        </div>
      </div>

      {/* Submit */}
      <Button 
        variant="primary" 
        className="w-full h-[32px] mt-2 tracking-widest uppercase text-[11px]"
        onClick={onQueueDownload}
        disabled={!url.trim() || infoLoading}
      >
        <Icon icon={Download} size={14} />
        Add to Queue
      </Button>

      {/* Alerts/Status */}
      {outputTarget === 'premiereProject' && !premiereStatus.canImport && (
        <div className="mt-2 text-[10px] bg-rv-error/10 border border-rv-error/30 text-rv-error p-2 rounded-[1px] leading-tight font-medium uppercase">
          <strong>Import Blocked:</strong> {premiereStatus.reason}
        </div>
      )}
    </div>
  );
}
