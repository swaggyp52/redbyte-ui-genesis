import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import { stableStringify } from '../export/stableStringify';
import { fnv1a32 } from './fnv1a32';

const RBPROJ_AUTOSAVE_VERSION = 1 as const;
const PROJECT_AUTOSAVE_META_VERSION = 1 as const;
const PROJECT_AUTOSAVE_DIRTY_VERSION = 1 as const;
const RECENT_PROJECTS_VERSION = 1 as const;
const RECENT_PROJECTS_KEY = 'rb:recent:v1';
const RECENT_PROJECTS_MAX = 20;
const PROJECT_AUTOSAVE_DIRTY_PREFIX = 'rb:autosave:dirty:v1:';

type RecentProjectAppHint = 'logic-playground' | 'ece-lab';

export interface RBProjectAutosaveRecordV1 {
  version: typeof RBPROJ_AUTOSAVE_VERSION;
  savedAtMs: number;
  contentHash: string;
  projectJson: string; // encoded via encodeRBProject (canonical)
}

export interface ProjectAutosaveMetaV1 {
  version: typeof PROJECT_AUTOSAVE_META_VERSION;
  codec: 'rbproj';
  projectId: string;
  savedAtMs: number;
  contentHash: string;
  appSurface?: string;
}

export interface ProjectAutosaveDirtyStateV1 {
  version: typeof PROJECT_AUTOSAVE_DIRTY_VERSION;
  dirty: boolean;
  lastSavedHash?: string;
  savedAtMs?: number;
}

export interface RecentProjectEntryV1 {
  version: typeof RECENT_PROJECTS_VERSION;
  projectId: string;
  name: string;
  appHint?: RecentProjectAppHint;
  hasUnsaved: boolean;
  lastOpenedAt: number;
  autosaveSavedAtMs?: number;
  lastSavedHash?: string;
  lastSubmissionBundleId?: string;
  lastSubmissionAtMs?: number;
}

export function getRbprojAutosaveKey(appId: string, windowId?: string): string {
  const scope = windowId && String(windowId).trim().length > 0 ? windowId : 'global';
  return `rb:rbproj_autosave:v${RBPROJ_AUTOSAVE_VERSION}:${appId}:${scope}`;
}

export function getCanonicalProjectAutosaveKey(projectId: string): string {
  return `rb:autosave:${String(projectId).trim()}`;
}

export function getCanonicalProjectAutosaveMetaKey(projectId: string): string {
  return `rb:autosave-meta:${String(projectId).trim()}`;
}

export function getCanonicalProjectAutosaveDirtyKey(projectId: string): string {
  return `${PROJECT_AUTOSAVE_DIRTY_PREFIX}${String(projectId).trim()}`;
}

export function tryParseCanonicalProjectAutosaveKey(
  key: string,
): { projectId: string } | null {
  const prefix = 'rb:autosave:';
  if (!key.startsWith(prefix)) return null;
  const projectId = key.slice(prefix.length).trim();
  if (!projectId) return null;
  return { projectId };
}

function normalizeRecentProjectAppHint(value: unknown): RecentProjectAppHint | undefined {
  if (value === 'logic-playground' || value === 'ece-lab') return value;
  return undefined;
}

