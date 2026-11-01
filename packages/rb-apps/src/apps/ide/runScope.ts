/**
 * Run scope — the derived read-model that says whose evidence the runtime's last
 * simulation run is, and whether it still describes this project's current
 * inputs.
 *
 * Runs are produced by `runVerification` in projectRuntime.ts and persisted
 * inside the project's own runtime envelope. Every persisted run names the
 * project that produced it; loaders use `scopeRunEvidenceToProject` so a run
 * owned by another project is dropped instead of rendering as "stale" under a
 * different design. "Stale" therefore always means: this project's evidence,
 * produced before one of its inputs changed.
 *
 * The current-vs-stale verdict itself stays with the workflow authority
 * (`deriveVerifyCurrent`), so Project, Simulate, Board, Package and Problems
 * cannot disagree. This module adds ownership and the *reason*: it recomputes
 * the hashes stamped on the run at production time — with the producer's own
 * builders — and names the input that changed.
 */
import type { Circuit } from '@redbyte/rb-logic-core';
import type { HardwareMappingDocumentV2, IoMapping } from '@redbyte/rb-utils';
import { resolveIoMappingFromProjectFields } from '@redbyte/rb-utils';
import type { ProjectIoRow, RuntimeVerifyRun, VerifyRunLedgerEntry } from './projectRuntime';
import { deriveVerifyCurrent } from './projectWorkflowAuthority';
import { computeScenarioContentHash, type VerifyScenario } from './verifyScenario';
import {
  buildVerifyCircuitEvidenceHash,
  buildVerifyMappingEvidenceHash,
  toProjectIoMapping,
} from './verifyProjectHash';

export type RunScopeKind = 'none' | 'current' | 'stale' | 'foreign';

/** Which input changed after the run was produced. */
export type RunScopeReason = 'project' | 'design' | 'mapping' | 'scenario' | 'edited';

export interface RunScope {
  readonly kind: RunScopeKind;
  /** The run the scope describes, or null when there is none or it is foreign. */
  readonly run: RuntimeVerifyRun | null;
  readonly reasons: readonly RunScopeReason[];
  /** One sentence naming what changed, for strips and Problems rows. Null when current. */
  readonly detail: string | null;
}

export interface DeriveRunScopeInput {
  readonly projectId: string;
  readonly run: RuntimeVerifyRun | null | undefined;
  /** The elaborated simulation circuit — the same shape the producer hashed. */
  readonly simulationCircuit: Circuit | null | undefined;
  readonly projectIoRows: readonly ProjectIoRow[];
  readonly hardwareMappingV2?: HardwareMappingDocumentV2 | null;
  readonly scenarios: readonly VerifyScenario[];
  /** Inputs of the workflow authority's verdict. */
  readonly dirtySinceVerify: boolean;
  readonly latestVerifyLedgerEntry?: Pick<VerifyRunLedgerEntry, 'projectHash'> | null;
  readonly currentVerifyProjectHash?: string | null;
}

const NONE: RunScope = { kind: 'none', run: null, reasons: [], detail: null };

