import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Circuit, CompositeNodeDef, Node, SimulationModel } from '@redbyte/rb-logic-core';
import { buildSimulationModel, elaborateCircuit, registerCompositeNode } from '@redbyte/rb-logic-core';
import { BusValidationError, createBusBoundary } from '@redbyte/rb-logic-core';
import type { HardwareMappingDocumentV2, IoMapping, TestVector } from '@redbyte/rb-utils';
import {
  applyMaterializedPinToHardwareMappingV2,
  migrateIoMappingToHardwareMappingV2,
  normalizeBoardRowId,
  resolveIoMappingFromProjectFields,
} from '@redbyte/rb-utils';
import type { CustomTestVector } from './components/VectorEditor';
import {
  buildCurrentVerifyProjectHash,
  buildVerifyCircuitEvidenceHash,
  buildVerifyMappingEvidenceHash,
} from './verifyProjectHash';
import { deriveSourceModel, normalizeRBProject, type RBProject } from '../../export/projectFormat';
import {
  createEmptyProjectSourceModel,
  normalizeProjectSourceModel,
  type ProjectSourceModel,
} from './projectSourceModel';
import type { ProviderWaveform } from './simulationProvider';
import {
  DEFAULT_VCD_ANALYZER_CONFIG,
  normalizeVcdAnalyzerConfig,
  type VcdAnalyzerConfig,
} from './vcdAnalyzer';
import {
  addConstraintSet as addConstraintSetToDoc,
  createEmptyConstraintSets,
  normalizeConstraintSets,
  removeConstraintSet as removeConstraintSetFromDoc,
  renameConstraintSet as renameConstraintSetInDoc,
  setActiveConstraintSet as setActiveConstraintSetInDoc,
  type ConstraintSetsDocument,
} from './constraintSets';
import { stableSerialize } from '../../utils/stableSerialize';
import {
  buildDeterministicVerifyContext,
  type VerifyScheduleContract,
} from '../../fpga/boards/basys3/verifySchedule';
import { digestValue } from '../../utils/digest';
import { normalizeCircuit } from '../../recording/runRecordUtils';
import {
  deleteMacro as deleteMacroFromLibrary,
  instantiateMacroIntoCircuit,
  saveMacro as saveMacroToLibrary,
  updateMacro as updateMacroInLibrary,
  type MacroDefinition,
  type MacroInstantiationResult,
  type SaveMacroInput,
} from './macros/MacroLibrary';
import {
  IDE_DEFAULT_EXAMPLE_ID,
  IDE_EXAMPLES,
  getIdeExampleById,
  type IdeExampleDefinition,
  type IdeExampleIoRow,
} from './examplesCatalog';
import { defaultNodeConfig } from './defaultNodeConfig';
import {
  buildHardwareMappingV2FromProjectIoRows,
  applyScalarResourceMetadata,
  cloneHardwareMappingDocumentV2,
  enrichProjectIoRowsWithV2Metadata,
  materializedIoRowsFromHardwareMappingV2,
  synchronizeScalarHardwareMappingV2WithProjectIoRows,
  toIoMappingFromProjectIoRows,
  upsertScalarMappingEntry,
} from './hardwareMappingBridge';
import type {
  ProjectHealthCore,
  ProjectHealthExportResult,
  ProjectHealthExportSourceState,
  ProjectHealthVerifyResult,
  VerifyRunKind,
} from './projectHealth';
import {
  buildVerifyReport,
  type VerifyEvidenceCapsule,
  type VerifyReport,
  type VerifyReportVector,
  type VerifyWaveSample,
} from './verifyReport';
import { deriveIoSignalRoles } from './ioSignalRoles';
import { buildTopEntityName, normalizeTopEntityName, resolveActiveTopEntity } from './topEntity';
import { generateBringUpVectors, generateStimulusVectors } from './bringupArtifacts';
import { normalizeGuidedLabTaskId } from './labTaskDefinition';
import {
  buildBlockedRuntimeSnapshotFromModel,
  DEFAULT_SIM_SPEED_HZ,
  advanceSimulationStateFromModel,
  recomputeSimulationStateFromModel,
  resetSimulationStateFromModel,
  runDeterministicVerifyFromModel,
  toRuntimeSimGuard,
  type SimEngineResult,
} from './sim/simEngine';
import type { RuntimeLogicValue, RuntimeSignalProbe, RuntimeSimState, RuntimeSimTraceSample } from './sim/simTypes';
import { buildCanonicalVerifyWaveSamples } from './sim/traceContract';
import {
  DEFAULT_SCENARIO_ID,
  createScenario,
  createDefaultScenario,
  cloneScenarioSequentialPolicy,
  computeExecutionStimulusHash,
  computeScenarioContentHash,
  getActiveScenario,
  materializeScenarioVectors,
  migrateProjectVectorsToScenario,
  normalizeScenarioProbes,
  normalizeScenarioSequentialPolicy,
  repairScenarioLibrary,
  stampScenario,
  toggleScenarioProbe,
  type VerifyScenario,
  type VerifyScenarioProbe,
  type VerifyScenarioSequentialPolicy,
} from './verifyScenario';
import {
  createScenarioStep,
  deriveScenarioStepsFromVectors,
  normalizeScenarioSteps,
  type ScenarioStepDraft,
  type VerifyScenarioStep,
} from './verifyScenarioSteps';
import {
  applyHardwareMappingV2Edit,
  type HardwareMappingV2EditOperation,
} from './hardwareMappingV2EditorModel';
import { exportProjectAsBasys3 } from '../../fpga/boards/basys3/basys3ExportService';
import { canonicalizeSemanticCircuit } from '../../circuit/semanticCircuit';
import { flattenProjectMacros } from './macros/macroFlattener';
import {
  deriveScenarioAuthority,
  normalizeProjectKind,
  normalizeScenarioAuthority,
  stripExpectedOutputs,
  type ProjectKind,
  type ScenarioAuthority,
} from './projectIdentity';
import {
  cloneImportMeta,
  normalizePersistedImportMeta,
  type IdeImportMeta,
} from './projectImportMeta';
import {
  detectVerifyClockPolicy,
  materializeVectorsForClockPolicy,
  resolveVerifyTick0Meaning,
  type VerifyClockPolicy,
} from './verifyClockPolicy';
import {
  TOP_MODULE_ID,
  createEmptyProjectHierarchy,
  createModuleFromSelection as createNativeModuleFromSelection,
  elaborateProjectHierarchy,
  hierarchyCycleModules,
  moduleUsageCount,
  normalizeProjectHierarchy,
  placeModuleInstance as placeNativeModuleInstance,
  readInstanceName,
  rederiveModulePortRefs,
  toCompositeDefinition,
  type CreateModuleInput,
  type CreateModuleResult,
  type ProjectHierarchyDocument,
} from './projectHierarchy';

export type { IdeImportMeta } from './projectImportMeta';

export type { RuntimeSignalProbe, RuntimeSimState, RuntimeSimTraceSample } from './sim/simTypes';

const STORAGE_KEY = 'rb.ide.project-runtime.v1';
const DEFAULT_MAX_DESIGN_HISTORY = 100;
const MAX_ALLOWED_DESIGN_HISTORY = 500;

const DEFAULT_EXAMPLE = getIdeExampleById(IDE_DEFAULT_EXAMPLE_ID) ?? IDE_EXAMPLES[0];

const EMPTY_HARDWARE_MAPPING_V2: HardwareMappingDocumentV2 = {
  schemaVersion: '2.0',
  boardId: 'basys3',
  entries: [],
};

function pickHardwareMappingV2FromProject(project: RBProject): HardwareMappingDocumentV2 {
  const v = project.hardwareMappingV2;
  if (v && Array.isArray(v.entries) && v.entries.length > 0) {
    return structuredClone(v);
  }
  return migrateIoMappingToHardwareMappingV2(project.ioMapping ?? { inputs: [], outputs: [] });
}

/** Flat view of V2 for the IDE, kept aligned with live boundary nodes via {@link synchronizeProjectIoRows}. */
function deriveProjectIoRowsFromCircuitAndV2(
  circuit: Circuit,
  doc: HardwareMappingDocumentV2
): ProjectIoRow[] {
  const baseRows = materializedIoRowsFromHardwareMappingV2(doc);
  return synchronizeProjectIoRows(circuit, baseRows);
}

function deriveAuthoritativeHardwareState(
  circuit: Circuit,
  doc: HardwareMappingDocumentV2
): { hardwareMappingV2: HardwareMappingDocumentV2; projectIoRows: ProjectIoRow[] } {
  const candidateRows = deriveProjectIoRowsFromCircuitAndV2(circuit, doc);
  const hardwareMappingV2 = synchronizeScalarHardwareMappingV2WithProjectIoRows(doc, candidateRows);
  return {
    hardwareMappingV2,
    projectIoRows: deriveProjectIoRowsFromCircuitAndV2(circuit, hardwareMappingV2),
  };
}

export type ProjectIoRow = IdeExampleIoRow;

export interface VerifyRunLedgerEntry {
  runId: string;
  /** Which scenario ran and how (observe = 'trace', compare = 'verify'); older ledgers lack these. */
  scenarioId?: string;
  scenarioName?: string;
  runKind?: 'trace' | 'verify';
  tickCount?: number;
  failedSignals?: string[];
  ranAtIso: string;
  status: 'pass' | 'fail';
  passedRows: number;
  failedRows: number;
  firstFailure: {
    tick: number;
    signal: string;
    expected: string;
    actual: string;
  } | null;
  circuitHash: string;
  vectorsHash: string;
  mappingHash: string;
  projectHash: string;
  didCircuitChangeSinceLast: boolean;
  didVectorsChangeSinceLast: boolean;
  didMappingChangeSinceLast: boolean;
}

export interface VerifyRunMeta {
  circuitKind: 'sequential' | 'combinational';
  clockingProtocol: 'clocked_macro' | null;
  samplePoint: 'post-rising-edge' | 'steady-state' | null;
  tick0Meaning: 'reset-phase' | 'initial-state' | null;
  clockSignalName: string | null;
}

export interface RuntimeVerifyRun {
  scenarioId: string;
  scenarioName: string;
  runKind?: VerifyRunKind;
  scenarioVersion?: number;
  scenarioContentHash?: string;
  scenarioStimulusHash?: string;
  /** Exact effective IO/pin mapping used by this run. Legacy runs omit it and are stale for Export. */
  mappingEvidenceHash?: string;
  status: 'pass' | 'fail';
  /** Whether the deterministic simulation itself completed. Independent from checks. */
  simulationStatus?: 'complete' | 'blocked';
  /** Outcome of optional expected-output checks. A trace-only run has no configured checks. */
  assertionStatus?: 'not-configured' | 'passing' | 'failing' | 'not-evaluated';
  /** Set when status is 'pass' but the result has a known limitation.
   *  'incomplete-mapping': some output IO rows have no FPGA pin assigned.
   *  The logic is correct, but hardware tests may fail until mapping is complete. */
  qualification?: 'incomplete-mapping';
  deterministicHash: string;
  reportHash: string;
  firstFailingTick?: number;
  generatedAtIso: string;
  schedule: 'combinational' | 'clocked_macro';
  scheduleContract?: VerifyScheduleContract;
  clockPolicy?: VerifyClockPolicy;
  meta: VerifyRunMeta;
  report: VerifyReport;
  waveform: VerifyWaveSample[];
  traceWaveform?: VerifyWaveSample[];
  evidence?: VerifyEvidenceCapsule;
}

/**
 * Returns 'incomplete-mapping' when a passing run has at least one output IO row
 * with no FPGA pin assigned, indicating the result cannot be fully trusted for hardware.
 * Returns undefined for fail runs or when all output rows are pinned.
 */
export function detectIncompleteMappingQualification(
  ioRows: ProjectIoRow[],
  status: 'pass' | 'fail'
): 'incomplete-mapping' | undefined {
  if (status !== 'pass') return undefined;
  const hasUnmappedOutput = ioRows.some(
    (row) => row.direction === 'out' && (!row.pin || row.pin.trim() === '')
  );
  return hasUnmappedOutput ? 'incomplete-mapping' : undefined;
}

export function getRuntimeVerifyRunKind(
  run: Pick<RuntimeVerifyRun, 'runKind' | 'report'> | undefined | null
): VerifyRunKind | undefined {
  if (!run) return undefined;
  if (run.runKind === 'trace' || run.runKind === 'verify') return run.runKind;
  return run.report.rows.length > 0 ? 'verify' : 'trace';
}

export interface RunVerificationInput {
  scenarioId: string;
  scenarioName: string;
  runKind?: VerifyRunKind;
  scenarioVersion?: number;
  scenarioContentHash?: string;
  scenarioStimulusHash?: string;
  deterministicHash: string;
  scheduleContract?: VerifyScheduleContract;
  vectors?: TestVector[];
  clockPolicy?: VerifyClockPolicy | null;
  assertionMode?: boolean;
  rows: Array<{
    tick: number;
    signal: string;
    expected: string;
    actual: string;
  }>;
  ranAtIso?: string;
  // Legacy no-op: authoritative verification always uses deterministic circuit evaluation.
  useRuntimeTrace?: boolean;
}

export interface ProjectRuntimeActions {
  verify: {
    run: (input: RunVerificationInput) => RuntimeVerifyRun;
    clear: () => void;
  };
  sim: {
    run: () => void;
    pause: () => void;
    step: () => void;
    runTicks: (ticks: number) => void;
    reset: () => void;
    setSpeed: (hz: number) => void;
    setInput: (nodeId: string, value: 0 | 1) => void;
    toggleInput: (nodeId: string) => void;
    setSelectedSignal: (signalKey: string | null) => void;
    toggleProbe: (probe: RuntimeSignalProbe) => void;
  };
}

export interface ProjectTestbenchSnapshot {
  scenarios?: VerifyScenario[];
  activeScenarioId?: string;
}

export interface ProjectRuntimeState {
  projectId: string;
  projectName: string;
  projectDescription: string;
  lastSavedAt: string;
  /**
   * The active HDL top-entity name. This store is its single writable owner;
   * surfaces project it (never hold their own copy). Set via {@link setActiveTop}.
   */
  activeTop: string;
  projectKind: ProjectKind;
  sourceExampleId: string | null;
  scenarioAuthority: ScenarioAuthority;
  /**
   * Provenance of the last import commit. Cleared for native/example/blank paths.
   * Persisted so the Project Bridge and other truth surfaces survive reload.
   */
  importMeta: IdeImportMeta | null;
  activeExampleId: string | null;
  activeLabTaskId: string | null;
  /** Canonical hardware mapping — Map Pins applies pins via V2 entries, not only flat rows. */
  hardwareMappingV2: HardwareMappingDocumentV2;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  scenarios: VerifyScenario[];
  activeScenarioId: string;
  customVectors: CustomTestVector[];
  circuit: Circuit;
  hierarchy: ProjectHierarchyDocument;
  /**
   * First-class source / fileset authority (HDL, constraints, scripts). This
   * store is its single writable owner. Populated on load from
   * {@link deriveSourceModel} (imported projects carry it via their `hdl`
   * sources) and persisted so sources survive reload. Set via {@link setSourceModel}.
   */
  sourceModel: ProjectSourceModel;
  designPast: DesignHistorySnapshot[];
  designFuture: DesignHistorySnapshot[];
  maxDesignHistory: number;
  designRevision: number;
  verifyLastRun?: RuntimeVerifyRun;
  verifyRunHistory: VerifyRunLedgerEntry[];
  /** Bounded, newest-last ledger of package generation/download events. */
  exportHistory: ProjectHealthExportResult[];
  sim: RuntimeSimState;
  /**
   * Imported external waveform (VCD) evidence for the Simulate Analyzer. This
   * store is its single writable owner. Null until a `.vcd` is imported. It is
   * *evidence generated outside RedByte* — never in-browser execution. Set via
   * {@link setImportedWaveform}.
   */
  importedWaveform: ProviderWaveform | null;
  /**
   * Analyzer view configuration for the imported waveform (pinned signals, radix,
   * cursor, filter). Persisted so the Analyzer restores across reloads. Patched
   * via {@link setVcdAnalyzerConfig}.
   */
  vcdAnalyzer: VcdAnalyzerConfig;
  /**
   * Named XDC constraint sets (Vivado constrs_N), with exactly one active. This
   * store is their single writable owner; persisted so they survive reload. CRUD
   * via {@link addConstraintSet} / {@link removeConstraintSet} /
   * {@link renameConstraintSet} / {@link setActiveConstraintSet}.
   */
  constraintSets: ConstraintSetsDocument;
  projectHealthCore: ProjectHealthCore;
  actions: ProjectRuntimeActions;
  loadExample: (exampleId: string) => void;
  loadFromProject: (project: RBProject, testbench?: ProjectTestbenchSnapshot) => void;
  setMappingPin: (rowId: string, pin: string) => void;
  setMappingPins: (updates: Record<string, string>) => void;
  applyHardwareMappingEdit: (operation: HardwareMappingV2EditOperation) => void;
  autoSuggestMapping: () => void;
  setVectors: (vectors: TestVector[]) => void;
  setCustomVectors: (vectors: CustomTestVector[]) => void;
  generateBringUpVectors: () => TestVector[];
  generateStimulusVectors: () => TestVector[];
  createScenario: () => void;
  duplicateScenario: () => void;
  renameScenario: (name: string) => void;
  deleteScenario: (scenarioId: string) => void;
  switchScenario: (scenarioId: string) => void;
  toggleScenarioProbe: (probe: VerifyScenarioProbe) => void;
  updateScenarioSequentialPolicy: (policy: VerifyScenarioSequentialPolicy) => void;
  appendScenarioStep: (draft: ScenarioStepDraft) => void;
  updateScenarioStep: (
    stepId: string,
    patch: Partial<Omit<VerifyScenarioStep, 'id' | 'order' | 'origin'>>
  ) => void;
  moveScenarioStep: (stepId: string, direction: 'up' | 'down') => void;
  deleteScenarioStep: (stepId: string) => void;
  applyCircuitMutation: (circuit: Circuit) => void;
  markDesignMutated: (circuit: Circuit) => void;
  undoProjectEdit: () => void;
  redoProjectEdit: () => void;
  addDesignNode: (nodeType: string, position: { x: number; y: number }) => void;
  addDesignIo: (direction: 'input' | 'output', position: { x: number; y: number }) => void;
  /**
   * Create a first-class bus boundary: one labeled member node per bit plus
   * the declaration that owns them, with an IO row per member so Board and
   * Simulate see the bits immediately. Returns the created bus id, or an
   * error message when the name/width is rejected.
   */
  createDesignBus: (input: {
    name: string;
    direction: 'input' | 'output';
    width: number;
    position?: { x: number; y: number };
  }) => { ok: true; busId: string } | { ok: false; error: string };
  addDesignBoardIo: (input: {
    alias: string;
    direction: 'in' | 'out';
    kind?: 'switch' | 'button' | 'clock' | 'reset' | 'led' | 'segment' | 'anode' | 'dp';
    position: { x: number; y: number };
  }) => void;
  connectDesignNodes: (connection: {
    fromNodeId: string;
    fromPort: string;
    toNodeId: string;
    toPort: string;
  }) => void;
  runVerification: (input: RunVerificationInput) => RuntimeVerifyRun;
  clearVerification: () => void;
  recordVerification: (result: ProjectHealthVerifyResult) => void;
  recordExport: (result: ProjectHealthExportResult) => void;
  setProjectIdentity: (input: {
    projectId?: string;
    projectName?: string;
    projectDescription?: string;
    projectKind?: ProjectKind;
    sourceExampleId?: string | null;
    scenarioAuthority?: ScenarioAuthority;
    activeExampleId?: string | null;
    markDirty?: boolean;
  }) => void;
  /**
   * Set the active HDL top-entity. Empty/whitespace resets to the name-derived
   * default. The candidate is normalized to a valid HDL identifier. Returns
   * whether the requested name was a usable identifier (empty → reset → ok).
   */
  setActiveTop: (name: string) => { ok: boolean; error?: string };
  /** Replace the source/fileset model. The store is its single writable owner. */
  setSourceModel: (model: ProjectSourceModel) => void;
  /**
   * Replace the imported waveform evidence (from a parsed VCD), or clear it with
   * null. Clears the Analyzer selection so the new waveform starts fresh.
   */
  setImportedWaveform: (waveform: ProviderWaveform | null) => void;
  /** Patch the imported-waveform Analyzer view configuration. */
  setVcdAnalyzerConfig: (patch: Partial<VcdAnalyzerConfig>) => void;
  /** Add a named XDC constraint set (first added becomes active). Returns its id or an error. */
  addConstraintSet: (name: string, xdcText: string) => { ok: true; id: string } | { ok: false; error: string };
  /** Remove a constraint set; if active, activation falls to the first remaining. */
  removeConstraintSet: (id: string) => void;
  /** Rename a constraint set. Returns ok or an error (e.g. duplicate name). */
  renameConstraintSet: (id: string, name: string) => { ok: true } | { ok: false; error: string };
  /** Set the active constraint set. */
  setActiveConstraintSet: (id: string) => void;
  setImportMeta: (meta: IdeImportMeta | null) => void;
  setActiveLabTaskId: (labTaskId: string | null) => void;
  startBlankProject: () => void;
  replaceWithBlankProject: () => void;
  setLastSavedAt: (label: string) => void;
  resetToActiveExample: () => void;
  clearUnsavedState: (label?: string) => void;
  macros: MacroDefinition[];
  macroInsertionCounts: Record<string, number>;
  saveMacro: (input: Omit<SaveMacroInput, 'circuit'>) => MacroDefinition | null;
  deleteMacro: (macroId: string) => void;
  updateMacro: (
    macroId: string,
    updated: Partial<Pick<MacroDefinition, 'name' | 'description' | 'inputs' | 'outputs'>>
  ) => void;
  instantiateMacro: (
    macroId: string,
    position: { x: number; y: number }
  ) => MacroInstantiationResult | null;
  customComponents: CompositeNodeDef[];
  addCustomComponent: (def: CompositeNodeDef) => void;
  setActiveModule: (moduleId: string) => void;
  createModuleFromSelection: (input: CreateModuleInput) => CreateModuleResult | null;
  placeModuleInstance: (
    moduleId: string,
    position: { x: number; y: number },
    instanceName?: string,
  ) => Node | null;
  updateActiveModuleCircuit: (circuit: Circuit) => void;
  renameModuleInstance: (nodeId: string, instanceName: string) => void;
  duplicateModuleDefinition: (moduleId: string) => string | null;
  deleteModuleDefinition: (moduleId: string) => boolean;
}

interface PersistedRuntimeState {
  projectId: string;
  projectName: string;
  projectDescription: string;
  lastSavedAt: string;
  /** Single authority for the active HDL top-entity name (see {@link topEntity}). */
  activeTop?: string;
  projectKind?: ProjectKind;
  sourceExampleId?: string | null;
  scenarioAuthority?: ScenarioAuthority;
  importMeta?: IdeImportMeta | null;
  activeExampleId: string | null;
  activeLabTaskId?: string | null;
  hardwareMappingV2?: HardwareMappingDocumentV2;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  scenarios?: VerifyScenario[];
  activeScenarioId?: string;
  customVectors: CustomTestVector[];
  circuit: Circuit;
  hierarchy?: ProjectHierarchyDocument;
  sourceModel?: ProjectSourceModel;
  designPast?: DesignHistorySnapshot[];
  designFuture?: DesignHistorySnapshot[];
  maxDesignHistory?: number;
  designRevision?: number;
  verifyLastRun?: RuntimeVerifyRun;
  verifyRunHistory: VerifyRunLedgerEntry[];
  exportHistory?: ProjectHealthExportResult[];
  sim: RuntimeSimState;
  importedWaveform?: ProviderWaveform | null;
  vcdAnalyzer?: VcdAnalyzerConfig;
  constraintSets?: ConstraintSetsDocument;
  projectHealthCore: ProjectHealthCore;
  macros: MacroDefinition[];
  macroInsertionCounts: Record<string, number>;
  customComponents: CompositeNodeDef[];
}

interface DesignHistorySnapshot {
  circuit: Circuit;
  projectIoRows: ProjectIoRow[];
  /** When absent (legacy snapshots), V2 is reconstructed from {@link projectIoRows}. */
  hardwareMappingV2?: HardwareMappingDocumentV2;
  projectVectors?: TestVector[];
  macroInsertionCounts: Record<string, number>;
  hierarchy?: ProjectHierarchyDocument;
}

