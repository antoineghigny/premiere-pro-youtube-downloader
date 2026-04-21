import React from 'react';
import { Activity, CheckCircle2, Server, Monitor } from 'lucide-react';
import { useDownloadStore } from '../../stores/downloadStore';
import { usePremiereStatus } from '../../hooks/usePremiereStatus';
import { buildQueueStatusSummary } from '../../utils/statusSummary';
import { Icon } from '../common/Icon';
import { cn } from '@/lib/utils';

export const StatusFooterBar: React.FC = () => {
  const items = useDownloadStore((s) => s.items);
  const { running: premiereRunning, projectName } = usePremiereStatus();
  
  const summary = buildQueueStatusSummary(items);
  
  return (
    <div className="h-[24px] bg-rv-raised border-t border-rv-border-inset flex items-center px-2 text-[10px] select-none gap-4">
      {/* Queue Summary */}
      <div className="flex items-center gap-4 pr-4 h-full">
        <div className="flex items-center gap-1.5 text-rv-text-muted">
          <Icon icon={Activity} size={12} className={cn(summary.activeCount > 0 ? "text-rv-accent" : "text-rv-text-disabled")} />
          <span className="font-semibold tracking-wider">{summary.activeCount} ACTIVE</span>
        </div>
        <div className="flex items-center gap-1.5 text-rv-text-muted">
          <Icon icon={CheckCircle2} size={12} className={cn(summary.completedCount > 0 ? "text-rv-ok" : "text-rv-text-disabled")} />
          <span className="font-semibold tracking-wider">{summary.completedCount} DONE</span>
        </div>
        <div className="h-[12px] w-px bg-rv-border-inset" />
        <span className="text-rv-text-strong font-bold tracking-widest">{summary.totalCount} ITEMS</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Backend Status */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-rv-ok shadow-[0_0_4px_rgba(78,166,78,0.5)]" />
        <span className="text-rv-text-muted uppercase tracking-[0.1em] text-[9px] font-bold">Backend</span>
        <span className="text-rv-text-strong font-mono">CONNECTED</span>
      </div>

      {/* Premiere Status */}
      <div className="flex items-center gap-2 border-l border-rv-border-inset pl-4 h-full">
        <Icon 
          icon={Monitor} 
          size={12} 
          className={cn(premiereRunning ? "text-rv-accent" : "text-rv-text-disabled")} 
        />
        <span className="text-rv-text-muted uppercase tracking-[0.1em] text-[9px] font-bold">Premiere Pro</span>
        <span className={cn(
          "font-mono",
          premiereRunning ? "text-rv-text-strong" : "text-rv-text-disabled"
        )}>
          {premiereRunning ? (projectName?.toUpperCase() || "CONNECTED") : "OFFLINE"}
        </span>
      </div>
    </div>
  );
};
