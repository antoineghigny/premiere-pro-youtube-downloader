import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Panel as RvPanel } from '../components/shell/Panel';
import { PanelHeader } from '../components/shell/PanelHeader';
import { UrlBar } from '../components/download/UrlBar';
import { DownloadTable } from '../components/download/DownloadTable';
import { FFmpegPanel } from '../components/download/FFmpegPanel';
import { ClipPanel } from '../components/download/ClipPanel';
import { VideoMonitor } from '../components/download/VideoMonitor';
import { useTranslation } from '../i18n';
import { cn } from '@/lib/utils';
import { ListFilter, LayoutGrid, List, Settings2, Scissors } from 'lucide-react';
import { Icon } from '../components/common/Icon';

interface MediaPageProps {
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
    <div className="flex-1 overflow-hidden bg-rv-window p-1">
      <PanelGroup direction="horizontal">
        {/* LEFT COLUMN: Ingestion & Media Pool */}
        <Panel defaultSize={30} minSize={20}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={40} minSize={20}>
              <RvPanel className="h-full">
                <PanelHeader title="Ingestion" />
                <div className="p-4 overflow-y-auto">
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
              </RvPanel>
            </Panel>
            
            <PanelResizeHandle className="h-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />
            
            <Panel defaultSize={60} minSize={30}>
              <RvPanel className="h-full">
                <PanelHeader>
                  <div className="flex flex-1 items-center gap-2">
                    <span className="flex-1">Media Pool</span>
                    <div className="flex items-center gap-1 mr-2">
                      <div className="relative">
                        <Icon icon={ListFilter} size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
                        <input 
                          type="text"
                          placeholder="Search..."
                          className="rv-input pl-5 w-[100px] h-[18px] text-[10px] uppercase font-bold tracking-tight"
                          value={downloads.filterText}
                          onChange={(e) => downloads.setFilterText(e.target.value)}
                        />
                      </div>
                      <div className="flex border border-rv-border-inset rounded-[2px] overflow-hidden ml-2 h-[18px]">
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
              </RvPanel>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

        {/* MIDDLE COLUMN: Monitor */}
        <Panel defaultSize={40} minSize={30}>
           <RvPanel className="h-full">
              <PanelHeader title="Source Viewer" />
              <div className="flex-1 overflow-hidden rv-checkerboard">
                <VideoMonitor info={info} loading={infoLoading} />
              </div>
           </RvPanel>
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

        {/* RIGHT COLUMN: Inspector */}
        <Panel defaultSize={30} minSize={20}>
          <RvPanel className="h-full">
            <div className="flex bg-rv-raised h-[24px] border-b border-rv-border-inset border-t border-t-rv-border-relief">
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
          </RvPanel>
        </Panel>
      </PanelGroup>
    </div>
  );
};
