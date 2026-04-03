import type { DownloadItem } from '../../api/types';
import { DownloadRow } from './DownloadRow';
import { EmptyState } from './EmptyState';

type DownloadTableProps = {
  items: DownloadItem[];
  onRetry: (item: DownloadItem) => void;
  onRemove: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
  onMove: (sourceId: string, targetId: string) => void;
};

export function DownloadTable({
  items,
  onRetry,
  onRemove,
  onReveal,
  onMove,
}: DownloadTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Paste a supported URL above to start downloading"
        description="Paste a video link to start a download and track it here."
      />
    );
  }

  return (
    <div className="panel-surface space-y-3 px-4 py-4">
      <div className="hidden grid-cols-[72px_minmax(0,1.8fr)_1.25fr_0.65fr_0.7fr_0.5fr_0.5fr_auto] gap-4 px-4 text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)] xl:grid">
        <span>Thumb</span>
        <span>Title</span>
        <span>Progress</span>
        <span>Total</span>
        <span>Speed</span>
        <span>ETA</span>
        <span>Elapsed</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <DownloadRow
            key={item.requestId}
            item={item}
            onRetry={onRetry}
            onRemove={onRemove}
            onReveal={onReveal}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
}
