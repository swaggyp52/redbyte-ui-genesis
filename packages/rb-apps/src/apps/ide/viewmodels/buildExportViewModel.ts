import { encodeRBProject, type RBProject } from '../../../export/projectFormat';
import { compareCodepoint } from '../../../export/codepointSort';
import {
  exportProjectAsBasys3,
  type Basys3ExportError,
  validateArtifactConsistency,
} from '../../../fpga/boards/basys3/basys3ExportService';
import type {
  Basys3MappingConflictState,
  Basys3SemanticMappingProjection,
} from '../../../fpga/boards/basys3/basys3ExportContract';
import { getBasys3BoardResource } from '../../../fpga/boards/basys3/basys3Pins';
import {
  generateTestbenchVhdl,
  type TestbenchClockDriveView,
} from '../../../fpga/boards/basys3/testbenchGenerator';
import { generateVivadoImportTcl } from '../../../fpga/boards/basys3/vivadoImportTcl';
import {
  deriveVerifySchedule,
  type VerifyScheduleContract,
} from '../../../fpga/boards/basys3/verifySchedule';
import {
  getRuntimeVerifyRunKind,
  normalizeVectorsForLiveIo,
  type ProjectIoRow,
  type RuntimeVerifyRun,
} from '../projectRuntime';
import {
  computeExecutionStimulusHash,
  computeScenarioContentHash,
  materializeScenarioVectors,
  normalizeScenarioSequentialPolicy,
  type VerifyScenario,
} from '../verifyScenario';
import { resolveIoMappingFromProjectFields, type IoMapping, type TestVector } from '@redbyte/rb-utils';
import {
  createIdeDiagnostic,
  type IdeDiagnostic,
  type IdeDiagnosticAction,
  type IdeDiagnosticLocation,
  type IdeDiagnosticOwner,
  type IdeDiagnosticSeverity,
} from '../diagnostics';
import { buildBringUpArtifacts, type BringUpIoRow } from '../bringupArtifacts';
import { getStudentFacingIoLabel } from '../ioLabels';
import { flattenProjectMacros } from '../macros/macroFlattener';
import {
  detectVerifyClockPolicy,
  materializeVectorsForClockPolicy,
  resolveEffectiveVerifyClockPolicy,
  resolveVerifyTick0Meaning,
  type VerifyClockPolicy,
} from '../verifyClockPolicy';
import {
  buildVerifyCircuitEvidenceHash,
  buildVerifyMappingEvidenceHash,
} from '../verifyProjectHash';
import { stableSerialize } from '../../../utils/stableSerialize';
import { elaborateProjectHierarchy } from '../projectHierarchy';
import { generateHierarchicalVhdlProject } from '../hierarchicalVhdl';

