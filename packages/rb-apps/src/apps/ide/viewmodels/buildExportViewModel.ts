import { encodeRBProject, type RBProject } from '../../../export/projectFormat';
import { compareCodepoint } from '../../../export/codepointSort';
import {
  exportProjectAsBasys3,
  type Basys3ExportError,
  validateArtifactConsistency,
} from '../../../fpga/boards/basys3/basys3ExportService';
import { generateTestbenchVhdl } from '../../../fpga/boards/basys3/testbenchGenerator';
import { generateVivadoImportTcl } from '../../../fpga/boards/basys3/vivadoImportTcl';
import type { VerifyScheduleContract } from '../../../fpga/boards/basys3/verifySchedule';
import { getRuntimeVerifyRunKind, type RuntimeVerifyRun } from '../projectRuntime';
import { computeScenarioContentHash, type VerifyScenario } from '../verifyScenario';
import type { TestVector } from '@redbyte/rb-utils';
import {
  createIdeDiagnostic,
  type IdeDiagnostic,
  type IdeDiagnosticAction,
  type IdeDiagnosticLocation,
  type IdeDiagnosticOwner,
  type IdeDiagnosticSeverity,
} from '../diagnostics';
import { buildBringUpArtifacts } from '../bringupArtifacts';
import { getStudentFacingIoLabel } from '../ioLabels';
import { flattenProjectMacros } from '../macros/macroFlattener';

export type ExportDiagnosticSeverity = 'error' | 'warning';
export type ExportPinDirection = 'in' | 'out' | 'inout';
export type ExportPinStatus = 'mapped' | 'missing' | 'unused';

export interface ExportDiagnosticView {
  id: string;
  code: string;
  title: string;
  message: string;
  hint: string[];
  fix?: string;
  port?: string;
  severity: ExportDiagnosticSeverity;
  owner: IdeDiagnosticOwner;
  actions: IdeDiagnosticAction[];
  canonical: IdeDiagnostic;
}

export interface ExportPinTableRow {
  port: string;
  rowId?: string;
  direction: ExportPinDirection;
  pin?: string;
  required: boolean;
  status: ExportPinStatus;
  notes?: string;
  suggestedPin?: string;
}

/**
 * Source category for a generated artifact, mirroring Vivado's project source classification.
 *
 * design-source     — Synthesizable HDL (top.vhd). Used for top.vhd, .xpr, vivado_import.tcl,
 *                     and hardware/export preview. Governed by designTop.
 * simulation-source — Simulation-only HDL (testbench.vhd). Never merged into the design
 *                     source set. Governed by simulationTop.
 * constraints       — Physical and timing constraints (top.xdc).
 * build-artifact    — Derived project files: scripts, manifests, bring-up docs, project JSON.
 */
export type ExportArtifactCategory =
  | 'design-source'
  | 'simulation-source'
  | 'constraints'
  | 'build-artifact';

export interface ExportArtifactView {
  path: string;
  kind: 'vhd' | 'xdc' | 'readme' | 'tb' | 'tcl' | 'md' | 'json';
  /** Source category for this artifact. Used to group artifacts in the UI
   *  and to enforce that simulation-source artifacts never contaminate the
   *  design-source set in the generated Vivado project. */
  category: ExportArtifactCategory;
  content: string;
  preview: string;
  status: 'ready' | 'blocked' | 'pending';
  note: string;
}

/**
 * Structured provenance for the scenario used to generate the exported testbench.
 * Present when an active scenario and a passing Verify run are both available.
 */
export interface ExportedScenarioProvenance {
  /** Stable scenario identifier — survives renames and vector edits. */
  id: string;
  /** User-visible scenario name at export time. */
  name: string;
  /** Monotonic scenario version counter at export time. */
  version: number;
  /** Deterministic content hash of (id + version + vectors) at export time. */
  contentHash: string;
  /**
   * True when the scenario's content hash differs from the hash recorded in the
   * last Verify PASS run. The testbench uses the current scenario vectors, but
   * they have not yet been re-verified against this design.
   */
  isStaleComparedToLastPass: boolean;
}

/**
 * Provenance metadata embedded in the export viewmodel.
 * Records the exact top-entity names used for design vs. simulation artifacts
 * so consumers (UI, tests, Vivado) can verify authority separation.
 */
export interface ExportTopAuthority {
  /** The synthesizable top-entity name used for top.vhd, top.xdc, .xpr, and vivado_import.tcl.
   *  This is the canonical design authority and must never be redefined by simulation artifacts. */
  designTop: string;
  /** The testbench entity name used for testbench.vhd (typically <designTop>_tb).
   *  Simulation-only. Must not appear in the design source set. */
  simulationTop: string;
}

export interface ExportViewModel {
  status: 'ok' | 'blocked';
  diagnostics: IdeDiagnostic[];
  errors: ExportDiagnosticView[];
  warnings: ExportDiagnosticView[];
  pinTable: ExportPinTableRow[];
  artifacts: ExportArtifactView[];
  exportHash?: string;
  /**
   * Explicit top-entity authority for design vs. simulation artifacts.
   * Both fields are always present when an export result exists.
   */
  topAuthority: ExportTopAuthority;
  /**
   * Structured scenario provenance for the exported testbench.
   * Present when an active scenario and a passing Verify run are both available.
   */
  exportedScenario?: ExportedScenarioProvenance;
}

interface RequiredPortDescriptor {
  name: string;
  direction: ExportPinDirection;
}

