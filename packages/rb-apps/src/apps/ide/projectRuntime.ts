import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Circuit, CompositeNodeDef } from '@redbyte/rb-logic-core';
import { registerCompositeNode } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import { normalizeRBProject, type RBProject } from '../../export/projectFormat';
import { stableSerialize } from '../../utils/stableSerialize';
import { deriveVerifySchedule, type VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
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
import type {
  ProjectHealthCore,
  ProjectHealthExportResult,
  ProjectHealthVerifyResult,
} from './projectHealth';
import {
  buildVerifyReport,
  buildVerifyWaveSamples,
  type VerifyEvidenceCapsule,
  type VerifyReport,
  type VerifyReportVector,
  type VerifyWaveSample,
} from './verifyReport';
import { generateBringUpVectors } from './bringupArtifacts';
import {
  DEFAULT_SIM_SPEED_HZ,
  advanceSimulationState,
  buildVerifyRowsDeterministicFromCircuit,
  recomputeSimulationState,
  resetSimulationState,
  runDeterministicVerifyFromCircuit,
} from './sim/simEngine';
import type { RuntimeSignalProbe, RuntimeSimState, RuntimeSimTraceSample } from './sim/simTypes';

export type { RuntimeSignalProbe, RuntimeSimState, RuntimeSimTraceSample } from './sim/simTypes';

const STORAGE_KEY = 'rb.ide.project-runtime.v1';

const DEFAULT_EXAMPLE = getIdeExampleById(IDE_DEFAULT_EXAMPLE_ID) ?? IDE_EXAMPLES[0];

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
  status: 'pass' | 'fail';
  deterministicHash: string;
  reportHash: string;
  firstFailingTick?: number;
  generatedAtIso: string;
  schedule: 'combinational' | 'clocked_macro';
  meta: VerifyRunMeta;
  report: VerifyReport;
  waveform: VerifyWaveSample[];
  traceWaveform?: VerifyWaveSample[];
  evidence?: VerifyEvidenceCapsule;
}

export interface RunVerificationInput {
  scenarioId: string;
  scenarioName: string;
  deterministicHash: string;
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
  activeExampleId: string | null;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  circuit: Circuit;
  verifyLastRun?: RuntimeVerifyRun;
  verifyRunHistory: VerifyRunLedgerEntry[];
  sim: RuntimeSimState;
  projectHealthCore: ProjectHealthCore;
  actions: ProjectRuntimeActions;
  loadExample: (exampleId: string) => void;
  loadFromProject: (project: RBProject) => void;
  setMappingPin: (rowId: string, pin: string) => void;
  autoSuggestMapping: () => void;
  setVectors: (vectors: TestVector[]) => void;
  generateBringUpVectors: () => TestVector[];
  markDesignMutated: (circuit: Circuit) => void;
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
    markDirty?: boolean;
  }) => void;
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
  activeExampleId: string | null;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  circuit: Circuit;
  verifyLastRun?: RuntimeVerifyRun;
  verifyRunHistory: VerifyRunLedgerEntry[];
  sim: RuntimeSimState;
  projectHealthCore: ProjectHealthCore;
  macros: MacroDefinition[];
  macroInsertionCounts: Record<string, number>;
  customComponents: CompositeNodeDef[];
}