function getEffectiveIoMapping(project: RBProject): IoMapping | undefined {
  return resolveIoMappingFromProjectFields({
    ioMapping: project.ioMapping,
    hardwareMappingV2: project.hardwareMappingV2,
  });
}

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
  logicalSignalId?: string;
  logicalLabel?: string;
  artifactPortName?: string;
  boardResourceId?: string | null;
  boardResourceLabel?: string | null;
  packagePin?: string | null;
  ioStandard?: 'LVCMOS33';
  exactXdcLine?: string;
  conflictState?: Basys3MappingConflictState;
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
  mappingProjection: Basys3SemanticMappingProjection[];
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
  const verifyAuthority = buildExportVerifyAuthority(project, runtimeVerifyRun, activeScenario);
  const hierarchyVhdl = generateHierarchicalVhdlProject(project);
  const flattenedProject = flattenProjectMacros({
    ...project,
    circuit: elaborateProjectHierarchy(project.circuit, project.hierarchy),
  });
  const runtimeBackedTestbench = buildRuntimeBackedTestbench(
    flattenedProject,
    runtimeVerifyRun,
    activeScenario,
    verifyAuthority,
  );
  const exportResult = exportProjectAsBasys3(flattenedProject);
  if (hierarchyVhdl && exportResult.bundle) {
    exportResult.bundle.topVhd = hierarchyVhdl.topVhd;
    exportResult.bundle.importedCompanionSources = hierarchyVhdl.moduleSources.map((source) => ({
      sourcePath: source.path,
      exportPath: source.path,
      content: source.text,
    }));
    if (exportResult.projectProjection) {
      exportResult.projectProjection = {
        ...exportResult.projectProjection,
        hierarchy: project.hierarchy,
        hdl: {
          ...(exportResult.projectProjection.hdl ?? { top: resolveTopEntity(project), sources: [] }),
          top: resolveTopEntity(project),
          sources: [
            { path: 'top.vhd', language: 'vhdl', text: hierarchyVhdl.topVhd },
            ...hierarchyVhdl.moduleSources.map((source) => ({ path: source.path, language: 'vhdl' as const, text: source.text })),
          ],
        },
      };
    }
  }
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
  const pinTable = buildPinTable(
    flattenedProject,
    diagnostics,
    requiredPorts,
    exportResult.mappingProjection,
  );
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
    verifyAuthority,
  );
  const exportedScenario = buildScenarioProvenance(
    activeScenario,
    runtimeVerifyRun,
    verifyAuthority.runtimeEvidenceCurrent,
  );

  return {
    status: errors.length > 0 ? 'blocked' : 'ok',
    diagnostics: canonicalDiagnostics,
    errors,
    warnings,
    pinTable,
    mappingProjection: exportResult.mappingProjection,
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
  requiredPorts: Map<string, RequiredPortDescriptor>,
  mappingProjection: Basys3SemanticMappingProjection[],
): ExportPinTableRow[] {
  const rows = new Map<string, ExportPinTableRow>();
  const liveIoNodeLabels = buildLiveIoNodeLabelIndex(project);
  const projectionById = new Map(
    mappingProjection.map((projection) => [projection.logicalSignalId, projection]),
  );

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
    const projection = projectionById.get(entry.id);
    const required = projection?.required ?? requiredPorts.has(portKey);
    const suggestedPin = suggestPin(portName, direction);
    const projectionFields = projection
      ? {
          logicalSignalId: projection.logicalSignalId,
          logicalLabel: projection.logicalLabel,
          artifactPortName: projection.artifactPortName,
          boardResourceId: projection.boardResourceId,
          boardResourceLabel: projection.boardResourceLabel,
          packagePin: projection.packagePin,
          ioStandard: projection.ioStandard,
          exactXdcLine: projection.exactXdcLine,
          conflictState: projection.conflictState,
        }
      : {};

    if (!existing) {
      rows.set(portKey, {
        port: portName,
        rowId: entry.id,
        direction,
        pin,
        required,
        status: pin ? 'mapped' : 'missing',
        notes: projection
          ? `${projection.logicalLabel} -> ${projection.artifactPortName} -> ${projection.boardResourceLabel ?? 'unassigned'}`
          : entry.label
            ? `Signal label: ${entry.label}`
            : undefined,
        suggestedPin,
        ...projectionFields,
      });
      return;
    }

    const shouldAdoptProjection = Boolean(pin) || !existing.logicalSignalId;
    existing.required = existing.required || required;
    existing.pin = existing.pin || pin;
    existing.direction = mergeDirection(existing.direction, direction);
    existing.suggestedPin = existing.suggestedPin || suggestedPin;
    if (shouldAdoptProjection) {
      Object.assign(existing, projectionFields);
    }
  };

  const ioMapping = getEffectiveIoMapping(project);
  for (const entry of ioMapping?.inputs ?? []) {
    appendMapping('in', entry);
  }
  for (const entry of ioMapping?.outputs ?? []) {
    appendMapping('out', entry);
  }

  for (const requiredPort of requiredPorts.values()) {
    const portKey = normalizePort(requiredPort.name);
    const existing =
      rows.get(portKey) ??
      [...rows.values()].find(
        (row) =>
          Boolean(row.artifactPortName) &&
          normalizePort(row.artifactPortName ?? '') === portKey
      );
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
  topAuthority?: ExportTopAuthority,
  verifyAuthority?: ExportVerifyAuthority,
): ExportArtifactView[] {
  const artifacts: ExportArtifactView[] = [];
  const bundle = exportResult.bundle;
  const projectedProject = exportResult.projectProjection ?? project;
  const rbprojJson = encodeRBProject(projectedProject);
  const topEntity = resolveTopEntity(project);
  const companionPaths =
    bundle?.importedCompanionSources?.map((row) => row.exportPath).sort(compareCodepoint) ?? [];
  const vhdlSourcePaths: string[] = [...companionPaths, 'top.vhd'];
  const vivadoImportTcl = generateVivadoImportTcl({
    projectName: project.name,
    topEntity,
    part: project.fpga?.part,
    sourcePaths: vhdlSourcePaths,
    constraintsPath: 'top.xdc',
    simulationPath: 'testbench.vhd',
  });
  const bringUpProject = verifyAuthority
    ? { ...projectedProject, vectors: verifyAuthority.executionVectors }
    : activeScenario
      ? { ...projectedProject, vectors: materializeScenarioVectors(activeScenario) }
      : projectedProject;
  const currentRuntimeVerifyRun = verifyAuthority?.currentRuntimeVerifyRun;
  const exportClockPolicy = verifyAuthority?.clockPolicy;
  const bringUpArtifacts = buildBringUpArtifacts({
    project: bringUpProject,
    ioRows: collectBringUpIoRows(projectedProject, exportResult.mappingProjection),
    expectedBehavior:
      project.description?.trim() || 'Outputs should reflect deterministic bring-up vectors.',
    exportHash: exportResult.determinismHash,
    verifyHash: currentRuntimeVerifyRun?.deterministicHash,
    verifyReportHash: currentRuntimeVerifyRun?.reportHash,
    verifyGeneratedAtIso: currentRuntimeVerifyRun?.generatedAtIso,
    verifyRows: currentRuntimeVerifyRun?.report.rows,
    clockPolicy: exportClockPolicy,
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
      note:
        project.hierarchy?.modules.length
          ? `Structural top-level VHDL with ${project.hierarchy.modules.length} reusable project module source${project.hierarchy.modules.length === 1 ? '' : 's'}. designTop=${topAuthority?.designTop ?? resolveTopEntity(project)}.`
          : bundle.exportMode === 'preserved-import-rtl'
          ? `Preserved imported top-level VHDL (multi-file handoff). designTop=${topAuthority?.designTop ?? resolveTopEntity(project)}.`
          : `Synthesizable top-level VHDL. designTop=${topAuthority?.designTop ?? resolveTopEntity(project)}.`,
    });
    for (const companion of bundle.importedCompanionSources ?? []) {
      const companionHeader = buildProvenanceHeader('--', provenanceBase);
      artifacts.push({
        path: companion.exportPath,
        kind: 'vhd',
        category: 'design-source',
        content: normalizeArtifactContent(companionHeader + companion.content),
        preview: buildPreview(companion.content),
        status: blocked ? 'blocked' : 'ready',
        note: project.hierarchy?.modules.some((module) => companion.content.includes(`entity ${module.name} is`))
          ? 'Editable native visual module source.'
          : 'Preserved imported companion VHDL (package / subsystem).',
      });
    }
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

/** The only clock behavior permitted across the export-to-HDL boundary. */
type ExportClockDriveView = Readonly<TestbenchClockDriveView>;

interface ExportVerifyAuthority {
  vectors: TestVector[];
  executionVectors: TestVector[];
  clockPolicy?: VerifyClockPolicy;
  runtimeEvidenceCurrent: boolean;
  currentRuntimeVerifyRun?: RuntimeVerifyRun;
}

/**
 * Scenario execution firewall for generated simulation-source content.
 * Only clock drive mode and signal identity cross this boundary; scenario
 * status, waveform, compare rows, and reports remain presentation-only.
 */
function extractExportClockDriveView(
  policy: VerifyClockPolicy | undefined
): ExportClockDriveView | undefined {
  if (!policy) return undefined;
  const signalId = policy.signalId?.trim() || undefined;
  const signalLabel = policy.signalLabel?.trim() || undefined;
  return Object.freeze({
    mode: policy.overrideMode === 'auto' ? 'auto' : 'authored',
    signalId,
    signalLabel,
    startLevel: policy.startLevel === 1 ? 1 : 0,
  }) as ExportClockDriveView;
}

function getExportVectors(
  project: RBProject,
  activeScenario: VerifyScenario | undefined,
): TestVector[] {
  return activeScenario
    ? materializeScenarioVectors(activeScenario)
    : (project.vectors ?? []).map((vector) => ({
        ...vector,
        inputs: { ...(vector.inputs ?? {}) },
        expected: { ...(vector.expected ?? {}) },
      }));
}

function getProjectCircuitHash(project: RBProject): string {
  // Runtime Verify hashes the live, unflattened circuit. Export must compare
  // against that same authority before macro flattening changes its shape.
  return buildVerifyCircuitEvidenceHash(project.circuit);
}

function canonicalizeScheduleEvidence(contract: VerifyScheduleContract) {
  return {
    schedule: contract.schedule,
    timingMode: contract.timingMode ?? null,
    reason: contract.reason,
    analysis: {
      hasClockedMacros: contract.analysis.hasClockedMacros,
      hasClockNet: contract.analysis.hasClockNet,
      sequentialNodes: [...contract.analysis.sequentialNodes]
        .map((node) => ({
          id: node.id,
          type: node.type,
          clockPort: node.clockPort ?? null,
        }))
        .sort((left, right) => {
          const leftKey = [left.id, left.type, left.clockPort ?? ''].join('\u0000');
          const rightKey = [right.id, right.type, right.clockPort ?? ''].join('\u0000');
          if (leftKey < rightKey) return -1;
          if (leftKey > rightKey) return 1;
          return 0;
        }),
      clockSource: contract.analysis.clockSource ?? null,
      clockNetName: contract.analysis.clockNetName?.trim() || null,
    },
    needsSimClockInjection: contract.needsSimClockInjection,
    clockSignalName: contract.clockSignalName?.trim() || null,
    samplePoint: contract.samplePoint,
    tick0Meaning: contract.tick0Meaning,
    resetHint: contract.resetHint
      ? {
          signalName: contract.resetHint.signalName.trim(),
          activeLevel: contract.resetHint.activeLevel,
        }
      : null,
    hasUnsupportedTemporal: contract.hasUnsupportedTemporal,
    temporalIssues: [...contract.temporalIssues]
      .map((issue) => ({ code: issue.code, message: issue.message }))
      .sort((left, right) => {
        const leftKey = `${left.code}\u0000${left.message}`;
        const rightKey = `${right.code}\u0000${right.message}`;
        if (leftKey < rightKey) return -1;
        if (leftKey > rightKey) return 1;
        return 0;
      }),
  };
}

function canonicalizeExecutionPlanVectors(
  vectors: readonly Pick<TestVector, 'tick' | 'inputs' | 'expected'>[]
) {
  return vectors
    .map((vector, index) => ({
      tick: Number.isFinite(Number(vector.tick))
        ? Math.max(0, Math.floor(Number(vector.tick)))
        : index,
      inputs: Object.fromEntries(
        Object.keys(vector.inputs ?? {})
          .sort(compareCodepoint)
          .map((key) => [
            key,
            vector.inputs?.[key] === true ||
            vector.inputs?.[key] === 1 ||
            vector.inputs?.[key] === '1'
              ? 1
              : 0,
          ])
      ),
      expected: Object.fromEntries(
        Object.keys(vector.expected ?? {})
          .sort(compareCodepoint)
          .map((key) => [
            key,
            vector.expected?.[key] === true ||
            vector.expected?.[key] === 1 ||
            vector.expected?.[key] === '1'
              ? 1
              : 0,
          ])
      ),
      caseIndex: index,
    }))
    .sort((left, right) =>
      left.tick === right.tick ? left.caseIndex - right.caseIndex : left.tick - right.tick
    )
    .map(({ caseIndex: _caseIndex, ...vector }) => vector);
}

function isRuntimeScheduleCurrentForExport(
  project: RBProject,
  runtimeVerifyRun: RuntimeVerifyRun,
  clockPolicy: VerifyClockPolicy | undefined,
  vectors: readonly TestVector[]
): boolean {
  const currentSchedule = deriveVerifySchedule(
    project.circuit,
    getEffectiveIoMapping(project),
    project.hdl
  );
  if (runtimeVerifyRun.schedule !== currentSchedule.schedule) return false;
  if (!runtimeVerifyRun.scheduleContract) return false;
  if (
    stableSerialize(canonicalizeScheduleEvidence(runtimeVerifyRun.scheduleContract)) !==
    stableSerialize(canonicalizeScheduleEvidence(currentSchedule))
  ) {
    return false;
  }
  const expectedMeta = {
    circuitKind: currentSchedule.schedule === 'clocked_macro' ? 'sequential' : 'combinational',
    clockingProtocol: currentSchedule.schedule === 'clocked_macro' ? 'clocked_macro' : null,
    samplePoint: currentSchedule.samplePoint,
    tick0Meaning: resolveVerifyTick0Meaning({
      structuralTick0Meaning: currentSchedule.tick0Meaning,
      vectors,
      ioRows: getProjectClockIoRows(project),
      policy: clockPolicy,
    }),
    clockSignalName: currentSchedule.clockSignalName ?? null,
  };
  return stableSerialize(runtimeVerifyRun.meta) === stableSerialize(expectedMeta);
}

function isRuntimeRunCurrentForExport(
  project: RBProject,
  runtimeVerifyRun: RuntimeVerifyRun | undefined,
  activeScenario: VerifyScenario | undefined,
  vectors: readonly TestVector[],
  executionVectors: readonly TestVector[],
  clockPolicy: VerifyClockPolicy | undefined,
): boolean {
  if (!runtimeVerifyRun) return false;
  // Observe/trace runs are useful diagnostic evidence, but they never prove
  // expected-output agreement and therefore cannot authorize Export evidence.
  if (getRuntimeVerifyRunKind(runtimeVerifyRun) !== 'verify') return false;
  // The compatibility path has no scenario content/version authority. Its
  // stimulus hash intentionally excludes expected outputs, so even an exact
  // input hash cannot prove that report rows or assertion masks are current.
  // Generate from project.vectors, but never inject runtime evidence there.
  if (!activeScenario) return false;
  const normalizedVectors = normalizeVectorsForLiveIo(
    vectors.map((vector) => ({
      ...vector,
      inputs: { ...(vector.inputs ?? {}) },
      expected: { ...(vector.expected ?? {}) },
    })),
    getProjectClockIoRows(project),
    clockPolicy
  );
  if (!isRuntimeScheduleCurrentForExport(project, runtimeVerifyRun, clockPolicy, normalizedVectors)) {
    return false;
  }
  if (activeScenario) {
    if (runtimeVerifyRun.scenarioId !== activeScenario.id) return false;
    if (
      typeof runtimeVerifyRun.scenarioContentHash !== 'string' ||
      runtimeVerifyRun.scenarioContentHash !== computeScenarioContentHash(activeScenario)
    ) {
      return false;
    }
  }
  if (
    typeof runtimeVerifyRun.scenarioStimulusHash !== 'string' ||
    runtimeVerifyRun.scenarioStimulusHash !== computeExecutionStimulusHash(normalizedVectors, clockPolicy)
  ) {
    return false;
  }
  if (
    stableSerialize(canonicalizeExecutionPlanVectors(runtimeVerifyRun.report.vectors)) !==
    stableSerialize(canonicalizeExecutionPlanVectors(executionVectors))
  ) {
    return false;
  }
  if (
    typeof runtimeVerifyRun.mappingEvidenceHash !== 'string' ||
    runtimeVerifyRun.mappingEvidenceHash !== buildVerifyMappingEvidenceHash(getEffectiveIoMapping(project))
  ) {
    return false;
  }
  return (
    typeof runtimeVerifyRun.evidence?.circuitHash === 'string' &&
    runtimeVerifyRun.evidence.circuitHash === getProjectCircuitHash(project)
  );
}

function getProjectClockIoRows(project: RBProject): ProjectIoRow[] {
  const ioMapping = getEffectiveIoMapping(project);
  return [
    ...(ioMapping?.inputs ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: 'in' as const,
      pin: row.pin ?? '',
      nodeId: row.nodeId ?? row.id,
      port: 'out',
      required: true,
    })),
    ...(ioMapping?.outputs ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: 'out' as const,
      pin: row.pin ?? '',
      nodeId: row.nodeId ?? row.id,
      port: 'in',
      required: true,
    })),
  ];
}

