import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { deriveVerifySchedule } from '../../fpga/boards/basys3/verifySchedule';
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
}

export interface ProjectRuntimeActions {
  verify: {
    run: (input: RunVerificationInput) => RuntimeVerifyRun;
    clear: () => void;
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
        set({
          projectName: project.name || 'Imported project',
          projectDescription: project.description ?? '',
          lastSavedAt: `Imported: ${project.name || 'project'}`,
          activeExampleId: null,
          projectIoRows: ioRowsFromProject(project),
          projectVectors: cloneVectors(project.vectors ?? []),
          circuit: cloneCircuit(project.circuit),
          verifyLastRun: undefined,
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
          const normalizedRows = normalizeVerifyRows(input.rows);
          const failedRows = normalizedRows.filter((row) => row.expected !== row.actual);
          const status: 'pass' | 'fail' = failedRows.length > 0 ? 'fail' : 'pass';
          const ranAtIso = input.ranAtIso ?? new Date().toISOString();
          const vectors = toVerifyVectors(state.projectVectors);
          const report = buildVerifyReport({
            scenarioId: input.scenarioId,
            scenarioName: input.scenarioName,
            status,
            deterministicHash: input.deterministicHash,
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
      version: 2,
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
  return {
    projectName: example.name,
    projectDescription: example.summary,
    lastSavedAt: 'Seeded example',
    activeExampleId: example.id,
    projectIoRows: cloneIoRows(example.ioRows),
    projectVectors: cloneVectors(example.vectors),
    circuit: cloneCircuit(example.circuit),
    verifyLastRun: undefined,
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

function normalizeVerifyRows(
  rows: RunVerificationInput['rows']
): Array<{ tick: number; signal: string; expected: string; actual: string }> {
  return rows.map((row, index) => ({
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
