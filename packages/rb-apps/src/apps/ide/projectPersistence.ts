import { recordingStorageReplacer, recordingStorageReviver } from './recordingStorage';
import { decodeRBProject, encodeRBProject, type RBProject } from '../../export/projectFormat';
import { compareCodepoint } from '../../export/codepointSort';
import type { VerifyScenario } from './verifyScenario';
import type { ProjectRuntimeState, RuntimeVerifyRun, VerifyRunLedgerEntry } from './projectRuntime';
import type { ProjectHealthExportResult } from './projectHealth';
import type { ProviderWaveform } from './simulationProvider';
import { normalizeVcdAnalyzerConfig, type VcdAnalyzerConfig } from './vcdAnalyzer';
import { digestValue } from '../../utils/digest';

export const IDE_PROJECT_STORAGE_VERSION = 1 as const;
export const IDE_PROJECT_INDEX_KEY =
  `rb.ide.projects.v${IDE_PROJECT_STORAGE_VERSION}.index`;
export const IDE_PROJECT_KEY_PREFIX =
  `rb.ide.project.v${IDE_PROJECT_STORAGE_VERSION}:`;

/**
 * A project's own run evidence, stored beside it so reopening the project restores what
 * the student proved rather than an empty Simulate. Workspace-local like `scenarios`: the
 * portable RBProject in `rbprojJson` is untouched, and an older snapshot without this
 * field simply restores no evidence, exactly as before.
 */
export interface PersistedIdeRunEvidence {
  /** External evidence remains explicitly external after reopening the session. */
  importedWaveform?: ProviderWaveform | null;
  vcdAnalyzer?: VcdAnalyzerConfig;
  /** Exact-byte package receipts belong to this saved project, including on reopen. */
  exportHistory?: ProjectHealthExportResult[];
  /** The full last run - report rows and waveform - which is what makes a trace replayable. */
  lastRun?: RuntimeVerifyRun;
  /** Complete recordings, including earlier failed runs and other scenarios. */
  archive?: RuntimeVerifyRun[];
  /** The run ledger: summaries, the history behind the trace. */
  history?: VerifyRunLedgerEntry[];
}

/** Capture the existing runtime owner at the synchronous save boundary. The
 * repository clones this input before queuing its transaction. */
export function snapshotRuntimeEvidence(state: Pick<ProjectRuntimeState,
  'verifyLastRun' | 'verifyRunArchive' | 'verifyRunHistory' | 'exportHistory' | 'importedWaveform' | 'vcdAnalyzer'>): PersistedIdeRunEvidence {
  return { lastRun: state.verifyLastRun, archive: state.verifyRunArchive, history: state.verifyRunHistory,
    exportHistory: state.exportHistory, importedWaveform: state.importedWaveform, vcdAnalyzer: state.vcdAnalyzer };
}

/** Dirty-state token only; this does not prove execution or output equality. */
export function sessionEvidenceSaveSignature(evidence?: PersistedIdeRunEvidence): string {
  return JSON.stringify({ run: evidence?.lastRun?.runId ?? evidence?.lastRun?.deterministicHash ?? null,
    count: evidence?.history?.length ?? 0, receipts: evidence?.exportHistory ?? [],
    external: digestValue({ waveform: evidence?.importedWaveform ?? null, analyzer: normalizeVcdAnalyzerConfig(evidence?.vcdAnalyzer) }) });
}

export interface PersistedIdeProjectSnapshot {
  version: typeof IDE_PROJECT_STORAGE_VERSION;
  projectId: string;
  projectName: string;
  savedAtIso: string;
  projectHash: string;
  rbprojJson: string;
  /** Local workspace-only testbench documents; RBProject remains portable. */
  scenarios?: VerifyScenario[];
  activeScenarioId?: string;
  /** Local workspace-only run evidence for this project. */
  runEvidence?: PersistedIdeRunEvidence;
}

export interface PersistedIdeProjectIndexEntry {
  projectId: string;
  projectName: string;
  savedAtIso: string;
  projectHash: string;
}

export function buildProjectStorageKey(projectId: string): string {
  return `${IDE_PROJECT_KEY_PREFIX}${projectId.trim()}`;
}