function detectProjectClockPolicy(project: RBProject): VerifyClockPolicy | null {
  const ioMapping = getEffectiveIoMapping(project);
  return detectVerifyClockPolicy({
    circuit: project.circuit,
    ioRows: getProjectClockIoRows(project),
    scheduleContract: deriveVerifySchedule(project.circuit, ioMapping, project.hdl),
  });
}

function resolveExportClockPolicy(
  project: RBProject,
  runtimeVerifyRun: RuntimeVerifyRun | undefined,
  activeScenario: VerifyScenario | undefined,
  vectors: readonly TestVector[],
): VerifyClockPolicy | undefined {
  const currentSchedule = deriveVerifySchedule(
    project.circuit,
    getEffectiveIoMapping(project),
    project.hdl
  );
  if (currentSchedule.schedule !== 'clocked_macro') return undefined;
  const savedPolicy = normalizeScenarioSequentialPolicy(activeScenario?.sequentialPolicy);
  const detectedPolicy = detectProjectClockPolicy(project);
  const selectedPolicy = resolveEffectiveVerifyClockPolicy({
    savedPolicy,
    detectedPolicy,
    overrideMode: savedPolicy?.overrideMode ?? detectedPolicy?.overrideMode ?? 'manual-pulses',
    requestedRunCycles: savedPolicy?.runCycles ?? detectedPolicy?.runCycles ?? 1,
    totalVectorCount: vectors.length,
  });
  const normalizedSelectedPolicy = normalizeScenarioSequentialPolicy(selectedPolicy);
  if (selectedPolicy && normalizedSelectedPolicy) return selectedPolicy;

  // A legacy project may have no saved or detectable policy. In that narrow
  // case, accept the run policy only when it proves its own exact stimulus and
  // circuit authority; a stale run must never manufacture export behavior.
  const runtimePolicy = runtimeVerifyRun?.clockPolicy;
  const normalizedRuntimePolicy = normalizeScenarioSequentialPolicy(runtimePolicy);
  const effectiveRuntimePolicy =
    runtimePolicy && normalizedRuntimePolicy
      ? {
          ...runtimePolicy,
          runCycles: Math.max(1, vectors.length, runtimePolicy.runCycles),
        }
      : undefined;
  if (
    effectiveRuntimePolicy &&
    isRuntimeRunCurrentForExport(
      project,
      runtimeVerifyRun,
      activeScenario,
      vectors,
      materializeVectorsForClockPolicy({
        vectors: normalizeVectorsForLiveIo(
          vectors.map((vector) => ({
            ...vector,
            inputs: { ...(vector.inputs ?? {}) },
            expected: { ...(vector.expected ?? {}) },
          })),
          getProjectClockIoRows(project),
          effectiveRuntimePolicy
        ),
        ioRows: getProjectClockIoRows(project),
        policy: effectiveRuntimePolicy,
      }),
      effectiveRuntimePolicy,
    )
  ) {
    return effectiveRuntimePolicy;
  }
  return undefined;
}

