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
        "rv-panel-surface flex flex-col min-h-0",
        className
      )}
    >
      {children}
    </div>
  );
};
