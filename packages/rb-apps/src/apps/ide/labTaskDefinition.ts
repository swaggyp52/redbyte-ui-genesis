import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';

export const FULL_ADDER_LAB_ID = 'full-adder-scratch-lab';

export type GuidedLabTaskId = typeof FULL_ADDER_LAB_ID;

export interface GuidedLabSignal {
  label: string;
  direction: 'in' | 'out';
  suggestedAlias: string;
  packagePin: string;
}

export interface GuidedLabTruthRow {
  A: 0 | 1;
  B: 0 | 1;
  Cin: 0 | 1;
  Sum: 0 | 1;
  Cout: 0 | 1;
}

export interface GuidedLabTaskDefinition {
  id: GuidedLabTaskId;
  title: string;
  shortTitle: string;
  assignment: string;
  buildGoal: string;
  submitGoal: string;
  evidenceBoundary: string;
  inputs: GuidedLabSignal[];
  outputs: GuidedLabSignal[];
  truthTable: GuidedLabTruthRow[];
}

export interface LabProjectIoRow {
  id: string;
  nodeId?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  port: string;
  required?: boolean;
}

export interface FullAdderLabIoRows {
  A: LabProjectIoRow | null;
  B: LabProjectIoRow | null;
  Cin: LabProjectIoRow | null;
  Sum: LabProjectIoRow | null;
  Cout: LabProjectIoRow | null;
}

export interface GuidedLabChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
}

export interface FullAdderLabDesignChecklist {
  items: GuidedLabChecklistItem[];
  readyForVerify: boolean;
  missingInputs: Array<'A' | 'B' | 'Cin'>;
  missingOutputs: Array<'Sum' | 'Cout'>;
  hasFullAdderBlock: boolean;
  connectedInputLabels: Array<'A' | 'B' | 'Cin'>;
  connectedOutputLabels: Array<'Sum' | 'Cout'>;
}

export interface FullAdderLabHardwareChecklist {
  items: GuidedLabChecklistItem[];
  readyForExport: boolean;
  missingMappings: string[];
  conflictingMappings: string[];
}

export interface FullAdderLabExportSummary {
  labName: string;
  labId: GuidedLabTaskId;
  ioStatus: 'complete' | 'missing';
  verifyStatus: 'pass' | 'fail' | 'stale' | 'not-run';
  mappingStatus: 'complete' | 'missing' | 'conflict';
  packageStatus: 'ready' | 'blocked' | 'draft';
  requiredSignals: string[];
  blockerLabels: string[];
  evidenceBoundary: string;
}

export const FULL_ADDER_SCRATCH_LAB: GuidedLabTaskDefinition = {
  id: FULL_ADDER_LAB_ID,
  title: '1-bit Full Adder from Scratch',
  shortTitle: 'Full Adder',
  assignment: 'Build A, B, and Cin into Sum and Cout, then verify all eight input combinations.',
  buildGoal: 'Use one FullAdder block with explicit A, B, Cin, Sum, and Cout boundary signals.',
  submitGoal: 'Submit the RedByte/Vivado ZIP after Verify and Map Pins are current.',
  evidenceBoundary:
    'Browser E0 package generation only; Vivado build, bitstream, and board observation remain external.',
  inputs: [
    { label: 'A', direction: 'in', suggestedAlias: 'SW0', packagePin: 'V17' },
    { label: 'B', direction: 'in', suggestedAlias: 'SW1', packagePin: 'V16' },
    { label: 'Cin', direction: 'in', suggestedAlias: 'SW2', packagePin: 'W16' },
  ],
  outputs: [
    { label: 'Sum', direction: 'out', suggestedAlias: 'LD0', packagePin: 'U16' },
    { label: 'Cout', direction: 'out', suggestedAlias: 'LD1', packagePin: 'E19' },
  ],
  truthTable: [
    { A: 0, B: 0, Cin: 0, Sum: 0, Cout: 0 },
    { A: 0, B: 0, Cin: 1, Sum: 1, Cout: 0 },
    { A: 0, B: 1, Cin: 0, Sum: 1, Cout: 0 },
    { A: 0, B: 1, Cin: 1, Sum: 0, Cout: 1 },
    { A: 1, B: 0, Cin: 0, Sum: 1, Cout: 0 },
    { A: 1, B: 0, Cin: 1, Sum: 0, Cout: 1 },
    { A: 1, B: 1, Cin: 0, Sum: 0, Cout: 1 },
    { A: 1, B: 1, Cin: 1, Sum: 1, Cout: 1 },
  ],
};

