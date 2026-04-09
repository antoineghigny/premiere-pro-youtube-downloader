export type OutputTarget = 'downloadFolder' | 'premiereProject';

export interface ExtensionSettings {
  resolution: string;
  downloadPath: string;
  audioDownloadPath: string;
  outputTarget: OutputTarget;
  askAudioPathEachTime: boolean;
  askDownloadPathEachTime: boolean;
  videoOnly: boolean;
  language: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  resolution: '1080',
  downloadPath: '',
  audioDownloadPath: '',
  outputTarget: 'downloadFolder',
  askAudioPathEachTime: false,
  askDownloadPathEachTime: false,
  videoOnly: false,
  language: '',
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
  outputTarget?: OutputTarget;
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
  speed?: string;
  eta?: string;
  detail?: string;
  updatedAt?: number;
  path?: string;
  message?: string;
}
