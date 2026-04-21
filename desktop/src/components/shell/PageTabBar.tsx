import React from 'react';
import { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Icon } from '../common/Icon';

export interface PageDef {
  id: string;
  label: string;
  icon: React.ComponentType<LucideProps>;
}

interface PageTabBarProps {
  pages: PageDef[];
  currentPageId: string;
  onPageChange: (id: string) => void;
}

export const PageTabBar: React.FC<PageTabBarProps> = ({ pages, currentPageId, onPageChange }) => {
  return (
    <div className="h-[48px] bg-rv-window border-t border-rv-border-relief flex items-center justify-center select-none overflow-hidden">
      {pages.map((page) => {
        const isActive = page.id === currentPageId;
        return (
          <button
            key={page.id}
            onClick={() => onPageChange(page.id)}
            className={cn(
              "rv-tab min-w-[100px]",
              isActive && "rv-tab-active"
            )}
          >
            <Icon 
              icon={page.icon} 
              size={18} 
              strokeWidth={isActive ? 1.75 : 1.5}
              className={isActive ? "text-rv-text-strong" : "text-rv-text-muted"}
            />
            <span className={cn(
              "text-[10px] uppercase tracking-wider",
              isActive ? "text-rv-text-strong font-semibold" : "text-rv-text-muted"
            )}>
              {page.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
