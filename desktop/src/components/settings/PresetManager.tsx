import { Trash2 } from 'lucide-react';

import type { FFmpegPreset } from '../../api/types';
import { Button } from '../common/Button';

type PresetManagerProps = {
  presets: FFmpegPreset[];
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
};

export function PresetManager({ presets, onLoadPreset, onDeletePreset }: PresetManagerProps) {
  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/4 p-4">
      <div className="text-sm font-semibold text-white">FFmpeg presets</div>
      {presets.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)]">No presets saved yet.</div>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-2"
            >
              <button
                type="button"
                className="truncate text-left text-sm text-white"
                onClick={() => onLoadPreset(preset.id)}
              >
                {preset.name}
              </button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => onDeletePreset(preset.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