export function buildExportViewModel(
  project: RBProject,
  runtimeVerifyRun?: RuntimeVerifyRun,
  activeScenario?: VerifyScenario
): ExportViewModel {
  const flattenedProject = flattenProjectMacros(project);
  const runtimeBackedTestbench = buildRuntimeBackedTestbench(flattenedProject, runtimeVerifyRun, activeScenario);
  const exportResult = exportProjectAsBasys3(flattenedProject);
  const runtimeBackedTestbenchErrors = buildRuntimeBackedTestbenchErrors(
    exportResult.bundle?.topVhd,
    runtimeBackedTestbench,
  );
  const diagnostics = collectDiagnostics(
    flattenedProject,
    [...exportResult.errors, ...runtimeBackedTestbenchErrors],
    exportResult.warnings,
  );
  const canonicalDiagnostics = diagnostics.map((entry) => entry.canonical);
  const errors = diagnostics.filter((entry) => entry.severity === 'error');
  const warnings = diagnostics.filter((entry) => entry.severity === 'warning');
  const requiredPorts = collectRequiredPorts(diagnostics);
  const pinTable = buildPinTable(flattenedProject, diagnostics, requiredPorts);
  const designTop = resolveTopEntity(flattenedProject);
  const simulationTop = `${designTop}_tb`;
  const topAuthority: ExportTopAuthority = { designTop, simulationTop };
  const artifacts = buildArtifacts(
    flattenedProject,
    exportResult,
    errors.length > 0,
    runtimeBackedTestbench,
    runtimeVerifyRun,
    activeScenario,
    topAuthority,
  );
  const exportedScenario = buildScenarioProvenance(activeScenario, runtimeVerifyRun);

  return {
    status: errors.length > 0 ? 'blocked' : 'ok',
    diagnostics: canonicalDiagnostics,
    errors,
    warnings,
    pinTable,
    artifacts,
    exportHash: exportResult.determinismHash,
    topAuthority,
    exportedScenario,
  };
}

function buildRuntimeBackedTestbenchErrors(
  topVhd: string | undefined,
  runtimeBackedTestbench: { content: string; note: string } | undefined,
): Basys3ExportError[] {
  if (!topVhd || !runtimeBackedTestbench) {
    return [];
  }

  return validateArtifactConsistency(topVhd, runtimeBackedTestbench.content).map((message) => ({
    type: 'unknown' as const,
    severity: 'error' as const,
    message,
  }));
}

