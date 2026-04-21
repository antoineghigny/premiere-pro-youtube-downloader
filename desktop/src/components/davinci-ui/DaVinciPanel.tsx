import React from 'react';
import { cn } from '@/lib/utils';

interface DaVinciPanelProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  id?: string;
}

export const DaVinciPanel: React.FC<DaVinciPanelProps> = ({ 
  children, 
  header, 
  className, 
  headerClassName,
  contentClassName,
  id 
}) => {
  return (
    <div 
      id={id}
      className={cn(
        "rv-panel-surface flex flex-col min-h-0",
        className
      )}
    >
      {header && (
        <div className={cn("rv-panel-header shrink-0", headerClassName)}>
          {header}
        </div>
      )}
      <div className={cn("flex-1 min-h-0 overflow-hidden", contentClassName)}>
        {children}
      </div>
    </div>
  );
};
