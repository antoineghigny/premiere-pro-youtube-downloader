import React from 'react';
import { Scissors } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { TimeInput } from '../common/TimeInput';
import { Checkbox } from '../common/Checkbox';
import { Icon } from '../common/Icon';

type ClipPanelProps = {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  start: string;
  onStartChange: (value: string) => void;
  end: string;
  onEndChange: (value: string) => void;
};

export function ClipPanel({ enabled, onEnabledChange, start, onStartChange, end, onEndChange }: ClipPanelProps) {
  const t = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Checkbox
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          label="Enable Clipping"
        />
        <p className="text-[10px] text-rv-text-disabled leading-tight pl-6">
          When enabled, only the specified range will be downloaded and processed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-rv-border-inset">
        <div className="flex flex-col gap-2">
          <label className="rv-label flex items-center gap-1.5">
            <Icon icon={Scissors} size={10} className="text-rv-accent" />
            In Point
          </label>
          <TimeInput
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
            placeholder="00:00:00.000"
            disabled={!enabled}
            className="h-[28px] text-[11px] font-mono"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="rv-label flex items-center gap-1.5">
            <Icon icon={Scissors} size={10} className="text-rv-accent" />
            Out Point
          </label>
          <TimeInput
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
            placeholder="00:00:30.000"
            disabled={!enabled}
            className="h-[28px] text-[11px] font-mono"
          />
        </div>
      </div>

      <div className="mt-2 bg-[#141414] p-3 rounded-[1px] border border-rv-border-inset shadow-inner">
        <h4 className="rv-label text-rv-text-strong mb-2">Timing Guidelines</h4>
        <ul className="text-[10px] text-rv-text-muted list-disc pl-4 space-y-1.5">
          <li>Format: <span className="font-mono text-rv-accent">HH:MM:SS.mmm</span></li>
          <li>OUT must be greater than IN</li>
          <li>Partial frames are supported via milliseconds</li>
        </ul>
      </div>
    </div>
  );
}
