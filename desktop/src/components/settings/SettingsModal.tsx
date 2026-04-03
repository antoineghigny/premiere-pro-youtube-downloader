import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, LoaderCircle, Puzzle, Sparkles, Wand2, X } from 'lucide-react';

import type { DesktopSettings, FFmpegPreset, IntegrationStatus } from '../../api/types';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';
import { Dropdown } from '../common/Dropdown';
import { PresetManager } from './PresetManager';

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
  onLoadPreset,
  onDeletePreset,
  onRevealPath,
  integrationStatus,
  integrationLoading,
  integrationMessage,
  integrationBusy,
  onInstallPremiere,
  onOpenBrowserSetup,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!open) {
    return null;
  }

  const premiereDetected = integrationStatus?.premiereInstalled ?? false;
  const premiereReady = integrationStatus?.premierePanelInstalled ?? false;
  const chromeDetected = integrationStatus?.chromeInstalled ?? false;
  const browserReady = integrationStatus?.browserAddonReady ?? false;
  const conflicts = integrationStatus?.conflicts ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,3,8,0.78)] px-4 py-10 backdrop-blur-md">
      <div className="panel-surface modal-shell max-h-full w-full max-w-5xl overflow-auto p-0">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[var(--text-muted)]">Preferences</div>
            <div className="text-xl font-semibold text-white">Desktop defaults</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
          />
        </div>
        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="settings-field">
                <span>Default resolution</span>
                <Dropdown
                  value={draft.resolution}
                  options={[
                    { value: '2160', label: '4K' },
                    { value: '1440', label: '1440p' },
                    { value: '1080', label: '1080p' },
                    { value: '720', label: '720p' },
                    { value: '480', label: '480p' },
                  ]}
                  onChange={(event) => setDraft((current) => ({ ...current, resolution: event.target.value }))}
                />
              </label>
              <label className="settings-field">
                <span>Concurrent downloads</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={draft.concurrentDownloads}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      concurrentDownloads: Number.parseInt(event.target.value, 10) || 1,
                    }))
                  }
                  className="h-10 rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white outline-none focus:border-[var(--color-main)]"
                />
              </label>
            </div>
            <div className="settings-field">
              <span>Default download folder</span>
              <div className="flex gap-3">
                <input
                  value={draft.downloadPath}
                  onChange={(event) => setDraft((current) => ({ ...current, downloadPath: event.target.value }))}
                  className="h-10 flex-1 rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white outline-none focus:border-[var(--color-main)]"
                />
                <Button
                  variant="secondary"
                  icon={<FolderOpen className="h-4 w-4" />}
                  onClick={async () => {
                    const selected = await onPickFolder(draft.downloadPath);
                    if (selected) {
                      setDraft((current) => ({ ...current, downloadPath: selected }));
                    }
                  }}
                >
                  Browse
                </Button>
              </div>
            </div>
            <label className="settings-field">
              <span>Default destination</span>
              <Dropdown
                value={draft.outputTarget}
                options={[
                  { value: 'downloadFolder', label: 'Downloads folder' },
                  { value: 'premiereProject', label: 'Current Premiere project' },
                ]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    outputTarget: event.target.value as DesktopSettings['outputTarget'],
                  }))
                }
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="settings-field">
                <span>Theme</span>
                <Dropdown
                  value={draft.theme}
                  options={[
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                  ]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      theme: event.target.value as DesktopSettings['theme'],
                    }))
                  }
                />
              </label>
              <label className="settings-field">
                <span>Language</span>
                <Dropdown
                  value={draft.language}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'fr', label: 'Français' },
                  ]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      language: event.target.value as DesktopSettings['language'],
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/4 p-4 md:grid-cols-2">
              <Checkbox
                checked={draft.videoOnly}
                onChange={(event) => setDraft((current) => ({ ...current, videoOnly: event.target.checked }))}
                label="Video only by default"
              />
              <Checkbox
                checked={draft.askDownloadPathEachTime}
                onChange={(event) => setDraft((current) => ({ ...current, askDownloadPathEachTime: event.target.checked }))}
                label="Ask download path each time"
              />
              <Checkbox
                checked={draft.askAudioPathEachTime}
                onChange={(event) => setDraft((current) => ({ ...current, askAudioPathEachTime: event.target.checked }))}
                label="Ask audio path each time"
              />
              <Checkbox
                checked={draft.defaultImportToPremiere}
                onChange={(event) => setDraft((current) => ({ ...current, defaultImportToPremiere: event.target.checked }))}
                label="Auto-import when Premiere is ready"
              />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/4 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-[var(--color-main)]" />
                Apps & browser
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Premiere Pro</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {integrationLoading
                          ? 'Checking Premiere setup...'
                          : conflicts.length > 0
                            ? 'Older Premiere panels were found. Clean them up, then restart Premiere.'
                            : premiereDetected
                            ? premiereReady
                              ? 'Premiere is ready for one-click import.'
                              : 'Premiere was found. Finish setup to enable imports.'
                            : 'Premiere was not found on this computer.'}
                      </div>
                    </div>
                    {premiereReady ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Wand2 className="h-5 w-5 text-sky-200" />}
                  </div>
                  <Button
                    className="mt-4 w-full"
                    variant="secondary"
                    disabled={integrationLoading || !premiereDetected || integrationBusy !== null}
                    icon={integrationBusy === 'premiere' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    onClick={() => {
                      void onInstallPremiere();
                    }}
                  >
                    {premiereReady ? 'Refresh Premiere setup' : 'Set up Premiere'}
                  </Button>
                  {integrationStatus?.cepInstallPath ? (
                    <Button
                      className="mt-3 w-full"
                      variant="ghost"
                      icon={<FolderOpen className="h-4 w-4" />}
                      onClick={() => {
                        void onRevealPath(integrationStatus.cepInstallPath!);
                      }}
                    >
                      Open panel folder
                    </Button>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Chrome extension</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {integrationLoading
                          ? 'Checking browser setup...'
                          : browserReady
                            ? 'The extension folder is ready to load in Chrome.'
                            : chromeDetected
                              ? 'Prepare the extension folder, then add it in Chrome.'
                              : 'Prepare the extension folder, then add it in any Chromium browser.'}
                      </div>
                    </div>
                    {browserReady ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Puzzle className="h-5 w-5 text-sky-200" />}
                  </div>
                  <Button
                    className="mt-4 w-full"
                    variant="secondary"
                    disabled={integrationLoading || integrationBusy !== null}
                    icon={integrationBusy === 'browser' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Puzzle className="h-4 w-4" />}
                    onClick={() => {
                      void onOpenBrowserSetup();
                    }}
                  >
                    {browserReady ? 'Open extension folder' : 'Prepare browser extension'}
                  </Button>
                </div>
              </div>
              {conflicts.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    Older Premiere panels need cleanup
                  </div>
                  <div className="space-y-3">
                    {conflicts.map((conflict) => (
                      <div
                        key={`${conflict.id}:${conflict.path}`}
                        className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm text-[var(--text-muted)]"
                      >
                        <div className="font-medium text-white">{conflict.id}</div>
                        <div className="mt-1 break-all">{conflict.reason}</div>
                        <div className="mt-1 break-all text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {conflict.scope} CEP folder
                        </div>
                        <div className="mt-1 break-all text-xs text-[var(--text-muted)]">{conflict.path}</div>
                        <Button
                          className="mt-3"
                          variant="ghost"
                          size="sm"
                          icon={<FolderOpen className="h-4 w-4" />}
                          onClick={() => {
                            void onRevealPath(conflict.path);
                          }}
                        >
                          Open folder
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {integrationMessage ? (
                <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-[var(--text-muted)]">
                  {integrationMessage}
                </div>
              ) : null}
            </div>
          </div>
          <PresetManager
            presets={draft.ffmpegPresets}
            onLoadPreset={onLoadPreset}
            onDeletePreset={async (presetId) => {
              const nextPresets = await onDeletePreset(presetId);
              setDraft((current) => ({ ...current, ffmpegPresets: nextPresets }));
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/8 px-6 py-5">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
