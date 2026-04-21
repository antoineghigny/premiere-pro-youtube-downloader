export type DownloadType = 'full' | 'audio' | 'clip';
export type OutputTarget = 'downloadFolder' | 'premiereProject';
export type JobKind = 'download' | 'hyperframes';

export type DownloadStage =
  | 'preparing'
  | 'resolving'
  | 'downloading'
  | 'clipping'
  | 'importing'
  | 'context'
  | 'design'
  | 'generating'
  | 'validating'
  | 'previewReady'
  | 'rendering'
  | 'encoding'
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
  geminiApiKey: string;
  outputTarget: OutputTarget;
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
  videoCodec: 'copy',
  audioCodec: 'copy',
  resolution: 'original',
  videoBitrate: 'auto',
  audioBitrate: 'auto',
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
  geminiApiKey: '',
  outputTarget: 'downloadFolder',
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
  outputTarget?: OutputTarget;
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
  cepRegistered: boolean;
  projectOpen: boolean;
  projectSaved: boolean;
  projectName?: string;
  projectPath?: string;
  projectFolder?: string;
  canImport: boolean;
  reason: string;
}

export interface IntegrationConflict {
  id: string;
  path: string;
  scope: 'user' | 'system';
  reason: string;
}

export interface IntegrationStatus {
  premiereInstalled: boolean;
  premierePanelInstalled: boolean;
  chromeInstalled: boolean;
  browserAddonReady: boolean;
  cepInstallPath?: string;
  browserAddonPath?: string;
  conflicts: IntegrationConflict[];
}

export interface IntegrationActionResponse {
  success: boolean;
  message: string;
  manualStepRequired: boolean;
  status: IntegrationStatus;
}

export interface DownloadRequestResponse {
  success: boolean;
  requestId: string;
  error?: string;
}

export interface SocketEventBase {
  type: 'progress' | 'complete' | 'failed';
  requestId: string;
  jobKind: JobKind;
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
  jobKind: JobKind;
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

export interface HyperframesCatalogItem {
  id: string;
  title: string;
  summary: string;
  promptHint: string;
  accent: string;
  tags: string[];
}

export interface PremiereSequenceContext {
  sequenceOpen: boolean;
  sequenceName: string;
  width: number;
  height: number;
  fps: number;
  timebase: string;
  playerPositionSeconds?: number;
  inPointSeconds?: number;
  outPointSeconds?: number;
  durationSeconds?: number;
  workAreaEnabled: boolean;
  rangeSource?: string;
  videoTrackCount: number;
}

export interface HyperframesContext {
  projectName?: string;
  projectPath?: string;
  projectFolder?: string;
  designPath?: string;
  designExists: boolean;
  artifactsRoot?: string;
  premiereReady: boolean;
  reason: string;
  sequence: PremiereSequenceContext;
  latestArtifactId?: string;
  latestRenderPath?: string;
}

export interface HyperframesArtifact {
  jobId: string;
  title: string;
  prompt: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  htmlPath: string;
  renderPath?: string;
  previewImagePath?: string;
  manifestPath: string;
  designPath: string;
  projectName?: string;
  sequenceName?: string;
  inPointSeconds?: number;
  outPointSeconds?: number;
}

export interface HyperframesArtifactDetail {
  artifact: HyperframesArtifact;
  htmlSource: string;
}

export interface HyperframesDesignDocument {
  path: string;
  content: string;
}

export interface HyperframesGenerateRequest {
  prompt: string;
  templateId?: string;
  manualInSeconds?: number;
  manualOutSeconds?: number;
}

export interface HyperframesActionResponse {
  success: boolean;
  jobId?: string;
}

export interface DownloadItem {
  requestId: string;
  jobKind: 'download';
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
