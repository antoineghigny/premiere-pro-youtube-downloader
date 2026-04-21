import React from 'react';
import type { FFmpegOptions, PremiereStatusResponse, DesktopSettings } from '../../api/types';
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

type FFmpegPanelProps = {
  options: FFmpegOptions;
  onChange: (patch: Partial<FFmpegOptions>) => void;
  settings: DesktopSettings;
  premiereStatus: PremiereStatusResponse;
};

export function FFmpegPanel({
  options,
  onChange,
  settings,
  premiereStatus,
}: FFmpegPanelProps) {
  const t = useTranslation();
  const premiereReady = premiereStatus.canImport;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="rv-label">Format</label>
          <Dropdown
            value={options.outputFormat}
            options={OUTPUT_OPTIONS}
            onChange={(e) => onChange({ outputFormat: e.target.value })}
            className="h-[24px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="rv-label">Video Codec</label>
          <Dropdown
            value={options.videoCodec}
            options={[
              { value: 'h264', label: 'H.264' },
              { value: 'h265', label: 'H.265' },
              { value: 'vp9', label: 'VP9' },
              { value: 'copy', label: 'Copy Stream' },
            ]}
            onChange={(e) => onChange({ videoCodec: e.target.value })}
            className="h-[24px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="rv-label">Audio Codec</label>
          <Dropdown
            value={options.audioCodec}
            options={[
              { value: 'aac', label: 'AAC' },
              { value: 'mp3', label: 'MP3' },
              { value: 'opus', label: 'Opus' },
              { value: 'copy', label: 'Copy Stream' },
            ]}
            onChange={(e) => onChange({ audioCodec: e.target.value })}
            className="h-[24px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="rv-label">Video Bitrate</label>
          <Dropdown
            value={options.videoBitrate}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: '8M', label: '8 Mbps' },
              { value: '20M', label: '20 Mbps' },
              { value: '40M', label: '40 Mbps' },
            ]}
            onChange={(e) => onChange({ videoBitrate: e.target.value })}
            className="h-[24px]"
          />
        </div>
      </div>

      <div className="border-t border-rv-border-inset pt-4 flex flex-col gap-3">
        <Checkbox
          checked={options.thumbnail}
          onChange={(e) => onChange({ thumbnail: e.target.checked })}
          label="Save Thumbnail"
        />
        <Checkbox
          checked={options.subtitles}
          onChange={(e) => onChange({ subtitles: e.target.checked })}
          label="Download Subtitles"
        />
        {options.subtitles && (
          <div className="pl-6 flex flex-col gap-1.5">
            <label className="text-[9px] text-rv-text-disabled uppercase font-bold">Subtitle Language</label>
            <Dropdown
              value={options.subtitleLang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'French' },
                { value: 'es', label: 'Spanish' },
              ]}
              onChange={(e) => onChange({ subtitleLang: e.target.value })}
              className="h-[22px] w-full"
            />
          </div>
        )}
        <Checkbox
          checked={options.importToPremiere}
          onChange={(e) => onChange({ importToPremiere: e.target.checked })}
          disabled={!premiereReady}
          label={premiereReady ? "Auto-Import to Premiere" : `Premiere: ${premiereStatus.reason}`}
        />
      </div>

      <div className="mt-2">
        <label className="rv-label mb-2 block">Quick Presets</label>
        <div className="flex flex-wrap gap-1.5">
          {settings.ffmpegPresets.map((preset: any) => (
            <button
              key={preset.id}
              className="rv-button h-[20px] text-[10px] px-2 bg-rv-input border-rv-border-inset hover:bg-rv-button-hover"
              onClick={() => onChange(preset.options)}
            >
              {preset.name}
            </button>
          ))}
          {settings.ffmpegPresets.length === 0 && (
            <span className="text-[10px] text-rv-text-disabled italic">No presets saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
