import { Sparkles } from 'lucide-react';

import type { FFmpegOptions, FFmpegPreset, PremiereStatusResponse } from '../../api/types';
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

const VIDEO_CODEC_OPTIONS: DropdownOption[] = [
  { value: 'h264', label: 'H.264' },
  { value: 'h265', label: 'H.265' },
  { value: 'vp9', label: 'VP9' },
  { value: 'av1', label: 'AV1' },
  { value: 'copy', label: 'Copy stream' },
];

const AUDIO_CODEC_OPTIONS: DropdownOption[] = [
  { value: 'aac', label: 'AAC' },
  { value: 'mp3', label: 'MP3' },
  { value: 'opus', label: 'Opus' },
  { value: 'flac', label: 'FLAC' },
  { value: 'copy', label: 'Copy stream' },
];

const RESOLUTION_OPTIONS: DropdownOption[] = [
  { value: 'original', label: 'Original' },
  { value: 'highest', label: 'Match source' },
  { value: '2160', label: '4K' },
  { value: '1440', label: '1440p' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
];

const BITRATE_OPTIONS: DropdownOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '8M', label: '8 Mbps' },
  { value: '20M', label: '20 Mbps' },
  { value: '40M', label: '40 Mbps' },
];

const AUDIO_BITRATE_OPTIONS: DropdownOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '128k', label: '128 kbps' },
  { value: '192k', label: '192 kbps' },
  { value: '256k', label: '256 kbps' },
  { value: '320k', label: '320 kbps' },
];

const FRAMERATE_OPTIONS: DropdownOption[] = [
  { value: 'original', label: 'Original' },
  { value: '24', label: '24 FPS' },
  { value: '25', label: '25 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
];

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
  if (!open) {
    return null;
  }

  const premiereReady = premiereStatus.canImport;
  const premiereLabel = premiereReady
    ? 'Add to Premiere'
    : premiereStatus.reason;

  return (
    <div className="panel-surface grid gap-4 px-4 py-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
      <Dropdown
        value={value.outputFormat}
        options={OUTPUT_OPTIONS}
        onChange={(event) => onChange({ outputFormat: event.target.value })}
      />
      <Dropdown
        value={value.videoCodec}
        options={VIDEO_CODEC_OPTIONS}
        onChange={(event) => onChange({ videoCodec: event.target.value })}
      />
      <Dropdown
        value={value.audioCodec}
        options={AUDIO_CODEC_OPTIONS}
        onChange={(event) => onChange({ audioCodec: event.target.value })}
      />
      <Dropdown
        value={value.resolution}
        options={RESOLUTION_OPTIONS}
        onChange={(event) => onChange({ resolution: event.target.value })}
      />
      <Dropdown
        value={value.videoBitrate}
        options={BITRATE_OPTIONS}
        onChange={(event) => onChange({ videoBitrate: event.target.value })}
      />
      <Dropdown
        value={value.audioBitrate}
        options={AUDIO_BITRATE_OPTIONS}
        onChange={(event) => onChange({ audioBitrate: event.target.value })}
      />
      <Dropdown
        value={value.frameRate}
        options={FRAMERATE_OPTIONS}
        onChange={(event) => onChange({ frameRate: event.target.value })}
      />
      <Dropdown
        placeholder="Load preset"
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
          label="Save thumbnail"
        />
        <Checkbox
          checked={value.subtitles}
          onChange={(event) => onChange({ subtitles: event.target.checked })}
          label="Save subtitles"
        />
        <div className="w-32">
          <Dropdown
            value={value.subtitleLang}
            options={[
              { value: 'en', label: 'Subtitles EN' },
              { value: 'fr', label: 'Subtitles FR' },
              { value: 'es', label: 'Subtitles ES' },
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
            Save preset
          </Button>
        </div>
      </div>
    </div>
  );
}
