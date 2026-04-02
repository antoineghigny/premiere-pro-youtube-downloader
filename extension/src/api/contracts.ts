export interface ExtensionSettings {
  resolution: string;
  downloadPath: string;
  audioDownloadPath: string;
  askAudioPathEachTime: boolean;
  askDownloadPathEachTime: boolean;
  videoOnly: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  resolution: '1080',
  downloadPath: '',
  audioDownloadPath: '',
  askAudioPathEachTime: false,
  askDownloadPathEachTime: false,
  videoOnly: false,
};

export interface DownloadRequest {
  requestId?: string;
  videoUrl: string;
  downloadType: 'full' | 'audio' | 'clip';
  audioOnly?: boolean;
  downloadMP3?: boolean;
  clipIn?: number;
  clipOut?: number;
  downloadPath?: string;
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
