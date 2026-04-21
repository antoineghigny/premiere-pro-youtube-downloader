import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  FolderOpen,
  HardDriveDownload,
  Play,
  Save,
  Settings2,
  Sparkles,
  Square,
  WandSparkles,
} from 'lucide-react';

import { revealFile } from '../../api/client';
import type { DesktopSettings } from '../../api/types';
import { useMotionStudio } from '../../hooks/useMotionStudio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type MotionStudioWorkspaceProps = {
  backendConnected: boolean;
  settings: DesktopSettings;
  workspace: 'downloads' | 'motionStudio';
  studio: ReturnType<typeof useMotionStudio>;
  onOpenSettings: () => void;
  onWorkspaceChange: (workspace: 'downloads' | 'motionStudio') => void;
};

function formatTimeLabel(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return '--';
  }
  return `${value.toFixed(2)}s`;
}

export function MotionStudioWorkspace({
  backendConnected,
  settings,
  workspace,
  studio,
  onOpenSettings,
  onWorkspaceChange,
}: MotionStudioWorkspaceProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewDuration = studio.selectedArtifact?.artifact.durationSeconds ?? studio.selectedSummary?.durationSeconds ?? 0;
  const [previewTime, setPreviewTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setPreviewTime(0);
    setIsPlaying(false);
  }, [studio.selectedArtifactId, studio.selectedArtifact?.htmlSource]);

  useEffect(() => {
    if (!studio.selectedArtifact?.htmlSource) {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'yt2pp:setTime', seconds: previewTime },
      '*'
    );
  }, [previewTime, studio.selectedArtifact?.htmlSource]);

  useEffect(() => {
    if (!isPlaying || previewDuration <= 0) {
      return;
    }

    const startedAt = performance.now() - previewTime * 1000;
    const intervalId = window.setInterval(() => {
      const nextSeconds = Math.min((performance.now() - startedAt) / 1000, previewDuration);
      setPreviewTime(nextSeconds);
      if (nextSeconds >= previewDuration) {
        setIsPlaying(false);
      }
    }, 33);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, previewDuration, previewTime]);

  const activeJob = useMemo(() => {
    if (studio.selectedArtifactId) {
      return studio.jobs.find((job) => job.requestId === studio.selectedArtifactId) ?? studio.jobs[0] ?? null;
    }
    return studio.jobs[0] ?? null;
  }, [studio.jobs, studio.selectedArtifactId]);

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
          onClick={onOpenSettings}
        >
          <Settings2 className="size-5" />
        </Button>
      </aside>

      <main className="flex-1 p-6">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Motion Studio
              </div>
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  HyperFrames-style overlays inside Premiere
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Generate HTML overlays, preview them live, render ProRes 4444 with alpha, and place the result on the
                  first free V2+ track at the active range.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={backendConnected ? 'default' : 'destructive'}>
                {backendConnected ? 'Desktop backend ready' : 'Desktop backend offline'}
              </Badge>
              <Badge variant={studio.context?.premiereReady ? 'secondary' : 'outline'}>
                {studio.context?.premiereReady
                  ? `Premiere ready: ${studio.context.sequence.sequenceName || studio.context.projectName || 'sequence'}`
                  : studio.context?.reason || 'Premiere not ready'}
              </Badge>
              <Badge variant="outline">
                Range {studio.context?.sequence.rangeSource ? studio.context.sequence.rangeSource : 'manual fallback'}
              </Badge>
            </div>
          </header>

          {studio.error ? (
            <Alert variant="destructive">
              <AlertTitle>Motion Studio unavailable</AlertTitle>
              <AlertDescription>{studio.error}</AlertDescription>
            </Alert>
          ) : null}

          {studio.actionError ? (
            <Alert variant="destructive">
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{studio.actionError}</AlertDescription>
            </Alert>
          ) : null}

          {!settings.geminiApiKey ? (
            <Alert>
              <Bot data-icon="inline-start" />
              <AlertTitle>Gemini BYOK is optional but preferred</AlertTitle>
              <AlertDescription>
                No Gemini API key is configured in settings, so Motion Studio falls back to the local deterministic
                overlay template. Add a key to unlock real prompt-driven HTML generation.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="flex min-h-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generate</CardTitle>
                  <CardDescription>
                    Prompt the overlay, optionally anchor it to a template, then bind it to the Premiere IN/OUT range.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="overlay-prompt">Prompt</FieldLabel>
                      <FieldDescription>
                        Ask for a title card, stat block, chapter bumper, callout, or any premium overlay treatment.
                      </FieldDescription>
                      <Textarea
                        id="overlay-prompt"
                        value={studio.prompt}
                        placeholder="Example: Premium chapter bumper for “Why AI products feel identical” with sharp typography, a vertical accent beam, and a controlled exit."
                        rows={5}
                        onChange={(event) => studio.setPrompt(event.target.value)}
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Template anchor</FieldLabel>
                      <FieldDescription>Use one of the local starter directions or leave the model fully open.</FieldDescription>
                      <div className="grid gap-3 md:grid-cols-2">
                        {studio.catalog.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`rounded-2xl border p-4 text-left transition ${
                              studio.selectedTemplateId === item.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border/70 bg-card hover:border-primary/50'
                            }`}
                            onClick={() =>
                              studio.setSelectedTemplateId(
                                studio.selectedTemplateId === item.id ? '' : item.id
                              )
                            }
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium">{item.title}</div>
                              <div
                                className="size-3 rounded-full"
                                style={{ backgroundColor: item.accent }}
                              />
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">{item.summary}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel>Premiere range</FieldLabel>
                      <FieldDescription>
                        Motion Studio uses the active sequence IN/OUT when available. Manual start/end stays available as a fallback.
                      </FieldDescription>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Input
                          value={studio.manualIn}
                          placeholder={formatTimeLabel(studio.context?.sequence.inPointSeconds)}
                          onChange={(event) => studio.setManualIn(event.target.value)}
                        />
                        <Input
                          value={studio.manualOut}
                          placeholder={formatTimeLabel(studio.context?.sequence.outPointSeconds)}
                          onChange={(event) => studio.setManualOut(event.target.value)}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>IN {formatTimeLabel(studio.context?.sequence.inPointSeconds)}</span>
                        <span>OUT {formatTimeLabel(studio.context?.sequence.outPointSeconds)}</span>
                        <span>Duration {formatTimeLabel(studio.context?.sequence.durationSeconds)}</span>
                        <span>
                          Canvas {studio.context?.sequence.width ?? 0}x{studio.context?.sequence.height ?? 0} /{' '}
                          {studio.context?.sequence.fps?.toFixed(2) ?? '--'} fps
                        </span>
                      </div>
                    </Field>
                  </FieldGroup>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={!studio.prompt.trim() || studio.busyAction !== null}
                      onClick={() => {
                        void studio.generateCurrentPrompt();
                      }}
                    >
                      <WandSparkles data-icon="inline-start" />
                      {studio.busyAction === 'generate' ? 'Generating…' : 'Generate overlay'}
                    </Button>
                    {studio.selectedSummary?.renderPath ? (
                      <Button
                        variant="secondary"
                        disabled={studio.busyAction !== null}
                        onClick={() => {
                          void studio.importArtifact(studio.selectedSummary!.jobId);
                        }}
                      >
                        <Sparkles data-icon="inline-start" />
                        {studio.busyAction === 'import' ? 'Importing…' : 'Import into Premiere'}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-0">
                <CardHeader>
                  <CardTitle>DESIGN.md</CardTitle>
                  <CardDescription>
                    Shared project-wide visual system stored next to the Premiere project and reused across overlays.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="text-xs text-muted-foreground">{studio.designPath || 'DESIGN.md will be created at the project root.'}</div>
                  <Textarea
                    value={studio.designDraft}
                    rows={16}
                    onChange={(event) => studio.setDesignDraft(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      disabled={!studio.designDirty || studio.busyAction !== null}
                      onClick={() => {
                        void studio.saveDesign();
                      }}
                    >
                      <Save data-icon="inline-start" />
                      {studio.busyAction === 'saveDesign' ? 'Saving…' : 'Save DESIGN.md'}
                    </Button>
                    {studio.designPath ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          void revealFile(studio.designPath);
                        }}
                      >
                        <FolderOpen data-icon="inline-start" />
                        Reveal file
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex min-h-0 flex-col gap-6">
              <Card className="min-h-[520px]">
                <CardHeader>
                  <CardTitle>Live preview</CardTitle>
                  <CardDescription>
                    The saved HTML runs inside the app. Preview and render use the same time-seeking contract.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-4">
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/90">
                    {studio.selectedArtifact?.htmlSource ? (
                      <iframe
                        key={studio.selectedArtifactId}
                        ref={iframeRef}
                        title="Motion Studio Preview"
                        className="h-[420px] w-full bg-transparent"
                        sandbox="allow-scripts"
                        srcDoc={studio.selectedArtifact.htmlSource}
                      />
                    ) : (
                      <div className="flex h-[420px] items-center justify-center">
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>No preview yet</EmptyTitle>
                            <EmptyDescription>
                              Generate an overlay to create the HTML preview bundle and populate this player.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!studio.selectedArtifact?.htmlSource}
                        onClick={() => setIsPlaying((current) => !current)}
                      >
                        {isPlaying ? <Square data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                        {isPlaying ? 'Pause' : 'Play'}
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeLabel(previewTime)} / {formatTimeLabel(previewDuration)}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={previewDuration || 1}
                      step={0.01}
                      value={Math.min(previewTime, previewDuration || 1)}
                      onChange={(event) => {
                        setIsPlaying(false);
                        setPreviewTime(Number.parseFloat(event.target.value));
                      }}
                    />
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={!studio.selectedSummary || studio.busyAction !== null}
                      onClick={() => {
                        if (studio.selectedSummary) {
                          void studio.renderArtifact(studio.selectedSummary.jobId);
                        }
                      }}
                    >
                      <Sparkles data-icon="inline-start" />
                      {studio.busyAction === 'render' ? 'Rendering…' : 'Render ProRes 4444'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!studio.selectedSummary?.renderPath || studio.busyAction !== null}
                      onClick={() => {
                        if (studio.selectedSummary) {
                          void studio.importArtifact(studio.selectedSummary.jobId);
                        }
                      }}
                    >
                      <Bot data-icon="inline-start" />
                      Import to Premiere
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!studio.selectedSummary}
                      onClick={() => {
                        const pathToReveal =
                          studio.selectedSummary?.renderPath || studio.selectedSummary?.htmlPath || '';
                        if (pathToReveal) {
                          void revealFile(pathToReveal);
                        }
                      }}
                    >
                      <FolderOpen data-icon="inline-start" />
                      Reveal artifact
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <Card className="min-h-0">
                  <CardHeader>
                    <CardTitle>Active jobs</CardTitle>
                    <CardDescription>Generation and render jobs stream through the shared backend websocket.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studio.jobs.length === 0 ? (
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>No active overlay jobs</EmptyTitle>
                          <EmptyDescription>
                            Generate or render an overlay to start the HyperFrames-like pipeline.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {studio.jobs.map((job) => (
                          <div
                            key={job.requestId}
                            className="rounded-2xl border border-border/70 bg-card/60 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-medium">{job.requestId.slice(0, 8)}</div>
                                <div className="text-sm text-muted-foreground">{job.stage}</div>
                              </div>
                              <Badge variant={job.stage === 'failed' ? 'destructive' : job.stage === 'complete' ? 'default' : 'secondary'}>
                                {job.percentage || (job.indeterminate ? 'Running' : 'Queued')}
                              </Badge>
                            </div>
                            <div className="mt-3">
                              <Progress value={job.percentage ? Number.parseFloat(job.percentage) : undefined} />
                            </div>
                            {job.detail || job.message ? (
                              <div className="mt-3 text-sm text-muted-foreground">
                                {job.detail || job.message}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="min-h-0">
                  <CardHeader>
                    <CardTitle>Artifacts</CardTitle>
                    <CardDescription>Each overlay stores HTML, manifest, preview PNG, render output, and the project-level design system.</CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-0">
                    {studio.artifacts.length === 0 ? (
                      <Empty>
                          <EmptyHeader>
                            <EmptyTitle>No overlay artifacts yet</EmptyTitle>
                            <EmptyDescription>
                              The first successful generation will create
                              {' '}
                              <code>.yt2premiere/hyperframes/&lt;job-id&gt;/</code>
                              .
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                    ) : (
                      <ScrollArea className="h-[340px] pr-4">
                        <div className="flex flex-col gap-3">
                          {studio.artifacts.map((artifact) => (
                            <button
                              key={artifact.jobId}
                              type="button"
                              className={`rounded-2xl border p-4 text-left transition ${
                                (studio.selectedArtifactId || studio.selectedSummary?.jobId) === artifact.jobId
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border/70 bg-card/60 hover:border-primary/40'
                              }`}
                              onClick={() => studio.setSelectedArtifactId(artifact.jobId)}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium">{artifact.title}</div>
                                <Badge variant={artifact.renderPath ? 'default' : 'outline'}>
                                  {artifact.renderPath ? 'Rendered' : 'HTML ready'}
                                </Badge>
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {artifact.prompt}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>{artifact.width}x{artifact.height}</span>
                                <span>{artifact.fps.toFixed(2)} fps</span>
                                <span>{artifact.durationSeconds.toFixed(2)}s</span>
                                <span>{artifact.sequenceName || 'No sequence label'}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {activeJob ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Selected job</CardTitle>
                    <CardDescription>
                      Latest stage, file outputs, and the currently selected overlay artifact.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{activeJob.requestId}</Badge>
                      <Badge variant="secondary">{activeJob.stage}</Badge>
                      {activeJob.path ? <Badge>{activeJob.path.split(/[\\/]/).pop()}</Badge> : null}
                    </div>
                    {activeJob.detail ? <div className="text-muted-foreground">{activeJob.detail}</div> : null}
                    {studio.selectedSummary?.htmlPath ? (
                      <div className="text-muted-foreground">HTML: {studio.selectedSummary.htmlPath}</div>
                    ) : null}
                    {studio.selectedSummary?.renderPath ? (
                      <div className="text-muted-foreground">Render: {studio.selectedSummary.renderPath}</div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
