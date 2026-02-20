import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { deriveVerifySchedule } from '../../fpga/boards/basys3/verifySchedule';
import { digestValue } from '../../utils/digest';
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
  type VerifyReport,
  type VerifyReportVector,
  type VerifyWaveSample,
} from './verifyReport';
import { generateBringUpVectors } from './bringupArtifacts';

const STORAGE_KEY = 'rb.ide.project-runtime.v1';
const DEFAULT_SIM_SPEED_HZ = 12;
const SIM_TRACE_CAPACITY = 256;

let runtimeSimEngine: CircuitEngine | null = null;
let runtimeSimIrHash = '';

const DEFAULT_EXAMPLE = getIdeExampleById(IDE_DEFAULT_EXAMPLE_ID) ?? IDE_EXAMPLES[0];

export type ProjectIoRow = IdeExampleIoRow;

export interface RuntimeVerifyRun {
  scenarioId: string;
  scenarioName: string;
  status: 'pass' | 'fail';
  deterministicHash: string;
  reportHash: string;
  firstFailingTick?: number;
  generatedAtIso: string;
  schedule: 'combinational' | 'clocked_macro';
  report: VerifyReport;
  waveform: VerifyWaveSample[];
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
  useRuntimeTrace?: boolean;
}

export interface RuntimeSimTraceSample {
  tick: number;
  signals: Record<string, 0 | 1>;
}

export interface RuntimeSignalProbe {
  key: string;
  label: string;
}

export interface RuntimeSimState {
  tick: number;
  running: boolean;
  speedHz: number;
  irHash: string;
  traceHash: string;
  inputs: Record<string, 0 | 1>;
  signals: Record<string, 0 | 1>;
  trace: RuntimeSimTraceSample[];
  selectedSignalKey: string | null;
  probes: RuntimeSignalProbe[];
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
  projectName: string;
  projectDescription: string;
  lastSavedAt: string;
  activeExampleId: string | null;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  circuit: Circuit;
  verifyLastRun?: RuntimeVerifyRun;
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
  clearUnsavedState: (label?: string) => void;
}

