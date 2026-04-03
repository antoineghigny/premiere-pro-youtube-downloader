export const SPEED_GRAPH_WINDOW_MS = 15000;
export const SPEED_GRAPH_SAMPLE_MS = 1250;
export const SPEED_GRAPH_MAX_POINTS = Math.ceil(SPEED_GRAPH_WINDOW_MS / SPEED_GRAPH_SAMPLE_MS);

export type SpeedHistoryState = {
  points: number[];
  lastSampleAt?: number;
  rollingRate?: number;
};

export function updateSpeedHistory(
  history: SpeedHistoryState,
  rawRate: number,
  now = Date.now()
): SpeedHistoryState {
  if (!Number.isFinite(rawRate) || rawRate <= 0) {
    return history;
  }

  const rollingRate = history.rollingRate === undefined
    ? rawRate
    : (history.rollingRate * 0.82) + (rawRate * 0.18);

  if (history.lastSampleAt === undefined || now - history.lastSampleAt >= SPEED_GRAPH_SAMPLE_MS) {
    return {
      points: history.points.concat(rollingRate).slice(-SPEED_GRAPH_MAX_POINTS),
      lastSampleAt: now,
      rollingRate,
    };
  }

  if (history.points.length === 0) {
    return {
      points: [rollingRate],
      lastSampleAt: history.lastSampleAt,
      rollingRate,
    };
  }

  const previousPoint = history.points[history.points.length - 1] ?? rollingRate;
  const nextPoint = (previousPoint * 0.85) + (rollingRate * 0.15);

  return {
    points: history.points.slice(0, -1).concat(nextPoint),
    lastSampleAt: history.lastSampleAt,
    rollingRate,
  };
}

export function getRepresentativeTransferRate(points: number[]): number {
  const recentPoints = points.filter((point) => point > 0).slice(-SPEED_GRAPH_MAX_POINTS);
  if (recentPoints.length === 0) {
    return 0;
  }

  if (recentPoints.length < 5) {
    return recentPoints.reduce((sum, point) => sum + point, 0) / recentPoints.length;
  }

  const sorted = [...recentPoints].sort((left, right) => left - right);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((sum, point) => sum + point, 0) / trimmed.length;
}