// TODO(slice-8): Move port/owner extraction earlier — enrich Basys3ExportError with port?: string
// and nodeId?: string at the source so the regex recovery below is unnecessary.
function collectDiagnostics(
  project: RBProject,
  exportErrors: Basys3ExportError[],
  exportWarnings: string[]
): ExportDiagnosticView[] {
  const seen = new Set<string>();
  const diagnostics: ExportDiagnosticView[] = [];
  const mappingIndex = buildMappingIndex(project);

  const push = (severity: ExportDiagnosticSeverity, message: string) => {
    const normalizedSeverity = normalizeDiagnosticSeverity(severity, message);
    const key = `${normalizedSeverity}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);

    const code = diagnosticCodeFor(message, normalizedSeverity);
    const fix = fixHintFor(message, normalizedSeverity);
    const port = extractPortFromMessage(message);
    const owner = resolveDiagnosticOwner(project, mappingIndex, port, message);
    const actions = buildDiagnosticActions(owner);
    const hint = fix.length > 0 ? [fix] : [];
    const canonicalSeverity: IdeDiagnosticSeverity =
      normalizedSeverity === 'error' ? 'error' : 'warn';
    const title = diagnosticTitleFor(code, message, normalizedSeverity);
    const canonical = createIdeDiagnostic({
      severity: canonicalSeverity,
      code,
      title,
      message,
      hint,
      owner,
      origin: 'export',
      stage: 'export',
      location: diagnosticLocationFromOwner(owner, port),
      actions,
    });
    const id = canonical.id;

    diagnostics.push({
      id,
      code,
      title,
      message,
      hint,
      fix,
      port,
      severity: normalizedSeverity,
      owner,
      actions,
      canonical,
    });
  };

  for (const error of exportErrors) {
    push(error.severity === 'error' ? 'error' : 'warning', error.message);
  }
  for (const warning of exportWarnings) {
    push('warning', warning);
  }

  return diagnostics.sort((left, right) => {
    const severityDelta = severityOrder(left.severity) - severityOrder(right.severity);
    if (severityDelta !== 0) return severityDelta;
    const codeDelta = compareCodepoint(left.code, right.code);
    if (codeDelta !== 0) return codeDelta;
    return compareCodepoint(left.message, right.message);
  });
}

function collectRequiredPorts(
  diagnostics: ExportDiagnosticView[]
): Map<string, RequiredPortDescriptor> {
  const required = new Map<string, RequiredPortDescriptor>();
  for (const diagnostic of diagnostics) {
    const requiredMatch = diagnostic.message.match(
      /required (input|output|bidirectional) port "([^"]+)"/i
    );
    if (requiredMatch) {
      const direction = toDirection(requiredMatch[1]);
      const name = requiredMatch[2];
      upsertRequiredPort(required, name, direction);
      continue;
    }

    const declaredMatch = diagnostic.message.match(
      /^(Input|Output|Bidirectional) port "([^"]+)"/i
    );
    if (declaredMatch) {
      const direction = toDirection(declaredMatch[1]);
      const name = declaredMatch[2];
      upsertRequiredPort(required, name, direction);
    }
  }
  return required;
}

function buildPinTable(
  project: RBProject,
  diagnostics: ExportDiagnosticView[],
  requiredPorts: Map<string, RequiredPortDescriptor>
): ExportPinTableRow[] {
  const rows = new Map<string, ExportPinTableRow>();
  const liveIoNodeLabels = buildLiveIoNodeLabelIndex(project);

  const appendMapping = (
    direction: ExportPinDirection,
    entry: { id: string; nodeId: string; port: string; label?: string; pin?: string }
  ) => {
    if (!liveIoNodeLabels.has(entry.nodeId)) {
      return;
    }
    const portName = resolveMappingPortName(entry, liveIoNodeLabels);
    const portKey = normalizePort(portName);
    const existing = rows.get(portKey);
    const pin = normalizePin(entry.pin);
    const required = requiredPorts.has(portKey);
    const suggestedPin = suggestPin(portName, direction);

    if (!existing) {
      rows.set(portKey, {
        port: portName,
        rowId: entry.id,
        direction,
        pin,
        required,
        status: pin ? 'mapped' : 'missing',
        notes: entry.label ? `Signal label: ${entry.label}` : undefined,
        suggestedPin,
      });
      return;
    }

    existing.required = existing.required || required;
    existing.pin = existing.pin || pin;
    existing.direction = mergeDirection(existing.direction, direction);
    existing.suggestedPin = existing.suggestedPin || suggestedPin;
  };

  for (const entry of project.ioMapping?.inputs ?? []) {
    appendMapping('in', entry);
  }
  for (const entry of project.ioMapping?.outputs ?? []) {
    appendMapping('out', entry);
  }

  for (const requiredPort of requiredPorts.values()) {
    const portKey = normalizePort(requiredPort.name);
    const existing = rows.get(portKey);
    if (existing) {
      existing.required = true;
      existing.direction = mergeDirection(existing.direction, requiredPort.direction);
      if (!existing.pin) {
        existing.status = 'missing';
      }
      continue;
    }
    rows.set(portKey, {
      port: requiredPort.name,
      direction: requiredPort.direction,
      pin: undefined,
      required: true,
      status: 'missing',
      notes: 'Required by top-entity export.',
      suggestedPin: suggestPin(requiredPort.name, requiredPort.direction),
    });
  }

  for (const diagnostic of diagnostics) {
    const unusedMatch = diagnostic.message.match(/Unused mapped (input|output) "([^"]+)"/i);
    if (!unusedMatch) continue;
    const key = normalizePort(unusedMatch[2]);
    const existing = rows.get(key);
    if (existing) {
      existing.status = 'unused';
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      status: finalizeRowStatus(row),
    }))
    .sort((left, right) => {
      if (left.required !== right.required) return left.required ? -1 : 1;
      return compareCodepoint(left.port, right.port);
    });
}

function buildArtifacts(
  project: RBProject,
  exportResult: ReturnType<typeof exportProjectAsBasys3>,
  blocked: boolean,
  runtimeBackedTestbench: { content: string; note: string } | undefined,
  runtimeVerifyRun?: RuntimeVerifyRun,
  activeScenario?: VerifyScenario,
  topAuthority?: ExportTopAuthority
): ExportArtifactView[] {
  const artifacts: ExportArtifactView[] = [];
  const bundle = exportResult.bundle;
  const rbprojJson = encodeRBProject(project);
  const topEntity = resolveTopEntity(project);
  const vhdlSourcePaths: string[] = ['top.vhd'];
  const vivadoImportTcl = generateVivadoImportTcl({
    projectName: project.name,
    topEntity,
    sourcePaths: vhdlSourcePaths,
    constraintsPath: 'top.xdc',
    simulationPath: 'testbench.vhd',
  });
  const bringUpArtifacts = buildBringUpArtifacts({
    project,
    ioRows: collectBringUpIoRows(project),
    expectedBehavior:
      project.description?.trim() || 'Outputs should reflect deterministic bring-up vectors.',
    exportHash: exportResult.determinismHash,
    verifyHash: runtimeVerifyRun?.deterministicHash,
    verifyReportHash: runtimeVerifyRun?.reportHash,
    verifyGeneratedAtIso: runtimeVerifyRun?.generatedAtIso,
    verifyRows: runtimeVerifyRun?.report.rows,
  });

  // Provenance header fields — injected into every generated text artifact.
  const provenanceBase = {
    board: 'Basys3',
    designTop: topAuthority?.designTop ?? topEntity,
    projectName: project.name,
    exportHash: exportResult.determinismHash,
  };

  if (bundle) {
    // Design Sources
    const topVhdHeader = buildProvenanceHeader('--', provenanceBase);
    artifacts.push({
      path: 'top.vhd',
      kind: 'vhd',
      category: 'design-source',
      content: normalizeArtifactContent(topVhdHeader + bundle.topVhd),
      preview: buildPreview(bundle.topVhd),
      status: blocked ? 'blocked' : 'ready',
      note: `Synthesizable top-level VHDL. designTop=${topAuthority?.designTop ?? resolveTopEntity(project)}.`,
    });
    // Constraints
    const topXdcHeader = buildProvenanceHeader('#', provenanceBase);
    artifacts.push({
      path: 'top.xdc',
      kind: 'xdc',
      category: 'constraints',
      content: normalizeArtifactContent(topXdcHeader + bundle.topXdc),
      preview: buildPreview(bundle.topXdc),
      status: blocked ? 'blocked' : 'ready',
      note: 'Basys3 physical constraints derived from IO mapping.',
    });
    // Simulation Sources — testbench.vhd
    // Export is not blocked by compare state. A testbench is generated whenever vectors
    // exist, regardless of whether the last Verify run passed, failed, or is stale.
    const tbHeader = buildProvenanceHeader('--', {
      ...provenanceBase,
      simulationTop: topAuthority?.simulationTop ?? `${topEntity}_tb`,
    });
    if (runtimeBackedTestbench) {
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        category: 'simulation-source',
        content: normalizeArtifactContent(tbHeader + runtimeBackedTestbench.content),
        preview: buildPreview(runtimeBackedTestbench.content),
        status: blocked ? 'blocked' : 'ready',
        note: runtimeBackedTestbench.note,
      });
    } else if (bundle.testbench) {
      // Compatibility fallback: generated by basys3ExportService from project.vectors
      // when no activeScenario and no runtimeVerifyRun are available.
      // Uses the same deterministic path as the runtime-backed testbench.
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        category: 'simulation-source',
        content: normalizeArtifactContent(tbHeader + bundle.testbench),
        preview: buildPreview(bundle.testbench),
        status: blocked ? 'blocked' : 'ready',
        note: 'Deterministic schedule mirror from project vectors (no active scenario).',
      });
    } else {
      const hasVectors = (project.vectors?.length ?? 0) > 0;
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        category: 'simulation-source',
        content: '',
        preview: '',
        status: hasVectors ? 'blocked' : 'pending',
        note: hasVectors
          ? 'Blocked until export validation passes.'
          : 'Pending until vectors are provided.',
      });
    }
    // Build Artifacts
    const tclHeader = buildProvenanceHeader('#', provenanceBase);
    artifacts.push({
      path: 'vivado_import.tcl',
      kind: 'tcl',
      category: 'build-artifact',
      content: normalizeArtifactContent(tclHeader + vivadoImportTcl),
      preview: buildPreview(vivadoImportTcl),
      status: blocked ? 'blocked' : 'ready',
      note: 'Vivado batch import script for Basys3 project setup.',
    });
    artifacts.push({
      path: 'README.txt',
      kind: 'readme',
      category: 'build-artifact',
      content: normalizeArtifactContent(bundle.readme),
      preview: buildPreview(bundle.readme),
      status: blocked ? 'blocked' : 'ready',
      note: 'Vivado import instructions.',
    });
    artifacts.push({
      path: 'BRINGUP.md',
      kind: 'md',
      category: 'build-artifact',
      content: normalizeArtifactContent(bringUpArtifacts.bringupMarkdown),
      preview: buildPreview(bringUpArtifacts.bringupMarkdown),
      status: blocked ? 'blocked' : 'ready',
      note: 'Fast board bring-up checklist and mapping summary.',
    });
    artifacts.push({
      path: 'EXPECTED_IO.json',
      kind: 'json',
      category: 'build-artifact',
      content: normalizeArtifactContent(bringUpArtifacts.expectedIoJson),
      preview: buildPreview(bringUpArtifacts.expectedIoJson),
      status: blocked ? 'blocked' : 'ready',
      note: 'Deterministic expected IO behavior for board bring-up vectors.',
    });
    artifacts.push({
      path: 'program_and_test.tcl',
      kind: 'tcl',
      category: 'build-artifact',
      content: normalizeArtifactContent(bringUpArtifacts.programAndTestTcl),
      preview: buildPreview(bringUpArtifacts.programAndTestTcl),
      status: blocked ? 'blocked' : 'ready',
      note: 'Hardware manager programming scaffold for Basys3 bring-up.',
    });
    artifacts.push({
      path: 'project.rbproj.json',
      kind: 'json',
      category: 'build-artifact',
      content: normalizeArtifactContent(rbprojJson),
      preview: buildPreview(rbprojJson),
      status: 'ready',
      note: 'Canonical RedByte project snapshot for Save/Load roundtrip.',
    });
  } else {
    // Export diagnostics blocked the bundle — emit skeleton artifacts so the UI
    // can still display all expected paths with their blocked status.
    artifacts.push({
      path: 'top.vhd', kind: 'vhd', category: 'design-source',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'top.xdc', kind: 'xdc', category: 'constraints',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'testbench.vhd', kind: 'tb', category: 'simulation-source',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'vivado_import.tcl', kind: 'tcl', category: 'build-artifact',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'README.txt', kind: 'readme', category: 'build-artifact',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'BRINGUP.md', kind: 'md', category: 'build-artifact',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'EXPECTED_IO.json', kind: 'json', category: 'build-artifact',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'program_and_test.tcl', kind: 'tcl', category: 'build-artifact',
      content: '', preview: '', status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'project.rbproj.json', kind: 'json', category: 'build-artifact',
      content: normalizeArtifactContent(rbprojJson),
      preview: buildPreview(rbprojJson),
      status: 'ready',
      note: 'Canonical RedByte project snapshot for Save/Load roundtrip.',
    });
  }

  return artifacts;
}

/**
 * The only permitted export from RuntimeVerifyRun into HDL content generation.
 *
 * This is a frozen, read-only view of VerifyScheduleContract. It contains ONLY
 * timing and schedule policy — no compare results, no waveform, no status flags.
 *
 * Creation rule: extract via `extractExportScheduleView(runtimeVerifyRun)` — never
 * spread a full RuntimeVerifyRun into a content-generation function directly.
 */
type ExportScheduleView = Readonly<VerifyScheduleContract>;

/**
 * Firewall function: extracts the ExportScheduleView from a RuntimeVerifyRun.
 * This is the ONLY place in the export pipeline where a RuntimeVerifyRun may
 * be read for HDL content purposes. The result is frozen to prevent mutation.
 *
 * All testbench VHDL content generation must receive this view — never the run.
 */
function extractExportScheduleView(run: RuntimeVerifyRun | undefined): ExportScheduleView | undefined {
  if (!run?.scheduleContract) return undefined;
  return Object.freeze({ ...run.scheduleContract }) as ExportScheduleView;
}

/**
 * Pure testbench VHDL content generator — the canonical gate for HDL content authority.
 *
 * Inputs are structurally limited to:
 *   - project (RBProject) — top-entity name, port list
 *   - vectors (TestVector[]) — scenario vectors or compat project.vectors
 *   - scheduleView (ExportScheduleView | undefined) — frozen schedule policy from firewall
 *
 * This function must NEVER receive RuntimeVerifyRun, waveform snapshots, compare
 * results, report rows, or any derived verify state. Those exist only in buildTestbenchNote.
 *
 * AUDIT RULE: If the signature of this function gains a RuntimeVerifyRun parameter,
 * or any field from RuntimeVerifyRun beyond the ExportScheduleView — that is a bug.
 * The type system will catch direct RuntimeVerifyRun passing; the firewall comment
 * catches structural cheats (e.g. manually spreading run fields here).
 */
function generateTestbenchContent(
  project: RBProject,
  vectors: TestVector[],
  scheduleView: ExportScheduleView | undefined,
  legacyRunSchedule?: { schedule: RuntimeVerifyRun['schedule']; clockSignalName?: string }
): string {
  return generateTestbenchVhdl(project, vectors, {
    scheduleOverride: scheduleView
      ? { ...scheduleView, reason: 'verify-last-run' as const }
      : legacyRunSchedule
        ? {
            schedule: legacyRunSchedule.schedule,
            reason: 'verify-last-run' as const,
            clockSignalName: legacyRunSchedule.clockSignalName,
          }
        : undefined,
  });
}

/**
 * Builds the UI note string that accompanies the testbench artifact.
 *
 * This is the ONLY place in the export pipeline allowed to read RuntimeVerifyRun
 * fields beyond scheduleContract (e.g. status, schedule, scenarioContentHash).
 * The note is UI metadata only — it never affects VHDL content.
 */
function buildTestbenchNote(
  activeScenario: VerifyScenario | undefined,
  runtimeVerifyRun: RuntimeVerifyRun | undefined,
  clockNote: string
): string {
  const runKind = getRuntimeVerifyRunKind(runtimeVerifyRun);
  if (activeScenario) {
    const contentHash = computeScenarioContentHash(activeScenario);
    const runStatus = runtimeVerifyRun?.status ?? null;
    const isStale =
      runtimeVerifyRun && typeof runtimeVerifyRun.scenarioContentHash === 'string'
        ? runtimeVerifyRun.scenarioContentHash !== contentHash
        : false;

    if (isStale) {
      return (
        `STALE — scenario '${activeScenario.name}' v${activeScenario.version} changed since ` +
        `last Verify run. Vectors reflect the current scenario; re-run Verify to confirm alignment.`
      );
    }
    if (runKind === 'trace') {
      return (
        `Scenario '${activeScenario.name}' v${activeScenario.version} (${contentHash})` +
        ` â€” trace-only run recorded (${runtimeVerifyRun?.schedule ?? 'derived'}${clockNote}). ` +
        `Expected-output comparison has not been confirmed yet.`
      );
    }
    if (runStatus === 'pass') {
      return (
        `Scenario '${activeScenario.name}' v${activeScenario.version} (${contentHash})` +
        ` — verified PASS (${runtimeVerifyRun!.schedule}${clockNote}).`
      );
    }
    if (runStatus === 'fail') {
      return (
        `Scenario '${activeScenario.name}' v${activeScenario.version} (${contentHash})` +
        ` — last Verify run had assertion differences (${runtimeVerifyRun!.schedule}${clockNote}). ` +
        `Export is not blocked; re-run Verify to confirm.`
      );
    }
    // No run yet — testbench generated from current scenario vectors with derived schedule.
    return (
      `Scenario '${activeScenario.name}' v${activeScenario.version} (${contentHash})` +
      ` — no Verify run yet. Schedule derived from circuit structure.`
    );
  }

  // No active scenario — vectors from project.vectors (compat fallback).
  const runStatus = runtimeVerifyRun?.status ?? null;
  const scheduleLabel = runtimeVerifyRun?.schedule ?? 'derived';
  if (runKind === 'trace') {
    return `Vectors from project â€” trace-only run recorded (${scheduleLabel}${clockNote}). Expected-output comparison has not been confirmed yet.`;
  }
  if (runStatus === 'pass') {
    return `Deterministic schedule from last Verify PASS (${scheduleLabel}${clockNote}).`;
  }
  if (runStatus === 'fail') {
    return `Vectors from project — last Verify run had assertion differences (${scheduleLabel}${clockNote}). Export is not blocked.`;
  }
  return `Vectors from project — no Verify run yet. Schedule derived from circuit structure.`;
}

function buildRuntimeBackedTestbench(
  project: RBProject,
  runtimeVerifyRun: RuntimeVerifyRun | undefined,
  activeScenario: VerifyScenario | undefined
): { content: string; note: string } | undefined {
  // Vector source authority:
  //   1. activeScenario.vectors — PRIMARY (scenario is the authoritative vector source)
  //   2. project.vectors — COMPAT FALLBACK (when no scenario is present)
  const vectors = activeScenario ? activeScenario.vectors : project.vectors;
  if (!vectors || vectors.length === 0) return undefined;

  // Require at least a scenario or a runtime run to produce a runtime-backed testbench.
  // Without either, fall through to the bundle.testbench compatibility path.
  if (!runtimeVerifyRun && !activeScenario) return undefined;

  // ── EXPORT AUTHORITY FIREWALL ────────────────────────────────────────────────
  // Cross the authority boundary exactly once: extract a frozen ExportScheduleView
  // from the runtime run. After this point, `runtimeVerifyRun` must NOT be passed
  // to any content-generation function — only `scheduleView` is permitted.
  // The assertionMask field on the view records which outputs were asserted and
  // MUST be used by the testbench generator to restrict VHDL assertions.
  const scheduleView = extractExportScheduleView(runtimeVerifyRun);
  const legacyRunSchedule = runtimeVerifyRun && !scheduleView
    ? { schedule: runtimeVerifyRun.schedule, clockSignalName: runtimeVerifyRun.meta.clockSignalName ?? undefined }
    : undefined;

  const content = generateTestbenchContent(project, vectors, scheduleView, legacyRunSchedule);
  // ────────────────────────────────────────────────────────────────────────────

  // ── NOTE ZONE (UI metadata only — may read any RuntimeVerifyRun field) ───────
  // Everything below this line is note-string generation. It may freely read
  // runtimeVerifyRun.status, .schedule, .scenarioContentHash, etc.
  // None of these reads affect VHDL artifact content.
  const clockNote =
    scheduleView?.clockSignalName && scheduleView.clockSignalName.length > 0
      ? `, clock=${scheduleView.clockSignalName}`
      : '';
  const note = buildTestbenchNote(activeScenario, runtimeVerifyRun, clockNote);
  // ────────────────────────────────────────────────────────────────────────────

  return { content, note };
}

/**
 * Build a deterministic provenance header comment block for a generated artifact.
 *
 * The header records the authority chain state at export time so that any artifact
 * file can be traced back to a specific project + scenario + board combination.
 * Engineers reviewing an XDC or VHDL file in Vivado can immediately see which
 * RedByte project and export invocation produced it.
 *
 * @param commentStyle '--' for VHDL, '#' for XDC/TCL
 */
function buildProvenanceHeader(
  commentStyle: '--' | '#',
  fields: {
    board: string;
    designTop: string;
    simulationTop?: string;
    projectName: string;
    exportHash?: string;
  }
): string {
  const c = commentStyle;
  const sep = `${c} ${'='.repeat(62)}`;
  const tbLine = fields.simulationTop
    ? `${c} Board: ${fields.board} | designTop: ${fields.designTop} | simulationTop: ${fields.simulationTop}`
    : `${c} Board: ${fields.board} | designTop: ${fields.designTop}`;
  const projLine = fields.exportHash
    ? `${c} Project: ${fields.projectName} | Export hash: ${fields.exportHash}`
    : `${c} Project: ${fields.projectName}`;
  return [sep, `${c} RedByte IDE Export`, tbLine, projLine, `${c} Generated automatically — do not edit by hand.`, sep, ''].join('\n');
}

/**
 * Compute structured scenario provenance for the exported testbench.
 * Returns undefined when either the active scenario or a passing run is absent.
 */
function buildScenarioProvenance(
  activeScenario: VerifyScenario | undefined,
  runtimeVerifyRun: RuntimeVerifyRun | undefined
): ExportedScenarioProvenance | undefined {
  if (
    !activeScenario ||
    !runtimeVerifyRun ||
    getRuntimeVerifyRunKind(runtimeVerifyRun) !== 'verify' ||
    runtimeVerifyRun.status !== 'pass'
  ) {
    return undefined;
  }
  const contentHash = computeScenarioContentHash(activeScenario);
  const isStaleComparedToLastPass =
    typeof runtimeVerifyRun.scenarioContentHash === 'string'
      ? runtimeVerifyRun.scenarioContentHash !== contentHash
      : false;
  return {
    id: activeScenario.id,
    name: activeScenario.name,
    version: activeScenario.version,
    contentHash,
    isStaleComparedToLastPass,
  };
}

function resolveTopEntity(project: RBProject): string {
  const top =
    (project.hdl?.top ?? project.fpga?.top ?? '')
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_');
  return top.length > 0 ? top : 'top';
}

function collectBringUpIoRows(project: RBProject): Array<{
  id: string;
  nodeId?: string;
  label: string;
  port?: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}> {
  const rows: Array<{
    id: string;
    nodeId?: string;
    label: string;
    port?: string;
    direction: 'in' | 'out';
    pin: string;
    required: boolean;
  }> = [];

  for (const input of project.ioMapping?.inputs ?? []) {
    rows.push({
      id: input.id,
      nodeId: input.nodeId,
      label: (input.label ?? '').trim(),
      port: input.port,
      direction: 'in',
      pin: input.pin ?? '',
      required: true,
    });
  }

  for (const output of project.ioMapping?.outputs ?? []) {
    rows.push({
      id: output.id,
      nodeId: output.nodeId,
      label: (output.label ?? '').trim(),
      port: output.port,
      direction: 'out',
      pin: output.pin ?? '',
      required: true,
    });
  }

  return rows;
}

function severityOrder(severity: ExportDiagnosticSeverity): number {
  return severity === 'error' ? 0 : 1;
}

function normalizeDiagnosticSeverity(
  severity: ExportDiagnosticSeverity,
  message: string
): ExportDiagnosticSeverity {
  if (severity !== 'error') return severity;
  if (/bundle validation failed/i.test(message)) return 'warning';
  return severity;
}

interface MappingIndexEntry {
  nodeId: string;
  mappingKey: string;
  portName: string;
}

function buildMappingIndex(project: RBProject): Map<string, MappingIndexEntry> {
  const index = new Map<string, MappingIndexEntry>();
  const liveIoNodeLabels = buildLiveIoNodeLabelIndex(project);
  const upsert = (entry: { id: string; nodeId: string; port: string; label?: string }) => {
    if (!liveIoNodeLabels.has(entry.nodeId)) {
      return;
    }
    const portName = resolveMappingPortName(entry, liveIoNodeLabels);
    const mappingKey = normalizePort(portName);
    if (index.has(mappingKey)) return;
    index.set(mappingKey, {
      nodeId: entry.nodeId,
      mappingKey,
      portName,
    });
  };

  for (const input of project.ioMapping?.inputs ?? []) {
    upsert(input);
  }
  for (const output of project.ioMapping?.outputs ?? []) {
    upsert(output);
  }
  return index;
}

function resolveDiagnosticOwner(
  project: RBProject,
  mappingIndex: Map<string, MappingIndexEntry>,
  port: string | undefined,
  message: string
): IdeDiagnosticOwner {
  const directNodeId = extractNodeIdFromMessage(message);
  if (directNodeId) {
    const node = project.circuit.nodes.find((entry) => entry.id === directNodeId);
    if (node) {
      return {
        kind: 'node',
        nodeId: node.id,
        portName: node.label ?? node.id,
      };
    }
  }

  const normalizedPort = normalizePort(port ?? '');
  if (normalizedPort.length > 0) {
    const mapped = mappingIndex.get(normalizedPort);
    if (mapped) {
      return {
        kind: 'mapping',
        nodeId: mapped.nodeId,
        portName: mapped.portName,
        mappingKey: mapped.mappingKey,
      };
    }
    return {
      kind: 'port',
      portName: normalizedPort,
    };
  }

  const referencedNodeType = extractNodeTypeFromMessage(message);
  if (referencedNodeType) {
    const ownerNode = project.circuit.nodes.find(
      (node) => normalizePort(node.type) === normalizePort(referencedNodeType)
    );
    if (ownerNode) {
      return {
        kind: 'node',
        nodeId: ownerNode.id,
        portName: ownerNode.label ?? ownerNode.id,
      };
    }
  }

  return {
    kind: 'file',
    filePath: 'export',
  };
}

function buildDiagnosticActions(owner: IdeDiagnosticOwner): IdeDiagnosticAction[] {
  if (owner.kind === 'mapping') {
    return [
      {
        kind: 'open-mode',
        label: 'Open Project Mapping',
        payload: {
          mode: 'project',
          mappingKey: owner.mappingKey,
          portName: owner.portName,
          nodeId: owner.nodeId,
        },
      },
      {
        kind: 'select',
        label: 'Select mapping row',
        payload: {
          mode: 'project',
          mappingKey: owner.mappingKey,
          portName: owner.portName,
          nodeId: owner.nodeId,
        },
      },
    ];
  }
  if (owner.kind === 'node') {
    return [
      {
        kind: 'open-mode',
        label: 'Open Design Inspector',
        payload: {
          mode: 'design',
          nodeId: owner.nodeId,
          portName: owner.portName,
        },
      },
      {
        kind: 'select',
        label: 'Select node',
        payload: {
          mode: 'design',
          nodeId: owner.nodeId,
          portName: owner.portName,
        },
      },
    ];
  }
  if (owner.kind === 'port') {
    return [
      {
        kind: 'open-mode',
        label: 'Open Project Mapping',
        payload: {
          mode: 'project',
          mappingKey: owner.mappingKey ?? normalizePort(owner.portName ?? ''),
          portName: owner.portName,
        },
      },
    ];
  }
  return [
    {
      kind: 'open-mode',
      label: 'Open Export Diagnostics',
      payload: {
        mode: 'export',
        filePath: owner.filePath,
      },
    },
  ];
}

function diagnosticLocationFromOwner(
  owner: IdeDiagnosticOwner,
  port: string | undefined
): IdeDiagnosticLocation | undefined {
  if (owner.kind === 'node') {
    return {
      nodeId: owner.nodeId,
      port: port ?? owner.portName,
    };
  }
  if (owner.kind === 'mapping') {
    return {
      nodeId: owner.nodeId,
      port: port ?? owner.portName,
      mappingKey: owner.mappingKey,
    };
  }
  if (owner.kind === 'port') {
    return {
      port: port ?? owner.portName,
      mappingKey: owner.mappingKey,
    };
  }
  if (owner.kind === 'file') {
    return {
      filePath: owner.filePath,
      port,
    };
  }
  return undefined;
}

function normalizePort(value: string): string {
  return value.trim().toLowerCase();
}

export function buildLiveIoNodeLabelIndex(project: RBProject): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of project.circuit.nodes) {
    if (node.type !== 'INPUT' && node.type !== 'OUTPUT') continue;
    const label = getStudentFacingIoLabel(node, node.id);
    index.set(node.id, label);
  }
  return index;
}

export function resolveMappingPortName(entry: {
  id: string;
  nodeId: string;
  port: string;
  label?: string;
}, liveIoNodeLabels?: ReadonlyMap<string, string>): string {
  const fallback = entry.port.trim()
    ? `${entry.nodeId}.${entry.port}`
    : entry.id;
  const liveLabel = liveIoNodeLabels?.get(entry.nodeId)?.trim() ?? '';
  if (liveLabel.length > 0) return liveLabel;
  return getStudentFacingIoLabel(entry, fallback);
}

function normalizePin(value?: string): string | undefined {
  const trimmed = (value ?? '').trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mergeDirection(
  left: ExportPinDirection,
  right: ExportPinDirection
): ExportPinDirection {
  if (left === right) return left;
  return 'inout';
}

function finalizeRowStatus(row: ExportPinTableRow): ExportPinStatus {
  if (row.status === 'unused') return 'unused';
  if (row.pin && row.pin.trim().length > 0) return 'mapped';
  return row.required ? 'missing' : row.status;
}

function upsertRequiredPort(
  required: Map<string, RequiredPortDescriptor>,
  name: string,
  direction: ExportPinDirection
): void {
  const key = normalizePort(name);
  const existing = required.get(key);
  if (!existing) {
    required.set(key, { name, direction });
    return;
  }
  existing.direction = mergeDirection(existing.direction, direction);
}

function toDirection(raw: string): ExportPinDirection {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'output') return 'out';
  if (normalized === 'bidirectional') return 'inout';
  return 'in';
}

function extractPortFromMessage(message: string): string | undefined {
  const quotedPort = message.match(/port "([^"]+)"/i);
  if (quotedPort?.[1]) return quotedPort[1];
  const quotedMapping = message.match(/mapping "([^"]+)"/i);
  if (quotedMapping?.[1]) return quotedMapping[1];
  return undefined;
}

function extractNodeTypeFromMessage(message: string): string | undefined {
  const typed = message.match(/node type "([^"]+)"/i);
  if (typed?.[1]) return typed[1];
  const fallback = message.match(/unsupported node type\s+([a-zA-Z0-9_]+)/i);
  if (fallback?.[1]) return fallback[1];
  return undefined;
}

function extractNodeIdFromMessage(message: string): string | undefined {
  const direct = message.match(/node "([^"]+)"/i);
  if (direct?.[1]) return direct[1];
  const dotted = message.match(/for "([^"]+)\.[^"]+"/i);
  if (dotted?.[1]) return dotted[1];
  return undefined;
}

function diagnosticCodeFor(
  message: string,
  severity: ExportDiagnosticSeverity
): string {
  const lowered = message.toLowerCase();
  if (lowered.includes('unmapped required')) return 'RBEX1001';
  if (lowered.includes('declared but has no basys3 pin assignment')) return 'RBEX1002';
  if (lowered.includes('unsupported synth subset node type')) return 'RBEX4100';
  if (lowered.includes('multiple drivers detected')) return 'RBEX4101';
  if (lowered.includes('combinational loop detected')) return 'RBEX4102';
  if (lowered.includes('floating output detected')) return 'RBEX4103';
  if (lowered.includes('missing a clock input')) return 'RBEX4200';
  if (lowered.includes('multiple clock domains detected')) return 'RBEX4201';
  if (lowered.includes('multiple clock drivers')) return 'RBEX4202';
  if (lowered.includes('multiple reset drivers')) return 'RBEX4203';
  if (lowered.includes('unsupported reset polarity')) return 'RBEX4204';
  if (lowered.includes('unsupported bus port')) return 'RBEX4300';
  if (lowered.includes('unsupported') && lowered.includes('pin')) return 'RBEX2001';
  if (lowered.includes('questionable') && lowered.includes('mapping')) return 'RBEX2002';
  if (lowered.includes('unused mapped')) return 'RBEX2003';
  if (lowered.includes('ignoring source xdc directive')) return 'RBEX3001';
  return severity === 'error' ? 'RBEX9000' : 'RBEX9001';
}

function fixHintFor(
  message: string,
  severity: ExportDiagnosticSeverity
): string {
  const explicitFix = message.match(/Fix:\s*(.+)$/i);
  if (explicitFix?.[1]) return explicitFix[1];
  const lowered = message.toLowerCase();
  if (lowered.includes('ignoring source xdc directive')) {
    return 'No action required unless you need this constraint represented via IO mapping.';
  }
  if (lowered.includes('unused mapped')) {
    return 'Remove the unused mapping or connect the port in the top entity.';
  }
  if (lowered.includes('questionable') && lowered.includes('mapping')) {
    return 'Move this port to a direction-compatible Basys3 alias.';
  }
  if (lowered.includes('combinational loop detected')) {
    return 'Use DLatch, DFlipFlop, RSLatch, or the supported exact 4-NAND D-latch topology before exporting.';
  }
  if (severity === 'error') {
    return 'Resolve this blocker before exporting.';
  }
  return 'Review this warning before exporting.';
}

function diagnosticTitleFor(
  code: string,
  message: string,
  severity: ExportDiagnosticSeverity
): string {
  if (code === 'RBEX1001') return 'Unmapped required port';
  if (code === 'RBEX1002') return 'Declared port missing Basys3 assignment';
  if (code === 'RBEX4100') return 'Unsupported synth subset node';
  if (code === 'RBEX4101') return 'Multiple drivers on input port';
  if (code === 'RBEX4102') return 'Combinational loop detected';
  if (code === 'RBEX4103') return 'Floating output';
  if (code === 'RBEX4200') return 'Sequential node missing clock';
  if (code === 'RBEX4201') return 'Multiple clock domains';
  if (code === 'RBEX4202') return 'Sequential node has multiple clocks';
  if (code === 'RBEX4203') return 'Sequential node has multiple resets';
  if (code === 'RBEX4204') return 'Unsupported reset polarity';
  if (code === 'RBEX4300') return 'Unsupported top-level bus port';
  if (code === 'RBEX2001') return 'Unsupported Basys3 pin alias';
  if (code === 'RBEX2002') return 'Questionable direction mapping';
  if (code === 'RBEX2003') return 'Unused mapped signal';
  if (code === 'RBEX3001') return 'Ignored source XDC directive';
  if (message.length > 0) return message.split('.').at(0) ?? message;
  return severity === 'error' ? 'Export error' : 'Export warning';
}

function suggestPin(portName: string, direction: ExportPinDirection): string {
  const normalized = normalizePort(portName);
  if (normalized === 'clk' || normalized === 'clock' || normalized === 'clk100mhz') {
    return 'CLK100MHZ';
  }
  if (direction === 'in') return 'SW0';
  if (direction === 'out') return 'LD0';
  return 'JA1';
}

function buildPreview(content: string): string {
  const normalized = normalizeArtifactContent(content);
  if (normalized.length === 0) return '';
  return normalized.split('\n').slice(0, 160).join('\n');
}

function normalizeArtifactContent(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}
