import { describe, expect, it } from 'vitest';

import { isLikelyRemoteUrl, parseTimecode } from './validation';

describe('isLikelyRemoteUrl', () => {
  it('accepts supported remote URLs across multiple sites', () => {
    expect(isLikelyRemoteUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
    expect(isLikelyRemoteUrl('https://vimeo.com/123456')).toBe(true);
    expect(isLikelyRemoteUrl(' https://www.tiktok.com/@creator/video/123 ')).toBe(true);
  });

  it('rejects empty or non-http URLs', () => {
    expect(isLikelyRemoteUrl('')).toBe(false);
    expect(isLikelyRemoteUrl('not a url')).toBe(false);
    expect(isLikelyRemoteUrl('ftp://example.com/video')).toBe(false);
  });
});

describe('parseTimecode', () => {
  it('parses mm:ss and hh:mm:ss values', () => {
    expect(parseTimecode('01:30')).toBe(90);
    expect(parseTimecode('01:02:03.5')).toBe(3723.5);
  });

  it('rejects malformed or out-of-range values', () => {
    expect(parseTimecode('')).toBeUndefined();
    expect(parseTimecode('12')).toBeUndefined();
    expect(parseTimecode('00:61')).toBeUndefined();
    expect(parseTimecode('00:00:61')).toBeUndefined();
    expect(parseTimecode('01:02:03:04')).toBeUndefined();
    expect(parseTimecode('aa:bb')).toBeUndefined();
  });
});
