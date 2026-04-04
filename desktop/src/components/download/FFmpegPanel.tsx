import { Sparkles } from 'lucide-react';

import type { FFmpegOptions, FFmpegPreset, PremiereStatusResponse } from '../../api/types';
import { useTranslation } from '../../i18n';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';
import { Dropdown, type DropdownOption } from '../common/Dropdown';

const OUTPUT_OPTIONS: DropdownOption[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mov', label: 'MOV' },
  { value: 'mkv', label: 'MKV' },
  { value: 'wav', label: 'WAV' },
  { value: 'mp3', label: 'MP3' },
  { value: 'flac', label: 'FLAC' },
  { value: 'aac', label: 'AAC' },
  { value: 'opus', label: 'Opus' },
];

const VIDEO_CODEC_OPTIONS_STATIC: Omit<DropdownOption, 'label'>[] = [
  { value: 'h264' },
  { value: 'h265' },
  { value: 'vp9' },
  { value: 'av1' },
  { value: 'copy' },
];

const AUDIO_CODEC_OPTIONS_STATIC: Omit<DropdownOption, 'label'>[] = [
  { value: 'aac' },
  { value: 'mp3' },
  { value: 'opus' },
  { value: 'flac' },
  { value: 'copy' },
];

const BITRATE_VALUES = ['auto', '8M', '20M', '40M'] as const;
const BITRATE_LABELS: Record<string, string> = { '8M': '8 Mbps', '20M': '20 Mbps', '40M': '40 Mbps' };

const AUDIO_BITRATE_VALUES = ['auto', '128k', '192k', '256k', '320k'] as const;
const AUDIO_BITRATE_LABELS: Record<string, string> = { '128k': '128 kbps', '192k': '192 kbps', '256k': '256 kbps', '320k': '320 kbps' };

const FRAMERATE_VALUES = ['original', '24', '25', '30', '60'] as const;
const FRAMERATE_LABELS: Record<string, string> = { '24': '24 FPS', '25': '25 FPS', '30': '30 FPS', '60': '60 FPS' };

type FFmpegPanelProps = {
  open: boolean;
  value: FFmpegOptions;
  presets: FFmpegPreset[];
  premiereStatus: PremiereStatusResponse;
  onChange: (patch: Partial<FFmpegOptions>) => void;
  onSavePreset: () => void;
  onLoadPreset: (presetId: string) => void;
};

export function FFmpegPanel({
  open,
  value,
  presets,
  premiereStatus,
  onChange,
  onSavePreset,
  onLoadPreset,
}: FFmpegPanelProps) {
  const t = useTranslation();

  if (!open) {
    return null;
  }

  const premiereReady = premiereStatus.canImport;
  const premiereLabel = premiereReady
    ? t('ffmpegPanel.addToPremiere')
    : premiereStatus.reason;

  const codecLabel = (v: string) =>
    v === 'copy' ? t('ffmpegPanel.copyStream') : v.toUpperCase();

  const videoCodecOptions: DropdownOption[] = VIDEO_CODEC_OPTIONS_STATIC.map(
    (opt) => ({ value: opt.value, label: codecLabel(opt.value) }),
  );
  const audioCodecOptions: DropdownOption[] = AUDIO_CODEC_OPTIONS_STATIC.map(
    (opt) => ({ value: opt.value, label: codecLabel(opt.value) }),
  );

  const resolutionOptions: DropdownOption[] = [
    { value: 'original', label: t('ffmpegPanel.original') },
    { value: 'highest', label: t('ffmpegPanel.matchSource') },
    { value: '2160', label: '4K' },
    { value: '1440', label: '1440p' },
    { value: '1080', label: '1080p' },
    { value: '720', label: '720p' },
    { value: '480', label: '480p' },
  ];

  const bitrateOptions: DropdownOption[] = BITRATE_VALUES.map(
    (v) => ({ value: v, label: v === 'auto' ? t('ffmpegPanel.auto') : BITRATE_LABELS[v] ?? v }),
  );
  const audioBitrateOptions: DropdownOption[] = AUDIO_BITRATE_VALUES.map(
    (v) => ({ value: v, label: v === 'auto' ? t('ffmpegPanel.auto') : AUDIO_BITRATE_LABELS[v] ?? v }),
  );
  const framerateOptions: DropdownOption[] = FRAMERATE_VALUES.map(
    (v) => ({ value: v, label: v === 'original' ? t('ffmpegPanel.original') : FRAMERATE_LABELS[v] ?? v }),
  );

  return (
    <div className="panel-surface grid gap-4 px-4 py-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
      <Dropdown
        value={value.outputFormat}
        options={OUTPUT_OPTIONS}
        onChange={(event) => onChange({ outputFormat: event.target.value })}
      />
      <Dropdown
        value={value.videoCodec}
        options={videoCodecOptions}
        onChange={(event) => onChange({ videoCodec: event.target.value })}
      />
      <Dropdown
        value={value.audioCodec}
        options={audioCodecOptions}
        onChange={(event) => onChange({ audioCodec: event.target.value })}
      />
      <Dropdown
        value={value.resolution}
        options={resolutionOptions}
        onChange={(event) => onChange({ resolution: event.target.value })}
      />
      <Dropdown
        value={value.videoBitrate}
        options={bitrateOptions}
        onChange={(event) => onChange({ videoBitrate: event.target.value })}
      />
      <Dropdown
        value={value.audioBitrate}
        options={audioBitrateOptions}
        onChange={(event) => onChange({ audioBitrate: event.target.value })}
      />
      <Dropdown
        value={value.frameRate}
        options={framerateOptions}
        onChange={(event) => onChange({ frameRate: event.target.value })}
      />
      <Dropdown
        placeholder={t('ffmpegPanel.loadPreset')}
        resetOnSelect
        options={presets.map((preset) => ({
          value: preset.id,
          label: preset.name,
        }))}
        onChange={(event) => {
          if (event.target.value) {
            onLoadPreset(event.target.value);
          }
        }}
      />
      <div className="col-span-full flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
        <Checkbox
          checked={value.thumbnail}
          onChange={(event) => onChange({ thumbnail: event.target.checked })}
          label={t('ffmpegPanel.saveThumbnail')}
        />
        <Checkbox
          checked={value.subtitles}
          onChange={(event) => onChange({ subtitles: event.target.checked })}
          label={t('ffmpegPanel.saveSubtitles')}
        />
        <div className="w-32">
          <Dropdown
            value={value.subtitleLang}
            options={[
              { value: 'en', label: t('ffmpegPanel.subtitlesEn') },
              { value: 'fr', label: t('ffmpegPanel.subtitlesFr') },
              { value: 'es', label: t('ffmpegPanel.subtitlesEs') },
            ]}
            onChange={(event) => onChange({ subtitleLang: event.target.value })}
          />
        </div>
        <Checkbox
          checked={value.importToPremiere}
          onChange={(event) => onChange({ importToPremiere: event.target.checked })}
          disabled={!premiereReady}
          label={premiereLabel}
        />
        <div className="ml-auto flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            icon={<Sparkles className="h-4 w-4" />}
            onClick={onSavePreset}
          >
            {t('ffmpegPanel.savePreset')}
          </Button>
        </div>
      </div>
    </div>
  );
}
