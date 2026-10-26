import { materializeIoMappingFromHardwareMappingV2 } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { netlistFromCircuit } from '../../export/netlistExport';
import { vhdlFromNetlist } from '../../export/vhdlExport';
import { buildVhdlTopLevelBindings } from '../../fpga/boards/basys3/basys3Bundle';
import { resolveBasys3SignalBinding } from '../../fpga/boards/basys3/basys3SignalSemantics';
import { deriveVerifySchedule, type VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import { generateHierarchicalVhdlProject } from './hierarchicalVhdl';
import { getStudentFacingIoLabel } from './ioLabels';
import { elaborateProjectHierarchy } from './projectHierarchy';
import type { ProjectRuntimeState } from './projectRuntime';
import { buildTopEntityName, normalizeTopEntityName } from './topEntity';
import { getActiveScenario } from './verifyScenario';

/**
 * The project the workbench exports and checks before a Run, as a pure function of runtime
 * state. IdeApp derives the same document from the same state across several memos
 * (`hierarchyHdl`, `hdlText`, `xdcText`, `exportProject`, `liveScheduleContract`); this module
 * lets a surface outside IdeApp - the Meridian studio - ask the workbench's own question: which
 * live schedule contract a Run must carry. (Whether a Design issue forbids checked runs is
 * ideDesignBlocking.ts.) Mirrors those memos field by field; one shared derivation replaces
 * both in P4 (RB-DEBT-026). Workbench-only UI state (the guided-lab id and the student name)
 * appears only in `meta` and is omitted.
 */
export type IdeExportState = Pick<
  ProjectRuntimeState,
  | 'projectId'
  | 'projectName'
  | 'projectDescription'
  | 'projectKind'
  | 'sourceExampleId'
  | 'scenarioAuthority'
  | 'activeTop'
  | 'circuit'
  | 'hierarchy'
  | 'projectIoRows'
  | 'hardwareMappingV2'
  | 'sourceModel'
  | 'constraintSets'
  | 'scenarios'
  | 'activeScenarioId'
  | 'customComponents'
  | 'macros'
>;

const DEFAULT_FPGA_PART = 'xc7a35tcpg236-1';

export function buildIdeExportProject(state: IdeExportState): RBProject {
  const effectiveTopEntityName = normalizeTopEntityName(state.activeTop, buildTopEntityName(state.projectName));
  const projectIoMapping = materializeIoMappingFromHardwareMappingV2(state.hardwareMappingV2);
  const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
  const hierarchyHdl = generateHierarchicalVhdlProject({
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-02-19T00:00:00.000Z',
    updatedAt: '2026-02-19T00:00:00.000Z',
    name: state.projectName,
    circuit: normalizeProjectCircuit(state.circuit),
    hierarchy: state.hierarchy,
    ioMapping: projectIoMapping,
    hdl: { top: effectiveTopEntityName, sources: [] },
    fpga: { board: 'basys3', part: DEFAULT_FPGA_PART, top: effectiveTopEntityName },
  });
  let hdlText = '';
  try {
    const netlist = netlistFromCircuit(simulationCircuit);
    const ioMappingForExport = {
      inputs: state.projectIoRows
        .filter((r) => r.direction === 'in')
        .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
      outputs: state.projectIoRows
        .filter((r) => r.direction === 'out')
        .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
    };
    const hasMappedPins = ioMappingForExport.inputs.length > 0 || ioMappingForExport.outputs.length > 0;
    const bindings = hasMappedPins ? buildVhdlTopLevelBindings(ioMappingForExport) : {};
    hdlText = vhdlFromNetlist(netlist, { entityName: effectiveTopEntityName, ...bindings }).vhd;
  } catch {
    hdlText = '';
  }
  const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-02-19T00:00:00.000Z',
    updatedAt: '2026-02-19T00:00:00.000Z',
    name: state.projectName,
    description: state.projectDescription,
    circuit: normalizeProjectCircuit(state.circuit),
    hdl: {
      top: effectiveTopEntityName,
      sources: [
        { path: 'top.vhd', language: 'vhdl', text: hierarchyHdl?.topVhd ?? hdlText },
        ...(hierarchyHdl?.moduleSources.map((source) => ({ path: source.path, language: 'vhdl' as const, text: source.text })) ?? []),
      ],
    },
    fpga: {
      board: 'basys3',
      part: DEFAULT_FPGA_PART,
      top: effectiveTopEntityName,
      constraints: { type: 'xdc', text: buildConstraintText([...state.projectIoRows]) },
    },
    ioMapping: projectIoMapping,
    hardwareMappingV2: state.hardwareMappingV2,
    sourceModel: state.sourceModel,
    constraintSets: state.constraintSets,
    vectors: activeScenario?.vectors ?? [],
    hierarchy: state.hierarchy,
    customComponents: state.customComponents.length > 0 ? state.customComponents : undefined,
    macros: state.macros.length > 0 ? state.macros : undefined,
    meta: {
      appSurface: 'ide-export',
      projectId: state.projectId,
      projectKind: state.projectKind,
      sourceExampleId: state.sourceExampleId,
      scenarioAuthority: state.scenarioAuthority,
    },
  } as RBProject;
}

/** IdeApp `liveScheduleContract`: the schedule every Run from the workbench carries. */
export function deriveIdeLiveScheduleContract(project: RBProject): VerifyScheduleContract {
  return deriveVerifySchedule(project.circuit, project.ioMapping, project.hdl);
}

/** IdeApp `blockingDesignIssue` (see ideDesignBlocking.ts, offered through the runtime entry). */
export interface IdeBlockingDesignIssue {
  readonly title: string;
  readonly message: string;
  readonly hint?: string;
}

// ── Moved verbatim from IdeApp.tsx (it imports them from here) ──

export function normalizeProjectCircuit(circuit: RBProject['circuit']): RBProject['circuit'] {
  return {
    nodes: circuit.nodes.map((node) => {
      const x = node.position?.x ?? node.x ?? 0;
      const y = node.position?.y ?? node.y ?? 0;
      return {
        ...node,
        position: node.position ?? { x, y },
        x,
        y,
        config: node.config ?? {},
        state: node.state ?? {},
      };
    }),
    connections: circuit.connections.map((connection) => ({ ...connection })),
  };
}

export function buildConstraintText(
  ioRows: Array<{
    label: string;
    direction: 'in' | 'out';
    pin: string;
    id: string;
    port?: string;
  }>
): string {
  const clockRow = ioRows.find(
    (row) => row.direction === 'in' && resolveBasys3SignalBinding(row)?.role === 'clock'
  );

  if (!clockRow) {
    return '# Clock constraint pending: map the design clock to the Basys3 board clock CLK100MHZ / W5.';
  }

  const clockSignal = createSignalName(getStudentFacingIoLabel(clockRow, clockRow.id), 'clk');
  return `create_clock -name sys_clk -period 10.000 [get_ports ${clockSignal}]`;
}

function createSignalName(raw: string, fallback: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return fallback;
  return /^[a-z]/.test(normalized) ? normalized : `sig_${normalized}`;
}
