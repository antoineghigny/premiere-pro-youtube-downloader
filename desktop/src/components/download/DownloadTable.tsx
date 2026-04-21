import React from 'react';
import { DownloadRow } from './DownloadRow';
import type { DownloadItem } from '../../api/types';

interface DownloadTableProps {
  items: DownloadItem[];
  onRetry: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
}

export const DownloadTable: React.FC<DownloadTableProps> = ({ 
  items, 
  onRetry, 
  onDelete, 
  onReveal 
}) => {
  return (
    <div className="flex flex-col h-full bg-rv-window overflow-hidden">
      {/* Table Header */}
      <div className="h-[24px] bg-rv-raised border-b border-rv-border-inset flex items-center px-2 gap-3 text-[9px] font-black uppercase text-rv-text-muted tracking-widest select-none">
        <div className="w-12 text-center">Thumb</div>
        <div className="w-4">S</div>
        <div className="flex-1">Clip Name</div>
        <div className="w-24 px-2">Progress</div>
        <div className="w-16 text-right">Size</div>
        <div className="w-20 text-right">Speed</div>
        <div className="w-14 text-right">ETA/ELP</div>
        <div className="w-16" />
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center">
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
    </div>
  );
};
