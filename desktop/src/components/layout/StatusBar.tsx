import { AlertCircle, CheckCircle2, CircleDotDashed, Download } from 'lucide-react';

type StatusBarProps = {
  totalCount: number;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  completedPercent: number;
  activePercent: number;
  failedPercent: number;
  queuedPercent: number;
};

function StatChip({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'neutral' | 'green' | 'blue' | 'red';
}) {
  const toneClassName = {
    neutral: 'border-white/10 bg-white/[0.04] text-[var(--text-muted)]',
    green: 'border-emerald-400/16 bg-emerald-400/[0.10] text-emerald-100',
    blue: 'border-sky-400/18 bg-sky-400/[0.11] text-sky-100',
    red: 'border-rose-400/18 bg-rose-400/[0.11] text-rose-100',
  }[tone];

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClassName}`}>
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span>{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

export function StatusBar({
  totalCount,
  activeCount,
  queuedCount,
  completedCount,
  failedCount,
  completedPercent,
  activePercent,
  failedPercent,
  queuedPercent,
}: StatusBarProps) {
  const processedPercent = Math.min(100, Math.max(0, completedPercent));
  const hasItems = totalCount > 0;

  return (
    <div className="panel-surface sticky bottom-0 z-20 mt-auto shrink-0 border-white/10 bg-[rgba(9,10,18,0.95)] px-4 py-3 backdrop-blur-xl">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatChip
            icon={<Download className="h-3.5 w-3.5" />}
            label="downloads"
            value={totalCount}
          />
          <StatChip
            icon={<CircleDotDashed className="h-3.5 w-3.5" />}
            label="active"
            value={activeCount}
            tone="blue"
          />
          <StatChip
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="done"
            value={completedCount}
            tone="green"
          />
          <StatChip
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label="errors"
            value={failedCount}
            tone="red"
          />
          {queuedCount > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.035] px-3 py-1.5 text-xs text-[var(--text-muted)]">
              <span>{queuedCount}</span>
              <span>queued</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span>Queue</span>
            <span>{hasItems ? `${processedPercent.toFixed(0)}% processed` : 'No downloads yet'}</span>
          </div>

          <div className="overflow-hidden rounded-full border border-white/8 bg-white/[0.045]">
            <div className="flex h-4 w-full overflow-hidden">
              {completedPercent > 0 ? (
                <div
                  className="h-full bg-[linear-gradient(90deg,#0f9f74,#20c997)] transition-[width] duration-500"
                  style={{ width: `${completedPercent}%` }}
                />
              ) : null}
              {activePercent > 0 ? (
                <div
                  className="relative h-full overflow-hidden bg-[linear-gradient(90deg,#1d7de3,#38bdf8)] transition-[width] duration-500"
                  style={{ width: `${activePercent}%` }}
                >
                  <div className="yt2pp-status-active-stripes absolute inset-0" />
                </div>
              ) : null}
              {failedPercent > 0 ? (
                <div
                  className="h-full bg-[linear-gradient(90deg,#c73b5c,#ef476f)] transition-[width] duration-500"
                  style={{ width: `${failedPercent}%` }}
                />
              ) : null}
              {queuedPercent > 0 ? (
                <div
                  className="h-full bg-white/[0.08] transition-[width] duration-500"
                  style={{ width: `${queuedPercent}%` }}
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
            <span>Green = done</span>
            <span>Blue = downloading</span>
            <span>Red = errors</span>
          </div>
        </div>
      </div>
    </div>
  );
}
