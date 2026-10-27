import { getBrowserSessionStorage, runtimePersistence, runtimeSessionStorage, writeAfterRuntime } from '../durableProjectStorage';

const SESSION_META_KEY = 'rb.ide.sessionMeta.v1' as const;

export interface LabSessionMeta {
  version: 1;
  savedAt: number; // Date.now()
  projectId: string;
  currentMode: string;
  activeExampleId: string | null;
  projectKind?: 'home' | 'blank' | 'example' | 'custom' | 'import' | 'saved';
  sourceExampleId?: string | null;
  scenarioAuthority?: 'none' | 'starter' | 'draft' | 'authored' | 'verified' | 'stale';
  probedKeys: string[];
  /** RB-DEBT-023: the stored revision of the working-session record this metadata follows. Absent in
   * metadata written before it existed; such metadata opens as before, without the unfinished notice. */
  runtimeRevision?: number;
}

/** The metadata names the open project, so it lands only after the working-session record it
 * follows (RB-DEBT-023): a navigation in between reopens what the disk holds, never a project
 * whose record never landed. */
export function saveLabSessionMeta(meta: LabSessionMeta): void {
  try {
    writeAfterRuntime(SESSION_META_KEY, (runtimeRevision) => JSON.stringify({ ...meta, runtimeRevision }));
  } catch (error) { runtimePersistence.writeFailed(error, SESSION_META_KEY); }
}

export function loadLabSessionMeta(): LabSessionMeta | null {
  try {
    const backend = getBrowserSessionStorage();
    const raw = backend ? backend.snapshot().get(SESSION_META_KEY) : typeof localStorage === 'undefined' ? null : localStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LabSessionMeta>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== 1) return null;
    if (typeof parsed.projectId !== 'string' || !parsed.projectId.trim()) return null;
    if (typeof parsed.currentMode !== 'string' || !parsed.currentMode.trim()) return null;
    if (!Array.isArray(parsed.probedKeys)) return null;
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      projectId: parsed.projectId.trim(),
      currentMode: parsed.currentMode.trim(),
      activeExampleId: typeof parsed.activeExampleId === 'string' ? parsed.activeExampleId : null,
      projectKind: typeof parsed.projectKind === 'string' ? parsed.projectKind : undefined,
      sourceExampleId:
        typeof parsed.sourceExampleId === 'string' ? parsed.sourceExampleId : parsed.sourceExampleId === null ? null : undefined,
      scenarioAuthority: typeof parsed.scenarioAuthority === 'string' ? parsed.scenarioAuthority : undefined,
      probedKeys: parsed.probedKeys.filter((k): k is string => typeof k === 'string'),
      ...(typeof parsed.runtimeRevision === 'number' && Number.isInteger(parsed.runtimeRevision) && parsed.runtimeRevision >= 0
        ? { runtimeRevision: parsed.runtimeRevision } : {}),
    };
  } catch {
    return null;
  }
}

export function clearLabSessionMeta(): void {
  try {
    const pending = runtimeSessionStorage.removeItem(SESSION_META_KEY);
    if (pending) void pending.catch(error => runtimePersistence.writeFailed(error, SESSION_META_KEY));
  } catch (error) { runtimePersistence.writeFailed(error, SESSION_META_KEY); }
}

/** True when the metadata follows a working-session revision the disk never received: the last
 * change did not finish saving before the page closed (RB-DEBT-023). Older metadata has no
 * revision and is never reported. */
export function sessionMetaIsAheadOfRuntime(meta: LabSessionMeta | null, storedRuntimeRevision: number | null): boolean {
  return meta?.runtimeRevision !== undefined && storedRuntimeRevision !== null && meta.runtimeRevision > storedRuntimeRevision;
}

/** Session metadata can lag an interrupted runtime commit. A real hydrated
 * runtime, including an intentionally closed home, is the working-state authority.
 * Metadata-only legacy sessions still reopen their saved project. */
export function shouldKeepHydratedRuntime(meta: LabSessionMeta | null, runtimeProjectId: string, hadStoredRuntime: boolean): boolean {
  return hadStoredRuntime && (!meta || meta.projectId !== runtimeProjectId);
}
