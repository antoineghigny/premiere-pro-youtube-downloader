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
    <div className="h-[44px] bg-rv-window border-t border-rv-border-inset flex items-center justify-center select-none overflow-hidden">
      {pages.map((page) => {
        const isActive = page.id === currentPageId;
        return (
          <button
            key={page.id}
            onClick={() => onPageChange(page.id)}
            className={cn(
              "rv-tab min-w-[80px]",
              isActive && "rv-tab-active"
            )}
          >
            <Icon 
              icon={page.icon} 
              size={18} 
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span className={cn(
              "text-[9px] uppercase tracking-[0.1em] font-bold transition-all",
              isActive ? "text-rv-orange opacity-100" : "text-rv-text-muted opacity-80"
            )}>
              {page.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