interface RuntimeSeedState extends PersistedRuntimeState {
  activeTop: string;
  sourceModel: ProjectSourceModel;
  importedWaveform: ProviderWaveform | null;
  vcdAnalyzer: VcdAnalyzerConfig;
  constraintSets: ConstraintSetsDocument;
  exportHistory: ProjectHealthExportResult[];
  scenarios: VerifyScenario[];
  activeScenarioId: string;
  designPast: DesignHistorySnapshot[];
  designFuture: DesignHistorySnapshot[];
  maxDesignHistory: number;
  designRevision: number;
}

export const useProjectRuntime = create<ProjectRuntimeState>()(
  persist(
    (set, get) => ({
      ...createEmptyProjectState(),
      actions: {
        verify: {
          run: (input) => get().runVerification(input),
          clear: () => get().clearVerification(),
        },
        sim: {
          run: () => {
            set((state) => ({
              sim: {
                ...state.sim,
                running: true,
                stepMode: false,
                lastAction: 'run',
              },
            }));
          },
          pause: () => {
            set((state) => ({
              sim: {
                ...state.sim,
                running: false,
                lastAction: 'pause',
              },
            }));
          },
          step: () => {
            set((state) => {
              const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
              const model = buildSimulationModelForCircuit(simulationCircuit);
              const result = advanceSimulationStateFromModel(
                simulationCircuit,
                model,
                state.projectIoRows,
                {
                  ...state.sim,
                  lastAction: 'step',
                },
                1
              );
              return {
                sim: applyInteractiveSimResult(state.sim, result, model, { stepMode: true }),
              };
            });
          },
          runTicks: (ticks) => {
            const boundedTicks = Math.max(0, Math.min(512, Math.floor(ticks)));
            if (boundedTicks === 0) return;
            set((state) => {
              const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
              const model = buildSimulationModelForCircuit(simulationCircuit);
              const result = advanceSimulationStateFromModel(
                simulationCircuit,
                model,
                state.projectIoRows,
                {
                  ...state.sim,
                  lastAction: 'step',
                },
                boundedTicks
              );
              return {
                sim: applyInteractiveSimResult(state.sim, result, model),
              };
            });
          },
          reset: () => {
            set((state) => {
              const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
              const model = buildSimulationModelForCircuit(simulationCircuit);
              const result = resetSimulationStateFromModel(
                simulationCircuit,
                model,
                state.projectIoRows,
                {
                  ...state.sim,
                  lastAction: 'reset',
                }
              );
              return {
                sim: applyInteractiveSimResult(state.sim, result, model),
              };
            });
          },
          setSpeed: (hz) => {
            const speedHz = clampSimSpeed(hz);
            set((state) => ({
              sim: {
                ...state.sim,
                speedHz,
              },
            }));
          },
          setInput: (nodeId, value) => {
            set((state) => {
              const normalizedNodeId = nodeId.trim();
              if (!normalizedNodeId) return state;
              const bit = normalizeBit(value);
              const nextInputs = {
                ...state.sim.inputs,
                [normalizedNodeId]: bit,
              };
              const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
              const model = buildSimulationModelForCircuit(simulationCircuit);
              const result = recomputeSimulationStateFromModel(
                simulationCircuit,
                model,
                state.projectIoRows,
                {
                  ...state.sim,
                  inputs: nextInputs,
                  running: state.sim.running,
                  lastAction: 'input',
                }
              );
              return {
                sim: applyInteractiveSimResult(
                  state.sim,
                  result,
                  model,
                  undefined,
                  {
                    ...buildBlockedRuntimeSnapshotFromModel(simulationCircuit, model, nextInputs),
                    lastAction: 'input',
                  }
                ),
              };
            });
          },
          toggleInput: (nodeId) => {
            set((state) => {
              const normalizedNodeId = nodeId.trim();
              if (!normalizedNodeId) return state;
              const nextValue = state.sim.inputs[normalizedNodeId] === 1 ? 0 : 1;
              const nextInputs = {
                ...state.sim.inputs,
                [normalizedNodeId]: nextValue as 0 | 1,
              };
              const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
              const model = buildSimulationModelForCircuit(simulationCircuit);
              const result = recomputeSimulationStateFromModel(
                simulationCircuit,
                model,
                state.projectIoRows,
                {
                  ...state.sim,
                  inputs: nextInputs,
                  running: state.sim.running,
                  lastAction: 'input',
                }
              );
              return {
                sim: applyInteractiveSimResult(
                  state.sim,
                  result,
                  model,
                  undefined,
                  {
                    ...buildBlockedRuntimeSnapshotFromModel(simulationCircuit, model, nextInputs),
                    lastAction: 'input',
                  }
                ),
              };
            });
          },
          setSelectedSignal: (signalKey) => {
            set((state) => ({
              sim: {
                ...state.sim,
                selectedSignalKey: signalKey ? signalKey.trim() : null,
              },
            }));
          },
          toggleProbe: (probe) => {
            set((state) => {
              const key = probe.key.trim();
              if (!key) return state;
              const existing = state.sim.probes.find((entry) => entry.key === key);
              let probes = state.sim.probes;
              if (existing) {
                probes = probes.filter((entry) => entry.key !== key);
              } else {
                probes = [...probes, { key, label: probe.label.trim() || key }];
              }
              probes = [...probes].sort((left, right) => compareText(left.key, right.key));
              return {
                sim: {
                  ...state.sim,
                  probes,
                },
              };
            });
          },
        },
      },
      loadExample: (exampleId) => {
        const example = getIdeExampleById(exampleId);
        if (!example) return;
        set({
          ...stateFromExample(example, createProjectId(example.id)),
          lastSavedAt: `Example loaded: ${example.name}`,
        });
      },
      loadFromProject: (project, testbench) => {
        const circuit = cloneCircuit(project.circuit);
        const legacyProjectIoRows = ioRowsFromProject(project);
        const {
          hardwareMappingV2,
          projectIoRows,
        } = deriveAuthoritativeHardwareState(circuit, pickHardwareMappingV2FromProject(project));
        const incomingProjectId = (project.meta?.projectId ?? '').trim();
        const persistedProjectKind = normalizeProjectKind(project.meta?.projectKind, 'saved');
        const rawSourceExampleId =
          typeof project.meta?.sourceExampleId === 'string' && project.meta.sourceExampleId.trim().length > 0
            ? project.meta.sourceExampleId.trim()
            : null;
        const inferredDetachedExample = inferDetachedExampleProvenance({
          projectKind: persistedProjectKind,
          sourceExampleId: rawSourceExampleId,
          activeExampleId: null,
          projectName: project.name || 'Imported project',
          projectDescription: project.description ?? '',
        });
        const sourceExampleId = rawSourceExampleId ?? inferredDetachedExample?.id ?? null;
        const projectKind =
          persistedProjectKind !== 'example' && inferredDetachedExample
            ? 'custom'
            : persistedProjectKind;
        const activeExampleId = projectKind === 'example' ? sourceExampleId : null;
        const activeLabTaskId = normalizeGuidedLabTaskId(project.meta?.labId);
        const sourceProjectVectors = preserveCompatibleVectorAuthorship(
          cloneVectors(project.vectors ?? []),
          legacyProjectIoRows,
          projectIoRows
        );
        const restoredIdentity = resolveDetachedExampleIdentity({
          projectKind,
          inferredDetachedExample,
          projectName: project.name || 'Imported project',
          projectDescription: project.description ?? '',
          fallbackProjectName: 'Imported project',
        });
        const persistedScenarioAuthority = normalizeScenarioAuthority(
          project.meta?.scenarioAuthority,
          deriveScenarioAuthority({
            projectKind,
            activeExampleId,
            hasVectors: sourceProjectVectors.length > 0,
            hasAssertions: sourceProjectVectors.some(
              (vector) => Object.keys(vector.expected ?? {}).length > 0
            ),
            dirtySinceVerify: true,
            verifyStatus: null,
            vectorsAreAutoGenerated: projectKind === 'example',
          })
        );
        const shouldResetDetachedStarterCompareState =
          projectKind !== 'example' &&
          Boolean(sourceExampleId) &&
          persistedScenarioAuthority === 'starter' &&
          sourceProjectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0);
        const projectVectors = shouldResetDetachedStarterCompareState
          ? stripExpectedOutputs(sourceProjectVectors)
          : sourceProjectVectors;
        const scenarioAuthority = shouldResetDetachedStarterCompareState
          ? deriveScenarioAuthority({
              projectKind,
              activeExampleId,
              hasVectors: projectVectors.length > 0,
              hasAssertions: false,
              dirtySinceVerify: true,
              verifyStatus: null,
              vectorsAreAutoGenerated: false,
            })
          : persistedScenarioAuthority;
        const repairedTestbench =
          Array.isArray(testbench?.scenarios) && testbench.scenarios.length > 0
            ? repairScenarioLibrary(testbench.scenarios, testbench.activeScenarioId, projectVectors)
            : migrateProjectVectorsToScenario(projectVectors);
        const restoredScenarios = repairedTestbench.scenarios.map((scenario) => {
          const vectors = preserveCompatibleVectorAuthorship(
            cloneVectors(scenario.vectors),
            legacyProjectIoRows,
            projectIoRows
          );
          if (!shouldResetDetachedStarterCompareState) {
            return {
              ...scenario,
              vectors,
              steps: reconcileScenarioStepsForLiveIo(
                scenario.steps,
                legacyProjectIoRows,
                projectIoRows
              ),
              sequentialPolicy: reconcileScenarioSequentialPolicyForLiveIo(
                scenario.sequentialPolicy,
                legacyProjectIoRows,
                projectIoRows
              ),
            };
          }
          const strippedVectors = stripExpectedOutputs(vectors);
          return {
            ...scenario,
            vectors: strippedVectors,
            steps: scenario.steps ? deriveScenarioStepsFromVectors(strippedVectors) : undefined,
            sequentialPolicy: reconcileScenarioSequentialPolicyForLiveIo(
              scenario.sequentialPolicy,
              legacyProjectIoRows,
              projectIoRows
            ),
          };
        });
        const loadedProjectName = restoredIdentity.projectName;
        const loadedProjectDescription = restoredIdentity.projectDescription;
        const hierarchy = normalizeProjectHierarchy(project.hierarchy, project.customComponents ?? []);
        const hierarchyComponents = hierarchy.modules.map(toCompositeDefinition);
        // Register the hierarchy projection used by the existing simulation registry.
        for (const def of hierarchyComponents) {
          try {
            registerCompositeNode(def);
          } catch (e) {
            console.warn('Failed to register custom component:', def.name, e);
          }
        }
        set({
          projectId:
            incomingProjectId.length > 0
              ? incomingProjectId
              : createProjectId(loadedProjectName || 'imported'),
          projectName: loadedProjectName,
          projectDescription: loadedProjectDescription,
          lastSavedAt: `Imported: ${loadedProjectName || 'project'}`,
          activeTop: resolveActiveTopEntity(
            project.hdl?.top ?? project.fpga?.top,
            loadedProjectName
          ),
          projectKind,
          sourceExampleId,
          scenarioAuthority,
          importMeta: null,
          activeExampleId,
          activeLabTaskId,
          hardwareMappingV2,
          projectIoRows,
          projectVectors,
          scenarios: restoredScenarios,
          activeScenarioId: repairedTestbench.activeScenarioId,
          customVectors: [],
          circuit,
          hierarchy,
          // Imported projects carry their sources via `project.hdl`; deriveSourceModel
          // promotes them into the first-class source authority. Native/example
          // projects with no sources yield an empty model.
          sourceModel: deriveSourceModel(project),
          // Imported waveform evidence is tied to the previous context — a new
          // project load starts the Analyzer empty.
          importedWaveform: null,
          vcdAnalyzer: DEFAULT_VCD_ANALYZER_CONFIG,
          // Imported XDC constraint files seed the project's constraint sets.
          constraintSets: buildConstraintSetsFromSources(deriveSourceModel(project)),
          designPast: [],
          designFuture: [],
          designRevision: 0,
          verifyLastRun: undefined,
          verifyRunHistory: [],
          exportHistory: [],
          sim: initializeSimulationStateForCircuit(
            elaborateProjectHierarchy(circuit, hierarchy),
            projectIoRows,
          ),
          projectHealthCore: {
            dirtySinceVerify: true,
            dirtySinceExport: true,
          },
          macros: project.macros ?? [],
          macroInsertionCounts: {},
          customComponents: hierarchyComponents,
        });
      },
      setMappingPin: (rowId, pin) => {
        set((state) => {
          const { hardwareMappingV2: synchronizedCurrentDoc } =
            deriveAuthoritativeHardwareState(state.circuit, state.hardwareMappingV2);
          const nextDoc = applyScalarResourceMetadata(
            applyMaterializedPinToHardwareMappingV2(
              structuredClone(synchronizedCurrentDoc),
              rowId,
              pin
            ),
            rowId,
            pin
          );
          const { hardwareMappingV2, projectIoRows } = deriveAuthoritativeHardwareState(
            state.circuit,
            nextDoc
          );
          return {
            hardwareMappingV2,
            projectIoRows,
            scenarioAuthority:
              state.scenarioAuthority === 'verified' ? 'stale' : state.scenarioAuthority,
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
      },
      setMappingPins: (updates) => {
        set((state) => {
          const updateEntries = Object.entries(updates)
            .map(([rowId, pin]) => [rowId.trim(), pin.trim()] as const)
            .filter(([rowId]) => rowId.length > 0);
          if (updateEntries.length === 0) return {};
          // Route every row through the same structured-mapping authority as
          // setMappingPin. Rebuilding the document from flat rows here would
          // flatten structured (bus/slice/group) entries on every bulk write.
          const { hardwareMappingV2: synchronizedCurrentDoc } =
            deriveAuthoritativeHardwareState(state.circuit, state.hardwareMappingV2);
          let nextDoc = structuredClone(synchronizedCurrentDoc);
          for (const [rowId, pin] of updateEntries) {
            nextDoc = applyScalarResourceMetadata(
              applyMaterializedPinToHardwareMappingV2(nextDoc, rowId, pin),
              rowId,
              pin
            );
          }
          const { hardwareMappingV2, projectIoRows } = deriveAuthoritativeHardwareState(
            state.circuit,
            nextDoc
          );
          return {
            hardwareMappingV2,
            projectIoRows,
            scenarioAuthority:
              state.scenarioAuthority === 'verified' ? 'stale' : state.scenarioAuthority,
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
      },
      applyHardwareMappingEdit: (operation) => {
        set((state) => {
          const { hardwareMappingV2, projectIoRows } = deriveAuthoritativeHardwareState(
            state.circuit,
            applyHardwareMappingV2Edit(state.hardwareMappingV2, operation)
          );
          return {
            hardwareMappingV2,
            projectIoRows,
            scenarioAuthority:
              state.scenarioAuthority === 'verified' ? 'stale' : state.scenarioAuthority,
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
      },
      autoSuggestMapping: () => {
        set((state) => {
          let hardwareMappingV2 = structuredClone(state.hardwareMappingV2);
          const { projectIoRows: baseRows } = deriveAuthoritativeHardwareState(state.circuit, hardwareMappingV2);
          for (let index = 0; index < baseRows.length; index += 1) {
            const entry = baseRows[index];
            if (!entry || entry.pin.trim().length > 0) continue;
            const suggested = suggestBasys3Pin(entry, index);
            hardwareMappingV2 = applyMaterializedPinToHardwareMappingV2(
              hardwareMappingV2,
              entry.id,
              suggested
            );
          }
          const { hardwareMappingV2: synchronizedDoc, projectIoRows } =
            deriveAuthoritativeHardwareState(state.circuit, hardwareMappingV2);
          return {
            hardwareMappingV2: synchronizedDoc,
            projectIoRows,
            scenarioAuthority:
              state.scenarioAuthority === 'verified' ? 'stale' : state.scenarioAuthority,
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
      },
      setVectors: (vectors) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          const normalizedCurrentVectors = normalizeVectorsForLiveIo(
            cloneVectors(activeScenario?.vectors ?? state.projectVectors),
            state.projectIoRows
          );
          const projectVectors = normalizeVectorsForLiveIo(cloneVectors(vectors), state.projectIoRows);
          const preserveExplicitSteps =
            stableSerialize(vectorStimulusOnly(normalizedCurrentVectors)) ===
            stableSerialize(vectorStimulusOnly(projectVectors));
          const nextScenarioState = syncActiveScenarioVectors(
            state.scenarios,
            state.activeScenarioId,
            projectVectors,
            preserveExplicitSteps
          );
          return {
            projectVectors,
            scenarios: nextScenarioState.scenarios,
            activeScenarioId: nextScenarioState.activeScenarioId,
            scenarioAuthority: deriveScenarioAuthority({
              projectKind: state.projectKind,
              activeExampleId: state.activeExampleId,
              hasVectors: projectVectors.length > 0,
              hasAssertions: projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
              dirtySinceVerify: true,
              verifyStatus: null,
              // setVectors is the authored edit path. Starter/bring-up generation has
              // dedicated actions below, so an edit inside an example must stop being
              // treated as inherited starter evidence before the first Design change.
              vectorsAreAutoGenerated: false,
            }),
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
      },
      setCustomVectors: (vectors) => {
        set((state) => ({
          customVectors: normalizeVectorsForLiveIo(cloneVectors(vectors), state.projectIoRows),
          scenarioAuthority:
            state.scenarioAuthority === 'verified' ? 'stale' : state.scenarioAuthority,
          projectHealthCore: {
            ...state.projectHealthCore,
            dirtySinceVerify: true,
          },
        }));
      },
      generateBringUpVectors: () => {
        const state = get();
        const generated = generateBringUpVectors({
          ioRows: state.projectIoRows,
          circuit: state.circuit,
          existingVectors: resolveActiveScenarioVectors(state),
        });
        set((state) => {
          const projectVectors = normalizeVectorsForLiveIo(cloneVectors(generated), state.projectIoRows);
          const nextScenarioState = syncActiveScenarioVectors(
            state.scenarios,
            state.activeScenarioId,
            projectVectors
          );
          return {
            projectVectors,
            scenarios: nextScenarioState.scenarios,
            activeScenarioId: nextScenarioState.activeScenarioId,
            scenarioAuthority: deriveScenarioAuthority({
              projectKind: state.projectKind,
              activeExampleId: state.activeExampleId,
              hasVectors: projectVectors.length > 0,
              hasAssertions: projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
              dirtySinceVerify: true,
              verifyStatus: null,
              vectorsAreAutoGenerated: state.projectKind === 'example' && Boolean(state.activeExampleId),
            }),
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
        return generated;
      },
      generateStimulusVectors: () => {
        const state = get();
        const generated = generateStimulusVectors({
          ioRows: state.projectIoRows,
          circuit: state.circuit,
          existingVectors: resolveActiveScenarioVectors(state),
        });
        set((state) => {
          const projectVectors = normalizeVectorsForLiveIo(cloneVectors(generated), state.projectIoRows);
          const nextScenarioState = syncActiveScenarioVectors(
            state.scenarios,
            state.activeScenarioId,
            projectVectors
          );
          return {
            projectVectors,
            scenarios: nextScenarioState.scenarios,
            activeScenarioId: nextScenarioState.activeScenarioId,
            scenarioAuthority: deriveScenarioAuthority({
              projectKind: state.projectKind,
              activeExampleId: state.activeExampleId,
              hasVectors: projectVectors.length > 0,
              hasAssertions: projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
              dirtySinceVerify: true,
              verifyStatus: null,
              vectorsAreAutoGenerated: false,
            }),
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
        return generated;
      },
      createScenario: () => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          const newScenario = createScenario(
            'New Scenario',
            resolveActiveScenarioVectors(state).map((vector) => ({
              ...vector,
              expected: {},
            })),
            activeScenario?.sequentialPolicy
          );
          return commitScenarioSelection(state, [...state.scenarios, newScenario], newScenario.id);
        });
      },
      duplicateScenario: () => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const duplicate = {
            ...createScenario(
              `${activeScenario.name} Copy`,
              materializeScenarioVectors(activeScenario),
              activeScenario.sequentialPolicy
            ),
            steps: activeScenario.steps?.map(cloneScenarioStep),
            probes: normalizeScenarioProbes(activeScenario.probes),
          };
          return commitScenarioSelection(state, [...state.scenarios, duplicate], duplicate.id);
        });
      },
      renameScenario: (name) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          const trimmedName = name.trim();
          if (!activeScenario || trimmedName.length === 0 || trimmedName === activeScenario.name) {
            return state;
          }
          const scenarios = state.scenarios.map((scenario) =>
            scenario.id === activeScenario.id
              ? stampScenario({
                  ...scenario,
                  name: trimmedName,
                })
              : scenario
          );
          return commitScenarioSelection(state, scenarios, activeScenario.id);
        });
      },
      deleteScenario: (scenarioId) => {
        set((state) => {
          const deleteIndex = state.scenarios.findIndex((scenario) => scenario.id === scenarioId);
          if (deleteIndex < 0 || state.scenarios.length <= 1) return state;
          const scenarios = state.scenarios.filter((scenario) => scenario.id !== scenarioId);
          const nextActiveScenarioId =
            scenarioId === state.activeScenarioId
              ? (scenarios[Math.max(0, deleteIndex - 1)] ?? scenarios[0]).id
              : state.activeScenarioId;
          return commitScenarioSelection(state, scenarios, nextActiveScenarioId);
        });
      },
      switchScenario: (scenarioId) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, scenarioId);
          if (!activeScenario) return state;
          if (
            activeScenario.id === state.activeScenarioId &&
            stableSerialize(activeScenario.vectors) === stableSerialize(state.projectVectors)
          ) {
            return state;
          }
          return commitScenarioSelection(state, state.scenarios, activeScenario.id);
        });
      },
      toggleScenarioProbe: (probe) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const probes = toggleScenarioProbe(activeScenario.probes, probe);
          return {
            scenarios: state.scenarios.map((scenario) =>
              scenario.id === activeScenario.id
                ? { ...scenario, probes, updatedAt: new Date().toISOString() }
                : scenario
            ),
            sim: {
              ...state.sim,
              probes: probes.map((entry) => ({
                key: entry.key,
                label: entry.label ?? entry.key,
              })),
            },
          };
        });
      },
      updateScenarioSequentialPolicy: (policy) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const normalizedPolicy = reconcileScenarioSequentialPolicyForLiveIo(
            normalizeScenarioSequentialPolicy(policy),
            state.projectIoRows,
            state.projectIoRows
          );
          if (
            stableSerialize(activeScenario.sequentialPolicy ?? null) ===
            stableSerialize(normalizedPolicy ?? null)
          ) {
            return state;
          }
          const nextScenario = stampScenario({
            ...activeScenario,
            sequentialPolicy: normalizedPolicy,
          });
          const scenarios = state.scenarios.map((scenario) =>
            scenario.id === nextScenario.id ? nextScenario : scenario
          );
          const selection = commitScenarioSelection(state, scenarios, nextScenario.id);
          return {
            ...selection,
            projectHealthCore: {
              ...selection.projectHealthCore,
              // Sequential execution choices remain outside portable RBProject,
              // but they govern generated simulation-source testbench bytes.
              dirtySinceExport: true,
            },
            scenarioAuthority:
              state.scenarioAuthority === 'verified' ? 'stale' : state.scenarioAuthority,
          };
        });
      },
      appendScenarioStep: (draft) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const currentSteps =
            activeScenario.steps && activeScenario.steps.length > 0
              ? activeScenario.steps.map(cloneScenarioStep)
              : deriveScenarioStepsFromVectors(activeScenario.vectors);
          const nextSteps = [...currentSteps, createScenarioStep(draft, currentSteps.length)];
          const nextScenario = stampScenario({
            ...activeScenario,
            steps: nextSteps,
            vectors: materializeScenarioVectors({
              ...activeScenario,
              steps: nextSteps,
            }),
          });
          const scenarios = state.scenarios.map((scenario) =>
            scenario.id === nextScenario.id ? nextScenario : scenario
          );
          return commitScenarioSelection(state, scenarios, nextScenario.id);
        });
      },
      updateScenarioStep: (stepId, patch) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const nextScenario = mutateScenarioSteps(activeScenario, (steps) =>
            steps.map((step) => {
              if (step.id !== stepId) return step;
              return {
                ...step,
                ...patch,
              };
            })
          );
          if (!nextScenario) return state;
          const scenarios = state.scenarios.map((scenario) =>
            scenario.id === nextScenario.id ? nextScenario : scenario
          );
          return commitScenarioSelection(state, scenarios, nextScenario.id);
        });
      },
      moveScenarioStep: (stepId, direction) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const nextScenario = mutateScenarioSteps(activeScenario, (steps) => {
            const currentIndex = steps.findIndex((step) => step.id === stepId);
            if (currentIndex < 0) return steps;
            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= steps.length) return steps;
            const reordered = [...steps];
            const [item] = reordered.splice(currentIndex, 1);
            reordered.splice(targetIndex, 0, item);
            return reordered;
          });
          if (!nextScenario) return state;
          const scenarios = state.scenarios.map((scenario) =>
            scenario.id === nextScenario.id ? nextScenario : scenario
          );
          return commitScenarioSelection(state, scenarios, nextScenario.id);
        });
      },
      deleteScenarioStep: (stepId) => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const nextScenario = mutateScenarioSteps(activeScenario, (steps) =>
            steps.filter((step) => step.id !== stepId)
          );
          if (!nextScenario) return state;
          const scenarios = state.scenarios.map((scenario) =>
            scenario.id === nextScenario.id ? nextScenario : scenario
          );
          return commitScenarioSelection(state, scenarios, nextScenario.id);
        });
      },
      applyCircuitMutation: (circuit) => {
        set((state) => {
          const currentFingerprint = digestValue(stableSerialize(state.circuit));
          const nextFingerprint = digestValue(stableSerialize(circuit));
          if (currentFingerprint === nextFingerprint) {
            return state;
          }

          return {
            ...commitDesignSnapshot(
              state,
              {
                circuit: cloneCircuit(circuit),
                projectIoRows: cloneIoRows(state.projectIoRows),
                hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
                macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
              },
              {
                designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                  -state.maxDesignHistory
                ),
                designFuture: [],
              }
            ),
          };
        });
      },
      markDesignMutated: (circuit) => {
        get().applyCircuitMutation(circuit);
      },
      undoProjectEdit: () => {
        set((state) => {
          if (state.designPast.length === 0) return state;
          const previous = state.designPast[state.designPast.length - 1];
          return {
            ...commitDesignSnapshot(state, previous, {
              designPast: state.designPast.slice(0, -1),
              designFuture: [createDesignHistorySnapshot(state), ...state.designFuture],
            }),
          };
        });
      },
      redoProjectEdit: () => {
        set((state) => {
          if (state.designFuture.length === 0) return state;
          const next = state.designFuture[0];
          return {
            ...commitDesignSnapshot(state, next, {
              designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                -state.maxDesignHistory
              ),
              designFuture: state.designFuture.slice(1),
            }),
          };
        });
      },
      addDesignNode: (nodeType, position) => {
        set((state) => {
          const nextCircuit = cloneCircuit(state.circuit);
          const normalizedPosition = {
            x: roundToMill(position.x),
            y: roundToMill(position.y),
          };
          nextCircuit.nodes.push({
            id: getNextDesignNodeId(nextCircuit),
            type: nodeType,
            position: normalizedPosition,
            x: normalizedPosition.x,
            y: normalizedPosition.y,
            rotation: 0,
            config: defaultNodeConfig(nodeType),
            state: {},
          });
          return commitDesignSnapshot(
            state,
            {
              circuit: nextCircuit,
              projectIoRows: cloneIoRows(state.projectIoRows),
              hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
              macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
            },
            {
              designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                -state.maxDesignHistory
              ),
              designFuture: [],
            }
          );
        });
      },
      addDesignIo: (direction, position) => {
        set((state) => {
          const type = direction === 'input' ? 'INPUT' : 'OUTPUT';
          const rowDirection = direction === 'input' ? 'in' : 'out';
          const rowPort = direction === 'input' ? 'out' : 'in';
          const rowLabelBase = direction === 'input' ? 'Input' : 'Output';
          const existingBoundaryCount = state.circuit.nodes.filter((node) => node.type === type).length;
          const rowLabel = `${rowLabelBase} ${existingBoundaryCount + 1}`;
          const rowId = getNextIoRowId(state.projectIoRows, normalizeBoardRowId(rowLabel));
          const nodeId = getNextDesignNodeId(state.circuit);
          const normalizedPosition = {
            x: roundToMill(position.x),
            y: roundToMill(position.y),
          };
          const nextCircuit = cloneCircuit(state.circuit);
          nextCircuit.nodes.push({
            id: nodeId,
            type,
            label: rowLabel,
            position: normalizedPosition,
            x: normalizedPosition.x,
            y: normalizedPosition.y,
            rotation: 0,
            config: {},
            state: {},
          });
          const nextIoRows = cloneIoRows(state.projectIoRows);
          nextIoRows.push({
            id: rowId,
            nodeId,
            port: rowPort,
            label: rowLabel,
            direction: rowDirection,
            pin: '',
            required: true,
          });

          const newRow = nextIoRows[nextIoRows.length - 1]!;
          const nextHardwareMappingV2 = upsertScalarMappingEntry(state.hardwareMappingV2, newRow);

          return commitDesignSnapshot(
            state,
            {
              circuit: nextCircuit,
              projectIoRows: nextIoRows,
              hardwareMappingV2: nextHardwareMappingV2,
              macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
            },
            {
              designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                -state.maxDesignHistory
              ),
              designFuture: [],
            }
          );
        });
      },
      createDesignBus: ({ name, direction, width, position }) => {
        const state = get();
        const left = Math.max(0, Math.floor(width) - 1);
        let result: { ok: true; busId: string } | { ok: false; error: string };
        let nextState: ProjectRuntimeState | null = null;
        try {
          const created = createBusBoundary(state.circuit, {
            name,
            direction,
            left,
            right: 0,
            position: position ? { x: roundToMill(position.x), y: roundToMill(position.y) } : undefined,
          });
          const rowDirection = direction === 'input' ? 'in' : 'out';
          const rowPort = direction === 'input' ? 'out' : 'in';
          const nextIoRows = cloneIoRows(state.projectIoRows);
          for (const member of created.memberNodes) {
            const rowId = getNextIoRowId(nextIoRows, normalizeBoardRowId(member.label ?? member.id));
            nextIoRows.push({
              id: rowId,
              nodeId: member.id,
              port: rowPort,
              label: member.label ?? member.id,
              direction: rowDirection,
              pin: '',
              required: true,
            });
          }
          nextState = {
            ...state,
            ...commitDesignSnapshot(
              state,
              {
                circuit: created.circuit,
                projectIoRows: nextIoRows,
                hardwareMappingV2: undefined,
                macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
              },
              {
                designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                  -state.maxDesignHistory
                ),
                designFuture: [],
              }
            ),
          };
          result = { ok: true, busId: created.bus.id };
        } catch (error) {
          if (error instanceof BusValidationError) {
            result = { ok: false, error: error.message };
          } else {
            throw error;
          }
        }
        if (nextState) set(nextState);
        return result;
      },
      addDesignBoardIo: ({ alias, direction, kind, position }) => {
        set((state) => {
          const normalizedAlias = normalizeAliasToken(alias);
          if (!normalizedAlias) return state;

          const isInput = direction === 'in';
          const normalizedKind = normalizeBoardIoKind(kind, isInput);
          const nodeType =
            normalizedKind === 'clock' ? 'Clock' : isInput ? 'INPUT' : 'OUTPUT';
          const baseLabel =
            normalizedKind === 'reset' ? 'rst' : normalizedAlias.toLowerCase();
          const rowIdBase = normalizeBoardRowId(baseLabel);
          const rowPin = normalizedKind === 'reset' ? 'BTNC' : normalizedAlias;
          const rowPort = isInput ? 'out' : 'in';
          const nextIoRows = cloneIoRows(state.projectIoRows);
          const existingRow = nextIoRows.find(
            (row) =>
              row.direction === direction &&
              (
                normalizePortToken(row.pin) === normalizePortToken(rowPin) ||
                normalizePortToken(row.id) === normalizePortToken(rowIdBase) ||
                normalizePortToken(row.label) === normalizePortToken(baseLabel)
              )
          );
          const existingNodeId = existingRow?.nodeId ? normalizePortToken(existingRow.nodeId) : '';
          if (
            existingNodeId.length > 0 &&
            state.circuit.nodes.some((node) => normalizePortToken(node.id) === existingNodeId)
          ) {
            return state;
          }

          let nodeId =
            existingRow?.nodeId && existingRow.nodeId.trim().length > 0
              ? existingRow.nodeId.trim()
              : getNextNamedNodeId(state.circuit, `${baseLabel}_node`);
          if (state.circuit.nodes.some((node) => normalizePortToken(node.id) === normalizePortToken(nodeId))) {
            nodeId = getNextNamedNodeId(state.circuit, `${baseLabel}_node`);
          }

          const nextCircuit = cloneCircuit(state.circuit);
          nextCircuit.nodes.push({
            id: nodeId,
            type: nodeType,
            label: baseLabel,
            position: {
              x: roundToMill(position.x),
              y: roundToMill(position.y),
            },
            x: roundToMill(position.x),
            y: roundToMill(position.y),
            rotation: 0,
            // Board clock nodes get role:'board' so they are treated as real top-level
            // VHDL ports — distinct from palette sim-clocks (role:'sim') which are
            // browser oscillators with no hardware equivalent.
            config: normalizedKind === 'clock'
              ? { ...defaultNodeConfig(nodeType), role: 'board' }
              : defaultNodeConfig(nodeType),
            state: {},
          });

          if (existingRow) {
            existingRow.nodeId = nodeId;
            existingRow.port = rowPort;
            existingRow.label = baseLabel;
            existingRow.pin = rowPin;
            existingRow.direction = direction;
            existingRow.required = true;
          } else {
            const rowId = getNextIoRowId(state.projectIoRows, rowIdBase);
            nextIoRows.push({
              id: rowId,
              nodeId,
              port: rowPort,
              label: baseLabel,
              direction,
              pin: rowPin,
              required: true,
            });
          }

          const rowToUpsert = existingRow ?? nextIoRows[nextIoRows.length - 1]!;
          const nextHardwareMappingV2 = upsertScalarMappingEntry(state.hardwareMappingV2, rowToUpsert);

          return commitDesignSnapshot(
            state,
            {
              circuit: nextCircuit,
              projectIoRows: nextIoRows,
              hardwareMappingV2: nextHardwareMappingV2,
              macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
            },
            {
              designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                -state.maxDesignHistory
              ),
              designFuture: [],
            }
          );
        });
      },
      connectDesignNodes: (connection) => {
        set((state) => {
          if (!connection.fromNodeId || !connection.toNodeId) return state;
          const fromPort = connection.fromPort.trim() || 'out';
          const toPort = connection.toPort.trim() || 'in';
          const duplicate = state.circuit.connections.some((entry) => {
            const fromNodeId =
              typeof entry.from === 'string' ? entry.from : entry.from.nodeId;
            const toNodeId =
              typeof entry.to === 'string' ? entry.to : entry.to.nodeId;
            const fromPortName =
              typeof entry.from === 'string'
                ? entry.fromPort ?? entry.fromPin ?? 'out'
                : entry.from.portName ?? entry.from.port ?? 'out';
            const toPortName =
              typeof entry.to === 'string'
                ? entry.toPort ?? entry.toPin ?? 'in'
                : entry.to.portName ?? entry.to.port ?? 'in';
            return (
              fromNodeId === connection.fromNodeId &&
              toNodeId === connection.toNodeId &&
              fromPortName === fromPort &&
              toPortName === toPort
            );
          });
          if (duplicate) return state;

          const nextCircuit = cloneCircuit(state.circuit);
          nextCircuit.connections.push({
            from: { nodeId: connection.fromNodeId, portName: fromPort },
            to: { nodeId: connection.toNodeId, portName: toPort },
          });

          return commitDesignSnapshot(
            state,
            {
              circuit: nextCircuit,
              projectIoRows: cloneIoRows(state.projectIoRows),
              hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
              macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
            },
            {
              designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                -state.maxDesignHistory
              ),
              designFuture: [],
            }
          );
        });
      },
      runVerification: (input) => {
        let runtimeRun: RuntimeVerifyRun | undefined;
        set((state) => {
          const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
          const scenarioId = input.scenarioId.trim() || 'runtime-verify';
          const matchedScenario = state.scenarios.find((scenario) => scenario.id === scenarioId);
          const scenarioName =
            matchedScenario?.name ?? (input.scenarioName.trim() || 'Runtime verification');
          const scenarioVersion = matchedScenario
            ? matchedScenario.version
            : Number.isFinite(input.scenarioVersion)
              ? Math.max(0, Math.floor(Number(input.scenarioVersion)))
              : undefined;
          const circuitHash = buildVerifyCircuitEvidenceHash(simulationCircuit);
          const ioMapping = toIoMapping(state.projectIoRows);
          const mappingEvidenceHash = buildVerifyMappingEvidenceHash(
            resolveIoMappingFromProjectFields({
              ioMapping,
              hardwareMappingV2: state.hardwareMappingV2,
            }) ?? ioMapping
          );
          const verifyContext = buildDeterministicVerifyContext(
            simulationCircuit,
            ioMapping
          );
          const scheduleContract = input.scheduleContract
            ? cloneVerifyScheduleContract(input.scheduleContract)
            : verifyContext.schedule;
          const model = verifyContext.simModel;
          const clockPolicy =
            input.clockPolicy ??
            detectVerifyClockPolicy({
              circuit: simulationCircuit,
              ioRows: state.projectIoRows,
              scheduleContract,
            });
          const authoredVectors = normalizeVectorsForLiveIo(
            cloneVectors(input.vectors ?? resolveActiveScenarioVectors(state)),
            state.projectIoRows,
            clockPolicy
          );
          // This binds the run to the scenario document version. Exact run-input
          // authority remains separate in scenarioStimulusHash + report.vectors,
          // so appended custom rows cannot become Export authority by inheritance.
          const scenarioContentHash = matchedScenario
            ? computeScenarioContentHash(matchedScenario)
            : undefined;
          const scenarioStimulusHash = computeExecutionStimulusHash(
            authoredVectors,
            clockPolicy
          );
          const runtimeVectors = materializeVectorsForClockPolicy({
            vectors: authoredVectors,
            ioRows: state.projectIoRows,
            policy: clockPolicy,
          });
          const requestedVerifyRows = (input.rows ?? []).length > 0;
          const hasExpectedVectorAssertions = runtimeVectors.some(
            (vector) => Object.keys(vector.expected ?? {}).length > 0
          );
          const runKind =
            input.runKind ??
            (input.assertionMode === true
              ? 'verify'
              : input.assertionMode === false
                ? 'trace'
                : requestedVerifyRows || hasExpectedVectorAssertions
                  ? 'verify'
                  : 'trace');
          // Trace runs must not consume expected values — strip them so the engine
          // produces observed-only rows with no comparison failures.
          const deterministicVectors =
            runKind === 'trace'
              ? runtimeVectors.map((v) => ({ ...v, expected: {} as Record<string, boolean | number> }))
              : runtimeVectors;
          const deterministicResult =
            deterministicVectors.length > 0
              ? runDeterministicVerifyFromModel(
                  simulationCircuit,
                  model,
                  state.projectIoRows,
                  deterministicVectors,
                  scheduleContract,
                  clockPolicy ?? undefined
                )
              : null;
          const normalizedRows = deterministicResult?.rows ?? normalizeVerifyRows(input.rows);
          const failedRows = normalizedRows.filter((row) => row.expected !== row.actual);
          const preflightIssues = deterministicResult?.evidence.preflight ?? [];
          const blockingPreflightIssues = preflightIssues.filter((issue) => issue.blocking !== false);
          const status: 'pass' | 'fail' =
            failedRows.length > 0 || blockingPreflightIssues.length > 0 ? 'fail' : 'pass';
          const simulationStatus: 'complete' = 'complete';
          const assertionStatus: NonNullable<RuntimeVerifyRun['assertionStatus']> =
            runKind === 'trace'
              ? 'not-configured'
              : blockingPreflightIssues.length > 0 && normalizedRows.length === 0
                ? 'not-evaluated'
                : failedRows.length > 0
                  ? 'failing'
                  : 'passing';
          const ranAtIso = input.ranAtIso ?? new Date().toISOString();
          const vectors = toVerifyVectors(runtimeVectors);
          const signalRoles = deriveIoSignalRoles(state.projectIoRows, scheduleContract);
          const report = buildVerifyReport({
            scenarioId,
            scenarioName,
            status,
            deterministicHash: input.deterministicHash,
            rows: normalizedRows,
            vectors,
            generatedAtIso: ranAtIso,
            signalRoles,
          });
          const waveform = buildCanonicalVerifyWaveSamples(
            report,
            deterministicResult?.trace ?? []
          );
          const evidence =
            deterministicResult !== null
              ? ({
                  ...deterministicResult.evidence,
                  circuitHash,
                } satisfies VerifyEvidenceCapsule)
              : undefined;
          runtimeRun = {
            scenarioId: report.scenarioId,
            scenarioName: report.scenarioName,
            runKind,
            scenarioVersion,
            scenarioContentHash,
            scenarioStimulusHash,
            mappingEvidenceHash,
            status: report.status,
            simulationStatus,
            assertionStatus,
            qualification: detectIncompleteMappingQualification(state.projectIoRows, report.status),
            deterministicHash: report.deterministicHash,
            reportHash: report.reportHash,
            firstFailingTick: report.firstFailingTick,
            generatedAtIso: report.generatedAtIso,
            schedule: scheduleContract.schedule,
            scheduleContract: cloneVerifyScheduleContract(scheduleContract),
            clockPolicy: clockPolicy ? { ...clockPolicy } : undefined,
            meta: buildVerifyRunMeta(
              scheduleContract,
              clockPolicy,
              authoredVectors,
              state.projectIoRows
            ),
            report,
            waveform,
            evidence,
          };

          // Build ledger entry (synchronous hashes via digestValue + stableSerialize)
          const vectorsHash = digestValue(stableSerialize(runtimeVectors));
          const mappingHash = mappingEvidenceHash;
          // Use the same hash function as buildCurrentVerifyProjectHash in IdeApp so that
          // deriveVerifyCurrent's ledger comparison always resolves correctly.
          // The prior inline computation included vector `id` fields (via cloneVectors spread)
          // while buildCurrentVerifyProjectHash strips them — causing a permanent stale loop
          // whenever vectors carried an `id` (e.g., after inserting a clock pattern).
          const projectHash = buildCurrentVerifyProjectHash({
            circuit: simulationCircuit,
            projectVectors: state.projectVectors,
            customVectors: state.customVectors,
            projectIoRows: state.projectIoRows,
          });
          const prevEntry = state.verifyRunHistory[state.verifyRunHistory.length - 1] ?? null;
          const firstFailRow = report.rows.find((row) => row.status === 'fail') ?? null;
          const ledgerEntry: VerifyRunLedgerEntry = {
            runId: `run-${ranAtIso}-${report.reportHash.slice(0, 8)}`,
            scenarioId: runtimeRun.scenarioId,
            scenarioName: runtimeRun.scenarioName,
            runKind,
            tickCount: runtimeRun.waveform?.length ?? 0,
            failedSignals: Array.from(new Set(report.rows.filter((row) => row.status === 'fail').map((row) => row.signal))),
            ranAtIso,
            status: report.status,
            passedRows: report.rows.filter((row) => row.status === 'pass').length,
            failedRows: report.rows.filter((row) => row.status === 'fail').length,
            firstFailure: firstFailRow
              ? { tick: firstFailRow.tick, signal: firstFailRow.signal, expected: firstFailRow.expected, actual: firstFailRow.actual }
              : null,
            circuitHash,
            vectorsHash,
            mappingHash,
            projectHash,
            didCircuitChangeSinceLast: prevEntry ? prevEntry.circuitHash !== circuitHash : false,
            didVectorsChangeSinceLast: prevEntry ? prevEntry.vectorsHash !== vectorsHash : false,
            didMappingChangeSinceLast: prevEntry ? prevEntry.mappingHash !== mappingHash : false,
          };
          const nextHistory = [...state.verifyRunHistory, ledgerEntry].slice(-50);

          return {
            verifyLastRun: runtimeRun,
            verifyRunHistory: nextHistory,
            scenarioAuthority:
              report.status === 'pass' && runKind === 'verify'
                ? 'verified'
                : deriveScenarioAuthority({
                    projectKind: state.projectKind,
                    activeExampleId: state.activeExampleId,
                    hasVectors: runtimeVectors.length > 0,
                    hasAssertions: runtimeVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
                    dirtySinceVerify: false,
                    verifyStatus: report.status,
                    vectorsAreAutoGenerated: state.projectKind === 'example' && Boolean(state.activeExampleId),
                  }),
            sim: {
              ...state.sim,
              running: false,
            },
            projectHealthCore: {
              ...state.projectHealthCore,
              lastVerify: {
                status: report.status,
                hash: report.deterministicHash,
                runKind,
                reportHash: report.reportHash,
                report,
                failingTick: report.firstFailingTick,
                ranAtIso: report.generatedAtIso,
              },
              dirtySinceVerify: false,
              dirtySinceExport: true,
            },
          };
        });
        return runtimeRun ?? {
          scenarioId: input.scenarioId,
          scenarioName: input.scenarioName,
          runKind:
            input.runKind ??
            (input.assertionMode === true
              ? 'verify'
              : input.assertionMode === false
                ? 'trace'
                : (input.rows ?? []).length > 0
                  ? 'verify'
                  : 'trace'),
          scenarioVersion:
            Number.isFinite(input.scenarioVersion)
              ? Math.max(0, Math.floor(Number(input.scenarioVersion)))
              : undefined,
          scenarioContentHash:
            typeof input.scenarioContentHash === 'string' &&
            input.scenarioContentHash.trim().length > 0
              ? input.scenarioContentHash.trim()
              : undefined,
          scenarioStimulusHash:
            typeof input.scenarioStimulusHash === 'string' &&
            input.scenarioStimulusHash.trim().length > 0
              ? input.scenarioStimulusHash.trim()
              : undefined,
          status: 'fail',
          simulationStatus: 'blocked',
          assertionStatus:
            input.runKind === 'trace' || input.assertionMode === false
              ? 'not-configured'
              : 'not-evaluated',
          deterministicHash: input.deterministicHash,
          reportHash: 'pending',
          generatedAtIso: input.ranAtIso ?? new Date().toISOString(),
          schedule: 'combinational',
          meta: {
            circuitKind: 'combinational',
            clockingProtocol: null,
            samplePoint: 'steady-state',
            tick0Meaning: null,
            clockSignalName: null,
          },
          report: buildVerifyReport({
            scenarioId: input.scenarioId,
            scenarioName: input.scenarioName,
            status: 'fail',
            deterministicHash: input.deterministicHash,
            rows: [],
            vectors: [],
            generatedAtIso: input.ranAtIso ?? new Date().toISOString(),
          }),
          waveform: [],
        };
      },
      clearVerification: () => {
        set((state) => ({
          verifyLastRun: undefined,
          scenarioAuthority: deriveScenarioAuthority({
            projectKind: state.projectKind,
            activeExampleId: state.activeExampleId,
            hasVectors: state.projectVectors.length > 0,
            hasAssertions: state.projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
            dirtySinceVerify: true,
            verifyStatus: null,
            vectorsAreAutoGenerated: state.projectKind === 'example' && Boolean(state.activeExampleId),
          }),
          sim: {
            ...state.sim,
            running: false,
          },
          projectHealthCore: {
            ...state.projectHealthCore,
            lastVerify: undefined,
            dirtySinceVerify: true,
            dirtySinceExport: true,
          },
        }));
      },
      recordVerification: (result) => {
        set((state) => {
          const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
          const scheduleContract = buildDeterministicVerifyContext(
            simulationCircuit,
            toIoMapping(state.projectIoRows)
          ).schedule;
          const signalRoles = deriveIoSignalRoles(state.projectIoRows, scheduleContract);
          const nextRun =
            result.report
              ? ({
                  scenarioId: result.report.scenarioId,
                  scenarioName: result.report.scenarioName,
                  runKind: result.runKind ?? getRuntimeVerifyRunKind(state.verifyLastRun) ?? 'verify',
                  status: result.status,
                  deterministicHash: result.hash,
                  reportHash: result.reportHash ?? result.report.reportHash,
                  firstFailingTick:
                    typeof result.failingTick === 'number'
                      ? result.failingTick
                      : result.report.firstFailingTick,
                  generatedAtIso: result.ranAtIso,
                  schedule: scheduleContract.schedule,
                  scheduleContract: cloneVerifyScheduleContract(scheduleContract),
                  meta: buildVerifyRunMeta(scheduleContract),
                  report: { ...result.report, signalRoles },
                  waveform: buildCanonicalVerifyWaveSamples(result.report, []),
                  evidence: state.verifyLastRun?.evidence,
                } satisfies RuntimeVerifyRun)
              : state.verifyLastRun;

          return {
            verifyLastRun: nextRun,
            scenarioAuthority:
              result.status === 'pass' && (result.runKind ?? 'verify') === 'verify'
                ? 'verified'
                : deriveScenarioAuthority({
                    projectKind: state.projectKind,
                    activeExampleId: state.activeExampleId,
                    hasVectors: state.projectVectors.length > 0,
                    hasAssertions: state.projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
                    dirtySinceVerify: false,
                    verifyStatus: result.status,
                    vectorsAreAutoGenerated: state.projectKind === 'example' && Boolean(state.activeExampleId),
                  }),
            projectHealthCore: {
              ...state.projectHealthCore,
              lastVerify: result,
              dirtySinceVerify: false,
              dirtySinceExport: true,
            },
          };
        });
      },
      recordExport: (result) => {
        set((state) => ({
          projectHealthCore: {
            ...state.projectHealthCore,
            lastExport: result,
            dirtySinceExport: result.status === 'ok' ? false : state.projectHealthCore.dirtySinceExport,
          },
          // Append every generation/download event to the bounded history so
          // the package workspace can compare successive packages and show
          // provenance. lastExport stays the single "current" pointer.
          exportHistory: [...state.exportHistory, result].slice(-20),
        }));
      },
      setProjectIdentity: (input) => {
        set((state) => {
          const nextProjectId = (input.projectId ?? '').trim();
          const nextName = (input.projectName ?? '').trim();
          const nextDescription = input.projectDescription;
          const nextProjectKind = input.projectKind;
          const hasSourceExampleId = Object.prototype.hasOwnProperty.call(input, 'sourceExampleId');
          const hasScenarioAuthority = Object.prototype.hasOwnProperty.call(input, 'scenarioAuthority');
          const hasActiveExampleId = Object.prototype.hasOwnProperty.call(input, 'activeExampleId');
          const shouldMarkDirty = input.markDirty ?? true;
          const changesCircuitTruth = nextProjectKind !== undefined || hasSourceExampleId || hasScenarioAuthority;
          return {
            projectId: nextProjectId.length > 0 ? nextProjectId : state.projectId,
            projectName: nextName.length > 0 ? nextName : state.projectName,
            projectDescription:
              typeof nextDescription === 'string'
                ? nextDescription
                : state.projectDescription,
            projectKind:
              nextProjectKind !== undefined ? nextProjectKind : state.projectKind,
            sourceExampleId:
              hasSourceExampleId
                ? input.sourceExampleId ?? null
                : state.sourceExampleId,
            scenarioAuthority:
              hasScenarioAuthority
                ? input.scenarioAuthority ?? state.scenarioAuthority
                : state.scenarioAuthority,
            activeExampleId:
              hasActiveExampleId
                ? input.activeExampleId ?? null
                : state.activeExampleId,
            projectHealthCore: shouldMarkDirty
              ? {
                  ...state.projectHealthCore,
                  dirtySinceVerify: changesCircuitTruth ? true : state.projectHealthCore.dirtySinceVerify,
                  dirtySinceExport: true,
                }
              : state.projectHealthCore,
          };
        });
      },
      setActiveTop: (name) => {
        const trimmed = name.trim();
        if (trimmed.length === 0) {
          // Empty resets to the name-derived default (a valid, deliberate choice).
          set((state) => ({
            activeTop: buildTopEntityName(state.projectName),
            projectHealthCore: { ...state.projectHealthCore, dirtySinceExport: true },
          }));
          return { ok: true };
        }
        if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(trimmed)) {
          return {
            ok: false,
            error:
              'Top entity must start with a letter and use only letters, digits, or underscores (max 64 characters).',
          };
        }
        set((state) => ({
          activeTop: normalizeTopEntityName(trimmed, buildTopEntityName(state.projectName)),
          projectHealthCore: { ...state.projectHealthCore, dirtySinceExport: true },
        }));
        return { ok: true };
      },
      setSourceModel: (model) => {
        set((state) => ({
          sourceModel: normalizeProjectSourceModel(model),
          projectHealthCore: { ...state.projectHealthCore, dirtySinceExport: true },
        }));
      },
      setImportedWaveform: (waveform) => {
        // Imported evidence is a distinct concern from the native sim; it does
        // not touch dirty-since-export. A new waveform resets the Analyzer view
        // so stale pins/cursor from a prior file never carry over.
        set(() => ({
          importedWaveform: waveform,
          vcdAnalyzer: DEFAULT_VCD_ANALYZER_CONFIG,
        }));
      },
      setVcdAnalyzerConfig: (patch) => {
        set((state) => ({
          vcdAnalyzer: normalizeVcdAnalyzerConfig({ ...state.vcdAnalyzer, ...patch }),
        }));
      },
      addConstraintSet: (name, xdcText) => {
        let id = '';
        let error: string | undefined;
        set((state) => {
          try {
            const next = addConstraintSetToDoc(state.constraintSets, name, xdcText);
            id = next.sets[next.sets.length - 1]?.id ?? '';
            return {
              constraintSets: next,
              projectHealthCore: { ...state.projectHealthCore, dirtySinceExport: true },
            };
          } catch (e) {
            error = e instanceof Error ? e.message : 'Could not add constraint set';
            return state;
          }
        });
        return error ? { ok: false, error } : { ok: true, id };
      },
      removeConstraintSet: (id) => {
        set((state) => ({
          constraintSets: removeConstraintSetFromDoc(state.constraintSets, id),
          projectHealthCore: { ...state.projectHealthCore, dirtySinceExport: true },
        }));
      },
      renameConstraintSet: (id, name) => {
        let error: string | undefined;
        set((state) => {
          try {
            return {
              constraintSets: renameConstraintSetInDoc(state.constraintSets, id, name),
              projectHealthCore: { ...state.projectHealthCore, dirtySinceExport: true },
            };
          } catch (e) {
            error = e instanceof Error ? e.message : 'Could not rename constraint set';
            return state;
          }
        });
        return error ? { ok: false, error } : { ok: true };
      },
      setActiveConstraintSet: (id) => {
        set((state) => ({
          constraintSets: setActiveConstraintSetInDoc(state.constraintSets, id),
          projectHealthCore: { ...state.projectHealthCore, dirtySinceExport: true },
        }));
      },
      startBlankProject: () => {
        set((state) => {
          if (state.projectKind === 'blank' || state.projectKind === 'custom') return state;
          const example = state.activeExampleId ? getIdeExampleById(state.activeExampleId) : null;
          return {
            ...state,
            projectKind: 'blank',
            sourceExampleId: null,
            scenarioAuthority: state.projectVectors.length > 0 ? 'draft' : 'none',
            importMeta: null,
            activeExampleId: null,
            activeLabTaskId: null,
            projectName:
              state.projectName.trim().length > 0 &&
              state.projectName !== DEFAULT_EXAMPLE.name
                ? state.projectName
                : 'Untitled Project',
            projectDescription:
              state.projectDescription.trim().length > 0 &&
              state.projectDescription !== example?.summary
                ? state.projectDescription
                : '',
          };
        });
      },
      replaceWithBlankProject: () => {
        set(() =>
          createEmptyProjectState({
            projectKind: 'blank',
            projectName: 'Untitled Project',
            lastSavedAt: 'Started fresh blank project',
          })
        );
      },
      setLastSavedAt: (label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        set({ lastSavedAt: trimmed });
      },
      setImportMeta: (meta) => {
        set({ importMeta: cloneImportMeta(meta) });
      },
      setActiveLabTaskId: (labTaskId) => {
        set((state) => ({
          activeLabTaskId: normalizeGuidedLabTaskId(labTaskId),
          projectHealthCore: {
            ...state.projectHealthCore,
            dirtySinceExport: true,
          },
        }));
      },
      resetToActiveExample: () => {
        set((state) => {
          const example =
            (state.activeExampleId ? getIdeExampleById(state.activeExampleId) : undefined) ??
            DEFAULT_EXAMPLE;
          return {
            ...stateFromExample(example, createProjectId(example.id)),
            lastSavedAt: `Reset to example: ${example.name}`,
          };
        });
      },
      clearUnsavedState: (label) => {
        set((state) => ({
          lastSavedAt: label ?? state.lastSavedAt,
          projectHealthCore: {
            dirtySinceVerify: false,
            dirtySinceExport: false,
            lastVerify: state.projectHealthCore.lastVerify,
            lastExport: state.projectHealthCore.lastExport,
          },
        }));
      },
      saveMacro: (input) => {
        let macro: MacroDefinition | null = null;
        set((state) => {
          const result = saveMacroToLibrary(state.macros, {
            ...input,
            circuit: state.circuit,
          });
          macro = result.macro;
          return {
            macros: result.library,
          };
        });
        return macro;
      },
      deleteMacro: (macroId) => {
        set((state) => {
          const nextCounts = { ...state.macroInsertionCounts };
          delete nextCounts[macroId];
          return {
            macros: deleteMacroFromLibrary(state.macros, macroId),
            macroInsertionCounts: nextCounts,
          };
        });
      },
      updateMacro: (macroId, updated) => {
        set((state) => ({
          macros: updateMacroInLibrary(state.macros, macroId, updated),
        }));
      },
      instantiateMacro: (macroId, position) => {
        let result: MacroInstantiationResult | null = null;
        set((state) => {
          try {
            const nextInstanceIndex = (state.macroInsertionCounts[macroId] ?? 0) + 1;
            result = instantiateMacroIntoCircuit(state.macros, macroId, state.circuit, position, {
              nextInstanceIndex,
            });

            return {
              ...commitDesignSnapshot(
                state,
                {
                  circuit: cloneCircuit(result.circuit),
                  projectIoRows: cloneIoRows(state.projectIoRows),
                  hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
                  macroInsertionCounts: {
                    ...state.macroInsertionCounts,
                    [macroId]: nextInstanceIndex,
                  },
                },
                {
                  designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                    -state.maxDesignHistory
                  ),
                  designFuture: [],
                }
              ),
            };
          } catch {
            result = null;
            return state;
          }
        });
        return result;
      },
      macros: [],
      macroInsertionCounts: {},
      customComponents: [],
      addCustomComponent: (def) => {
        registerCompositeNode(def);
        set((state) => {
          const hierarchy = normalizeProjectHierarchy(undefined, [
            ...state.customComponents.filter((component) => component.name !== def.name),
            def,
          ]);
          return {
            hierarchy,
            customComponents: hierarchy.modules.map(toCompositeDefinition),
          };
        });
      },
      setActiveModule: (moduleId) => {
        set((state) => {
          const requested = moduleId.trim();
          if (
            requested !== TOP_MODULE_ID &&
            !state.hierarchy.modules.some((module) => module.id === requested)
          ) {
            return state;
          }
          return {
            hierarchy: { ...cloneProjectHierarchy(state.hierarchy), activeModuleId: requested },
          };
        });
      },
      createModuleFromSelection: (input) => {
        let created: CreateModuleResult | null = null;
        set((state) => {
          const activeModuleId = state.hierarchy.activeModuleId;
          try {
            if (activeModuleId === TOP_MODULE_ID) {
              created = createNativeModuleFromSelection(state.circuit, state.hierarchy, input);
              const customComponents = created.hierarchy.modules.map(toCompositeDefinition);
              for (const definition of customComponents) registerCompositeNode(definition);
              return commitDesignSnapshot(
                state,
                {
                  circuit: cloneCircuit(created.circuit),
                  hierarchy: cloneProjectHierarchy(created.hierarchy),
                  projectIoRows: cloneIoRows(state.projectIoRows),
                  hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
                  macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
                },
                {
                  designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                    -state.maxDesignHistory,
                  ),
                  designFuture: [],
                },
              );
            }
            // Nested: create the child module from the ACTIVE module's circuit,
            // then write the instance-replaced circuit back into the active
            // module AND re-derive its port internal-refs so the parent's ports
            // now resolve through the new child instance (not the extracted
            // nodes). The top circuit is untouched — a module-definition edit.
            const activeModule = state.hierarchy.modules.find((module) => module.id === activeModuleId);
            if (!activeModule) return state;
            created = createNativeModuleFromSelection(activeModule.circuit, state.hierarchy, input);
            const updatedCircuit = created.circuit;
            const nowIso = new Date().toISOString();
            const hierarchy: ProjectHierarchyDocument = {
              ...cloneProjectHierarchy(created.hierarchy),
              activeModuleId,
              modules: created.hierarchy.modules.map((module) =>
                module.id === activeModuleId
                  ? rederiveModulePortRefs({
                      ...cloneModuleDefinition(module),
                      circuit: cloneCircuit(updatedCircuit),
                      updatedAt: nowIso,
                    })
                  : cloneModuleDefinition(module),
              ),
            };
            if (hierarchyCycleModules(hierarchy).includes(activeModuleId)) {
              created = null;
              return state;
            }
            const customComponents = hierarchy.modules.map(toCompositeDefinition);
            for (const definition of customComponents) registerCompositeNode(definition);
            return commitModuleDefinitionSnapshot(state, hierarchy);
          } catch {
            created = null;
            return state;
          }
        });
        return created;
      },
      placeModuleInstance: (moduleId, position, instanceName) => {
        let placed: Node | null = null;
        set((state) => {
          const definition = state.hierarchy.modules.find((module) => module.id === moduleId);
          if (!definition) return state;
          const activeModuleId = state.hierarchy.activeModuleId;
          try {
            // Top-level placement: the instance drops into the project's top circuit.
            if (activeModuleId === TOP_MODULE_ID) {
              const result = placeNativeModuleInstance(state.circuit, definition, position, instanceName);
              placed = result.instance;
              return commitDesignSnapshot(
                state,
                {
                  circuit: result.circuit,
                  hierarchy: cloneProjectHierarchy(state.hierarchy),
                  projectIoRows: cloneIoRows(state.projectIoRows),
                  hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
                  macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
                },
                {
                  designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                    -state.maxDesignHistory,
                  ),
                  designFuture: [],
                },
              );
            }
            // Nested placement: the instance drops into the currently-edited module
            // definition's own circuit, so a module can contain another module.
            const active = state.hierarchy.modules.find((module) => module.id === activeModuleId);
            if (!active) return state;
            const result = placeNativeModuleInstance(active.circuit, definition, position, instanceName);
            const hierarchy: ProjectHierarchyDocument = {
              ...cloneProjectHierarchy(state.hierarchy),
              modules: state.hierarchy.modules.map((module) =>
                module.id === activeModuleId
                  ? { ...module, circuit: cloneCircuit(result.circuit), updatedAt: new Date().toISOString() }
                  : cloneModuleDefinition(module),
              ),
            };
            // Reject a placement that would make a module instantiate itself
            // directly or indirectly. The project stays valid and unchanged.
            if (hierarchyCycleModules(hierarchy).includes(activeModuleId)) {
              placed = null;
              return state;
            }
            placed = result.instance;
            const customComponents = hierarchy.modules.map(toCompositeDefinition);
            for (const registered of customComponents) registerCompositeNode(registered);
            return commitModuleDefinitionSnapshot(state, hierarchy);
          } catch {
            placed = null;
            return state;
          }
        });
        return placed;
      },
      updateActiveModuleCircuit: (nextCircuit) => {
        set((state) => {
          const activeModuleId = state.hierarchy.activeModuleId;
          if (activeModuleId === TOP_MODULE_ID) {
            return commitDesignSnapshot(
              state,
              {
                circuit: cloneCircuit(nextCircuit),
                hierarchy: cloneProjectHierarchy(state.hierarchy),
                projectIoRows: cloneIoRows(state.projectIoRows),
                hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
                macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
              },
              {
                designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
                  -state.maxDesignHistory,
                ),
                designFuture: [],
              },
            );
          }
          const active = state.hierarchy.modules.find((module) => module.id === activeModuleId);
          if (!active) return state;
          const hierarchy: ProjectHierarchyDocument = {
            ...cloneProjectHierarchy(state.hierarchy),
            modules: state.hierarchy.modules.map((module) =>
              module.id === activeModuleId
                ? { ...module, circuit: cloneCircuit(nextCircuit), updatedAt: new Date().toISOString() }
                : cloneModuleDefinition(module),
            ),
          };
          // Reject an edit that would make a module instantiate itself directly
          // or indirectly. The project stays valid and unchanged on rejection.
          if (hierarchyCycleModules(hierarchy).includes(activeModuleId)) {
            return state;
          }
          const customComponents = hierarchy.modules.map(toCompositeDefinition);
          for (const definition of customComponents) registerCompositeNode(definition);
          return commitModuleDefinitionSnapshot(state, hierarchy);
        });
      },
      renameModuleInstance: (nodeId, requestedName) => {
        set((state) => {
          const nextName = requestedName.trim();
          if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(nextName)) return state;
          if (
            state.circuit.nodes.some(
              (node) => node.id !== nodeId && readInstanceName(node).toLowerCase() === nextName.toLowerCase(),
            )
          ) return state;
          const circuit = cloneCircuit(state.circuit);
          const node = circuit.nodes.find((entry) => entry.id === nodeId);
          if (!node || !node.config?.moduleDefinitionId) return state;
          node.label = nextName;
          node.config = { ...(node.config ?? {}), instanceName: nextName, label: nextName };
          return commitDesignSnapshot(
            state,
            {
              circuit,
              hierarchy: cloneProjectHierarchy(state.hierarchy),
              projectIoRows: cloneIoRows(state.projectIoRows),
              hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
              macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
            },
            {
              designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(-state.maxDesignHistory),
              designFuture: [],
            },
          );
        });
      },
      duplicateModuleDefinition: (moduleId) => {
        let duplicatedId: string | null = null;
        set((state) => {
          const source = state.hierarchy.modules.find((module) => module.id === moduleId);
          if (!source) return state;
          let suffix = 2;
          let displayName = `${source.displayName} Copy`;
          while (state.hierarchy.modules.some((module) => module.displayName === displayName)) {
            displayName = `${source.displayName} Copy ${suffix++}`;
          }
          const name = displayName.replace(/[^A-Za-z0-9]+/g, '');
          duplicatedId = `module-${name.toLowerCase()}`;
          const duplicate = {
            ...cloneModuleDefinition(source),
            id: duplicatedId,
            name,
            displayName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const hierarchy = {
            ...cloneProjectHierarchy(state.hierarchy),
            modules: [...state.hierarchy.modules.map(cloneModuleDefinition), duplicate],
          };
          const customComponents = hierarchy.modules.map(toCompositeDefinition);
          for (const definition of customComponents) registerCompositeNode(definition);
          return { hierarchy, customComponents, lastSavedAt: `Duplicated module: ${displayName}` };
        });
        return duplicatedId;
      },
      deleteModuleDefinition: (moduleId) => {
        let deleted = false;
        set((state) => {
          if (moduleUsageCount(state.circuit, moduleId) > 0) return state;
          if (!state.hierarchy.modules.some((module) => module.id === moduleId)) return state;
          deleted = true;
          const hierarchy = {
            ...cloneProjectHierarchy(state.hierarchy),
            activeModuleId:
              state.hierarchy.activeModuleId === moduleId ? TOP_MODULE_ID : state.hierarchy.activeModuleId,
            modules: state.hierarchy.modules.filter((module) => module.id !== moduleId).map(cloneModuleDefinition),
          };
          return {
            hierarchy,
            customComponents: hierarchy.modules.map(toCompositeDefinition),
            lastSavedAt: 'Deleted unused module definition',
          };
        });
        return deleted;
      },
    }),
    {
      name: STORAGE_KEY,
      // Keep the existing persistence envelope version: hierarchy is an additive,
      // optional field normalized by mergePersistedRuntimeState for legacy saves.
      version: 5,
      merge: (persistedState, currentState) =>
        mergePersistedRuntimeState(persistedState, currentState as ProjectRuntimeState),
      partialize: (state): PersistedRuntimeState => ({
        projectId: state.projectId,
        projectName: state.projectName,
        projectDescription: state.projectDescription,
        lastSavedAt: state.lastSavedAt,
        activeTop: state.activeTop,
        projectKind: state.projectKind,
        sourceExampleId: state.sourceExampleId,
        scenarioAuthority: state.scenarioAuthority,
        importMeta: cloneImportMeta(state.importMeta),
        activeExampleId: state.activeExampleId,
        activeLabTaskId: state.activeLabTaskId,
        hardwareMappingV2: structuredClone(state.hardwareMappingV2),
        projectIoRows: cloneIoRows(state.projectIoRows),
        projectVectors: cloneVectors(state.projectVectors),
        scenarios: state.scenarios.map((s) => ({
          ...s,
          vectors: s.vectors.map((v) => ({ ...v, inputs: { ...v.inputs }, expected: { ...(v.expected ?? {}) } })),
          steps: s.steps?.map(cloneScenarioStep),
          sequentialPolicy: cloneScenarioSequentialPolicy(s.sequentialPolicy),
          probes: normalizeScenarioProbes(s.probes),
        })),
        activeScenarioId: state.activeScenarioId,
        customVectors: [...(state.customVectors ?? [])],
        circuit: cloneCircuit(state.circuit),
        hierarchy: cloneProjectHierarchy(state.hierarchy),
        sourceModel: normalizeProjectSourceModel(state.sourceModel),
        designPast: cloneDesignHistoryPast(state.designPast, state.maxDesignHistory),
        designFuture: cloneDesignHistoryFuture(state.designFuture, state.maxDesignHistory),
        maxDesignHistory: state.maxDesignHistory,
        designRevision: state.designRevision,
        verifyLastRun: state.verifyLastRun
          ? cloneVerifyRun(state.verifyLastRun)
          : undefined,
        verifyRunHistory: state.verifyRunHistory.slice(-50),
        exportHistory: state.exportHistory.slice(-20),
        sim: cloneSimState(state.sim),
        importedWaveform: state.importedWaveform ? structuredClone(state.importedWaveform) : null,
        vcdAnalyzer: normalizeVcdAnalyzerConfig(state.vcdAnalyzer),
        constraintSets: normalizeConstraintSets(state.constraintSets),
        projectHealthCore: {
          lastVerify: state.projectHealthCore.lastVerify,
          lastExport: state.projectHealthCore.lastExport,
          dirtySinceVerify: state.projectHealthCore.dirtySinceVerify,
          dirtySinceExport: state.projectHealthCore.dirtySinceExport,
        },
        macros: state.macros,
        macroInsertionCounts: state.macroInsertionCounts,
        customComponents: state.customComponents,
      }),
    }
  )
);

