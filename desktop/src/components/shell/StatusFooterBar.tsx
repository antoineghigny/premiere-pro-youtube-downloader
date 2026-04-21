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
    <div className="h-[22px] bg-rv-raised border-t border-rv-border-inset flex items-center px-2 text-[10px] select-none gap-4">
      {/* Queue Summary */}
      <div className="flex items-center gap-3 border-r border-rv-border-inset pr-4 h-full">
        <div className="flex items-center gap-1.5 text-rv-text-muted">
          <Icon icon={Activity} size={12} className="text-rv-accent" />
          <span>{summary.activeCount} ACTIVE</span>
        </div>
        <div className="flex items-center gap-1.5 text-rv-text-muted">
          <Icon icon={CheckCircle2} size={12} className="text-rv-ok" />
          <span>{summary.completedCount} DONE</span>
        </div>
        <span className="text-rv-text-disabled">/</span>
        <span className="text-rv-text-strong font-medium">{summary.totalCount} TOTAL</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Backend Status */}
      <div className="flex items-center gap-1.5 px-2">
        <Icon icon={Server} size={12} className="text-rv-ok" />
        <span className="text-rv-text-muted uppercase tracking-tight">Backend:</span>
        <span className="text-rv-text-strong">CONNECTED</span>
      </div>

      {/* Premiere Status */}
      <div className="flex items-center gap-1.5 border-l border-rv-border-inset pl-4 h-full">
        <Icon 
          icon={Monitor} 
          size={12} 
          className={cn(premiereRunning ? "text-rv-accent" : "text-rv-text-disabled")} 
        />
        <span className="text-rv-text-muted uppercase tracking-tight text-[9px]">Adobe Premiere Pro:</span>
        <span className={cn(
          "font-medium",
          premiereRunning ? "text-rv-text-strong" : "text-rv-text-disabled"
        )}>
          {premiereRunning ? (projectName || "CONNECTED") : "OFFLINE"}
        </span>
      </div>
    </div>
  );
};