function normalizeRecentProjectEntry(value: unknown): RecentProjectEntryV1 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RecentProjectEntryV1>;
  if (candidate.version !== RECENT_PROJECTS_VERSION) return null;
  if (typeof candidate.projectId !== 'string' || candidate.projectId.trim().length === 0) return null;
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) return null;
  if (typeof candidate.lastOpenedAt !== 'number') return null;
  if (typeof candidate.hasUnsaved !== 'boolean') return null;
  if (candidate.autosaveSavedAtMs !== undefined && typeof candidate.autosaveSavedAtMs !== 'number') return null;
  if (candidate.lastSavedHash !== undefined && typeof candidate.lastSavedHash !== 'string') return null;
  if (
    candidate.lastSubmissionBundleId !== undefined &&
    typeof candidate.lastSubmissionBundleId !== 'string'
  ) {
    return null;
  }
  if (candidate.lastSubmissionAtMs !== undefined && typeof candidate.lastSubmissionAtMs !== 'number') return null;
  return {
    version: RECENT_PROJECTS_VERSION,
    projectId: candidate.projectId.trim(),
    name: candidate.name.trim(),
    hasUnsaved: candidate.hasUnsaved,
    lastOpenedAt: candidate.lastOpenedAt,
    ...(normalizeRecentProjectAppHint(candidate.appHint) ? { appHint: normalizeRecentProjectAppHint(candidate.appHint) } : {}),
    ...(typeof candidate.autosaveSavedAtMs === 'number' ? { autosaveSavedAtMs: candidate.autosaveSavedAtMs } : {}),
    ...(typeof candidate.lastSavedHash === 'string' && candidate.lastSavedHash.length > 0
      ? { lastSavedHash: candidate.lastSavedHash }
      : {}),
    ...(typeof candidate.lastSubmissionBundleId === 'string' && candidate.lastSubmissionBundleId.trim().length > 0
      ? { lastSubmissionBundleId: candidate.lastSubmissionBundleId.trim() }
      : {}),
    ...(typeof candidate.lastSubmissionAtMs === 'number' ? { lastSubmissionAtMs: candidate.lastSubmissionAtMs } : {}),
  };
}

function sortRecentProjects(entries: RecentProjectEntryV1[]): RecentProjectEntryV1[] {
  return [...entries].sort((left, right) => {
    if (left.lastOpenedAt !== right.lastOpenedAt) return right.lastOpenedAt - left.lastOpenedAt;
    return left.projectId.localeCompare(right.projectId);
  });
}

export function loadProjectAutosaveDirtyState(projectId: string): ProjectAutosaveDirtyStateV1 | null {
  if (typeof localStorage === 'undefined') return null;
  const trimmedProjectId = String(projectId).trim();
  if (trimmedProjectId.length === 0) return null;
  try {
    const raw = localStorage.getItem(getCanonicalProjectAutosaveDirtyKey(trimmedProjectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectAutosaveDirtyStateV1;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== PROJECT_AUTOSAVE_DIRTY_VERSION) return null;
    if (typeof parsed.dirty !== 'boolean') return null;
    if (parsed.lastSavedHash !== undefined && typeof parsed.lastSavedHash !== 'string') return null;
    if (parsed.savedAtMs !== undefined && typeof parsed.savedAtMs !== 'number') return null;
    return {
      version: PROJECT_AUTOSAVE_DIRTY_VERSION,
      dirty: parsed.dirty,
      ...(typeof parsed.lastSavedHash === 'string' ? { lastSavedHash: parsed.lastSavedHash } : {}),
      ...(typeof parsed.savedAtMs === 'number' ? { savedAtMs: parsed.savedAtMs } : {}),
    };
  } catch {
    return null;
  }
}

export function saveProjectAutosaveDirtyState(projectId: string, state: ProjectAutosaveDirtyStateV1): void {
  if (typeof localStorage === 'undefined') return;
  const trimmedProjectId = String(projectId).trim();
  if (trimmedProjectId.length === 0) return;
  try {
    localStorage.setItem(
      getCanonicalProjectAutosaveDirtyKey(trimmedProjectId),
      JSON.stringify({
        version: PROJECT_AUTOSAVE_DIRTY_VERSION,
        dirty: state.dirty,
        ...(typeof state.lastSavedHash === 'string' && state.lastSavedHash.length > 0
          ? { lastSavedHash: state.lastSavedHash }
          : {}),
        ...(typeof state.savedAtMs === 'number' ? { savedAtMs: state.savedAtMs } : {}),
      } satisfies ProjectAutosaveDirtyStateV1),
    );
  } catch {
    // ignore
  }
}

export function clearProjectAutosaveDirtyState(projectId: string): void {
  if (typeof localStorage === 'undefined') return;
  const trimmedProjectId = String(projectId).trim();
  if (trimmedProjectId.length === 0) return;
  try {
    localStorage.removeItem(getCanonicalProjectAutosaveDirtyKey(trimmedProjectId));
  } catch {
    // ignore
  }
}

export function loadRecentProjects(): RecentProjectEntryV1[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((entry) => normalizeRecentProjectEntry(entry))
      .filter((entry): entry is RecentProjectEntryV1 => entry !== null)
      .map((entry) => {
        const dirtyState = loadProjectAutosaveDirtyState(entry.projectId);
        if (!dirtyState) return entry;
        return {
          ...entry,
          hasUnsaved: dirtyState.dirty,
          ...(typeof dirtyState.savedAtMs === 'number' ? { autosaveSavedAtMs: dirtyState.savedAtMs } : {}),
          ...(typeof dirtyState.lastSavedHash === 'string' && dirtyState.lastSavedHash.length > 0
            ? { lastSavedHash: dirtyState.lastSavedHash }
            : {}),
        };
      });
    return sortRecentProjects(normalized).slice(0, RECENT_PROJECTS_MAX);
  } catch {
    return [];
  }
}

