import React from 'react';
import { Play, Sparkles } from 'lucide-react';
import { Icon } from '../common/Icon';
import type { VideoInfo } from '../../api/types';
import { cn } from '@/lib/utils';

interface VideoMonitorProps {
  info: VideoInfo | null;
  loading: boolean;
  className?: string;
}

export const VideoMonitor: React.FC<VideoMonitorProps> = ({ info, loading, className }) => {
  return (
    <div className={cn("flex flex-col h-full bg-[#0a0a0a]", className)}>
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        {/* 16:9 Aspect Ratio Container */}
        <div className="w-full max-w-full aspect-video bg-[#141414] shadow-2xl relative flex items-center justify-center border border-rv-border-inset group">
          {info?.thumbnail ? (
            <img 
              src={info.thumbnail} 
              alt={info.title} 
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-rv-text-disabled">
              <Icon icon={Sparkles} size={48} strokeWidth={1} className="opacity-20" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-light">No Input Detected</span>
            </div>
          )}

          {/* Overlay for loading/status */}
          {loading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-rv-accent/20 border-t-rv-accent rounded-full animate-spin" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-rv-accent font-semibold animate-pulse">Resolving Media</span>
              </div>
            </div>
          )}

          {/* Interactive Layer (Placeholder for future player) */}
          {!loading && info && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer group-hover:opacity-100 opacity-0 transition-opacity duration-300">
               <div className="w-16 h-16 rounded-full bg-rv-accent/80 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                  <Icon icon={Play} size={32} className="text-white fill-white ml-1" />
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Monitor Footer Info */}
      <div className="h-[32px] bg-rv-raised border-t border-rv-border-inset flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-4">
           <div className="flex flex-col">
              <span className="text-[9px] text-rv-text-disabled uppercase tracking-wider font-bold">Source</span>
              <span className="text-[10px] text-rv-text-strong font-medium truncate max-w-[200px]">
                {info?.title || "IDLE"}
              </span>
           </div>
           {info?.duration && (
             <div className="h-[20px] w-px bg-rv-border-inset" />
           )}
           {info?.duration && (
             <div className="flex flex-col">
                <span className="text-[9px] text-rv-text-disabled uppercase tracking-wider font-bold">Duration</span>
                <span className="text-[10px] text-rv-text-strong font-mono">
                  {new Date(info.duration * 1000).toISOString().substr(11, 8)}
                </span>
             </div>
           )}
        </div>
        
        <div className="flex items-center gap-2">
           <div className="px-2 py-0.5 rounded-[2px] border border-rv-border-inset bg-black text-[9px] text-rv-accent font-mono tracking-widest">
             LIVE PREVIEW
           </div>
        </div>
      </div>
    </div>
  );
};
