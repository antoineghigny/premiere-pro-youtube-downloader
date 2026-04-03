// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  getPlayerControls,
  getProgressBar,
  getVideoElement,
  getVideoId,
  getVideoUrl,
  isVideoPage,
} from './pageUtils';

describe('pageUtils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('detects watch pages and extracts the current video URL', () => {
    window.history.replaceState({}, '', '/watch?v=abc123&feature=share');

    expect(isVideoPage()).toBe(true);
    expect(getVideoId()).toBe('abc123');
    expect(getVideoUrl()).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('prefers the main player controls over inline preview controls', () => {
    document.body.innerHTML = `
      <div id="inline-preview-player">
        <div class="ytp-left-controls" id="preview-controls"></div>
      </div>
      <div class="ytp-left-controls" id="main-controls"></div>
      <div class="ytp-preview">
        <div class="ytp-progress-bar" id="preview-progress"></div>
      </div>
      <div class="ytp-progress-bar" id="main-progress"></div>
      <video class="html5-main-video"></video>
    `;

    expect(getPlayerControls()?.id).toBe('main-controls');
    expect(getProgressBar()?.id).toBe('main-progress');
    expect(getVideoElement()).toBeInstanceOf(HTMLVideoElement);
  });
});