function saveRecentProjects(entries: RecentProjectEntryV1[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      RECENT_PROJECTS_KEY,
      JSON.stringify(sortRecentProjects(entries).slice(0, RECENT_PROJECTS_MAX)),
    );
  } catch {
    // ignore
  }
}

export function upsertRecentProject(entry: Omit<RecentProjectEntryV1, 'version'>): void {
  const projectId = String(entry.projectId).trim();
  if (projectId.length === 0) return;
  const name = String(entry.name ?? '').trim();
  if (name.length === 0) return;
  const submissionBundleId =
    typeof entry.lastSubmissionBundleId === 'string' ? entry.lastSubmissionBundleId.trim() : '';
  const normalizedEntry: RecentProjectEntryV1 = {
    version: RECENT_PROJECTS_VERSION,
    projectId,
    name,
    hasUnsaved: Boolean(entry.hasUnsaved),
    lastOpenedAt: Number.isFinite(entry.lastOpenedAt) ? entry.lastOpenedAt : Date.now(),
    ...(normalizeRecentProjectAppHint(entry.appHint) ? { appHint: normalizeRecentProjectAppHint(entry.appHint) } : {}),
    ...(typeof entry.autosaveSavedAtMs === 'number' ? { autosaveSavedAtMs: entry.autosaveSavedAtMs } : {}),
    ...(typeof entry.lastSavedHash === 'string' && entry.lastSavedHash.length > 0
      ? { lastSavedHash: entry.lastSavedHash }
      : {}),
    ...(submissionBundleId.length > 0 ? { lastSubmissionBundleId: submissionBundleId } : {}),
    ...(typeof entry.lastSubmissionAtMs === 'number' ? { lastSubmissionAtMs: entry.lastSubmissionAtMs } : {}),
  };
  const existing = loadRecentProjects().filter((candidate) => candidate.projectId !== projectId);
  saveRecentProjects([...existing, normalizedEntry]);
}

export function removeRecentProject(projectId: string): void {
  const trimmedProjectId = String(projectId).trim();
  if (trimmedProjectId.length === 0) return;
  const filtered = loadRecentProjects().filter((entry) => entry.projectId !== trimmedProjectId);
  saveRecentProjects(filtered);
}

export function clearProjectAutosaveByProjectId(projectId: string): void {
  const trimmedProjectId = String(projectId).trim();
  if (trimmedProjectId.length === 0) return;
  clearRbprojAutosave(getCanonicalProjectAutosaveKey(trimmedProjectId));
  clearProjectAutosaveMeta(getCanonicalProjectAutosaveMetaKey(trimmedProjectId));
  clearProjectAutosaveDirtyState(trimmedProjectId);
  removeRecentProject(trimmedProjectId);
}