interface PersistedRuntimeState {
  projectName: string;
  projectDescription: string;
  lastSavedAt: string;
  activeExampleId: string | null;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  circuit: Circuit;
  verifyLastRun?: RuntimeVerifyRun;
  sim: RuntimeSimState;
  projectHealthCore: ProjectHealthCore;
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
              },
            }));
          },
          pause: () => {
            set((state) => ({
              sim: {
                ...state.sim,
                running: false,
              },
            }));
          },
          step: () => {
            set((state) => ({
              sim: advanceSimulationState(
                state.circuit,
                state.projectIoRows,
                state.sim,
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
                state.sim,
                boundedTicks
              ),
            }));
          },
          reset: () => {
            set((state) => ({
              sim: resetSimulationState(state.circuit, state.projectIoRows, state.sim),
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
                sim: advanceSimulationState(
                  state.circuit,
                  state.projectIoRows,
                  {
                    ...state.sim,
                    inputs: nextInputs,
                    running: false,
                  },
                  1
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
                sim: advanceSimulationState(
                  state.circuit,
                  state.projectIoRows,
                  {
                    ...state.sim,
                    inputs: nextInputs,
                    running: false,
                  },
                  1
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
          ...stateFromExample(example),
          lastSavedAt: `Example loaded: ${example.name}`,
        });
      },
      loadFromProject: (project) => {
        const projectIoRows = ioRowsFromProject(project);
        const circuit = cloneCircuit(project.circuit);
        set({
          projectName: project.name || 'Imported project',
          projectDescription: project.description ?? '',
          lastSavedAt: `Imported: ${project.name || 'project'}`,
          activeExampleId: null,
          projectIoRows,
          projectVectors: cloneVectors(project.vectors ?? []),
          circuit,
          verifyLastRun: undefined,
          sim: resetSimulationState(circuit, projectIoRows),
          projectHealthCore: {
            dirtySinceVerify: true,
            dirtySinceExport: true,
          },
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
          const runtimeRows = input.useRuntimeTrace
            ? buildVerifyRowsFromRuntimeTrace(
                state.projectVectors,
                state.projectIoRows,
                state.sim
              )
            : [];
          const normalizedRows =
            runtimeRows.length > 0 ? runtimeRows : normalizeVerifyRows(input.rows);
          const useRuntimeRows = runtimeRows.length > 0;
          const effectiveScenarioId = useRuntimeRows ? 'runtime-trace' : scenarioId;
          const effectiveScenarioName = useRuntimeRows
            ? 'Runtime trace verification'
            : scenarioName;
          const deterministicHash = useRuntimeRows
            ? `sim_${digestValue({
                irHash: state.sim.irHash,
                traceHash: state.sim.traceHash,
                vectors: toVerifyVectors(state.projectVectors),
              })}`
            : input.deterministicHash;
          const failedRows = normalizedRows.filter((row) => row.expected !== row.actual);
          const status: 'pass' | 'fail' = failedRows.length > 0 ? 'fail' : 'pass';
          const ranAtIso = input.ranAtIso ?? new Date().toISOString();
          const vectors = toVerifyVectors(state.projectVectors);
          const report = buildVerifyReport({
            scenarioId: effectiveScenarioId,
            scenarioName: effectiveScenarioName,
            status,
            deterministicHash,
            rows: normalizedRows,
            vectors,
            generatedAtIso: ranAtIso,
          });
          const scheduleContract = deriveVerifySchedule(
            state.circuit,
            toIoMapping(state.projectIoRows)
          );
          runtimeRun = {
            scenarioId: report.scenarioId,
            scenarioName: report.scenarioName,
            status: report.status,
            deterministicHash: report.deterministicHash,
            reportHash: report.reportHash,
            firstFailingTick: report.firstFailingTick,
            generatedAtIso: report.generatedAtIso,
            schedule: scheduleContract.schedule,
            report,
            waveform: buildVerifyWaveSamples(report),
          };

          return {
            verifyLastRun: runtimeRun,
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
                  schedule: deriveVerifySchedule(state.circuit, toIoMapping(state.projectIoRows))
                    .schedule,
                  report: result.report,
                  waveform: buildVerifyWaveSamples(result.report),
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
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      partialize: (state): PersistedRuntimeState => ({
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
        sim: cloneSimState(state.sim),
        projectHealthCore: {
          lastVerify: state.projectHealthCore.lastVerify,
          lastExport: state.projectHealthCore.lastExport,
          dirtySinceVerify: state.projectHealthCore.dirtySinceVerify,
          dirtySinceExport: state.projectHealthCore.dirtySinceExport,
        },
      }),
    }
  )
);

function stateFromExample(example: IdeExampleDefinition): PersistedRuntimeState {
  const projectIoRows = cloneIoRows(example.ioRows);
  const circuit = cloneCircuit(example.circuit);
  return {
    projectName: example.name,
    projectDescription: example.summary,
    lastSavedAt: 'Seeded example',
    activeExampleId: example.id,
    projectIoRows,
    projectVectors: cloneVectors(example.vectors),
    circuit,
    verifyLastRun: undefined,
    sim: resetSimulationState(circuit, projectIoRows),
    projectHealthCore: {
      dirtySinceVerify: false,
      dirtySinceExport: false,
    },
  };
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
    report: {
      ...run.report,
      rows: run.report.rows.map((row) => ({ ...row })),
      vectors: run.report.vectors.map((vector) => ({
        ...vector,
        inputs: { ...vector.inputs },
        expected: { ...vector.expected },
      })),
    },
    waveform: run.waveform.map((sample) => ({
      tick: sample.tick,
      signals: { ...sample.signals },
      mismatches: sample.mismatches.map((entry) => ({ ...entry })),
    })),
  };
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

function buildVerifyRowsFromRuntimeTrace(
  vectors: TestVector[],
  ioRows: ProjectIoRow[],
  sim: RuntimeSimState
): Array<{ tick: number; signal: string; expected: string; actual: string }> {
  if (vectors.length === 0 || sim.trace.length === 0) {
    return [];
  }
  const traceByTick = new Map<number, RuntimeSimTraceSample>();
  for (const entry of sim.trace) {
    traceByTick.set(entry.tick, entry);
  }
  const outputRows = ioRows.filter((row) => row.direction === 'out');
  const rows: Array<{ tick: number; signal: string; expected: string; actual: string }> = [];
  for (const vector of vectors) {
    const tick = Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : 0;
    const sample = traceByTick.get(tick);
    for (const outputRow of outputRows) {
      const expected = resolveVectorBitSymbol(vector.expected ?? {}, outputRow);
      const actual = resolveOutputSymbolFromTrace(sample, outputRow);
      rows.push({
        tick,
        signal: normalizeSignalName(outputRow.label || outputRow.id),
        expected,
        actual,
      });
    }
  }
  return rows.sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    return compareText(left.signal, right.signal);
  });
}

function resolveVectorBitSymbol(
  expected: Record<string, boolean | number | string | undefined>,
  row: ProjectIoRow
): string {
  const candidates = [row.id, row.label, row.port].map((entry) => normalizeSignalName(entry));
  for (const [key, value] of Object.entries(expected)) {
    const normalizedKey = normalizeSignalName(key);
    if (candidates.includes(normalizedKey)) {
      return normalizeBit(value) === 1 ? '1' : '0';
    }
  }
  return '0';
}

function resolveOutputSymbolFromTrace(
  sample: RuntimeSimTraceSample | undefined,
  row: ProjectIoRow
): string {
  if (!sample) return '0';
  const candidates = [
    `${row.nodeId}.in`,
    `${row.nodeId}.out`,
    normalizeSignalName(row.id),
    normalizeSignalName(row.label),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const direct = sample.signals[candidate];
    if (direct === 0 || direct === 1) {
      return direct === 1 ? '1' : '0';
    }
    const normalizedCandidate = normalizeSignalName(candidate);
    for (const [key, value] of Object.entries(sample.signals)) {
      if (normalizeSignalName(key) === normalizedCandidate) {
        return value === 1 ? '1' : '0';
      }
    }
  }
  return '0';
}

function resetSimulationState(
  circuit: Circuit,
  projectIoRows: ProjectIoRow[],
  previous?: RuntimeSimState
): RuntimeSimState {
  const irHash = computeSimIrHash(circuit);
  const inputs = deriveSimulationInputs(circuit, previous?.inputs);
  const resetNodeId = resolveResetNodeId(projectIoRows, circuit);
  if (resetNodeId) {
    inputs[resetNodeId] = 1;
  }
  runtimeSimEngine = new CircuitEngine(cloneCircuit(circuit));
  runtimeSimIrHash = irHash;
  applyInputsToEngine(runtimeSimEngine, inputs);
  runtimeSimEngine.tick();
  if (resetNodeId) {
    inputs[resetNodeId] = 0;
    applyInputsToEngine(runtimeSimEngine, inputs);
    runtimeSimEngine.tick();
  }
  const signals = normalizeSignalMap(runtimeSimEngine, circuit);
  return {
    tick: 0,
    running: false,
    speedHz: previous?.speedHz ?? DEFAULT_SIM_SPEED_HZ,
    irHash,
    traceHash: computeTraceHash(irHash, []),
    inputs,
    signals,
    trace: [],
    selectedSignalKey: previous?.selectedSignalKey ?? null,
    probes: previous?.probes ? [...previous.probes] : [],
  };
}

function advanceSimulationState(
  circuit: Circuit,
  projectIoRows: ProjectIoRow[],
  sim: RuntimeSimState,
  requestedTicks: number
): RuntimeSimState {
  const ticks = Math.max(0, Math.min(1024, Math.floor(requestedTicks)));
  if (ticks === 0) {
    return sim;
  }
  const irHash = computeSimIrHash(circuit);
  if (!runtimeSimEngine || runtimeSimIrHash !== irHash) {
    return resetSimulationState(circuit, projectIoRows, sim);
  }
  const engine = runtimeSimEngine;
  applyInputsToEngine(engine, sim.inputs);
  let tick = sim.tick;
  let trace = [...sim.trace];
  for (let index = 0; index < ticks; index += 1) {
    engine.tick();
    tick += 1;
    trace.push({
      tick,
      signals: normalizeSignalMap(engine, circuit),
    });
  }
  if (trace.length > SIM_TRACE_CAPACITY) {
    trace = trace.slice(trace.length - SIM_TRACE_CAPACITY);
  }
  const signals = normalizeSignalMap(engine, circuit);
  return {
    ...sim,
    running: sim.running,
    tick,
    irHash,
    signals,
    trace,
    traceHash: computeTraceHash(irHash, trace),
  };
}

function deriveSimulationInputs(
  circuit: Circuit,
  previousInputs?: Record<string, 0 | 1>
): Record<string, 0 | 1> {
  const nextInputs: Record<string, 0 | 1> = {};
  for (const node of circuit.nodes) {
    if (!isSimulationInputNode(node.type)) continue;
    if (node.state?.isOn !== undefined) {
      nextInputs[node.id] = normalizeBit(node.state.isOn);
      continue;
    }
    const previous = previousInputs?.[node.id];
    nextInputs[node.id] = previous === 0 || previous === 1 ? previous : 0;
  }
  return nextInputs;
}

function resolveResetNodeId(projectIoRows: ProjectIoRow[], circuit: Circuit): string | undefined {
  const rows = projectIoRows.filter((row) => row.direction === 'in');
  for (const row of rows) {
    const normalized = normalizeSignalName(row.label || row.id);
    if (normalized === 'rst' || normalized === 'reset' || normalized === 'reset_n') {
      const exists = circuit.nodes.some((node) => node.id === row.nodeId);
      if (exists) return row.nodeId;
    }
  }
  return undefined;
}

function applyInputsToEngine(engine: CircuitEngine, inputs: Record<string, 0 | 1>): void {
  for (const [nodeId, value] of Object.entries(inputs)) {
    engine.setNodeValue(nodeId, value);
  }
}

function normalizeSignalMap(engine: CircuitEngine, circuit: Circuit): Record<string, 0 | 1> {
  const signalMap = engine.getAllSignals();
  const next: Record<string, 0 | 1> = {};
  const keys = Array.from(signalMap.keys()).sort(compareText);
  for (const key of keys) {
    next[key] = normalizeBit(signalMap.get(key));
  }

  for (const node of circuit.nodes) {
    if (isSimulationInputNode(node.type)) {
      const inputState = engine.getNodeState(node.id)?.isOn;
      next[`${node.id}.out`] = normalizeBit(inputState);
      continue;
    }

    if (node.type === 'OUTPUT' || node.type === 'Lamp') {
      const nodeState = engine.getNodeState(node.id);
      const fromConnection = circuit.connections.find((connection) => {
        const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
        return toNodeId === node.id;
      });
      let value = normalizeBit(nodeState?.isOn);
      if ((!nodeState || nodeState.isOn === undefined) && fromConnection) {
        const { fromNodeId, fromPort } = resolveConnectionPorts(fromConnection);
        value = next[`${fromNodeId}.${fromPort}`] ?? 0;
      }
      next[`${node.id}.in`] = value;
      next[`${node.id}.out`] = value;
    }
  }

  const orderedEntries = Object.entries(next).sort(([left], [right]) => compareText(left, right));
  return Object.fromEntries(orderedEntries) as Record<string, 0 | 1>;
}

function resolveConnectionPorts(connection: Circuit['connections'][number]): {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
} {
  const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
  const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
  const fromPort =
    typeof connection.from === 'string'
      ? connection.fromPort ?? connection.fromPin ?? 'out'
      : connection.from.portName ?? connection.from.port ?? 'out';
  const toPort =
    typeof connection.to === 'string'
      ? connection.toPort ?? connection.toPin ?? 'in'
      : connection.to.portName ?? connection.to.port ?? 'in';
  return { fromNodeId, fromPort, toNodeId, toPort };
}

function computeTraceHash(irHash: string, trace: RuntimeSimTraceSample[]): string {
  return `sim_${digestValue({ irHash, trace })}`;
}

function computeSimIrHash(circuit: Circuit): string {
  const nodes = circuit.nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      position: {
        x: roundToMill(node.position?.x ?? node.x ?? 0),
        y: roundToMill(node.position?.y ?? node.y ?? 0),
      },
      config: node.config ?? {},
    }))
    .sort((left, right) => compareText(left.id, right.id));
  const connections = circuit.connections
    .map((connection) => {
      const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
      const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
      const fromPort =
        typeof connection.from === 'string'
          ? connection.fromPort ?? connection.fromPin ?? 'out'
          : connection.from.portName ?? connection.from.port ?? 'out';
      const toPort =
        typeof connection.to === 'string'
          ? connection.toPort ?? connection.toPin ?? 'in'
          : connection.to.portName ?? connection.to.port ?? 'in';
      return {
        id: `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}`,
        fromNodeId,
        fromPort,
        toNodeId,
        toPort,
      };
    })
    .sort((left, right) => compareText(left.id, right.id));
  return `ir_${digestValue({ nodes, connections })}`;
}

function normalizeSignalName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9_.]/g, '');
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function clampSimSpeed(value: number): number {
  const next = Number.isFinite(value) ? Math.floor(value) : DEFAULT_SIM_SPEED_HZ;
  return Math.max(1, Math.min(120, next));
}

function isSimulationInputNode(nodeType: string): boolean {
  return nodeType === 'INPUT' || nodeType === 'Switch';
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
    }))
    .sort((left, right) => left.tick - right.tick);
}

function normalizeBitRecord(
  record: Record<string, boolean | number | string | undefined>
): Record<string, 0 | 1> {
  const normalized: Record<string, 0 | 1> = {};
  for (const key of Object.keys(record).sort()) {
    normalized[key] = record[key] === true || record[key] === 1 || record[key] === '1' ? 1 : 0;
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

function roundToMill(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
