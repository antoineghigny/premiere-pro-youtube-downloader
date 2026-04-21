import React, { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { DaVinciPanel } from '../components/davinci-ui';
import { UrlBar } from '../components/download/UrlBar';
import { DownloadTable } from '../components/download/DownloadTable';
import { DownloadGrid } from '../components/download/DownloadGrid';
import { FFmpegPanel } from '../components/download/FFmpegPanel';
import { ClipPanel } from '../components/download/ClipPanel';
import { VideoMonitor } from '../components/download/VideoMonitor';
import { cn } from '@/lib/utils';
import { Settings2, Scissors, Search, LayoutGrid, List, Activity, Monitor } from 'lucide-react';
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
  backendConnected: boolean;
}

export const MediaPage: React.FC<MediaPageProps> = (props) => {
  const [inspectorTab, setInspectorTab] = useState<'options' | 'clip'>('options');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  return (
    <div className="flex-1 overflow-hidden bg-rv-window p-0.5">
      <Group orientation="vertical">
        {/* TOP ROW: Media Pool & Source Viewer */}
        <Panel defaultSize={65} minSize={30}>
          <Group orientation="horizontal">
            {/* MEDIA POOL (Left) */}
            <Panel defaultSize={60} minSize={30}>
              <DaVinciPanel 
                header={
                  <div className="flex flex-1 items-center gap-2">
                    <span className="flex-1">Media Pool</span>
                    <div className="flex items-center gap-1 mr-2">
                      <div className="relative mr-2">
                        <Icon icon={Search} size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
                        <input 
                          type="text"
                          placeholder="Search Clips..."
                          className="rv-input pl-6 w-[150px] h-[18px] text-[10px] uppercase font-bold tracking-tight"
                          value={props.downloads.filterText || ''}
                          onChange={(e) => props.downloads.setFilterText?.(e.target.value)}
                        />
                      </div>
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
                <div className="h-full overflow-y-auto p-2">
                  {viewMode === 'grid' ? (
                    <DownloadGrid 
                      items={props.downloads.items}
                      onReveal={props.downloads.revealDownload}
                      onRetry={props.downloads.retryDownload}
                      onDelete={props.downloads.deleteDownload}
                    />
                  ) : (
                    <DownloadTable 
                      items={props.downloads.items}
                      onReveal={props.downloads.revealDownload}
                      onRetry={props.downloads.retryDownload}
                      onDelete={props.downloads.deleteDownload}
                    />
                  )}
                </div>
              </DaVinciPanel>
            </Panel>

            <Separator className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

            {/* SOURCE VIEWER (Right) */}
            <Panel defaultSize={40} minSize={30}>
              <DaVinciPanel 
                header={
                  <div className="flex items-center gap-2 w-full">
                    <Icon icon={Monitor} size={11} className="text-rv-text-muted" />
                    <span className="flex-1">Source Viewer</span>
                    {props.info && (
                      <div className="flex gap-2 items-center text-[10px] font-mono text-rv-accent mr-2">
                        {props.info.duration || '00:00:00:00'}
                      </div>
                    )}
                  </div>
                }
                className="h-full"
              >
                <div className="flex-1 h-full overflow-hidden rv-checkerboard relative">
                  <VideoMonitor info={props.info} loading={props.infoLoading} />
                  {!props.url && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                       <div className="text-rv-text-disabled uppercase tracking-[0.3em] font-black text-xs opacity-20 select-none">
                         Ready for Input
                       </div>
                    </div>
                  )}
                </div>
              </DaVinciPanel>
            </Panel>
          </Group>
        </Panel>

        <Separator className="h-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

        {/* BOTTOM ROW: Ingestion & Inspector */}
        <Panel defaultSize={35} minSize={20}>
          <Group orientation="horizontal">
            {/* INGESTION CONTROL (Left) */}
            <Panel defaultSize={70} minSize={40}>
              <DaVinciPanel header="Ingestion Control" className="h-full">
                <div className="p-4 h-full overflow-y-auto max-w-[800px] mx-auto">
                   <UrlBar
                    url={props.url}
                    onUrlChange={props.onUrlChange}
                    onQueueDownload={props.onQueueDownload}
                    info={props.info}
                    infoLoading={props.infoLoading}
                    infoError={props.infoError}
                    quality={props.quality}
                    onQualityChange={props.onQualityChange}
                    outputTarget={props.outputTarget}
                    onOutputTargetChange={props.onOutputTargetChange}
                    folderOverride={props.folderOverride}
                    onFolderOverrideChange={props.onFolderOverrideChange}
                    onPickFolder={props.onPickFolder}
                    settings={props.settings}
                    premiereStatus={props.premiereStatus}
                  />
                  
                  {/* Backend Status in Ingestion */}
                  <div className="mt-4 flex items-center justify-between border-t border-rv-border-inset pt-4">
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                           <div className={cn("w-2 h-2 rounded-full", props.backendConnected ? "bg-rv-ok" : "bg-rv-error")} />
                           <span className="text-[10px] font-bold text-rv-text-muted uppercase tracking-wider">Backend Status</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <Icon icon={Activity} size={11} className={cn(props.premiereStatus.running ? "text-rv-accent" : "text-rv-text-disabled")} />
                           <span className="text-[10px] font-bold text-rv-text-muted uppercase tracking-wider">Adobe Premiere</span>
                        </div>
                     </div>
                     {props.info && (
                        <div className="text-[10px] text-rv-text-strong font-mono uppercase bg-rv-raised px-2 py-0.5 border border-rv-border-inset rounded-[1px]">
                           {props.info.title}
                        </div>
                     )}
                  </div>
                </div>
              </DaVinciPanel>
            </Panel>

            <Separator className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

            {/* INSPECTOR (Right) */}
            <Panel defaultSize={30} minSize={25}>
              <DaVinciPanel className="h-full">
                <div className="flex bg-rv-raised h-[26px] border-b border-rv-border-inset">
                  <button 
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.1em] font-bold transition-all relative",
                      inspectorTab === 'options' ? "text-rv-orange after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-rv-orange" : "text-rv-text-muted hover:text-rv-text"
                    )}
                    onClick={() => setInspectorTab('options')}
                  >
                    <Icon icon={Settings2} size={11} />
                    Delivery
                  </button>
                  <button 
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.1em] font-bold transition-all relative border-l border-rv-border-inset",
                      inspectorTab === 'clip' ? "text-rv-orange after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-rv-orange" : "text-rv-text-muted hover:text-rv-text"
                    )}
                    onClick={() => setInspectorTab('clip')}
                  >
                    <Icon icon={Scissors} size={11} />
                    Markers
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-rv-panel/50">
                  {inspectorTab === 'options' ? (
                    <FFmpegPanel 
                      options={props.ffmpegOptions} 
                      onChange={props.onFFmpegOptionsChange} 
                      settings={props.settings}
                      premiereStatus={props.premiereStatus}
                    />
                  ) : (
                    <ClipPanel 
                      enabled={props.clipEnabled}
                      onEnabledChange={props.onClipEnabledChange}
                      start={props.clipStart}
                      onStartChange={props.onClipStartChange}
                      end={props.clipEnd}
                      onEndChange={props.onClipEndChange}
                    />
                  )}
                </div>
              </DaVinciPanel>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
};
