import React, { useState } from 'react';
import { Panel } from '../components/shell/Panel';
import { PanelHeader } from '../components/shell/PanelHeader';
import { UrlBar } from '../components/download/UrlBar';
import { DownloadTable } from '../components/download/DownloadTable';
import { FFmpegPanel } from '../components/download/FFmpegPanel';
import { ClipPanel } from '../components/download/ClipPanel';
import { useTranslation } from '../i18n';
import { cn } from '@/lib/utils';
import { ListFilter, LayoutGrid, List } from 'lucide-react';
import { Icon } from '../components/common/Icon';

interface MediaPageProps {
  // Pass necessary props from App.tsx
  url: string;
  onUrlChange: (url: string) => void;
  onQueueDownload: () => Promise<void>;
  info: any;
  infoLoading: boolean;
  infoError: string;
  quality: string;
  onQualityChange: (q: string) => void;
  outputTarget: any;
  onOutputTargetChange: (t: any) => void;
  folderOverride: string;
  onFolderOverrideChange: (f: string) => void;
  onPickFolder: () => Promise<void>;
  ffmpegOptions: any;
  onFFmpegOptionsChange: (o: any) => void;
  clipEnabled: boolean;
  onClipEnabledChange: (e: boolean) => void;
  clipStart: string;
  onClipStartChange: (s: string) => void;
  clipEnd: string;
  onClipEndChange: (e: string) => void;
  downloads: any;
  settings: any;
  premiereStatus: any;
}

export const MediaPage: React.FC<MediaPageProps> = ({
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
  ffmpegOptions,
  onFFmpegOptionsChange,
  clipEnabled,
  onClipEnabledChange,
  clipStart,
  onClipStartChange,
  clipEnd,
  onClipEndChange,
  downloads,
  settings,
  premiereStatus,
}) => {
  const t = useTranslation();
  const [rightPanelTab, setRightPanelTab] = useState<'options' | 'clip'>('options');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  return (
    <div className="flex-1 grid grid-cols-[1fr_420px] grid-rows-[auto_1fr] overflow-hidden bg-rv-window">
      {/* Top Left: URL Bar */}
      <Panel className="border-r-0 border-b-0">
        <PanelHeader title="Source" />
        <div className="p-2">
          <UrlBar
            url={url}
            onUrlChange={onUrlChange}
            onQueueDownload={onQueueDownload}
            info={info}
            infoLoading={infoLoading}
            infoError={infoError}
            quality={quality}
            onQualityChange={onQualityChange}
            outputTarget={outputTarget}
            onOutputTargetChange={onOutputTargetChange}
            folderOverride={folderOverride}
            onFolderOverrideChange={onFolderOverrideChange}
            onPickFolder={onPickFolder}
            settings={settings}
            premiereStatus={premiereStatus}
          />
        </div>
      </Panel>

      {/* Top Right: Inspector/Options Tabs */}
      <Panel className="border-b-0">
        <div className="flex bg-rv-raised h-[22px] border-b border-rv-border-inset">
          <button 
            className={cn(
              "px-4 text-[10px] uppercase tracking-wider transition-colors",
              rightPanelTab === 'options' ? "bg-rv-panel text-rv-text-strong border-r border-rv-border-inset" : "text-rv-text-muted hover:text-rv-text"
            )}
            onClick={() => setRightPanelTab('options')}
          >
            Options
          </button>
          <button 
            className={cn(
              "px-4 text-[10px] uppercase tracking-wider transition-colors",
              rightPanelTab === 'clip' ? "bg-rv-panel text-rv-text-strong border-l border-rv-border-inset" : "text-rv-text-muted hover:text-rv-text"
            )}
            onClick={() => setRightPanelTab('clip')}
          >
            Clip
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {rightPanelTab === 'options' ? (
            <FFmpegPanel 
              options={ffmpegOptions} 
              onChange={onFFmpegOptionsChange} 
              settings={settings}
              premiereStatus={premiereStatus}
            />
          ) : (
            <ClipPanel 
              enabled={clipEnabled}
              onEnabledChange={onClipEnabledChange}
              start={clipStart}
              onStartChange={onClipStartChange}
              end={clipEnd}
              onEndChange={onClipEndChange}
            />
          )}
        </div>
      </Panel>

      {/* Bottom: Queue Panel */}
      <Panel className="col-span-2 border-t-rv-border-relief">
        <PanelHeader>
          <div className="flex flex-1 items-center gap-2">
            <span className="flex-1">Queue</span>
            <div className="flex items-center gap-1 mr-2">
              <div className="relative">
                <Icon icon={ListFilter} size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
                <input 
                  type="text"
                  placeholder="Filter..."
                  className="rv-input pl-6 w-[180px] h-[18px] text-[10px]"
                  value={downloads.filterText}
                  onChange={(e) => downloads.setFilterText(e.target.value)}
                />
              </div>
              <div className="flex border border-rv-border-inset rounded-[2px] overflow-hidden ml-2">
                <button 
                  className={cn("p-1 hover:bg-rv-button-hover", viewMode === 'list' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
                  onClick={() => setViewMode('list')}
                >
                  <Icon icon={List} size={12} />
                </button>
                <button 
                  className={cn("p-1 hover:bg-rv-button-hover", viewMode === 'grid' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
                  onClick={() => setViewMode('grid')}
                >
                  <Icon icon={LayoutGrid} size={12} />
                </button>
              </div>
            </div>
          </div>
        </PanelHeader>
        <div className="flex-1 overflow-hidden">
          <DownloadTable 
            items={downloads.items}
            onReveal={downloads.revealDownload}
            onRetry={downloads.retryDownload}
            onDelete={downloads.deleteDownload}
            viewMode={viewMode}
          />
        </div>
      </Panel>
    </div>
  );
};