function buildExportVerifyAuthority(
  project: RBProject,
  runtimeVerifyRun: RuntimeVerifyRun | undefined,
  activeScenario: VerifyScenario | undefined,
): ExportVerifyAuthority {
  const vectors = getExportVectors(project, activeScenario);
  const clockPolicy = resolveExportClockPolicy(project, runtimeVerifyRun, activeScenario, vectors);
  const normalizedVectors = normalizeVectorsForLiveIo(
    vectors.map((vector) => ({
      ...vector,
      inputs: { ...(vector.inputs ?? {}) },
      expected: { ...(vector.expected ?? {}) },
    })),
    getProjectClockIoRows(project),
    clockPolicy
  );
  const executionVectors = materializeVectorsForClockPolicy({
    vectors: normalizedVectors,
    ioRows: getProjectClockIoRows(project),
    policy: clockPolicy,
  });
  const runtimeEvidenceCurrent = isRuntimeRunCurrentForExport(
    project,
    runtimeVerifyRun,
    activeScenario,
    vectors,
    executionVectors,
    clockPolicy,
  );
  return {
    vectors,
    executionVectors,
    clockPolicy,
    runtimeEvidenceCurrent,
    currentRuntimeVerifyRun: runtimeEvidenceCurrent ? runtimeVerifyRun : undefined,
  };
}

