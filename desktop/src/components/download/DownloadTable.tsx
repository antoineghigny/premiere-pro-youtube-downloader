import React from 'react';
import { DownloadRow } from './DownloadRow';
import { DownloadCard } from './DownloadCard';
import { EmptyState } from './EmptyState';

export function DownloadTable({
  items,
  onRetry,
  onDelete,
  onReveal,
  viewMode = 'list',
}) {
  if (items.length === 0) {
    return <EmptyState title="No items in pool" description="Add a URL to get started" />;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-px bg-[#111] overflow-y-auto h-full">
        {items.map((item) => (
          <DownloadCard key={item.requestId} item={item} onRetry={onRetry} onDelete={onDelete} onReveal={onReveal} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1a1a1a]">
      {/* Table Header - DaVinci Resolve Style */}
      <div className="flex items-center h-7 bg-[#282828] border-y border-[#111] px-4 text-[10px] text-[#888] font-bold uppercase tracking-wide shrink-0">
        <div className="w-8 shrink-0"></div>
        <div className="flex-1 min-w-0">Clip Name</div>
        <div className="w-32 text-center">Status</div>
        <div className="w-20 text-right">Size</div>
        <div className="w-24 text-right">Speed</div>
        <div className="w-16 text-right">ETA</div>
        <div className="w-20 shrink-0"></div>
      </div>
      
      {/* Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {items.map((item) => (
          <DownloadRow
            key={item.requestId}
            item={item}
            onRetry={onRetry}
            onDelete={onDelete}
            onReveal={onReveal}
          />
        ))}
      </div>
    </div>
  );
}
