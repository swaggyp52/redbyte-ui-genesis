const SESSION_META_KEY = 'rb.ide.sessionMeta.v1' as const;

export interface LabSessionMeta {
  version: 1;
  savedAt: number; // Date.now()
  projectId: string;
  currentMode: string;
  activeExampleId: string | null;
  probedKeys: string[];
}

export function saveLabSessionMeta(meta: LabSessionMeta): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage failures silently
  }
}

export function loadLabSessionMeta(): LabSessionMeta | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_META_KEY);
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
      probedKeys: parsed.probedKeys.filter((k): k is string => typeof k === 'string'),
    };
  } catch {
    return null;
  }
}

export function clearLabSessionMeta(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SESSION_META_KEY);
  } catch {
    // Ignore
  }
}
