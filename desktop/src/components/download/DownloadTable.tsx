import React from 'react';
import type { DownloadItem } from '../../api/types';
import { useTranslation } from '../../i18n';
import { DownloadRow } from './DownloadRow';
import { DownloadCard } from './DownloadCard';
import { EmptyState } from './EmptyState';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Table Header */}
      <div className="flex items-center h-[22px] bg-rv-raised border-b border-rv-border-inset px-2 gap-4 text-[9px] uppercase tracking-wider text-rv-text-disabled select-none shrink-0">
        <div className="w-[40px] shrink-0" />
        <div className="flex-1 min-w-0">Title</div>
        <div className="w-[180px]">Progress</div>
        <div className="w-[80px] text-right">Size</div>
        <div className="w-[100px] text-right">Speed</div>
        <div className="w-[60px] text-right">Time</div>
        <div className="w-[84px] text-right pr-2">Actions</div>
      </div>
      
      {/* Rows */}
      <div className="flex-1">
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
