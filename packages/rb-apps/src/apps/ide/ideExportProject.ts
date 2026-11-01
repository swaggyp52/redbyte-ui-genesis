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
 * state: the one derivation IdeApp and the Meridian studio share (RB-DEBT-026). IdeApp memoizes
 * its two parts separately - `deriveIdeExportHdl` (generated VHDL, which only Design edits and
 * the top name change) and `assembleIdeExportProject` (everything else) - so editing stimulus
 * does not regenerate HDL; `buildIdeExportProject` is the two in one call for every other
 * caller. Which live schedule contract a Run must carry is `deriveIdeLiveScheduleContract`;
 * whether a Design issue forbids checked runs is ideDesignBlocking.ts.
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

export type IdeExportHdlState = Pick<
  IdeExportState,
  'projectName' | 'activeTop' | 'circuit' | 'hierarchy' | 'projectIoRows' | 'hardwareMappingV2'
>;

/** The export's top entity and VHDL sources (top.vhd first, then one file per module). */
export interface IdeExportHdl {
  readonly top: string;
  readonly sources: NonNullable<RBProject['hdl']>['sources'];
}

/**
 * Workbench presentation that only the workbench knows and that appears only in `meta`: the
 * guided-lab id, the student's name, and the scenario authority IdeApp derives from the open
 * project's verification (without it, `meta.scenarioAuthority` is the stored runtime field).
 */
export interface IdeExportWorkbenchMeta {
  readonly scenarioAuthority?: IdeExportState['scenarioAuthority'];
  readonly labId?: string;
  readonly studentName?: string;
}

export function deriveIdeExportHdl(state: IdeExportHdlState): IdeExportHdl {
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
  return {
    top: effectiveTopEntityName,
    sources: [
      { path: 'top.vhd', language: 'vhdl', text: hierarchyHdl?.topVhd ?? hdlText },
      ...(hierarchyHdl?.moduleSources.map((source) => ({ path: source.path, language: 'vhdl' as const, text: source.text })) ?? []),
    ],
  };
}

export function assembleIdeExportProject(
  state: IdeExportState,
  hdl: IdeExportHdl,
  workbench: IdeExportWorkbenchMeta = {},
): RBProject {
  const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  const studentName = workbench.studentName?.trim() ?? '';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-02-19T00:00:00.000Z',
    updatedAt: '2026-02-19T00:00:00.000Z',
    name: state.projectName,
    description: state.projectDescription,
    circuit: normalizeProjectCircuit(state.circuit),
    hdl: { top: hdl.top, sources: [...hdl.sources] },
    fpga: {
      board: 'basys3',
      part: DEFAULT_FPGA_PART,
      top: hdl.top,
      constraints: { type: 'xdc', text: buildConstraintText([...state.projectIoRows]) },
    },
    ioMapping: materializeIoMappingFromHardwareMappingV2(state.hardwareMappingV2),
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
      scenarioAuthority: workbench.scenarioAuthority ?? state.scenarioAuthority,
      ...(workbench.labId ? { labId: workbench.labId } : {}),
      ...(studentName ? { studentName } : {}),
    },
  } as RBProject;
}

export function buildIdeExportProject(state: IdeExportState, workbench: IdeExportWorkbenchMeta = {}): RBProject {
  return assembleIdeExportProject(state, deriveIdeExportHdl(state), workbench);
}

/**
 * IdeApp `liveScheduleContract`: the schedule every Run from the workbench carries, and the one
 * Export's plan and testbench use. It reads the elaborated hierarchy, as the simulator and the
 * testbench do: a register or latch inside a module is sequential, and the top-level circuit
 * alone hid it (a Run treated a module's latch as combinational while the testbench clocked it).
 */
export function deriveIdeLiveScheduleContract(project: RBProject, ioMapping: RBProject['ioMapping'] = project.ioMapping): VerifyScheduleContract {
  return deriveVerifySchedule(elaborateProjectHierarchy(project.circuit, project.hierarchy), ioMapping, project.hdl);
}

/** IdeApp `blockingDesignIssue` (see ideDesignBlocking.ts, offered through the runtime entry). */
export interface IdeBlockingDesignIssue {
  readonly title: string;
  readonly message: string;
  readonly hint?: string;
}

// ── Helpers IdeApp also imports ──

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
