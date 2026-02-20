import { decodeRBProject, encodeRBProject, type RBProject } from '../../export/projectFormat';
import { compareCodepoint } from '../../export/codepointSort';

const STORAGE_VERSION = 1 as const;
const PROJECT_INDEX_KEY = `rb.ide.projects.v${STORAGE_VERSION}.index`;
const PROJECT_KEY_PREFIX = `rb.ide.project.v${STORAGE_VERSION}:`;

export interface PersistedIdeProjectSnapshot {
  version: typeof STORAGE_VERSION;
  projectId: string;
  projectName: string;
  savedAtIso: string;
  projectHash: string;
  rbprojJson: string;
}

export interface PersistedIdeProjectIndexEntry {
  projectId: string;
  projectName: string;
  savedAtIso: string;
  projectHash: string;
}

export function buildProjectStorageKey(projectId: string): string {
  return `${PROJECT_KEY_PREFIX}${projectId.trim()}`;
}

export function saveIdeProjectSnapshot(input: {
  projectId: string;
  projectName: string;
  projectHash: string;
  project: RBProject;
  savedAtIso?: string;
}): PersistedIdeProjectSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  const projectId = input.projectId.trim();
  if (projectId.length === 0) return null;

  const snapshot: PersistedIdeProjectSnapshot = {
    version: STORAGE_VERSION,
    projectId,
    projectName: input.projectName.trim() || 'Untitled Project',
    savedAtIso: input.savedAtIso ?? new Date().toISOString(),
    projectHash: input.projectHash,
    rbprojJson: encodeRBProject(input.project),
  };

  try {
    localStorage.setItem(buildProjectStorageKey(projectId), JSON.stringify(snapshot));
    upsertProjectIndex({
      projectId: snapshot.projectId,
      projectName: snapshot.projectName,
      savedAtIso: snapshot.savedAtIso,
      projectHash: snapshot.projectHash,
    });
    return snapshot;
  } catch {
    return null;
  }
}

export function loadIdeProjectSnapshot(projectId: string): PersistedIdeProjectSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  const trimmed = projectId.trim();
  if (trimmed.length === 0) return null;
  try {
    const raw = localStorage.getItem(buildProjectStorageKey(trimmed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedIdeProjectSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (typeof parsed.projectId !== 'string' || parsed.projectId.trim().length === 0) return null;
    if (typeof parsed.projectName !== 'string' || parsed.projectName.trim().length === 0) return null;
    if (typeof parsed.savedAtIso !== 'string' || parsed.savedAtIso.trim().length === 0) return null;
    if (typeof parsed.projectHash !== 'string' || parsed.projectHash.trim().length === 0) return null;
    if (typeof parsed.rbprojJson !== 'string' || parsed.rbprojJson.trim().length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function decodePersistedIdeProject(
  snapshot: PersistedIdeProjectSnapshot
): RBProject | null {
  try {
    return decodeRBProject(snapshot.rbprojJson);
  } catch {
    return null;
  }
}

export function listIdeProjectSnapshots(): PersistedIdeProjectIndexEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const entries = readProjectIndex();
  const validEntries: PersistedIdeProjectIndexEntry[] = [];

  for (const entry of entries) {
    const snapshot = loadIdeProjectSnapshot(entry.projectId);
    if (!snapshot) continue;
    validEntries.push({
      projectId: snapshot.projectId,
      projectName: snapshot.projectName,
      savedAtIso: snapshot.savedAtIso,
      projectHash: snapshot.projectHash,
    });
  }

  return validEntries.sort((left, right) => {
    const timeDelta =
      new Date(right.savedAtIso).getTime() - new Date(left.savedAtIso).getTime();
    if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
    return compareCodepoint(left.projectId, right.projectId);
  });
}

function readProjectIndex(): PersistedIdeProjectIndexEntry[] {
  try {
    const raw = localStorage.getItem(PROJECT_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeProjectIndexEntry(entry))
      .filter((entry): entry is PersistedIdeProjectIndexEntry => entry !== null);
  } catch {
    return [];
  }
}

function upsertProjectIndex(entry: PersistedIdeProjectIndexEntry): void {
  const existing = readProjectIndex().filter((row) => row.projectId !== entry.projectId);
  const next = [entry, ...existing]
    .sort((left, right) => {
      const timeDelta =
        new Date(right.savedAtIso).getTime() - new Date(left.savedAtIso).getTime();
      if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
      return compareCodepoint(left.projectId, right.projectId);
    })
    .slice(0, 40);

  try {
    localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
}

function normalizeProjectIndexEntry(value: unknown): PersistedIdeProjectIndexEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PersistedIdeProjectIndexEntry>;
  if (typeof candidate.projectId !== 'string' || candidate.projectId.trim().length === 0) {
    return null;
  }
  if (typeof candidate.projectName !== 'string' || candidate.projectName.trim().length === 0) {
    return null;
  }
  if (typeof candidate.savedAtIso !== 'string' || candidate.savedAtIso.trim().length === 0) {
    return null;
  }
  if (typeof candidate.projectHash !== 'string' || candidate.projectHash.trim().length === 0) {
    return null;
  }
  return {
    projectId: candidate.projectId.trim(),
    projectName: candidate.projectName.trim(),
    savedAtIso: candidate.savedAtIso.trim(),
    projectHash: candidate.projectHash.trim(),
  };
}