export function mergePersistedRuntimeState(
  persistedState: unknown,
  currentState: ProjectRuntimeState
): ProjectRuntimeState {
  if (!persistedState || typeof persistedState !== 'object') {
    return currentState;
  }

  const candidate = persistedState as Partial<PersistedRuntimeState>;
  if (
    !candidate.circuit ||
    typeof candidate.circuit !== 'object' ||
    !Array.isArray((candidate.circuit as Circuit).nodes) ||
    !Array.isArray((candidate.circuit as Circuit).connections)
  ) {
    return currentState;
  }
  const normalizedRows = normalizePersistedIoRows(
    candidate.projectIoRows,
    []
  );
  const normalizedVectors = normalizePersistedVectors(
    candidate.projectVectors,
    []
  );

  let normalizedProject: RBProject;
  try {
    normalizedProject = normalizeRBProject({
      kind: 'rb-project',
      version: 1,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
      name:
        typeof candidate.projectName === 'string' && candidate.projectName.trim().length > 0
          ? candidate.projectName
          : currentState.projectName,
      description:
        typeof candidate.projectDescription === 'string'
          ? candidate.projectDescription
          : currentState.projectDescription,
      circuit: candidate.circuit,
      ioMapping: toIoMapping(normalizedRows),
      hardwareMappingV2: (candidate as Partial<PersistedRuntimeState>).hardwareMappingV2,
      vectors: normalizedVectors,
      macros: Array.isArray(candidate.macros) ? candidate.macros : currentState.macros,
      customComponents: Array.isArray(candidate.customComponents)
        ? candidate.customComponents
        : currentState.customComponents,
      hierarchy: candidate.hierarchy ?? currentState.hierarchy,
      meta: {
        projectId:
          typeof candidate.projectId === 'string' && candidate.projectId.trim().length > 0
            ? candidate.projectId
            : currentState.projectId,
        labId: normalizeGuidedLabTaskId(candidate.activeLabTaskId) ?? undefined,
      },
    });
  } catch {
    return currentState;
  }

  const circuit = cloneCircuit(normalizedProject.circuit);
  const hierarchy = normalizeProjectHierarchy(
    normalizedProject.hierarchy,
    normalizedProject.customComponents ?? [],
  );
  const customComponents = hierarchy.modules.map(toCompositeDefinition);
  for (const definition of customComponents) registerCompositeNode(definition);
  const elaboratedCircuit = elaborateProjectHierarchy(circuit, hierarchy);
  const legacyProjectIoRows = ioRowsFromProject(normalizedProject);
  const {
    hardwareMappingV2,
    projectIoRows,
  } = deriveAuthoritativeHardwareState(circuit, pickHardwareMappingV2FromProject(normalizedProject));
  const projectVectors = preserveCompatibleVectorAuthorship(
    cloneVectors(normalizedProject.vectors ?? []),
    legacyProjectIoRows,
    projectIoRows
  );
  const rawVerifyLastRun = tryCloneVerifyRun(candidate.verifyLastRun);
  const invalidateVerifyTrust = hasLegacyVerifyTrust(rawVerifyLastRun, candidate.projectHealthCore);
  const verifyLastRun = invalidateVerifyTrust ? undefined : rawVerifyLastRun;
  const verifyRunHistory = invalidateVerifyTrust ? [] : normalizeVerifyRunHistory(candidate.verifyRunHistory);
  const restoredVerifyProjectHash = buildCurrentVerifyProjectHash({
    circuit: elaboratedCircuit,
    projectVectors,
    projectIoRows,
  });
  const latestVerifyLedgerEntry = verifyRunHistory.at(-1);
  const hasRestoredVerifyProjectHashMismatch =
    !invalidateVerifyTrust &&
    Boolean(latestVerifyLedgerEntry) &&
    latestVerifyLedgerEntry?.projectHash !== restoredVerifyProjectHash;
  const sim = normalizePersistedSimState(candidate.sim, elaboratedCircuit, projectIoRows);
  const maxDesignHistory = normalizePersistedMaxDesignHistory(
    candidate.maxDesignHistory,
    currentState.maxDesignHistory
  );
  const designPast = normalizePersistedDesignPast(candidate.designPast, maxDesignHistory);
  const designFuture = normalizePersistedDesignFuture(candidate.designFuture, maxDesignHistory);
  const designRevision = normalizePersistedDesignRevision(candidate.designRevision);
  const projectHealthCore = normalizePersistedProjectHealth(
    candidate.projectHealthCore,
    verifyLastRun,
    currentState.projectHealthCore,
    invalidateVerifyTrust
  );
  const hasExplicitLegacyVerifyLedgerGap =
    candidate.verifyLastRun === undefined &&
    Array.isArray(candidate.verifyRunHistory) &&
    candidate.verifyRunHistory.length === 0;
  const hasRestoredVerifyTrustWithoutLedger =
    hasExplicitLegacyVerifyLedgerGap &&
    projectHealthCore.lastVerify?.status === 'pass' &&
    isAuthoritativeVerifyHash(projectHealthCore.lastVerify.hash) &&
    !verifyLastRun;
  const restoredExportHash = computeRestoredExportHash(normalizedProject);
  const hasExactPackageSourceReceipt = Boolean(
    projectHealthCore.lastExport?.packageHash &&
    /^[a-f0-9]{64}$/i.test(projectHealthCore.lastExport.packageHash) &&
    projectHealthCore.lastExport.hash?.startsWith('pkgsrc_') &&
    projectHealthCore.lastExport.sourceHashes?.export === projectHealthCore.lastExport.hash
  );
  const hasRestoredLegacyExportWithoutHash =
    projectHealthCore.lastExport?.status === 'ok' &&
    (!projectHealthCore.lastExport.hash || projectHealthCore.lastExport.hash.length === 0);
  const hasRestoredExportHashMismatch =
    !hasExactPackageSourceReceipt &&
    projectHealthCore.lastExport?.status === 'ok' &&
    typeof projectHealthCore.lastExport.hash === 'string' &&
    projectHealthCore.lastExport.hash.length > 0 &&
    (
      typeof restoredExportHash !== 'string' ||
      restoredExportHash.length === 0 ||
      projectHealthCore.lastExport.hash !== restoredExportHash
    );
  const { scenarios: repairedScenarios, activeScenarioId } =
    Array.isArray(candidate.scenarios) && (candidate.scenarios as unknown[]).length > 0
      ? repairScenarioLibrary(candidate.scenarios, candidate.activeScenarioId, projectVectors)
      : migrateProjectVectorsToScenario(projectVectors);
  const scenarios = repairedScenarios.map((scenario) => ({
    ...scenario,
    steps: reconcileScenarioStepsForLiveIo(
      normalizeScenarioSteps(scenario.steps),
      legacyProjectIoRows,
      projectIoRows
    ),
    sequentialPolicy: reconcileScenarioSequentialPolicyForLiveIo(
      scenario.sequentialPolicy,
      legacyProjectIoRows,
      projectIoRows
    ),
    probes: normalizeScenarioProbes(scenario.probes),
    vectors: preserveCompatibleVectorAuthorship(
      cloneVectors(scenario.vectors),
      legacyProjectIoRows,
      projectIoRows
    ),
  }));
  const persistedProjectKind = normalizeProjectKind(
    candidate.projectKind ?? normalizedProject.meta?.projectKind,
    currentState.projectKind
  );
  const rawPersistedSourceExampleId =
    typeof candidate.sourceExampleId === 'string'
      ? candidate.sourceExampleId
      : typeof normalizedProject.meta?.sourceExampleId === 'string'
        ? normalizedProject.meta.sourceExampleId
        : typeof candidate.activeExampleId === 'string'
          ? candidate.activeExampleId
          : null;
  const inferredDetachedExample = inferDetachedExampleProvenance({
    projectKind: persistedProjectKind,
    sourceExampleId: rawPersistedSourceExampleId,
    activeExampleId:
      typeof candidate.activeExampleId === 'string' ? candidate.activeExampleId : null,
    projectName: normalizedProject.name,
    projectDescription: normalizedProject.description ?? '',
  });
  const persistedSourceExampleId =
    rawPersistedSourceExampleId ?? inferredDetachedExample?.id ?? null;
  const restoredProjectKind =
    persistedProjectKind !== 'example' && inferredDetachedExample
      ? 'custom'
      : persistedProjectKind;
  const persistedScenarioAuthority = normalizeScenarioAuthority(
    candidate.scenarioAuthority ?? normalizedProject.meta?.scenarioAuthority,
    deriveScenarioAuthority({
      projectKind: restoredProjectKind,
      activeExampleId: restoredProjectKind === 'example' ? persistedSourceExampleId : null,
      hasVectors: projectVectors.length > 0,
      hasAssertions: projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
      dirtySinceVerify: projectHealthCore.dirtySinceVerify,
      verifyStatus: projectHealthCore.lastVerify?.status ?? null,
      vectorsAreAutoGenerated: restoredProjectKind === 'example',
    })
  );
  const restoredIdentity = resolveDetachedExampleIdentity({
    projectKind: restoredProjectKind,
    inferredDetachedExample,
    projectName: normalizedProject.name,
    projectDescription: normalizedProject.description ?? '',
  });
  const shouldResetDetachedStarterCompareState =
    restoredProjectKind !== 'example' &&
    Boolean(persistedSourceExampleId) &&
    persistedScenarioAuthority === 'starter' &&
    projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0);
  const detachedProjectVectors = shouldResetDetachedStarterCompareState
    ? stripExpectedOutputs(projectVectors)
    : projectVectors;
  const detachedScenarios = shouldResetDetachedStarterCompareState
    ? scenarios.map((scenario) => {
        const vectors = stripExpectedOutputs(scenario.vectors);
        return {
          ...scenario,
          vectors,
          steps: scenario.steps ? deriveScenarioStepsFromVectors(vectors) : undefined,
        };
      })
    : scenarios;
  const detachedCustomVectors = preserveCompatibleVectorAuthorship(
    cloneVectors(
      Array.isArray(candidate.customVectors) ? (candidate.customVectors as CustomTestVector[]) : []
    ).map((vector) => ({
      ...vector,
      expected: shouldResetDetachedStarterCompareState ? {} : vector.expected,
    })),
    legacyProjectIoRows,
    projectIoRows
  );
  const detachedScenarioAuthority = shouldResetDetachedStarterCompareState
    ? deriveScenarioAuthority({
        projectKind: restoredProjectKind,
        activeExampleId: restoredProjectKind === 'example' ? persistedSourceExampleId : null,
        hasVectors: detachedProjectVectors.length > 0,
        hasAssertions: false,
        dirtySinceVerify: true,
        verifyStatus: null,
        vectorsAreAutoGenerated: false,
      })
    : persistedScenarioAuthority;
  const detachedVerifyLastRun = shouldResetDetachedStarterCompareState ? undefined : verifyLastRun;
  const detachedVerifyRunHistory = shouldResetDetachedStarterCompareState ? [] : verifyRunHistory;
  const detachedProjectHealthCore = shouldResetDetachedStarterCompareState
    ? {
        ...projectHealthCore,
        lastVerify: undefined,
        dirtySinceVerify: true,
        dirtySinceExport: true,
      }
    : projectHealthCore;

  return {
    ...currentState,
    projectId:
      normalizedProject.meta?.projectId?.trim() || currentState.projectId,
    projectName: restoredIdentity.projectName,
    projectDescription: restoredIdentity.projectDescription,
    lastSavedAt:
      typeof candidate.lastSavedAt === 'string' && candidate.lastSavedAt.trim().length > 0
        ? candidate.lastSavedAt.trim()
        : currentState.lastSavedAt,
    activeTop:
      typeof candidate.activeTop === 'string' && candidate.activeTop.trim().length > 0
        ? candidate.activeTop
        : resolveActiveTopEntity(undefined, restoredIdentity.projectName),
    projectKind: restoredProjectKind,
    sourceExampleId: persistedSourceExampleId,
    scenarioAuthority: detachedScenarioAuthority,
    importMeta:
      restoredProjectKind === 'import'
        ? normalizePersistedImportMeta(candidate.importMeta)
        : null,
    activeExampleId: restoredProjectKind === 'example' ? persistedSourceExampleId : null,
    activeLabTaskId: normalizeGuidedLabTaskId(candidate.activeLabTaskId ?? normalizedProject.meta?.labId),
    hardwareMappingV2,
    projectIoRows,
    projectVectors: detachedProjectVectors,
    scenarios: detachedScenarios,
    activeScenarioId,
    customVectors: detachedCustomVectors,
    circuit,
    hierarchy,
    // Restore the persisted source model; normalize tolerates absent/legacy state.
    sourceModel: normalizeProjectSourceModel(candidate.sourceModel),
    designPast,
    designFuture,
    maxDesignHistory,
    designRevision,
    verifyLastRun: detachedVerifyLastRun,
    verifyRunHistory: detachedVerifyRunHistory,
    exportHistory: Array.isArray(candidate.exportHistory)
      ? (candidate.exportHistory as ProjectHealthExportResult[]).slice(-20)
      : [],
    sim: {
      ...sim,
      probes: normalizeScenarioProbes(
        detachedScenarios.find((scenario) => scenario.id === activeScenarioId)?.probes
      ).map((entry) => ({ key: entry.key, label: entry.label ?? entry.key })),
    },
    // Imported waveform + Analyzer config survive reload (external evidence held
    // in browser-local state, never in the exported project format).
    importedWaveform:
      candidate.importedWaveform && typeof candidate.importedWaveform === 'object'
        ? structuredClone(candidate.importedWaveform as ProviderWaveform)
        : null,
    vcdAnalyzer: normalizeVcdAnalyzerConfig(candidate.vcdAnalyzer),
    constraintSets: normalizeConstraintSets(candidate.constraintSets),
    projectHealthCore:
      hasRestoredVerifyTrustWithoutLedger ||
      hasRestoredVerifyProjectHashMismatch ||
      hasRestoredLegacyExportWithoutHash ||
      hasRestoredExportHashMismatch
        ? {
            ...detachedProjectHealthCore,
            ...(
              hasRestoredVerifyTrustWithoutLedger || hasRestoredVerifyProjectHashMismatch
                ? { dirtySinceVerify: true }
                : {}
            ),
            ...(
              hasRestoredVerifyTrustWithoutLedger ||
              hasRestoredLegacyExportWithoutHash ||
              hasRestoredExportHashMismatch
                ? { dirtySinceExport: true }
                : {}
            ),
          }
        : detachedProjectHealthCore,
    macros: normalizedProject.macros ?? [],
    macroInsertionCounts: normalizeMacroInsertionCounts(candidate.macroInsertionCounts),
    customComponents,
  };
}

