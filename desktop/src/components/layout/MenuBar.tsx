import { Layers3, ListFilter } from 'lucide-react';

import type { ViewMode } from '../../api/types';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';
import { ViewToggle } from '../download/ViewToggle';

type MenuBarProps = {
  viewMode: ViewMode;
  filterText: string;
  onViewChange: (viewMode: ViewMode) => void;
  onFilterChange: (value: string) => void;
  onClearCompleted: () => void;
  onClearHistory: () => void;
};

export function MenuBar({
  viewMode,
  filterText,
  onViewChange,
  onFilterChange,
  onClearCompleted,
  onClearHistory,
}: MenuBarProps) {
  const t = useTranslation();

  return (
    <div className="panel-surface flex flex-wrap items-center gap-3 px-4 py-3">
      <ViewToggle
        viewMode={viewMode}
        onChange={onViewChange}
      />
      <div className="relative min-w-[220px] flex-1 md:max-w-md">
        <ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={filterText}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={t('menuBar.filterPlaceholder')}
          className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-[var(--color-main)]"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={<Layers3 className="h-4 w-4" />}
        onClick={onClearCompleted}
      >
        {t('menuBar.clearCompleted')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={<Layers3 className="h-4 w-4" />}
        onClick={onClearHistory}
      >
        {t('menuBar.resetHistory')}
      </Button>
    </div>
  );
}
