import clsx from 'clsx';
import { Grid2X2, LayoutList } from 'lucide-react';

import type { ViewMode } from '../../api/types';

type ViewToggleProps = {
  viewMode: ViewMode;
  onChange: (viewMode: ViewMode) => void;
};

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 p-1">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={clsx('toggle-chip', viewMode === 'grid' && 'toggle-chip-active')}
      >
        <Grid2X2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={clsx('toggle-chip', viewMode === 'list' && 'toggle-chip-active')}
      >
        <LayoutList className="h-4 w-4" />
      </button>
    </div>
  );
}
