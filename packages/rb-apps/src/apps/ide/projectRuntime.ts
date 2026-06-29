import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Circuit, CompositeNodeDef, SimulationModel } from '@redbyte/rb-logic-core';
import { buildSimulationModel, elaborateCircuit, registerCompositeNode } from '@redbyte/rb-logic-core';
import type { HardwareMappingDocumentV2, IoMapping, TestVector } from '@redbyte/rb-utils';
import {
  applyMaterializedPinToHardwareMappingV2,
  migrateIoMappingToHardwareMappingV2,
  resolveIoMappingFromProjectFields,
} from '@redbyte/rb-utils';
import type { CustomTestVector } from './components/VectorEditor';
import { buildCurrentVerifyProjectHash } from './verifyProjectHash';
import { normalizeRBProject, type RBProject } from '../../export/projectFormat';
import { stableSerialize } from '../../utils/stableSerialize';
import {
  buildDeterministicVerifyContext,
  type VerifyScheduleContract,
} from '../../fpga/boards/basys3/verifySchedule';
import { digestValue } from '../../utils/digest';
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
import { generateBringUpVectors, generateStimulusVectors } from './bringupArtifacts';
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
import type { RuntimeSignalProbe, RuntimeSimState, RuntimeSimTraceSample } from './sim/simTypes';
import { buildCanonicalVerifyWaveSamples } from './sim/traceContract';
import {
  DEFAULT_SCENARIO_ID,
  createScenario,
  createDefaultScenario,
  getActiveScenario,
  materializeScenarioVectors,
  migrateProjectVectorsToScenario,
  repairScenarioLibrary,
  stampScenario,
  type VerifyScenario,
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
  type VerifyClockPolicy,
} from './verifyClockPolicy';

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
  status: 'pass' | 'fail';
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

export interface ProjectRuntimeState {
  projectId: string;
  projectName: string;
  projectDescription: string;
  lastSavedAt: string;
  projectKind: ProjectKind;
  sourceExampleId: string | null;
  scenarioAuthority: ScenarioAuthority;
  /**
   * Provenance of the last import commit. Cleared for native/example/blank paths.
   * Persisted so the Project Bridge and other truth surfaces survive reload.
   */
  importMeta: IdeImportMeta | null;
  activeExampleId: string | null;
  /** Canonical hardware mapping — Map Pins applies pins via V2 entries, not only flat rows. */
  hardwareMappingV2: HardwareMappingDocumentV2;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  scenarios: VerifyScenario[];
  activeScenarioId: string;
  customVectors: CustomTestVector[];
  circuit: Circuit;
  designPast: DesignHistorySnapshot[];
  designFuture: DesignHistorySnapshot[];
  maxDesignHistory: number;
  designRevision: number;
  verifyLastRun?: RuntimeVerifyRun;
  verifyRunHistory: VerifyRunLedgerEntry[];
  sim: RuntimeSimState;
  projectHealthCore: ProjectHealthCore;
  actions: ProjectRuntimeActions;
  loadExample: (exampleId: string) => void;
  loadFromProject: (project: RBProject) => void;
  setMappingPin: (rowId: string, pin: string) => void;
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
  setImportMeta: (meta: IdeImportMeta | null) => void;
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
}

interface PersistedRuntimeState {
  projectId: string;
  projectName: string;
  projectDescription: string;
  lastSavedAt: string;
  projectKind?: ProjectKind;
  sourceExampleId?: string | null;
  scenarioAuthority?: ScenarioAuthority;
  importMeta?: IdeImportMeta | null;
  activeExampleId: string | null;
  hardwareMappingV2?: HardwareMappingDocumentV2;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  scenarios?: VerifyScenario[];
  activeScenarioId?: string;
  customVectors: CustomTestVector[];
  circuit: Circuit;
  designPast?: DesignHistorySnapshot[];
  designFuture?: DesignHistorySnapshot[];
  maxDesignHistory?: number;
  designRevision?: number;
  verifyLastRun?: RuntimeVerifyRun;
  verifyRunHistory: VerifyRunLedgerEntry[];
  sim: RuntimeSimState;
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
}

