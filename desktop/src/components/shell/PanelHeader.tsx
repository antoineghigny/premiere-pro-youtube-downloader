import React from 'react';
import { cn } from '@/lib/utils';

interface PanelHeaderProps {
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ children, title, className }) => {
  return (
    <div className={cn("rv-panel-header", className)}>
      {title && <span className="flex-1">{title}</span>}
      {children}
    </div>
  );
};
