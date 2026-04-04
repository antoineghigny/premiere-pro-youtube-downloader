import type { DownloadItem } from '../../api/types';
import { useTranslation } from '../../i18n';
import { DownloadCard } from './DownloadCard';
import { EmptyState } from './EmptyState';

type DownloadGridProps = {
  items: DownloadItem[];
  onRetry: (item: DownloadItem) => void;
  onRemove: (item: DownloadItem) => void;
  onReveal: (item: DownloadItem) => void;
};

export function DownloadGrid({ items, onRetry, onRemove, onReveal }: DownloadGridProps) {
  const t = useTranslation();

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('downloadGrid.emptyTitle')}
        description={t('downloadGrid.emptyDescription')}
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
