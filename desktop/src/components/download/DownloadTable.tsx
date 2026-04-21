import React from 'react';
import type { DownloadItem } from '../../api/types';
import { useTranslation } from '../../i18n';
import { DownloadRow } from './DownloadRow';
import { DownloadCard } from './DownloadCard';
import { EmptyState } from './EmptyState';

type DownloadTableProps = {
  items: DownloadItem[];
  onRetry: (item: DownloadItem) => void;
  onDelete: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
  viewMode?: 'list' | 'grid';
};

export function DownloadTable({
  items,
  onRetry,
  onDelete,
  onReveal,
  viewMode = 'list',
}: DownloadTableProps) {
  const t = useTranslation();

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('downloadTable.emptyTitle')}
        description={t('downloadTable.emptyDescription')}
      />
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-px bg-rv-border-inset p-px overflow-y-auto h-full">
        {items.map((item) => (
          <DownloadCard
            key={item.requestId}
            item={item}
            onRetry={onRetry}
            onDelete={onDelete}
            onReveal={onReveal}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center h-[24px] bg-rv-raised border-b border-rv-border-inset px-3 gap-4 text-[9px] font-black uppercase tracking-[0.15em] text-rv-text-disabled select-none shrink-0">
        <div className="w-[20px] shrink-0" />
        <div className="w-[40px] shrink-0" />
        <div className="flex-1 min-w-0">Clip Name / Reel</div>
        <div className="w-[120px]">Timeline Status</div>
        <div className="w-[60px] text-right">Data Size</div>
        <div className="w-[80px] text-right">Bitrate</div>
        <div className="w-[50px] text-right">TC</div>
        <div className="w-[80px] text-right pr-2">Flags</div>
      </div>
      
      {/* Rows */}
      <div className="flex-1 overflow-y-auto bg-rv-panel">
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
