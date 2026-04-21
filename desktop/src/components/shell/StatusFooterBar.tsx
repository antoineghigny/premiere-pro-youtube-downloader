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
    <div className="h-[22px] bg-rv-raised border-t border-rv-border-inset flex items-center px-2 text-[9px] select-none gap-4 font-medium uppercase tracking-[0.05em]">
      {/* Queue Summary */}
      <div className="flex items-center gap-4 pr-4 h-full border-r border-rv-border-inset">
        <div className="flex items-center gap-1.5 text-rv-text-muted">
          <Icon icon={Activity} size={11} className={cn(summary.activeCount > 0 ? "text-rv-accent" : "text-rv-text-disabled")} />
          <span className="font-bold">{summary.activeCount} ACTIVE</span>
        </div>
        <div className="flex items-center gap-1.5 text-rv-text-muted">
          <Icon icon={CheckCircle2} size={11} className={cn(summary.completedCount > 0 ? "text-rv-ok" : "text-rv-text-disabled")} />
          <span className="font-bold">{summary.completedCount} DONE</span>
        </div>
        <div className="h-[10px] w-px bg-rv-border-inset" />
        <span className="text-rv-text-strong font-black tracking-widest">{summary.totalCount} ITEMS</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Backend Status */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full border border-rv-border-inset",
          "bg-rv-ok"
        )} />
        <span className="text-rv-text-muted font-bold">Backend</span>
        <span className="text-rv-text-strong font-mono tabular-nums opacity-80">CONNECTED</span>
      </div>

      {/* Premiere Status */}
      <div className="flex items-center gap-2 border-l border-rv-border-inset pl-4 h-full">
        <Icon 
          icon={Monitor} 
          size={11} 
          className={cn(premiereRunning ? "text-rv-accent" : "text-rv-text-disabled")} 
        />
        <span className="text-rv-text-muted font-bold">Premiere</span>
        <span className={cn(
          "font-mono tabular-nums",
          premiereRunning ? "text-rv-text-strong" : "text-rv-text-disabled"
        )}>
          {premiereRunning ? (projectName?.toUpperCase() || "READY") : "OFFLINE"}
        </span>
      </div>
    </div>
  );
};