function computeRestoredExportHash(project: RBProject): string | undefined {
  try {
    if (!project.circuit || !project.ioMapping) {
      return undefined;
    }
    return exportProjectAsBasys3(flattenProjectMacros(project)).determinismHash;
  } catch (error) {
    console.warn('[projectRuntime] failed to compute restored export hash', {
      projectId: project.meta?.projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

function inferDetachedExampleProvenance(input: {
  projectKind: ProjectKind;
  sourceExampleId: string | null;
  activeExampleId: string | null;
  projectName: string;
  projectDescription: string;
}): IdeExampleDefinition | null {
  if (input.projectKind === 'example') {
    return getIdeExampleById(input.sourceExampleId ?? input.activeExampleId ?? '');
  }
  const directExampleId = input.sourceExampleId ?? input.activeExampleId;
  if (directExampleId) {
    return getIdeExampleById(directExampleId);
  }
  const normalizedName = input.projectName.trim().toLowerCase();
  const normalizedDescription = input.projectDescription.trim().toLowerCase();
  if (!normalizedName || !normalizedDescription) return null;
  return (
    IDE_EXAMPLES.find(
      (example) =>
        example.name.trim().toLowerCase() === normalizedName &&
        example.summary.trim().toLowerCase() === normalizedDescription
    ) ?? null
  );
}

function resolveDetachedExampleIdentity(input: {
  projectKind: ProjectKind;
  inferredDetachedExample: IdeExampleDefinition | null;
  projectName: string;
  projectDescription: string;
  fallbackProjectName?: string;
}): { projectName: string; projectDescription: string } {
  const fallbackProjectName = input.fallbackProjectName?.trim() || 'Imported project';
  const baseProjectName = input.projectName || fallbackProjectName;
  const baseProjectDescription = input.projectDescription ?? '';
  if (!input.inferredDetachedExample || input.projectKind === 'example') {
    return {
      projectName: baseProjectName,
      projectDescription: baseProjectDescription,
    };
  }

  const trimmedProjectName = baseProjectName.trim();
  const trimmedProjectDescription = baseProjectDescription.trim();
  const detachedExampleName = input.inferredDetachedExample.name.trim();
  const detachedExampleSummary = input.inferredDetachedExample.summary.trim();
  const shouldRecoverStarterIdentity =
    trimmedProjectName.length === 0 ||
    (trimmedProjectName === 'Untitled Project' && trimmedProjectDescription.length === 0) ||
    (
      trimmedProjectName === detachedExampleName &&
      (
        trimmedProjectDescription.length === 0 ||
        trimmedProjectDescription === detachedExampleSummary
      )
    );

  if (!shouldRecoverStarterIdentity) {
    return {
      projectName: baseProjectName,
      projectDescription: baseProjectDescription,
    };
  }

  return {
    projectName: detachedExampleName,
    projectDescription: detachedExampleSummary,
  };
}

/** Seed one constraint set per imported XDC constraint file (deterministic). */
function buildConstraintSetsFromSources(model: ProjectSourceModel): ConstraintSetsDocument {
  let doc = createEmptyConstraintSets();
  for (const file of model.files) {
    if (file.fileset !== 'constraint' || file.language !== 'xdc') continue;
    try {
      doc = addConstraintSetToDoc(doc, file.path, file.text);
    } catch {
      // Duplicate names are skipped; imported paths are unique in practice.
    }
  }
  return doc;
}

function createEmptyProjectState(
  input: {
    projectId?: string;
    projectName?: string;
    projectKind?: ProjectKind;
    lastSavedAt?: string;
  } = {}
): RuntimeSeedState {
  const circuit: Circuit = { nodes: [], connections: [] };
  const hardwareMappingV2 = structuredClone(EMPTY_HARDWARE_MAPPING_V2);
  const projectIoRows: ProjectIoRow[] = deriveProjectIoRowsFromCircuitAndV2(circuit, hardwareMappingV2);
  const projectVectors: TestVector[] = [];
  const defaultScenario = createDefaultScenario(projectVectors);
  const projectName = input.projectName ?? 'Untitled Project';
  return {
    projectId: input.projectId ?? createProjectId('blank'),
    projectName,
    projectDescription: '',
    lastSavedAt: input.lastSavedAt ?? 'Project home',
    activeTop: buildTopEntityName(projectName),
    projectKind: input.projectKind ?? 'home',
    sourceExampleId: null,
    scenarioAuthority: 'none',
    importMeta: null,
    activeExampleId: null,
    activeLabTaskId: null,
    hardwareMappingV2,
    projectIoRows,
    projectVectors,
    scenarios: [defaultScenario],
    activeScenarioId: defaultScenario.id,
    customVectors: [],
    circuit,
    hierarchy: createEmptyProjectHierarchy(),
    sourceModel: createEmptyProjectSourceModel(),
    importedWaveform: null,
    vcdAnalyzer: DEFAULT_VCD_ANALYZER_CONFIG,
    constraintSets: createEmptyConstraintSets(),
    designPast: [],
    designFuture: [],
    maxDesignHistory: DEFAULT_MAX_DESIGN_HISTORY,
    designRevision: 0,
    verifyLastRun: undefined,
    verifyRunHistory: [],
    exportHistory: [],
    sim: initializeSimulationStateForCircuit(circuit, projectIoRows),
    projectHealthCore: {
      dirtySinceVerify: false,
      dirtySinceExport: false,
    },
    macros: [],
    macroInsertionCounts: {},
    customComponents: [],
  };
}

function stateFromExample(
  example: IdeExampleDefinition,
  projectId = createProjectId(example.id)
): RuntimeSeedState {
  const circuit = cloneCircuit(example.circuit);
  const enriched = enrichProjectIoRowsWithV2Metadata(cloneIoRows(example.ioRows), undefined);
  const hardwareMappingV2 = buildHardwareMappingV2FromProjectIoRows(enriched);
  const projectIoRows = deriveProjectIoRowsFromCircuitAndV2(circuit, hardwareMappingV2);
  const hierarchy = example.hierarchy
    ? normalizeProjectHierarchy(cloneProjectHierarchy(example.hierarchy), [])
    : createEmptyProjectHierarchy();
  const hierarchyComponents = hierarchy.modules.map(toCompositeDefinition);
  for (const def of hierarchyComponents) {
    try {
      registerCompositeNode(def);
    } catch (e) {
      console.warn('Failed to register starter module:', def.name, e);
    }
  }
  const baseSimState = initializeSimulationStateForCircuit(
    hierarchy.modules.length > 0 ? elaborateProjectHierarchy(circuit, hierarchy) : circuit,
    projectIoRows
  );
  // Build kit probes from example.probes if defined
  const kitProbes = (example.probes ?? []).map((p) => ({
    key: `${p.nodeId}.${p.portName}`,
    label: p.label,
  }));
  const sim = kitProbes.length > 0 ? { ...baseSimState, probes: kitProbes } : baseSimState;
  return {
    projectId,
    projectName: example.name,
    projectDescription: example.summary,
    lastSavedAt: 'Seeded example',
    activeTop: resolveActiveTopEntity(undefined, example.name),
    projectKind: 'example',
    sourceExampleId: example.id,
    scenarioAuthority: example.vectors.length > 0 ? 'starter' : 'none',
    importMeta: null,
    activeExampleId: example.id,
    activeLabTaskId: null,
    hardwareMappingV2,
    projectIoRows,
    projectVectors: cloneVectors(example.vectors),
    scenarios: [createDefaultScenario(example.vectors)],
    activeScenarioId: DEFAULT_SCENARIO_ID,
    customVectors: [],
    circuit,
    hierarchy,
    sourceModel: createEmptyProjectSourceModel(),
    importedWaveform: null,
    vcdAnalyzer: DEFAULT_VCD_ANALYZER_CONFIG,
    constraintSets: createEmptyConstraintSets(),
    designPast: [],
    designFuture: [],
    maxDesignHistory: DEFAULT_MAX_DESIGN_HISTORY,
    designRevision: 0,
    verifyLastRun: undefined,
    verifyRunHistory: [],
    exportHistory: [],
    sim,
    projectHealthCore: {
      dirtySinceVerify: false,
      dirtySinceExport: false,
    },
    macros: [],
    macroInsertionCounts: {},
    customComponents: hierarchyComponents,
  };
}

function syncActiveScenarioVectors(
  scenarios: VerifyScenario[],
  activeScenarioId: string,
  vectors: TestVector[],
  preserveExplicitSteps = false
): { scenarios: VerifyScenario[]; activeScenarioId: string } {
  const nextVectors = cloneVectors(vectors);
  if (scenarios.length === 0) {
    const defaultScenario = createDefaultScenario(nextVectors);
    return {
      scenarios: [defaultScenario],
      activeScenarioId: defaultScenario.id,
    };
  }

  const resolvedActiveScenarioId = scenarios.some((scenario) => scenario.id === activeScenarioId)
    ? activeScenarioId
    : scenarios[0].id;
  const nextVectorsSignature = stableSerialize(nextVectors);

  return {
    activeScenarioId: resolvedActiveScenarioId,
    scenarios: scenarios.map((scenario) => {
      if (scenario.id !== resolvedActiveScenarioId) return scenario;
      const currentVectors = cloneVectors(Array.isArray(scenario.vectors) ? scenario.vectors : []);
      const preservesExplicitStimulus =
        Boolean(scenario.steps?.length) &&
        (
          preserveExplicitSteps ||
          stableSerialize(vectorStimulusOnly(materializeScenarioVectors(scenario))) ===
            stableSerialize(vectorStimulusOnly(nextVectors))
        );
      const nextSteps = scenario.steps
        ? preservesExplicitStimulus
          ? scenario.steps.map(cloneScenarioStep)
          : deriveScenarioStepsFromVectors(nextVectors)
        : undefined;
      if (stableSerialize(currentVectors) === nextVectorsSignature) {
        return {
          ...scenario,
          vectors: nextVectors,
          steps: nextSteps,
        };
      }
      return stampScenario({
        ...scenario,
        vectors: nextVectors,
        steps: nextSteps,
      });
    }),
  };
}

function vectorStimulusOnly(vectors: TestVector[]): Array<Pick<TestVector, 'tick' | 'inputs'>> {
  return vectors.map((vector) => ({
    tick: vector.tick,
    inputs: { ...(vector.inputs ?? {}) },
  }));
}

function resolveActiveScenarioVectors(
  state: Pick<ProjectRuntimeState, 'scenarios' | 'activeScenarioId' | 'projectVectors'>
): TestVector[] {
  const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  if (!activeScenario) return cloneVectors(state.projectVectors);
  return cloneVectors(materializeScenarioVectors(activeScenario));
}

function commitScenarioSelection(
  state: Pick<
    ProjectRuntimeState,
    'projectVectors' | 'projectHealthCore' | 'scenarios' | 'activeScenarioId' | 'sim'
  >,
  scenarios: VerifyScenario[],
  activeScenarioId: string
): Pick<ProjectRuntimeState, 'projectVectors' | 'projectHealthCore' | 'scenarios' | 'activeScenarioId' | 'sim'> {
  const resolvedActiveScenario =
    getActiveScenario(scenarios, activeScenarioId) ??
    (scenarios.length > 0 ? scenarios[0] : createDefaultScenario(state.projectVectors));
  const compatibilityVectors = materializeScenarioVectors(resolvedActiveScenario);
  return {
    projectVectors: cloneVectors(compatibilityVectors),
    scenarios,
    activeScenarioId: resolvedActiveScenario.id,
    sim: {
      ...state.sim,
      probes: normalizeScenarioProbes(resolvedActiveScenario.probes).map((entry) => ({
        key: entry.key,
        label: entry.label ?? entry.key,
      })),
    },
    projectHealthCore: {
      ...state.projectHealthCore,
      dirtySinceVerify: true,
      dirtySinceExport: true,
    },
  };
}

function buildSimulationModelForCircuit(circuit: Circuit): SimulationModel {
  return buildSimulationModel(elaborateCircuit(canonicalizeSemanticCircuit(circuit)).ir);
}

function buildEmptyRuntimeSimState(model: SimulationModel): RuntimeSimState {
  const trace: RuntimeSimTraceSample[] = [];
  return {
    tick: 0,
    running: false,
    stepMode: false,
    speedHz: DEFAULT_SIM_SPEED_HZ,
    irHash: model.irHash,
    traceHash: `sim_${digestValue({ irHash: model.irHash, trace })}`,
    inputs: {},
    signals: {},
    trace,
    selectedSignalKey: null,
    probes: [],
    guard: undefined,
  };
}

function buildBlockedRuntimeSimState(
  previous: RuntimeSimState | undefined,
  model: SimulationModel,
  overrides?: Partial<RuntimeSimState>
): RuntimeSimState {
  const seed = previous ? cloneSimState(previous) : buildEmptyRuntimeSimState(model);
  const trace = overrides?.trace ?? [];
  const traceHash = `sim_${digestValue({ irHash: model.irHash, trace })}`;
  return {
    ...seed,
    ...(overrides ?? {}),
    tick: overrides?.tick ?? 0,
    running: false,
    stepMode: false,
    irHash: model.irHash,
    signals: overrides?.signals ?? {},
    trace,
    traceHash,
    guard: toRuntimeSimGuard(model),
  };
}

function applyInteractiveSimResult(
  previous: RuntimeSimState | undefined,
  result: SimEngineResult<RuntimeSimState>,
  model: SimulationModel,
  okOverrides?: Partial<RuntimeSimState>,
  blockedOverrides?: Partial<RuntimeSimState>
): RuntimeSimState {
  if (result.status === 'ok') {
    return {
      ...result.value,
      ...(okOverrides ?? {}),
      guard: undefined,
    };
  }
  return buildBlockedRuntimeSimState(previous, model, blockedOverrides);
}

function initializeSimulationStateForCircuit(
  circuit: Circuit,
  ioRows: ProjectIoRow[],
  previous?: RuntimeSimState
): RuntimeSimState {
  const model = buildSimulationModelForCircuit(circuit);
  const result = resetSimulationStateFromModel(circuit, model, ioRows, previous);
  return applyInteractiveSimResult(
    previous,
    result,
    model,
    undefined,
    buildBlockedRuntimeSnapshotFromModel(circuit, model, previous?.inputs)
  );
}

function normalizeMacroInsertionCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const macroId = key.trim();
    if (macroId.length === 0) continue;
    const numeric = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    normalized[macroId] = numeric;
  }
  return normalized;
}

function ioRowsFromProject(project: RBProject): ProjectIoRow[] {
  const effective = resolveIoMappingFromProjectFields(project) ?? project.ioMapping;
  const rows: ProjectIoRow[] = [];
  for (const entry of effective?.inputs ?? []) {
    rows.push({
      id: entry.id,
      nodeId: entry.nodeId,
      port: entry.port,
      label: (entry.label ?? entry.id).trim() || entry.id,
      direction: 'in',
      pin: entry.pin ?? '',
      required: true,
    });
  }
  for (const entry of effective?.outputs ?? []) {
    rows.push({
      id: entry.id,
      nodeId: entry.nodeId,
      port: entry.port,
      label: (entry.label ?? entry.id).trim() || entry.id,
      direction: 'out',
      pin: entry.pin ?? '',
      required: true,
    });
  }
  return enrichProjectIoRowsWithV2Metadata(rows, project.hardwareMappingV2);
}

function cloneIoRows(rows: ProjectIoRow[]): ProjectIoRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneVectors<T extends TestVector>(vectors: T[]): T[] {
  return vectors.map((vector) => ({
    ...vector,
    inputs: { ...(vector.inputs ?? {}) },
    expected: { ...(vector.expected ?? {}) },
  }));
}

function cloneScenarioStep(step: VerifyScenarioStep): VerifyScenarioStep {
  return {
    ...step,
    value:
      step.value && typeof step.value === 'object'
        ? { ...step.value }
        : step.value,
    expectedValue:
      step.expectedValue && typeof step.expectedValue === 'object'
        ? { ...step.expectedValue }
        : step.expectedValue,
  };
}

function mutateScenarioSteps(
  scenario: VerifyScenario,
  mutate: (steps: VerifyScenarioStep[]) => VerifyScenarioStep[]
): VerifyScenario | null {
  const sourceSteps =
    scenario.steps && scenario.steps.length > 0
      ? scenario.steps.map(cloneScenarioStep)
      : deriveScenarioStepsFromVectors(scenario.vectors);
  const mutated = mutate(sourceSteps)
    .filter((step) => step.id.trim().length > 0)
    .map((step, index) => ({
      ...step,
      order: index,
      targetRef: step.targetRef?.trim() || undefined,
      label: step.label?.trim() || undefined,
      notes: step.notes?.trim() || undefined,
    }));
  const nextScenario = stampScenario({
    ...scenario,
    steps: mutated,
    vectors: materializeScenarioVectors({
      ...scenario,
      steps: mutated,
    }),
  });
  return nextScenario;
}

function cloneCircuit(circuit: Circuit): Circuit {
  return {
    nodes: circuit.nodes.map((node) => ({ ...node })),
    connections: circuit.connections.map((connection) => ({ ...connection })),
    // Declared buses are part of the circuit; a shallow clone that dropped
    // them would erase first-class vectors on every design edit.
    ...(circuit.buses
      ? { buses: circuit.buses.map((bus) => ({ ...bus, bits: bus.bits.map((bit) => ({ ...bit })) })) }
      : {}),
  };
}

function cloneModuleDefinition(
  module: ProjectHierarchyDocument['modules'][number],
): ProjectHierarchyDocument['modules'][number] {
  return {
    ...module,
    ports: module.ports.map((port) => ({
      ...port,
      ...(port.range ? { range: { ...port.range } } : {}),
      sourceBoundary: {
        internalRefs: port.sourceBoundary.internalRefs.map((ref) => ({ ...ref })),
        // Preserve vector per-bit boundary refs; dropping them would erase the
        // vector identity of a module port on any hierarchy edit.
        ...(port.sourceBoundary.bits
          ? {
              bits: port.sourceBoundary.bits.map((bit) => ({
                index: bit.index,
                internalRefs: bit.internalRefs.map((ref) => ({ ...ref })),
              })),
            }
          : {}),
      },
    })),
    circuit: cloneCircuit(module.circuit),
  };
}

function cloneProjectHierarchy(hierarchy: ProjectHierarchyDocument): ProjectHierarchyDocument {
  return {
    ...hierarchy,
    modules: hierarchy.modules.map(cloneModuleDefinition),
  };
}

function cloneMacroInsertionCounts(value: Record<string, number>): Record<string, number> {
  return { ...value };
}

function cloneDesignHistorySnapshot(snapshot: DesignHistorySnapshot): DesignHistorySnapshot {
  return {
    circuit: cloneCircuit(snapshot.circuit),
    hierarchy: snapshot.hierarchy ? cloneProjectHierarchy(snapshot.hierarchy) : undefined,
    projectIoRows: cloneIoRows(snapshot.projectIoRows),
    hardwareMappingV2: snapshot.hardwareMappingV2
      ? structuredClone(snapshot.hardwareMappingV2)
      : undefined,
    projectVectors: snapshot.projectVectors ? cloneVectors(snapshot.projectVectors) : undefined,
    macroInsertionCounts: cloneMacroInsertionCounts(snapshot.macroInsertionCounts),
  };
}

function cloneDesignHistoryPast(
  history: DesignHistorySnapshot[],
  maxEntries: number
): DesignHistorySnapshot[] {
  const boundedLimit = normalizePersistedMaxDesignHistory(maxEntries, DEFAULT_MAX_DESIGN_HISTORY);
  return history
    .slice(-boundedLimit)
    .map((snapshot) => cloneDesignHistorySnapshot(snapshot));
}

function cloneDesignHistoryFuture(
  history: DesignHistorySnapshot[],
  maxEntries: number
): DesignHistorySnapshot[] {
  const boundedLimit = normalizePersistedMaxDesignHistory(maxEntries, DEFAULT_MAX_DESIGN_HISTORY);
  return history
    .slice(0, boundedLimit)
    .map((snapshot) => cloneDesignHistorySnapshot(snapshot));
}

function createDesignHistorySnapshot(
  state: Pick<
    ProjectRuntimeState,
    'circuit' | 'hierarchy' | 'hardwareMappingV2' | 'projectIoRows' | 'projectVectors' | 'macroInsertionCounts'
  >
): DesignHistorySnapshot {
  return {
    circuit: cloneCircuit(state.circuit),
    hierarchy: cloneProjectHierarchy(state.hierarchy),
    projectIoRows: cloneIoRows(state.projectIoRows),
    hardwareMappingV2: structuredClone(state.hardwareMappingV2),
    projectVectors: cloneVectors(state.projectVectors),
    macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
  };
}

function buildValidOutputSignalKeys(rows: ProjectIoRow[]): Set<string> {
  return new Set(buildLiveIoAliasMap(rows, 'out').keys());
}

function buildValidInputSignalKeys(rows: ProjectIoRow[]): Set<string> {
  return new Set(buildLiveIoAliasMap(rows, 'in').keys());
}

export function pruneStaleVectorExpected<T extends TestVector>(
  vectors: T[],
  validOutputKeys: Set<string>
): T[] {
  return vectors.map((vector) => ({
    ...vector,
    inputs: { ...(vector.inputs ?? {}) },
    expected: Object.fromEntries(
      Object.entries(vector.expected ?? {}).filter(([key]) => {
        const normalizedKey = normalizePortToken(key);
        return normalizedKey.length > 0 && validOutputKeys.has(normalizedKey);
      })
    ) as Record<string, 0 | 1>,
  })) as T[];
}

function pruneStaleVectorInputs<T extends TestVector>(
  vectors: T[],
  validInputKeys: Set<string>
): T[] {
  return vectors.map((vector) => ({
    ...vector,
    inputs: Object.fromEntries(
      Object.entries(vector.inputs ?? {}).filter(([key]) => {
        const normalizedKey = normalizePortToken(key);
        return normalizedKey.length > 0 && validInputKeys.has(normalizedKey);
      })
    ) as Record<string, 0 | 1>,
    expected: { ...(vector.expected ?? {}) },
  })) as T[];
}

function ensureVectorInputCoverage<T extends TestVector>(
  vectors: T[],
  rows: ProjectIoRow[],
  clockPolicy?: VerifyClockPolicy | null
): T[] {
  const inputRows = rows.filter((row) => row.direction === 'in');
  if (inputRows.length === 0) return cloneVectors(vectors);
  const requestedAuthoredClockAliases =
    clockPolicy && clockPolicy.overrideMode !== 'auto'
      ? new Set(
          [clockPolicy.signalId, clockPolicy.signalLabel]
            .map((value) => normalizePortToken(value ?? ''))
            .filter((value) => value.length > 0)
        )
      : null;
  const authoredClockRow = requestedAuthoredClockAliases
    ? inputRows.find((row) =>
        [row.id, row.label, row.nodeId]
          .map((value) => normalizePortToken(value ?? ''))
          .some((alias) => alias.length > 0 && requestedAuthoredClockAliases.has(alias))
      )
    : undefined;
  const authoredClockAliases = requestedAuthoredClockAliases
    ? new Set([
        ...requestedAuthoredClockAliases,
        ...[authoredClockRow?.id, authoredClockRow?.label, authoredClockRow?.nodeId]
          .map((value) => normalizePortToken(value ?? ''))
          .filter((value) => value.length > 0),
      ])
    : null;
  const autoResetAliases =
    clockPolicy?.overrideMode === 'auto' &&
    clockPolicy.resetBehavior === 'auto-sequence' &&
    clockPolicy.resetSignalName
      ? new Set([normalizePortToken(clockPolicy.resetSignalName)])
      : null;
  let authoredClockValue: 0 | 1 = clockPolicy?.startLevel === 1 ? 1 : 0;

  return vectors.map((vector) => {
    const nextInputs: Record<string, 0 | 1> = { ...(vector.inputs ?? {}) };
    const normalizedInputKeys = new Set(
      Object.keys(nextInputs)
        .map((key) => normalizePortToken(key))
        .filter((key) => key.length > 0)
    );

    for (const row of inputRows) {
      const canonicalInputKey = normalizePortToken(row.id);
      const hasCoverage =
        canonicalInputKey.length > 0 && normalizedInputKeys.has(canonicalInputKey);
      if (hasCoverage) continue;
      const inputKey = row.id.trim();
      if (!inputKey) continue;
      const rowAliases = [row.id, row.label, row.nodeId]
        .map((value) => normalizePortToken(value ?? ''))
        .filter((value) => value.length > 0);
      if (autoResetAliases && rowAliases.some((alias) => autoResetAliases.has(alias))) {
        // Preserve omission until policy materialization so Auto can distinguish
        // "use the reset sequence" from an explicit authored reset=0.
        continue;
      }
      const isAuthoredClock = Boolean(
        authoredClockAliases && rowAliases.some((alias) => authoredClockAliases.has(alias))
      );
      nextInputs[inputKey] = isAuthoredClock ? authoredClockValue : 0;
      normalizedInputKeys.add(normalizePortToken(inputKey));
    }

    if (authoredClockAliases) {
      const clockEntry = Object.entries(nextInputs).find(([key]) =>
        authoredClockAliases.has(normalizePortToken(key))
      );
      if (clockEntry) authoredClockValue = clockEntry[1] === 1 ? 1 : 0;
    }

    return {
      ...vector,
      inputs: nextInputs,
      expected: { ...(vector.expected ?? {}) },
    };
  }) as T[];
}

function buildRowRekeyMap(
  previousRows: ProjectIoRow[],
  nextRows: ProjectIoRow[],
  direction: 'in' | 'out'
): Map<string, string> {
  const nextRowsByNodeId = new Map<string, ProjectIoRow>();
  for (const row of nextRows) {
    if (row.direction !== direction) continue;
    const normalizedNodeId = normalizePortToken(row.nodeId);
    if (!normalizedNodeId) continue;
    nextRowsByNodeId.set(normalizedNodeId, row);
  }

  const canonicalOwnersByAlias = new Map<string, Set<string>>();
  for (const row of previousRows) {
    if (row.direction !== direction) continue;
    const normalizedNodeId = normalizePortToken(row.nodeId);
    if (!normalizedNodeId) continue;
    const nextRow = nextRowsByNodeId.get(normalizedNodeId);
    const canonicalKey = nextRow?.id?.trim();
    if (!nextRow || !canonicalKey) continue;
    for (const candidate of buildIoRowSignalCandidates(row)) {
      const normalizedCandidate = normalizePortToken(candidate);
      if (!normalizedCandidate) continue;
      const owners = canonicalOwnersByAlias.get(normalizedCandidate) ?? new Set<string>();
      owners.add(canonicalKey);
      canonicalOwnersByAlias.set(normalizedCandidate, owners);
    }
  }

  const rekeyMap = new Map<string, string>();
  for (const [alias, owners] of canonicalOwnersByAlias) {
    if (owners.size === 1) rekeyMap.set(alias, Array.from(owners)[0]);
  }
  return rekeyMap;
}

function rekeyVectorSignalRecord(
  record: Record<string, 0 | 1> | undefined,
  rekeyMap: Map<string, string>
): Record<string, 0 | 1> {
  if (!record) return {};

  const nextRecord: Record<string, 0 | 1> = {};
  const seen = new Set<string>();
  const entries = Object.entries(record);

  const applyEntries = (preferAliasKeys: boolean) => {
    for (const [rawKey, value] of entries) {
      const normalizedKey = normalizePortToken(rawKey);
      if (!normalizedKey) continue;
      const mappedKey = rekeyMap.get(normalizedKey) ?? rawKey.trim();
      const normalizedMappedKey = normalizePortToken(mappedKey);
      if (!normalizedMappedKey) continue;
      const isAliasKey = rekeyMap.has(normalizedKey) && normalizedMappedKey !== normalizedKey;
      if (isAliasKey !== preferAliasKeys) continue;
      if (seen.has(normalizedMappedKey)) continue;
      nextRecord[mappedKey] = value;
      seen.add(normalizedMappedKey);
    }
  };

  applyEntries(false);
  applyEntries(true);
  return nextRecord;
}

function rekeyVectorsForLiveIo<T extends TestVector>(
  vectors: T[],
  previousRows: ProjectIoRow[],
  nextRows: ProjectIoRow[]
): T[] {
  const inputRekeyMap = buildRowRekeyMap(previousRows, nextRows, 'in');
  const outputRekeyMap = buildRowRekeyMap(previousRows, nextRows, 'out');

  return vectors.map((vector) => ({
    ...vector,
    inputs: rekeyVectorSignalRecord(vector.inputs, inputRekeyMap),
    expected: rekeyVectorSignalRecord(vector.expected, outputRekeyMap),
  })) as T[];
}

function ensureVectorOutputCoverage<T extends TestVector>(
  vectors: T[],
  rows: ProjectIoRow[]
): T[] {
  const outputRows = rows.filter((row) => row.direction === 'out');
  if (outputRows.length === 0) return cloneVectors(vectors);

  return vectors.map((vector) => {
    const nextExpected: Record<string, 0 | 1> = { ...(vector.expected ?? {}) };
    const normalizedExpectedKeys = new Set(
      Object.keys(nextExpected)
        .map((key) => normalizePortToken(key))
        .filter((key) => key.length > 0)
    );

    for (const row of outputRows) {
      const canonicalOutputKey = normalizePortToken(row.id);
      const hasCoverage =
        canonicalOutputKey.length > 0 && normalizedExpectedKeys.has(canonicalOutputKey);
      if (hasCoverage) continue;
      const outputKey = row.id.trim();
      if (!outputKey) continue;
      nextExpected[outputKey] = 0;
      normalizedExpectedKeys.add(normalizePortToken(outputKey));
    }

    return {
      ...vector,
      inputs: { ...(vector.inputs ?? {}) },
      expected: nextExpected,
    };
  }) as T[];
}

export function normalizeVectorsForLiveIo<T extends TestVector>(
  vectors: T[],
  rows: ProjectIoRow[],
  clockPolicy?: VerifyClockPolicy | null
): T[] {
  const inputAliases = buildLiveIoAliasMap(rows, 'in');
  const outputAliases = buildLiveIoAliasMap(rows, 'out');
  const canonicalVectors = vectors
    .map((vector, originalIndex) => ({
      vector: {
        ...vector,
        inputs: rekeyRuntimeSignalRecord(vector.inputs ?? {}, inputAliases),
        expected: rekeyRuntimeSignalRecord(
          filterAssertedExpectedValues(vector.expected),
          outputAliases
        ),
      } as T,
      originalIndex,
    }))
    .sort((left, right) => {
      const leftTick = Number.isFinite(left.vector.tick)
        ? Math.max(0, Math.floor(Number(left.vector.tick)))
        : left.originalIndex;
      const rightTick = Number.isFinite(right.vector.tick)
        ? Math.max(0, Math.floor(Number(right.vector.tick)))
        : right.originalIndex;
      return leftTick - rightTick || left.originalIndex - right.originalIndex;
    })
    .map(({ vector }) => vector);
  return ensureVectorInputCoverage(
    pruneStaleVectorInputs(
      pruneStaleVectorExpected(canonicalVectors, buildValidOutputSignalKeys(rows)),
      buildValidInputSignalKeys(rows)
    ),
    rows,
    clockPolicy
  );
}

function filterAssertedExpectedValues(
  record: TestVector['expected']
): Record<string, number | boolean> {
  const next: Record<string, number | boolean> = {};
  for (const [signal, value] of Object.entries(
    (record ?? {}) as Record<string, unknown>
  )) {
    if (
      value === 0 ||
      value === 1 ||
      value === false ||
      value === true ||
      value === '0' ||
      value === '1'
    ) {
      next[signal] = value === '0' ? 0 : value === '1' ? 1 : value;
    }
  }
  return next;
}

function getBoundaryIoShape(
  node: Circuit['nodes'][number]
): { direction: 'in' | 'out'; port: 'out' | 'in' } | null {
  if (node.type === 'INPUT' || node.type === 'Clock') {
    return { direction: 'in', port: 'out' };
  }
  if (node.type === 'OUTPUT') {
    return { direction: 'out', port: 'in' };
  }
  return null;
}

function chooseCanonicalIoRow(rows: ProjectIoRow[]): ProjectIoRow | null {
  if (rows.length === 0) return null;

  let bestRow = rows[0];
  let bestScore = -1;

  for (const row of rows) {
    const score =
      (row.pin.trim().length > 0 ? 4 : 0) +
      (row.required ? 2 : 0) +
      (row.label.trim().length > 0 ? 1 : 0);

    if (score > bestScore) {
      bestRow = row;
      bestScore = score;
      continue;
    }

    if (score === bestScore) {
      const currentId = normalizePortToken(row.id);
      const bestId = normalizePortToken(bestRow.id);
      if (currentId.localeCompare(bestId) < 0) {
        bestRow = row;
      }
    }
  }

  return bestRow;
}

function isUsableBoundaryStudentLabel(value: string | undefined): boolean {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0) return false;

  const normalized = trimmed.toLowerCase();
  if (normalized === 'input' || normalized === 'output') {
    return false;
  }

  return !/^node(?:[-_]?v?\d+)+(?:[-_]\d+)*$/i.test(normalized);
}

function getBoundaryFallbackBase(node: Circuit['nodes'][number]): 'Input' | 'Output' | 'Clock' {
  if (node.type === 'Clock') return 'Clock';
  return node.type === 'OUTPUT' ? 'Output' : 'Input';
}

function getNextBoundaryFallbackLabel(
  node: Circuit['nodes'][number],
  counts: Map<'Input' | 'Output' | 'Clock', number>
): string {
  const base = getBoundaryFallbackBase(node);
  const nextCount = (counts.get(base) ?? 0) + 1;
  counts.set(base, nextCount);

  if (base === 'Clock' && nextCount === 1) {
    return 'Clock';
  }

  return `${base} ${nextCount}`;
}

function resolveBoundaryStudentLabel(
  node: Circuit['nodes'][number],
  canonicalRow: ProjectIoRow | null | undefined,
  counts: Map<'Input' | 'Output' | 'Clock', number>
): string {
  const preferredLabel = [node.label, canonicalRow?.label, canonicalRow?.id].find((candidate) =>
    isUsableBoundaryStudentLabel(candidate)
  );

  return preferredLabel?.trim() || getNextBoundaryFallbackLabel(node, counts);
}

function shouldRekeyBoundaryRowId(row: ProjectIoRow, nextLabel: string): boolean {
  if ((row.mappingKind ?? 'scalar') !== 'scalar') {
    return false;
  }

  const currentIdToken = normalizePortToken(row.id);
  const currentLabelToken = normalizePortToken(row.label);
  const nextRowIdToken = normalizePortToken(normalizeBoardRowId(nextLabel));

  if (currentIdToken.length === 0) {
    return true;
  }

  if (currentIdToken === nextRowIdToken) {
    return false;
  }

  return (
    currentIdToken === currentLabelToken ||
    /^node(?:_?v?\d+)+$/i.test(currentIdToken) ||
    /^(input|output|clock)_?\d*$/i.test(currentIdToken)
  );
}

function synchronizeProjectIoRows(circuit: Circuit, rows: ProjectIoRow[]): ProjectIoRow[] {
  const boundaryNodes = new Map(
    circuit.nodes
      .map((node) => {
        const shape = getBoundaryIoShape(node);
        if (!shape) return null;
        return [normalizePortToken(node.id), { node, shape }] as const;
      })
      .filter((entry): entry is readonly [string, { node: Circuit['nodes'][number]; shape: { direction: 'in' | 'out'; port: 'out' | 'in' } }] => entry !== null)
  );

  const rowsByNodeId = new Map<string, ProjectIoRow[]>();
  for (const row of rows) {
    const normalizedNodeId = normalizePortToken(row.nodeId);
    if (!normalizedNodeId) continue;
    const existing = rowsByNodeId.get(normalizedNodeId);
    if (existing) {
      rowsByNodeId.set(normalizedNodeId, [...existing, row]);
    } else {
      rowsByNodeId.set(normalizedNodeId, [row]);
    }
  }

  const synchronized: ProjectIoRow[] = [];
  const fallbackLabelCounts = new Map<'Input' | 'Output' | 'Clock', number>();
  for (const [normalizedNodeId, { node, shape }] of boundaryNodes.entries()) {
    const canonicalRow = chooseCanonicalIoRow(rowsByNodeId.get(normalizedNodeId) ?? []);
    const nextLabel = resolveBoundaryStudentLabel(node, canonicalRow, fallbackLabelCounts);
    if (canonicalRow) {
      const nextRowId = shouldRekeyBoundaryRowId(canonicalRow, nextLabel)
        ? getNextIoRowId(synchronized, nextLabel)
        : canonicalRow.id;
      synchronized.push({
        ...canonicalRow,
        id: nextRowId,
        nodeId: node.id,
        direction: shape.direction,
        port: shape.port,
        label: nextLabel,
        required: canonicalRow.required ?? true,
      });
      continue;
    }

    synchronized.push({
      id: getNextIoRowId(synchronized, nextLabel),
      nodeId: node.id,
      direction: shape.direction,
      port: shape.port,
      label: nextLabel,
      pin: '',
      required: true,
    });
  }

  return synchronized;
}

function buildDesignBehaviorFingerprint(circuit: Circuit, rows: ProjectIoRow[]): string {
  const logicalIo = rows
    .map((row) => ({
      id: row.id,
      nodeId: row.nodeId,
      port: row.port,
      label: row.label,
      direction: row.direction,
    }))
    .sort((left, right) =>
      `${left.direction}:${left.nodeId}:${left.id}`.localeCompare(
        `${right.direction}:${right.nodeId}:${right.id}`
      )
    );
  return digestValue(stableSerialize({ circuit: normalizeCircuit(circuit), logicalIo }));
}

function hasSameVectorIoContract(leftRows: ProjectIoRow[], rightRows: ProjectIoRow[]): boolean {
  const normalizeRows = (rows: ProjectIoRow[]) =>
    rows
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId,
        port: row.port,
        label: row.label,
        direction: row.direction,
      }))
      .sort((left, right) =>
        `${left.direction}:${left.nodeId}:${left.id}`.localeCompare(
          `${right.direction}:${right.nodeId}:${right.id}`
        )
      );

  return stableSerialize(normalizeRows(leftRows)) === stableSerialize(normalizeRows(rightRows));
}

