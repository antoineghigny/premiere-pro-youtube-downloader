import React from 'react';
import { DownloadRow } from './DownloadRow';
import type { DownloadItem } from '../../api/types';

interface DownloadTableProps {
  items: DownloadItem[];
  onRetry: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
  viewMode?: 'list' | 'grid';
}

export const DownloadTable: React.FC<DownloadTableProps> = ({ 
  items, 
  onRetry, 
  onDelete, 
  onReveal 
}) => {
  return (
    <div className="flex flex-col h-full bg-rv-window overflow-y-auto">
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
          <div className="text-[10px] text-rv-text-disabled uppercase font-black tracking-[0.3em] opacity-30 select-none">
            MEDIA POOL EMPTY
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <DownloadRow 
              key={item.requestId}
              item={item}
              onRetry={() => onRetry(item)}
              onDelete={() => onDelete(item)}
              onReveal={() => onReveal(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
