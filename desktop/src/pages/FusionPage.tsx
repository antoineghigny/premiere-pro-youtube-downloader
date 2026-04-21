import React, { useState, useRef, useEffect } from 'react';
import { Panel as RvPanel } from '../components/shell/Panel';
import { PanelHeader } from '../components/shell/PanelHeader';
import { useMotionStudio } from '../hooks/useMotionStudio';
import { cn } from '@/lib/utils';
import { Play, Square, Save, WandSparkles, Sparkles, Bot } from 'lucide-react';
import { Icon } from '../components/common/Icon';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface FusionPageProps {
  studio: ReturnType<typeof useMotionStudio>;
  settings: any;
}

export const FusionPage: React.FC<FusionPageProps> = ({ studio, settings }) => {
  const [leftTab, setLeftTab] = useState<'brief' | 'design' | 'source'>('brief');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewDuration = studio.selectedArtifact?.artifact.durationSeconds ?? studio.selectedSummary?.durationSeconds ?? 0;
  const [previewTime, setPreviewTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setPreviewTime(0);
    setIsPlaying(false);
  }, [studio.selectedArtifactId, studio.selectedArtifact?.htmlSource]);

  useEffect(() => {
    if (!studio.selectedArtifact?.htmlSource) {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'yt2pp:setTime', seconds: previewTime },
      '*'
    );
  }, [previewTime, studio.selectedArtifact?.htmlSource]);

  useEffect(() => {
    if (!isPlaying || previewDuration <= 0) {
      return;
    }

    const startedAt = performance.now() - previewTime * 1000;
    const intervalId = window.setInterval(() => {
      const nextSeconds = Math.min((performance.now() - startedAt) / 1000, previewDuration);
      setPreviewTime(nextSeconds);
      if (nextSeconds >= previewDuration) {
        setIsPlaying(false);
      }
    }, 33);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, previewDuration, previewTime]);

  return (
    <div className="flex-1 overflow-hidden bg-rv-window p-1">
      <PanelGroup direction="vertical">
        <Panel defaultSize={70} minSize={30}>
          <PanelGroup direction="horizontal">
            {/* Left: Brief/Design/Source */}
            <Panel defaultSize={25} minSize={15}>
              <RvPanel className="h-full">
                <div className="flex bg-rv-raised h-[24px] border-b border-rv-border-inset border-t border-t-rv-border-relief">
                  {(['brief', 'design', 'source'] as const).map((tab) => (
                    <button
                      key={tab}
                      className={cn(
                        "px-3 text-[10px] uppercase font-bold tracking-widest transition-colors border-r border-rv-border-inset relative",
                        leftTab === tab 
                          ? "bg-rv-panel text-rv-orange after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-rv-orange" 
                          : "text-rv-text-muted hover:text-rv-text"
                      )}
                      onClick={() => setLeftTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex-1 p-3 overflow-hidden flex flex-col gap-3">
                  {leftTab === 'brief' && (
                    <>
                      <label className="rv-label">Composition Prompt</label>
                      <textarea 
                        className="rv-input w-full flex-1 resize-none p-2 leading-relaxed font-sans"
                        value={studio.prompt}
                        onChange={(e) => studio.setPrompt(e.target.value)}
                        placeholder="Describe your motion graphic..."
                      />
                      <button 
                        className="rv-button-primary rv-button h-[26px] mt-1"
                        disabled={!studio.prompt.trim() || studio.busyAction !== null}
                        onClick={() => void studio.generateCurrentPrompt()}
                      >
                        <Icon icon={WandSparkles} size={14} />
                        {studio.busyAction === 'generate' ? 'Generating...' : 'GENERATE OVERLAY'}
                      </button>
                    </>
                  )}
                  {leftTab === 'design' && (
                    <>
                      <label className="rv-label">Design Tokens (JSON/YAML)</label>
                      <textarea 
                        className="rv-input w-full flex-1 resize-none p-2 font-mono text-[11px]"
                        value={studio.designDraft}
                        onChange={(e) => studio.setDesignDraft(e.target.value)}
                      />
                      <button 
                        className="rv-button w-full h-[26px] mt-1"
                        disabled={!studio.designDirty || studio.busyAction !== null}
                        onClick={() => void studio.saveDesign()}
                      >
                        <Icon icon={Save} size={14} />
                        {studio.busyAction === 'saveDesign' ? 'Saving...' : 'SAVE DESIGN'}
                      </button>
                    </>
                  )}
                  {leftTab === 'source' && (
                    <div className="flex-1 overflow-y-auto font-mono text-[11px] text-rv-text-muted p-2 bg-rv-input border border-rv-border-inset select-text">
                      <pre className="whitespace-pre-wrap break-all leading-tight">
                        {studio.selectedArtifact?.htmlSource || "No source code available."}
                      </pre>
                    </div>
                  )}
                </div>
              </RvPanel>
            </Panel>

            <PanelResizeHandle className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

            {/* Center: Preview */}
            <Panel defaultSize={50} minSize={30}>
              <RvPanel className="h-full border-x-0">
                <PanelHeader title="Program Viewer" />
                <div className="flex-1 rv-checkerboard relative overflow-hidden">
                  {studio.selectedArtifact?.htmlSource ? (
                    <iframe
                      ref={iframeRef}
                      title="Motion Studio Preview"
                      className="w-full h-full bg-transparent"
                      sandbox="allow-scripts"
                      srcDoc={studio.selectedArtifact.htmlSource}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-rv-text-disabled uppercase tracking-[0.3em] font-black text-xl opacity-20 select-none">
                      NO INPUT
                    </div>
                  )}
                </div>
                {/* Viewer Controls */}
                <div className="h-[36px] bg-rv-raised border-t border-rv-border-inset border-t-rv-border-relief flex items-center px-3 gap-4">
                  <div className="flex items-center gap-1.5">
                    <button 
                      className={cn(
                        "rv-button p-0 w-8 h-[24px]",
                        isPlaying && "rv-button-active"
                      )}
                      onClick={() => setIsPlaying(!isPlaying)}
                      disabled={!studio.selectedArtifact?.htmlSource}
                    >
                      <Icon icon={isPlaying ? Square : Play} size={14} fill={isPlaying ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <div className="flex-1 relative h-[6px] bg-rv-input border border-rv-border-inset rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-rv-accent"
                      style={{ width: `${(previewTime / (previewDuration || 1)) * 100}%` }}
                    />
                    <input 
                      type="range"
                      min={0}
                      max={previewDuration || 1}
                      step={0.01}
                      value={previewTime}
                      onChange={(e) => {
                        setIsPlaying(false);
                        setPreviewTime(parseFloat(e.target.value));
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] text-rv-text-strong font-mono tabular-nums w-24 text-right tracking-widest bg-rv-input px-2 py-0.5 border border-rv-border-inset rounded-sm">
                    {Math.floor(previewTime / 60).toString().padStart(2, '0')}:
                    {(previewTime % 60).toFixed(2).padStart(5, '0')}
                  </span>
                </div>
              </RvPanel>
            </Panel>

            <PanelResizeHandle className="w-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

            {/* Right: Renders / Artifacts */}
            <Panel defaultSize={25} minSize={15}>
              <RvPanel className="h-full">
                <PanelHeader title="Inspector / Bin" />
                <div className="flex-1 overflow-y-auto bg-rv-input/20">
                  {studio.artifacts.map((artifact) => (
                    <button
                      key={artifact.jobId}
                      className={cn(
                        "w-full px-3 py-2 border-b border-rv-border-inset text-left hover:bg-rv-raised transition-colors group relative",
                        studio.selectedArtifactId === artifact.jobId && "bg-rv-button-pressed border-l-2 border-l-rv-orange"
                      )}
                      onClick={() => studio.setSelectedArtifactId(artifact.jobId)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className={cn(
                          "text-[11px] font-bold truncate tracking-wide",
                          studio.selectedArtifactId === artifact.jobId ? "text-rv-orange" : "text-rv-text"
                        )}>
                          {artifact.title.toUpperCase()}
                        </span>
                        {artifact.renderPath && (
                          <Icon icon={Sparkles} size={11} className="text-rv-accent shrink-0" />
                        )}
                      </div>
                      <div className="text-[9px] text-rv-text-muted mt-0.5 line-clamp-1 opacity-70 italic">{artifact.prompt}</div>
                      <div className="flex gap-2 mt-2">
                         <span className="text-[8px] border border-rv-border-inset px-1.5 py-0.5 rounded-[1px] bg-rv-raised text-rv-text-muted font-bold tracking-tighter">
                           {artifact.width}x{artifact.height}
                         </span>
                         <span className="text-[8px] border border-rv-border-inset px-1.5 py-0.5 rounded-[1px] bg-rv-raised text-rv-text-muted font-bold tracking-tighter">
                           {artifact.fps.toFixed(0)} FPS
                         </span>
                      </div>
                    </button>
                  ))}
                  {studio.artifacts.length === 0 && (
                    <div className="p-4 text-[10px] text-rv-text-disabled text-center uppercase tracking-[0.2em] mt-10">
                      Empty Bin
                    </div>
                  )}
                </div>
                <div className="p-3 bg-rv-raised border-t border-rv-border-inset border-t-rv-border-relief flex flex-col gap-2">
                   <button 
                     className="rv-button w-full h-[26px]"
                     disabled={!studio.selectedSummary || studio.busyAction !== null}
                     onClick={() => studio.selectedSummary && void studio.renderArtifact(studio.selectedSummary.jobId)}
                   >
                     <Icon icon={Sparkles} size={12} />
                     {studio.busyAction === 'render' ? 'RENDERING...' : 'RENDER PRORES 4444'}
                   </button>
                   <button 
                     className="rv-button w-full h-[26px]"
                     disabled={!studio.selectedSummary?.renderPath || studio.busyAction !== null}
                     onClick={() => studio.selectedSummary && void studio.importArtifact(studio.selectedSummary.jobId)}
                   >
                     <Icon icon={Bot} size={12} />
                     {studio.busyAction === 'import' ? 'IMPORTING...' : 'IMPORT TO PREMIERE'}
                   </button>
                </div>
              </RvPanel>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-[1px] bg-rv-border-inset hover:bg-rv-accent/50 transition-colors" />

        {/* Bottom: Timeline */}
        <Panel defaultSize={30} minSize={20}>
          <RvPanel className="h-full">
            <PanelHeader title="Timeline / Fusion Nodes" />
            <div className="flex-1 relative bg-[#151515] overflow-hidden flex flex-col">
              {/* Time Ruler */}
              <div className="h-[24px] border-b border-rv-border-inset bg-rv-raised/50 flex items-end px-2 gap-20 overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-start min-w-[80px]">
                    <span className="text-[9px] text-rv-text-muted font-mono border-l border-rv-border-strong pl-1 h-3 leading-none font-bold">
                      {Math.floor((i * 5) / 60)}:{(i * 5 % 60).toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>
              {/* Tracks Area */}
              <div className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <div className="w-16 text-[9px] text-rv-text-muted font-bold border-r border-rv-border-inset pr-2 text-right">VIDEO 1</div>
                  <div className="flex-1 h-10 bg-rv-accent-muted/10 border border-rv-accent/30 relative group overflow-hidden rounded-sm">
                     <div className="absolute inset-y-0 left-0 bg-rv-accent/20 border-r border-rv-accent" style={{ width: `${(previewDuration / 100) * 100}%` }} />
                     <span className="absolute inset-0 flex items-center px-3 text-[10px] text-rv-accent font-black uppercase tracking-[0.2em] drop-shadow-md">
                       {studio.selectedArtifact?.artifact.title || "NO CLIP"}
                     </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 opacity-30">
                  <div className="w-16 text-[9px] text-rv-text-muted font-bold border-r border-rv-border-inset pr-2 text-right">VIDEO 2</div>
                  <div className="flex-1 h-10 bg-rv-raised/20 border border-rv-border-inset border-dashed" />
                </div>
              </div>
              {/* Playhead */}
              <div 
                className="absolute top-[24px] bottom-0 w-[1px] bg-rv-playhead z-10 pointer-events-none"
                style={{ left: `${64 + (previewTime / 100) * (100 - 6.4)}%` }} // Rough offset for track label
              >
                <div className="w-[1px] h-full bg-rv-playhead shadow-[0_0_8px_rgba(255,59,48,0.4)]" />
                <div className="absolute -top-[12px] -left-[5px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-rv-playhead" />
              </div>
            </div>
          </RvPanel>
        </Panel>
      </PanelGroup>
    </div>
  );
};
