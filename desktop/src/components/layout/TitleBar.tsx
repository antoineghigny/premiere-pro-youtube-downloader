import { Cable, MonitorPlay, Settings2 } from 'lucide-react';

import type { PremiereStatusResponse } from '../../api/types';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';

type TitleBarProps = {
  backendConnected: boolean;
  premiereStatus: PremiereStatusResponse;
  onOpenSettings: () => void;
};

export function TitleBar({ backendConnected, premiereStatus, onOpenSettings }: TitleBarProps) {
  const t = useTranslation();

  const premiereLabel = premiereStatus.canImport
    ? premiereStatus.projectSaved
      ? t('titleBar.premiereReady', { name: premiereStatus.projectName || 'Premiere' })
      : t('titleBar.importReady')
    : premiereStatus.reason;

  return (
    <div className="panel-surface flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-main)]/45 bg-[radial-gradient(circle_at_top,#8354ff,transparent_60%),rgba(97,22,255,0.15)] shadow-[0_0_38px_rgba(97,22,255,0.25)]">
          <MonitorPlay className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.36em] text-[var(--text-muted)]">{t('titleBar.appName')}</div>
          <div className="text-lg font-semibold text-white">{t('titleBar.subtitle')}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="status-pill">
          <span className={backendConnected ? 'status-dot status-dot-online' : 'status-dot'} />
          <Cable className="h-4 w-4" />
          <span>{backendConnected ? t('titleBar.ready') : t('titleBar.offline')}</span>
        </div>
        <div className="status-pill">
          <span className={premiereStatus.canImport ? 'status-dot status-dot-premiere' : 'status-dot'} />
          <span>{premiereLabel}</span>
        </div>
        <Button
          variant="secondary"
          icon={<Settings2 className="h-4 w-4" />}
          onClick={onOpenSettings}
        >
          {t('titleBar.settings')}
        </Button>
      </div>
    </div>
  );
}
