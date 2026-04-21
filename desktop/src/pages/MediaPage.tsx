import React, { useState } from 'react';
import { DaVinciPanel } from '../components/davinci-ui';
import { UrlBar } from '../components/download/UrlBar';
import { DownloadTable } from '../components/download/DownloadTable';
import { DownloadGrid } from '../components/download/DownloadGrid';
import { FFmpegPanel } from '../components/download/FFmpegPanel';
import { ClipPanel } from '../components/download/ClipPanel';
import { VideoMonitor } from '../components/download/VideoMonitor';
import { cn } from '@/lib/utils';
import { Settings2, Scissors, Search, LayoutGrid, List, Activity, Monitor, PlaySquare, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-rv-window p-1 gap-1">
      
      {/* TOP SECTION: Ingestion (Always at top like main) */}
      <div className="shrink-0 flex gap-1 items-stretch">
        <DaVinciPanel header="Ingestion" className="flex-1 min-w-0">
          <div className="p-3">
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
          </div>
        </DaVinciPanel>

        {/* Tiny Preview (Source Viewer integrated) */}
        {props.url && (
          <DaVinciPanel 
            header={
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">Preview</span>
                <span className="text-rv-accent font-mono text-[9px]">{props.info?.duration}</span>
              </div>
            }
            className="w-[180px] shrink-0"
          >
            <div className="h-full bg-black rv-checkerboard relative overflow-hidden">
              <VideoMonitor info={props.info} loading={props.infoLoading} />
            </div>
          </DaVinciPanel>
        )}

        {/* Expandable Inspector (Delivery/Markers) */}
        <div className={cn("transition-all duration-300 flex flex-col", isInspectorOpen ? "w-[300px]" : "w-[40px]")}>
          <DaVinciPanel className="h-full">
            <div className="flex bg-rv-raised h-[24px] border-b border-rv-border-inset">
              {isInspectorOpen ? (
                <>
                  <button 
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 text-[9px] uppercase font-bold transition-all relative",
                      inspectorTab === 'options' ? "text-rv-orange after:absolute after:bottom-0 after:h-[1.5px] after:bg-rv-orange w-full" : "text-rv-text-muted hover:text-rv-text"
                    )}
                    onClick={() => setInspectorTab('options')}
                  >
                    <Icon icon={Settings2} size={11} />
                    Delivery
                  </button>
                  <button 
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 text-[9px] uppercase font-bold transition-all relative border-l border-rv-border-inset",
                      inspectorTab === 'clip' ? "text-rv-orange after:absolute after:bottom-0 after:h-[1.5px] after:bg-rv-orange w-full" : "text-rv-text-muted hover:text-rv-text"
                    )}
                    onClick={() => setInspectorTab('clip')}
                  >
                    <Icon icon={Scissors} size={11} />
                    Markers
                  </button>
                  <button 
                    className="w-8 flex items-center justify-center text-rv-text-disabled hover:text-rv-text border-l border-rv-border-inset"
                    onClick={() => setIsInspectorOpen(false)}
                  >
                    <Icon icon={ChevronDown} size={12} className="rotate-90" />
                  </button>
                </>
              ) : (
                <button 
                  className="flex-1 flex items-center justify-center text-rv-text-disabled hover:text-rv-text"
                  onClick={() => setIsInspectorOpen(true)}
                >
                  <Icon icon={Settings2} size={12} />
                </button>
              )}
            </div>
            {isInspectorOpen && (
              <div className="flex-1 overflow-y-auto p-3 bg-rv-panel/50">
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
            )}
          </DaVinciPanel>
        </div>
      </div>

      {/* CENTER SECTION: Media Pool (Main area, large like main) */}
      <DaVinciPanel 
        header={
          <div className="flex flex-1 items-center gap-2">
            <span className="flex-1">Media Pool (Downloads)</span>
            <div className="flex items-center gap-1 mr-2">
              <div className="relative mr-2">
                <Icon icon={Search} size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
                <input 
                  type="text"
                  placeholder="Filter pool..."
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
        className="flex-1 min-h-0"
      >
        <div className="h-full overflow-hidden bg-black/10">
          {viewMode === 'grid' ? (
            <div className="p-4 overflow-y-auto h-full">
              <DownloadGrid 
                items={props.downloads.items}
                onReveal={props.downloads.revealDownload}
                onRetry={props.downloads.retryDownload}
                onDelete={props.downloads.deleteDownload}
              />
            </div>
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

      {/* FOOTER STATUS */}
      <div className="shrink-0 h-[24px] rv-panel-surface flex items-center px-3 justify-between bg-rv-raised border-t border-rv-border-inset">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", props.backendConnected ? "bg-rv-ok" : "bg-rv-error")} />
            <span className="text-[9px] font-bold text-rv-text-muted uppercase tracking-widest">Backend</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon={Activity} size={10} className={cn(props.premiereStatus.running ? "text-rv-accent" : "text-rv-text-disabled")} />
            <span className="text-[9px] font-bold text-rv-text-muted uppercase tracking-widest">Premiere</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-rv-text-disabled uppercase font-bold tracking-tighter">
            {props.downloads.items.length} clips in pool
          </span>
          <button 
            onClick={() => props.downloads.clearCompleted()}
            className="text-[9px] font-bold text-rv-text-muted hover:text-rv-text uppercase border border-rv-border-inset px-1.5 py-0.5 rounded-[1px] hover:bg-rv-button-hover"
          >
            Clear Finished
          </button>
        </div>
      </div>
    </div>
  );
};
