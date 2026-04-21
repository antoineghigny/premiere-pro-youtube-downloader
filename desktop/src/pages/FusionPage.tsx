import React, { useState, useRef, useEffect } from 'react';
import { Panel } from '../components/shell/Panel';
import { PanelHeader } from '../components/shell/PanelHeader';
import { useMotionStudio } from '../hooks/useMotionStudio';
import { cn } from '@/lib/utils';
import { Play, Square, Save, FolderOpen, WandSparkles, Sparkles, Bot } from 'lucide-react';
import { Icon } from '../components/common/Icon';

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
    <div className="flex-1 grid grid-cols-[320px_1fr_320px] grid-rows-[1fr_180px] overflow-hidden bg-rv-window">
      {/* Left: Brief/Design/Source */}
      <Panel className="border-r-0 border-b-0">
        <div className="flex bg-rv-raised h-[22px] border-b border-rv-border-inset">
          {(['brief', 'design', 'source'] as const).map((tab) => (
            <button
              key={tab}
              className={cn(
                "px-3 text-[9px] uppercase tracking-wider transition-colors border-r border-rv-border-inset",
                leftTab === tab ? "bg-rv-panel text-rv-text-strong shadow-[inset_0_-2px_0_var(--color-rv-accent)]" : "text-rv-text-muted hover:text-rv-text"
              )}
              onClick={() => setLeftTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 p-2 overflow-hidden flex flex-col gap-2">
          {leftTab === 'brief' && (
            <>
              <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Prompt</label>
              <textarea 
                className="rv-input w-full flex-1 resize-none p-2 leading-relaxed"
                value={studio.prompt}
                onChange={(e) => studio.setPrompt(e.target.value)}
                placeholder="Ask for an overlay..."
              />
              <button 
                className="rv-button w-full h-[28px] mt-1"
                disabled={!studio.prompt.trim() || studio.busyAction !== null}
                onClick={() => void studio.generateCurrentPrompt()}
              >
                <Icon icon={WandSparkles} size={14} />
                {studio.busyAction === 'generate' ? 'Generating...' : 'Generate Overlay'}
              </button>
            </>
          )}
          {leftTab === 'design' && (
            <>
              <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">DESIGN.md</label>
              <textarea 
                className="rv-input w-full flex-1 resize-none p-2 font-mono text-[11px]"
                value={studio.designDraft}
                onChange={(e) => studio.setDesignDraft(e.target.value)}
              />
              <button 
                className="rv-button w-full h-[28px] mt-1"
                disabled={!studio.designDirty || studio.busyAction !== null}
                onClick={() => void studio.saveDesign()}
              >
                <Icon icon={Save} size={14} />
                {studio.busyAction === 'saveDesign' ? 'Saving...' : 'Save Design System'}
              </button>
            </>
          )}
          {leftTab === 'source' && (
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-rv-text-muted p-1 select-text">
              <pre className="whitespace-pre-wrap break-all">
                {studio.selectedArtifact?.htmlSource || "No source available"}
              </pre>
            </div>
          )}
        </div>
      </Panel>

      {/* Center: Preview */}
      <Panel className="border-r-0 border-b-0 flex flex-col">
        <PanelHeader title="Preview" />
        <div className="flex-1 rv-checkerboard relative overflow-hidden group">
          {studio.selectedArtifact?.htmlSource ? (
            <iframe
              ref={iframeRef}
              title="Motion Studio Preview"
              className="w-full h-full bg-transparent"
              sandbox="allow-scripts"
              srcDoc={studio.selectedArtifact.htmlSource}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-rv-text-disabled uppercase tracking-[0.2em]">
              No Composition
            </div>
          )}
        </div>
        <div className="h-[32px] bg-rv-raised border-t border-rv-border-inset flex items-center px-2 gap-3">
          <button 
            className="rv-button-active p-1 rounded-full w-6 h-6 flex items-center justify-center"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!studio.selectedArtifact?.htmlSource}
          >
            <Icon icon={isPlaying ? Square : Play} size={12} fill="currentColor" />
          </button>
          <div className="flex-1 relative h-1 bg-rv-input rounded-full overflow-hidden">
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
          <span className="text-[10px] text-rv-text-muted font-mono w-20 text-right">
            {previewTime.toFixed(2)}s / {previewDuration.toFixed(2)}s
          </span>
        </div>
      </Panel>

      {/* Right: Renders / Artifacts */}
      <Panel className="border-b-0">
        <PanelHeader title="Renders" />
        <div className="flex-1 overflow-y-auto">
          {studio.artifacts.map((artifact) => (
            <button
              key={artifact.jobId}
              className={cn(
                "w-full p-2 border-b border-rv-border-inset text-left hover:bg-rv-raised transition-colors group",
                studio.selectedArtifactId === artifact.jobId && "bg-rv-button-pressed border-l-2 border-l-rv-accent"
              )}
              onClick={() => studio.setSelectedArtifactId(artifact.jobId)}
            >
              <div className="flex justify-between items-start gap-2">
                <span className={cn(
                  "text-[11px] font-medium truncate",
                  studio.selectedArtifactId === artifact.jobId ? "text-rv-text-strong" : "text-rv-text"
                )}>
                  {artifact.title}
                </span>
                {artifact.renderPath && (
                  <Icon icon={Sparkles} size={10} className="text-rv-accent shrink-0" />
                )}
              </div>
              <div className="text-[9px] text-rv-text-muted mt-1 line-clamp-1">{artifact.prompt}</div>
              <div className="flex gap-2 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                 <span className="text-[8px] border border-rv-border-inset px-1 rounded-[1px] bg-rv-input uppercase">
                   {artifact.width}x{artifact.height}
                 </span>
                 <span className="text-[8px] border border-rv-border-inset px-1 rounded-[1px] bg-rv-input uppercase">
                   {artifact.fps.toFixed(0)} FPS
                 </span>
              </div>
            </button>
          ))}
        </div>
        <div className="p-2 bg-rv-raised border-t border-rv-border-inset flex flex-col gap-2">
           <button 
             className="rv-button w-full"
             disabled={!studio.selectedSummary || studio.busyAction !== null}
             onClick={() => studio.selectedSummary && void studio.renderArtifact(studio.selectedSummary.jobId)}
           >
             <Icon icon={Sparkles} size={12} />
             {studio.busyAction === 'render' ? 'Rendering...' : 'Render ProRes 4444'}
           </button>
           <button 
             className="rv-button w-full"
             disabled={!studio.selectedSummary?.renderPath || studio.busyAction !== null}
             onClick={() => studio.selectedSummary && void studio.importArtifact(studio.selectedSummary.jobId)}
           >
             <Icon icon={Bot} size={12} />
             {studio.busyAction === 'import' ? 'Importing...' : 'Import to Premiere'}
           </button>
        </div>
      </Panel>

      {/* Bottom: Timeline */}
      <Panel className="col-span-3 border-t-rv-border-relief">
        <PanelHeader title="Timeline" />
        <div className="flex-1 relative bg-rv-input/20 overflow-hidden">
          {/* Time Ruler */}
          <div className="h-[20px] border-b border-rv-border-inset flex items-end px-2 gap-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="text-[8px] text-rv-text-disabled font-mono border-l border-rv-border-inset pl-1 h-2 leading-none">
                {i * 10}s
              </span>
            ))}
          </div>
          {/* Tracks Area */}
          <div className="p-4 flex flex-col gap-2">
            <div className="h-8 bg-rv-accent-muted border border-rv-border-strong relative group">
               <div className="absolute inset-y-0 left-0 bg-rv-accent/30 border-r border-rv-accent" style={{ width: `${(previewDuration / 100) * 100}%` }} />
               <span className="absolute inset-0 flex items-center px-3 text-[10px] text-rv-text-strong font-medium uppercase tracking-widest drop-shadow-sm">
                 {studio.selectedArtifact?.artifact.title || "No Artifact"}
               </span>
            </div>
            <div className="h-8 bg-rv-raised/40 border border-rv-border-inset dashed" />
          </div>
          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-rv-playhead z-10 pointer-events-none"
            style={{ left: `${(previewTime / 100) * 100}%` }}
          >
            <div className="w-2 h-2 bg-rv-playhead absolute -top-1 -left-[3.5px] rounded-full" />
          </div>
        </div>
      </Panel>
    </div>
  );
};
