import type { Dispatch, SetStateAction } from 'react';
import {
  CheckCircle2,
  Download,
  FolderOpen,
  HardDriveDownload,
  Link2,
  MoreHorizontal,
  Scissors,
  Settings2,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

import type {
  DesktopSettings,
  DownloadItem,
  FFmpegOptions,
  OutputTarget,
  PremiereStatusResponse,
  VideoInfo,
} from '../../api/types';
import { useTranslation } from '../../i18n';
import type { useDownloads } from '../../hooks/useDownloads';
import type { QueueStatusSummary } from '../../utils/statusSummary';
import { formatBytes, formatDuration, formatElapsed, formatRepresentativeSpeed } from '../../utils/format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type DownloadsController = ReturnType<typeof useDownloads>;

type DownloadWorkspaceProps = {
  backendConnected: boolean;
  clipEnabled: boolean;
  clipEnd: string;
  clipStart: string;
  downloads: DownloadsController;
  ffmpegOptions: FFmpegOptions;
  folderOverride: string;
  info: VideoInfo | null;
  infoError: string;
  infoLoading: boolean;
  openAdvanced: boolean;
  outputTarget: OutputTarget;
  premiereStatus: PremiereStatusResponse;
  quality: string;
  queueSummary: QueueStatusSummary;
  settings: DesktopSettings;
  url: string;
  workspace: 'downloads' | 'motionStudio';
  onClipEnabledChange: Dispatch<SetStateAction<boolean>>;
  onClipEndChange: Dispatch<SetStateAction<string>>;
  onClipStartChange: Dispatch<SetStateAction<string>>;
  onDeletePreset: (presetId: string) => Promise<void>;
  onFFmpegOptionsChange: Dispatch<SetStateAction<FFmpegOptions>>;
  onFolderOverrideChange: Dispatch<SetStateAction<string>>;
  onOpenAdvancedChange: Dispatch<SetStateAction<boolean>>;
  onOutputTargetChange: Dispatch<SetStateAction<OutputTarget>>;
  onPickFolder: () => Promise<void>;
  onQualityChange: Dispatch<SetStateAction<string>>;
  onQueueDownload: () => Promise<void>;
  onSavePreset: () => Promise<void>;
  onUrlChange: Dispatch<SetStateAction<string>>;
  onWorkspaceChange: (workspace: 'downloads' | 'motionStudio') => void;
};

const RESOLUTION_OPTIONS = [
  { value: 'highest', label: 'Highest' },
  { value: '2160', label: '4K' },
  { value: '1440', label: '1440p' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
];

const OUTPUT_FORMAT_OPTIONS = ['mp4', 'mov', 'mkv', 'wav', 'mp3', 'flac', 'aac', 'opus'];
const VIDEO_CODEC_OPTIONS = ['copy', 'h264', 'h265', 'vp9', 'av1'];
const AUDIO_CODEC_OPTIONS = ['copy', 'aac', 'mp3', 'opus', 'flac'];
const BITRATE_OPTIONS = ['auto', '8M', '20M', '40M'];
const AUDIO_BITRATE_OPTIONS = ['auto', '128k', '192k', '256k', '320k'];
const FRAME_RATE_OPTIONS = ['original', '24', '25', '30', '60'];
const SUBTITLE_OPTIONS = ['en', 'fr', 'es'];

function updateFFmpegOptions(
  setOptions: Dispatch<SetStateAction<FFmpegOptions>>,
  patch: Partial<FFmpegOptions>
) {
  setOptions((current) => ({
    ...current,
    ...patch,
  }));
}

function formatOutputTargetLabel(t: ReturnType<typeof useTranslation>, value: OutputTarget) {
  return value === 'premiereProject' ? 'Import to current Premiere project' : 'Save to folder';
}

function formatStatusTone(item: DownloadItem): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (item.status === 'failed') {
    return 'destructive';
  }

  if (item.status === 'complete') {
    return 'default';
  }

  if (item.status === 'queued') {
    return 'outline';
  }

  return 'secondary';
}

function formatStageLabel(t: ReturnType<typeof useTranslation>, item: DownloadItem) {
  return t(`stages.${item.stage}`);
}

function formatPremiereLabel(
  t: ReturnType<typeof useTranslation>,
  premiereStatus: PremiereStatusResponse
) {
  if (!premiereStatus.canImport) {
    return premiereStatus.reason;
  }

  if (premiereStatus.projectName) {
    return t('titleBar.premiereReady', { name: premiereStatus.projectName });
  }

  return t('titleBar.importReady');
}

function formatBooleanLabel(enabled: boolean) {
  return enabled ? 'Enabled' : 'Disabled';
}

export function DownloadWorkspace({
  backendConnected,
  clipEnabled,
  clipEnd,
  clipStart,
  downloads,
  ffmpegOptions,
  folderOverride,
  info,
  infoError,
  infoLoading,
  openAdvanced,
  outputTarget,
  premiereStatus,
  quality,
  queueSummary,
  settings,
  url,
  workspace,
  onClipEnabledChange,
  onClipEndChange,
  onClipStartChange,
  onDeletePreset,
  onFFmpegOptionsChange,
  onFolderOverrideChange,
  onOpenAdvancedChange,
  onOutputTargetChange,
  onPickFolder,
  onQualityChange,
  onQueueDownload,
  onSavePreset,
  onUrlChange,
  onWorkspaceChange,
}: DownloadWorkspaceProps) {
  const t = useTranslation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-20 flex-col items-center justify-between border-r border-border/70 bg-card/60 px-3 py-5">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <Sparkles className="size-5" />
          </div>
          <Button
            variant={workspace === 'downloads' ? 'secondary' : 'ghost'}
            size="icon-lg"
            className="rounded-2xl"
            onClick={() => onWorkspaceChange('downloads')}
          >
            <HardDriveDownload className="size-5" />
          </Button>
          <Button
            variant={workspace === 'motionStudio' ? 'secondary' : 'ghost'}
            size="icon-lg"
            className="rounded-2xl"
            onClick={() => onWorkspaceChange('motionStudio')}
          >
            <WandSparkles className="size-5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-2xl"
          onClick={() => downloads.setSettingsOpen(true)}
        >
          <Settings2 className="size-5" />
        </Button>
      </aside>

      <main className="flex-1 p-6">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {t('titleBar.appName')}
              </div>
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">Download workspace</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  One clear flow for quick downloads, Premiere delivery, and advanced export when needed.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={backendConnected ? 'default' : 'destructive'}>
                {backendConnected ? t('titleBar.ready') : t('titleBar.offline')}
              </Badge>
              <Badge variant={premiereStatus.canImport ? 'secondary' : 'outline'}>
                {formatPremiereLabel(t, premiereStatus)}
              </Badge>
            </div>
          </header>

          <Card className="border border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="border-b border-border/70">
              <CardTitle>New download</CardTitle>
              <CardDescription>
                Queue one download at a time here. Everything else stays secondary.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 py-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="download-url">Source URL</FieldLabel>
                  <FieldDescription>Paste a supported video URL and queue it in one click.</FieldDescription>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>
                        <Link2 className="size-4" />
                      </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="download-url"
                      value={url}
                      placeholder={t('urlBar.placeholder')}
                      onChange={(event) => onUrlChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void onQueueDownload();
                        }
                      }}
                    />
                  </InputGroup>
                </Field>

                <div className="grid gap-4 lg:grid-cols-[180px_260px_minmax(0,1fr)]">
                  <Field>
                    <FieldLabel>Resolution</FieldLabel>
                    <Select
                      value={quality}
                      onValueChange={onQualityChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTION_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Destination</FieldLabel>
                    <FieldDescription>
                      {outputTarget === 'premiereProject'
                        ? 'Imports directly into the current Premiere project when Premiere is ready.'
                        : 'Saves the exported media into a folder on disk.'}
                    </FieldDescription>
                    <Select
                      value={outputTarget}
                      onValueChange={(value) => onOutputTargetChange(value as OutputTarget)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="downloadFolder">Save to folder</SelectItem>
                        <SelectItem value="premiereProject">Import to current Premiere project</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Folder override</FieldLabel>
                    <FieldDescription>
                      Leave empty to use the default folder from settings.
                    </FieldDescription>
                    <InputGroup>
                      <InputGroupInput
                        value={folderOverride}
                        placeholder={settings.downloadPath || 'Choose a default folder in settings'}
                        onChange={(event) => onFolderOverrideChange(event.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void onPickFolder();
                          }}
                        >
                          <FolderOpen className="size-4" />
                          Browse
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </div>

                {infoError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Queue blocked</AlertTitle>
                    <AlertDescription>{infoError}</AlertDescription>
                  </Alert>
                ) : null}

                {outputTarget === 'premiereProject' && !premiereStatus.canImport ? (
                  <Alert>
                    <WandSparkles className="size-4" />
                    <AlertTitle>Premiere import is not ready</AlertTitle>
                    <AlertDescription>{premiereStatus.reason}</AlertDescription>
                  </Alert>
                ) : null}
              </FieldGroup>

              <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Preview
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Metadata appears here before the download enters the queue.
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  {info?.thumbnail ? (
                    <img
                      src={info.thumbnail}
                      alt={info.title}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-muted/40 text-muted-foreground">
                      <Sparkles className="size-5" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="line-clamp-2 font-medium">
                    {infoLoading ? t('urlBar.resolvingMetadata') : info?.title || 'Paste a supported URL to preview the media.'}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {info?.channel ? <span>{info.channel}</span> : null}
                    {info?.duration ? <span>{formatDuration(info.duration)}</span> : null}
                    <span>{formatOutputTargetLabel(t, outputTarget)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Queue: {queueSummary.totalCount}</Badge>
                <Badge variant="outline">Active: {queueSummary.activeCount}</Badge>
                <Badge variant="outline">Done: {queueSummary.completedCount}</Badge>
                <Badge variant="outline">Errors: {queueSummary.failedCount}</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenAdvancedChange(true)}
                >
                  Advanced
                </Button>
                <Button
                  onClick={() => {
                    void onQueueDownload();
                  }}
                >
                  <Download className="size-4" />
                  {t('urlBar.queue')}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div>
                    <CardTitle>Queue</CardTitle>
                    <CardDescription>One list, one set of actions, no duplicated controls.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Queued {queueSummary.queuedCount}</Badge>
                    <Badge variant="outline">Running {queueSummary.activeCount}</Badge>
                    <Badge variant="outline">Completed {queueSummary.completedCount}</Badge>
                    <Badge variant="outline">Failed {queueSummary.failedCount}</Badge>
                  </div>
                </div>
                <CardAction className="w-full xl:w-auto">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <InputGroup className="w-full sm:w-[280px]">
                      <InputGroupAddon>
                        <InputGroupText>
                          <Link2 className="size-4" />
                        </InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        value={downloads.filterText}
                        placeholder={t('menuBar.filterPlaceholder')}
                        onChange={(event) => downloads.setFilterText(event.target.value)}
                      />
                    </InputGroup>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <MoreHorizontal className="size-4" />
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Queue</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => downloads.clearCompleted()}>
                          {t('menuBar.clearCompleted')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void downloads.clearPersistedHistory()}>
                          {t('menuBar.resetHistory')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardAction>
              </div>
            </CardHeader>
            <CardContent className="py-4">
              {downloads.items.length === 0 ? (
                <Empty className="border border-dashed border-border/70 bg-background/40">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HardDriveDownload className="size-4" />
                    </EmptyMedia>
                    <EmptyTitle>{t('downloadTable.emptyTitle')}</EmptyTitle>
                    <EmptyDescription>{t('downloadTable.emptyDescription')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[220px]">Progress</TableHead>
                      <TableHead>Transfer</TableHead>
                      <TableHead className="w-[72px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downloads.items.map((item) => (
                      <TableRow key={item.requestId}>
                        <TableCell className="min-w-[340px]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted/35">
                              {item.thumbnail ? (
                                <img
                                  src={item.thumbnail}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Sparkles className="size-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="truncate font-medium">{item.title}</div>
                              <div className="truncate text-xs text-muted-foreground">{item.detail || item.url}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatOutputTargetLabel(t, item.request.outputTarget ?? settings.outputTarget)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={formatStatusTone(item)}>{formatStageLabel(t, item)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                              <span>{item.percentageLabel || (item.indeterminate ? t('download.working') : `${item.progress.toFixed(0)}%`)}</span>
                              <span className={item.status === 'failed' ? 'text-destructive' : ''}>
                                {item.error || formatElapsed(item.startedAt, item.completedAt)}
                              </span>
                            </div>
                            <Progress value={item.indeterminate && item.progress === 0 ? 8 : item.progress} />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{formatRepresentativeSpeed(item.speedPoints, item.speed)}</div>
                          <div>{item.eta || formatBytes(item.totalBytes)}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={item.status !== 'complete'}
                                onSelect={() => void downloads.revealDownload(item)}
                              >
                                Open file
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => downloads.retryDownload(item)}>
                                Retry
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => void downloads.deleteDownload(item)}
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Sheet
        open={openAdvanced}
        onOpenChange={onOpenAdvancedChange}
      >
        <SheetContent
          side="right"
          className="w-full max-w-2xl p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>Advanced export</SheetTitle>
            <SheetDescription>One place for export options, clip range, and presets.</SheetDescription>
          </SheetHeader>
          <Tabs
            defaultValue="export"
            className="h-full"
          >
            <div className="border-b border-border/70 px-4 py-3">
              <TabsList variant="line">
                <TabsTrigger value="export">Export</TabsTrigger>
                <TabsTrigger value="clip">Clip</TabsTrigger>
                <TabsTrigger value="presets">Presets</TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="h-[calc(100vh-148px)]">
              <TabsContent
                value="export"
                className="p-4"
              >
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Output format</FieldLabel>
                      <Select
                        value={ffmpegOptions.outputFormat}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { outputFormat: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OUTPUT_FORMAT_OPTIONS.map((value) => (
                            <SelectItem
                              key={value}
                              value={value}
                            >
                              {value.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Resolution override</FieldLabel>
                      <Select
                        value={ffmpegOptions.resolution}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { resolution: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="original">{t('ffmpegPanel.original')}</SelectItem>
                          <SelectItem value="highest">{t('ffmpegPanel.matchSource')}</SelectItem>
                          {RESOLUTION_OPTIONS.filter((option) => option.value !== 'highest').map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Video codec</FieldLabel>
                      <Select
                        value={ffmpegOptions.videoCodec}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { videoCodec: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VIDEO_CODEC_OPTIONS.map((value) => (
                            <SelectItem
                              key={value}
                              value={value}
                            >
                              {value === 'copy' ? t('ffmpegPanel.copyStream') : value.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Audio codec</FieldLabel>
                      <Select
                        value={ffmpegOptions.audioCodec}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { audioCodec: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AUDIO_CODEC_OPTIONS.map((value) => (
                            <SelectItem
                              key={value}
                              value={value}
                            >
                              {value === 'copy' ? t('ffmpegPanel.copyStream') : value.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Video bitrate</FieldLabel>
                      <Select
                        value={ffmpegOptions.videoBitrate}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { videoBitrate: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BITRATE_OPTIONS.map((value) => (
                            <SelectItem
                              key={value}
                              value={value}
                            >
                              {value === 'auto' ? t('ffmpegPanel.auto') : value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Audio bitrate</FieldLabel>
                      <Select
                        value={ffmpegOptions.audioBitrate}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { audioBitrate: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AUDIO_BITRATE_OPTIONS.map((value) => (
                            <SelectItem
                              key={value}
                              value={value}
                            >
                              {value === 'auto' ? t('ffmpegPanel.auto') : value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Frame rate</FieldLabel>
                      <Select
                        value={ffmpegOptions.frameRate}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { frameRate: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FRAME_RATE_OPTIONS.map((value) => (
                            <SelectItem
                              key={value}
                              value={value}
                            >
                              {value === 'original' ? t('ffmpegPanel.original') : value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>Subtitle language</FieldLabel>
                      <Select
                        value={ffmpegOptions.subtitleLang}
                        onValueChange={(value) => updateFFmpegOptions(onFFmpegOptionsChange, { subtitleLang: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBTITLE_OPTIONS.map((value) => (
                            <SelectItem
                              key={value}
                              value={value}
                            >
                              {value.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="grid gap-3 rounded-xl border border-border/70 bg-background/40 p-4">
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor="save-thumbnail">Save thumbnail</FieldLabel>
                        <FieldDescription>{formatBooleanLabel(ffmpegOptions.thumbnail)}</FieldDescription>
                      </FieldContent>
                      <Switch
                        id="save-thumbnail"
                        checked={ffmpegOptions.thumbnail}
                        onCheckedChange={(checked) => updateFFmpegOptions(onFFmpegOptionsChange, { thumbnail: checked })}
                      />
                    </Field>

                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor="save-subtitles">Save subtitles</FieldLabel>
                        <FieldDescription>{formatBooleanLabel(ffmpegOptions.subtitles)}</FieldDescription>
                      </FieldContent>
                      <Switch
                        id="save-subtitles"
                        checked={ffmpegOptions.subtitles}
                        onCheckedChange={(checked) => updateFFmpegOptions(onFFmpegOptionsChange, { subtitles: checked })}
                      />
                    </Field>

                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor="import-premiere">Import to Premiere</FieldLabel>
                        <FieldDescription>
                          {premiereStatus.canImport ? formatPremiereLabel(t, premiereStatus) : premiereStatus.reason}
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="import-premiere"
                        checked={ffmpegOptions.importToPremiere}
                        disabled={!premiereStatus.canImport}
                        onCheckedChange={(checked) => updateFFmpegOptions(onFFmpegOptionsChange, { importToPremiere: checked })}
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </TabsContent>

              <TabsContent
                value="clip"
                className="p-4"
              >
                <FieldGroup>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="clip-enabled">Clip mode</FieldLabel>
                      <FieldDescription>Trim the source before the download is finalized.</FieldDescription>
                    </FieldContent>
                    <Switch
                      id="clip-enabled"
                      checked={clipEnabled}
                      onCheckedChange={onClipEnabledChange}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="clip-start">IN</FieldLabel>
                      <div className="relative">
                        <Scissors className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="clip-start"
                          className="pl-9"
                          value={clipStart}
                          placeholder="00:00:00.000"
                          disabled={!clipEnabled}
                          onChange={(event) => onClipStartChange(event.target.value)}
                        />
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="clip-end">OUT</FieldLabel>
                      <div className="relative">
                        <Scissors className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="clip-end"
                          className="pl-9"
                          value={clipEnd}
                          placeholder="00:00:30.000"
                          disabled={!clipEnabled}
                          onChange={(event) => onClipEndChange(event.target.value)}
                        />
                      </div>
                    </Field>
                  </div>

                  <Alert>
                    <Scissors className="size-4" />
                    <AlertTitle>Clip timing</AlertTitle>
                    <AlertDescription>
                      Use `HH:MM:SS.mmm`. OUT must be greater than IN to queue the clip.
                    </AlertDescription>
                  </Alert>
                </FieldGroup>
              </TabsContent>

              <TabsContent
                value="presets"
                className="p-4"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/40 p-4">
                    <div>
                      <div className="font-medium">Current export preset</div>
                      <div className="text-sm text-muted-foreground">
                        Save the current advanced export settings for later reuse.
                      </div>
                    </div>
                    <Button onClick={() => void onSavePreset()}>
                      <Sparkles className="size-4" />
                      {t('ffmpegPanel.savePreset')}
                    </Button>
                  </div>

                  {settings.ffmpegPresets.length === 0 ? (
                    <Empty className="border border-dashed border-border/70 bg-background/40">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Sparkles className="size-4" />
                        </EmptyMedia>
                        <EmptyTitle>{t('presetManager.empty')}</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="space-y-3">
                      {settings.ffmpegPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{preset.name}</div>
                            <div className="truncate text-sm text-muted-foreground">
                              {preset.options.outputFormat.toUpperCase()} · {preset.options.videoCodec.toUpperCase()} · {preset.options.audioCodec.toUpperCase()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => onFFmpegOptionsChange(preset.options)}
                            >
                              <CheckCircle2 className="size-4" />
                              Apply
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => void onDeletePreset(preset.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
