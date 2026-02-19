import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
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

const STORAGE_KEY = 'rb.ide.project-runtime.v1';

const DEFAULT_EXAMPLE = getIdeExampleById(IDE_DEFAULT_EXAMPLE_ID) ?? IDE_EXAMPLES[0];

export type ProjectIoRow = IdeExampleIoRow;

export interface ProjectRuntimeState {
  projectName: string;
  projectDescription: string;
  lastSavedAt: string;
  activeExampleId: string | null;
  projectIoRows: ProjectIoRow[];
  projectVectors: TestVector[];
  circuit: Circuit;
  projectHealthCore: ProjectHealthCore;
  loadExample: (exampleId: string) => void;
  loadFromProject: (project: RBProject) => void;
  setMappingPin: (rowId: string, pin: string) => void;
  autoSuggestMapping: () => void;
  setVectors: (vectors: TestVector[]) => void;
  markDesignMutated: (circuit: Circuit) => void;
  addDesignNode: (nodeType: string, position: { x: number; y: number }) => void;
  addDesignIo: (direction: 'input' | 'output', position: { x: number; y: number }) => void;
  connectDesignNodes: (connection: {
    fromNodeId: string;
    fromPort: string;
    toNodeId: string;
    toPort: string;
  }) => void;
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
  projectHealthCore: ProjectHealthCore;
}

export const useProjectRuntime = create<ProjectRuntimeState>()(
  persist(
    (set, get) => ({
      ...stateFromExample(DEFAULT_EXAMPLE),
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
      recordVerification: (result) => {
        set((state) => ({
          projectHealthCore: {
            ...state.projectHealthCore,
            lastVerify: result,
            dirtySinceVerify: false,
          },
        }));
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
      version: 1,
      partialize: (state): PersistedRuntimeState => ({
        projectName: state.projectName,
        projectDescription: state.projectDescription,
        lastSavedAt: state.lastSavedAt,
        activeExampleId: state.activeExampleId,
        projectIoRows: cloneIoRows(state.projectIoRows),
        projectVectors: cloneVectors(state.projectVectors),
        circuit: cloneCircuit(state.circuit),
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
