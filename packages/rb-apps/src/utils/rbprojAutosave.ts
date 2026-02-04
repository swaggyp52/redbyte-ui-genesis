import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import { stableStringify } from '../export/stableStringify';
import { fnv1a32 } from './fnv1a32';

const RBPROJ_AUTOSAVE_VERSION = 1 as const;

export interface RBProjectAutosaveRecordV1 {
  version: typeof RBPROJ_AUTOSAVE_VERSION;
  savedAtMs: number;
  contentHash: string;
  projectJson: string; // encoded via encodeRBProject (canonical)
}

export function getRbprojAutosaveKey(appId: string, windowId?: string): string {
  const scope = windowId && String(windowId).trim().length > 0 ? windowId : 'global';
  return `rb:rbproj_autosave:v${RBPROJ_AUTOSAVE_VERSION}:${appId}:${scope}`;
}

export function loadRbprojAutosave(key: string): RBProjectAutosaveRecordV1 | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RBProjectAutosaveRecordV1;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== RBPROJ_AUTOSAVE_VERSION) return null;
    if (typeof parsed.projectJson !== 'string') return null;
    if (typeof parsed.contentHash !== 'string') return null;
    if (typeof parsed.savedAtMs !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRbprojAutosave(key: string, record: RBProjectAutosaveRecordV1): void {
  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // ignore storage failures (quota, disabled storage, etc.)
  }
}

export function clearRbprojAutosave(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function normalizeRbprojForContentHash(project: RBProject): unknown {
  const { meta, updatedAt: _updatedAt, ...rest } = project;
  const metaSafe = meta ? { ...meta, appVersion: undefined, gitCommit: undefined } : undefined;
  return { ...rest, meta: metaSafe };
}

export function computeRbprojContentHashFromEncoded(projectJson: string): string {
  const decoded = decodeRBProject(projectJson);
  const normalizedText = stableStringify(normalizeRbprojForContentHash(decoded)).replace(/\r\n/g, '\n');
  return fnv1a32(normalizedText);
}

export function buildRbprojAutosaveRecord(project: RBProject): RBProjectAutosaveRecordV1 {
  const projectJson = encodeRBProject(project);
  const contentHash = computeRbprojContentHashFromEncoded(projectJson);
  return {
    version: RBPROJ_AUTOSAVE_VERSION,
    savedAtMs: Date.now(),
    contentHash,
    projectJson,
  };
}

function formatTimeLocal(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export interface UseRbprojAutosaveOptions {
  autosaveKey: string;
  isDirty: boolean;
  getProject: () => RBProject | null;
  applyProject: (project: RBProject) => void;
  changeDeps?: unknown[];
  intervalMs?: number;
  debounceMs?: number;
}

export interface UseRbprojAutosaveResult {
  saveStatusText?: string;
  restorePrompt: { isOpen: boolean; savedAtMs?: number };
  restore: () => void;
  discard: () => void;
}

export function useRbprojAutosave({
  autosaveKey,
  isDirty,
  getProject,
  applyProject,
  changeDeps = [],
  intervalMs = 30_000,
  debounceMs = 1_500,
}: UseRbprojAutosaveOptions): UseRbprojAutosaveResult {
  const lastSavedHashRef = useRef<string | null>(null);
  const [saveStatusText, setSaveStatusText] = useState<string | undefined>(undefined);
  const [restoreRecord, setRestoreRecord] = useState<RBProjectAutosaveRecordV1 | null>(null);

  const trySaveNow = useCallback(() => {
    const project = getProject();
    if (!project) return;

    const record = buildRbprojAutosaveRecord(project);
    if (record.contentHash === lastSavedHashRef.current) return;

    saveRbprojAutosave(autosaveKey, record);
    lastSavedHashRef.current = record.contentHash;
    setSaveStatusText(`Autosaved ${formatTimeLocal(record.savedAtMs)}`);
  }, [autosaveKey, getProject]);

  // Restore check: run once after mount when we can build a project snapshot.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const run = () => {
      if (cancelled) return;
      attempts += 1;

      const saved = loadRbprojAutosave(autosaveKey);
      if (!saved) return;

      const current = getProject();
      if (!current) {
        // If we can't build a snapshot yet, retry a few times.
        if (attempts < 20) setTimeout(run, 100);
        return;
      }

      const currentHash = buildRbprojAutosaveRecord(current).contentHash;
      lastSavedHashRef.current = currentHash;

      if (saved.contentHash !== currentHash) {
        setRestoreRecord(saved);
        return;
      }

      setSaveStatusText(`Autosaved ${formatTimeLocal(saved.savedAtMs)}`);
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveKey]);

  // Debounced autosave on edits while dirty
  useEffect(() => {
    if (!isDirty) return;
    const t = setTimeout(() => {
      trySaveNow();
    }, debounceMs);
    return () => clearTimeout(t);
  }, [isDirty, debounceMs, trySaveNow, ...changeDeps]);

  // Interval autosave while dirty
  useEffect(() => {
    if (!isDirty) return;
    const id = setInterval(() => {
      trySaveNow();
    }, intervalMs);
    return () => clearInterval(id);
  }, [isDirty, intervalMs, trySaveNow]);

  const restore = useCallback(() => {
    if (!restoreRecord) return;
    try {
      const project = decodeRBProject(restoreRecord.projectJson);
      applyProject(project);
      lastSavedHashRef.current = restoreRecord.contentHash;
      setSaveStatusText(`Autosaved ${formatTimeLocal(restoreRecord.savedAtMs)}`);
      clearRbprojAutosave(autosaveKey);
      setRestoreRecord(null);
    } catch {
      // If restore fails, keep the record so user can retry/discard.
    }
  }, [applyProject, autosaveKey, restoreRecord]);

  const discard = useCallback(() => {
    clearRbprojAutosave(autosaveKey);
    setRestoreRecord(null);
  }, [autosaveKey]);

  const restorePrompt = useMemo(
    () => ({ isOpen: !!restoreRecord, savedAtMs: restoreRecord?.savedAtMs }),
    [restoreRecord],
  );

  return {
    saveStatusText,
    restorePrompt,
    restore,
    discard,
  };
}

