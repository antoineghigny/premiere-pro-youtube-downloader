import { describe, expect, it } from 'vitest';

import {
  getRepresentativeTransferRate,
  SPEED_GRAPH_MAX_POINTS,
  SPEED_GRAPH_SAMPLE_MS,
  updateSpeedHistory,
} from './speedHistory';

describe('updateSpeedHistory', () => {
  it('samples at a fixed cadence and smooths in-between updates', () => {
    const first = updateSpeedHistory({ points: [] }, 1_000_000, 0);
    expect(first.points).toHaveLength(1);

    const second = updateSpeedHistory(first, 5_000_000, SPEED_GRAPH_SAMPLE_MS - 100);
    expect(second.points).toHaveLength(1);
    expect(second.points[0]).toBeGreaterThan(first.points[0]);
    expect(second.points[0]).toBeLessThan(5_000_000);

    const third = updateSpeedHistory(second, 5_000_000, SPEED_GRAPH_SAMPLE_MS + 10);
    expect(third.points).toHaveLength(2);
  });

  it('caps the graph history to the configured window', () => {
    let history = { points: [] as number[] };
    for (let index = 0; index < SPEED_GRAPH_MAX_POINTS + 5; index += 1) {
      history = updateSpeedHistory(history, 1_000_000 + index, index * SPEED_GRAPH_SAMPLE_MS);
    }

    expect(history.points).toHaveLength(SPEED_GRAPH_MAX_POINTS);
  });
});

describe('getRepresentativeTransferRate', () => {
  it('returns a trimmed average of the recent history', () => {
    const rate = getRepresentativeTransferRate([
      1_000_000,
      1_050_000,
      1_100_000,
      5_000_000,
      1_080_000,
      1_060_000,
    ]);

    expect(rate).toBeGreaterThan(1_050_000);
    expect(rate).toBeLessThan(1_200_000);
  });
});
