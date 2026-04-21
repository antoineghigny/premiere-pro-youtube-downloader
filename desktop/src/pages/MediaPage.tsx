import React, { useState } from 'react';
import { Group, Panel as ResizablePanel, Separator } from 'react-resizable-panels';
import { Panel } from '../components/shell/Panel';
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

const ResizeHandle = ({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical', className?: string }) => (
  <Separator
    className={cn(
      "relative bg-rv-window transition-colors hover:bg-rv-border-strong",
      orientation === 'horizontal' ? "w-1" : "h-1",
      className
    )}
  >
    <div className={cn(
      "absolute z-10",
      orientation === 'horizontal' ? "-left-1 -right-1 top-0 bottom-0 cursor-col-resize" : "-top-1 -bottom-1 left-0 right-0 cursor-row-resize"
    )} />
  </Separator>
);

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
      <Group orientation="horizontal">
        {/* LEFT COLUMN: Ingestion & Media Pool */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <Group orientation="vertical">
            <ResizablePanel defaultSize={40} minSize={30}>
              <Panel className="h-full">
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
              </Panel>
            </ResizablePanel>
            
            <ResizeHandle orientation="vertical" />
            
            <ResizablePanel defaultSize={60} minSize={30}>
              <Panel className="h-full">
                <PanelHeader>
                  <div className="flex flex-1 items-center gap-2">
                    <span className="flex-1">Media Pool</span>
                    <div className="flex items-center gap-1 mr-2">
                      <div className="relative">
                        <Icon icon={ListFilter} size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
                        <input 
                          type="text"
                          placeholder="Filter..."
                          className="rv-input pl-6 w-[120px] h-[18px] text-[10px]"
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
              </Panel>
            </ResizablePanel>
          </Group>
        </ResizablePanel>

        <ResizeHandle orientation="horizontal" />

        {/* MIDDLE COLUMN: Monitor */}
        <ResizablePanel defaultSize={45} minSize={30}>
           <Panel className="h-full mx-1">
              <PanelHeader title="Source Monitor" />
              <div className="flex-1 overflow-hidden">
                <VideoMonitor info={info} loading={infoLoading} />
              </div>
           </Panel>
        </ResizablePanel>

        <ResizeHandle orientation="horizontal" />

        {/* RIGHT COLUMN: Inspector */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <Panel className="h-full">
            <div className="flex bg-rv-raised h-[24px] border-b border-rv-border-inset p-0.5 gap-0.5">
              <button 
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-semibold rounded-[1px] transition-colors",
                  rightPanelTab === 'options' ? "bg-rv-panel text-rv-text-strong shadow-inner border border-rv-border-inset" : "text-rv-text-muted hover:text-rv-text"
                )}
                onClick={() => setRightPanelTab('options')}
              >
                <Icon icon={Settings2} size={12} />
                Inspector
              </button>
              <button 
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-semibold rounded-[1px] transition-colors",
                  rightPanelTab === 'clip' ? "bg-rv-panel text-rv-text-strong shadow-inner border border-rv-border-inset" : "text-rv-text-muted hover:text-rv-text"
                )}
                onClick={() => setRightPanelTab('clip')}
              >
                <Icon icon={Scissors} size={12} />
                Markers
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
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
        </ResizablePanel>
      </Group>
    </div>
  );
};