function preserveCompatibleVectorAuthorship<T extends TestVector>(
  vectors: T[],
  previousRows: ProjectIoRow[],
  nextRows: ProjectIoRow[]
): T[] {
  // Rekey still-compatible references, but deliberately do not prune removed
  // signals. Verify owns the visible partial/orphan review state for those cells.
  const rekeyed = ensureVectorInputCoverage(
    rekeyVectorsForLiveIo(cloneVectors(vectors), previousRows, nextRows),
    nextRows
  );
  // Expected outputs are optional, cell-level authored checks. A Design edit,
  // undo, or redo may rekey a compatible output, but must never manufacture
  // checks for other outputs. This preserves both stimulus-only scenarios and
  // deliberately sparse one-cell comparison work.
  return rekeyed as T[];
}

function rekeyScenarioStepRecord(
  value: VerifyScenarioStep['value'] | VerifyScenarioStep['expectedValue'],
  rekeyMap: Map<string, string>
): VerifyScenarioStep['value'] | VerifyScenarioStep['expectedValue'] {
  if (!value || typeof value !== 'object') return value;
  return rekeyVectorSignalRecord(value, rekeyMap);
}

function reconcileScenarioStepsForLiveIo(
  steps: VerifyScenarioStep[] | undefined,
  previousRows: ProjectIoRow[],
  nextRows: ProjectIoRow[]
): VerifyScenarioStep[] | undefined {
  if (!steps) return undefined;
  const inputRekeyMap = buildRowRekeyMap(previousRows, nextRows, 'in');
  const outputRekeyMap = buildRowRekeyMap(previousRows, nextRows, 'out');
  const anyRekeyMap = new Map([...inputRekeyMap, ...outputRekeyMap]);

  return steps.map((sourceStep) => {
    const step = cloneScenarioStep(sourceStep);
    const targetMap =
      step.kind === 'assert_scalar' || step.kind === 'assert_bus'
        ? outputRekeyMap
        : step.kind === 'set_input' ||
            step.kind === 'set_bit' ||
            step.kind === 'set_slice' ||
            step.kind === 'set_bus' ||
            step.kind === 'apply_reset' ||
            step.kind === 'pulse_step'
          ? inputRekeyMap
          : anyRekeyMap;
    const normalizedTarget = normalizePortToken(step.targetRef ?? '');
    const targetRef = normalizedTarget
      ? (targetMap.get(normalizedTarget) ?? step.targetRef)
      : step.targetRef;

    return {
      ...step,
      targetRef,
      value:
        step.kind === 'set_slice' || step.kind === 'set_bus'
          ? rekeyScenarioStepRecord(step.value, inputRekeyMap)
          : step.value,
      expectedValue:
        step.kind === 'assert_bus'
          ? rekeyScenarioStepRecord(step.expectedValue, outputRekeyMap)
          : step.expectedValue,
    };
  });
}

