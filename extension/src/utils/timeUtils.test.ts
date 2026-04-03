import { describe, expect, it } from 'vitest';

import { formatDuration, formatTime } from './timeUtils';

describe('formatTime', () => {
  it('formats minute and hour durations', () => {
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(75)).toBe('01:15');
    expect(formatTime(3661)).toBe('01:01:01');
  });
});

describe('formatDuration', () => {
  it('returns the difference between two timestamps', () => {
    expect(formatDuration(10, 25)).toBe('00:15');
    expect(formatDuration(3600, 3665)).toBe('01:05');
  });
});