function hasHash(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function describeReasons(reasons: readonly RunScopeReason[], scenarioMissing: boolean): string | null {
  if (reasons.length === 0) return null;
  if (reasons.includes('project')) return 'This evidence belongs to another project.';
  const parts: string[] = [];
  if (reasons.includes('design')) parts.push('the design');
  if (reasons.includes('mapping')) parts.push('the pin mapping');
  if (reasons.includes('scenario')) parts.push(scenarioMissing ? 'the scenario (it no longer exists)' : 'the scenario');
  if (parts.length === 0) return 'The project changed after this run.';
  const subject =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} changed after this run.`;
}

/**
 * Classify the last run against the live project. Pure; safe to memoize on its
 * inputs. A run without a stamped owner is treated as this project's (it can
 * only have reached the runtime inside this project's own envelope).
 */
export function deriveRunScope(input: DeriveRunScopeInput): RunScope {
  const run = input.run ?? null;
  if (!run) return NONE;

  const owner = typeof run.projectId === 'string' ? run.projectId.trim() : '';
  if (owner.length > 0 && owner !== input.projectId.trim()) {
    return { kind: 'foreign', run: null, reasons: ['project'], detail: describeReasons(['project'], false) };
  }

  const current = deriveVerifyCurrent({
    hasVerifyRun: true,
    latestVerifyLedgerEntry: input.latestVerifyLedgerEntry ?? null,
    currentVerifyProjectHash: input.currentVerifyProjectHash ?? null,
    dirtySinceVerify: input.dirtySinceVerify,
  });
  if (current) return { kind: 'current', run, reasons: [], detail: null };

  const reasons: RunScopeReason[] = [];
  let scenarioMissing = false;

  const runCircuitHash = run.evidence?.circuitHash;
  if (hasHash(runCircuitHash) && input.simulationCircuit) {
    if (buildVerifyCircuitEvidenceHash(input.simulationCircuit) !== runCircuitHash) reasons.push('design');
  }

  if (hasHash(run.mappingEvidenceHash)) {
    const ioMapping = toProjectIoMapping([...input.projectIoRows]) as IoMapping;
    const liveMapping =
      resolveIoMappingFromProjectFields({
        ioMapping,
        hardwareMappingV2: input.hardwareMappingV2 ?? undefined,
      }) ?? ioMapping;
    if (buildVerifyMappingEvidenceHash(liveMapping) !== run.mappingEvidenceHash) reasons.push('mapping');
  }

  if (hasHash(run.scenarioContentHash)) {
    const scenario = input.scenarios.find((entry) => entry.id === run.scenarioId);
    if (!scenario) {
      scenarioMissing = true;
      reasons.push('scenario');
    } else if (computeScenarioContentHash(scenario) !== run.scenarioContentHash) {
      reasons.push('scenario');
    }
  }

  if (reasons.length === 0) reasons.push('edited');
  return { kind: 'stale', run, reasons, detail: describeReasons(reasons, scenarioMissing) };
}

export interface ScopedRunEvidence {
  readonly run: RuntimeVerifyRun | undefined;
  readonly history: VerifyRunLedgerEntry[];
  /** True when a run or ledger entry named another project and was dropped. */
  readonly droppedForeign: boolean;
}

/**
 * Keep only evidence owned by `projectId`. Legacy runs and entries without an
 * owner are stamped with it: they were carried inside this project's envelope.
 */
export function scopeRunEvidenceToProject(input: {
  projectId: string;
  run: RuntimeVerifyRun | undefined;
  history: readonly VerifyRunLedgerEntry[];
}): ScopedRunEvidence {
  const projectId = input.projectId.trim();
  let droppedForeign = false;

  let run: RuntimeVerifyRun | undefined;
  if (input.run) {
    const owner = typeof input.run.projectId === 'string' ? input.run.projectId.trim() : '';
    if (owner.length > 0 && owner !== projectId) {
      droppedForeign = true;
    } else {
      run = owner.length > 0 ? input.run : { ...input.run, projectId };
    }
  }

  const history: VerifyRunLedgerEntry[] = [];
  for (const entry of input.history) {
    const owner = typeof entry.projectId === 'string' ? entry.projectId.trim() : '';
    if (owner.length > 0 && owner !== projectId) {
      droppedForeign = true;
      continue;
    }
    history.push(owner.length > 0 ? entry : { ...entry, projectId });
  }

  return { run, history, droppedForeign };
}

/**
 * Re-own evidence after Save As / Duplicate: the content is byte-identical, so
 * the run stays valid for the renamed project instead of becoming foreign.
 */
export function restampRunEvidenceProject(input: {
  projectId: string;
  run: RuntimeVerifyRun | undefined;
  history: readonly VerifyRunLedgerEntry[];
}): { run: RuntimeVerifyRun | undefined; history: VerifyRunLedgerEntry[] } {
  const projectId = input.projectId.trim();
  return {
    run: input.run ? { ...input.run, projectId } : undefined,
    history: input.history.map((entry) => ({ ...entry, projectId })),
  };
}