function buildIoRowSignalCandidates(row: ProjectIoRow): string[] {
  const nodeId = row.nodeId?.trim() ?? '';
  // The underscore spelling of a punctuated id (`carry-out` → `carry_out`) is
  // the key older builds wrote; it belongs to the same row.
  const underscoreSpelling = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  return [
    row.id,
    underscoreSpelling(row.id),
    row.label,
    nodeId,
    nodeId ? underscoreSpelling(nodeId) : '',
    nodeId ? `${nodeId}.in` : '',
    nodeId ? `${nodeId}.out` : '',
    nodeId ? `${nodeId}_in` : '',
    nodeId ? `${nodeId}_out` : '',
    nodeId ? `${nodeId}:in` : '',
    nodeId ? `${nodeId}:out` : '',
  ].filter((candidate) => candidate.trim().length > 0);
}

function buildLiveIoAliasMap(
  rows: ProjectIoRow[],
  direction?: 'in' | 'out'
): Map<string, string> {
  const candidatesByAlias = new Map<string, Set<string>>();
  for (const row of rows) {
    if (direction && row.direction !== direction) continue;
    const canonical = row.id.trim();
    if (!canonical) continue;
    for (const candidate of buildIoRowSignalCandidates(row)) {
      const normalized = normalizePortToken(candidate);
      if (!normalized) continue;
      const owners = candidatesByAlias.get(normalized) ?? new Set<string>();
      owners.add(canonical);
      candidatesByAlias.set(normalized, owners);
    }
  }

  const aliases = new Map<string, string>();
  for (const [alias, owners] of candidatesByAlias) {
    if (owners.size === 1) aliases.set(alias, Array.from(owners)[0]);
  }
  return aliases;
}