const FULL_ADDER_INPUT_LABELS = ['A', 'B', 'Cin'] as const;
const FULL_ADDER_OUTPUT_LABELS = ['Sum', 'Cout'] as const;
const FULL_ADDER_SIGNAL_LABELS = [
  ...FULL_ADDER_INPUT_LABELS,
  ...FULL_ADDER_OUTPUT_LABELS,
] as const;

type FullAdderInputLabel = (typeof FULL_ADDER_INPUT_LABELS)[number];
type FullAdderOutputLabel = (typeof FULL_ADDER_OUTPUT_LABELS)[number];
type FullAdderSignalLabel = (typeof FULL_ADDER_SIGNAL_LABELS)[number];

export function normalizeGuidedLabTaskId(value: unknown): GuidedLabTaskId | null {
  return value === FULL_ADDER_LAB_ID ? FULL_ADDER_LAB_ID : null;
}

export function getGuidedLabTask(id: string | null | undefined): GuidedLabTaskDefinition | null {
  return normalizeGuidedLabTaskId(id) ? FULL_ADDER_SCRATCH_LAB : null;
}

export function isFullAdderLabProject(project: Pick<RBProject, 'meta'> | null | undefined): boolean {
  return normalizeGuidedLabTaskId(project?.meta?.labId) === FULL_ADDER_LAB_ID;
}

export function resolveFullAdderLabIoRows(rows: readonly LabProjectIoRow[]): FullAdderLabIoRows {
  return {
    A: findLabIoRow(rows, 'A', 'in'),
    B: findLabIoRow(rows, 'B', 'in'),
    Cin: findLabIoRow(rows, 'Cin', 'in'),
    Sum: findLabIoRow(rows, 'Sum', 'out'),
    Cout: findLabIoRow(rows, 'Cout', 'out'),
  };
}

export function buildFullAdderTruthTableVectors(rows: readonly LabProjectIoRow[]): TestVector[] {
  const io = resolveFullAdderLabIoRows(rows);
  if (!io.A || !io.B || !io.Cin || !io.Sum || !io.Cout) return [];

  return FULL_ADDER_SCRATCH_LAB.truthTable.map((row, index) => ({
    tick: index,
    inputs: {
      [io.A!.id]: row.A,
      [io.B!.id]: row.B,
      [io.Cin!.id]: row.Cin,
    },
    expected: {
      [io.Sum!.id]: row.Sum,
      [io.Cout!.id]: row.Cout,
    },
  }));
}

