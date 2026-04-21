import React, { useEffect, useState } from 'react';
import { X, FolderOpen, Wand2, Puzzle, CheckCircle2, AlertTriangle, LoaderCircle } from 'lucide-react';
import type { DesktopSettings, FFmpegPreset, IntegrationStatus } from '../../api/types';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';
import { Dropdown } from '../common/Dropdown';
import { Icon } from '../common/Icon';
import { cn } from '@/lib/utils';

type SettingsModalProps = {
  open: boolean;
  settings: DesktopSettings;
  onClose: () => void;
  onSave: (settings: DesktopSettings) => Promise<void>;
  onPickFolder: (currentPath: string) => Promise<string | null>;
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => Promise<FFmpegPreset[]>;
  onRevealPath: (path: string) => Promise<void>;
  integrationStatus: IntegrationStatus | null;
  integrationLoading: boolean;
  integrationMessage: string;
  integrationBusy: 'premiere' | 'browser' | null;
  onInstallPremiere: () => Promise<void>;
  onOpenBrowserSetup: () => Promise<void>;
};

export function SettingsModal({
  open,
  settings,
  onClose,
  onSave,
  onPickFolder,
  onRevealPath,
  integrationStatus,
  integrationLoading,
  integrationBusy,
  onInstallPremiere,
  onOpenBrowserSetup,
}: SettingsModalProps) {
  const t = useTranslation();
  const [draft, setDraft] = useState(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'presets'>('general');

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const premiereDetected = integrationStatus?.premiereInstalled ?? false;
  const premiereReady = integrationStatus?.premierePanelInstalled ?? false;
  const browserReady = integrationStatus?.browserAddonReady ?? false;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 select-none">
      <div className="bg-rv-panel border border-rv-border-inset shadow-2xl w-[800px] h-[540px] flex flex-col overflow-hidden rounded-[4px]">
        {/* Header */}
        <div className="rv-panel-header shrink-0">
          <span className="flex-1 uppercase tracking-[0.1em] text-[10px] font-semibold">Project Settings</span>
          <button onClick={onClose} className="hover:text-rv-text-strong transition-colors">
            <Icon icon={X} size={14} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-[180px] bg-rv-raised border-r border-rv-border-inset flex flex-col shrink-0">
            {(['general', 'integrations', 'presets'] as const).map((id) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "px-4 py-2 text-left text-[11px] transition-colors border-l-2",
                  activeTab === id 
                    ? "bg-rv-panel text-rv-text-strong border-l-rv-accent font-medium" 
                    : "text-rv-text-muted border-l-transparent hover:text-rv-text hover:bg-rv-panel/50"
                )}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 bg-rv-panel p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="flex flex-col gap-6 max-w-[420px]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Default Resolution</label>
                  <Dropdown
                    value={draft.resolution}
                    options={[
                      { value: '2160', label: '4K (2160p)' },
                      { value: '1440', label: '1440p' },
                      { value: '1080', label: '1080p' },
                      { value: '720', label: '720p' },
                      { value: '480', label: '480p' },
                    ]}
                    onChange={(e) => setDraft({ ...draft, resolution: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Download Path</label>
                  <div className="flex gap-2">
                    <input 
                      value={draft.downloadPath}
                      onChange={(e) => setDraft({ ...draft, downloadPath: e.target.value })}
                      className="rv-input flex-1 h-[24px]"
                    />
                    <Button size="sm" onClick={async () => {
                       const p = await onPickFolder(draft.downloadPath);
                       if (p) setDraft({ ...draft, downloadPath: p });
                    }}>Browse</Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-rv-text-muted uppercase tracking-tight">Gemini API Key</label>
                  <input 
                    type="password"
                    value={draft.geminiApiKey}
                    placeholder="AIza..."
                    onChange={(e) => setDraft({ ...draft, geminiApiKey: e.target.value })}
                    className="rv-input w-full h-[24px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-rv-border-inset">
                   <Checkbox 
                     checked={draft.videoOnly}
                     onChange={(e) => setDraft({ ...draft, videoOnly: e.target.checked })}
                     label="Video Only Default"
                   />
                   <Checkbox 
                     checked={draft.defaultImportToPremiere}
                     onChange={(e) => setDraft({ ...draft, defaultImportToPremiere: e.target.checked })}
                     label="Auto-Import to Premiere"
                   />
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="flex flex-col gap-8">
                {/* Premiere Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Icon icon={Wand2} size={14} className="text-rv-accent" />
                    <h3 className="text-[12px] font-semibold text-rv-text-strong uppercase tracking-wider">Adobe Premiere Pro</h3>
                  </div>
                  <div className="bg-rv-raised border border-rv-border-inset p-4 rounded-[2px] flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-rv-text">
                        {integrationLoading ? "Status: Checking..." : premiereReady ? "Status: Connected & Ready" : "Status: Setup Required"}
                      </span>
                      <span className="text-[9px] text-rv-text-disabled truncate max-w-[300px]">
                        {integrationStatus?.cepInstallPath || "Path not detected"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={onInstallPremiere} disabled={integrationBusy === 'premiere'}>
                        {integrationBusy === 'premiere' ? <Icon icon={LoaderCircle} size={12} className="animate-spin" /> : "Refresh Panel"}
                      </Button>
                      {integrationStatus?.cepInstallPath && (
                        <Button size="sm" variant="ghost" onClick={() => onRevealPath(integrationStatus.cepInstallPath!)}>
                           <Icon icon={FolderOpen} size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Browser Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Icon icon={Puzzle} size={14} className="text-rv-accent" />
                    <h3 className="text-[12px] font-semibold text-rv-text-strong uppercase tracking-wider">Chrome Extension</h3>
                  </div>
                  <div className="bg-rv-raised border border-rv-border-inset p-4 rounded-[2px] flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-rv-text">
                        {browserReady ? "Status: Extension Active" : "Status: Install Required"}
                      </span>
                    </div>
                    <Button size="sm" variant="secondary" onClick={onOpenBrowserSetup} disabled={integrationBusy === 'browser'}>
                       {integrationBusy === 'browser' ? <Icon icon={LoaderCircle} size={12} className="animate-spin" /> : "Install / Setup"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'presets' && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[11px] text-rv-text-muted uppercase tracking-tight mb-2">Export Presets</h3>
                {draft.ffmpegPresets.map((preset) => (
                   <div key={preset.id} className="bg-rv-raised border border-rv-border-inset p-3 flex items-center justify-between group rounded-[2px]">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-rv-text-strong">{preset.name}</span>
                        <span className="text-[9px] text-rv-text-disabled uppercase">
                          {preset.options.outputFormat} · {preset.options.videoCodec} · {preset.options.audioCodec}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button size="sm" variant="danger" onClick={() => {
                           setDraft({ ...draft, ffmpegPresets: draft.ffmpegPresets.filter(p => p.id !== preset.id) });
                         }}>Delete</Button>
                      </div>
                   </div>
                ))}
                {draft.ffmpegPresets.length === 0 && (
                  <div className="text-[11px] text-rv-text-disabled italic text-center py-10 border border-dashed border-rv-border-inset">
                    No presets saved yet. Create one from the Options panel.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-[48px] bg-rv-raised border-t border-rv-border-inset flex items-center justify-end px-4 gap-2 shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="px-6 font-semibold" onClick={() => onSave(draft).then(onClose)}>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}