interface RuntimeSeedState extends PersistedRuntimeState {
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
              const model = buildSimulationModelForCircuit(state.circuit);
              const result = advanceSimulationStateFromModel(
                state.circuit,
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
              const model = buildSimulationModelForCircuit(state.circuit);
              const result = advanceSimulationStateFromModel(
                state.circuit,
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
              const model = buildSimulationModelForCircuit(state.circuit);
              const result = resetSimulationStateFromModel(
                state.circuit,
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
              const model = buildSimulationModelForCircuit(state.circuit);
              const result = recomputeSimulationStateFromModel(
                state.circuit,
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
                    ...buildBlockedRuntimeSnapshotFromModel(state.circuit, model, nextInputs),
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
              const model = buildSimulationModelForCircuit(state.circuit);
              const result = recomputeSimulationStateFromModel(
                state.circuit,
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
                    ...buildBlockedRuntimeSnapshotFromModel(state.circuit, model, nextInputs),
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
      loadFromProject: (project) => {
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
        const sourceProjectVectors = normalizeVectorsForLiveIo(
          rekeyVectorsForLiveIo(cloneVectors(project.vectors ?? []), legacyProjectIoRows, projectIoRows),
          projectIoRows
        );
        const restoredIdentity = resolveDetachedExampleIdentity({
          projectKind,
          inferredDetachedExample,
          projectName: project.name || 'Imported project',
          projectDescription: project.description ?? '',
          fallbackProjectName: 'Imported project',
        });
        const shouldResetDetachedStarterCompareState =
          projectKind !== 'example' &&
          Boolean(sourceExampleId) &&
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
          : normalizeScenarioAuthority(
              project.meta?.scenarioAuthority,
              deriveScenarioAuthority({
                projectKind,
                activeExampleId,
                hasVectors: projectVectors.length > 0,
                hasAssertions: projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0),
                dirtySinceVerify: true,
                verifyStatus: null,
                vectorsAreAutoGenerated: projectKind === 'example',
              })
            );
        const loadedProjectName = restoredIdentity.projectName;
        const loadedProjectDescription = restoredIdentity.projectDescription;
        // Register any custom components from the project
        for (const def of (project.customComponents ?? [])) {
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
          projectKind,
          sourceExampleId,
          scenarioAuthority,
          importMeta: null,
          activeExampleId,
          hardwareMappingV2,
          projectIoRows,
          projectVectors,
          ...migrateProjectVectorsToScenario(projectVectors),
          customVectors: [],
          circuit,
          designPast: [],
          designFuture: [],
          designRevision: 0,
          verifyLastRun: undefined,
          verifyRunHistory: [],
          sim: initializeSimulationStateForCircuit(circuit, projectIoRows),
          projectHealthCore: {
            dirtySinceVerify: true,
            dirtySinceExport: true,
          },
          macros: project.macros ?? [],
          macroInsertionCounts: {},
          customComponents: project.customComponents ?? [],
        });
      },
      setMappingPin: (rowId, pin) => {
        set((state) => {
          const nextDoc = applyMaterializedPinToHardwareMappingV2(
            structuredClone(state.hardwareMappingV2),
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
          const projectVectors = normalizeVectorsForLiveIo(cloneVectors(vectors), state.projectIoRows);
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
          const newScenario = createScenario('New Scenario', resolveActiveScenarioVectors(state));
          return commitScenarioSelection(state, [...state.scenarios, newScenario], newScenario.id);
        });
      },
      duplicateScenario: () => {
        set((state) => {
          const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
          if (!activeScenario) return state;
          const duplicate = {
            ...createScenario(`${activeScenario.name} Copy`, materializeScenarioVectors(activeScenario)),
            steps: activeScenario.steps?.map(cloneScenarioStep),
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
          const scenarioId = input.scenarioId.trim() || 'runtime-verify';
          const scenarioName = input.scenarioName.trim() || 'Runtime verification';
          const scenarioVersion =
            Number.isFinite(input.scenarioVersion)
              ? Math.max(0, Math.floor(Number(input.scenarioVersion)))
              : undefined;
          const scenarioContentHash =
            typeof input.scenarioContentHash === 'string' &&
            input.scenarioContentHash.trim().length > 0
              ? input.scenarioContentHash.trim()
              : undefined;
          const scenarioStimulusHash =
            typeof input.scenarioStimulusHash === 'string' &&
            input.scenarioStimulusHash.trim().length > 0
              ? input.scenarioStimulusHash.trim()
              : undefined;
          const circuitHash = digestValue(stableSerialize(state.circuit));
          const ioMapping = toIoMapping(state.projectIoRows);
          const verifyContext = buildDeterministicVerifyContext(
            state.circuit,
            ioMapping
          );
          const scheduleContract = input.scheduleContract
            ? cloneVerifyScheduleContract(input.scheduleContract)
            : verifyContext.schedule;
          const model = verifyContext.simModel;
          const authoredVectors = normalizeVectorsForLiveIo(
            cloneVectors(input.vectors ?? resolveActiveScenarioVectors(state)),
            state.projectIoRows
          );
          const clockPolicy =
            input.clockPolicy ??
            detectVerifyClockPolicy({
              circuit: state.circuit,
              ioRows: state.projectIoRows,
              scheduleContract,
            });
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
                  state.circuit,
                  model,
                  state.projectIoRows,
                  deterministicVectors,
                  scheduleContract,
                  clockPolicy
                )
              : null;
          const normalizedRows = deterministicResult?.rows ?? normalizeVerifyRows(input.rows);
          const failedRows = normalizedRows.filter((row) => row.expected !== row.actual);
          const preflightIssues = deterministicResult?.evidence.preflight ?? [];
          const status: 'pass' | 'fail' =
            failedRows.length > 0 || preflightIssues.length > 0 ? 'fail' : 'pass';
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
            status: report.status,
            qualification: detectIncompleteMappingQualification(state.projectIoRows, report.status),
            deterministicHash: report.deterministicHash,
            reportHash: report.reportHash,
            firstFailingTick: report.firstFailingTick,
            generatedAtIso: report.generatedAtIso,
            schedule: scheduleContract.schedule,
            scheduleContract: cloneVerifyScheduleContract(scheduleContract),
            clockPolicy: clockPolicy ? { ...clockPolicy } : undefined,
            meta: buildVerifyRunMeta(scheduleContract),
            report,
            waveform,
            evidence,
          };

          // Build ledger entry (synchronous hashes via digestValue + stableSerialize)
          const vectorsHash = digestValue(stableSerialize(runtimeVectors));
          const mappingHash = digestValue(stableSerialize(ioMapping));
          // Use the same hash function as buildCurrentVerifyProjectHash in IdeApp so that
          // deriveVerifyCurrent's ledger comparison always resolves correctly.
          // The prior inline computation included vector `id` fields (via cloneVectors spread)
          // while buildCurrentVerifyProjectHash strips them — causing a permanent stale loop
          // whenever vectors carried an `id` (e.g., after inserting a clock pattern).
          const projectHash = buildCurrentVerifyProjectHash({
            circuit: state.circuit,
            projectVectors: state.projectVectors,
            customVectors: state.customVectors,
            projectIoRows: state.projectIoRows,
          });
          const prevEntry = state.verifyRunHistory[state.verifyRunHistory.length - 1] ?? null;
          const firstFailRow = report.rows.find((row) => row.status === 'fail') ?? null;
          const ledgerEntry: VerifyRunLedgerEntry = {
            runId: `run-${ranAtIso}-${report.reportHash.slice(0, 8)}`,
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
          },
        }));
      },
      recordVerification: (result) => {
        set((state) => {
          const scheduleContract = buildDeterministicVerifyContext(
            state.circuit,
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
        set((state) => ({
          customComponents: [
            ...state.customComponents.filter((c) => c.name !== def.name),
            def,
          ],
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: 5,
      merge: (persistedState, currentState) =>
        mergePersistedRuntimeState(persistedState, currentState as ProjectRuntimeState),
      partialize: (state): PersistedRuntimeState => ({
        projectId: state.projectId,
        projectName: state.projectName,
        projectDescription: state.projectDescription,
        lastSavedAt: state.lastSavedAt,
        projectKind: state.projectKind,
        sourceExampleId: state.sourceExampleId,
        scenarioAuthority: state.scenarioAuthority,
        importMeta: cloneImportMeta(state.importMeta),
        activeExampleId: state.activeExampleId,
        hardwareMappingV2: structuredClone(state.hardwareMappingV2),
        projectIoRows: cloneIoRows(state.projectIoRows),
        projectVectors: cloneVectors(state.projectVectors),
        scenarios: state.scenarios.map((s) => ({
          ...s,
          vectors: s.vectors.map((v) => ({ ...v, inputs: { ...v.inputs }, expected: { ...(v.expected ?? {}) } })),
          steps: s.steps?.map(cloneScenarioStep),
        })),
        activeScenarioId: state.activeScenarioId,
        customVectors: [...(state.customVectors ?? [])],
        circuit: cloneCircuit(state.circuit),
        designPast: cloneDesignHistoryPast(state.designPast, state.maxDesignHistory),
        designFuture: cloneDesignHistoryFuture(state.designFuture, state.maxDesignHistory),
        maxDesignHistory: state.maxDesignHistory,
        designRevision: state.designRevision,
        verifyLastRun: state.verifyLastRun
          ? cloneVerifyRun(state.verifyLastRun)
          : undefined,
        verifyRunHistory: state.verifyRunHistory.slice(-50),
        sim: cloneSimState(state.sim),
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
      meta: {
        projectId:
          typeof candidate.projectId === 'string' && candidate.projectId.trim().length > 0
            ? candidate.projectId
            : currentState.projectId,
      },
    });
  } catch {
    return currentState;
  }

  const circuit = cloneCircuit(normalizedProject.circuit);
  const legacyProjectIoRows = ioRowsFromProject(normalizedProject);
  const {
    hardwareMappingV2,
    projectIoRows,
  } = deriveAuthoritativeHardwareState(circuit, pickHardwareMappingV2FromProject(normalizedProject));
  const projectVectors = normalizeVectorsForLiveIo(
    rekeyVectorsForLiveIo(cloneVectors(normalizedProject.vectors ?? []), legacyProjectIoRows, projectIoRows),
    projectIoRows
  );
  const rawVerifyLastRun = tryCloneVerifyRun(candidate.verifyLastRun);
  const invalidateVerifyTrust = hasLegacyVerifyTrust(rawVerifyLastRun, candidate.projectHealthCore);
  const verifyLastRun = invalidateVerifyTrust ? undefined : rawVerifyLastRun;
  const verifyRunHistory = invalidateVerifyTrust ? [] : normalizeVerifyRunHistory(candidate.verifyRunHistory);
  const restoredVerifyProjectHash = digestValue(
    stableSerialize({
      circuit,
      vectors: projectVectors,
      mapping: toIoMapping(projectIoRows),
    })
  );
  const latestVerifyLedgerEntry = verifyRunHistory.at(-1);
  const hasRestoredVerifyProjectHashMismatch =
    !invalidateVerifyTrust &&
    Boolean(latestVerifyLedgerEntry) &&
    latestVerifyLedgerEntry?.projectHash !== restoredVerifyProjectHash;
  const sim = normalizePersistedSimState(candidate.sim, circuit, projectIoRows);
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
  const hasRestoredLegacyExportWithoutHash =
    projectHealthCore.lastExport?.status === 'ok' &&
    (!projectHealthCore.lastExport.hash || projectHealthCore.lastExport.hash.length === 0);
  const hasRestoredExportHashMismatch =
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
    steps: normalizeScenarioSteps(scenario.steps),
    vectors: normalizeVectorsForLiveIo(
      rekeyVectorsForLiveIo(
        cloneVectors(
          materializeScenarioVectors({
            ...scenario,
            steps: normalizeScenarioSteps(scenario.steps),
          })
        ),
        legacyProjectIoRows,
        projectIoRows
      ),
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
    projectVectors.some((vector) => Object.keys(vector.expected ?? {}).length > 0);
  const detachedProjectVectors = shouldResetDetachedStarterCompareState
    ? stripExpectedOutputs(projectVectors)
    : projectVectors;
  const detachedScenarios = shouldResetDetachedStarterCompareState
    ? scenarios.map((scenario) => ({
        ...scenario,
        vectors: stripExpectedOutputs(scenario.vectors),
        steps: scenario.steps?.map((step) => ({
          ...step,
          expectedValue: undefined,
        })),
      }))
    : scenarios;
  const detachedCustomVectors = normalizeVectorsForLiveIo(
    rekeyVectorsForLiveIo(
      cloneVectors(
        Array.isArray(candidate.customVectors) ? (candidate.customVectors as CustomTestVector[]) : []
      ).map((vector) => ({
        ...vector,
        expected: shouldResetDetachedStarterCompareState ? {} : vector.expected,
      })),
      legacyProjectIoRows,
      projectIoRows
    ),
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
    projectKind: restoredProjectKind,
    sourceExampleId: persistedSourceExampleId,
    scenarioAuthority: detachedScenarioAuthority,
    importMeta:
      restoredProjectKind === 'import'
        ? normalizePersistedImportMeta(candidate.importMeta)
        : null,
    activeExampleId: restoredProjectKind === 'example' ? persistedSourceExampleId : null,
    hardwareMappingV2,
    projectIoRows,
    projectVectors: detachedProjectVectors,
    scenarios: detachedScenarios,
    activeScenarioId,
    customVectors: detachedCustomVectors,
    circuit,
    designPast,
    designFuture,
    maxDesignHistory,
    designRevision,
    verifyLastRun: detachedVerifyLastRun,
    verifyRunHistory: detachedVerifyRunHistory,
    sim,
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
    customComponents: normalizedProject.customComponents ?? [],
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
  return {
    projectId: input.projectId ?? createProjectId('blank'),
    projectName: input.projectName ?? 'Untitled Project',
    projectDescription: '',
    lastSavedAt: input.lastSavedAt ?? 'Project home',
    projectKind: input.projectKind ?? 'home',
    sourceExampleId: null,
    scenarioAuthority: 'none',
    importMeta: null,
    activeExampleId: null,
    hardwareMappingV2,
    projectIoRows,
    projectVectors,
    scenarios: [defaultScenario],
    activeScenarioId: defaultScenario.id,
    customVectors: [],
    circuit,
    designPast: [],
    designFuture: [],
    maxDesignHistory: DEFAULT_MAX_DESIGN_HISTORY,
    designRevision: 0,
    verifyLastRun: undefined,
    verifyRunHistory: [],
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
  const baseSimState = initializeSimulationStateForCircuit(circuit, projectIoRows);
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
    projectKind: 'example',
    sourceExampleId: example.id,
    scenarioAuthority: example.vectors.length > 0 ? 'starter' : 'none',
    importMeta: null,
    activeExampleId: example.id,
    hardwareMappingV2,
    projectIoRows,
    projectVectors: cloneVectors(example.vectors),
    scenarios: [createDefaultScenario(example.vectors)],
    activeScenarioId: DEFAULT_SCENARIO_ID,
    customVectors: [],
    circuit,
    designPast: [],
    designFuture: [],
    maxDesignHistory: DEFAULT_MAX_DESIGN_HISTORY,
    designRevision: 0,
    verifyLastRun: undefined,
    verifyRunHistory: [],
    sim,
    projectHealthCore: {
      dirtySinceVerify: false,
      dirtySinceExport: false,
    },
    macros: [],
    macroInsertionCounts: {},
    customComponents: [],
  };
}

function syncActiveScenarioVectors(
  scenarios: VerifyScenario[],
  activeScenarioId: string,
  vectors: TestVector[]
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
      if (stableSerialize(currentVectors) === nextVectorsSignature) {
        return {
          ...scenario,
          vectors: nextVectors,
          steps: scenario.steps ? deriveScenarioStepsFromVectors(nextVectors) : undefined,
        };
      }
      return stampScenario({
        ...scenario,
        vectors: nextVectors,
        steps: scenario.steps ? deriveScenarioStepsFromVectors(nextVectors) : undefined,
      });
    }),
  };
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
    'projectVectors' | 'projectHealthCore' | 'scenarios' | 'activeScenarioId'
  >,
  scenarios: VerifyScenario[],
  activeScenarioId: string
): Pick<ProjectRuntimeState, 'projectVectors' | 'projectHealthCore' | 'scenarios' | 'activeScenarioId'> {
  const resolvedActiveScenario =
    getActiveScenario(scenarios, activeScenarioId) ??
    (scenarios.length > 0 ? scenarios[0] : createDefaultScenario(state.projectVectors));
  const compatibilityVectors = materializeScenarioVectors(resolvedActiveScenario);
  return {
    projectVectors: cloneVectors(compatibilityVectors),
    scenarios,
    activeScenarioId: resolvedActiveScenario.id,
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
  };
}

function cloneMacroInsertionCounts(value: Record<string, number>): Record<string, number> {
  return { ...value };
}

function cloneDesignHistorySnapshot(snapshot: DesignHistorySnapshot): DesignHistorySnapshot {
  return {
    circuit: cloneCircuit(snapshot.circuit),
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
    'circuit' | 'hardwareMappingV2' | 'projectIoRows' | 'projectVectors' | 'macroInsertionCounts'
  >
): DesignHistorySnapshot {
  return {
    circuit: cloneCircuit(state.circuit),
    projectIoRows: cloneIoRows(state.projectIoRows),
    hardwareMappingV2: structuredClone(state.hardwareMappingV2),
    projectVectors: cloneVectors(state.projectVectors),
    macroInsertionCounts: cloneMacroInsertionCounts(state.macroInsertionCounts),
  };
}

function buildValidOutputSignalKeys(rows: ProjectIoRow[]): Set<string> {
  const validOutputKeys = new Set<string>();
  for (const row of rows) {
    if (row.direction !== 'out') continue;
    for (const candidate of [row.id, row.label, row.nodeId]) {
      const normalized = normalizePortToken(candidate);
      if (normalized.length > 0) {
        validOutputKeys.add(normalized);
      }
    }
  }
  return validOutputKeys;
}

function buildValidInputSignalKeys(rows: ProjectIoRow[]): Set<string> {
  const validInputKeys = new Set<string>();
  for (const row of rows) {
    if (row.direction !== 'in') continue;
    for (const candidate of [row.id, row.label, row.nodeId]) {
      const normalized = normalizePortToken(candidate);
      if (normalized.length > 0) {
        validInputKeys.add(normalized);
      }
    }
  }
  return validInputKeys;
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
  rows: ProjectIoRow[]
): T[] {
  const inputRows = rows.filter((row) => row.direction === 'in');
  if (inputRows.length === 0) return cloneVectors(vectors);

  return vectors.map((vector) => {
    const nextInputs: Record<string, 0 | 1> = { ...(vector.inputs ?? {}) };
    const normalizedInputKeys = new Set(
      Object.keys(nextInputs)
        .map((key) => normalizePortToken(key))
        .filter((key) => key.length > 0)
    );

    for (const row of inputRows) {
      const aliases = [row.id, row.label, row.nodeId]
        .map((key) => normalizePortToken(key))
        .filter((key) => key.length > 0);
      const hasCoverage = aliases.some((alias) => normalizedInputKeys.has(alias));
      if (hasCoverage) continue;
      const inputKey = row.id.trim();
      if (!inputKey) continue;
      nextInputs[inputKey] = 0;
      normalizedInputKeys.add(normalizePortToken(inputKey));
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

  const rekeyMap = new Map<string, string>();
  for (const row of previousRows) {
    if (row.direction !== direction) continue;
    const normalizedNodeId = normalizePortToken(row.nodeId);
    if (!normalizedNodeId) continue;
    const nextRow = nextRowsByNodeId.get(normalizedNodeId);
    const canonicalKey = nextRow?.id?.trim();
    if (!nextRow || !canonicalKey) continue;
    for (const candidate of [row.id, row.label, row.nodeId]) {
      const normalizedCandidate = normalizePortToken(candidate);
      if (!normalizedCandidate) continue;
      rekeyMap.set(normalizedCandidate, canonicalKey);
    }
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
      const aliases = [row.id, row.label, row.nodeId]
        .map((key) => normalizePortToken(key))
        .filter((key) => key.length > 0);
      const hasCoverage = aliases.some((alias) => normalizedExpectedKeys.has(alias));
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

function normalizeVectorsForLiveIo<T extends TestVector>(
  vectors: T[],
  rows: ProjectIoRow[]
): T[] {
  return ensureVectorInputCoverage(
    pruneStaleVectorInputs(
      pruneStaleVectorExpected(vectors, buildValidOutputSignalKeys(rows)),
      buildValidInputSignalKeys(rows)
    ),
    rows
  );
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

function commitDesignSnapshot(
  state: ProjectRuntimeState,
  snapshot: DesignHistorySnapshot,
  history: Pick<ProjectRuntimeState, 'designPast' | 'designFuture'>
): Pick<
  ProjectRuntimeState,
  | 'circuit'
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
  | 'projectHealthCore'
> {
  const nextCircuit = cloneCircuit(snapshot.circuit);
  const snapshotHardwareMappingV2 =
    snapshot.hardwareMappingV2 !== undefined
      ? structuredClone(snapshot.hardwareMappingV2)
      : migrateIoMappingToHardwareMappingV2(toIoMappingFromProjectIoRows(snapshot.projectIoRows));
  const { hardwareMappingV2: nextHardwareMappingV2, projectIoRows: nextIoRows } =
    deriveAuthoritativeHardwareState(nextCircuit, snapshotHardwareMappingV2);
  const sourceProjectVectors = snapshot.projectVectors
    ? cloneVectors(snapshot.projectVectors)
    : cloneVectors(state.projectVectors);
  const projectVectorRows = snapshot.projectVectors ? snapshot.projectIoRows : state.projectIoRows;
  const nextProjectVectors = ensureVectorOutputCoverage(
    normalizeVectorsForLiveIo(
      rekeyVectorsForLiveIo(sourceProjectVectors, projectVectorRows, nextIoRows),
      nextIoRows
    ),
    nextIoRows
  );
  const nextCustomVectors = ensureVectorOutputCoverage(
    normalizeVectorsForLiveIo(
      rekeyVectorsForLiveIo(cloneVectors(state.customVectors), state.projectIoRows, nextIoRows),
      nextIoRows
    ),
    nextIoRows
  );
  const nextScenarios = state.scenarios.map((scenario) => ({
    ...scenario,
    vectors: ensureVectorOutputCoverage(
      normalizeVectorsForLiveIo(
        rekeyVectorsForLiveIo(
          cloneVectors(materializeScenarioVectors(scenario)),
          state.projectIoRows,
          nextIoRows
        ),
        nextIoRows
      ),
      nextIoRows
    ),
    steps: scenario.steps
      ? deriveScenarioStepsFromVectors(
          ensureVectorOutputCoverage(
            normalizeVectorsForLiveIo(
              rekeyVectorsForLiveIo(
                cloneVectors(materializeScenarioVectors(scenario)),
                state.projectIoRows,
                nextIoRows
              ),
              nextIoRows
            ),
            nextIoRows
          )
        )
      : undefined,
  }));
  const isDetachingFromExample = state.projectKind === 'example' && Boolean(state.activeExampleId);
  const detachedProjectVectors = isDetachingFromExample
    ? stripExpectedOutputs(nextProjectVectors)
    : nextProjectVectors;
  const detachedCustomVectors = isDetachingFromExample
    ? stripExpectedOutputs(nextCustomVectors)
    : nextCustomVectors;
  const detachedScenarios = isDetachingFromExample
    ? nextScenarios.map((scenario) => ({
        ...scenario,
        vectors: stripExpectedOutputs(scenario.vectors),
      }))
    : nextScenarios;
  const nextProjectKind = isDetachingFromExample
    ? (nextCircuit.nodes.length > 0 ? 'custom' : 'blank')
    : state.projectKind === 'home' && nextCircuit.nodes.length > 0
      ? 'blank'
      : state.projectKind;
  const nextSourceExampleId = isDetachingFromExample
    ? (state.sourceExampleId ?? state.activeExampleId ?? null)
    : state.sourceExampleId;
  const nextActiveExampleId = isDetachingFromExample ? null : state.activeExampleId;
  const nextScenarioAuthority = isDetachingFromExample
    ? (nextCircuit.nodes.length > 0 && detachedProjectVectors.length > 0 ? 'draft' : 'none')
    : state.scenarioAuthority === 'verified'
      ? 'stale'
      : state.scenarioAuthority;
  // Detaching a starter removes example ownership, not the student's only honest
  // project identity. Keep the current name/summary unless the user explicitly changes them.
  const nextProjectName = state.projectName;
  const nextProjectDescription = state.projectDescription;
  return {
    circuit: nextCircuit,
    hardwareMappingV2: nextHardwareMappingV2,
    projectIoRows: nextIoRows,
    projectVectors: detachedProjectVectors,
    customVectors: detachedCustomVectors,
    scenarios: detachedScenarios,
    macroInsertionCounts: cloneMacroInsertionCounts(snapshot.macroInsertionCounts),
    designPast: history.designPast,
    designFuture: history.designFuture,
    // Tracks state transitions, not unique circuit graphs. Undo/redo transitions
    // intentionally advance this counter just like forward edits.
    designRevision: state.designRevision + 1,
    sim: initializeSimulationStateForCircuit(nextCircuit, nextIoRows, state.sim),
    projectName: nextProjectName,
    projectDescription: nextProjectDescription,
    projectKind: nextProjectKind,
    sourceExampleId: nextSourceExampleId,
    scenarioAuthority: nextScenarioAuthority,
    activeExampleId: nextActiveExampleId,
    projectHealthCore: {
      ...state.projectHealthCore,
      dirtySinceVerify: true,
      dirtySinceExport: true,
    },
  };
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
// When a run is demoted to STALE:
//   - Surviving stimulus vectors are preserved (only expected-output authority is dropped).
//   - Orphaned expected outputs (for ports that no longer exist) are dropped on next run.
//   - The UI must not display a bare PASS or FAIL badge; it must show STALE prominently.
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
    signals: normalizeBitRecord(candidate.signals as Record<string, unknown> | undefined),
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
    signals: normalizeBitRecord(candidate.signals as Record<string, unknown> | undefined),
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
    artifacts: Array.isArray(candidate.artifacts)
      ? candidate.artifacts.filter((artifact): artifact is string => typeof artifact === 'string')
      : undefined,
    ranAtIso: candidate.ranAtIso,
  };
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

function buildVerifyRunMeta(scheduleContract: VerifyScheduleContract): VerifyRunMeta {
  const isClocked = scheduleContract.schedule === 'clocked_macro';
  return {
    circuitKind: isClocked ? 'sequential' : 'combinational',
    clockingProtocol: isClocked ? 'clocked_macro' : null,
    samplePoint: scheduleContract.samplePoint,
    tick0Meaning: scheduleContract.tick0Meaning,
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

function normalizeBoardRowId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.length > 0 ? normalized : 'io';
}

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

function createProjectId(seed: string): string {
  const normalizedSeed = normalizeBoardRowId(seed).replace(/_/g, '-');
  const suffix = Date.now().toString(36).slice(-6);
  return `rb-${normalizedSeed}-${suffix}`;
}

// E2E test hook: expose project runtime store for programmatic access (gates/dev/test).
if (typeof window !== 'undefined') {
  (window as any).__RB_PROJECT_RUNTIME__ = useProjectRuntime;
}
