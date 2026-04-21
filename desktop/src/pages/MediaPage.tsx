import React, { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { DaVinciPanel } from '../components/davinci-ui';
import { DownloadTable } from '../components/download/DownloadTable';
import { DownloadGrid } from '../components/download/DownloadGrid';
import { cn } from '@/lib/utils';
import { Search, LayoutGrid, List } from 'lucide-react';
import { Icon } from '../components/common/Icon';

interface MediaPageProps {
  downloads: any;
}

export const MediaPage: React.FC<MediaPageProps> = ({ downloads }) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  return (
    <div className="flex-1 overflow-hidden bg-rv-window p-0.5">
      <DaVinciPanel 
        header={
          <div className="flex flex-1 items-center gap-2">
            <span className="flex-1">Media Storage</span>
            <div className="flex items-center gap-1 mr-2">
              <div className="relative mr-2">
                <Icon icon={Search} size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-rv-text-disabled" />
                <input 
                  type="text"
                  placeholder="Search downloads..."
                  className="rv-input pl-6 w-[200px] h-[20px] text-[10px] uppercase font-bold tracking-tight"
                  value={downloads.filterText || ''}
                  onChange={(e) => downloads.setFilterText?.(e.target.value)}
                />
              </div>
              <div className="flex border border-rv-border-inset rounded-[1px] overflow-hidden h-[20px]">
                <button 
                  className={cn("px-2 hover:bg-rv-button-hover flex items-center", viewMode === 'list' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
                  onClick={() => setViewMode('list')}
                >
                  <Icon icon={List} size={11} />
                </button>
                <button 
                  className={cn("px-2 hover:bg-rv-button-hover flex items-center", viewMode === 'grid' ? "bg-rv-button-pressed text-rv-accent" : "bg-rv-button text-rv-text-muted")}
                  onClick={() => setViewMode('grid')}
                >
                  <Icon icon={LayoutGrid} size={11} />
                </button>
              </div>
            </div>
          </div>
        }
        className="h-full"
      >
        <div className="h-full overflow-y-auto p-4">
          {viewMode === 'grid' ? (
            <DownloadGrid 
              items={downloads.items}
              onReveal={downloads.revealDownload}
              onRetry={downloads.retryDownload}
              onDelete={downloads.deleteDownload}
            />
          ) : (
            <DownloadTable 
              items={downloads.items}
              onReveal={downloads.revealDownload}
              onRetry={downloads.retryDownload}
              onDelete={downloads.deleteDownload}
              viewMode="list"
            />
          )}
        </div>
      </DaVinciPanel>
    </div>
  );
};
