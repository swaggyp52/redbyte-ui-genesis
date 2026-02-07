// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Unified recovery surface coordinator (autosave > workspace > none)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { decideRecoveryMode, type RecoveryContext, type RecoveryMode } from './recoveryDecision';
import { type UseRbprojAutosaveResult } from './rbprojAutosave';
import { loadSnapshot, wasLastShutdownClean, hasFatalMarkers } from './snapshotSystem';

export interface UnifiedRecoverySurfaceResult {
  mode: RecoveryMode;
  
  // Autosave data (when mode='autosave')
  autosaveMeta?: {
    savedAtMs: number;
    projectId?: string;
  };
  
  // Workspace data (when mode='workspace')
  workspaceMeta?: {
    timestamp: number;
    reason: string;
  };
  
  // Actions
  restoreAutosave: () => void;
  discardAutosave: () => void;
  restoreWorkspace: () => void;
  dismissWorkspace: () => void;
}

export interface UseUnifiedRecoverySurfaceOptions {
  rbprojAutosave: UseRbprojAutosaveResult;
  projectId?: string;
  onRestoreWorkspace?: () => void;
  onDismissWorkspace?: () => void;
}

/**
 * Unified recovery coordinator: manages priority between autosave and workspace crash recovery.
 * 
 * Priority order (hard rule):
 * 1. RBProject autosave restore (data loss risk)
 * 2. Workspace crash banner (layout convenience)
 * 3. Nothing
 * 
 * Ensures mutual exclusion: only one recovery surface shows at a time.
 */
export function useUnifiedRecoverySurface({
  rbprojAutosave,
  projectId,
  onRestoreWorkspace,
  onDismissWorkspace,
}: UseUnifiedRecoverySurfaceOptions): UnifiedRecoverySurfaceResult {
  const [autosaveRestored, setAutosaveRestored] = useState(false);
  const [autosaveDiscarded, setAutosaveDiscarded] = useState(false);
  const [workspaceDismissed, setWorkspaceDismissed] = useState(false);

  const hasWorkspaceCrash = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !wasLastShutdownClean() || hasFatalMarkers() || Boolean(loadSnapshot());
  }, []);

  const ctx: RecoveryContext = useMemo(() => ({
    hasAutosaveRestore: rbprojAutosave.restorePrompt.isOpen,
    hasWorkspaceCrash: hasWorkspaceCrash && !workspaceDismissed,
    autosaveDiscarded,
    autosaveRestored,
  }), [rbprojAutosave.restorePrompt.isOpen, hasWorkspaceCrash, autosaveDiscarded, autosaveRestored, workspaceDismissed]);

  const mode = useMemo(() => decideRecoveryMode(ctx), [ctx]);

  const restoreAutosave = useCallback(() => {
    rbprojAutosave.restore();
    setAutosaveRestored(true);
    setAutosaveDiscarded(false);
  }, [rbprojAutosave]);

  const discardAutosave = useCallback(() => {
    rbprojAutosave.discard();
    setAutosaveDiscarded(true);
    setAutosaveRestored(false);
  }, [rbprojAutosave]);

  const restoreWorkspace = useCallback(() => {
    onRestoreWorkspace?.();
    setWorkspaceDismissed(true);
  }, [onRestoreWorkspace]);

  const dismissWorkspace = useCallback(() => {
    onDismissWorkspace?.();
    setWorkspaceDismissed(true);
  }, [onDismissWorkspace]);

  const autosaveMeta = useMemo(() => {
    if (mode !== 'autosave') return undefined;
    return {
      savedAtMs: rbprojAutosave.restorePrompt.savedAtMs ?? Date.now(),
      projectId,
    };
  }, [mode, rbprojAutosave.restorePrompt.savedAtMs, projectId]);

  const workspaceMeta = useMemo(() => {
    if (mode !== 'workspace') return undefined;
    const snapshot = loadSnapshot();
    return {
      timestamp: snapshot?.timestamp ?? Date.now(),
      reason: snapshot?.reason ?? 'abnormal-shutdown',
    };
  }, [mode]);

  return {
    mode,
    autosaveMeta,
    workspaceMeta,
    restoreAutosave,
    discardAutosave,
    restoreWorkspace,
    dismissWorkspace,
  };
}
