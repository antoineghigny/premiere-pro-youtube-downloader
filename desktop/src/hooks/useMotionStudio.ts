import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import {
  getHyperframesArtifact,
  getHyperframesCatalog,
  getHyperframesContext,
  getHyperframesDesign,
  importOverlay,
  listHyperframesArtifacts,
  listHyperframesJobs,
  renderOverlay,
  saveHyperframesDesign,
  generateOverlay,
} from '../api/client';
import type {
  ActiveDownloadState,
  HyperframesArtifact,
  HyperframesArtifactDetail,
  HyperframesCatalogItem,
  HyperframesContext,
  SocketEvent,
} from '../api/types';
import { useSocket } from './useSocket';

function upsertJob(
  jobs: ActiveDownloadState[],
  next: ActiveDownloadState
): ActiveDownloadState[] {
  const existingIndex = jobs.findIndex((job) => job.requestId === next.requestId);
  if (existingIndex === -1) {
    return [next, ...jobs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  const updated = [...jobs];
  updated[existingIndex] = next;
  return updated.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function useMotionStudio() {
  const [context, setContext] = useState<HyperframesContext | null>(null);
  const [catalog, setCatalog] = useState<HyperframesCatalogItem[]>([]);
  const [artifacts, setArtifacts] = useState<HyperframesArtifact[]>([]);
  const [jobs, setJobs] = useState<ActiveDownloadState[]>([]);
  const [designPath, setDesignPath] = useState('');
  const [designDraft, setDesignDraft] = useState('');
  const [designDirty, setDesignDirty] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>('');
  const [selectedArtifact, setSelectedArtifact] = useState<HyperframesArtifactDetail | null>(null);
  const [manualIn, setManualIn] = useState('');
  const [manualOut, setManualOut] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState<
    null | 'generate' | 'render' | 'import' | 'saveDesign'
  >(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const designLoadedRef = useRef(false);

  const refreshWorkspace = useEffectEvent(async () => {
    const [nextContext, nextCatalog, nextArtifacts, nextJobs] = await Promise.all([
      getHyperframesContext(),
      catalog.length > 0 ? Promise.resolve(catalog) : getHyperframesCatalog(),
      listHyperframesArtifacts(),
      listHyperframesJobs(),
    ]);

    setContext(nextContext);
    setCatalog(nextCatalog);
    setArtifacts(nextArtifacts);
    setJobs(nextJobs.items);

    for (const job of nextJobs.items) {
      if (!subscriptionsRef.current.has(job.requestId)) {
        subscriptionsRef.current.add(job.requestId);
      }
    }

    if (!selectedArtifactId && nextArtifacts.length > 0) {
      setSelectedArtifactId(nextArtifacts[0].jobId);
    }

    if (!designLoadedRef.current || (!designDirty && nextContext.designExists && nextContext.designPath !== designPath)) {
      try {
        const design = await getHyperframesDesign();
        setDesignPath(design.path);
        setDesignDraft(design.content);
        setDesignDirty(false);
        designLoadedRef.current = true;
      } catch {
        // Context can still be useful without the design doc.
      }
    }

    if (
      !context?.sequence?.rangeSource &&
      !manualIn &&
      !manualOut &&
      nextContext.sequence?.playerPositionSeconds !== undefined
    ) {
      const start = nextContext.sequence.playerPositionSeconds;
      setManualIn(start.toFixed(2));
      setManualOut((start + 4).toFixed(2));
    }
  });

  const loadArtifactDetail = useEffectEvent(async (jobId: string) => {
    if (!jobId) {
      setSelectedArtifact(null);
      return;
    }

    try {
      const detail = await getHyperframesArtifact(jobId);
      setSelectedArtifact(detail);
    } catch (artifactError) {
      setSelectedArtifact(null);
      console.error('[YT2PP] Could not load overlay artifact:', artifactError);
    }
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await refreshWorkspace();
        if (!cancelled) {
          setError('');
        }
      } catch (workspaceError) {
        if (!cancelled) {
          setError(workspaceError instanceof Error ? workspaceError.message : 'Could not load Motion Studio');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    const intervalId = window.setInterval(() => {
      void refreshWorkspace().catch((workspaceError) => {
        console.error('[YT2PP] Could not refresh Motion Studio:', workspaceError);
      });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!selectedArtifactId) {
      setSelectedArtifact(null);
      return;
    }
    void loadArtifactDetail(selectedArtifactId);
  }, [loadArtifactDetail, selectedArtifactId]);

  const handleSocketMessage = useEffectEvent((message: SocketEvent) => {
    if (message.jobKind !== 'hyperframes') {
      return;
    }

    const nextJob: ActiveDownloadState =
      message.type === 'progress'
        ? {
            requestId: message.requestId,
            jobKind: message.jobKind,
            stage: message.stage,
            percentage: message.percentage,
            speed: message.speed,
            eta: message.eta,
            detail: message.detail,
            indeterminate: message.indeterminate,
            path: undefined,
            message: undefined,
            updatedAt: new Date().toISOString(),
          }
        : message.type === 'complete'
          ? {
              requestId: message.requestId,
              jobKind: message.jobKind,
              stage: 'complete',
              percentage: message.percentage,
              speed: undefined,
              eta: undefined,
              detail: undefined,
              indeterminate: false,
              path: message.path,
              message: undefined,
              updatedAt: new Date().toISOString(),
            }
          : {
              requestId: message.requestId,
              jobKind: message.jobKind,
              stage: 'failed',
              percentage: undefined,
              speed: undefined,
              eta: undefined,
              detail: undefined,
              indeterminate: true,
              path: undefined,
              message: message.message,
              updatedAt: new Date().toISOString(),
            };

    setJobs((current) => upsertJob(current, nextJob));
    if (message.type !== 'progress') {
      void refreshWorkspace();
      if (message.requestId === selectedArtifactId) {
        void loadArtifactDetail(message.requestId);
      }
    }
  });

  const socketClient = useSocket(handleSocketMessage);

  useEffect(() => {
    for (const job of jobs) {
      if (!subscriptionsRef.current.has(job.requestId)) {
        subscriptionsRef.current.add(job.requestId);
      }
      socketClient.subscribe(job.requestId);
    }
  }, [jobs, socketClient]);

  const selectedSummary = useMemo(
    () => artifacts.find((artifact) => artifact.jobId === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId]
  );

  const generateCurrentPrompt = async () => {
    setBusyAction('generate');
    setActionError('');

    try {
      const manualInSeconds = manualIn.trim() ? Number.parseFloat(manualIn.trim()) : undefined;
      const manualOutSeconds = manualOut.trim() ? Number.parseFloat(manualOut.trim()) : undefined;
      const response = await generateOverlay({
        prompt: prompt.trim(),
        templateId: selectedTemplateId || undefined,
        manualInSeconds,
        manualOutSeconds,
      });
      if (response.jobId) {
        socketClient.subscribe(response.jobId);
        subscriptionsRef.current.add(response.jobId);
        setSelectedArtifactId(response.jobId);
      }
      await refreshWorkspace();
    } catch (overlayError) {
      setActionError(overlayError instanceof Error ? overlayError.message : 'Could not generate the overlay');
    } finally {
      setBusyAction(null);
    }
  };

  const renderArtifact = async (jobId: string) => {
    setBusyAction('render');
    setActionError('');

    try {
      const response = await renderOverlay(jobId);
      if (response.jobId) {
        socketClient.subscribe(response.jobId);
        subscriptionsRef.current.add(response.jobId);
      }
    } catch (renderError) {
      setActionError(renderError instanceof Error ? renderError.message : 'Could not render the overlay');
    } finally {
      setBusyAction(null);
    }
  };

  const importArtifact = async (jobId: string) => {
    setBusyAction('import');
    setActionError('');

    try {
      await importOverlay(jobId);
    } catch (importError) {
      setActionError(importError instanceof Error ? importError.message : 'Could not import the overlay');
    } finally {
      setBusyAction(null);
    }
  };

  const saveDesign = async () => {
    setBusyAction('saveDesign');
    setActionError('');

    try {
      const saved = await saveHyperframesDesign(designDraft);
      setDesignPath(saved.path);
      setDesignDirty(false);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Could not save DESIGN.md');
    } finally {
      setBusyAction(null);
    }
  };

  return {
    loading,
    error,
    actionError,
    busyAction,
    context,
    catalog,
    artifacts,
    jobs,
    designPath,
    designDraft,
    designDirty,
    prompt,
    selectedTemplateId,
    selectedArtifactId: selectedArtifactId || selectedSummary?.jobId || '',
    selectedArtifact,
    selectedSummary,
    manualIn,
    manualOut,
    setPrompt,
    setSelectedTemplateId,
    setSelectedArtifactId,
    setManualIn,
    setManualOut,
    setDesignDraft: (nextValue: string) => {
      setDesignDraft(nextValue);
      setDesignDirty(true);
    },
    refreshWorkspace,
    generateCurrentPrompt,
    renderArtifact,
    importArtifact,
    saveDesign,
  };
}