export function deriveFullAdderDesignChecklist(
  circuit: Circuit,
  rows: readonly LabProjectIoRow[]
): FullAdderLabDesignChecklist {
  const io = resolveFullAdderLabIoRows(rows);
  const missingInputs = FULL_ADDER_INPUT_LABELS.filter((label) => !io[label]);
  const missingOutputs = FULL_ADDER_OUTPUT_LABELS.filter((label) => !io[label]);
  const fullAdderNode = (circuit.nodes ?? []).find((node) => normalizeToken(node.type) === 'fulladder') ?? null;
  const hasFullAdderBlock = Boolean(fullAdderNode);
  const connectedInputLabels = fullAdderNode
    ? FULL_ADDER_INPUT_LABELS.filter((label) => {
        const row = io[label];
        return Boolean(row?.nodeId) && hasConnection(circuit, row!.nodeId!, 'out', fullAdderNode.id, label);
      })
    : [];
  const connectedOutputLabels = fullAdderNode
    ? FULL_ADDER_OUTPUT_LABELS.filter((label) => {
        const row = io[label];
        return Boolean(row?.nodeId) && hasConnection(circuit, fullAdderNode.id, label, row!.nodeId!, 'in');
      })
    : [];

  const items: GuidedLabChecklistItem[] = [
    {
      id: 'io-inputs',
      label: 'Inputs A, B, Cin exist',
      complete: missingInputs.length === 0,
      detail: missingInputs.length === 0 ? 'All three lab inputs are present.' : `Missing ${missingInputs.join(', ')}.`,
    },
    {
      id: 'io-outputs',
      label: 'Outputs Sum and Cout exist',
      complete: missingOutputs.length === 0,
      detail: missingOutputs.length === 0 ? 'Both lab outputs are present.' : `Missing ${missingOutputs.join(', ')}.`,
    },
    {
      id: 'full-adder-block',
      label: 'FullAdder block exists',
      complete: hasFullAdderBlock,
      detail: hasFullAdderBlock ? 'A FullAdder block is on the canvas.' : 'Place a FullAdder block from the library.',
    },
    {
      id: 'full-adder-input-wires',
      label: 'A, B, Cin feed the FullAdder',
      complete: connectedInputLabels.length === FULL_ADDER_INPUT_LABELS.length,
      detail:
        connectedInputLabels.length === FULL_ADDER_INPUT_LABELS.length
          ? 'All inputs are wired into the block.'
          : `Wired ${connectedInputLabels.length}/${FULL_ADDER_INPUT_LABELS.length}.`,
    },
    {
      id: 'full-adder-output-wires',
      label: 'FullAdder Sum and Cout feed outputs',
      complete: connectedOutputLabels.length === FULL_ADDER_OUTPUT_LABELS.length,
      detail:
        connectedOutputLabels.length === FULL_ADDER_OUTPUT_LABELS.length
          ? 'Both outputs are driven from the block.'
          : `Wired ${connectedOutputLabels.length}/${FULL_ADDER_OUTPUT_LABELS.length}.`,
    },
  ];

  return {
    items,
    readyForVerify: items.every((item) => item.complete),
    missingInputs,
    missingOutputs,
    hasFullAdderBlock,
    connectedInputLabels,
    connectedOutputLabels,
  };
}

export function deriveFullAdderHardwareChecklist(
  rows: readonly LabProjectIoRow[]
): FullAdderLabHardwareChecklist {
  const usedAliases = new Map<string, string[]>();
  for (const row of rows) {
    const alias = normalizePinAlias(row.pin);
    if (!alias) continue;
    usedAliases.set(alias, [...(usedAliases.get(alias) ?? []), row.label]);
  }

  const items = FULL_ADDER_SIGNAL_LABELS.map((label) => {
    const expected = getSignalSpec(label);
    const row = findLabIoRow(rows, label, expected.direction);
    const alias = normalizePinAlias(row?.pin ?? '');
    const complete = Boolean(row) && (alias === expected.suggestedAlias || alias === expected.packagePin);
    const conflict =
      Boolean(alias) &&
      (usedAliases.get(alias)?.length ?? 0) > 1 &&
      (alias === expected.suggestedAlias || alias === expected.packagePin);

    return {
      id: `map-${label.toLowerCase()}`,
      label: `${label} -> ${expected.suggestedAlias} (${expected.packagePin})`,
      complete: complete && !conflict,
      detail: !row
        ? `${label} does not exist in Design yet.`
        : conflict
          ? `${label} shares ${row.pin} with another signal.`
          : complete
            ? `${label} is mapped to ${row.pin}.`
            : `${label} is ${row.pin ? `mapped to ${row.pin}` : 'unmapped'}.`,
    };
  });
  const missingMappings = items.filter((item) => !item.complete && !/shares/i.test(item.detail)).map((item) => item.label);
  const conflictingMappings = items.filter((item) => /shares/i.test(item.detail)).map((item) => item.label);

  return {
    items,
    readyForExport: items.every((item) => item.complete),
    missingMappings,
    conflictingMappings,
  };
}