export const useProjectRuntime = create<ProjectRuntimeState>()(
  persist(
    (set, get) => ({
      ...stateFromExample(DEFAULT_EXAMPLE),
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
            set((state) => ({
              sim: advanceSimulationState(
                state.circuit,
                state.projectIoRows,
                {
                  ...state.sim,
                  lastAction: 'step',
                },
                1
              ),
            }));
          },
          runTicks: (ticks) => {
            const boundedTicks = Math.max(0, Math.min(512, Math.floor(ticks)));
            if (boundedTicks === 0) return;
            set((state) => ({
              sim: advanceSimulationState(
                state.circuit,
                state.projectIoRows,
                {
                  ...state.sim,
                  lastAction: 'step',
                },
                boundedTicks
              ),
            }));
          },
          reset: () => {
            set((state) => ({
              sim: resetSimulationState(state.circuit, state.projectIoRows, {
                ...state.sim,
                lastAction: 'reset',
              }),
            }));
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
              return {
                sim: recomputeSimulationState(
                  state.circuit,
                  state.projectIoRows,
                  {
                    ...state.sim,
                    inputs: nextInputs,
                    running: state.sim.running,
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
              return {
                sim: recomputeSimulationState(
                  state.circuit,
                  state.projectIoRows,
                  {
                    ...state.sim,
                    inputs: nextInputs,
                    running: state.sim.running,
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
        const projectIoRows = ioRowsFromProject(project);
        const circuit = cloneCircuit(project.circuit);
        const incomingProjectId = (project.meta?.projectId ?? '').trim();
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
              : createProjectId(project.name || 'imported'),
          projectName: project.name || 'Imported project',
          projectDescription: project.description ?? '',
          lastSavedAt: `Imported: ${project.name || 'project'}`,
          activeExampleId: null,
          projectIoRows,
          projectVectors: cloneVectors(project.vectors ?? []),
          circuit,
          verifyLastRun: undefined,
          verifyRunHistory: [],
          sim: resetSimulationState(circuit, projectIoRows),
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
        set((state) => ({
          projectIoRows: state.projectIoRows.map((entry) =>
            entry.id === rowId ? { ...entry, pin } : entry
          ),
          projectHealthCore: {
            ...state.projectHealthCore,
            dirtySinceExport: true,
          },
        }));
      },
      autoSuggestMapping: () => {
        set((state) => ({
          projectIoRows: state.projectIoRows.map((entry, index) =>
            entry.pin.trim().length > 0
              ? entry
              : { ...entry, pin: suggestBasys3Pin(entry, index) }
          ),
          projectHealthCore: {
            ...state.projectHealthCore,
            dirtySinceExport: true,
          },
        }));
      },
      setVectors: (vectors) => {
        set((state) => ({
          projectVectors: cloneVectors(vectors),
          projectHealthCore: {
            ...state.projectHealthCore,
            dirtySinceVerify: true,
            dirtySinceExport: true,
          },
        }));
      },
      generateBringUpVectors: () => {
        const generated = generateBringUpVectors({
          ioRows: get().projectIoRows,
          circuit: get().circuit,
          existingVectors: get().projectVectors,
        });
        set((state) => ({
          projectVectors: cloneVectors(generated),
          projectHealthCore: {
            ...state.projectHealthCore,
            dirtySinceVerify: true,
            dirtySinceExport: true,
          },
        }));
        return generated;
      },
      markDesignMutated: (circuit) => {
        set((state) => ({
          circuit: cloneCircuit(circuit),
          sim: resetSimulationState(circuit, state.projectIoRows, state.sim),
          projectHealthCore: {
            ...state.projectHealthCore,
            dirtySinceVerify: true,
            dirtySinceExport: true,
          },
        }));
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
            config: nodeType === 'Clock' ? { period: 10 } : {},
            state: {},
          });
          return {
            circuit: nextCircuit,
            sim: resetSimulationState(nextCircuit, state.projectIoRows, state.sim),
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
      },
      addDesignIo: (direction, position) => {
        const type = direction === 'input' ? 'INPUT' : 'OUTPUT';
        get().addDesignNode(type, position);
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
            config: nodeType === 'Clock' ? { period: 10 } : {},
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

          return {
            circuit: nextCircuit,
            projectIoRows: nextIoRows,
            sim: resetSimulationState(nextCircuit, nextIoRows, state.sim),
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
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

          return {
            circuit: nextCircuit,
            sim: resetSimulationState(nextCircuit, state.projectIoRows, state.sim),
            projectHealthCore: {
              ...state.projectHealthCore,
              dirtySinceVerify: true,
              dirtySinceExport: true,
            },
          };
        });
      },
      runVerification: (input) => {
        let runtimeRun: RuntimeVerifyRun | undefined;
        set((state) => {
          const scenarioId = input.scenarioId.trim() || 'runtime-verify';
          const scenarioName = input.scenarioName.trim() || 'Runtime verification';
          const circuitHash = digestValue(stableSerialize(state.circuit));
          const deterministicResult =
            state.projectVectors.length > 0
              ? runDeterministicVerifyFromCircuit(
                  state.circuit,
                  state.projectIoRows,
                  state.projectVectors
                )
              : null;
          const normalizedRows = deterministicResult?.rows ?? normalizeVerifyRows(input.rows);
          const failedRows = normalizedRows.filter((row) => row.expected !== row.actual);
          const preflightIssues = deterministicResult?.evidence.preflight ?? [];
          const status: 'pass' | 'fail' =
            failedRows.length > 0 || preflightIssues.length > 0 ? 'fail' : 'pass';
          const ranAtIso = input.ranAtIso ?? new Date().toISOString();
          const vectors = toVerifyVectors(state.projectVectors);
          const scheduleContract = deriveVerifySchedule(
            state.circuit,
            toIoMapping(state.projectIoRows)
          );
          const signalRoles = deriveSignalRoles(state.projectIoRows, scheduleContract);
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
          const reportWaveform = buildVerifyWaveSamples(report);
          const traceWaveform = toVerifyWaveSamplesFromTrace(deterministicResult?.trace ?? []);
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
            status: report.status,
            deterministicHash: report.deterministicHash,
            reportHash: report.reportHash,
            firstFailingTick: report.firstFailingTick,
            generatedAtIso: report.generatedAtIso,
            schedule: scheduleContract.schedule,
            meta: buildVerifyRunMeta(scheduleContract),
            report,
            waveform: reportWaveform.length > 0 ? reportWaveform : traceWaveform,
            traceWaveform: traceWaveform.length > 0 ? traceWaveform : undefined,
            evidence,
          };

          // Build ledger entry (synchronous hashes via digestValue + stableSerialize)
          const vectorsHash = digestValue(stableSerialize(state.projectVectors));
          const mappingHash = digestValue(stableSerialize(toIoMapping(state.projectIoRows)));
          const projectSnap = {
            circuit: state.circuit,
            vectors: state.projectVectors,
            mapping: toIoMapping(state.projectIoRows),
          };
          const projectHash = digestValue(stableSerialize(projectSnap));
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
            sim: {
              ...state.sim,
              running: false,
            },
            projectHealthCore: {
              ...state.projectHealthCore,
              lastVerify: {
                status: report.status,
                hash: report.deterministicHash,
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
          const scheduleContract = deriveVerifySchedule(state.circuit, toIoMapping(state.projectIoRows));
          const signalRoles = deriveSignalRoles(state.projectIoRows, scheduleContract);
          const nextRun =
            result.report
              ? ({
                  scenarioId: result.report.scenarioId,
                  scenarioName: result.report.scenarioName,
                  status: result.status,
                  deterministicHash: result.hash,
                  reportHash: result.reportHash ?? result.report.reportHash,
                  firstFailingTick:
                    typeof result.failingTick === 'number'
                      ? result.failingTick
                      : result.report.firstFailingTick,
                  generatedAtIso: result.ranAtIso,
                  schedule: scheduleContract.schedule,
                  meta: buildVerifyRunMeta(scheduleContract),
                  report: { ...result.report, signalRoles },
                  waveform: buildVerifyWaveSamples(result.report),
                  evidence: state.verifyLastRun?.evidence,
                } satisfies RuntimeVerifyRun)
              : state.verifyLastRun;

          return {
            verifyLastRun: nextRun,
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
          const shouldMarkDirty = input.markDirty ?? true;
          return {
            projectId: nextProjectId.length > 0 ? nextProjectId : state.projectId,
            projectName: nextName.length > 0 ? nextName : state.projectName,
            projectDescription:
              typeof nextDescription === 'string'
                ? nextDescription
                : state.projectDescription,
            projectHealthCore: shouldMarkDirty
              ? {
                  ...state.projectHealthCore,
                  dirtySinceVerify: true,
                  dirtySinceExport: true,
                }
              : state.projectHealthCore,
          };
        });
      },
      setLastSavedAt: (label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        set({ lastSavedAt: trimmed });
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
              circuit: cloneCircuit(result.circuit),
              sim: resetSimulationState(result.circuit, state.projectIoRows, state.sim),
              projectHealthCore: {
                ...state.projectHealthCore,
                dirtySinceVerify: true,
                dirtySinceExport: true,
              },
              macroInsertionCounts: {
                ...state.macroInsertionCounts,
                [macroId]: nextInstanceIndex,
              },
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
      version: 4,
      merge: (persistedState, currentState) =>
        mergePersistedRuntimeState(persistedState, currentState as ProjectRuntimeState),
      partialize: (state): PersistedRuntimeState => ({
        projectId: state.projectId,
        projectName: state.projectName,
        projectDescription: state.projectDescription,
        lastSavedAt: state.lastSavedAt,
        activeExampleId: state.activeExampleId,
        projectIoRows: cloneIoRows(state.projectIoRows),
        projectVectors: cloneVectors(state.projectVectors),
        circuit: cloneCircuit(state.circuit),
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

  const projectIoRows = ioRowsFromProject(normalizedProject);
  const circuit = cloneCircuit(normalizedProject.circuit);
  const projectVectors = cloneVectors(normalizedProject.vectors ?? []);
  const rawVerifyLastRun = tryCloneVerifyRun(candidate.verifyLastRun);
  const invalidateVerifyTrust = hasLegacyVerifyTrust(rawVerifyLastRun, candidate.projectHealthCore);
  const verifyLastRun = invalidateVerifyTrust ? undefined : rawVerifyLastRun;
  const verifyRunHistory = invalidateVerifyTrust ? [] : normalizeVerifyRunHistory(candidate.verifyRunHistory);
  const sim = normalizePersistedSimState(candidate.sim, circuit, projectIoRows);

  return {
    ...currentState,
    projectId:
      normalizedProject.meta?.projectId?.trim() || currentState.projectId,
    projectName: normalizedProject.name,
    projectDescription: normalizedProject.description ?? '',
    lastSavedAt:
      typeof candidate.lastSavedAt === 'string' && candidate.lastSavedAt.trim().length > 0
        ? candidate.lastSavedAt.trim()
        : currentState.lastSavedAt,
    activeExampleId:
      typeof candidate.activeExampleId === 'string'
        ? candidate.activeExampleId
        : candidate.activeExampleId === null
          ? null
          : currentState.activeExampleId,
    projectIoRows,
    projectVectors,
    circuit,
    verifyLastRun,
    verifyRunHistory,
    sim,
    projectHealthCore: normalizePersistedProjectHealth(
      candidate.projectHealthCore,
      verifyLastRun,
      currentState.projectHealthCore,
      invalidateVerifyTrust
    ),
    macros: normalizedProject.macros ?? [],
    macroInsertionCounts: normalizeMacroInsertionCounts(candidate.macroInsertionCounts),
    customComponents: normalizedProject.customComponents ?? [],
  };
}

function stateFromExample(
  example: IdeExampleDefinition,
  projectId = createProjectId(example.id)
): PersistedRuntimeState {
  const projectIoRows = cloneIoRows(example.ioRows);
  const circuit = cloneCircuit(example.circuit);
  const baseSimState = resetSimulationState(circuit, projectIoRows);
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
    activeExampleId: example.id,
    projectIoRows,
    projectVectors: cloneVectors(example.vectors),
    circuit,
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
  const rows: ProjectIoRow[] = [];
  for (const entry of project.ioMapping?.inputs ?? []) {
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
  for (const entry of project.ioMapping?.outputs ?? []) {
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
  return rows;
}

function cloneIoRows(rows: ProjectIoRow[]): ProjectIoRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneVectors(vectors: TestVector[]): TestVector[] {
  return vectors.map((vector) => ({ ...vector }));
}

function cloneCircuit(circuit: Circuit): Circuit {
  return {
    nodes: circuit.nodes.map((node) => ({ ...node })),
    connections: circuit.connections.map((connection) => ({ ...connection })),
  };
}

function cloneVerifyRun(run: RuntimeVerifyRun): RuntimeVerifyRun {
  return {
    ...run,
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

function isAuthoritativeVerifyHash(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !value.startsWith('sim_');
}

function isAuthoritativeVerifyRun(run: RuntimeVerifyRun | undefined | null): run is RuntimeVerifyRun {
  if (!run) return false;
  if (run.scenarioId.trim().length === 0 || run.scenarioId === 'runtime-trace') return false;
  if (!isAuthoritativeVerifyHash(run.deterministicHash)) return false;
  if (typeof run.reportHash !== 'string' || run.reportHash.trim().length === 0) return false;
  return !Array.isArray(run.traceWaveform);
}

function isLegacyRuntimeTraceVerifyRun(run: RuntimeVerifyRun | undefined | null): boolean {
  return Boolean(run) && !isAuthoritativeVerifyRun(run);
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
  const fallback = resetSimulationState(circuit, ioRows);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<RuntimeSimState>;
  return {
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
  };
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
      reportHash: verifyLastRun.reportHash,
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

function toVerifyWaveSamplesFromTrace(trace: RuntimeSimTraceSample[]): VerifyWaveSample[] {
  if (trace.length === 0) return [];
  const byTick = new Map<number, VerifyWaveSample>();
  for (const sample of trace) {
    if (!Number.isFinite(sample.tick)) continue;
    const tick = Math.max(0, Math.floor(sample.tick));
    const signals = Object.fromEntries(
      Object.entries(sample.signals)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, value]) => [key, String(value === 1 ? 1 : 0)])
    ) as Record<string, string>;
    byTick.set(tick, {
      tick,
      signals,
      mismatches: [],
    });
  }
  return Array.from(byTick.values()).sort((left, right) => left.tick - right.tick);
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

function deriveSignalRoles(
  ioRows: ProjectIoRow[],
  scheduleContract: VerifyScheduleContract
): Record<string, 'clock' | 'reset' | 'input' | 'output'> {
  const roles: Record<string, 'clock' | 'reset' | 'input' | 'output'> = {};
  const clockName = scheduleContract.clockSignalName?.toLowerCase() ?? '';

  for (const row of ioRows) {
    const label = row.label.trim();
    if (!label) continue;
    const lower = label.toLowerCase();

    if (
      clockName &&
      (lower === clockName ||
        lower === 'clk' ||
        lower === 'clock' ||
        lower === 'clk100mhz' ||
        lower.startsWith('clk_') ||
        lower.startsWith('clock_'))
    ) {
      roles[label] = 'clock';
    } else if (
      lower === 'rst' ||
      lower === 'reset' ||
      lower === 'btnc' ||
      lower.startsWith('rst_') ||
      lower.startsWith('reset_')
    ) {
      roles[label] = 'reset';
    } else if (row.direction === 'in') {
      roles[label] = 'input';
    } else {
      roles[label] = 'output';
    }
  }
  return roles;
}

function buildVerifyRunMeta(scheduleContract: VerifyScheduleContract): VerifyRunMeta {
  const isClocked = scheduleContract.schedule === 'clocked_macro';
  return {
    circuitKind: isClocked ? 'sequential' : 'combinational',
    clockingProtocol: isClocked ? 'clocked_macro' : null,
    samplePoint: isClocked ? 'post-rising-edge' : 'steady-state',
    tick0Meaning: isClocked ? 'initial-state' : null,
    clockSignalName: scheduleContract.clockSignalName ?? null,
  };
}

function suggestBasys3Pin(signal: { id: string; direction: 'in' | 'out' }, index: number): string {
  if (signal.direction === 'in') {
    if (signal.id.toLowerCase() === 'clk') return 'CLK100MHZ';
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