/**
 * Pure testbench VHDL content generator — the canonical gate for HDL content authority.
 *
 * Inputs are structurally limited to:
 *   - project (RBProject) — top-entity name, port list
 *   - vectors (TestVector[]) — scenario vectors or compat project.vectors
 *   - clockDriveView (ExportClockDriveView | undefined) — current scenario clock policy
 *
 * This function must NEVER receive RuntimeVerifyRun, waveform snapshots, compare
 * results, report rows, or any derived verify state. Those exist only in buildTestbenchNote.
 *
 * AUDIT RULE: If the signature of this function gains a RuntimeVerifyRun parameter,
 * or any field from RuntimeVerifyRun — that is a bug. The type system catches
 * direct RuntimeVerifyRun passing; the firewall comment
 * catches structural cheats (e.g. manually spreading run fields here).
 */
function generateTestbenchContent(
  project: RBProject,
  vectors: TestVector[],
  clockDriveView: ExportClockDriveView | undefined,
): string {
  return generateTestbenchVhdl(project, vectors, {
    clockDrive: clockDriveView,
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
  clockNote: string,
  runtimeEvidenceCurrent: boolean,
): string {
  const runKind = getRuntimeVerifyRunKind(runtimeVerifyRun);
  if (activeScenario) {
    const contentHash = computeScenarioContentHash(activeScenario);
    const runStatus = runtimeVerifyRun?.status ?? null;
    if (runtimeVerifyRun && !runtimeEvidenceCurrent) {
      return (
        `STALE — scenario '${activeScenario.name}' v${activeScenario.version}, its execution policy, ` +
        `vectors, or the circuit changed since the last Verify run. Export uses current project authority; ` +
        `re-run Verify to confirm alignment.`
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
  if (runtimeVerifyRun && !runtimeEvidenceCurrent) {
    return (
      'STALE — project vectors, execution policy, or circuit changed since the last Verify run. ' +
      'Export uses current project authority; re-run Verify to confirm alignment.'
    );
  }
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
  activeScenario: VerifyScenario | undefined,
  verifyAuthority: ExportVerifyAuthority,
): { content: string; note: string } | undefined {
  // Vector source authority:
  //   1. materialized active scenario vectors — PRIMARY (steps expand before generation)
  //   2. project.vectors — COMPAT FALLBACK (when no scenario is present)
  const vectors = verifyAuthority.executionVectors;
  if (!vectors || vectors.length === 0) return undefined;

  // Scenario-less compatibility exports use this same current execution plan.
  // Run presence can change the note, but never the generated VHDL bytes.

  // ── EXPORT AUTHORITY FIREWALL ────────────────────────────────────────────────
  // Generated VHDL receives only the current project/scenario execution plan
  // and a frozen clock-drive view. Runtime evidence can annotate the note only.
  const currentRuntimeVerifyRun = verifyAuthority.currentRuntimeVerifyRun;
  const clockDriveView = extractExportClockDriveView(verifyAuthority.clockPolicy);

  const content = generateTestbenchContent(
    project,
    vectors,
    clockDriveView,
  );
  // ────────────────────────────────────────────────────────────────────────────

  // ── NOTE ZONE (UI metadata only — may read any RuntimeVerifyRun field) ───────
  // Everything below this line is note-string generation. It may freely read
  // runtimeVerifyRun.status, .schedule, .scenarioContentHash, etc.
  // None of these reads affect VHDL artifact content.
  const clockNote =
    currentRuntimeVerifyRun?.meta.clockSignalName
      ? `, clock=${currentRuntimeVerifyRun.meta.clockSignalName}`
      : '';
  const note = buildTestbenchNote(
    activeScenario,
    runtimeVerifyRun,
    clockNote,
    verifyAuthority.runtimeEvidenceCurrent,
  );
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
  runtimeVerifyRun: RuntimeVerifyRun | undefined,
  runtimeEvidenceCurrent: boolean,
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
  return {
    id: activeScenario.id,
    name: activeScenario.name,
    version: activeScenario.version,
    contentHash,
    isStaleComparedToLastPass: !runtimeEvidenceCurrent,
  };
}

function resolveTopEntity(project: RBProject): string {
  const top =
    (project.hdl?.top ?? project.fpga?.top ?? '')
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_');
  return top.length > 0 ? top : 'top';
}

function collectBringUpIoRows(
  project: RBProject,
  mappingProjection: Basys3SemanticMappingProjection[] = [],
): BringUpIoRow[] {
  const rows: BringUpIoRow[] = [];
  const ioMapping = getEffectiveIoMapping(project);

  if (mappingProjection.length > 0) {
    const mappingById = new Map(
      [...(ioMapping?.inputs ?? []), ...(ioMapping?.outputs ?? [])]
        .map((entry) => [entry.id, entry] as const),
    );
    return mappingProjection.map((projection) => {
      const source = mappingById.get(projection.logicalSignalId);
      const resource = getBasys3BoardResource(projection.packagePin ?? undefined);
      return {
        id: projection.logicalSignalId,
        nodeId: source?.nodeId,
        label: projection.logicalLabel,
        port: source?.port,
        direction: projection.direction,
        pin: resource?.alias ?? source?.pin ?? projection.packagePin ?? '',
        packagePin: projection.packagePin ?? '',
        artifactPortName: projection.artifactPortName,
        boardResourceId: projection.boardResourceId,
        boardResourceLabel: projection.boardResourceLabel,
        exactXdcLine: projection.exactXdcLine,
        required: projection.required,
      };
    });
  }

  for (const input of ioMapping?.inputs ?? []) {
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

  for (const output of ioMapping?.outputs ?? []) {
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

  const ioMapping = getEffectiveIoMapping(project);
  for (const input of ioMapping?.inputs ?? []) {
    upsert(input);
  }
  for (const output of ioMapping?.outputs ?? []) {
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
  const direct = message.match(/node\s+["']([^"']+)["']/i);
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
  if (
    lowered.includes('floating output detected') ||
    lowered.includes('undriven output') ||
    (lowered.includes('output port') && lowered.includes('has no driver')) ||
    (lowered.includes('output') && lowered.includes('is not driven'))
  ) {
    return 'RBEX4103';
  }
  if (lowered.includes('missing a clock input') || lowered.includes('no clock signal bound')) return 'RBEX4200';
  if (lowered.includes('multiple clock domains detected')) return 'RBEX4201';
  if (lowered.includes('multiple clock drivers')) return 'RBEX4202';
  if (lowered.includes('multiple reset drivers')) return 'RBEX4203';
  if (lowered.includes('unsupported reset polarity')) return 'RBEX4204';
  if (lowered.includes('sim clock components are import-only')) return 'RBEX4206';
  if (
    lowered.includes('unsupported timing directive "create_generated_clock"') ||
    lowered.includes('unsupported timing directive "derive_pll_clocks"') ||
    lowered.includes('unsupported timing directive "derive_clocks"') ||
    lowered.includes('unsupported timing directive "set_clock_groups"')
  ) {
    return 'RBEX4205';
  }
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
  if (code === 'RBEX4205') return 'Unsupported derived-clock constraint';
  if (code === 'RBEX4206') return 'Import-only sim Clock';
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
  if (
    normalized === 'clk' ||
    normalized === 'clock' ||
    normalized === 'clk100mhz' ||
    normalized.endsWith('clk') ||
    normalized.includes('clock')
  ) {
    return 'CLK100MHZ';
  }
  if (
    normalized === 'rst' ||
    normalized.endsWith('rst') ||
    normalized.includes('reset')
  ) {
    return 'BTNC';
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
