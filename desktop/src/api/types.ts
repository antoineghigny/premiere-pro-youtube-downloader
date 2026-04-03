export type DownloadType = 'full' | 'audio' | 'clip';

export type DownloadStage =
  | 'preparing'
  | 'resolving'
  | 'downloading'
  | 'clipping'
  | 'importing'
  | 'complete'
  | 'failed';

export type DownloadItemStatus = 'queued' | 'starting' | 'running' | 'complete' | 'failed';

export type ViewMode = 'list' | 'grid';

export interface FFmpegOptions {
  outputFormat: string;
  videoCodec: string;
  audioCodec: string;
  resolution: string;
  videoBitrate: string;
  audioBitrate: string;
  frameRate: string;
  thumbnail: boolean;
  subtitles: boolean;
  subtitleLang: string;
  importToPremiere: boolean;
  presetName?: string;
}

export interface FFmpegPreset {
  id: string;
  name: string;
  options: FFmpegOptions;
}

export interface DesktopSettings {
  resolution: string;
  downloadPath: string;
  audioDownloadPath: string;
  askAudioPathEachTime: boolean;
  askDownloadPathEachTime: boolean;
  videoOnly: boolean;
  defaultImportToPremiere: boolean;
  ffmpegPresets: FFmpegPreset[];
  theme: 'dark' | 'light';
  language: 'en' | 'fr';
  concurrentDownloads: number;
}

export const DEFAULT_FFMPEG_OPTIONS: FFmpegOptions = {
  outputFormat: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  resolution: '1080',
  videoBitrate: 'auto',
  audioBitrate: '192k',
  frameRate: 'original',
  thumbnail: false,
  subtitles: false,
  subtitleLang: 'en',
  importToPremiere: false,
};

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  resolution: '1080',
  downloadPath: '',
  audioDownloadPath: '',
  askAudioPathEachTime: false,
  askDownloadPathEachTime: false,
  videoOnly: false,
  defaultImportToPremiere: false,
  ffmpegPresets: [],
  theme: 'dark',
  language: 'en',
  concurrentDownloads: 2,
};

export interface DownloadRequestPayload {
  requestId?: string;
  videoUrl: string;
  downloadType: DownloadType;
  audioOnly?: boolean;
  downloadMP3?: boolean;
  clipIn?: number;
  clipOut?: number;
  downloadPath?: string;
  videoOnly?: boolean;
  resolution?: string;
  importToPremiere?: boolean;
  ffmpeg?: FFmpegOptions;
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  channel?: string;
  webpageUrl?: string;
}

export interface HistoryEntry {
  id: string;
  requestId: string;
  url: string;
  title: string;
  thumbnail?: string;
  downloadType: DownloadType;
  outputPath: string;
  status: 'queued' | 'running' | 'interrupted' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
  fileSize?: number;
  settings: DownloadRequestPayload;
}

export interface HistoryResponse {
  items: HistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PremiereStatusResponse {
  running: boolean;
  cepRegistered?: boolean;
}

export interface DownloadRequestResponse {
  success: boolean;
  requestId: string;
  error?: string;
}

export interface SocketEventBase {
  type: 'progress' | 'complete' | 'failed';
  requestId: string;
}

export interface SocketProgressEvent extends SocketEventBase {
  type: 'progress';
  stage: DownloadStage;
  percentage?: string;
  speed?: string;
  eta?: string;
  detail?: string;
  indeterminate: boolean;
}

export interface SocketCompleteEvent extends SocketEventBase {
  type: 'complete';
  path: string;
  percentage?: string;
}

export interface SocketFailedEvent extends SocketEventBase {
  type: 'failed';
  message: string;
  stage?: DownloadStage;
  indeterminate?: boolean;
}

export type SocketEvent = SocketProgressEvent | SocketCompleteEvent | SocketFailedEvent;

export interface ActiveDownloadState {
  requestId: string;
  stage: DownloadStage;
  percentage?: string;
  speed?: string;
  eta?: string;
  detail?: string;
  indeterminate: boolean;
  path?: string;
  message?: string;
  updatedAt: string;
}

export interface ActiveDownloadsResponse {
  items: ActiveDownloadState[];
}

export interface DownloadItem {
  requestId: string;
  historyId?: string;
  url: string;
  title: string;
  thumbnail?: string;
  status: DownloadItemStatus;
  stage: DownloadStage;
  progress: number;
  percentageLabel?: string;
  detail?: string;
  indeterminate: boolean;
  speed?: string;
  eta?: string;
  outputPath?: string;
  error?: string;
  totalBytes?: number;
  startedAt: string;
  completedAt?: string;
  speedPoints: number[];
  speedSampledAt?: number;
  speedRollingRate?: number;
  request: DownloadRequestPayload;
}
