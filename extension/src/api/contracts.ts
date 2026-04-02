export interface ExtensionSettings {
  resolution: string;
  downloadPath: string;
  audioOnly: boolean;
  downloadMP3: boolean;
  videoOnly: boolean;
  secondsBefore: string;
  secondsAfter: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  resolution: '1080',
  downloadPath: '',
  audioOnly: false,
  downloadMP3: false,
  videoOnly: false,
  secondsBefore: '15',
  secondsAfter: '15',
};

export interface DownloadRequest {
  requestId?: string;
  videoUrl: string;
  downloadType: 'full' | 'audio' | 'clip';
  audioOnly?: boolean;
  downloadMP3?: boolean;
  clipIn?: number;
  clipOut?: number;
  currentTime?: number;
  downloadPath?: string;
  secondsBefore?: number;
  secondsAfter?: number;
  videoOnly?: boolean;
  resolution?: string;
}

export type DownloadStage =
  | 'preparing'
  | 'resolving'
  | 'downloading'
  | 'clipping'
  | 'importing'
  | 'complete'
  | 'failed';

export interface DownloadProgressState {
  stage: DownloadStage;
  indeterminate: boolean;
  percentage?: string;
  detail?: string;
  updatedAt?: number;
  path?: string;
  message?: string;
}
