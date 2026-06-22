import {
  SESSION_META_STORAGE_KEY,
  clearSessionMeta,
  loadSessionMetaRaw,
  saveSessionMetaRaw,
} from '../projectStorageFacade';

const SESSION_META_KEY = SESSION_META_STORAGE_KEY;

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
    if (typeof localStorage === 'undefined') return;
    saveSessionMetaRaw(JSON.stringify(meta));
  } catch {
    // Ignore storage failures silently
  }
}

export function loadLabSessionMeta(): LabSessionMeta | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = loadSessionMetaRaw();
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
    if (typeof localStorage === 'undefined') return;
    clearSessionMeta();
  } catch {
    // Ignore
  }
}
