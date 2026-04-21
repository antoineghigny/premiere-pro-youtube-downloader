import React, { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { DaVinciPanel } from '../components/davinci-ui';
import { UrlBar } from '../components/download/UrlBar';
import { DownloadTable } from '../components/download/DownloadTable';
import { FFmpegPanel } from '../components/download/FFmpegPanel';
import { ClipPanel } from '../components/download/ClipPanel';
import { VideoMonitor } from '../components/download/VideoMonitor';
import { useTranslation } from '../i18n';
import { cn } from '@/lib/utils';
import { ListFilter, LayoutGrid, List, Settings2, Scissors, Search } from 'lucide-react';
import { Icon } from '../components/common/Icon';

interface CutPageProps {
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

export const CutPage: React.FC<CutPageProps> = ({
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
    <div className="flex-1 overflow-hidden bg-rv-window p-0.5">
      <Group orientation="horizontal">
        {/* LEFT COLUMN: Media Pool & Search */}
        <Panel defaultSize={25} minSize={20}>
          <DaVinciPanel 
            header={
              <div className="flex flex-1 items-center gap-2">
                <span className="flex-1">Media Pool</span>
                <div className="flex items-center gap-1 mr-2">
                  <div className="flex border border-rv-border-inset rounded-[1px] overflow-hidden h-[18px]">
                    <button 
                      className={cn("px-1.5 hover:bg-rv-button-hover", viewMode === 'list' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
                      onClick={() => setViewMode('list')}
                    >
                      <Icon icon={List} size={10} />
                    </button>
                    <button 
                      className={cn("px-1.5 hover:bg-rv-button-hover", viewMode === 'grid' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
                      onClick={() => setViewMode('grid')}
                    >
                      <Icon icon={LayoutGrid} size={10} />
                    </button>
                  </div>
                </div>
              </div>
            }
            className="h-full"
          >
            <div className="flex flex-col h-full">
              <div className="p-2 border-b border-rv-border-inset bg-rv-panel/30">
                <div className="relative">
                  <Icon icon={Search} size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
                  <input 
                    type="text"
                    placeholder="Filter Clips..."
                    className="rv-input pl-6 w-full h-[20px] text-[10px] uppercase font-bold tracking-tight"
                    value={downloads.filterText || ''}
                    onChange={(e) => downloads.setFilterText?.(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <DownloadTable 
                  items={downloads.items}
                  onReveal={downloads.revealDownload}
                  onRetry={downloads.retryDownload}
                  onDelete={downloads.deleteDownload}
                  viewMode={viewMode}
                />
              </div>
            </div>
          </DaVinciPanel>
        </Panel>

        <Separator className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

        {/* MIDDLE COLUMN: Source Viewer & Ingestion */}
        <Panel defaultSize={50} minSize={30}>
          <Group orientation="vertical">
            <Panel defaultSize={70} minSize={40}>
              <DaVinciPanel 
                header={
                  <div className="flex items-center gap-2 w-full">
                    <span className="flex-1">Source Viewer</span>
                    <div className="flex gap-2 items-center text-[10px] font-mono text-rv-accent mr-4">
                      {info?.duration || '00:00:00:00'}
                    </div>
                  </div>
                }
                className="h-full"
              >
                <div className="flex-1 h-full overflow-hidden rv-checkerboard">
                  <VideoMonitor info={info} loading={infoLoading} />
                </div>
              </DaVinciPanel>
            </Panel>
            
            <Separator className="h-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />
            
            <Panel defaultSize={30} minSize={20}>
              <DaVinciPanel header="Ingestion Control" className="h-full">
                <div className="p-4 h-full overflow-y-auto">
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
              </DaVinciPanel>
            </Panel>
          </Group>
        </Panel>

        <Separator className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

        {/* RIGHT COLUMN: Inspector */}
        <Panel defaultSize={25} minSize={20}>
          <DaVinciPanel className="h-full">
            <div className="flex bg-rv-raised h-[26px] border-b border-rv-border-inset">
              <button 
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.1em] font-bold transition-all relative",
                  rightPanelTab === 'options' ? "text-rv-orange after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-rv-orange" : "text-rv-text-muted hover:text-rv-text"
                )}
                onClick={() => setRightPanelTab('options')}
              >
                <Icon icon={Settings2} size={11} />
                Inspector
              </button>
              <button 
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.1em] font-bold transition-all relative border-l border-rv-border-inset",
                  rightPanelTab === 'clip' ? "text-rv-orange after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-rv-orange" : "text-rv-text-muted hover:text-rv-text"
                )}
                onClick={() => setRightPanelTab('clip')}
              >
                <Icon icon={Scissors} size={11} />
                Markers
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-rv-panel/50">
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
          </DaVinciPanel>
        </Panel>
      </Group>
    </div>
  );
};
