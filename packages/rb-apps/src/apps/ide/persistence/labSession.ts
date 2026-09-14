import { getBrowserSessionStorage, runtimePersistence, runtimeSessionStorage } from '../durableProjectStorage';

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
}

export function saveLabSessionMeta(meta: LabSessionMeta): void {
  try {
    runtimeSessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
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

/** Session metadata can lag an interrupted runtime commit. A real hydrated
 * runtime, including an intentionally closed home, is the working-state authority.
 * Metadata-only legacy sessions still reopen their saved project. */
export function shouldKeepHydratedRuntime(meta: LabSessionMeta | null, runtimeProjectId: string, hadStoredRuntime: boolean): boolean {
  return hadStoredRuntime && (!meta || meta.projectId !== runtimeProjectId);
}