export function markProjectSubmissionCheckpoint(
  project: RBProject,
  input: { bundleId: string; submittedAtMs?: number },
): void {
  const projectId = String(project.meta?.projectId ?? '').trim();
  const bundleId = String(input.bundleId ?? '').trim();
  if (projectId.length === 0 || bundleId.length === 0) return;

  const submittedAtMs = Number.isFinite(input.submittedAtMs) ? Number(input.submittedAtMs) : Date.now();
  const autosaveRecord = loadRbprojAutosave(getCanonicalProjectAutosaveKey(projectId));
  const dirtyState = loadProjectAutosaveDirtyState(projectId);
  const lastSavedHash = autosaveRecord?.contentHash ?? dirtyState?.lastSavedHash;
  const autosaveSavedAtMs = autosaveRecord?.savedAtMs ?? dirtyState?.savedAtMs;

  saveProjectAutosaveDirtyState(projectId, {
    version: PROJECT_AUTOSAVE_DIRTY_VERSION,
    dirty: false,
    ...(typeof lastSavedHash === 'string' && lastSavedHash.length > 0 ? { lastSavedHash } : {}),
    ...(typeof autosaveSavedAtMs === 'number' ? { savedAtMs: autosaveSavedAtMs } : {}),
  });

  upsertRecentProject({
    projectId,
    name: normalizeRecentProjectName(project),
    appHint: resolveRecentAppHint(project),
    hasUnsaved: false,
    lastOpenedAt: submittedAtMs,
    ...(typeof autosaveSavedAtMs === 'number' ? { autosaveSavedAtMs } : {}),
    ...(typeof lastSavedHash === 'string' && lastSavedHash.length > 0 ? { lastSavedHash } : {}),
    lastSubmissionBundleId: bundleId,
    lastSubmissionAtMs: submittedAtMs,
  });
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

export function loadProjectAutosaveMeta(key: string): ProjectAutosaveMetaV1 | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectAutosaveMetaV1;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== PROJECT_AUTOSAVE_META_VERSION) return null;
    if (parsed.codec !== 'rbproj') return null;
    if (typeof parsed.projectId !== 'string' || parsed.projectId.length === 0) return null;
    if (typeof parsed.savedAtMs !== 'number') return null;
    if (typeof parsed.contentHash !== 'string') return null;
    if (parsed.appSurface !== undefined && typeof parsed.appSurface !== 'string') return null;
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