export function saveIdeProjectSnapshot(input: {
  projectId: string;
  projectName: string;
  projectHash: string;
  project: RBProject;
  scenarios?: VerifyScenario[];
  activeScenarioId?: string;
  savedAtIso?: string;
}): PersistedIdeProjectSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  const projectId = input.projectId.trim();
  if (projectId.length === 0) return null;

  const snapshot: PersistedIdeProjectSnapshot = {
    version: IDE_PROJECT_STORAGE_VERSION,
    projectId,
    projectName: input.projectName.trim() || 'Untitled Project',
    savedAtIso: input.savedAtIso ?? new Date().toISOString(),
    projectHash: input.projectHash,
    rbprojJson: encodeRBProject(input.project),
    scenarios: input.scenarios ? structuredClone(input.scenarios) : undefined,
    activeScenarioId: input.activeScenarioId,
  };

  try {
    localStorage.setItem(buildProjectStorageKey(projectId), JSON.stringify(snapshot, recordingStorageReplacer));
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
    return parsePersistedIdeProjectSnapshot(JSON.parse(raw, recordingStorageReviver));
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
    const raw = localStorage.getItem(IDE_PROJECT_INDEX_KEY);
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
    localStorage.setItem(IDE_PROJECT_INDEX_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
}

export function parsePersistedIdeProjectSnapshot(
  value: unknown
): PersistedIdeProjectSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<PersistedIdeProjectSnapshot>;
  if (parsed.version !== IDE_PROJECT_STORAGE_VERSION) return null;
  if (typeof parsed.projectId !== 'string' || parsed.projectId.trim().length === 0) return null;
  if (typeof parsed.projectName !== 'string' || parsed.projectName.trim().length === 0) return null;
  if (typeof parsed.savedAtIso !== 'string' || parsed.savedAtIso.trim().length === 0) return null;
  if (typeof parsed.projectHash !== 'string' || parsed.projectHash.trim().length === 0) return null;
  if (typeof parsed.rbprojJson !== 'string' || parsed.rbprojJson.trim().length === 0) return null;
  if (parsed.scenarios !== undefined && !Array.isArray(parsed.scenarios)) return null;
  if (parsed.activeScenarioId !== undefined && typeof parsed.activeScenarioId !== 'string') return null;
  if (parsed.runEvidence !== undefined) {
    if (!parsed.runEvidence || typeof parsed.runEvidence !== 'object') return null;
    const evidence = parsed.runEvidence;
    if (evidence.history !== undefined && !Array.isArray(evidence.history)) return null;
    if (evidence.exportHistory !== undefined && !Array.isArray(evidence.exportHistory)) return null;
    if (evidence.importedWaveform != null && !validExternalWaveform(evidence.importedWaveform)) return null;
    if (evidence.archive !== undefined && (!Array.isArray(evidence.archive) || !evidence.archive.every(validRetainedRun))) return null;
    if (evidence.lastRun !== undefined && !validRetainedRun(evidence.lastRun)) return null;
  }
  return parsed as PersistedIdeProjectSnapshot;
}

function validRetainedRun(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<RuntimeVerifyRun>;
  return typeof run.deterministicHash === 'string' && Array.isArray(run.waveform) &&
    Boolean(run.report && Array.isArray(run.report.rows));
}

function validExternalWaveform(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const waveform = value as Partial<ProviderWaveform>;
  return waveform.provider?.kind === 'imported-vcd' && waveform.provider.evidenceTier === 'imported-external' &&
    waveform.provider.external === true && waveform.provider.executesInBrowser === false &&
    typeof waveform.endTime === 'number' && Number.isFinite(waveform.endTime) && Array.isArray(waveform.notes) &&
    Array.isArray(waveform.signals) && waveform.signals.every(signal => signal && typeof signal.key === 'string' && typeof signal.name === 'string' && typeof signal.width === 'number') &&
    Array.isArray(waveform.changes) && waveform.changes.every(change => change && typeof change.time === 'number' && typeof change.key === 'string' && typeof change.value === 'string');
}

export function normalizeProjectIndexEntry(value: unknown): PersistedIdeProjectIndexEntry | null {
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
