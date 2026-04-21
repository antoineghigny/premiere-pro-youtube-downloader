import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '../../api/types';
import { cn } from '@/lib/utils';
import { Icon } from '../common/Icon';

type ViewToggleProps = {
  viewMode: ViewMode;
  onChange: (viewMode: ViewMode) => void;
};

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="flex border border-rv-border-inset rounded-[2px] overflow-hidden shrink-0">
      <button 
        className={cn("p-1 hover:bg-rv-button-hover", viewMode === 'list' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
        onClick={() => onChange('list')}
        title="List View"
      >
        <Icon icon={List} size={12} />
      </button>
      <button 
        className={cn("p-1 hover:bg-rv-button-hover", viewMode === 'grid' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
        onClick={() => onChange('grid')}
        title="Grid View"
      >
        <Icon icon={LayoutGrid} size={12} />
      </button>
    </div>
  );
}
