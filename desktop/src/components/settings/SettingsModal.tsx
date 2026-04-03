import { useEffect, useState } from 'react';
import { FolderOpen, X } from 'lucide-react';

import type { DesktopSettings, FFmpegPreset } from '../../api/types';
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
};

export function SettingsModal({
  open,
  settings,
  onClose,
  onSave,
  onPickFolder,
  onLoadPreset,
  onDeletePreset,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!open) {
    return null;
  }

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
              <span>Default download path</span>
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
                label="Auto-import when Premiere and the CEP panel are ready"
              />
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