export function saveProjectAutosaveMeta(key: string, meta: ProjectAutosaveMetaV1): void {
  try {
    localStorage.setItem(key, JSON.stringify(meta));
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

export function clearProjectAutosaveMeta(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function migrateRbprojAutosaveIfNeeded(fromKey: string, toKey: string): boolean {
  if (fromKey === toKey) return false;
  const existing = loadRbprojAutosave(toKey);
  if (existing) return false;
  const legacy = loadRbprojAutosave(fromKey);
  if (!legacy) return false;
  saveRbprojAutosave(toKey, legacy);
  return true;
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

function normalizeRecentProjectName(project: RBProject): string {
  const name = String(project.name ?? '').trim();
  if (name.length > 0) return name;
  const projectId = String(project.meta?.projectId ?? '').trim();
  return projectId.length > 0 ? projectId : 'Untitled Project';
}

function resolveRecentProjectId(project: RBProject | null, autosaveKey: string): string | null {
  const fromMeta = String(project?.meta?.projectId ?? '').trim();
  if (fromMeta.length > 0 && fromMeta !== '__none__') return fromMeta;
  const parsed = tryParseCanonicalProjectAutosaveKey(autosaveKey);
  if (!parsed) return null;
  if (parsed.projectId === '__none__') return null;
  return parsed.projectId;
}

function resolveRecentAppHint(project: RBProject): RecentProjectAppHint | undefined {
  return normalizeRecentProjectAppHint(project.meta?.appSurface);
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
  const lastCleanMarkerRef = useRef<string | null>(null);
  const [saveStatusText, setSaveStatusText] = useState<string | undefined>(undefined);
  const [restoreRecord, setRestoreRecord] = useState<RBProjectAutosaveRecordV1 | null>(null);

  const trySaveNow = useCallback(() => {
    const project = getProject();
    if (!project) return;

    const record = buildRbprojAutosaveRecord(project);
    if (record.contentHash === lastSavedHashRef.current) return;

    saveRbprojAutosave(autosaveKey, record);

    const canonical = tryParseCanonicalProjectAutosaveKey(autosaveKey);
    const projectId = resolveRecentProjectId(project, autosaveKey);
    if (canonical && canonical.projectId !== '__none__') {
      saveProjectAutosaveMeta(getCanonicalProjectAutosaveMetaKey(canonical.projectId), {
        version: PROJECT_AUTOSAVE_META_VERSION,
        codec: 'rbproj',
        projectId: canonical.projectId,
        savedAtMs: record.savedAtMs,
        contentHash: record.contentHash,
        appSurface: project.meta?.appSurface,
      });
    }
    if (projectId) {
      saveProjectAutosaveDirtyState(projectId, {
        version: PROJECT_AUTOSAVE_DIRTY_VERSION,
        dirty: true,
        lastSavedHash: record.contentHash,
        savedAtMs: record.savedAtMs,
      });
      upsertRecentProject({
        projectId,
        name: normalizeRecentProjectName(project),
        appHint: resolveRecentAppHint(project),
        hasUnsaved: true,
        lastOpenedAt: record.savedAtMs,
        autosaveSavedAtMs: record.savedAtMs,
        lastSavedHash: record.contentHash,
      });
    }

    lastSavedHashRef.current = record.contentHash;
    lastCleanMarkerRef.current = null;
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

  // Keep recent-project metadata in sync when project transitions to clean state.
  useEffect(() => {
    if (isDirty) return;
    const current = getProject();
    if (!current) return;
    const projectId = resolveRecentProjectId(current, autosaveKey);
    if (!projectId) return;

    const autosaveRecord = loadRbprojAutosave(autosaveKey);
    if (!autosaveRecord) return;
    const marker = `${projectId}:${autosaveRecord.contentHash}:clean`;
    if (lastCleanMarkerRef.current === marker) return;
    lastCleanMarkerRef.current = marker;

    saveProjectAutosaveDirtyState(projectId, {
      version: PROJECT_AUTOSAVE_DIRTY_VERSION,
      dirty: false,
      lastSavedHash: autosaveRecord.contentHash,
      savedAtMs: autosaveRecord.savedAtMs,
    });
    upsertRecentProject({
      projectId,
      name: normalizeRecentProjectName(current),
      appHint: resolveRecentAppHint(current),
      hasUnsaved: false,
      lastOpenedAt: Date.now(),
      autosaveSavedAtMs: autosaveRecord.savedAtMs,
      lastSavedHash: autosaveRecord.contentHash,
    });
  }, [autosaveKey, getProject, isDirty]);

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
      const projectId = resolveRecentProjectId(project, autosaveKey);
      if (projectId) {
        saveProjectAutosaveDirtyState(projectId, {
          version: PROJECT_AUTOSAVE_DIRTY_VERSION,
          dirty: false,
          lastSavedHash: restoreRecord.contentHash,
          savedAtMs: restoreRecord.savedAtMs,
        });
        upsertRecentProject({
          projectId,
          name: normalizeRecentProjectName(project),
          appHint: resolveRecentAppHint(project),
          hasUnsaved: false,
          lastOpenedAt: Date.now(),
          autosaveSavedAtMs: restoreRecord.savedAtMs,
          lastSavedHash: restoreRecord.contentHash,
        });
      }
      setSaveStatusText(`Autosaved ${formatTimeLocal(restoreRecord.savedAtMs)}`);
      clearRbprojAutosave(autosaveKey);
      setRestoreRecord(null);
    } catch {
      // If restore fails, keep the record so user can retry/discard.
    }
  }, [applyProject, autosaveKey, restoreRecord]);

  const discard = useCallback(() => {
    const current = getProject();
    const projectId = resolveRecentProjectId(current, autosaveKey);
    if (projectId) {
      clearProjectAutosaveDirtyState(projectId);
      removeRecentProject(projectId);
    }
    clearRbprojAutosave(autosaveKey);
    setRestoreRecord(null);
  }, [autosaveKey, getProject]);

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