export function deriveFullAdderExportSummary(input: {
  rows: readonly LabProjectIoRow[];
  designChecklist: FullAdderLabDesignChecklist;
  hardwareChecklist: FullAdderLabHardwareChecklist;
  verifyStatus?: 'pass' | 'fail' | 'stale' | 'not-run' | null;
  packageReady?: boolean;
  exportBlocked?: boolean;
}): FullAdderLabExportSummary {
  const blockerLabels = [
    ...input.designChecklist.items.filter((item) => !item.complete).map((item) => item.label),
    ...input.hardwareChecklist.items.filter((item) => !item.complete).map((item) => item.label),
  ];
  const verifyStatus = input.verifyStatus ?? 'not-run';
  if (verifyStatus !== 'pass') {
    blockerLabels.push(verifyStatus === 'stale' ? 'Verify evidence is stale' : 'Verify Compare has not passed');
  }

  return {
    labName: FULL_ADDER_SCRATCH_LAB.title,
    labId: FULL_ADDER_LAB_ID,
    ioStatus: input.designChecklist.missingInputs.length === 0 && input.designChecklist.missingOutputs.length === 0
      ? 'complete'
      : 'missing',
    verifyStatus,
    mappingStatus: input.hardwareChecklist.conflictingMappings.length > 0
      ? 'conflict'
      : input.hardwareChecklist.readyForExport
        ? 'complete'
        : 'missing',
    packageStatus: input.exportBlocked
      ? 'blocked'
      : input.packageReady && blockerLabels.length === 0
        ? 'ready'
        : 'draft',
    requiredSignals: FULL_ADDER_SIGNAL_LABELS.map(String),
    blockerLabels: [...new Set(blockerLabels)],
    evidenceBoundary: FULL_ADDER_SCRATCH_LAB.evidenceBoundary,
  };
}

function getSignalSpec(label: FullAdderSignalLabel): GuidedLabSignal {
  const spec = [...FULL_ADDER_SCRATCH_LAB.inputs, ...FULL_ADDER_SCRATCH_LAB.outputs].find(
    (entry) => entry.label === label
  );
  if (!spec) {
    throw new Error(`unknown full adder lab signal ${label}`);
  }
  return spec;
}

function findLabIoRow(
  rows: readonly LabProjectIoRow[],
  label: FullAdderSignalLabel,
  direction: 'in' | 'out'
): LabProjectIoRow | null {
  const target = normalizeToken(label);
  return (
    rows.find((row) => row.direction === direction && normalizeToken(row.label) === target) ??
    rows.find((row) => row.direction === direction && normalizeToken(row.id) === target) ??
    rows.find((row) => row.direction === direction && normalizeToken(row.port) === target) ??
    null
  );
}

function hasConnection(
  circuit: Circuit,
  fromNodeId: string,
  fromPort: string,
  toNodeId: string,
  toPort: string
): boolean {
  return (circuit.connections ?? []).some((connection) => {
    const from = resolveConnectionEndpoint(connection, 'from');
    const to = resolveConnectionEndpoint(connection, 'to');
    return (
      normalizeToken(from.nodeId) === normalizeToken(fromNodeId) &&
      normalizeToken(to.nodeId) === normalizeToken(toNodeId) &&
      normalizePort(from.portName) === normalizePort(fromPort) &&
      normalizePort(to.portName) === normalizePort(toPort)
    );
  });
}

function resolveConnectionEndpoint(
  connection: Circuit['connections'][number],
  side: 'from' | 'to'
): { nodeId: string; portName: string } {
  const raw = connection[side];
  if (typeof raw === 'string') {
    const pinKey = side === 'from' ? 'fromPin' : 'toPin';
    const portKey = side === 'from' ? 'fromPort' : 'toPort';
    const port = (connection as Record<string, unknown>)[pinKey] ?? (connection as Record<string, unknown>)[portKey];
    return {
      nodeId: raw,
      portName: typeof port === 'string' && port.trim() ? port : side === 'from' ? 'out' : 'in',
    };
  }
  return {
    nodeId: raw.nodeId,
    portName: raw.portName ?? raw.port ?? (side === 'from' ? 'out' : 'in'),
  };
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function normalizePort(value: unknown): string {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function normalizePinAlias(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  const direct = [...FULL_ADDER_SCRATCH_LAB.inputs, ...FULL_ADDER_SCRATCH_LAB.outputs].find(
    (entry) => raw === entry.suggestedAlias || raw === entry.packagePin
  );
  return direct?.suggestedAlias ?? raw;
}