function canonicalizeVerifySignalName(
  signal: string,
  aliases: Map<string, string>
): string {
  return aliases.get(normalizePortToken(signal)) ?? signal.trim();
}

function rekeyRuntimeSignalRecord<T>(
  record: Record<string, T>,
  aliases: Map<string, string>
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [rawSignal, value] of Object.entries(record)) {
    const signal = canonicalizeVerifySignalName(rawSignal, aliases);
    if (!(signal in next) || normalizePortToken(rawSignal) === normalizePortToken(signal)) {
      next[signal] = value;
    }
  }
  return next;
}

function reconcileScenarioSequentialPolicyForLiveIo(
  policy: VerifyScenarioSequentialPolicy | undefined,
  previousRows: ProjectIoRow[],
  nextRows: ProjectIoRow[]
): VerifyScenarioSequentialPolicy | undefined {
  if (!policy) return undefined;
  const inputRekeyMap = buildRowRekeyMap(previousRows, nextRows, 'in');
  const currentInputAliases = buildRowRekeyMap(nextRows, nextRows, 'in');
  const resolveInputId = (...candidates: Array<string | undefined>): string | undefined => {
    for (const candidate of candidates) {
      const normalized = normalizePortToken(candidate ?? '');
      if (!normalized) continue;
      const resolved = inputRekeyMap.get(normalized) ?? currentInputAliases.get(normalized);
      if (resolved) return resolved;
    }
    return undefined;
  };

  const signalId = resolveInputId(policy.signalId, policy.signalLabel) ?? policy.signalId;
  const signalRow = signalId
    ? nextRows.find(
        (row) => row.direction === 'in' && normalizePortToken(row.id) === normalizePortToken(signalId)
      )
    : undefined;
  const resetSignalName =
    resolveInputId(policy.resetSignalName) ?? policy.resetSignalName;

  return {
    ...policy,
    signalId,
    signalLabel: signalRow?.label?.trim() || signalId || policy.signalLabel,
    resetSignalName,
  };
}

function reconcileTestbenchAfterDesignChange(input: {
  state: ProjectRuntimeState;
  snapshot: DesignHistorySnapshot;
  nextIoRows: ProjectIoRow[];
  designBehaviorChanged: boolean;
  isDetachingFromExample: boolean;
}): Pick<
  ProjectRuntimeState,
  'projectVectors' | 'customVectors' | 'scenarios' | 'scenarioAuthority'
> {
  const { state, snapshot, nextIoRows, designBehaviorChanged, isDetachingFromExample } = input;
  // Design history predates testbench edits. A structural undo with the same
  // logical I/O contract must not rewind the compatibility vector mirror to an
  // older snapshot while the named scenario correctly preserves current
  // authorship. Historical vectors are only needed when undo/redo changes the
  // I/O contract and must restore/rekey signal identities.
  const shouldRestoreSnapshotVectors =
    snapshot.projectVectors !== undefined &&
    !hasSameVectorIoContract(state.projectIoRows, nextIoRows);
  const sourceProjectVectors = shouldRestoreSnapshotVectors
    ? cloneVectors(snapshot.projectVectors)
    : cloneVectors(state.projectVectors);
  const projectVectorRows = shouldRestoreSnapshotVectors
    ? snapshot.projectIoRows
    : state.projectIoRows;

  if (!designBehaviorChanged) {
    return {
      projectVectors: sourceProjectVectors,
      customVectors: cloneVectors(state.customVectors),
      scenarios: state.scenarios.map((scenario) => ({
        ...scenario,
        vectors: cloneVectors(scenario.vectors),
        steps: scenario.steps?.map(cloneScenarioStep),
        sequentialPolicy: cloneScenarioSequentialPolicy(scenario.sequentialPolicy),
      })),
      scenarioAuthority: state.scenarioAuthority,
    };
  }

  const nextProjectVectors = preserveCompatibleVectorAuthorship(
    sourceProjectVectors,
    projectVectorRows,
    nextIoRows
  );
  const nextCustomVectors = preserveCompatibleVectorAuthorship(
    cloneVectors(state.customVectors),
    state.projectIoRows,
    nextIoRows
  );
  const nextScenarios = state.scenarios.map((scenario) => ({
    ...scenario,
    vectors: preserveCompatibleVectorAuthorship(
      cloneVectors(scenario.vectors),
      state.projectIoRows,
      nextIoRows
    ),
    steps: reconcileScenarioStepsForLiveIo(
      scenario.steps,
      state.projectIoRows,
      nextIoRows
    ),
    sequentialPolicy: reconcileScenarioSequentialPolicyForLiveIo(
      scenario.sequentialPolicy,
      state.projectIoRows,
      nextIoRows
    ),
  }));
  const shouldDiscardInheritedStarterExpectations =
    isDetachingFromExample && state.scenarioAuthority === 'starter';
  const projectVectors = shouldDiscardInheritedStarterExpectations
    ? stripExpectedOutputs(nextProjectVectors)
    : nextProjectVectors;
  const customVectors = shouldDiscardInheritedStarterExpectations
    ? stripExpectedOutputs(nextCustomVectors)
    : nextCustomVectors;
  const scenarios = shouldDiscardInheritedStarterExpectations
    ? nextScenarios.map((scenario) => {
        const vectors = stripExpectedOutputs(scenario.vectors);
        return {
          ...scenario,
          vectors,
          steps: scenario.steps ? deriveScenarioStepsFromVectors(vectors) : undefined,
        };
      })
    : nextScenarios;
  const scenarioAuthority =
    projectVectors.length === 0
      ? 'none'
      : shouldDiscardInheritedStarterExpectations
        ? 'draft'
        : state.scenarioAuthority === 'verified'
          ? 'stale'
          : state.scenarioAuthority;

  return { projectVectors, customVectors, scenarios, scenarioAuthority };
}

function commitDesignSnapshot(
  state: ProjectRuntimeState,
  snapshot: DesignHistorySnapshot,
  history: Pick<ProjectRuntimeState, 'designPast' | 'designFuture'>
): Pick<
  ProjectRuntimeState,
  | 'circuit'
  | 'hierarchy'
  | 'customComponents'
  | 'hardwareMappingV2'
  | 'projectIoRows'
  | 'projectVectors'
  | 'customVectors'
  | 'scenarios'
  | 'macroInsertionCounts'
  | 'designPast'
  | 'designFuture'
  | 'designRevision'
  | 'sim'
  | 'projectName'
  | 'projectDescription'
  | 'projectKind'
  | 'sourceExampleId'
  | 'scenarioAuthority'
  | 'activeExampleId'
  | 'verifyLastRun'
  | 'projectHealthCore'
> {
  const nextCircuit = cloneCircuit(snapshot.circuit);
  const nextHierarchy = snapshot.hierarchy
    ? cloneProjectHierarchy(snapshot.hierarchy)
    : cloneProjectHierarchy(state.hierarchy);
  const snapshotHardwareMappingV2 =
    snapshot.hardwareMappingV2 !== undefined
      ? structuredClone(snapshot.hardwareMappingV2)
      : migrateIoMappingToHardwareMappingV2(toIoMappingFromProjectIoRows(snapshot.projectIoRows));
  const { hardwareMappingV2: nextHardwareMappingV2, projectIoRows: nextIoRows } =
    deriveAuthoritativeHardwareState(nextCircuit, snapshotHardwareMappingV2);
  const designBehaviorChanged =
    buildDesignBehaviorFingerprint(
      elaborateProjectHierarchy(state.circuit, state.hierarchy),
      state.projectIoRows,
    ) !==
    buildDesignBehaviorFingerprint(
      elaborateProjectHierarchy(nextCircuit, nextHierarchy),
      nextIoRows,
    );
  const isDetachingFromExample =
    designBehaviorChanged && state.projectKind === 'example' && Boolean(state.activeExampleId);
  const reconciledTestbench = reconcileTestbenchAfterDesignChange({
    state,
    snapshot,
    nextIoRows,
    designBehaviorChanged,
    isDetachingFromExample,
  });
  const nextProjectKind = isDetachingFromExample
    ? (nextCircuit.nodes.length > 0 ? 'custom' : 'blank')
    : state.projectKind === 'home' && nextCircuit.nodes.length > 0
      ? 'blank'
      : state.projectKind;
  const nextSourceExampleId = isDetachingFromExample
    ? (state.sourceExampleId ?? state.activeExampleId ?? null)
    : state.sourceExampleId;
  const nextActiveExampleId = isDetachingFromExample ? null : state.activeExampleId;
  // Detaching a starter removes example ownership, not the student's only honest
  // project identity. Keep the current name/summary unless the user explicitly changes them.
  const nextProjectName = state.projectName;
  const nextProjectDescription = state.projectDescription;
  return {
    circuit: nextCircuit,
    hierarchy: nextHierarchy,
    customComponents: nextHierarchy.modules.map(toCompositeDefinition),
    hardwareMappingV2: nextHardwareMappingV2,
    projectIoRows: nextIoRows,
    projectVectors: reconciledTestbench.projectVectors,
    customVectors: reconciledTestbench.customVectors,
    scenarios: reconciledTestbench.scenarios,
    macroInsertionCounts: cloneMacroInsertionCounts(snapshot.macroInsertionCounts),
    designPast: history.designPast,
    designFuture: history.designFuture,
    // Tracks state transitions, not unique circuit graphs. Undo/redo transitions
    // intentionally advance this counter just like forward edits.
    designRevision: state.designRevision + 1,
    sim: designBehaviorChanged
      ? initializeSimulationStateForCircuit(
          elaborateProjectHierarchy(nextCircuit, nextHierarchy),
          nextIoRows,
          state.sim,
        )
      : cloneSimState(state.sim),
    projectName: nextProjectName,
    projectDescription: nextProjectDescription,
    projectKind: nextProjectKind,
    sourceExampleId: nextSourceExampleId,
    scenarioAuthority: reconciledTestbench.scenarioAuthority,
    activeExampleId: nextActiveExampleId,
    // A behavioral edit invalidates produced evidence, never authored intent.
    // Preserve the previous run as an inspectable stale reference while
    // dirtySinceVerify prevents it from carrying current PASS/FAIL authority.
    verifyLastRun: state.verifyLastRun ? cloneVerifyRun(state.verifyLastRun) : undefined,
    projectHealthCore: {
      ...state.projectHealthCore,
      lastVerify: state.projectHealthCore.lastVerify,
      dirtySinceVerify: designBehaviorChanged ? true : state.projectHealthCore.dirtySinceVerify,
      dirtySinceExport: designBehaviorChanged ? true : state.projectHealthCore.dirtySinceExport,
    },
  };
}

function commitModuleDefinitionSnapshot(
  state: ProjectRuntimeState,
  hierarchy: ProjectHierarchyDocument,
): ReturnType<typeof commitDesignSnapshot> {
  return commitDesignSnapshot(
    state,
    {
      circuit: cloneCircuit(state.circuit),
      hierarchy: cloneProjectHierarchy(hierarchy),
      projectIoRows: cloneIoRows(state.projectIoRows),
      hardwareMappingV2: cloneHardwareMappingDocumentV2(state.hardwareMappingV2),
      projectVectors: cloneVectors(state.projectVectors),
      macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
    },
    {
      designPast: [...state.designPast, createDesignHistorySnapshot(state)].slice(
        -state.maxDesignHistory,
      ),
      designFuture: [],
    },
  );
}

function cloneVerifyRun(run: RuntimeVerifyRun): RuntimeVerifyRun {
  return {
    ...run,
    runKind: getRuntimeVerifyRunKind(run),
    scenarioVersion:
      Number.isFinite(run.scenarioVersion) ? Math.max(0, Math.floor(Number(run.scenarioVersion))) : undefined,
    scenarioContentHash:
      typeof run.scenarioContentHash === 'string' && run.scenarioContentHash.trim().length > 0
        ? run.scenarioContentHash.trim()
        : undefined,
    scenarioStimulusHash:
      typeof run.scenarioStimulusHash === 'string' && run.scenarioStimulusHash.trim().length > 0
        ? run.scenarioStimulusHash.trim()
        : undefined,
    mappingEvidenceHash:
      typeof run.mappingEvidenceHash === 'string' && run.mappingEvidenceHash.trim().length > 0
        ? run.mappingEvidenceHash.trim()
        : undefined,
    scheduleContract: run.scheduleContract
      ? cloneVerifyScheduleContract(run.scheduleContract)
      : undefined,
    clockPolicy: run.clockPolicy ? { ...run.clockPolicy } : undefined,
    meta: { ...run.meta },
    report: {
      ...run.report,
      rows: run.report.rows.map((row) => ({ ...row })),
      vectors: run.report.vectors.map((vector) => ({
        ...vector,
        inputs: { ...vector.inputs },
        expected: { ...vector.expected },
      })),
      inputsAtTick: Object.fromEntries(
        Object.entries(run.report.inputsAtTick).map(([tick, inputs]) => [tick, { ...inputs }])
      ),
      inputsByVectorId: Object.fromEntries(
        Object.entries(run.report.inputsByVectorId ?? {}).map(([vectorId, inputs]) => [
          vectorId,
          { ...inputs },
        ])
      ),
      signalRoles: { ...run.report.signalRoles },
    },
    waveform: run.waveform.map((sample) => ({
      tick: sample.tick,
      signals: { ...sample.signals },
      mismatches: sample.mismatches.map((entry) => ({ ...entry })),
    })),
    traceWaveform: run.traceWaveform?.map((sample) => ({
      tick: sample.tick,
      signals: { ...sample.signals },
      mismatches: [],
    })),
    evidence: run.evidence
      ? {
          circuitHash: run.evidence.circuitHash,
          ioRows: run.evidence.ioRows.map((row) => ({ ...row })),
          vectors: run.evidence.vectors.map((vector) => ({
            ...vector,
            inputs: { ...vector.inputs },
            expected: { ...vector.expected },
          })),
          normalizationMap: run.evidence.normalizationMap.map((entry) => ({ ...entry })),
          preflight: run.evidence.preflight.map((entry) => ({ ...entry })),
          failures: run.evidence.failures.map((entry) => ({ ...entry })),
        }
      : undefined,
  };
}

function cloneVerifyScheduleContract(contract: VerifyScheduleContract): VerifyScheduleContract {
  return {
    ...contract,
    analysis: {
      ...contract.analysis,
      sequentialNodes: contract.analysis.sequentialNodes.map((node) => ({ ...node })),
    },
    resetHint: contract.resetHint ? { ...contract.resetHint } : undefined,
    temporalIssues: contract.temporalIssues.map((issue) => ({ ...issue })),
  };
}

// ---------------------------------------------------------------------------
// Verify Authority and Invalidation Rules
// ---------------------------------------------------------------------------
//
// A Verify result is authoritative when ALL of the following hold:
//   1. It has a non-empty scenarioId that is not the legacy 'runtime-trace' sentinel.
//   2. Its deterministicHash is a valid non-legacy hash (does not start with 'sim_').
//   3. Its reportHash is a non-empty string.
//   4. It was produced by an assertion-backed verify run, not a trace-only run.
//
// A result loses authority — and must be demoted to STALE — immediately when any of:
//   a. Circuit I/O shape changes (adds, removes, or renames input/output nodes).
//      Detected by: lastRun.deterministicHash !== currentDeterministicHash.
//   b. Active stimulus changes (ticks or input values added, removed, or reordered).
//      Detected by: lastRun.scenarioStimulusHash !== computeScenarioStimulusHash(activeScenario).
//      Expected-output edits alone do not stale waveform evidence.
//   c. Sequential/clock policy changes (clocking mode, clock net, reset policy).
//      Detected by: deterministicHash mismatch (clock topology is baked into the hash).
//   d. Mapped board IO changes (pin assignments for IO nodes are updated).
//      Detected by: deterministicHash mismatch (ioMapping is included in hash).
//
// When a run is invalidated:
//   - Authored stimulus and expected outputs remain durable project documents.
//   - Orphaned references remain visible for review instead of being silently deleted.
//   - The current PASS/FAIL and waveform slots are cleared; history remains archival.
//
// Invalidation is handled at two layers:
//   1. Load-time: hasLegacyVerifyTrust() clears runs with pre-authoritative hash formats.
//   2. Render-time: isRunStale in VerifySurface.tsx computes the live hash mismatch gate.
//      See: packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx — isRunStale.
//
// These rules implement the principle that STALE ≠ FAIL. A stale result tells the student
// "we don't know yet" — it must never be displayed as a circuit failure.
// ---------------------------------------------------------------------------

function isAuthoritativeVerifyHash(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !value.startsWith('sim_');
}

function isAuthoritativeVerifyRun(run: RuntimeVerifyRun | undefined | null): run is RuntimeVerifyRun {
  if (!run) return false;
  if (run.scenarioId.trim().length === 0 || run.scenarioId === 'runtime-trace') return false;
  if (!isAuthoritativeVerifyHash(run.deterministicHash)) return false;
  if (typeof run.reportHash !== 'string' || run.reportHash.trim().length === 0) return false;
  return getRuntimeVerifyRunKind(run) === 'verify';
}

function isLegacyRuntimeTraceVerifyRun(run: RuntimeVerifyRun | undefined | null): boolean {
  return Boolean(run) && getRuntimeVerifyRunKind(run) === 'trace';
}

function hasLegacyVerifyTrust(
  verifyLastRun: RuntimeVerifyRun | undefined,
  projectHealthCore: unknown
): boolean {
  if (isLegacyRuntimeTraceVerifyRun(verifyLastRun)) return true;
  if (!projectHealthCore || typeof projectHealthCore !== 'object') return false;
  const candidate = projectHealthCore as Partial<ProjectHealthCore>;
  const lastVerify = candidate.lastVerify;
  if (!lastVerify || typeof lastVerify !== 'object') return false;
  return !isAuthoritativeVerifyHash(lastVerify.hash);
}

