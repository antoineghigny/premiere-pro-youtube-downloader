import React from 'react';
import { Download, FolderOpen, Link2, AlertCircle } from 'lucide-react';
import { DaVinciButton, DaVinciInput } from '../davinci-ui';
import { Icon } from '../common/Icon';
import { Dropdown } from '../common/Dropdown';
import { cn } from '@/lib/utils';

interface UrlBarProps {
  url: string;
  onUrlChange: (url: string) => void;
  onQueueDownload: () => void;
  infoLoading: boolean;
  quality: string;
  onQualityChange: (q: string) => void;
  outputTarget: string;
  onOutputTargetChange: (t: string) => void;
  folderOverride: string;
  onFolderOverrideChange: (f: string) => void;
  onPickFolder: () => void;
  settings: any;
  info?: any;
  infoError?: string;
  premiereStatus?: any;
}

export const UrlBar: React.FC<UrlBarProps> = ({
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
  infoError,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="rv-label mb-1.5 block">URL Source</label>
        <div className="relative">
          <Icon icon={Link2} size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
          <DaVinciInput
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className={cn("w-full pl-9", infoError && "border-rv-error")}
            placeholder="Paste YouTube or Video URL..."
          />
        </div>
        {infoError && (
          <div className="mt-2 p-2 bg-rv-error/10 border border-rv-error/30 rounded-[2px] text-[10px] text-rv-error font-bold uppercase flex items-start gap-2">
            <Icon icon={AlertCircle} size={12} className="shrink-0 mt-0.5" />
            <span>{infoError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rv-label mb-1.5 block">Format</label>
          <Dropdown
            value={quality}
            options={[
              { value: 'highest', label: 'HIGHEST' },
              { value: '1080', label: '1080p' },
              { value: '720', label: '720p' },
            ]}
            onChange={(e) => onQualityChange(e.target.value)}
            className="h-6 w-full text-[10px] font-bold tracking-tight uppercase"
          />
        </div>
        <div>
          <label className="rv-label mb-1.5 block">Target</label>
          <Dropdown
            value={outputTarget}
            options={[
              { value: 'downloadFolder', label: 'DISK' },
              { value: 'premiereProject', label: 'PROJECT' },
            ]}
            onChange={(e) => onOutputTargetChange(e.target.value)}
            className="h-6 w-full text-[10px] font-bold tracking-tight uppercase"
          />
        </div>
      </div>

      <div>
        <label className="rv-label mb-1.5 block">Download Path</label>
        <div className="flex gap-1">
          <DaVinciInput 
            value={folderOverride}
            onChange={(e) => onFolderOverrideChange(e.target.value)}
            placeholder={settings.downloadPath || "Select folder..."}
            className="flex-1 h-6 text-[10px] font-mono"
          />
          <DaVinciButton 
            size="icon"
            onClick={onPickFolder}
            className="h-6 w-6"
          >
            <Icon icon={FolderOpen} size={13} />
          </DaVinciButton>
        </div>
      </div>

      <DaVinciButton 
        variant="primary"
        onClick={onQueueDownload}
        disabled={!url.trim() || infoLoading}
        className="w-full h-8 mt-4"
        icon={<Icon icon={Download} size={14} />}
      >
        Add to Queue
      </DaVinciButton>
    </div>
  );
};
