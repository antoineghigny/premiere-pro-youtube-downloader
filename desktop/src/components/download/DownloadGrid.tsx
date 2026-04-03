import type { DownloadItem } from '../../api/types';
import { DownloadCard } from './DownloadCard';
import { EmptyState } from './EmptyState';

type DownloadGridProps = {
  items: DownloadItem[];
  onRetry: (item: DownloadItem) => void;
  onRemove: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
};

export function DownloadGrid({ items, onRetry, onRemove, onReveal }: DownloadGridProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing queued yet"
        description="Queue downloads from the URL bar to fill the board with live thumbnails, progress, and Premiere status."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <DownloadCard
          key={item.requestId}
          item={item}
          onRetry={onRetry}
          onRemove={onRemove}
          onReveal={onReveal}
        />
      ))}
    </div>
  );
}
