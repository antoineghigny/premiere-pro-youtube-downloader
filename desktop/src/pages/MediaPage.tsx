import React, { useState, useCallback, useMemo } from 'react';
import * as FlexLayout from 'flexlayout-react';
import { DaVinciPanel } from '../components/davinci-ui';
import { UrlBar } from '../components/download/UrlBar';
import { DownloadTable } from '../components/download/DownloadTable';
import { FFmpegPanel } from '../components/download/FFmpegPanel';
import { ClipPanel } from '../components/download/ClipPanel';
import { VideoMonitor } from '../components/download/VideoMonitor';
import { cn } from '@/lib/utils';
import { Settings2, Scissors, Search, List, PlaySquare, Video, Info } from 'lucide-react';
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

const INITIAL_LAYOUT: FlexLayout.IJsonModel = {
  global: {
    tabSetHeaderHeight: 26,
    tabSetTabLocation: "top",
    splitterSize: 3
  },
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        weight: 30,
        children: [
          { type: "tab", name: "Source", component: "source_ingestion", icon: "video" }
        ]
      },
      {
        type: "tabset",
        weight: 45,
        children: [
          { type: "tab", name: "Media Pool", component: "media_pool", icon: "list" }
        ]
      },
      {
        type: "tabset",
        weight: 25,
        children: [
          { type: "tab", name: "Inspector", component: "inspector", icon: "settings" }
        ]
      }
    ]
  }
};

export const MediaPage: React.FC<MediaPageProps> = (props) => {
  const [model] = useState(() => FlexLayout.Model.fromJson(INITIAL_LAYOUT));
  const [inspectorTab, setInspectorTab] = useState<'options' | 'clip'>('options');

  const factory = useCallback((node: FlexLayout.TabNode) => {
    const component = node.getComponent();

    if (component === "source_ingestion") {
      return (
        <div className="flex flex-col h-full bg-rv-panel overflow-y-auto">
          {/* Thumb Monitor */}
          {(props.url || props.infoLoading) && (
            <div className="shrink-0 border-b border-rv-border-inset bg-black rv-checkerboard relative" style={{ height: '180px' }}>
              <VideoMonitor info={props.info} loading={props.infoLoading} />
            </div>
          )}
          
          <div className="p-4 flex flex-col gap-4">
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
        </div>
      );
    }

    if (component === "media_pool") {
      return (
        <div className="flex flex-col h-full bg-rv-window">
          <div className="p-2 border-b border-rv-border-inset bg-rv-panel/30 flex items-center gap-2">
            <div className="relative flex-1">
              <Icon icon={Search} size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
              <input 
                type="text"
                placeholder="Search Media Pool..."
                className="rv-input pl-7 w-full h-[22px] text-[10px] uppercase font-bold tracking-tight"
                value={props.downloads.filterText || ''}
                onChange={(e) => props.downloads.setFilterText?.(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <DownloadTable 
              items={props.downloads.items}
              onReveal={props.downloads.revealDownload}
              onRetry={props.downloads.retryDownload}
              onDelete={props.downloads.deleteDownload}
              viewMode="list"
            />
          </div>
        </div>
      );
    }

    if (component === "inspector") {
      return (
        <div className="flex flex-col h-full bg-rv-panel">
          <div className="flex bg-rv-raised h-[26px] border-b border-rv-border-inset">
            <button 
              className={cn(
                "flex-1 flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.1em] font-bold transition-all relative",
                inspectorTab === 'options' ? "text-rv-orange after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-rv-orange" : "text-rv-text-muted hover:text-rv-text"
              )}
              onClick={() => setInspectorTab('options')}
            >
              <Icon icon={Settings2} size={11} />
              Delivery
            </button>
            <button 
              className={cn(
                "flex-1 flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.1em] font-bold transition-all relative border-l border-rv-border-inset",
                inspectorTab === 'clip' ? "text-rv-orange after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-rv-orange" : "text-rv-text-muted hover:text-rv-text"
              )}
              onClick={() => setInspectorTab('clip')}
            >
              <Icon icon={Scissors} size={11} />
              Markers
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
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
        </div>
      );
    }

    return <div>Component not found</div>;
  }, [props, inspectorTab]);

  return (
    <div className="flex-1 overflow-hidden relative">
      <FlexLayout.Layout 
        model={model} 
        factory={factory} 
        font={{ size: "10px", family: "var(--font-sans)" }}
      />
    </div>
  );
};
