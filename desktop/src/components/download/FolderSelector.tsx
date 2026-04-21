import React from 'react';
import { FolderOpen } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';

type FolderSelectorProps = {
  folder: string;
  onPickFolder: () => void;
};

export function FolderSelector({ folder, onPickFolder }: FolderSelectorProps) {
  const t = useTranslation();

  return (
    <div className="flex gap-1">
      <div className="rv-input flex-1 flex items-center gap-2 px-2 overflow-hidden h-[28px]">
        <Icon icon={FolderOpen} size={12} className="text-rv-text-disabled shrink-0" />
        <span className="text-[11px] text-rv-text-muted truncate">
          {folder || "Default Folder"}
        </span>
      </div>
      <Button
        size="sm"
        onClick={onPickFolder}
      >
        {t('settings.browse')}
      </Button>
    </div>
  );
}
