import { FolderOpen } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';

type FolderSelectorProps = {
  folder: string;
  onPickFolder: () => void;
};

export function FolderSelector({ folder, onPickFolder }: FolderSelectorProps) {
  const t = useTranslation();

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <FolderOpen className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      <div className="min-w-0 flex-1 truncate text-sm text-[var(--text-muted)]">
        {folder || t('settings.defaultDownloadFolder')}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onPickFolder}
      >
        {t('settings.browse')}
      </Button>
    </div>
  );
}
