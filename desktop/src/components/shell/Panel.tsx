import React from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const Panel: React.FC<PanelProps> = ({ children, className, id }) => {
  return (
    <div 
      id={id}
      className={cn(
        "bg-rv-panel border-t border-l border-rv-border-relief border-b border-r border-rv-border-inset flex flex-col min-h-0",
        className
      )}
    >
      {children}
    </div>
  );
};