function cloneSimState(sim: RuntimeSimState): RuntimeSimState {
  return {
    ...sim,
    inputs: { ...sim.inputs },
    signals: { ...sim.signals },
    trace: sim.trace.map((entry) => ({
      tick: entry.tick,
      signals: { ...entry.signals },
    })),
    probes: sim.probes.map((probe) => ({ ...probe })),
    guard: sim.guard
      ? {
          ...sim.guard,
          diagnostics: sim.guard.diagnostics.map((diagnostic) => ({ ...diagnostic })),
        }
      : undefined,
  };
}

function normalizePersistedIoRows(
  value: unknown,
  fallback: ProjectIoRow[]
): ProjectIoRow[] {
  if (!Array.isArray(value)) return cloneIoRows(fallback);
  const normalized = value
    .map((entry, index) => normalizePersistedIoRow(entry, index))
    .filter((entry): entry is ProjectIoRow => entry !== null);
  return normalized.length > 0 ? normalized : cloneIoRows(fallback);
}

function normalizePersistedIoRow(
  value: unknown,
  index: number
): ProjectIoRow | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ProjectIoRow>;
  const direction =
    candidate.direction === 'in' || candidate.direction === 'out'
      ? candidate.direction
      : null;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
  if (!direction || !id || !label) return null;
  return {
    id,
    nodeId:
      typeof candidate.nodeId === 'string' && candidate.nodeId.trim().length > 0
        ? candidate.nodeId.trim()
        : '',
    port:
      typeof candidate.port === 'string' && candidate.port.trim().length > 0
        ? candidate.port.trim()
        : direction === 'in'
          ? 'out'
          : 'in',
    label,
    direction,
    pin: typeof candidate.pin === 'string' ? candidate.pin.trim().toUpperCase() : '',
    required: candidate.required !== false,
  };
}

function normalizePersistedVectors(
  value: unknown,
  fallback: TestVector[]
): TestVector[] {
  if (!Array.isArray(value)) return cloneVectors(fallback);
  return value
    .map((entry, index) => normalizePersistedVector(entry, index))
    .filter((entry): entry is TestVector => entry !== null);
}

function normalizePersistedVector(
  value: unknown,
  index: number
): TestVector | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<TestVector>;
  return {
    tick: Number.isFinite(candidate.tick) ? Math.max(0, Math.floor(Number(candidate.tick))) : index,
    inputs: normalizeBitRecord(candidate.inputs as Record<string, unknown> | undefined),
    expected: normalizeBitRecord(candidate.expected as Record<string, unknown> | undefined),
  };
}

function normalizePersistedSimState(
  value: unknown,
  circuit: Circuit,
  ioRows: ProjectIoRow[]
): RuntimeSimState {
  const model = buildSimulationModelForCircuit(circuit);
  const fallback = initializeSimulationStateForCircuit(circuit, ioRows);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<RuntimeSimState>;
  const normalizedState: RuntimeSimState = {
    ...fallback,
    tick: Number.isFinite(candidate.tick) ? Math.max(0, Math.floor(Number(candidate.tick))) : fallback.tick,
    running: candidate.running === true,
    lastAction:
      candidate.lastAction === 'run' ||
      candidate.lastAction === 'pause' ||
      candidate.lastAction === 'step' ||
      candidate.lastAction === 'input' ||
      candidate.lastAction === 'reset'
        ? candidate.lastAction
        : fallback.lastAction,
    speedHz: clampSimSpeed(Number(candidate.speedHz)),
    irHash: typeof candidate.irHash === 'string' ? candidate.irHash : fallback.irHash,
    traceHash: typeof candidate.traceHash === 'string' ? candidate.traceHash : fallback.traceHash,
    inputs: normalizeBitRecord(candidate.inputs as Record<string, unknown> | undefined),
    signals: normalizeLogicRecord(candidate.signals as Record<string, unknown> | undefined),
    trace: Array.isArray(candidate.trace)
      ? candidate.trace
          .map((entry, index) => normalizePersistedTraceSample(entry, index))
          .filter((entry): entry is RuntimeSimState['trace'][number] => entry !== null)
      : fallback.trace,
    selectedSignalKey:
      typeof candidate.selectedSignalKey === 'string'
        ? candidate.selectedSignalKey.trim()
        : null,
    probes: Array.isArray(candidate.probes)
      ? candidate.probes
          .map((probe) => normalizePersistedProbe(probe))
          .filter((probe): probe is RuntimeSignalProbe => probe !== null)
      : fallback.probes,
    guard: undefined,
  };
  return model.isRunnable
    ? normalizedState
    : buildBlockedRuntimeSimState(normalizedState, model);
}

function normalizePersistedDesignPast(
  value: unknown,
  maxEntries: number
): DesignHistorySnapshot[] {
  const boundedLimit = normalizePersistedMaxDesignHistory(maxEntries, DEFAULT_MAX_DESIGN_HISTORY);
  return normalizePersistedDesignHistoryStack(value).slice(-boundedLimit);
}

function normalizePersistedDesignFuture(
  value: unknown,
  maxEntries: number
): DesignHistorySnapshot[] {
  const boundedLimit = normalizePersistedMaxDesignHistory(maxEntries, DEFAULT_MAX_DESIGN_HISTORY);
  return normalizePersistedDesignHistoryStack(value).slice(0, boundedLimit);
}

function normalizePersistedDesignHistoryStack(value: unknown): DesignHistorySnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizePersistedDesignHistorySnapshot(entry))
    .filter((entry): entry is DesignHistorySnapshot => entry !== null);
}

function normalizePersistedDesignHistorySnapshot(value: unknown): DesignHistorySnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DesignHistorySnapshot>;
  if (
    !candidate.circuit ||
    typeof candidate.circuit !== 'object' ||
    !Array.isArray((candidate.circuit as Circuit).nodes) ||
    !Array.isArray((candidate.circuit as Circuit).connections)
  ) {
    return null;
  }

  const normalizedRows = normalizePersistedIoRows(candidate.projectIoRows, []);
  let normalizedProject: RBProject;
  try {
    normalizedProject = normalizeRBProject({
      kind: 'rb-project',
      version: 1,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
      name: 'History Snapshot',
      description: '',
      circuit: candidate.circuit,
      ioMapping: toIoMapping(normalizedRows),
      hardwareMappingV2: candidate.hardwareMappingV2,
      vectors: [],
      meta: {
        projectId: 'rb-history-snapshot',
      },
    });
  } catch {
    return null;
  }

  const normalizedCircuit = cloneCircuit(normalizedProject.circuit);
  const hardwareMappingV2 = pickHardwareMappingV2FromProject(normalizedProject);
  const normalizedProjectIoRows = deriveProjectIoRowsFromCircuitAndV2(
    normalizedCircuit,
    hardwareMappingV2
  );

  return {
    circuit: normalizedCircuit,
    projectIoRows: normalizedProjectIoRows,
    hardwareMappingV2,
    projectVectors: normalizeVectorsForLiveIo(
      normalizePersistedVectors(candidate.projectVectors, []),
      normalizedProjectIoRows
    ),
    macroInsertionCounts: normalizeMacroInsertionCounts(candidate.macroInsertionCounts),
  };
}

function normalizePersistedMaxDesignHistory(value: unknown, fallback: number): number {
  const baseline = Number.isFinite(fallback) ? Number(fallback) : DEFAULT_MAX_DESIGN_HISTORY;
  const raw = Number.isFinite(value) ? Number(value) : baseline;
  return Math.max(1, Math.min(MAX_ALLOWED_DESIGN_HISTORY, Math.floor(raw)));
}

function normalizePersistedDesignRevision(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function normalizePersistedTraceSample(
  value: unknown,
  index: number
): RuntimeSimState['trace'][number] | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as RuntimeSimState['trace'][number];
  return {
    tick: Number.isFinite(candidate.tick) ? Math.max(0, Math.floor(Number(candidate.tick))) : index,
    signals: normalizeLogicRecord(candidate.signals as Record<string, unknown> | undefined),
  };
}

function normalizePersistedProbe(value: unknown): RuntimeSignalProbe | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RuntimeSignalProbe>;
  const key = typeof candidate.key === 'string' ? candidate.key.trim() : '';
  if (!key) return null;
  return {
    key,
    label: typeof candidate.label === 'string' && candidate.label.trim().length > 0
      ? candidate.label.trim()
      : key,
  };
}

function tryCloneVerifyRun(value: unknown): RuntimeVerifyRun | undefined {
  if (!value || typeof value !== 'object') return undefined;
  try {
    return cloneVerifyRun(value as RuntimeVerifyRun);
  } catch {
    return undefined;
  }
}

function normalizeVerifyRunHistory(value: unknown): VerifyRunLedgerEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeVerifyRunLedgerEntry(entry))
    .filter((entry): entry is VerifyRunLedgerEntry => entry !== null)
    .slice(-50);
}

function normalizeVerifyRunLedgerEntry(value: unknown): VerifyRunLedgerEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<VerifyRunLedgerEntry>;
  if (
    typeof candidate.runId !== 'string' ||
    typeof candidate.ranAtIso !== 'string' ||
    (candidate.status !== 'pass' && candidate.status !== 'fail') ||
    typeof candidate.circuitHash !== 'string' ||
    typeof candidate.vectorsHash !== 'string' ||
    typeof candidate.mappingHash !== 'string' ||
    typeof candidate.projectHash !== 'string'
  ) {
    return null;
  }

  const firstFailure = candidate.firstFailure;
  return {
    runId: candidate.runId,
    scenarioId: typeof candidate.scenarioId === 'string' ? candidate.scenarioId : undefined,
    scenarioName: typeof candidate.scenarioName === 'string' ? candidate.scenarioName : undefined,
    runKind: candidate.runKind === 'verify' || candidate.runKind === 'trace' ? candidate.runKind : undefined,
    tickCount: typeof candidate.tickCount === 'number' && Number.isFinite(candidate.tickCount) ? Math.max(0, Math.floor(candidate.tickCount)) : undefined,
    failedSignals: Array.isArray(candidate.failedSignals)
      ? candidate.failedSignals.filter((signal): signal is string => typeof signal === 'string')
      : undefined,
    ranAtIso: candidate.ranAtIso,
    status: candidate.status,
    passedRows: Number.isFinite(candidate.passedRows) ? Math.max(0, Math.floor(Number(candidate.passedRows))) : 0,
    failedRows: Number.isFinite(candidate.failedRows) ? Math.max(0, Math.floor(Number(candidate.failedRows))) : 0,
    firstFailure:
      firstFailure &&
      typeof firstFailure === 'object' &&
      Number.isFinite(firstFailure.tick) &&
      typeof firstFailure.signal === 'string' &&
      typeof firstFailure.expected === 'string' &&
      typeof firstFailure.actual === 'string'
        ? {
            tick: Math.max(0, Math.floor(Number(firstFailure.tick))),
            signal: firstFailure.signal,
            expected: firstFailure.expected,
            actual: firstFailure.actual,
          }
        : null,
    circuitHash: candidate.circuitHash,
    vectorsHash: candidate.vectorsHash,
    mappingHash: candidate.mappingHash,
    projectHash: candidate.projectHash,
    didCircuitChangeSinceLast: candidate.didCircuitChangeSinceLast === true,
    didVectorsChangeSinceLast: candidate.didVectorsChangeSinceLast === true,
    didMappingChangeSinceLast: candidate.didMappingChangeSinceLast === true,
  };
}

function normalizePersistedProjectHealth(
  value: unknown,
  verifyLastRun: RuntimeVerifyRun | undefined,
  fallback: ProjectHealthCore,
  invalidateVerifyTrust = false
): ProjectHealthCore {
  if (invalidateVerifyTrust) {
    const candidate = value && typeof value === 'object' ? (value as Partial<ProjectHealthCore>) : undefined;
    return {
      lastVerify: undefined,
      lastExport: candidate ? normalizePersistedLastExport(candidate.lastExport) : fallback.lastExport,
      dirtySinceVerify: true,
      dirtySinceExport:
        candidate && typeof candidate.dirtySinceExport === 'boolean'
          ? candidate.dirtySinceExport
          : true,
    };
  }

  if (!value || typeof value !== 'object') {
    return {
      lastVerify: verifyLastRun
        ? {
            status: verifyLastRun.status,
            hash: verifyLastRun.deterministicHash,
            runKind: getRuntimeVerifyRunKind(verifyLastRun) ?? 'verify',
            reportHash: verifyLastRun.reportHash,
            report: verifyLastRun.report,
            failingTick: verifyLastRun.firstFailingTick,
            ranAtIso: verifyLastRun.generatedAtIso,
          }
        : fallback.lastVerify,
      lastExport: fallback.lastExport,
      dirtySinceVerify: fallback.dirtySinceVerify,
      dirtySinceExport: fallback.dirtySinceExport,
    };
  }

  const candidate = value as Partial<ProjectHealthCore>;
  const lastVerify = normalizePersistedLastVerify(candidate.lastVerify, verifyLastRun);
  return {
    lastVerify,
    lastExport: normalizePersistedLastExport(candidate.lastExport),
    dirtySinceVerify:
      typeof candidate.dirtySinceVerify === 'boolean'
        ? candidate.dirtySinceVerify
        : lastVerify ? false : true,
    dirtySinceExport:
      typeof candidate.dirtySinceExport === 'boolean'
        ? candidate.dirtySinceExport
        : true,
  };
}

function normalizePersistedLastVerify(
  value: unknown,
  verifyLastRun: RuntimeVerifyRun | undefined
): ProjectHealthCore['lastVerify'] {
  if (!value || typeof value !== 'object') {
    if (!verifyLastRun) return undefined;
    return {
      status: verifyLastRun.status,
      hash: verifyLastRun.deterministicHash,
      runKind: getRuntimeVerifyRunKind(verifyLastRun) ?? 'verify',
      reportHash: verifyLastRun.reportHash,
      qualification: verifyLastRun.qualification,
      report: verifyLastRun.report,
      failingTick: verifyLastRun.firstFailingTick,
      ranAtIso: verifyLastRun.generatedAtIso,
    };
  }
  const candidate = value as Partial<NonNullable<ProjectHealthCore['lastVerify']>>;
  if (
    (candidate.status !== 'pass' && candidate.status !== 'fail') ||
    !isAuthoritativeVerifyHash(candidate.hash) ||
    typeof candidate.ranAtIso !== 'string'
  ) {
    return undefined;
  }
  return {
    status: candidate.status,
    hash: candidate.hash,
    runKind:
      candidate.runKind === 'trace' || candidate.runKind === 'verify'
        ? candidate.runKind
        : getRuntimeVerifyRunKind(verifyLastRun) ?? 'verify',
    qualification: candidate.qualification === 'incomplete-mapping' ? 'incomplete-mapping' : undefined,
    reportHash: typeof candidate.reportHash === 'string' ? candidate.reportHash : undefined,
    report: verifyLastRun?.report,
    failingTick: Number.isFinite(candidate.failingTick) ? Number(candidate.failingTick) : verifyLastRun?.firstFailingTick,
    ranAtIso: candidate.ranAtIso,
  };
}

function normalizePersistedLastExport(
  value: unknown
): ProjectHealthCore['lastExport'] {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<NonNullable<ProjectHealthCore['lastExport']>>;
  if (
    (candidate.status !== 'ok' && candidate.status !== 'blocked') ||
    typeof candidate.ranAtIso !== 'string'
  ) {
    return undefined;
  }
  return {
    status: candidate.status,
    hash: typeof candidate.hash === 'string' ? candidate.hash : undefined,
    manifestHash: typeof candidate.manifestHash === 'string' ? candidate.manifestHash : undefined,
    bundleHash: typeof candidate.bundleHash === 'string' ? candidate.bundleHash : undefined,
    packageHash: typeof candidate.packageHash === 'string' ? candidate.packageHash : undefined,
    verificationTrust:
      candidate.verificationTrust === 'draft' ||
      candidate.verificationTrust === 'unverified' ||
      candidate.verificationTrust === 'trusted'
        ? candidate.verificationTrust
        : undefined,
    downloadKind:
      candidate.downloadKind === 'project' || candidate.downloadKind === 'kit'
        ? candidate.downloadKind
        : undefined,
    downloadedAtIso:
      typeof candidate.downloadedAtIso === 'string' ? candidate.downloadedAtIso : undefined,
    sourceHashes:
      candidate.sourceHashes && typeof candidate.sourceHashes === 'object'
        ? {
            project:
              typeof candidate.sourceHashes.project === 'string'
                ? candidate.sourceHashes.project
                : undefined,
            export:
              typeof candidate.sourceHashes.export === 'string'
                ? candidate.sourceHashes.export
                : undefined,
            verify:
              typeof candidate.sourceHashes.verify === 'string'
                ? candidate.sourceHashes.verify
                : undefined,
          }
        : undefined,
    sourceCurrentness:
      candidate.sourceCurrentness && typeof candidate.sourceCurrentness === 'object'
        ? {
            project: normalizePersistedExportSourceState(candidate.sourceCurrentness.project),
            export: normalizePersistedExportSourceState(candidate.sourceCurrentness.export),
            mapping: normalizePersistedExportSourceState(candidate.sourceCurrentness.mapping),
            verify: normalizePersistedExportSourceState(candidate.sourceCurrentness.verify),
          }
        : undefined,
    artifacts: Array.isArray(candidate.artifacts)
      ? candidate.artifacts.filter((artifact): artifact is string => typeof artifact === 'string')
      : undefined,
    ranAtIso: candidate.ranAtIso,
  };
}

function normalizePersistedExportSourceState(
  value: unknown
): ProjectHealthExportSourceState {
  if (
    value === 'current' ||
    value === 'stale' ||
    value === 'missing' ||
    value === 'failed' ||
    value === 'trace-only' ||
    value === 'incomplete' ||
    value === 'blocked'
  ) {
    return value;
  }
  return 'missing';
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function clampSimSpeed(value: number): number {
  const next = Number.isFinite(value) ? Math.floor(value) : DEFAULT_SIM_SPEED_HZ;
  return Math.max(1, Math.min(120, next));
}

function normalizeVerifyRows(
  rows: RunVerificationInput['rows'] | undefined
): Array<{ tick: number; signal: string; expected: string; actual: string }> {
  return (rows ?? []).map((row, index) => ({
    tick: Number.isFinite(row.tick) ? Math.max(0, Math.floor(row.tick)) : index,
    signal: row.signal.trim(),
    expected: String(row.expected),
    actual: String(row.actual),
  }));
}

function toVerifyVectors(vectors: TestVector[]): VerifyReportVector[] {
  return vectors
    .map((vector, index) => ({
      id: `vec-${String(index + 1).padStart(2, '0')}`,
      tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
      inputs: normalizeBitRecord(vector.inputs ?? {}),
      expected: normalizeBitRecord(vector.expected ?? {}),
      caseIndex: index,
    }))
    .sort((left, right) =>
      left.tick === right.tick
        ? (left.caseIndex ?? 0) - (right.caseIndex ?? 0)
        : left.tick - right.tick
    );
}

function normalizeBitRecord(
  record: Record<string, unknown> | undefined
): Record<string, 0 | 1> {
  const source = record ?? {};
  const normalized: Record<string, 0 | 1> = {};
  for (const key of Object.keys(source).sort()) {
    normalized[key] = source[key] === true || source[key] === 1 || source[key] === '1' ? 1 : 0;
  }
  return normalized;
}

function normalizeLogicRecord(
  record: Record<string, unknown> | undefined
): Record<string, RuntimeLogicValue> {
  const source = record ?? {};
  const normalized: Record<string, RuntimeLogicValue> = {};
  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    normalized[key] =
      value === true || value === 1 || value === '1'
        ? 1
        : value === 'X' || value === 'x'
          ? 'X'
          : value === 'Z' || value === 'z'
            ? 'Z'
            : 0;
  }
  return normalized;
}

function toIoMapping(rows: ProjectIoRow[]): IoMapping {
  return {
    inputs: rows
      .filter((row) => row.direction === 'in')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId,
        port: row.port,
        label: row.label,
        pin: row.pin,
      })),
    outputs: rows
      .filter((row) => row.direction === 'out')
      .map((row) => ({
        id: row.id,
        nodeId: row.nodeId,
        port: row.port,
        label: row.label,
        pin: row.pin,
      })),
  };
}

function buildVerifyRunMeta(
  scheduleContract: VerifyScheduleContract,
  clockPolicy?: VerifyClockPolicy | null,
  vectors: TestVector[] = [],
  ioRows: ProjectIoRow[] = []
): VerifyRunMeta {
  const isClocked = scheduleContract.schedule === 'clocked_macro';
  return {
    circuitKind: isClocked ? 'sequential' : 'combinational',
    clockingProtocol: isClocked ? 'clocked_macro' : null,
    samplePoint: scheduleContract.samplePoint,
    tick0Meaning: resolveVerifyTick0Meaning({
      structuralTick0Meaning: scheduleContract.tick0Meaning,
      vectors,
      ioRows,
      policy: clockPolicy,
    }),
    clockSignalName: scheduleContract.clockSignalName ?? null,
  };
}

function suggestBasys3Pin(
  signal: { id: string; label?: string; direction: 'in' | 'out' },
  index: number
): string {
  const normalizedToken = [signal.id, signal.label]
    .map((value) => normalizePortToken(value ?? ''))
    .find((value) => value.length > 0) ?? '';
  if (signal.direction === 'in') {
    if (
      normalizedToken === 'clk' ||
      normalizedToken === 'clock' ||
      normalizedToken === 'clk100mhz' ||
      normalizedToken.endsWith('clk') ||
      normalizedToken.includes('clock')
    ) {
      return 'CLK100MHZ';
    }
    if (
      normalizedToken === 'rst' ||
      normalizedToken.endsWith('rst') ||
      normalizedToken.includes('reset')
    ) {
      return 'BTNC';
    }
    return `SW${Math.min(index, 15)}`;
  }
  return `LD${Math.min(index, 15)}`;
}

function getNextDesignNodeId(circuit: Circuit): string {
  const prefix = 'node-v2-';
  const used = new Set(circuit.nodes.map((node) => node.id));
  let maxNumeric = 0;
  for (const node of circuit.nodes) {
    const match = /^node-v2-(\d+)$/.exec(node.id);
    if (!match) continue;
    const value = Number.parseInt(match[1] ?? '0', 10);
    if (Number.isFinite(value)) {
      maxNumeric = Math.max(maxNumeric, value);
    }
  }
  let next = maxNumeric + 1;
  while (used.has(`${prefix}${next}`)) {
    next += 1;
  }
  return `${prefix}${next}`;
}

function getNextNamedNodeId(circuit: Circuit, baseId: string): string {
  const seed = normalizeBoardRowId(baseId);
  const used = new Set(circuit.nodes.map((node) => normalizePortToken(node.id)));
  if (!used.has(normalizePortToken(seed))) return seed;
  let suffix = 2;
  while (used.has(normalizePortToken(`${seed}_${suffix}`))) {
    suffix += 1;
  }
  return `${seed}_${suffix}`;
}

function getNextIoRowId(rows: ProjectIoRow[], baseId: string): string {
  const normalizedBase = normalizeBoardRowId(baseId);
  const used = new Set(rows.map((row) => normalizePortToken(row.id)));
  if (!used.has(normalizePortToken(normalizedBase))) return normalizedBase;
  let suffix = 2;
  while (used.has(normalizePortToken(`${normalizedBase}_${suffix}`))) {
    suffix += 1;
  }
  return `${normalizedBase}_${suffix}`;
}

function normalizeAliasToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

// normalizeBoardRowId now lives in @redbyte/rb-utils (one rule, shared with the export generator).

function normalizePortToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '');
}

function normalizeBoardIoKind(
  kind: 'switch' | 'button' | 'clock' | 'reset' | 'led' | 'segment' | 'anode' | 'dp' | undefined,
  isInput: boolean
): 'switch' | 'button' | 'clock' | 'reset' | 'led' | 'segment' | 'anode' | 'dp' {
  if (kind) return kind;
  return isInput ? 'switch' : 'led';
}

function roundToMill(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function createProjectId(seed: string): string {
  const normalizedSeed = normalizeBoardRowId(seed).replace(/_/g, '-');
  const suffix = Date.now().toString(36).slice(-6);
  return `rb-${normalizedSeed}-${suffix}`;
}

// E2E test hook: expose project runtime store for programmatic access (gates/dev/test).
if (typeof window !== 'undefined') {
  (window as any).__RB_PROJECT_RUNTIME__ = useProjectRuntime;
}
