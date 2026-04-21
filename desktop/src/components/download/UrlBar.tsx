import React from 'react';
import { Download, FolderOpen, Link2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';
import { Icon } from '../common/Icon';

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
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-[10px] text-[#808080] font-semibold tracking-wider uppercase mb-1.5 block">URL Source</label>
        <div className="relative">
          <Icon icon={Link2} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="h-8 w-full bg-[#141414] border border-[#2a2a2a] text-[#d2d2d2] pl-9 pr-2.5 rounded-[3px] focus:border-[#0078D7] focus:outline-none transition-colors shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] text-[11px]"
            placeholder="Paste YouTube or Video URL..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-[#808080] font-semibold tracking-wider uppercase mb-1.5 block">Format</label>
          <Dropdown
            value={quality}
            options={[
              { value: 'highest', label: 'HIGHEST' },
              { value: '1080', label: '1080p' },
              { value: '720', label: '720p' },
            ]}
            onChange={(e) => onQualityChange(e.target.value)}
            className="h-8 bg-[#141414] border-[#2a2a2a]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#808080] font-semibold tracking-wider uppercase mb-1.5 block">Target</label>
          <Dropdown
            value={outputTarget}
            options={[
              { value: 'downloadFolder', label: 'DISK' },
              { value: 'premiereProject', label: 'PROJECT' },
            ]}
            onChange={(e) => onOutputTargetChange(e.target.value)}
            className="h-8 bg-[#141414] border-[#2a2a2a]"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-[#808080] font-semibold tracking-wider uppercase mb-1.5 block">Download Path</label>
        <div className="flex gap-1.5">
          <input 
            value={folderOverride}
            onChange={(e) => onFolderOverrideChange(e.target.value)}
            placeholder={settings.downloadPath || "Select folder..."}
            className="h-8 flex-1 bg-[#141414] border border-[#2a2a2a] text-[#d2d2d2] px-2.5 rounded-[3px] focus:border-[#0078D7] focus:outline-none shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] text-[10px] font-mono"
          />
          <button 
            onClick={onPickFolder}
            className="h-8 w-8 bg-[#383838] hover:bg-[#454545] border border-[#111] flex items-center justify-center rounded-[3px]"
          >
            <Icon icon={FolderOpen} size={14} className="text-[#aaa]" />
          </button>
        </div>
      </div>

      <button 
        onClick={onQueueDownload}
        disabled={!url.trim() || infoLoading}
        className="h-8 w-full bg-[#F96302] hover:bg-[#ff7b24] text-white font-bold text-[11px] tracking-widest rounded-[3px] border border-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-all flex items-center justify-center mt-4 uppercase disabled:opacity-30 disabled:grayscale"
      >
        <Icon icon={Download} size={14} className="mr-2" />
        Add to Queue
      </button>
    </div>
  );
}
