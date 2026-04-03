import { ScissorsLineDashed } from 'lucide-react';

import { TimeInput } from '../common/TimeInput';

type ClipPanelProps = {
  open: boolean;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
};

export function ClipPanel({ open, start, end, onStartChange, onEndChange }: ClipPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="panel-surface flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center">
      <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
        <ScissorsLineDashed className="h-4 w-4" />
        Clip range
      </div>
      <div className="grid flex-1 gap-3 md:grid-cols-2">
        <TimeInput
          value={start}
          onChange={(event) => onStartChange(event.target.value)}
          placeholder="00:00:00.000"
        />
        <TimeInput
          value={end}
          onChange={(event) => onEndChange(event.target.value)}
          placeholder="00:05:30.000"
        />
      </div>
    </div>
  );
}
