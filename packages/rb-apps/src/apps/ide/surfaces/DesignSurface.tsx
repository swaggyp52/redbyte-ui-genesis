import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Circuit, CompositeNodeDef, Node } from '@redbyte/rb-logic-core';
import { TickEngine } from '@redbyte/rb-logic-core';
import {
  LogicCanvas,
  findSmartSpawnPosition,
  useLogicViewStore,
  type ChipMetadata,
  type NodeIoPresentation,
} from '@redbyte/rb-logic-view';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { digestValue } from '../../../utils/digest';
import { parseWireId } from '../../../utils/wireId';
import type { IdeDiagnostic, IdeDiagnosticRouteRequest } from '../diagnostics';
import { getFaninCone, getFanoutCone } from '../pathTrace';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeEmptyState,
  IdeInspectorAccordion,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { RuntimeSimState, RuntimeSignalProbe } from '../projectRuntime';
import { useBoardSignal } from '../BoardSignalContext';
import { getStudentFacingIoLabel } from '../ioLabels';
import type { VerifyDebugContext } from '../verifyDebug';
import { netlistFromCircuit } from '../../../export/netlistExport';
import { vhdlFromNetlist } from '../../../export/vhdlExport';
import { synthesizableVerilogFromNetlist } from '../../../export/verilogExport';
import { buildVhdlTopLevelBindings } from '../../../fpga/boards/basys3/basys3Bundle';
import { getDesignChipMetadata } from '../designChipMetadata';
import { serializeCluster, pasteCluster, type ClipboardCluster } from '../designClipboard';
import {
  compareDesignIssues,
  computeDesignIssues,
  nodeIssueSeverity,
  type DesignIssue,
} from '../designIssues';
import {
  analyzeMacroBoundary,
  type MacroBoundaryAnalysis,
  type MacroDefinition,
  type MacroInstantiationResult,
  type SaveMacroInput,
} from '../macros/MacroLibrary';
import { MacroLibraryPanel } from './MacroLibraryPanel';
import { MacroSaveDialog } from './MacroSaveDialog';

/** Maps internal node type strings to student-readable labels for toast feedback. */
function nodeTypeLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    AND: 'AND gate',
    OR: 'OR gate',
    NOT: 'NOT gate',
    NAND: 'NAND gate',
    NOR: 'NOR gate',
    XOR: 'XOR gate',
    XNOR: 'XNOR gate',
    BUFFER: 'Buffer',
    INPUT: 'Input',
    OUTPUT: 'Output',
    DFlipFlop: 'D flip-flop',
    TFlipFlop: 'T flip-flop',
    JKFlipFlop: 'JK flip-flop',
    SRLatch: 'SR latch',
    MUX: 'Multiplexer',
    DEMUX: 'Demultiplexer',
    DECODER: 'Decoder',
    ENCODER: 'Encoder',
    HALFADDER: 'Half adder',
    FULLADDER: 'Full adder',
    CLOCK: 'Clock',
  };
  return labels[nodeType] ?? nodeType;
}

/** Map raw wire validation reasons to student-readable messages. */
export function connectionRejectedMessage(reason: string): string {
  if (reason === 'Cannot connect node to itself') return 'A gate cannot connect to itself.';
  if (reason === 'Connection already exists') return 'That wire already exists.';
  if (reason === 'Cannot connect input to input') return 'Inputs cannot be wired directly to each other.';
  if (reason === 'Cannot connect output to output') return 'Outputs cannot be wired directly to each other.';
  return 'That connection is not allowed here.';
}

export interface DesignSurfaceProps {
  onOpenPalette?: () => void;
  onCircuitMutated?: () => void;
  onRuntimeAddNode?: (nodeType: string, position: { x: number; y: number }) => void;
  onRuntimeAddIo?: (direction: 'input' | 'output', position: { x: number; y: number }) => void;
  onRuntimeAddBoardIo?: (input: {
    alias: string;
    direction: 'in' | 'out';
    kind?: 'switch' | 'button' | 'clock' | 'reset' | 'led' | 'segment' | 'anode' | 'dp';
    position: { x: number; y: number };
  }) => void;
  onRuntimeConnect?: (connection: {
    fromNodeId: string;
    fromPort: string;
    toNodeId: string;
    toPort: string;
  }) => void;
  compilerStatus?: DesignCompilerStatus;
  onDiagnosticAction?: (diagnostic: IdeDiagnostic) => void;
  diagnosticRouteRequest?: IdeDiagnosticRouteRequest | null;
  runtimeSim: RuntimeSimState;
  onRuntimeSimRun?: () => void;
  onRuntimeSimPause?: () => void;
  onRuntimeSimStep?: () => void;
  onRuntimeSimReset?: () => void;
  onRuntimeSimSetSpeed?: (hz: number) => void;
  onRuntimeSimSetInput?: (nodeId: string, value: 0 | 1) => void;
  onRuntimeSimSetSelectedSignal?: (signalKey: string | null) => void;
  onRuntimeSimToggleProbe?: (probe: RuntimeSignalProbe) => void;
  viewportSeed?: string;
  ioRows?: Array<{
    id: string;
    nodeId: string;
    label: string;
    pin: string;
    port: string;
    direction: 'in' | 'out';
  }>;
  onGoToHardware?: () => void;
  onGoToImport?: () => void;
  onGoToProject?: () => void;
  onGoToVerify?: () => void;
  onClearDiagnostic?: () => void;
  topHdl?: string;
  onApplyHdl?: (hdl: string) => void;
  topEntityName?: string;
  onSaveAsComponent?: (def: CompositeNodeDef) => void;
  customComponentTypes?: Array<{ type: string; title: string; description: string }>;
  macros?: MacroDefinition[];
  onSaveMacro?: (input: Omit<SaveMacroInput, 'circuit'>) => MacroDefinition | null;
  onDeleteMacro?: (macroId: string) => void;
  onInstantiateMacro?: (
    macroId: string,
    position: { x: number; y: number }
  ) => MacroInstantiationResult | null;
  // C-5: External debug state from verification bridge
  externalDebugSignals?: Map<string, 0 | 1> | null;
  externalDebugTick?: number | null;
  externalDebugContext?: VerifyDebugContext | null;
  onClearExternalDebug?: () => void;
  // C-5b: Tick navigation within the debug waveform
  onPrevDebugTick?: () => void;
  onNextDebugTick?: () => void;
  debugTickIndex?: number;
  debugTickCount?: number;
  // A2: Verify → Design signal linkage
  activeVerifySignal?: string | null;
}

export interface DesignCompilerStatus {
  dirtySinceVerify: boolean;
  dirtySinceExport: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: IdeDiagnostic[];
}

interface PaletteItem {
  type: string;
  title: string;
  category: 'IO' | 'Logic' | 'Sequential' | 'Components';
  subtitle: string;
  glyph: string;
  searchTerms: string[];
}

interface BoardIoPaletteItem {
  alias: string;
  kind: 'switch' | 'button' | 'clock' | 'reset' | 'led' | 'segment' | 'anode' | 'dp';
  direction: 'in' | 'out';
}

interface PendingPlacementState {
  kind: 'node' | 'board-io';
  label: string;
  nodeType?: string;
  boardIoEntry?: BoardIoPaletteItem;
}

interface PaletteSectionDefinition {
  id: 'logic' | 'sequential' | 'io' | 'reusable' | 'board';
  title: string;
  description: string;
}

interface BoardPaletteGroup {
  id: 'switches' | 'buttons' | 'system' | 'leds' | 'display';
  title: string;
  description: string;
  entries: BoardIoPaletteItem[];
}

const CANVAS_PLACEMENT_BLOCK_SELECTOR =
  '[data-blocks-canvas-placement="1"], [data-blocks-macro-placement="1"]';

function isCanvasPlacementBlocked(target: HTMLElement | null): boolean {
  if (!target) return false;
  return Boolean(
    target.closest(CANVAS_PLACEMENT_BLOCK_SELECTOR) ||
      target.closest('[data-node-id]') ||
      target.closest('[data-port-id]') ||
      target.closest('[data-wire-id]') ||
      target.closest('[data-testid^="logic-wire-reconnect"]')
  );
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'AND',
    title: 'AND Gate',
    category: 'Logic',
    subtitle: '2-input gate that goes high only when both inputs are high.',
    glyph: 'AND',
    searchTerms: ['gate', 'logic', 'combinational'],
  },
  {
    type: 'OR',
    title: 'OR Gate',
    category: 'Logic',
    subtitle: '2-input gate that goes high when either input is high.',
    glyph: 'OR',
    searchTerms: ['gate', 'logic', 'combinational'],
  },
  {
    type: 'XOR',
    title: 'XOR Gate',
    category: 'Logic',
    subtitle: 'Exclusive OR for difference and parity checks.',
    glyph: 'XOR',
    searchTerms: ['gate', 'logic', 'exclusive or', 'parity'],
  },
  {
    type: 'NOT',
    title: 'NOT Gate',
    category: 'Logic',
    subtitle: 'Single-input inverter for complementing a signal.',
    glyph: 'NOT',
    searchTerms: ['gate', 'logic', 'inverter', 'invert'],
  },
  {
    type: 'NAND',
    title: 'NAND Gate',
    category: 'Logic',
    subtitle: 'Universal gate that outputs low only when both inputs are high.',
    glyph: 'NAND',
    searchTerms: ['gate', 'logic', 'universal'],
  },
  {
    type: 'NOR',
    title: 'NOR Gate',
    category: 'Logic',
    subtitle: 'Universal gate that outputs high only when both inputs are low.',
    glyph: 'NOR',
    searchTerms: ['gate', 'logic', 'universal'],
  },
  {
    type: 'XNOR',
    title: 'XNOR Gate',
    category: 'Logic',
    subtitle: 'Equality gate that goes high when inputs match.',
    glyph: 'XNOR',
    searchTerms: ['gate', 'logic', 'equality', 'equivalence'],
  },
  {
    type: 'DFlipFlop',
    title: 'DFF',
    category: 'Sequential',
    subtitle: 'Edge-triggered state element for registers and counters.',
    glyph: 'DFF',
    searchTerms: ['flip flop', 'flipflop', 'register', 'state', 'memory'],
  },
  {
    type: 'Clock',
    title: 'Clock',
    category: 'Sequential',
    subtitle: 'Free-running timing source for sequential logic.',
    glyph: 'CLK',
    searchTerms: ['clock', 'pulse', 'timing', 'oscillator'],
  },
  {
    type: 'INPUT',
    title: 'Input Pin',
    category: 'IO',
    subtitle: 'Student-controlled source pin for entering signals.',
    glyph: 'IN',
    searchTerms: ['input', 'pin', 'source', 'io', 'i/o'],
  },
  {
    type: 'OUTPUT',
    title: 'Output Pin',
    category: 'IO',
    subtitle: 'Observed sink pin for circuit outputs and labels.',
    glyph: 'OUT',
    searchTerms: ['output', 'pin', 'sink', 'probe', 'io', 'i/o'],
  },
];

const COMPOSITE_PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'RSLatch',
    title: 'RS Latch',
    category: 'Components',
    subtitle: 'Simple bistable latch with set and reset control.',
    glyph: 'RS',
    searchTerms: ['latch', 'memory', 'state'],
  },
  {
    type: 'DLatch',
    title: 'D Latch',
    category: 'Components',
    subtitle: 'Level-sensitive latch for gated storage.',
    glyph: 'DL',
    searchTerms: ['latch', 'memory', 'state'],
  },
  {
    type: 'JKFlipFlop',
    title: 'JK Flip-Flop',
    category: 'Components',
    subtitle: 'Toggle-capable sequential primitive with J and K inputs.',
    glyph: 'JK',
    searchTerms: ['flip flop', 'flipflop', 'toggle', 'state'],
  },
  {
    type: 'FullAdder',
    title: 'Full Adder',
    category: 'Components',
    subtitle: 'Built-in arithmetic block for sum and carry logic.',
    glyph: 'ADD',
    searchTerms: ['adder', 'arithmetic', 'sum', 'carry'],
  },
  {
    type: 'Counter4Bit',
    title: '4-Bit Counter',
    category: 'Components',
    subtitle: 'Reusable counter block for quick sequential experiments.',
    glyph: 'CTR',
    searchTerms: ['counter', 'register', 'state', 'sequential'],
  },
];

const PALETTE_SECTION_ORDER: PaletteSectionDefinition[] = [
  {
    id: 'logic',
    title: 'Logic Gates',
    description: 'Core combinational building blocks for the main circuit path.',
  },
  {
    id: 'sequential',
    title: 'Sequential & Timing',
    description: 'Stateful and timing-driven parts for registers, memory, and clocks.',
  },
  {
    id: 'io',
    title: 'Inputs & Outputs',
    description: 'Student-facing pins for driving and observing circuit behavior.',
  },
  {
    id: 'reusable',
    title: 'Reusable Blocks',
    description: 'Built-in helpers, saved macros, and custom parts you can place quickly.',
  },
  {
    id: 'board',
    title: 'Board Resources',
    description: 'Basys3-specific switches, LEDs, and display resources for hardware mapping.',
  },
];

const BASYS3_INPUT_ITEMS: BoardIoPaletteItem[] = [
  ...Array.from({ length: 16 }, (_, index) => ({
    alias: `SW${index}`,
    direction: 'in' as const,
    kind: 'switch' as const,
  })),
  { alias: 'BTNC', direction: 'in', kind: 'button' },
  { alias: 'BTNU', direction: 'in', kind: 'button' },
  { alias: 'BTNL', direction: 'in', kind: 'button' },
  { alias: 'BTNR', direction: 'in', kind: 'button' },
  { alias: 'BTND', direction: 'in', kind: 'button' },
  { alias: 'CLK100MHZ', direction: 'in', kind: 'clock' },
  { alias: 'RST', direction: 'in', kind: 'reset' },
];

const BASYS3_OUTPUT_ITEMS: BoardIoPaletteItem[] = [
  ...Array.from({ length: 16 }, (_, index) => ({
    alias: `LD${index}`,
    direction: 'out' as const,
    kind: 'led' as const,
  })),
  ...Array.from({ length: 7 }, (_, index) => ({
    alias: `SEG${index}`,
    direction: 'out' as const,
    kind: 'segment' as const,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    alias: `AN${index}`,
    direction: 'out' as const,
    kind: 'anode' as const,
  })),
  { alias: 'DP', direction: 'out', kind: 'dp' },
];

const FIT_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.4] as const;

function tokenizePaletteQuery(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((entry) => entry.length > 0);
}

function matchesPaletteQuery(queryTerms: string[], searchParts: Array<string | undefined>): boolean {
  if (queryTerms.length === 0) return true;
  const haystack = searchParts
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .join(' ')
    .toLowerCase();
  return queryTerms.every((term) => haystack.includes(term));
}

function describeBoardEntry(entry: BoardIoPaletteItem): string {
  if (entry.kind === 'switch') return 'Board switch input';
  if (entry.kind === 'button') return 'Push button input';
  if (entry.kind === 'clock') return 'Board clock source';
  if (entry.kind === 'reset') return 'Reset input';
  if (entry.kind === 'led') return 'Discrete LED output';
  if (entry.kind === 'segment') return 'Seven-segment segment output';
  if (entry.kind === 'anode') return 'Seven-segment digit select';
  return 'Decimal-point output';
}

function groupBoardPaletteItems(
  inputs: BoardIoPaletteItem[],
  outputs: BoardIoPaletteItem[]
): BoardPaletteGroup[] {
  return [
    {
      id: 'switches',
      title: 'Switches',
      description: 'Toggleable board inputs for quick manual testing.',
      entries: inputs.filter((entry) => entry.kind === 'switch'),
    },
    {
      id: 'buttons',
      title: 'Buttons',
      description: 'Momentary push-button inputs.',
      entries: inputs.filter((entry) => entry.kind === 'button'),
    },
    {
      id: 'system',
      title: 'Clock & Reset',
      description: 'Dedicated board timing and reset lines.',
      entries: inputs.filter((entry) => entry.kind === 'clock' || entry.kind === 'reset'),
    },
    {
      id: 'leds',
      title: 'LEDs',
      description: 'Single-bit board outputs.',
      entries: outputs.filter((entry) => entry.kind === 'led'),
    },
    {
      id: 'display',
      title: 'Seven Segment',
      description: 'Display segments, digit enables, and decimal point.',
      entries: outputs.filter(
        (entry) => entry.kind === 'segment' || entry.kind === 'anode' || entry.kind === 'dp'
      ),
    },
  ].filter((group) => group.entries.length > 0);
}

function snapFitZoom(rawZoom: number): number {
  return FIT_ZOOM_STEPS.reduce((closest, candidate) =>
    Math.abs(candidate - rawZoom) < Math.abs(closest - rawZoom) ? candidate : closest
  );
}

const DESIGN_DEBUG_DOWNSTREAM_KEYS = [
  'xor_node.out',
  'ld2_node.in',
  'ld2_node.out',
  'and_node.out',
  'or_node.out',
  'ld0_node.in',
  'ld1_node.in',
] as const;

interface DesignDebugSignalSample {
  key: string;
  value: 0 | 1;
}

interface DesignDebugToggleSample {
  nodeId: string;
  source: 'canvas' | 'dock';
  requestedValue: 0 | 1;
  requestedAtIso: string;
  uiBefore: 0 | 1;
  simInputBefore: 0 | 1;
  downstreamBefore: DesignDebugSignalSample | null;
}

interface DesignTraceState {
  kind: 'wire-net' | 'fanin-port' | 'fanout-port';
  sourceKey: string;
  label: string;
  signalKey: string | null;
  wireHighlights: Map<string, string[]>;
  nodeIds: Set<string>;
  portKeys: Set<string>;
}

interface DesignWireContextMenuState {
  x: number;
  y: number;
  wireId: string;
  signalKey: string | null;
}

interface DesignMacroDialogState {
  analysis: MacroBoundaryAnalysis;
  selectedNodeIds: Set<string>;
  suggestedName: string;
}

interface DesignSignalSnapshot {
  currentValue: 0 | 1 | null;
  previousValue: 0 | 1 | null;
  transition: 'rising' | 'falling' | 'stable' | '—';
  samples: number;
  lastTransitionTick: number | null;
}

interface DesignNodeConnectionSummary {
  fanIn: number;
  fanOut: number;
  incomingLabel: string;
}

interface DesignLiveIoValueRow {
  id: string;
  label: string;
  pinAlias?: string;
  value: 0 | 1;
  signalKey: string;
  kind: 'input' | 'output';
}

interface DesignSimulationStory {
  summary: string;
  clockEvent: 'rising' | 'falling' | null;
  clockLabel: string | null;
}

function resolveDesignDebugSample(
  signals: Record<string, 0 | 1>,
  preferredKeys: readonly string[]
): DesignDebugSignalSample | null {
  for (const key of preferredKeys) {
    const value = signals[key];
    if (value === 0 || value === 1) {
      return { key, value };
    }
  }
  return null;
}

function readDesignDebugQueryParam(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = new URLSearchParams(window.location.search).get('designDebug');
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
}

export const DesignSurface: React.FC<DesignSurfaceProps> = ({
  onOpenPalette,
  onCircuitMutated,
  onRuntimeAddNode,
  onRuntimeAddIo,
  onRuntimeAddBoardIo,
  onRuntimeConnect,
  compilerStatus,
  onDiagnosticAction,
  diagnosticRouteRequest,
  runtimeSim,
  onRuntimeSimRun,
  onRuntimeSimPause,
  onRuntimeSimStep,
  onRuntimeSimReset,
  onRuntimeSimSetSpeed,
  onRuntimeSimSetInput,
  onRuntimeSimSetSelectedSignal,
  onRuntimeSimToggleProbe,
  viewportSeed,
  ioRows = [],
  onGoToHardware,
  onGoToImport,
  onGoToProject,
  onGoToVerify,
  onClearDiagnostic,
  topHdl,
  onApplyHdl,
  topEntityName,
  onSaveAsComponent,
  customComponentTypes,
  macros = [],
  onSaveMacro,
  onDeleteMacro,
  onInstantiateMacro,
  externalDebugSignals,
  externalDebugTick,
  externalDebugContext,
  onClearExternalDebug,
  onPrevDebugTick,
  onNextDebugTick,
  debugTickIndex,
  debugTickCount,
  activeVerifySignal,
}) => {
  const circuit = useCircuitStore((state) => state.circuit);
  const addNode = useCircuitStore((state) => state.addNode);
  const updateCircuit = useCircuitStore((state) => state.updateCircuit);
  const deleteNode = useCircuitStore((state) => state.deleteNode);
  const deleteConnection = useCircuitStore((state) => state.deleteConnection);
  const undo = useCircuitStore((state) => state.undo);
  const redo = useCircuitStore((state) => state.redo);
  const setEngine = useCircuitStore((state) => state.setEngine);
  const setTickEngine = useCircuitStore((state) => state.setTickEngine);
  const updateNode = useCircuitStore((state) => state.updateNode);
  const undoDepth = useCircuitStore((state) => state.past.length);
  const redoDepth = useCircuitStore((state) => state.future.length);

  const camera = useLogicViewStore((state) => state.camera);
  const toolMode = useLogicViewStore((state) => state.toolMode);
  const setToolMode = useLogicViewStore((state) => state.setToolMode);
  const setInteractionMode = useLogicViewStore((state) => state.setInteractionMode);
  const selectMultipleNodes = useLogicViewStore((state) => state.selectMultipleNodes);
  const snapToGrid = useLogicViewStore((state) => state.snapToGrid);
  const toggleSnapToGrid = useLogicViewStore((state) => state.toggleSnapToGrid);
  const clearSelection = useLogicViewStore((state) => state.clearSelection);
  const setCamera = useLogicViewStore((state) => state.setCamera);
  const zoomCamera = useLogicViewStore((state) => state.zoom);
  const rawSelection = useLogicViewStore((state) => state.selection);
  const interactionMode = useLogicViewStore((state) => state.interactionMode);
  const wireStartPort = useLogicViewStore((state) => state.editingState.wireStartPort);
  const endWire = useLogicViewStore((state) => state.endWire);

  const selection = useMemo(
    () => ({
      nodes: rawSelection?.nodes instanceof Set ? rawSelection.nodes : new Set<string>(),
      wires: rawSelection?.wires instanceof Set ? rawSelection.wires : new Set<string>(),
    }),
    [rawSelection]
  );
  const editorCircuit = useMemo(() => normalizeCircuitForCanvas(circuit), [circuit]);

  // ── Live HDL generation (VHDL + Verilog from current circuit) ────────────
  const liveHdlResult = useMemo(() => {
    try {
      const netlist = netlistFromCircuit(circuit);
      // Build board-aware port bindings from ioRows — same logic as exportBasys3Bundle
      // so the pane VHDL is byte-identical to the exported top.vhd (STOP-SHIP 6).
      const rows = ioRows ?? [];
      const ioMappingForPane = {
        inputs: rows
          .filter((r) => r.direction === 'in')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
        outputs: rows
          .filter((r) => r.direction === 'out')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
      };
      const hasMappedPins = ioMappingForPane.inputs.length > 0 || ioMappingForPane.outputs.length > 0;
      const bindings = hasMappedPins ? buildVhdlTopLevelBindings(ioMappingForPane) : {};
      const vhdlResult = vhdlFromNetlist(netlist, {
        entityName: topEntityName ?? 'top',
        ...bindings,
      });
      const verilogResult = synthesizableVerilogFromNetlist(netlist);
      return {
        vhd: vhdlResult.vhd,
        verilog: verilogResult.topModule,
        warnings: vhdlResult.warnings,
        error: null as string | null,
      };
    } catch (err) {
      return {
        vhd: '',
        verilog: '',
        warnings: [],
        error: err instanceof Error ? err.message : 'HDL generation failed',
      };
    }
  }, [circuit, topEntityName, ioRows]);

  const [paletteQuery, setPaletteQuery] = useState('');
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const previousWireCountRef = useRef(editorCircuit.connections.length);
  const [canvasSize, setCanvasSize] = useState({ width: 880, height: 520 });
  const [paneRowSize, setPaneRowSize] = useState({ width: 0, height: 0 });
  const [presentationZoom, setPresentationZoom] = useState<'dense' | 'classroom'>('dense');
  const [showDetails, setShowDetails] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [wireFeedback, setWireFeedback] = useState<string | null>(null);
  const [focusedIssueSignalKey, setFocusedIssueSignalKey] = useState<string | null>(null);
  const [diagnosticFilterNodeId, setDiagnosticFilterNodeId] = useState<string | null>(null);
  const [tickEngine] = useState(() => new TickEngine(editorCircuit, { tickRate: 10 }));
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [showEvalOrder, setShowEvalOrder] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [designView, setDesignView] = useState<'canvas' | 'hdl' | 'split'>('canvas');
  const [designDebugEnabled, setDesignDebugEnabled] = useState(() => readDesignDebugQueryParam());
  const [hdlDraftText, setHdlDraftText] = useState('');
  const splitRatio = useLayoutStore((state) => state.splitRatio);
  const setSplitRatio = useLayoutStore((state) => state.setSplitRatio);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const paneRowRef = useRef<HTMLDivElement>(null);
  // N-1: Save as Component modal state
  const [saveComponentOpen, setSaveComponentOpen] = useState(false);
  const [saveComponentName, setSaveComponentName] = useState('');
  const [savedComponentToast, setSavedComponentToast] = useState<string | null>(null);
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current); }, []);

  // CP-1: Clipboard state for deterministic copy/paste
  const [clipboard, setClipboard] = useState<ClipboardCluster | null>(null);
  // CP-3: Progressive paste — step resets on new copy, increments each paste
  const [pasteStep, setPasteStep] = useState(0);
  const [macroDialogState, setMacroDialogState] = useState<DesignMacroDialogState | null>(null);
  const [activeMacroInsertionId, setActiveMacroInsertionId] = useState<string | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacementState | null>(null);

  // A-2: Inline node label editor state
  const [editingLabelNodeId, setEditingLabelNodeId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  // V-2: Fanin path tracer — highlights all wires/nodes feeding the clicked port
  const [traceState, setTraceState] = useState<DesignTraceState | null>(null);
  const [wireContextMenu, setWireContextMenu] = useState<DesignWireContextMenuState | null>(null);
  const lastTracedPortRef = useRef<string | null>(null);
  const previousToolModeRef = useRef(toolMode);
  const previousHasSelectionRef = useRef(false);
  const suppressNextToolModeWireFeedbackClearRef = useRef(false);

  const clearTrace = useCallback(() => {
    lastTracedPortRef.current = null;
    setTraceState(null);
  }, []);

  const handlePortClick = useCallback((nodeId: string, portName: string) => {
    const portKey = `${nodeId}.${portName}`;
    if (lastTracedPortRef.current === portKey) {
      clearTrace();
      return;
    }
    lastTracedPortRef.current = portKey;
    const { wireIds, nodeIds } = getFaninCone(editorCircuit, nodeId);
    const highlights = new Map<string, string[]>();
    wireIds.forEach((wid) => highlights.set(wid, ['#a78bfa']));
    const portKeys = buildTracePortKeySet(wireIds);
    portKeys.add(`${nodeId}:${portName}`);
    const highlightedNodes = new Set(nodeIds);
    highlightedNodes.add(nodeId);
    setTraceState({
      kind: 'fanin-port',
      sourceKey: portKey,
      label: `Fanin to ${portKey}`,
      signalKey: `${nodeId}.${portName}`,
      wireHighlights: highlights,
      nodeIds: highlightedNodes,
      portKeys,
    });
  }, [clearTrace, editorCircuit]);

  // Fan-out trace — highlights all wires/nodes driven by the selected source node
  const handleFanoutTrace = useCallback((nodeId: string) => {
    const fanoutKey = `fanout:${nodeId}`;
    if (lastTracedPortRef.current === fanoutKey) {
      clearTrace();
      return;
    }
    lastTracedPortRef.current = fanoutKey;
    const { wireIds, nodeIds } = getFanoutCone(editorCircuit, nodeId);
    const highlights = new Map<string, string[]>();
    wireIds.forEach((wid) => highlights.set(wid, ['#34d399']));
    const portKeys = buildTracePortKeySet(wireIds);
    portKeys.add(`${nodeId}:out`);
    const highlightedNodes = new Set(nodeIds);
    highlightedNodes.add(nodeId);
    setTraceState({
      kind: 'fanout-port',
      sourceKey: nodeId,
      label: `Fanout from ${nodeId}`,
      signalKey: null,
      wireHighlights: highlights,
      nodeIds: highlightedNodes,
      portKeys,
    });
  }, [clearTrace, editorCircuit]);

  // Force canvas host to recompute its size when view mode changes.
  // Double-rAF: first frame applies display changes, second measures new dims.
  useLayoutEffect(() => {
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
    return () => cancelAnimationFrame(outer);
  }, [designView]);
  const hasAutoFitRef = useRef(false);
  const lastViewportSeedRef = useRef<string | undefined>(undefined);
  const pendingDebugToggleRef = useRef<DesignDebugToggleSample | null>(null);
  const simTick = runtimeSim.tick;
  const simSpeed = runtimeSim.speedHz;
  const simRunning = runtimeSim.running;
  const liveSignals = useMemo(() => {
    const entries = Object.entries(runtimeSim.signals)
      .map(([key, value]) => [key, value === 1 ? 1 : 0] as const)
      .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
    return new Map<string, 0 | 1>(entries);
  }, [runtimeSim.signals]);
  const ioRowByNodeId = useMemo(() => {
    const index = new Map<string, (typeof ioRows)[number]>();
    for (const row of ioRows) {
      const key = row.nodeId?.trim();
      if (!key) continue;
      index.set(key, row);
    }
    return index;
  }, [ioRows]);
  const allLiveInputRows = useMemo(() => {
    return editorCircuit.nodes
      .filter((node) => node.type === 'INPUT' || node.type === 'Switch')
      .map((node) => {
        const ioPresentation = resolveNodeIoPresentation(node, ioRowByNodeId.get(node.id));
        return {
          id: node.id,
          label: ioPresentation.label ?? `${node.type} ${node.id}`,
          value: liveSignals.get(`${node.id}.out`) ?? (0 as 0 | 1),
        };
      });
  }, [editorCircuit.nodes, ioRowByNodeId, liveSignals]);
  const liveInputValueById = useMemo(() => {
    const valueById = new Map<string, 0 | 1>();
    for (const row of allLiveInputRows) {
      valueById.set(row.id, row.value);
    }
    return valueById;
  }, [allLiveInputRows]);
  const queueDesignDebugToggleSample = useCallback(
    (nodeId: string, requestedValue: 0 | 1, source: 'canvas' | 'dock') => {
      if (!designDebugEnabled) return;
      pendingDebugToggleRef.current = {
        nodeId,
        source,
        requestedValue,
        requestedAtIso: new Date().toISOString(),
        uiBefore: liveInputValueById.get(nodeId) ?? 0,
        simInputBefore: runtimeSim.inputs[nodeId] ?? 0,
        downstreamBefore: resolveDesignDebugSample(runtimeSim.signals, DESIGN_DEBUG_DOWNSTREAM_KEYS),
      };
    },
    [designDebugEnabled, liveInputValueById, runtimeSim.inputs, runtimeSim.signals]
  );
  const getChipMetadata = useCallback((nodeType: string): ChipMetadata | undefined => {
    return getDesignChipMetadata(nodeType);
  }, []);

  const { setActiveBoardSignal } = useBoardSignal();
  const activeInsertionMacro = useMemo(
    () => macros.find((entry) => entry.id === activeMacroInsertionId) ?? null,
    [activeMacroInsertionId, macros]
  );
  const placementModeLabel = activeInsertionMacro?.name ?? pendingPlacement?.label ?? null;
  const isPlacementMode = placementModeLabel != null;

  useEffect(() => {
    setEngine(tickEngine.getEngine());
    setTickEngine(tickEngine);
    return () => {
      tickEngine.dispose();
    };
  }, [setEngine, setTickEngine, tickEngine]);

  useEffect(() => {
    tickEngine.setCircuit(editorCircuit);
  }, [editorCircuit, tickEngine]);

  useEffect(() => {
    if (!canvasHostRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0];
      if (!next) return;
      const width = Math.max(640, Math.floor(next.contentRect.width));
      const height = Math.max(64, Math.floor(next.contentRect.height));
      setCanvasSize({ width, height });
    });
    observer.observe(canvasHostRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!paneRowRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0];
      if (!next) return;
      setPaneRowSize({
        width: Math.floor(next.contentRect.width),
        height: Math.floor(next.contentRect.height),
      });
    });
    observer.observe(paneRowRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!simRunning || !onRuntimeSimStep) return;
    const intervalMs = Math.max(24, Math.round(1000 / Math.max(1, simSpeed)));
    const timer = window.setInterval(() => {
      onRuntimeSimStep();
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [onRuntimeSimStep, simRunning, simSpeed]);

  const deleteSelection = useCallback(() => {
    const selectedNodeIds = Array.from(selection.nodes);
    const selectedWireIds = Array.from(selection.wires);

    for (const nodeId of selectedNodeIds) {
      deleteNode(nodeId);
    }

    for (const wireId of selectedWireIds) {
      const parsed = parseWireId(wireId);
      if (!parsed) continue;
      deleteConnection(parsed.fromNodeId, parsed.fromPort, parsed.toNodeId, parsed.toPort);
    }

    clearSelection();
    if (selectedNodeIds.length + selectedWireIds.length > 0) {
      setActionToast('Removed selected nodes and wires.');
      onCircuitMutated?.();
    }
  }, [clearSelection, deleteConnection, deleteNode, onCircuitMutated, selection.nodes, selection.wires]);

  // CP-1: Copy selected nodes into in-memory clipboard
  // Each copy resets paste step so fresh pasting starts at origin+step*40
  const PASTE_STEP_SIZE = 40;
  const handleCopy = useCallback(() => {
    if (selection.nodes.size === 0) return;
    const cluster = serializeCluster(circuit, selection.nodes);
    setClipboard(cluster);
    setPasteStep(0);
    setActionToast(`Copied ${cluster.nodes.length} node${cluster.nodes.length !== 1 ? 's' : ''}.`);
  }, [circuit, selection.nodes]);

  // CP-1: Paste clipboard cluster with progressive offset — each paste steps further from origin
  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    const nextStep = pasteStep + 1;
    const offset = {
      x: clipboard.originX + nextStep * PASTE_STEP_SIZE,
      y: clipboard.originY + nextStep * PASTE_STEP_SIZE,
    };
    const result = pasteCluster(circuit, clipboard, offset);
    const next = {
      nodes: [...circuit.nodes, ...result.pastedNodes],
      connections: [...circuit.connections, ...result.pastedConnections],
    };
    updateCircuit(next);
    selectMultipleNodes(result.pastedNodes.map((n) => n.id));
    setActionToast(`Pasted ${result.pastedNodes.length} node${result.pastedNodes.length !== 1 ? 's' : ''}.`);
    setPasteStep(nextStep);
    onCircuitMutated?.();
  }, [circuit, clipboard, pasteStep, updateCircuit, selectMultipleNodes, onCircuitMutated]);

  // CP-2: Duplicate selected nodes — offset from current selection bounding box,
  // chains naturally because duplicated nodes become the new selection
  const handleDuplicate = useCallback(() => {
    if (selection.nodes.size === 0) return;
    const cluster = serializeCluster(circuit, selection.nodes);
    if (cluster.nodes.length === 0) return;
    const offset = {
      x: cluster.originX + PASTE_STEP_SIZE,
      y: cluster.originY + PASTE_STEP_SIZE,
    };
    const result = pasteCluster(circuit, cluster, offset);
    const next = {
      nodes: [...circuit.nodes, ...result.pastedNodes],
      connections: [...circuit.connections, ...result.pastedConnections],
    };
    updateCircuit(next);
    selectMultipleNodes(result.pastedNodes.map((n) => n.id));
    const count = result.pastedNodes.length;
    setActionToast(`Duplicated ${count} node${count !== 1 ? 's' : ''}.`);
    onCircuitMutated?.();
  }, [circuit, selection.nodes, updateCircuit, selectMultipleNodes, onCircuitMutated]);

  useEffect(() => {
    if (!actionToast) return;
    const timeout = window.setTimeout(() => {
      setActionToast(null);
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [actionToast]);

  useEffect(() => {
    if (!diagnosticRouteRequest) return;
    if (diagnosticRouteRequest.mode !== 'design') return;
    if (!diagnosticRouteRequest.nodeId) return;
    setDiagnosticFilterNodeId(diagnosticRouteRequest.nodeId);
  }, [diagnosticRouteRequest]);

  useEffect(() => {
    const previous = previousWireCountRef.current;
    const current = editorCircuit.connections.length;
    if (current > previous) {
      setWireFeedback(null);
      setActionToast(previous === 0 ? 'First wire linked.' : 'Wire linked.');
    }
    previousWireCountRef.current = current;
  }, [editorCircuit.connections.length]);

  useEffect(() => {
    if (previousToolModeRef.current !== toolMode) {
      if (suppressNextToolModeWireFeedbackClearRef.current) {
        suppressNextToolModeWireFeedbackClearRef.current = false;
      } else {
        setWireFeedback(null);
      }
    }
    previousToolModeRef.current = toolMode;
  }, [toolMode]);

  const paletteQueryTerms = useMemo(() => tokenizePaletteQuery(paletteQuery), [paletteQuery]);
  const filteredPaletteByCategory = useMemo(() => {
    const all = [...PALETTE_ITEMS, ...COMPOSITE_PALETTE_ITEMS];
    const filtered = all.filter((item) =>
      matchesPaletteQuery(paletteQueryTerms, [
        item.title,
        item.type,
        item.category,
        item.subtitle,
        ...item.searchTerms,
      ])
    );
    return {
      logic: filtered.filter((item) => item.category === 'Logic'),
      sequential: filtered.filter((item) => item.category === 'Sequential'),
      io: filtered.filter((item) => item.category === 'IO'),
      components: filtered.filter((item) => item.category === 'Components'),
    };
  }, [paletteQueryTerms]);
  const filteredCustomComponents = useMemo(() => {
    if (!customComponentTypes || customComponentTypes.length === 0) return [];
    return customComponentTypes.filter((item) =>
      matchesPaletteQuery(paletteQueryTerms, [
        item.title,
        item.type,
        item.description,
        'custom',
        'component',
        'block',
      ])
    );
  }, [customComponentTypes, paletteQueryTerms]);
  const filteredMacros = useMemo(() => {
    if (macros.length === 0) return [];
    return macros.filter((macro) =>
      matchesPaletteQuery(paletteQueryTerms, [
        macro.name,
        macro.description,
        'macro',
        'saved block',
        ...macro.inputs.map((entry) => entry.label),
        ...macro.outputs.map((entry) => entry.label),
      ])
    );
  }, [macros, paletteQueryTerms]);
  const filteredBasysInputs = useMemo(
    () =>
      BASYS3_INPUT_ITEMS.filter((entry) =>
        matchesPaletteQuery(paletteQueryTerms, [
          entry.alias,
          entry.kind,
          'basys3',
          'board resource',
          describeBoardEntry(entry),
        ])
      ),
    [paletteQueryTerms]
  );
  const filteredBasysOutputs = useMemo(
    () =>
      BASYS3_OUTPUT_ITEMS.filter((entry) =>
        matchesPaletteQuery(paletteQueryTerms, [
          entry.alias,
          entry.kind,
          'basys3',
          'board resource',
          describeBoardEntry(entry),
          entry.kind === 'led' ? 'light' : undefined,
        ])
      ),
    [paletteQueryTerms]
  );
  const filteredBoardGroups = useMemo(
    () => groupBoardPaletteItems(filteredBasysInputs, filteredBasysOutputs),
    [filteredBasysInputs, filteredBasysOutputs]
  );
  const boardIoRowByAlias = useMemo(() => {
    const index = new Map<string, { nodeId: string }>();
    const nodeIds = new Set(
      (editorCircuit.nodes ?? [])
        .map((node) => normalizeAlias(node.id))
        .filter((value) => value.length > 0)
    );
    for (const row of ioRows) {
      const rowNodeId = normalizeAlias(row.nodeId);
      if (rowNodeId.length === 0 || !nodeIds.has(rowNodeId)) continue;
      const direction = row.direction === 'in' ? 'in' : 'out';
      const candidates = [row.pin, row.label, row.id]
        .map((value) => normalizeAlias(value))
        .filter((value) => value.length > 0);
      for (const token of candidates) {
        index.set(`${direction}:${token}`, { nodeId: row.nodeId });
      }
    }
    return index;
  }, [editorCircuit.nodes, ioRows]);
  const isBoardAliasPlaced = useCallback(
    (entry: BoardIoPaletteItem) =>
      boardIoRowByAlias.has(`${entry.direction}:${normalizeAlias(entry.alias)}`),
    [boardIoRowByAlias]
  );
  const resolveCanvasPlacementPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasHostRef.current) return null;
      const rect = canvasHostRef.current.getBoundingClientRect();
      const worldPoint = {
        x: (clientX - rect.left - camera.x) / camera.zoom,
        y: (clientY - rect.top - camera.y) / camera.zoom,
      };
      return findSmartSpawnPosition(editorCircuit.nodes as Node[], worldPoint);
    },
    [camera.x, camera.y, camera.zoom, editorCircuit.nodes]
  );

  const spawnAtCanvasCenter = useCallback(
    (nodeType: string, extraOffset: { x: number; y: number } = { x: 0, y: 0 }) => {
      const center = {
        x: (canvasSize.width / 2 - camera.x) / camera.zoom,
        y: (canvasSize.height / 2 - camera.y) / camera.zoom,
      };
      const basePosition = findSmartSpawnPosition(editorCircuit.nodes as Node[], center);
      const position = {
        x: basePosition.x + extraOffset.x,
        y: basePosition.y + extraOffset.y,
      };
      if (onRuntimeAddNode) {
        onRuntimeAddNode(nodeType, position);
      } else {
        addNode(nodeType, position);
        onCircuitMutated?.();
      }
      setActionToast(`${nodeTypeLabel(nodeType)} placed.`);
    },
    [
      addNode,
      camera.x,
      camera.y,
      camera.zoom,
      canvasSize.height,
      canvasSize.width,
      editorCircuit.nodes,
      onCircuitMutated,
      onRuntimeAddNode,
    ]
  );

  const beginPalettePlacement = useCallback(
    (placement: PendingPlacementState) => {
      if (wireStartPort) {
        endWire();
      } else if (toolMode !== 'select') {
        setToolMode('select');
      }
      if (activeInsertionMacro) {
        setActiveMacroInsertionId(null);
      }
      setWireFeedback(null);
      setPendingPlacement(placement);
      setInteractionMode('placing');
    },
    [activeInsertionMacro, endWire, setInteractionMode, setToolMode, toolMode, wireStartPort]
  );

  const beginNodePlacement = useCallback(
    (nodeType: string) => {
      beginPalettePlacement({
        kind: 'node',
        label: nodeTypeLabel(nodeType),
        nodeType,
      });
    },
    [beginPalettePlacement]
  );

  const beginBoardIoPlacement = useCallback(
    (entry: BoardIoPaletteItem) => {
      const aliasKey = `${entry.direction}:${normalizeAlias(entry.alias)}`;
      const existing = boardIoRowByAlias.get(aliasKey);
      if (existing) {
        if (existing.nodeId) {
          setToolMode('select');
          selectMultipleNodes([existing.nodeId], false);
        }
        setActionToast(`${entry.alias} already exists on canvas.`);
        return;
      }
      beginPalettePlacement({
        kind: 'board-io',
        label: entry.alias,
        boardIoEntry: entry,
      });
    },
    [
      beginPalettePlacement,
      boardIoRowByAlias,
      selectMultipleNodes,
      setToolMode,
    ]
  );

  const addIoPins = useCallback(() => {
    if (onRuntimeAddIo) {
      const center = {
        x: (canvasSize.width / 2 - camera.x) / camera.zoom,
        y: (canvasSize.height / 2 - camera.y) / camera.zoom,
      };
      const basePosition = findSmartSpawnPosition(editorCircuit.nodes as Node[], center);
      onRuntimeAddIo('input', { x: basePosition.x - 120, y: basePosition.y - 24 });
      onRuntimeAddIo('output', { x: basePosition.x + 120, y: basePosition.y - 24 });
    } else {
      spawnAtCanvasCenter('INPUT', { x: -120, y: -24 });
      spawnAtCanvasCenter('OUTPUT', { x: 120, y: -24 });
    }
    setActionToast('Added starter IO pins.');
  }, [camera.x, camera.y, camera.zoom, canvasSize.height, canvasSize.width, editorCircuit.nodes, onCircuitMutated, onRuntimeAddIo, spawnAtCanvasCenter]);

  const addAndGateStarter = useCallback(() => {
    if (onRuntimeAddNode && onRuntimeConnect) {
      const center = {
        x: (canvasSize.width / 2 - camera.x) / camera.zoom,
        y: (canvasSize.height / 2 - camera.y) / camera.zoom,
      };
      const basePosition = findSmartSpawnPosition(editorCircuit.nodes as Node[], center);
      const [inputAId, inputBId, andId, outputId] = predictNextNodeIds(editorCircuit, 4);

      onRuntimeAddNode('INPUT', { x: basePosition.x - 170, y: basePosition.y - 72 });
      onRuntimeAddNode('INPUT', { x: basePosition.x - 170, y: basePosition.y + 24 });
      onRuntimeAddNode('AND', { x: basePosition.x, y: basePosition.y - 24 });
      onRuntimeAddNode('OUTPUT', { x: basePosition.x + 170, y: basePosition.y - 24 });

      onRuntimeConnect({ fromNodeId: inputAId, fromPort: 'out', toNodeId: andId, toPort: 'a' });
      onRuntimeConnect({ fromNodeId: inputBId, fromPort: 'out', toNodeId: andId, toPort: 'b' });
      onRuntimeConnect({ fromNodeId: andId, fromPort: 'out', toNodeId: outputId, toPort: 'in' });
    } else {
      spawnAtCanvasCenter('INPUT', { x: -170, y: -72 });
      spawnAtCanvasCenter('INPUT', { x: -170, y: 24 });
      spawnAtCanvasCenter('AND', { x: 0, y: -24 });
      spawnAtCanvasCenter('OUTPUT', { x: 170, y: -24 });
    }
    setActionToast('Added AND starter circuit.');
  }, [
    camera.x,
    camera.y,
    camera.zoom,
    canvasSize.height,
    canvasSize.width,
    editorCircuit,
    onRuntimeAddNode,
    onRuntimeConnect,
    spawnAtCanvasCenter,
  ]);

  const cancelPendingPlacement = useCallback(
    (reason: 'cancel' | 'escape' | 'tool') => {
      if (!pendingPlacement) return;
      setPendingPlacement(null);
      if (interactionMode === 'placing') {
        setInteractionMode('idle');
      }
      if (reason === 'escape') {
        setActionToast(`Cancelled placing ${pendingPlacement.label} (Esc).`);
      } else if (reason === 'cancel') {
        setActionToast(`Cancelled placing ${pendingPlacement.label}.`);
      }
    },
    [interactionMode, pendingPlacement, setInteractionMode]
  );

  const cancelActivePlacement = useCallback(
    (reason: 'cancel' | 'escape' | 'tool') => {
      if (activeInsertionMacro) {
        setActiveMacroInsertionId(null);
        if (interactionMode === 'placing') {
          setInteractionMode('idle');
        }
        if (reason === 'escape') {
          setActionToast(`Cancelled placing ${activeInsertionMacro.name} (Esc).`);
        } else if (reason === 'cancel') {
          setActionToast(`Cancelled placing ${activeInsertionMacro.name}.`);
        }
        return;
      }
      cancelPendingPlacement(reason);
    },
    [activeInsertionMacro, cancelPendingPlacement, interactionMode, setInteractionMode]
  );

  const commitPendingPlacement = useCallback(
    (clientX: number, clientY: number) => {
      if (!pendingPlacement) return;
      const position = resolveCanvasPlacementPosition(clientX, clientY);
      if (!position) return;

      const nextNodeId = predictNextNodeIds(editorCircuit, 1)[0] ?? null;
      if (pendingPlacement.kind === 'node' && pendingPlacement.nodeType) {
        if (onRuntimeAddNode) {
          onRuntimeAddNode(pendingPlacement.nodeType, position);
        } else {
          addNode(pendingPlacement.nodeType, position);
          onCircuitMutated?.();
        }
        setActionToast(`${pendingPlacement.label} placed.`);
      } else if (pendingPlacement.kind === 'board-io' && pendingPlacement.boardIoEntry) {
        const entry = pendingPlacement.boardIoEntry;
        if (onRuntimeAddBoardIo) {
          onRuntimeAddBoardIo({
            alias: entry.alias,
            direction: entry.direction,
            kind: entry.kind,
            position,
          });
        } else if (onRuntimeAddIo) {
          onRuntimeAddIo(entry.direction === 'in' ? 'input' : 'output', position);
        } else {
          addNode(entry.direction === 'in' ? 'INPUT' : 'OUTPUT', position);
          onCircuitMutated?.();
        }
        setActionToast(`Added ${entry.alias} to canvas.`);
      }

      setWireFeedback(null);
      setPendingPlacement(null);
      if (interactionMode === 'placing') {
        setInteractionMode('idle');
      }
      if (nextNodeId) {
        queueMicrotask(() => {
          selectMultipleNodes([nextNodeId], false);
        });
      }
    },
    [
      addNode,
      editorCircuit,
      interactionMode,
      onCircuitMutated,
      onRuntimeAddBoardIo,
      onRuntimeAddIo,
      onRuntimeAddNode,
      pendingPlacement,
      resolveCanvasPlacementPosition,
      selectMultipleNodes,
      setInteractionMode,
    ]
  );

  const setSelectMode = useCallback(() => {
    cancelActivePlacement('tool');
    setToolMode('select');
    setActionToast('Select mode active.');
  }, [cancelActivePlacement, setToolMode]);

  const setWireMode = useCallback(() => {
    cancelActivePlacement('tool');
    setToolMode('wire');
    setActionToast('Wire mode active.');
  }, [cancelActivePlacement, setToolMode]);

  useEffect(() => {
    if (isPlacementMode && interactionMode === 'idle') {
      setInteractionMode('placing');
      return;
    }
    if (!isPlacementMode && interactionMode === 'placing') {
      setInteractionMode('idle');
    }
  }, [interactionMode, isPlacementMode, setInteractionMode]);

  useEffect(() => {
    if (!isPlacementMode) return;
    if (toolMode !== 'wire') return;
    cancelActivePlacement('tool');
  }, [cancelActivePlacement, isPlacementMode, toolMode]);

  const handleCircuitChange = useCallback(
    (nextCircuit: Circuit) => {
      updateCircuit(normalizeCircuitForCanvas(nextCircuit), { skipHistory: false, enforceLimits: true });
      onCircuitMutated?.();
      lastTracedPortRef.current = null;
      setTraceState(null);
      setWireContextMenu(null);
      setWireFeedback(null);
    },
    [onCircuitMutated, updateCircuit]
  );

  const handleUndo = useCallback(() => {
    undo();
    onCircuitMutated?.();
  }, [onCircuitMutated, undo]);

  const handleRedo = useCallback(() => {
    redo();
    onCircuitMutated?.();
  }, [onCircuitMutated, redo]);

  const fitToCircuit = useCallback(() => {
    if (editorCircuit.nodes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of editorCircuit.nodes) {
      const px = node.position?.x ?? node.x ?? 0;
      const py = node.position?.y ?? node.y ?? 0;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    if (!Number.isFinite(minX)) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const spanX = Math.max(96, maxX - minX);
    const spanY = Math.max(96, maxY - minY);
    const padding = Math.max(56, Math.min(140, Math.round(Math.max(spanX, spanY) * 0.14)));
    const boundsWidth = Math.max(1, spanX + padding * 2);
    const boundsHeight = Math.max(1, spanY + padding * 2);
    const zoomX = (canvasSize.width * 0.9) / boundsWidth;
    const zoomY = (canvasSize.height * 0.9) / boundsHeight;
    const nextZoom = snapFitZoom(Math.max(0.55, Math.min(2.4, Math.min(zoomX, zoomY))));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setCamera({
      x: canvasSize.width / 2 - centerX * nextZoom,
      y: canvasSize.height / 2 - centerY * nextZoom,
      zoom: nextZoom,
    });
  }, [canvasSize.height, canvasSize.width, editorCircuit.nodes, setCamera]);

  const fitToCircuitRef = useRef(fitToCircuit);
  useEffect(() => { fitToCircuitRef.current = fitToCircuit; }, [fitToCircuit]);

  const zoomIn = useCallback(() => {
    zoomCamera(120, canvasSize.width / 2, canvasSize.height / 2);
  }, [canvasSize.height, canvasSize.width, zoomCamera]);

  const zoomOut = useCallback(() => {
    zoomCamera(-120, canvasSize.width / 2, canvasSize.height / 2);
  }, [canvasSize.height, canvasSize.width, zoomCamera]);

  const setZoomToPreset = useCallback((targetZoom: number) => {
    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;
    const worldX = (cx - camera.x) / camera.zoom;
    const worldY = (cy - camera.y) / camera.zoom;
    setCamera({
      x: cx - worldX * targetZoom,
      y: cy - worldY * targetZoom,
      zoom: targetZoom,
    });
  }, [camera.x, camera.y, camera.zoom, canvasSize.width, canvasSize.height, setCamera]);

  const resetView = useCallback(() => {
    if (editorCircuit.nodes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of editorCircuit.nodes) {
      const px = node.position?.x ?? node.x ?? 0;
      const py = node.position?.y ?? node.y ?? 0;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    if (!Number.isFinite(minX)) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setCamera({
      x: canvasSize.width / 2 - centerX,
      y: canvasSize.height / 2 - centerY,
      zoom: 1,
    });
  }, [canvasSize.height, canvasSize.width, editorCircuit.nodes, setCamera]);

  const centerSelection = useCallback(() => {
    const selectedNodes = editorCircuit.nodes.filter((node) => selection.nodes.has(node.id));
    if (selectedNodes.length === 0) {
      setActionToast('Select nodes first to center the view.');
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of selectedNodes) {
      const px = node.position?.x ?? node.x ?? 0;
      const py = node.position?.y ?? node.y ?? 0;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    if (!Number.isFinite(minX)) return;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const targetZoom = Math.max(0.85, camera.zoom);
    setCamera({
      x: canvasSize.width / 2 - centerX * targetZoom,
      y: canvasSize.height / 2 - centerY * targetZoom,
      zoom: targetZoom,
    });
    setActionToast(
      selectedNodes.length === 1
        ? 'Centered selected node.'
        : `Centered ${selectedNodes.length} selected nodes.`
    );
  }, [camera.zoom, canvasSize.height, canvasSize.width, editorCircuit.nodes, selection.nodes, setCamera]);

  const focusNodeOnCanvas = useCallback((nodeId: string) => {
    const target = editorCircuit.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const px = target.position?.x ?? target.x ?? 0;
    const py = target.position?.y ?? target.y ?? 0;
    const screenX = px * camera.zoom + camera.x;
    const screenY = py * camera.zoom + camera.y;
    const isVisible =
      screenX >= 96 &&
      screenX <= canvasSize.width - 96 &&
      screenY >= 96 &&
      screenY <= canvasSize.height - 96;
    if (isVisible) return;
    const targetZoom = Math.max(0.95, camera.zoom);
    setCamera({
      x: canvasSize.width / 2 - px * targetZoom,
      y: canvasSize.height / 2 - py * targetZoom,
      zoom: targetZoom,
    });
  }, [camera.x, camera.y, camera.zoom, canvasSize.height, canvasSize.width, editorCircuit.nodes, setCamera]);

  useEffect(() => {
    if (editorCircuit.nodes.length === 0) return;
    if (hasAutoFitRef.current) return;
    const cameraIsDefault =
      Math.abs(camera.x) < 0.001 &&
      Math.abs(camera.y) < 0.001 &&
      Math.abs(camera.zoom - 1) < 0.001;
    if (!cameraIsDefault) {
      hasAutoFitRef.current = true;
      return;
    }
    hasAutoFitRef.current = true;
    fitToCircuit();
  }, [camera.x, camera.y, camera.zoom, editorCircuit.nodes.length, fitToCircuit]);

  useEffect(() => {
    if (editorCircuit.nodes.length === 0) {
      hasAutoFitRef.current = false;
    }
  }, [editorCircuit.nodes.length]);

  useEffect(() => {
    if (!viewportSeed) return;
    if (lastViewportSeedRef.current === viewportSeed) return;
    lastViewportSeedRef.current = viewportSeed;
    setHasInteracted(false);
    hasAutoFitRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      fitToCircuitRef.current();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSeed]);

  const handleSignalsUpdated = useCallback(() => {
    // Runtime simulation state is authoritative. Canvas-local ticks are ignored.
  }, []);

  const handleInputToggled = useCallback(
    (nodeId: string, _portName: string, newValue: 0 | 1) => {
      queueDesignDebugToggleSample(nodeId, newValue, 'canvas');
      onRuntimeSimSetInput?.(nodeId, newValue);
      setActionToast(`Updated ${nodeId} = ${newValue}.`);
    },
    [onRuntimeSimSetInput, queueDesignDebugToggleSample]
  );

  const startSimulation = useCallback(() => {
    onRuntimeSimRun?.();
  }, [onRuntimeSimRun]);

  const pauseSimulation = useCallback(() => {
    onRuntimeSimPause?.();
  }, [onRuntimeSimPause]);

  const stepSimulation = useCallback(() => {
    onRuntimeSimStep?.();
  }, [onRuntimeSimStep]);

  const resetSimulation = useCallback(() => {
    onRuntimeSimReset?.();
  }, [onRuntimeSimReset]);

  const selectedNodeIds = useMemo(() => Array.from(selection.nodes).slice(0, 5), [selection.nodes]);
  const selectedNodeIdsAll = useMemo(() => Array.from(selection.nodes), [selection.nodes]);
  const selectedWireIds = useMemo(() => Array.from(selection.wires).slice(0, 5), [selection.wires]);
  const suggestedMacroName = useMemo(
    () => (selectedNodeIdsAll.length > 0 ? `Macro_${selectedNodeIdsAll.length}` : 'My Macro'),
    [selectedNodeIdsAll.length]
  );
  const selectedNode = useMemo(
    () =>
      selectedNodeIds.length > 0 ? editorCircuit.nodes.find((node) => node.id === selectedNodeIds[0]) : undefined,
    [editorCircuit.nodes, selectedNodeIds]
  );

  // ── N-1: resolve a raw connection endpoint to { nodeId, portName } ──────────
  const resolveConnectionEndpoint = useCallback(
    (raw: import('@redbyte/rb-logic-core').Connection['from'] | import('@redbyte/rb-logic-core').Connection['to']): { nodeId: string; portName: string } => {
      if (typeof raw === 'string') return { nodeId: raw, portName: 'out' };
      return {
        nodeId: (raw as { nodeId: string }).nodeId,
        portName:
          (raw as { portName?: string }).portName ??
          (raw as { port?: string }).port ??
          'out',
      };
    },
    []
  );

  // ── N-1: build a CompositeNodeDef from the current multi-node selection ─────
  const buildCompositeDefFromSelection = useCallback(
    (name: string): CompositeNodeDef | null => {
      if (selectedNodeIdsAll.length < 2) return null;

      const selectedSet = new Set(selectedNodeIdsAll);

      const subcircuitNodes = editorCircuit.nodes.filter((n) => selectedSet.has(n.id));
      const subcircuitConnections = editorCircuit.connections.filter((conn) => {
        const from = resolveConnectionEndpoint(conn.from);
        const to = resolveConnectionEndpoint(conn.to);
        return selectedSet.has(from.nodeId) && selectedSet.has(to.nodeId);
      });

      // Incoming: from outside → to inside (become input ports)
      const incomingConns = editorCircuit.connections.filter((conn) => {
        const from = resolveConnectionEndpoint(conn.from);
        const to = resolveConnectionEndpoint(conn.to);
        return !selectedSet.has(from.nodeId) && selectedSet.has(to.nodeId);
      });

      // Outgoing: from inside → to outside (become output ports)
      const outgoingConns = editorCircuit.connections.filter((conn) => {
        const from = resolveConnectionEndpoint(conn.from);
        const to = resolveConnectionEndpoint(conn.to);
        return selectedSet.has(from.nodeId) && !selectedSet.has(to.nodeId);
      });

      // Build input mapping: port name → "toNodeId.toPortName"
      const inputMapping: Record<string, string> = {};
      incomingConns.forEach((conn, i) => {
        const to = resolveConnectionEndpoint(conn.to);
        const portName = to.portName !== 'out' ? to.portName : `in${i}`;
        inputMapping[portName === 'isOn' ? `in${i}` : portName] = `${to.nodeId}.${to.portName}`;
      });

      // If no incoming connections, use INPUT/Switch nodes in selection
      if (Object.keys(inputMapping).length === 0) {
        subcircuitNodes
          .filter((n) => n.type === 'INPUT' || n.type === 'Switch')
          .forEach((n, i) => {
            const label = (n.config as Record<string, unknown>)?.['label'] as string | undefined ?? `in${i}`;
            inputMapping[label] = `${n.id}.isOn`;
          });
      }

      // Build output mapping: port name → "fromNodeId.fromPortName"
      const outputMapping: Record<string, string> = {};
      outgoingConns.forEach((conn, i) => {
        const from = resolveConnectionEndpoint(conn.from);
        const portName = from.portName !== 'isOn' ? from.portName : `out${i}`;
        outputMapping[portName] = `${from.nodeId}.${from.portName}`;
      });

      // If no outgoing connections, use OUTPUT/Lamp nodes in selection
      if (Object.keys(outputMapping).length === 0) {
        subcircuitNodes
          .filter((n) => n.type === 'OUTPUT' || n.type === 'Lamp')
          .forEach((n, i) => {
            const label = (n.config as Record<string, unknown>)?.['label'] as string | undefined ?? `out${i}`;
            outputMapping[label] = `${n.id}.out`;
          });
      }

      return {
        name,
        description: `Custom component with ${subcircuitNodes.length} gates`,
        subcircuit: { nodes: subcircuitNodes, connections: subcircuitConnections },
        inputMapping,
        outputMapping,
      };
    },
    [selectedNodeIdsAll, editorCircuit, resolveConnectionEndpoint]
  );

  const handleSaveComponent = useCallback(() => {
    const trimmed = saveComponentName.trim();
    if (!trimmed || !onSaveAsComponent) return;
    const def = buildCompositeDefFromSelection(trimmed);
    if (!def) return;
    onSaveAsComponent(def);
    setSaveComponentOpen(false);
    setSaveComponentName('');
    // Show "Saved" toast for 3 seconds
    setSavedComponentToast(trimmed);
    if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
    savedToastTimerRef.current = setTimeout(() => setSavedComponentToast(null), 3000);
  }, [saveComponentName, onSaveAsComponent, buildCompositeDefFromSelection]);

  const openMacroDialog = useCallback(() => {
    const selectedIds = new Set(selectedNodeIdsAll);
    setMacroDialogState({
      analysis: analyzeMacroBoundary(circuit, selectedIds),
      selectedNodeIds: selectedIds,
      suggestedName: suggestedMacroName,
    });
  }, [circuit, selectedNodeIdsAll, suggestedMacroName]);

  const handleSaveMacro = useCallback(
    (input: {
      name: string;
      description?: string;
      selectedInputIds: string[];
      selectedOutputIds: string[];
    }) => {
      if (!onSaveMacro || !macroDialogState) return;
      try {
        const macro = onSaveMacro({
          selectedNodeIds: macroDialogState.selectedNodeIds,
          name: input.name,
          description: input.description,
          selectedInputIds: input.selectedInputIds,
          selectedOutputIds: input.selectedOutputIds,
        });
        if (!macro) return;
        clearSelection();
        setMacroDialogState(null);
        setActionToast(`Saved macro "${macro.name}".`);
      } catch (error) {
        setActionToast(error instanceof Error ? error.message : 'Failed to save macro.');
      }
    },
    [clearSelection, macroDialogState, onSaveMacro]
  );

  const handleSelectMacro = useCallback(
    (macroId: string) => {
      if (!onInstantiateMacro) return;
      if (wireStartPort) {
        endWire();
      } else if (toolMode !== 'select') {
        setToolMode('select');
      }
      setPendingPlacement(null);
      setWireFeedback(null);
      setActiveMacroInsertionId(macroId);
      setInteractionMode('placing');
    },
    [endWire, onInstantiateMacro, setInteractionMode, setToolMode, toolMode, wireStartPort]
  );

  const handleDeleteMacro = useCallback(
    (macroId: string) => {
      onDeleteMacro?.(macroId);
      setActiveMacroInsertionId((previous) => (previous === macroId ? null : previous));
      setActionToast('Deleted macro from library.');
    },
    [onDeleteMacro]
  );

  const cancelMacroPlacement = useCallback(
    (reason: 'cancel' | 'escape') => {
      if (!activeInsertionMacro) return;
      setActiveMacroInsertionId(null);
      if (interactionMode === 'placing') {
        setInteractionMode('idle');
      }
      setActionToast(
        reason === 'escape'
          ? `Cancelled placing ${activeInsertionMacro.name} (Esc).`
          : `Cancelled placing ${activeInsertionMacro.name}.`
      );
    },
    [activeInsertionMacro, interactionMode, setInteractionMode]
  );

  const placeMacroAtClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!activeInsertionMacro || !onInstantiateMacro || !canvasHostRef.current) return;
      const rect = canvasHostRef.current.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const position = {
        x: (localX - camera.x) / camera.zoom,
        y: (localY - camera.y) / camera.zoom,
      };
      const result = onInstantiateMacro(activeInsertionMacro.id, position);
      if (result?.insertedNodeIds.length) {
        selectMultipleNodes(result.insertedNodeIds);
      }
      if (result) {
        setActionToast(`Placed macro: ${result.instanceLabel}.`);
        // Do NOT call onCircuitMutated here. instantiateMacro already writes the
        // new circuit (with macro nodes), resets sim, and marks dirtySinceVerify/
        // dirtySinceExport inside projectRuntime. onCircuitMutated would read
        // circuitStore, which has not yet been synced from projectRuntime (that
        // sync is a React effect — async), so it would overwrite projectRuntime
        // with the pre-insertion circuit, silently dropping the macro.
      }
      setActiveMacroInsertionId(null);
      if (interactionMode === 'placing') {
        setInteractionMode('idle');
      }
    },
    [
      activeInsertionMacro,
      interactionMode,
      camera.x,
      camera.y,
      camera.zoom,
      onInstantiateMacro,
      selectMultipleNodes,
      setInteractionMode,
    ]
  );

  const handleInsertMacroOnCanvas = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      placeMacroAtClientPoint(event.clientX, event.clientY);
    },
    [placeMacroAtClientPoint]
  );

  const handleMacroInsertionOverlayKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (!canvasHostRef.current) return;
      const rect = canvasHostRef.current.getBoundingClientRect();
      placeMacroAtClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [placeMacroAtClientPoint]
  );

  const handleCanvasPlacementClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (isCanvasPlacementBlocked(target)) return;
      if (activeInsertionMacro) {
        event.preventDefault();
        event.stopPropagation();
        placeMacroAtClientPoint(event.clientX, event.clientY);
        return;
      }
      if (!pendingPlacement) return;
      event.preventDefault();
      event.stopPropagation();
      commitPendingPlacement(event.clientX, event.clientY);
    },
    [activeInsertionMacro, commitPendingPlacement, pendingPlacement, placeMacroAtClientPoint]
  );

  useEffect(() => {
    if (!selectedNode) return;
    const row = ioRowByNodeId.get(selectedNode.id) ?? ioRowByNodeId.get(`${selectedNode.id}.out`);
    if (!row) return;
    const swM = /^SW(\d+)$/i.exec(row.label);
    if (swM) { setActiveBoardSignal({ type: 'sw', index: parseInt(swM[1], 10) }); return; }
    const ldM = /^LD(\d+)$/i.exec(row.label);
    if (ldM) { setActiveBoardSignal({ type: 'ld', index: parseInt(ldM[1], 10) }); return; }
  }, [selectedNode?.id, ioRowByNodeId, setActiveBoardSignal]);
  const selectedNodePins = useMemo(
    () => deriveNodePins(selectedNode, editorCircuit),
    [editorCircuit, selectedNode]
  );
  const selectedNodeSignals = useMemo(() => {
    if (!selectedNode) return null;
    const pins = deriveNodePins(selectedNode, editorCircuit);
    return pins.map((port) => ({
      port,
      value: liveSignals.get(`${selectedNode.id}.${port}`) ?? null,
    }));
  }, [selectedNode, editorCircuit, liveSignals]);
  const selectedNodeProperties = useMemo(
    () => (selectedNode ? describeNodeProperties(selectedNode) : []),
    [selectedNode]
  );
  const selectedTypeSummary = useMemo(() => summarizeSelectionTypes(selection.nodes, editorCircuit), [editorCircuit, selection.nodes]);
  const compilerDiagnostics = compilerStatus?.diagnostics ?? [];
  const diagnosticsByNode = useMemo(() => {
    const index = new Map<string, IdeDiagnostic[]>();
    for (const diagnostic of compilerDiagnostics) {
      const nodeIds = resolveDiagnosticNodeIds(diagnostic, editorCircuit);
      for (const nodeId of nodeIds) {
        const existing = index.get(nodeId);
        if (existing) {
          existing.push(diagnostic);
        } else {
          index.set(nodeId, [diagnostic]);
        }
      }
    }
    return index;
  }, [compilerDiagnostics, editorCircuit]);
  const nodeDiagnosticBadges = useMemo(() => {
    const badges: Record<string, { error: number; warn: number; total: number }> = {};
    for (const [nodeId, diagnostics] of diagnosticsByNode.entries()) {
      const error = diagnostics.filter((entry) => entry.severity === 'error').length;
      const warn = diagnostics.filter((entry) => entry.severity === 'warn').length;
      badges[nodeId] = {
        error,
        warn,
        total: diagnostics.length,
      };
    }
    return badges;
  }, [diagnosticsByNode]);

  const designIssueMap = useMemo(() => computeDesignIssues(editorCircuit), [editorCircuit]);
  const authoringIssues = useMemo(
    () => [...designIssueMap.all].sort(compareDesignIssues),
    [designIssueMap]
  );
  const authoringIssueCounts = useMemo(() => {
    let errorCount = 0;
    let warningCount = 0;
    for (const issue of authoringIssues) {
      if (issue.severity === 'error') {
        errorCount += 1;
      } else {
        warningCount += 1;
      }
    }
    return {
      errorCount,
      warningCount,
      topIssues: authoringIssues.slice(0, 3),
    };
  }, [authoringIssues]);

  // Phase 3 + Batch 1: real-time canvas issue glow — O(n+e), runs once per circuit mutation.
  const nodeIssueSeverities = useMemo(() => {
    const result = new Map<string, 'error' | 'warn'>();
    for (const nodeId of designIssueMap.byNode.keys()) {
      const sev = nodeIssueSeverity(nodeId, designIssueMap);
      if (sev) result.set(nodeId, sev);
    }
    return result;
  }, [designIssueMap]);
  const issuePortSeverities = useMemo(() => {
    const result = new Map<string, 'error' | 'warn'>();
    for (const [portKey, issues] of designIssueMap.byPort.entries()) {
      const dotIndex = portKey.indexOf('.');
      if (dotIndex <= 0 || dotIndex >= portKey.length - 1) continue;
      const nodeId = portKey.slice(0, dotIndex);
      const portName = portKey.slice(dotIndex + 1);
      const severity = issues.some((issue) => issue.severity === 'error') ? 'error' : 'warn';
      result.set(`${nodeId}:${portName}`, severity);
    }
    return result;
  }, [designIssueMap]);

  const selectedNodeDiagnostics = useMemo(
    () => (selectedNode ? diagnosticsByNode.get(selectedNode.id) ?? [] : []),
    [diagnosticsByNode, selectedNode]
  );
  const diagnosticsDrawerRows = useMemo(() => {
    if (diagnosticFilterNodeId) {
      return diagnosticsByNode.get(diagnosticFilterNodeId) ?? [];
    }
    return compilerDiagnostics;
  }, [compilerDiagnostics, diagnosticFilterNodeId, diagnosticsByNode]);
  const compilerErrorCount = compilerStatus?.errorCount ?? 0;
  const compilerWarningCount = compilerStatus?.warningCount ?? 0;
  const dirtySinceVerify = compilerStatus?.dirtySinceVerify ?? true;
  const dirtySinceExport = compilerStatus?.dirtySinceExport ?? true;
  const irHash = useMemo(() => digestValue(buildCircuitIrHashPayload(editorCircuit)), [editorCircuit]);
  const hasSelection = selection.nodes.size > 0 || selection.wires.size > 0;
  useEffect(() => {
    if (previousHasSelectionRef.current && !hasSelection) {
      setWireFeedback(null);
    }
    previousHasSelectionRef.current = hasSelection;
  }, [hasSelection]);
  const activeModeLabel = isPlacementMode ? 'Placement Mode' : toolMode === 'wire' ? 'Wire Mode' : 'Select Mode';
  const zoomPercent = Math.round(camera.zoom * 100);
  const effectiveInteractionMode = isPlacementMode && interactionMode === 'idle' ? 'placing' : interactionMode;
  const interactionLabel =
    effectiveInteractionMode === 'boxSelecting'
      ? 'Marquee Select'
      : effectiveInteractionMode === 'panning'
        ? 'Panning'
        : isPlacementMode
          ? 'Placement'
        : effectiveInteractionMode === 'draggingNode'
          ? 'Dragging Node'
          : effectiveInteractionMode === 'wiring'
            ? 'Wiring'
            : 'Idle';
  const toolHint =
    effectiveInteractionMode === 'boxSelecting'
      ? 'Drag to marquee-select multiple nodes. Hold Ctrl/Cmd or Shift to add to selection.'
      : isPlacementMode && placementModeLabel
        ? `Click empty canvas to place ${placementModeLabel}. Esc cancels.`
      : toolMode === 'wire'
        ? wireStartPort
          ? 'Hover valid sinks in green, then click to connect. Esc cancels the wire.'
          : 'Start Wire (W), click a source pin, then click a valid sink pin.'
        : 'Click a node to inspect it. Drag to reposition.';
  const handleNodeDiagnosticBadgeClick = useCallback(
    (nodeId: string) => {
      setToolMode('select');
      selectMultipleNodes([nodeId], false);
      setDiagnosticFilterNodeId((previous) => (previous === nodeId ? null : nodeId));
    },
    [selectMultipleNodes, setToolMode]
  );
  const clearDiagnosticFilter = useCallback(() => {
    setDiagnosticFilterNodeId(null);
  }, []);
  const focusDesignIssue = useCallback((issue: DesignIssue) => {
    const nodeId = issue.focusTarget.nodeId;
    const portKey = issue.focusTarget.portKey;
    selectMultipleNodes([nodeId], false);
    if (portKey) {
      const signalKey = `${nodeId}.${portKey}`;
      setFocusedIssueSignalKey(signalKey);
      onRuntimeSimSetSelectedSignal?.(signalKey);
    }
    focusNodeOnCanvas(nodeId);
  }, [focusNodeOnCanvas, onRuntimeSimSetSelectedSignal, selectMultipleNodes]);

  // A-3/A-4: Node label editor callbacks
  const commitNodeLabel = useCallback(() => {
    if (!editingLabelNodeId) return;
    const trimmed = labelDraft.trim();
    updateNode(editingLabelNodeId, { label: trimmed.length > 0 ? trimmed : undefined });
    onCircuitMutated?.();
    setEditingLabelNodeId(null);
    setLabelDraft('');
  }, [editingLabelNodeId, labelDraft, updateNode, onCircuitMutated]);

  const cancelNodeLabel = useCallback(() => {
    setEditingLabelNodeId(null);
    setLabelDraft('');
  }, []);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitNodeLabel(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelNodeLabel(); }
  }, [commitNodeLabel, cancelNodeLabel]);
  const liveIoSignals = useMemo(() => {
    const inputRows = editorCircuit.nodes
      .filter((node) => node.type === 'INPUT' || node.type === 'Switch')
      .slice(0, 4)
      .map((node) => {
        const ioPresentation = resolveNodeIoPresentation(node, ioRowByNodeId.get(node.id));
        return {
          id: node.id,
          label: ioPresentation.label ?? `${node.type} ${node.id}`,
          pinAlias: ioPresentation.pinAlias,
          value: liveSignals.get(`${node.id}.out`) ?? 0,
          signalKey: `${node.id}.out`,
          kind: 'input' as const,
        };
      });
    const outputRows = editorCircuit.nodes
      .filter((node) => node.type === 'OUTPUT' || node.type === 'Lamp')
      .slice(0, 4)
      .map((node) => {
        const ioPresentation = resolveNodeIoPresentation(node, ioRowByNodeId.get(node.id));
        return {
          id: node.id,
          label: ioPresentation.label ?? `${node.type} ${node.id}`,
          pinAlias: ioPresentation.pinAlias,
          value: liveSignals.get(`${node.id}.in`) ?? liveSignals.get(`${node.id}.out`) ?? 0,
          signalKey: liveSignals.has(`${node.id}.in`) ? `${node.id}.in` : `${node.id}.out`,
          kind: 'output' as const,
        };
      });
    return { inputRows, outputRows };
  }, [editorCircuit.nodes, ioRowByNodeId, liveSignals]);
  const simulationStory = useMemo(
    () => describeSimulationStory(liveIoSignals.inputRows, liveIoSignals.outputRows, runtimeSim.trace, simRunning),
    [liveIoSignals.inputRows, liveIoSignals.outputRows, runtimeSim.trace, simRunning]
  );
  const activeDebugContext = useMemo(
    () =>
      externalDebugTick != null && externalDebugContext?.tick === externalDebugTick
        ? externalDebugContext
        : null,
    [externalDebugContext, externalDebugTick]
  );
  const debugInputSummary = useMemo(
    () => formatVerifyDebugInputSnapshot(activeDebugContext?.inputSnapshot ?? []),
    [activeDebugContext]
  );
  const activeSimulationSummary = activeDebugContext
    ? describeVerifyDebugSummary(activeDebugContext)
    : simulationStory.summary;
  const ioPresentationMap = useMemo(() => {
    const map: Record<string, NodeIoPresentation> = {};
    for (const node of editorCircuit.nodes) {
      if (
        node.type !== 'INPUT' &&
        node.type !== 'Switch' &&
        node.type !== 'OUTPUT' &&
        node.type !== 'Lamp' &&
        node.type !== 'Clock'
      ) {
        continue;
      }
      map[node.id] = resolveNodeIoPresentation(node, ioRowByNodeId.get(node.id));
    }
    return map;
  }, [editorCircuit.nodes, ioRowByNodeId]);
  const selectedWireSignalKey = useMemo(() => {
    if (selectedWireIds.length === 0) return null;
    const parsed = parseWireId(selectedWireIds[0]);
    if (!parsed) return null;
    return `${parsed.fromNodeId}.${parsed.fromPort}`;
  }, [selectedWireIds]);
  const verifyLinkedSignalKey = useMemo(
    () => resolveVerifyLinkedSignalKey(activeVerifySignal, ioRows, liveSignals, runtimeSim.signals),
    [activeVerifySignal, ioRows, liveSignals, runtimeSim.signals]
  );
  const selectedSignalKey = runtimeSim.selectedSignalKey ?? verifyLinkedSignalKey ?? selectedWireSignalKey;
  useEffect(() => {
    if (!verifyLinkedSignalKey) return;
    onRuntimeSimSetSelectedSignal?.(verifyLinkedSignalKey);
    const [nodeId, portName = 'out'] = verifyLinkedSignalKey.split('.');
    if (!nodeId) return;
    const { wireIds, nodeIds } = getFaninCone(editorCircuit, nodeId);
    const highlights = new Map<string, string[]>();
    wireIds.forEach((wireId) => highlights.set(wireId, ['#a78bfa']));
    const highlightedNodes = new Set(nodeIds);
    highlightedNodes.add(nodeId);
    const portKeys = buildTracePortKeySet(wireIds);
    portKeys.add(`${nodeId}:${portName}`);
    setTraceState({
      kind: 'fanin-port',
      sourceKey: `verify:${verifyLinkedSignalKey}`,
      label: `Verify focus ${verifyLinkedSignalKey}`,
      signalKey: verifyLinkedSignalKey,
      wireHighlights: highlights,
      nodeIds: highlightedNodes,
      portKeys,
    });
    lastTracedPortRef.current = `${nodeId}.${portName}`;
  }, [editorCircuit, onRuntimeSimSetSelectedSignal, verifyLinkedSignalKey]);
  const selectedSignalValue = selectedSignalKey ? runtimeSim.signals[selectedSignalKey] ?? 0 : 0;
  const selectedSignalHistory = useMemo(() => {
    if (!selectedSignalKey) return [];
    const history = runtimeSim.trace.slice(-32).map((entry) => ({
      tick: entry.tick,
      value: entry.signals[selectedSignalKey] ?? 0,
    }));
    return history;
  }, [runtimeSim.trace, selectedSignalKey]);
  const pinnedProbeRows = useMemo(
    () =>
      runtimeSim.probes.map((probe) => ({
        ...probe,
        value: runtimeSim.signals[probe.key] ?? 0,
      })),
    [runtimeSim.probes, runtimeSim.signals]
  );
  // B1: Eval order — computed from engine topology, refreshed when circuit changes
  const evalOrder = useMemo(() => {
    if (!showEvalOrder) return null;
    try { return tickEngine.getEngine().getEvaluationOrder(); } catch { return null; }
  }, [showEvalOrder, editorCircuit.nodes, editorCircuit.connections, tickEngine]);

  // B1: Changed nodes — node IDs whose output differed between the last 2 sim ticks
  const changedNodeIds = useMemo<Set<string> | null>(() => {
    const trace = runtimeSim.trace;
    if (trace.length < 2) return null;
    const prev = trace[trace.length - 2].signals;
    const curr = trace[trace.length - 1].signals;
    const changed = new Set<string>();
    for (const key of Object.keys(curr)) {
      if (curr[key] !== prev[key]) {
        const nodeId = key.split('.')[0];
        if (nodeId) changed.add(nodeId);
      }
    }
    return changed.size > 0 ? changed : null;
  }, [runtimeSim.trace]);

  // B1: Per-selected-node stats (fanout, signal depth) — only when showEvalOrder is active
  const selectedNodeEvalStats = useMemo(() => {
    if (!showEvalOrder || !selectedNode || !evalOrder) return null;
    const step = evalOrder.indexOf(selectedNode.id);
    // Fanout = number of outgoing connections from this node
    const fanout = editorCircuit.connections.filter((c) => {
      const normalized = c.from?.nodeId ?? (c as any).fromNodeId;
      return normalized === selectedNode.id;
    }).length;
    // Signal depth = longest incoming path (hop count from any input node)
    // Simple BFS over reverse edges
    const inEdges = new Map<string, string[]>();
    for (const conn of editorCircuit.connections) {
      const from = conn.from?.nodeId ?? (conn as any).fromNodeId;
      const to = conn.to?.nodeId ?? (conn as any).toNodeId;
      if (!from || !to) continue;
      const current = inEdges.get(to) ?? [];
      current.push(from);
      inEdges.set(to, current);
    }
    const depths = new Map<string, number>();
    const computeDepth = (id: string): number => {
      if (depths.has(id)) return depths.get(id)!;
      const parents = inEdges.get(id) ?? [];
      const depth = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(computeDepth));
      depths.set(id, depth);
      return depth;
    };
    const depth = computeDepth(selectedNode.id);
    return { step: step >= 0 ? step + 1 : null, fanout, depth };
  }, [showEvalOrder, selectedNode, evalOrder, editorCircuit.connections]);

  const effectiveDesignView = useMemo<'canvas' | 'hdl' | 'split' | 'stacked'>(() => {
    if (designView !== 'split') return designView;
    const totalWidth = Math.max(0, paneRowSize.width);
    if (totalWidth === 0) return 'stacked';
    const canvasWidth = totalWidth * splitRatio;
    const hdlWidth = totalWidth * (1 - splitRatio);
    // Lower thresholds so split works on more screen sizes without stacking
    return totalWidth < 720 || canvasWidth < 320 || hdlWidth < 320 ? 'stacked' : 'split';
  }, [designView, paneRowSize.width, splitRatio]);
  const selectedNodeIoRow = useMemo(() => {
    if (!selectedNode) return null;
    return ioRowByNodeId.get(selectedNode.id) ?? ioRowByNodeId.get(`${selectedNode.id}.out`) ?? null;
  }, [ioRowByNodeId, selectedNode]);
  const preferredNodeTracePort = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'OUTPUT' || selectedNode.type === 'Lamp') return 'in';
    if (selectedNodePins.includes('out')) return 'out';
    return selectedNodePins[0] ?? null;
  }, [selectedNode, selectedNodePins]);

  const selectedNodeHasFanout = useMemo(() => {
    if (!selectedNode) return false;
    return editorCircuit.connections.some((c) => {
      const fromNodeId = typeof c.from === 'string' ? c.from : (c.from as { nodeId: string }).nodeId;
      return fromNodeId === selectedNode.id;
    });
  }, [selectedNode, editorCircuit.connections]);
  const selectedNodePrimarySignalKey = useMemo(() => {
    if (!selectedNode) return null;
    if (focusedIssueSignalKey?.startsWith(`${selectedNode.id}.`)) {
      const focusedPort = focusedIssueSignalKey.slice(selectedNode.id.length + 1);
      if (selectedNodePins.includes(focusedPort)) {
        return focusedIssueSignalKey;
      }
    }
    const candidate = pickPrimaryNodeSignalKey(selectedNode, selectedNodePins, runtimeSim.signals, liveSignals);
    return candidate;
  }, [focusedIssueSignalKey, liveSignals, runtimeSim.signals, selectedNode, selectedNodePins]);
  const selectedNodeSignalSnapshot = useMemo(
    () => describeSignalSnapshot(selectedNodePrimarySignalKey, runtimeSim.trace, runtimeSim.signals, liveSignals),
    [selectedNodePrimarySignalKey, runtimeSim.trace, runtimeSim.signals, liveSignals]
  );
  const selectedNodeConnectionSummary = useMemo(() => {
    if (!selectedNode) return null;
    return describeNodeConnectionSummary(selectedNode.id, editorCircuit, resolveConnectionEndpoint);
  }, [editorCircuit, resolveConnectionEndpoint, selectedNode]);
  const primarySelectedWireId = selectedWireIds[0] ?? null;
  const selectedWireContext = useMemo(() => {
    if (!primarySelectedWireId) return null;
    const parsed = parseWireId(primarySelectedWireId);
    if (!parsed) return null;
    const sourceNode = editorCircuit.nodes.find((node) => node.id === parsed.fromNodeId);
    const targetNode = editorCircuit.nodes.find((node) => node.id === parsed.toNodeId);
    const signalKey = `${parsed.fromNodeId}.${parsed.fromPort}`;
    const snapshot = describeSignalSnapshot(signalKey, runtimeSim.trace, runtimeSim.signals, liveSignals);
    const branchCount = editorCircuit.connections.filter((connection) => {
      const from = resolveConnectionEndpoint(connection.from);
      return from.nodeId === parsed.fromNodeId && from.portName === parsed.fromPort;
    }).length;
    return {
      wireId: primarySelectedWireId,
      signalKey,
      snapshot,
      sourceNodeId: parsed.fromNodeId,
      targetNodeId: parsed.toNodeId,
      sourceLabel: describeEndpointLabel(parsed.fromNodeId, sourceNode, ioRowByNodeId.get(parsed.fromNodeId)),
      targetLabel: describeEndpointLabel(parsed.toNodeId, targetNode, ioRowByNodeId.get(parsed.toNodeId)),
      branchCount,
      sourcePort: parsed.fromPort,
      targetPort: parsed.toPort,
    };
  }, [editorCircuit.connections, editorCircuit.nodes, ioRowByNodeId, liveSignals, primarySelectedWireId, resolveConnectionEndpoint, runtimeSim.signals, runtimeSim.trace]);
  const activeInspectorSignalKey = selectedWireContext?.signalKey ?? selectedNodePrimarySignalKey ?? selectedSignalKey;
  const activeInspectorSignalSnapshot = useMemo(
    () => describeSignalSnapshot(activeInspectorSignalKey, runtimeSim.trace, runtimeSim.signals, liveSignals),
    [activeInspectorSignalKey, runtimeSim.trace, runtimeSim.signals, liveSignals]
  );
  const isActiveInspectorSignalPinned = useMemo(
    () => !!activeInspectorSignalKey && runtimeSim.probes.some((probe) => probe.key === activeInspectorSignalKey),
    [activeInspectorSignalKey, runtimeSim.probes]
  );
  const selectionAuthoringIssues = useMemo(() => {
    if (selectedNode) {
      return designIssueMap.byNode.get(selectedNode.id) ?? [];
    }
    if (selectedWireContext) {
      const issues = [
        ...(designIssueMap.byPort.get(`${selectedWireContext.targetNodeId}.${selectedWireContext.targetPort}`) ?? []),
        ...(designIssueMap.byPort.get(`${selectedWireContext.sourceNodeId}.${selectedWireContext.sourcePort}`) ?? []),
      ];
      return dedupeDesignIssues(issues);
    }
    if (activeInspectorSignalKey) {
      return designIssueMap.byPort.get(activeInspectorSignalKey) ?? [];
    }
    return [];
  }, [activeInspectorSignalKey, designIssueMap.byNode, designIssueMap.byPort, selectedNode, selectedWireContext]);
  const pinActiveInspectorSignal = useCallback(() => {
    if (!activeInspectorSignalKey || !onRuntimeSimToggleProbe) return;
    onRuntimeSimToggleProbe({
      key: activeInspectorSignalKey,
      label: activeInspectorSignalKey,
    });
  }, [activeInspectorSignalKey, onRuntimeSimToggleProbe]);
  const selectionIssueSummary = useMemo(() => {
    if (selectionAuthoringIssues.length === 0) return null;
    const primaryIssue = selectionAuthoringIssues[0];
    return (
      <div
        className={`ide-design-selection-issues is-${primaryIssue.severity}`}
        data-testid="ide-design-selection-issues"
      >
        <div className="ide-design-selection-issues-header">
          <span className={`ide-design-selection-issues-pill is-${primaryIssue.severity}`}>
            {primaryIssue.severity === 'error' ? 'Error' : 'Warn'}
          </span>
          <strong data-testid="ide-design-selection-issue-title">{primaryIssue.title}</strong>
        </div>
        <p className="ide-design-selection-issues-message" data-testid="ide-design-selection-issue-message">
          {primaryIssue.message}
        </p>
        <p className="ide-design-selection-issues-hint" data-testid="ide-design-selection-issue-hint">
          {primaryIssue.hint}
        </p>
        {selectionAuthoringIssues.length > 1 ? (
          <ul className="ide-design-selection-issues-list">
            {selectionAuthoringIssues.slice(1).map((issue) => {
              const signalKey = issue.focusTarget.portKey ? `${issue.focusTarget.nodeId}.${issue.focusTarget.portKey}` : null;
              return (
                <li key={`${issue.kind}-${issue.portKey}`}>
                  <span>{issue.title}</span>
                  <code>{describeDesignIssueLocation(issue, editorCircuit)}</code>
                  {signalKey && signalKey === focusedIssueSignalKey ? <span>Focused</span> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }, [editorCircuit, focusedIssueSignalKey, selectionAuthoringIssues]);

  const traceSelectedWire = useCallback((wireId: string) => {
    const bundle = buildWireTraceBundle(editorCircuit, wireId);
    const parsed = parseWireId(wireId);
    if (!bundle || !parsed) return;
    setTraceState({
      kind: 'wire-net',
      sourceKey: wireId,
      label: `Net ${parsed.fromNodeId}.${parsed.fromPort}`,
      signalKey: `${parsed.fromNodeId}.${parsed.fromPort}`,
      wireHighlights: bundle.wireHighlights,
      nodeIds: bundle.nodeIds,
      portKeys: bundle.portKeys,
    });
    lastTracedPortRef.current = null;
    setWireContextMenu(null);
    setActionToast(`Tracing ${parsed.fromNodeId}.${parsed.fromPort}.`);
  }, [editorCircuit]);

  const traceSelectedContext = useCallback(() => {
    if (primarySelectedWireId) {
      traceSelectedWire(primarySelectedWireId);
      return;
    }
    if (selectedNode && preferredNodeTracePort) {
      handlePortClick(selectedNode.id, preferredNodeTracePort);
    }
  }, [handlePortClick, preferredNodeTracePort, primarySelectedWireId, selectedNode, traceSelectedWire]);

  useEffect(() => {
    if (!wireContextMenu) return;
    const handlePointerDown = () => setWireContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWireContextMenu(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [wireContextMenu]);

  useEffect(() => {
    if (!isPlacementMode) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const activeEl = document.activeElement as HTMLElement | null;
      const tagName = activeEl?.tagName?.toLowerCase();
      const isTextInput = tagName === 'input' || tagName === 'textarea' || activeEl?.isContentEditable;
      if (isTextInput) return;
      event.preventDefault();
      cancelActivePlacement('escape');
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [cancelActivePlacement, isPlacementMode]);

  useEffect(() => {
    if (!onRuntimeSimSetSelectedSignal) return;
    if (!selectedWireSignalKey) return;
    onRuntimeSimSetSelectedSignal(selectedWireSignalKey);
  }, [onRuntimeSimSetSelectedSignal, selectedWireSignalKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const tagName = activeEl?.tagName?.toLowerCase();
      const isTextInput = tagName === 'input' || tagName === 'textarea' || activeEl?.isContentEditable;

      if (event.key === 'Escape' && !isTextInput) {
        setWireFeedback(null);
      }

      // Shift+D: toggle design debug overlay
      if (event.shiftKey && event.key.toLowerCase() === 'd' && !isTextInput) {
        event.preventDefault();
        setDesignDebugEnabled((previous) => !previous);
        return;
      }

      // G: toggle grid snap
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
          && (event.key === 'g' || event.key === 'G') && !isTextInput) {
        event.preventDefault();
        toggleSnapToGrid();
        return;
      }

      // Ctrl+C / Cmd+C: copy selection
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !isTextInput) {
        event.preventDefault();
        handleCopy();
        return;
      }

      // Ctrl+V / Cmd+V: paste clipboard
      if ((event.ctrlKey || event.metaKey) && event.key === 'v' && !isTextInput) {
        event.preventDefault();
        handlePaste();
        return;
      }

      // Ctrl+D / Cmd+D: duplicate selection in-place
      if ((event.ctrlKey || event.metaKey) && event.key === 'd' && !isTextInput) {
        event.preventDefault();
        handleDuplicate();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleCopy, handleDuplicate, handlePaste, toggleSnapToGrid]);

  useEffect(() => {
    const pending = pendingDebugToggleRef.current;
    if (!designDebugEnabled || !pending) return;

    const uiAfter = liveInputValueById.get(pending.nodeId) ?? 0;
    const simInputAfter = runtimeSim.inputs[pending.nodeId] ?? 0;
    const downstreamAfter = resolveDesignDebugSample(runtimeSim.signals, DESIGN_DEBUG_DOWNSTREAM_KEYS);

    const uiChanged = pending.uiBefore !== uiAfter;
    const simInputChanged = pending.simInputBefore !== simInputAfter;
    const downstreamChanged =
      pending.downstreamBefore?.key !== downstreamAfter?.key ||
      pending.downstreamBefore?.value !== downstreamAfter?.value;

    let classification = 'design-render-subscription-path';
    let branchMessage =
      'B and C changed. If visuals are stale, inspect render selectors/memo comparators.';
    if (uiChanged && !simInputChanged) {
      classification = 'ui-to-runtime-sim-wiring';
      branchMessage = 'A changed but B did not: UI interaction is not committing runtime sim inputs.';
    } else if (simInputChanged && !downstreamChanged) {
      classification = 'runtime-sim-recompute';
      branchMessage = 'B changed but C did not: recompute/propagation path is stale.';
    } else if (!uiChanged && simInputChanged) {
      classification = 'live-input-row-source';
      branchMessage = 'B changed but A did not: live input row source is stale.';
    }


    pendingDebugToggleRef.current = null;
  }, [
    designDebugEnabled,
    liveInputValueById,
    runtimeSim.inputs,
    runtimeSim.lastAction,
    runtimeSim.signals,
    runtimeSim.tick,
  ]);
  const paletteHasQuery = paletteQueryTerms.length > 0;
  const hasPaletteResults =
    filteredPaletteByCategory.logic.length > 0 ||
    filteredPaletteByCategory.sequential.length > 0 ||
    filteredPaletteByCategory.io.length > 0 ||
    filteredPaletteByCategory.components.length > 0 ||
    filteredCustomComponents.length > 0 ||
    filteredMacros.length > 0 ||
    filteredBoardGroups.length > 0;

  const renderNodePaletteCard = (
    item: Pick<PaletteItem, 'type' | 'title' | 'subtitle' | 'glyph'>,
    options?: {
      badge?: string;
      className?: string;
      onClick?: () => void;
      testId?: string;
      title?: string;
    }
  ) => {
    const isPending = pendingPlacement?.kind === 'node' && pendingPlacement.nodeType === item.type;
    return (
      <button
        key={item.type}
        type="button"
        className={`ide-palette-card${options?.className ? ` ${options.className}` : ''}${isPending ? ' is-placement-active' : ''}`}
        onClick={options?.onClick ?? (() => beginNodePlacement(item.type))}
        data-testid={options?.testId ?? `ide-design-palette-${item.type.toLowerCase()}`}
        aria-pressed={isPending}
        title={options?.title ?? `${item.title} - ${item.subtitle}`}
      >
        <span className="ide-palette-card-glyph" aria-hidden="true">
          {item.glyph}
        </span>
        <span className="ide-palette-card-body">
          <span className="ide-palette-card-title-row">
            <span className="ide-palette-card-title">{item.title}</span>
            {options?.badge ? <span className="ide-palette-card-badge">{options.badge}</span> : null}
          </span>
          <span className="ide-palette-card-subtitle">{item.subtitle}</span>
        </span>
      </button>
    );
  };
  const [logicPaletteSection, sequentialPaletteSection, ioPaletteSection, reusablePaletteSection, boardPaletteSection] =
    PALETTE_SECTION_ORDER;

  return (
    <>
      <IdeSurfaceLayout
      mode="design"
      consoleHasBlocking={compilerErrorCount > 0}
      consoleHasEntries={diagnosticsDrawerRows.length > 0}
      dock={
        <>
          <SurfacePanel className="ide-design-palette" testId="ide-design-dock-palette">
            <header className="ide-design-subheader ide-design-palette-header">
              <div>
                <h3>Build Library</h3>
                <p className="ide-design-palette-intro">
                  Logic first. Reusable blocks in the middle. Board resources stay separate.
                </p>
              </div>
              <IdeButton tone="ghost" onClick={onOpenPalette}>
                Focus
              </IdeButton>
            </header>
            <div className="ide-design-palette-toolbar">
              <input
                type="text"
                className="ide-design-search"
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search logic, dff, clock, macro, led..."
                data-testid="ide-design-search"
              />
              <p className="ide-design-palette-results" data-testid="ide-design-palette-results">
                {paletteHasQuery
                  ? hasPaletteResults
                    ? 'Matching parts from logic, reusable blocks, and board resources.'
                    : `No results for "${paletteQuery.trim()}".`
                  : 'Choose a part, place it once, and keep building.'}
              </p>
            </div>

            <div className="ide-design-palette-sections">
              {filteredPaletteByCategory.logic.length > 0 ? (
                <section
                  className="ide-palette-section"
                  data-testid="ide-design-palette-section-logic"
                >
                  <header className="ide-palette-section-header">
                    <div className="ide-palette-section-title-row">
                      <h4>{logicPaletteSection.title}</h4>
                      <span className="ide-palette-section-count">
                        {filteredPaletteByCategory.logic.length}
                      </span>
                    </div>
                    <p className="ide-palette-section-copy">{logicPaletteSection.description}</p>
                  </header>
                  <div className="ide-palette-card-list">
                    {filteredPaletteByCategory.logic.map((item) => renderNodePaletteCard(item))}
                  </div>
                </section>
              ) : null}

              {filteredPaletteByCategory.sequential.length > 0 ? (
                <section
                  className="ide-palette-section"
                  data-testid="ide-design-palette-section-sequential"
                >
                  <header className="ide-palette-section-header">
                    <div className="ide-palette-section-title-row">
                      <h4>{sequentialPaletteSection.title}</h4>
                      <span className="ide-palette-section-count">
                        {filteredPaletteByCategory.sequential.length}
                      </span>
                    </div>
                    <p className="ide-palette-section-copy">{sequentialPaletteSection.description}</p>
                  </header>
                  <div className="ide-palette-card-list">
                    {filteredPaletteByCategory.sequential.map((item) =>
                      renderNodePaletteCard(item)
                    )}
                  </div>
                </section>
              ) : null}

              {filteredPaletteByCategory.io.length > 0 ? (
                <section className="ide-palette-section" data-testid="ide-design-palette-section-io">
                  <header className="ide-palette-section-header">
                    <div className="ide-palette-section-title-row">
                      <h4>{ioPaletteSection.title}</h4>
                      <span className="ide-palette-section-count">
                        {filteredPaletteByCategory.io.length}
                      </span>
                    </div>
                    <p className="ide-palette-section-copy">{ioPaletteSection.description}</p>
                  </header>
                  <div className="ide-palette-card-list">
                    {filteredPaletteByCategory.io.map((item) => renderNodePaletteCard(item))}
                  </div>
                </section>
              ) : null}

              {filteredPaletteByCategory.components.length > 0 ||
              filteredCustomComponents.length > 0 ||
              filteredMacros.length > 0 ? (
                <section
                  className="ide-palette-section"
                  data-testid="ide-design-palette-section-reusable"
                >
                  <header className="ide-palette-section-header">
                    <div className="ide-palette-section-title-row">
                      <h4>{reusablePaletteSection.title}</h4>
                      <span className="ide-palette-section-count">
                        {filteredPaletteByCategory.components.length +
                          filteredCustomComponents.length +
                          filteredMacros.length}
                      </span>
                    </div>
                    <p className="ide-palette-section-copy">{reusablePaletteSection.description}</p>
                  </header>

                  {filteredPaletteByCategory.components.length > 0 ? (
                    <div
                      className="ide-palette-subsection"
                      data-testid="ide-design-palette-built-in-blocks"
                    >
                      <div className="ide-palette-subsection-header">
                        <div>
                          <h5>Built-in Blocks</h5>
                          <p>Ready-made helpers for arithmetic and sequential experiments.</p>
                        </div>
                        <span className="ide-palette-subsection-count">
                          {filteredPaletteByCategory.components.length}
                        </span>
                      </div>
                      <div className="ide-palette-card-list">
                        {filteredPaletteByCategory.components.map((item) =>
                          renderNodePaletteCard(item, { badge: 'Built-in' })
                        )}
                      </div>
                    </div>
                  ) : null}

                  {filteredCustomComponents.length > 0 ? (
                    <div className="ide-palette-subsection" data-testid="ide-palette-group-custom">
                      <div className="ide-palette-subsection-header">
                        <div>
                          <h5>Custom Parts</h5>
                          <p>Reusable components saved into the project component library.</p>
                        </div>
                        <span className="ide-palette-subsection-count">
                          {filteredCustomComponents.length}
                        </span>
                      </div>
                      <div className="ide-palette-card-list">
                        {filteredCustomComponents.map((item) =>
                          renderNodePaletteCard(
                            {
                              type: item.type,
                              title: item.title,
                              subtitle: item.description || 'Custom reusable block.',
                              glyph: 'C',
                            },
                            {
                              badge: 'Custom',
                              className: 'ide-palette-card--custom',
                              title: item.description || item.title,
                              testId: `ide-design-palette-custom-${item.type
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, '-')}`,
                            }
                          )
                        )}
                      </div>
                    </div>
                  ) : null}

                  <MacroLibraryPanel
                    macros={filteredMacros}
                    totalMacroCount={macros.length}
                    searchQuery={paletteQuery}
                    activeMacroId={activeMacroInsertionId}
                    onSelectMacro={handleSelectMacro}
                    onDeleteMacro={onDeleteMacro ? handleDeleteMacro : undefined}
                  />
                </section>
              ) : null}

              {filteredBoardGroups.length > 0 ? (
                <section
                  className="ide-palette-section ide-palette-section--board"
                  data-testid="ide-design-palette-section-board"
                >
                  <header className="ide-palette-section-header">
                    <div className="ide-palette-section-title-row">
                      <h4>{boardPaletteSection.title}</h4>
                      <span className="ide-palette-section-count">
                        {filteredBoardGroups.reduce((count, group) => count + group.entries.length, 0)}
                      </span>
                    </div>
                    <p className="ide-palette-section-copy">{boardPaletteSection.description}</p>
                  </header>
                  <div className="ide-palette-board-groups" data-testid="ide-design-board-io-palette">
                    {filteredBoardGroups.map((group) => (
                      <div
                        key={group.id}
                        className="ide-palette-board-group"
                        data-testid={`ide-design-board-group-${group.id}`}
                      >
                        <div className="ide-palette-subsection-header">
                          <div>
                            <h5>{group.title}</h5>
                            <p>{group.description}</p>
                          </div>
                          <span className="ide-palette-subsection-count">{group.entries.length}</span>
                        </div>
                        <div className="ide-palette-board-grid">
                          {group.entries.map((entry) => {
                            const isPlaced = isBoardAliasPlaced(entry);
                            const isPending =
                              pendingPlacement?.kind === 'board-io' &&
                              pendingPlacement.boardIoEntry?.alias === entry.alias &&
                              pendingPlacement.boardIoEntry?.direction === entry.direction;
                            const testId =
                              entry.direction === 'in'
                                ? `ide-design-board-input-${entry.alias.toLowerCase()}`
                                : `ide-design-board-output-${entry.alias.toLowerCase()}`;
                            return (
                              <button
                                key={entry.alias}
                                className={`ide-palette-chip ide-palette-chip-board${isPlaced ? ' is-placed' : ''}${isPending ? ' is-placement-active' : ''}`}
                                type="button"
                                onClick={() => beginBoardIoPlacement(entry)}
                                data-testid={testId}
                                disabled={isPlaced}
                                title={
                                  isPlaced
                                    ? `${entry.alias} already placed`
                                    : `${entry.alias} - ${describeBoardEntry(entry)}`
                                }
                                aria-pressed={isPending}
                              >
                                {entry.alias}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            {!hasPaletteResults && paletteHasQuery ? (
              <IdeEmptyState
                title={`No results for "${paletteQuery.trim()}"`}
                body="Try logic terms like AND or flipflop, or board terms like SW0, LED, or clock."
                primaryAction={
                  <IdeButton tone="ghost" onClick={() => setPaletteQuery('')}>
                    Clear search
                  </IdeButton>
                }
                testId="ide-design-palette-empty"
              />
            ) : null}
          </SurfacePanel>

          {allLiveInputRows.length > 0 && (
            <SurfacePanel className="ide-design-input-panel" testId="ide-design-input-panel">
              <header className="ide-design-subheader">
                <h3>Live Inputs</h3>
              </header>
              <div className="ide-design-input-toggle-list">
                {allLiveInputRows.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`ide-design-input-toggle ${entry.value === 1 ? 'is-on' : 'is-off'}`}
                    data-testid={`ide-design-input-toggle-${entry.id}`}
                    aria-pressed={entry.value === 1}
                    onClick={() => {
                      const next = entry.value === 1 ? 0 : 1;
                      queueDesignDebugToggleSample(entry.id, next, 'dock');
                      onRuntimeSimSetInput?.(entry.id, next);
                    }}
                  >
                    <span className="ide-design-input-toggle-label">{entry.label}</span>
                    <span className="ide-design-input-toggle-value">{entry.value}</span>
                  </button>
                ))}
              </div>
            </SurfacePanel>
          )}
        </>
      }
      inspector={
        <>
          {/* Selection header — always visible, changes with selection */}
          <div className="ide-design-inspector-sel-header" data-testid="ide-design-sel-header">
            {selectedNode ? (
              <>
                <span className="ide-design-inspector-sel-type">{selectedNode.type}</span>
                <code className="ide-design-inspector-sel-id">{selectedNode.id}</code>
              </>
            ) : selectedWireContext ? (
              <>
                <span className="ide-design-inspector-sel-type">WIRE</span>
                <code className="ide-design-inspector-sel-id">{selectedWireContext.wireId}</code>
              </>
            ) : activeInspectorSignalKey ? (
              <>
                <span className="ide-design-inspector-sel-type">SIGNAL</span>
                <code className="ide-design-inspector-sel-id">{activeInspectorSignalKey}</code>
              </>
            ) : (
              <span className="ide-design-inspector-hint">No selection</span>
            )}
          </div>
          <IdeInspectorAccordion defaultOpenId="design-context">
          <IdeInspectorSection title="Selection" accordionId="design-context" testId="ide-design-context-inspector">
            {selectedNode && selection.nodes.size === 1 ? (
              <div className="ide-design-selection-inspector" data-testid="ide-design-selection-inspector">
                <div className="ide-design-selection-identity" data-testid="ide-design-selection-identity">
                  {selectedNode.label
                    ? <><strong>{selectedNode.label}</strong><span className="ide-design-identity-sep"> — </span>{nodeTypeLabel(selectedNode.type)}</>
                    : <strong>{nodeTypeLabel(selectedNode.type)}</strong>
                  }
                </div>
                {selectionIssueSummary}
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Type</span>
                    <span data-testid="ide-design-selection-type">{nodeTypeLabel(selectedNode.type)}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Name</span>
                    <code data-testid="ide-design-selection-id">{selectedNode.label ?? selectedNode.id}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Current</span>
                    <code data-testid="ide-design-context-current">{selectedNodeSignalSnapshot?.currentValue ?? 0}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Previous</span>
                    <code data-testid="ide-design-context-previous">{selectedNodeSignalSnapshot?.previousValue ?? 0}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Transition</span>
                    <span data-testid="ide-design-context-transition">{selectedNodeSignalSnapshot?.transition ?? 'stable'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Last transition</span>
                    <span data-testid="ide-design-context-last-transition">{selectedNodeSignalSnapshot?.lastTransitionTick ?? '—'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Driver / Source</span>
                    <span>{selectedNodeConnectionSummary?.incomingLabel ?? 'Primary source'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Fan-in / Fan-out</span>
                    <span>{selectedNodeConnectionSummary?.fanIn ?? 0} / {selectedNodeConnectionSummary?.fanOut ?? 0}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Board mapping</span>
                    <span>{selectedNodeIoRow ? `${selectedNodeIoRow.label} -> ${selectedNodeIoRow.pin || 'unmapped'}` : 'None'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Probe state</span>
                    <span>{isActiveInspectorSignalPinned ? 'Pinned' : 'Not pinned'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Trace state</span>
                    <span data-testid="ide-design-context-trace-state">
                      {traceState?.nodeIds.has(selectedNode.id) ? traceState.label : 'No trace locked'}
                    </span>
                  </div>
                </div>
                <div className="ide-inline-actions">
                  <IdeButton tone="secondary" onClick={handleCopy} testId="ide-design-copy-btn">
                    Copy
                  </IdeButton>
                  <IdeButton tone="secondary" onClick={handleDuplicate} testId="ide-design-duplicate-btn">
                    Duplicate
                  </IdeButton>
                  <IdeButton
                    tone="secondary"
                    onClick={() => {
                      setEditingLabelNodeId(selectedNode.id);
                      setLabelDraft(selectedNode.label ?? '');
                    }}
                    disabled={editingLabelNodeId === selectedNode.id}
                    testId="ide-design-context-rename"
                  >
                    Rename
                  </IdeButton>
                </div>
                <div className="ide-design-label-editor" data-testid="ide-design-label-editor">
                  {editingLabelNodeId === selectedNode.id ? (
                    <div className="ide-design-label-editor-row">
                      <input
                        className="ide-text-input ide-design-label-input"
                        type="text"
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onKeyDown={handleLabelKeyDown}
                        onBlur={commitNodeLabel}
                        autoFocus
                        placeholder="Enter label…"
                        data-testid="ide-design-label-input"
                        maxLength={32}
                      />
                      <IdeButton tone="secondary" onClick={commitNodeLabel} testId="ide-design-label-save">✓</IdeButton>
                      <IdeButton tone="ghost" onClick={cancelNodeLabel} testId="ide-design-label-cancel">✕</IdeButton>
                    </div>
                  ) : (
                    <IdeButton
                      tone="ghost"
                      onClick={() => {
                        setEditingLabelNodeId(selectedNode.id);
                        setLabelDraft(selectedNode.label ?? '');
                      }}
                      testId="ide-design-label-edit-btn"
                    >
                      {selectedNode.label ? `Label: ${selectedNode.label}` : 'Add label…'}
                    </IdeButton>
                  )}
                </div>
                <div className="ide-design-inspector-group" data-testid="ide-design-trace-group">
                  <span className="ide-design-inspector-group-label">Net tracing</span>
                  <div className="ide-inline-actions">
                    <IdeButton tone="ghost" onClick={traceSelectedContext} disabled={!preferredNodeTracePort} testId="ide-design-context-trace">
                      Trace net
                    </IdeButton>
                    <IdeButton tone="ghost" onClick={() => selectedNode && handleFanoutTrace(selectedNode.id)} disabled={!selectedNodeHasFanout} testId="ide-design-context-trace-fanout">
                      Trace →
                    </IdeButton>
                    <IdeButton tone="ghost" onClick={pinActiveInspectorSignal} disabled={!activeInspectorSignalKey} testId="ide-design-context-pin">
                      {isActiveInspectorSignalPinned ? 'Unpin' : 'Pin'}
                    </IdeButton>
                    <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                      Clear
                    </IdeButton>
                  </div>
                </div>
              </div>
            ) : selectedWireContext ? (
              <div className="ide-design-selection-inspector" data-testid="ide-design-wire-context">
                {selectionIssueSummary}
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Type</span>
                    <span>Wire</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Label</span>
                    <code>{selectedWireContext.signalKey}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Current</span>
                    <code data-testid="ide-design-context-current">{selectedWireContext.snapshot?.currentValue ?? 0}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Previous</span>
                    <code data-testid="ide-design-context-previous">{selectedWireContext.snapshot?.previousValue ?? 0}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Transition</span>
                    <span data-testid="ide-design-context-transition">{selectedWireContext.snapshot?.transition ?? 'stable'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Last transition</span>
                    <span data-testid="ide-design-context-last-transition">{selectedWireContext.snapshot?.lastTransitionTick ?? '—'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Driver / Source</span>
                    <span>{selectedWireContext.sourceLabel}.{selectedWireContext.sourcePort}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Sink</span>
                    <span>{selectedWireContext.targetLabel}.{selectedWireContext.targetPort}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Net branches</span>
                    <span>{selectedWireContext.branchCount}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Probe state</span>
                    <span>{isActiveInspectorSignalPinned ? 'Pinned' : 'Not pinned'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Trace state</span>
                    <span data-testid="ide-design-context-trace-state">
                      {traceState?.kind === 'wire-net' && traceState.sourceKey === selectedWireContext.wireId ? traceState.label : 'No trace locked'}
                    </span>
                  </div>
                </div>
                <div className="ide-inline-actions ide-design-inspector-actions">
                  <IdeButton tone="secondary" onClick={() => traceSelectedWire(selectedWireContext.wireId)} testId="ide-design-context-trace">
                    Trace net
                  </IdeButton>
                  <IdeButton tone="secondary" onClick={pinActiveInspectorSignal} disabled={!activeInspectorSignalKey} testId="ide-design-context-pin">
                    {isActiveInspectorSignalPinned ? 'Unpin signal' : 'Pin signal'}
                  </IdeButton>
                  <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                    Clear trace
                  </IdeButton>
                </div>
              </div>
            ) : activeInspectorSignalKey ? (
              <div className="ide-design-selection-inspector" data-testid="ide-design-signal-focus">
                {selectionIssueSummary}
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Signal</span>
                    <code data-testid="ide-design-signal-selected">{activeInspectorSignalKey}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Current</span>
                    <code data-testid="ide-design-signal-current-value">{activeInspectorSignalSnapshot?.currentValue ?? 0}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Previous</span>
                    <code>{activeInspectorSignalSnapshot?.previousValue ?? 0}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Transition</span>
                    <span>{activeInspectorSignalSnapshot?.transition ?? 'stable'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Last transition</span>
                    <span data-testid="ide-design-context-last-transition">{activeInspectorSignalSnapshot?.lastTransitionTick ?? '—'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Samples</span>
                    <span>{activeInspectorSignalSnapshot?.samples ?? selectedSignalHistory.length}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Trace state</span>
                    <span data-testid="ide-design-context-trace-state">{traceState?.label ?? 'No trace locked'}</span>
                  </div>
                </div>
                <div className="ide-inline-actions ide-design-inspector-actions">
                  <IdeButton tone="secondary" onClick={pinActiveInspectorSignal} testId="ide-design-context-pin">
                    {isActiveInspectorSignalPinned ? 'Unpin signal' : 'Pin signal'}
                  </IdeButton>
                  <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                    Clear trace
                  </IdeButton>
                </div>
              </div>
            ) : (
              <>
            <p className="ide-copy">
              Build your circuit using logic gates and wires. Switch to <b>Split</b> view to see live-generated VHDL alongside the canvas.
            </p>
            <ul className="ide-bullets">
              <li><b>Canvas</b>: place gates, flip-flops, and wires.</li>
              <li><b>Split</b>: canvas + live VHDL side by side.</li>
              <li><b>Import</b>: bring in an existing Vivado/HDL project.</li>
            </ul>
            <div className="ide-inline-actions">
              {onGoToProject && (
                <IdeButton tone="ghost" onClick={onGoToProject} testId="ide-design-go-project">
                  I/O Mapping →
                </IdeButton>
              )}
            </div>
              </>
            )}
          </IdeInspectorSection>
          <IdeInspectorSection title="Board Signal" accordionId="board-signal">
            {(() => {
              if (!selectedNode) {
                return (
                  <p className="ide-copy ide-design-board-signal-empty">
                    Select a node to see its board pin mapping.
                  </p>
                );
              }
              const ioRow = (ioRows ?? []).find((r) => r.nodeId === selectedNode.id);
              if (!ioRow) {
                return (
                  <p className="ide-copy ide-design-board-signal-empty">
                    No board mapping for this node.
                  </p>
                );
              }
              const liveValue: 0 | 1 =
                (runtimeSim.inputs[ioRow.nodeId] ??
                runtimeSim.signals[ioRow.nodeId] ??
                runtimeSim.signals[`${ioRow.nodeId}.out`] ??
                0) === 1 ? 1 : 0;
              return (
                <>
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Label</span>
                    <code className="ide-design-board-signal-code">{ioRow.label}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Pin</span>
                    <code className="ide-design-board-signal-code">{ioRow.pin || '—'}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Dir</span>
                    <span>{ioRow.direction === 'in' ? 'IN' : 'OUT'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Value</span>
                    <span
                      data-testid="ide-design-board-signal-value"
                      className={`ide-design-board-signal-value ${liveValue ? 'is-high' : 'is-low'}`}
                    >
                      {liveValue ? 'HIGH' : 'LOW'}
                    </span>
                  </div>
                </div>
                {onGoToHardware && (
                  <div className="ide-design-board-signal-actions">
                    <IdeButton tone="secondary" onClick={onGoToHardware} testId="ide-design-go-hardware">
                      Go to Hardware
                    </IdeButton>
                  </div>
                )}
                </>
              );
            })()}
          </IdeInspectorSection>
          <IdeInspectorSection title="Workspace" accordionId="metrics">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Nodes / Wires</span>
                <span>{circuit.nodes.length} / {circuit.connections.length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Tool</span>
                <span>{toolMode === 'wire' ? 'Wire' : 'Select'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Snap</span>
                <span>{snapToGrid ? 'On' : 'Off'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Zoom</span>
                <span data-testid="ide-design-zoom-indicator">{zoomPercent}%</span>
              </div>
              <div className="ide-kv-row">
                <span>View mode</span>
                <span>{effectiveDesignView === 'stacked' ? 'Split (stacked)' : designView.toUpperCase()}</span>
              </div>
              <div className="ide-kv-row">
                <span>Interaction</span>
                <span data-testid="ide-design-interaction-indicator">{interactionLabel}</span>
              </div>
              <div className="ide-kv-row">
                <span>Dirty since verify</span>
                <span>{dirtySinceVerify ? 'Yes' : 'No'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Dirty since export</span>
                <span>{dirtySinceExport ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </IdeInspectorSection>

          {/* Student-loop contract: live simulation must stay directly reachable even when
              other inspector sections participate in shared accordion behavior. */}
          <IdeInspectorSection title="Live Simulation" testId="ide-design-live-sim-section">
            <div className="ide-inline-actions">
              {simRunning ? (
                <IdeButton tone="secondary" onClick={pauseSimulation} testId="ide-design-sim-pause">
                  Pause
                </IdeButton>
              ) : (
                <IdeButton tone="primary" onClick={startSimulation} testId="ide-design-sim-run">
                  Run
                </IdeButton>
              )}
              <IdeButton tone="ghost" onClick={stepSimulation} testId="ide-design-sim-step">
                Step{runtimeSim.stepMode ? ` t${simTick}` : ''}
              </IdeButton>
              <IdeButton tone="ghost" onClick={resetSimulation} testId="ide-design-sim-reset">
                Reset
              </IdeButton>
            </div>
            <label className="ide-verify-field">
              Speed (ticks/s)
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={simSpeed}
                onChange={(event) => onRuntimeSimSetSpeed?.(Number(event.target.value))}
                data-testid="ide-design-sim-speed"
              />
            </label>
            <div className="ide-kv-list ide-design-live-summary">
              <div className="ide-kv-row">
                <span>Tick</span>
                <span data-testid="ide-design-sim-tick">{simTick}</span>
              </div>
              <div className="ide-kv-row">
                <span>Mode</span>
                <span>{simRunning ? 'Running' : 'Paused'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Last change</span>
                <span data-testid="ide-design-last-change">{simulationStory.summary}</span>
              </div>
            </div>
            <div className="ide-design-live-state-table" data-testid="ide-design-live-state-table">
              <div className="ide-design-live-state-group">
                <div className="ide-design-live-state-group-title">Inputs</div>
                {liveIoSignals.inputRows.map((entry) => (
                  <div className="ide-kv-row" key={`in-${entry.id}`} data-testid={`ide-design-live-input-${entry.id}`}>
                    <span>
                      {entry.label}
                      {entry.pinAlias ? <span className="ide-design-live-pin"> {entry.pinAlias}</span> : null}
                    </span>
                    <code>{entry.value}</code>
                  </div>
                ))}
              </div>
              <div className="ide-design-live-state-group">
                <div className="ide-design-live-state-group-title">Outputs</div>
                {liveIoSignals.outputRows.map((entry) => (
                  <div className="ide-kv-row" key={`out-${entry.id}`} data-testid={`ide-design-live-output-${entry.id}`}>
                    <span>
                      {entry.label}
                      {entry.pinAlias ? <span className="ide-design-live-pin"> {entry.pinAlias}</span> : null}
                    </span>
                    <code>{entry.value}</code>
                  </div>
                ))}
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Signal Probe" testId="ide-design-signal-probe" accordionId="signal-probe">
            {selectedSignalKey ? (
              <>
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Signal</span>
                    <code data-testid="ide-design-signal-selected">{selectedSignalKey}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Current</span>
                    <code data-testid="ide-design-signal-current-value">{selectedSignalValue}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Previous</span>
                    <code>{activeInspectorSignalSnapshot?.previousValue ?? selectedSignalValue}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Transition</span>
                    <span>{activeInspectorSignalSnapshot?.transition ?? 'stable'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Last transition</span>
                    <span>{activeInspectorSignalSnapshot?.lastTransitionTick ?? '—'}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Samples</span>
                    <span>{selectedSignalHistory.length}</span>
                  </div>
                </div>
                <div className="ide-design-signal-history" data-testid="ide-design-signal-history">
                  {selectedSignalHistory.length > 0 ? (
                    selectedSignalHistory.map((entry) => (
                      <button
                        key={`${selectedSignalKey}-${entry.tick}`}
                        type="button"
                        className={`ide-verify-waveform-point ${entry.value === 1 ? 'is-selected' : ''}`}
                        onClick={() => onRuntimeSimSetSelectedSignal?.(selectedSignalKey)}
                        data-testid="ide-design-signal-history-point"
                      >
                        {entry.value}
                      </button>
                    ))
                  ) : (
                    <p className="ide-copy">No trace samples yet. Run or step simulation to populate history.</p>
                  )}
                </div>
                <div className="ide-inline-actions">
                  <IdeButton
                    tone="secondary"
                    onClick={() =>
                      onRuntimeSimToggleProbe?.({
                        key: selectedSignalKey,
                        label: selectedSignalKey,
                      })
                    }
                    testId="ide-design-signal-pin"
                  >
                    Pin signal
                  </IdeButton>
                </div>
              </>
            ) : (
              <p className="ide-copy">
                Select a wire or probe a node port to inspect live value and recent tick history.
              </p>
            )}
            {pinnedProbeRows.length > 0 ? (
              <div className="ide-kv-list ide-copy-top-gap" data-testid="ide-design-probe-list">
                {pinnedProbeRows.map((probe) => (
                  <div className="ide-kv-row" key={probe.key}>
                    <code>{probe.label}</code>
                    <span>{probe.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </IdeInspectorSection>

          {(selection.nodes.size > 1 || selectedWireIds.length > 1) && (
          <IdeInspectorSection title="Selection">
            {selectedNode && selection.nodes.size === 1 ? (
              <div className="ide-design-selection-inspector" data-testid="ide-design-selection-inspector">
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Type</span>
                    <span data-testid="ide-design-selection-type">{nodeTypeLabel(selectedNode.type)}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Node ID</span>
                    <span>
                      <code data-testid="ide-design-selection-id">{selectedNode.id}</code>
                    </span>
                  </div>
                </div>
                {/* A-5: Inline node label editor */}
                <div className="ide-design-label-editor" data-testid="ide-design-label-editor">
                  {editingLabelNodeId === selectedNode.id ? (
                    <div className="ide-design-label-editor-row">
                      <input
                        className="ide-text-input ide-design-label-input"
                        type="text"
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onKeyDown={handleLabelKeyDown}
                        onBlur={commitNodeLabel}
                        autoFocus
                        placeholder="Enter label…"
                        data-testid="ide-design-label-input"
                        maxLength={32}
                      />
                      <IdeButton tone="secondary" onClick={commitNodeLabel} testId="ide-design-label-save">✓</IdeButton>
                      <IdeButton tone="ghost" onClick={cancelNodeLabel} testId="ide-design-label-cancel">✕</IdeButton>
                    </div>
                  ) : (
                    <IdeButton
                      tone="ghost"
                      onClick={() => {
                        setEditingLabelNodeId(selectedNode.id);
                        setLabelDraft(selectedNode.label ?? '');
                      }}
                      testId="ide-design-label-edit-btn"
                    >
                      {selectedNode.label ? `Label: ${selectedNode.label}` : 'Add label…'}
                    </IdeButton>
                  )}
                </div>
                <div className="ide-design-selection-pins" data-testid="ide-design-selection-pins">
                  {selectedNodePins.map((pin) => {
                    const val = liveSignals.get(`${selectedNode.id}.${pin}`) ?? null;
                    const valStr = val === 1 ? '1' : val === 0 ? '0' : '?';
                    return (
                      <span
                        key={`${selectedNode.id}-${pin}`}
                        className={`ide-design-pin-pill ide-design-pin-pill--val${val === 1 ? '-hi' : val === 0 ? '-lo' : '-unk'}`}
                        data-testid={`ide-design-pin-pill-${selectedNode.id}-${pin}`}
                      >
                        {pin}<span className="ide-design-pin-pill-value">{valStr}</span>
                      </span>
                    );
                  })}
                </div>
                <div className="ide-design-selection-properties" data-testid="ide-design-selection-properties">
                  <p className="ide-copy">IR Properties</p>
                  <div className="ide-kv-list">
                    {selectedNodeProperties.length > 0 ? (
                      selectedNodeProperties.map((entry) => (
                        <div key={`${selectedNode.id}-${entry.key}`} className="ide-kv-row">
                          <span>{entry.key}</span>
                          <code>{entry.value}</code>
                        </div>
                      ))
                    ) : (
                      <p className="ide-copy">No typed properties on this node.</p>
                    )}
                  </div>
                </div>
                <div className="ide-design-selection-warnings" data-testid="ide-design-selection-warnings">
                  <p className="ide-copy">Node Diagnostics</p>
                  {selectedNodeDiagnostics.length > 0 ? (
                    <ul className="ide-design-selection-warning-list">
                      {selectedNodeDiagnostics.map((diagnostic) => (
                        <li
                          key={`${selectedNode.id}-${diagnostic.code}-${diagnostic.message}`}
                          className={`ide-design-selection-warning-item ${
                            diagnostic.severity === 'error' ? 'is-error' : 'is-warning'
                          }`}
                        >
                          <span>{diagnostic.code}</span>
                          <span>{diagnostic.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ide-copy">No diagnostics attached to this node.</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <IdeButton tone="secondary" onClick={handleCopy} testId="ide-design-copy-btn">
                    Copy
                  </IdeButton>
                  <IdeButton tone="secondary" onClick={handleDuplicate} testId="ide-design-duplicate-btn">
                    Duplicate
                  </IdeButton>
                  {clipboard && (
                    <IdeButton tone="secondary" onClick={handlePaste} testId="ide-design-paste-btn">
                      Paste
                    </IdeButton>
                  )}
                </div>
                <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-inspector-delete">
                  Delete selected node
                </IdeButton>
              </div>
            ) : selection.nodes.size > 1 ? (
              <div className="ide-design-selection-inspector" data-testid="ide-design-multiselect-summary">
                <div className="ide-design-selection-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-multiselect-count">{selection.nodes.size} nodes selected</strong>
                </div>
                <div className="ide-design-selection-pins" data-testid="ide-design-multiselect-types">
                  {selectedTypeSummary.map((entry) => (
                    <span key={entry.type} className="ide-design-pin-pill">
                      {nodeTypeLabel(entry.type)}: {entry.count}
                    </span>
                  ))}
                </div>
                <div className="ide-inline-actions" style={{ marginBottom: 6 }}>
                  <IdeButton tone="secondary" onClick={handleCopy} testId="ide-design-copy-btn">
                    Copy ({selection.nodes.size})
                  </IdeButton>
                  <IdeButton tone="secondary" onClick={handleDuplicate} testId="ide-design-duplicate-btn">
                    Duplicate ({selection.nodes.size})
                  </IdeButton>
                  {clipboard && (
                    <IdeButton tone="secondary" onClick={handlePaste} testId="ide-design-paste-btn">
                      Paste
                    </IdeButton>
                  )}
                </div>
                {onSaveMacro && selectedNodeIdsAll.length >= 2 && (
                  <div className="ide-design-inspector-group">
                    <span className="ide-design-inspector-group-label">Compose</span>
                    <div className="ide-inline-actions">
                      <IdeButton tone="ghost" onClick={openMacroDialog} testId="ide-design-save-macro-open">
                        Save as Macro…
                      </IdeButton>
                    </div>
                  </div>
                )}
                <div className="ide-design-inspector-group ide-design-inspector-group--danger">
                  <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-inspector-delete">
                    Delete {selection.nodes.size} nodes
                  </IdeButton>
                </div>
                {onSaveAsComponent && selectedNodeIdsAll.length >= 2 && (
                  <div className="ide-design-save-component-form" data-testid="ide-design-save-component-form" style={{ marginTop: 8 }}>
                    {saveComponentOpen ? (
                      <>
                        <input
                          className="ide-text-input"
                          type="text"
                          placeholder="Component name…"
                          value={saveComponentName}
                          onChange={(e) => setSaveComponentName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveComponent(); }}
                          data-testid="ide-design-save-component-input"
                        />
                        <IdeButton tone="primary" onClick={handleSaveComponent} testId="ide-design-save-component-confirm">
                          Save
                        </IdeButton>
                        <IdeButton tone="ghost" onClick={() => { setSaveComponentOpen(false); setSaveComponentName(''); }} testId="ide-design-save-component-cancel">
                          Cancel
                        </IdeButton>
                      </>
                    ) : (
                      <IdeButton tone="secondary" onClick={() => setSaveComponentOpen(true)} testId="ide-design-save-component-open">
                        Save as Component…
                      </IdeButton>
                    )}
                    {savedComponentToast && (
                      <IdeCallout tone="success" testId="ide-design-save-component-toast">
                        Saved "{savedComponentToast}" — available in Custom palette.
                      </IdeCallout>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            {selectedWireIds.length > 0 && (
              <div className="ide-copy-top-gap">
                <strong>Selected wires:</strong> {selectedWireIds.length}
              </div>
            )}
          </IdeInspectorSection>
          )}

          <IdeInspectorSection title="Next Action" accordionId="next-action">
            <IdeCallout tone="info" title="Design Flow">
              Place IO pins, wire through logic gates, then switch to Verify for deterministic test vectors.
            </IdeCallout>
          </IdeInspectorSection>

          <IdeInspectorSection title="Evaluation Order" accordionId="eval-order" defaultOpen={false}>
            <div className="ide-kv-row">
              <span>Show eval sequence</span>
              <IdeButton
                tone={showEvalOrder ? 'primary' : 'ghost'}
                onClick={() => setShowEvalOrder((v) => !v)}
                testId="ide-design-show-eval-order"
              >
                {showEvalOrder ? 'On' : 'Off'}
              </IdeButton>
            </div>
            {showEvalOrder && selectedNodeEvalStats && (
              <div className="ide-kv-list" style={{ marginTop: 8 }}>
                {selectedNodeEvalStats.step != null && (
                  <div className="ide-kv-row">
                    <span>Eval step</span>
                    <span data-testid="ide-design-eval-step">#{selectedNodeEvalStats.step}</span>
                  </div>
                )}
                <div className="ide-kv-row">
                  <span>Signal depth</span>
                  <span data-testid="ide-design-signal-depth">{selectedNodeEvalStats.depth}</span>
                </div>
                <div className="ide-kv-row">
                  <span>Fanout</span>
                  <span data-testid="ide-design-fanout">{selectedNodeEvalStats.fanout}</span>
                </div>
              </div>
            )}
            {showEvalOrder && !selectedNodeEvalStats && (
              <p className="ide-copy" style={{ marginTop: 4 }}>Select a node to see its eval stats.</p>
            )}
          </IdeInspectorSection>

          {selectedNode && (
          <IdeInspectorSection title="Net / Pins" testId="ide-design-net-pins" accordionId="net-pins">
            <div className="ide-kv-list">
                <div className="ide-kv-row">
                  <span>Selected</span>
                  <code>{selectedNode.id}</code>
                </div>
                <div className="ide-kv-row">
                  <span>Pin Count</span>
                  <span>{selectedNodePins.length}</span>
                </div>
                <div className="ide-kv-row">
                  <span>Connected Wires</span>
                  <span>
                    {editorCircuit.connections.filter((entry) => {
                      const fromNodeId =
                        typeof entry.from === 'string' ? entry.from : entry.from.nodeId;
                      const toNodeId =
                        typeof entry.to === 'string' ? entry.to : entry.to.nodeId;
                      return fromNodeId === selectedNode.id || toNodeId === selectedNode.id;
                    }).length}
                  </span>
                </div>
              </div>
          </IdeInspectorSection>
          )}
        </IdeInspectorAccordion>
        </>
      }
      console={
        <section
          className="ide-design-console"
          data-testid="ide-design-console-diagnostics"
          data-filtered-node={diagnosticFilterNodeId ?? 'all'}
        >
          <header className="ide-design-diagnostics-drawer-header">
            <h3>Diagnostics</h3>
            <div className="ide-inline-actions">
              {diagnosticFilterNodeId ? (
                <span className="ide-copy" data-testid="ide-design-diagnostics-filtered-node">
                  filtered: <code>{diagnosticFilterNodeId}</code>
                </span>
              ) : (
                <span className="ide-copy">all nodes</span>
              )}
              {diagnosticFilterNodeId ? (
                <IdeButton
                  tone="ghost"
                  onClick={clearDiagnosticFilter}
                  testId="ide-design-diagnostics-clear-filter"
                >
                  Clear filter
                </IdeButton>
              ) : null}
            </div>
          </header>
          <div className="ide-design-diagnostics-list" data-testid="ide-design-console-list">
            {diagnosticsDrawerRows.length > 0 ? (
              diagnosticsDrawerRows.slice(0, 16).map((diagnostic) => (
                <article
                  key={diagnostic.id}
                  className={`ide-design-diagnostic-row ${
                    diagnostic.severity === 'error' ? 'is-error' : 'is-warning'
                  }`}
                  data-testid={`ide-design-diagnostic-${diagnostic.id}`}
                >
                  <div className="ide-design-diagnostic-row-header">
                    <IdeStatusPill tone={diagnostic.severity === 'error' ? 'error' : 'warn'}>
                      {diagnostic.severity === 'error' ? 'ERROR' : 'WARN'}
                    </IdeStatusPill>
                    <code>{diagnostic.code}</code>
                    <span>{diagnostic.title}</span>
                  </div>
                  <p className="ide-copy">{diagnostic.message}</p>
                  {diagnostic.hint.length > 0 ? (
                    <p className="ide-copy ide-design-diagnostic-hint">{diagnostic.hint[0]}</p>
                  ) : null}
                  <div className="ide-inline-actions">
                    {onDiagnosticAction ? (
                      <IdeButton
                        tone="secondary"
                        onClick={() => onDiagnosticAction(diagnostic)}
                        testId={`ide-design-diagnostic-action-${diagnostic.id}`}
                      >
                        Show fix path
                      </IdeButton>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="ide-copy">No diagnostics currently linked to this view.</p>
            )}
          </div>
        </section>
      }
    >
        <IdePanel
          title="Circuit Designer"
          right={<IdeStatusPill tone={isPlacementMode || toolMode === 'wire' ? 'warn' : 'ok'}>{activeModeLabel}</IdeStatusPill>}
          testId="ide-design-panel"
        >
          <div className="ide-design-workspace" data-testid="ide-design-workspace" data-design-view={effectiveDesignView}>

            {/* ── Compact primary toolbar ── */}
            <div className="ide-design-toolbar" data-testid="ide-design-toolbar">
              {/* Group 1: Mode — primary weight */}
              <div className="ide-toolbar-group is-mode">
                <div className="ide-design-tool-segmented" data-testid="ide-design-tool-segmented">
                  <button
                    type="button"
                    className={`ide-design-tool-segment ${toolMode === 'select' ? 'is-active' : ''}`}
                    onClick={setSelectMode}
                    data-testid="ide-design-tool-select"
                    aria-pressed={toolMode === 'select'}
                    title="Select tool (S)"
                  >
                    <span className="ide-design-tool-icon" aria-hidden="true">↖</span>
                    <span className="ide-design-tool-text"><strong>Select</strong><kbd>S</kbd></span>
                  </button>
                  <button
                    type="button"
                    className={`ide-design-tool-segment ${toolMode === 'wire' ? 'is-active' : ''}`}
                    onClick={setWireMode}
                    data-testid="ide-design-tool-wire"
                    aria-pressed={toolMode === 'wire'}
                    title="Wire tool (W)"
                  >
                    <span className="ide-design-tool-icon" aria-hidden="true">⌀</span>
                    <span className="ide-design-tool-text"><strong>Wire</strong><kbd>W</kbd></span>
                  </button>
                </div>
              </div>

              {/* Group 2: Edit operations */}
              <div className="ide-toolbar-group is-edit">
                <IdeButton tone="ghost" onClick={toggleSnapToGrid} testId="ide-design-tool-snap">
                  Snap {snapToGrid ? 'On' : 'Off'}
                </IdeButton>
                <IdeButton tone="ghost" onClick={handleUndo} disabled={undoDepth === 0} testId="ide-design-tool-undo">
                  Undo
                </IdeButton>
                <IdeButton tone="ghost" onClick={handleRedo} disabled={redoDepth === 0} testId="ide-design-tool-redo">
                  Redo
                </IdeButton>
                <IdeButton tone="danger" onClick={deleteSelection} disabled={!hasSelection} testId="ide-design-tool-delete">
                  Delete
                </IdeButton>
              </div>

              {/* Group 3: Utilities — floated right */}
              <div className="ide-toolbar-group is-utils">
                <div className="ide-design-view-toggle" data-testid="ide-design-view-toggle">
                  {(['canvas', 'hdl', 'split'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`ide-design-view-btn${designView === v ? ' is-active' : ''}`}
                      onClick={() => setDesignView(v)}
                      data-testid={`ide-design-view-${v}`}
                    >
                      {v === 'canvas' ? 'Canvas' : v === 'hdl' ? 'HDL' : 'Split'}
                    </button>
                  ))}
                </div>
                {activeVerifySignal && (
                  <span className="ide-design-verify-link-badge" data-testid="ide-design-verify-link-badge">
                    Verify focus {activeVerifySignal}
                  </span>
                )}
                <button
                  type="button"
                  className="ide-toolbar-toggle"
                  aria-expanded={toolsExpanded}
                  onClick={() => setToolsExpanded((v) => !v)}
                  data-testid="ide-design-tools-toggle"
                >
                  {toolsExpanded ? 'Less ▲' : 'More ▼'}
                </button>
              </div>
            </div>

            {/* ── Expanded secondary toolbar ── */}
            {toolsExpanded && (
              <div className="ide-design-toolbarExpanded" data-testid="ide-design-toolbar-expanded">
                <span className="ide-design-depth-pill" data-testid="ide-design-undo-depth">
                  Undo {undoDepth}
                </span>
                <span className="ide-design-depth-pill" data-testid="ide-design-redo-depth">
                  Redo {redoDepth}
                </span>
                <IdeButton tone="ghost" onClick={zoomOut} testId="ide-design-zoom-out">-</IdeButton>
                <IdeButton tone="ghost" onClick={zoomIn} testId="ide-design-zoom-in">+</IdeButton>
                <IdeButton tone="ghost" onClick={fitToCircuit} testId="ide-design-fit-circuit">Zoom to Fit</IdeButton>
                <IdeButton tone="ghost" onClick={resetView} testId="ide-design-zoom-reset">Reset Zoom</IdeButton>
                <IdeButton
                  tone="ghost"
                  onClick={centerSelection}
                  disabled={selection.nodes.size === 0}
                  testId="ide-design-center-selection"
                >
                  Center Selection
                </IdeButton>
                <IdeButton
                  tone={presentationZoom === 'classroom' ? 'secondary' : 'ghost'}
                  onClick={() => setPresentationZoom((previous) => previous === 'dense' ? 'classroom' : 'dense')}
                  testId="ide-design-presentation-zoom-toggle"
                >
                  Presentation {presentationZoom === 'classroom' ? 'On' : 'Off'}
                </IdeButton>
                <IdeButton
                  tone="ghost"
                  onClick={() => setShowDetails((prev) => !prev)}
                  testId="ide-design-details-toggle"
                >
                  Details {showDetails ? '▲' : '▼'}
                </IdeButton>
              </div>
            )}

            <div className="ide-design-shortcut-strip" data-testid="ide-design-shortcut-strip">
              <span><code>S</code> select</span>
              <span><code>W</code> wire</span>
              <span><code>Ctrl + wheel</code> zoom</span>
              <span><code>Space + drag</code> pan</span>
              <span><code>F</code> fit</span>
              <span><code>G</code> snap</span>
              {effectiveDesignView === 'stacked' ? <span className="is-accent">Split stacked to preserve scroll + min widths</span> : null}
            </div>

            {/* ── HDL error banner: always visible regardless of view mode ── */}
            {liveHdlResult.error && (
              <IdeCallout tone="error" testId="ide-design-hdl-error-canvas">
                HDL generation failed — {liveHdlResult.error}
              </IdeCallout>
            )}

            {/* ── Content Pane Row — owns height below toolbar — switches between column/row ── */}
            <div
              ref={paneRowRef}
              className="ide-design-pane-row"
              data-design-view={effectiveDesignView}
              data-testid="ide-design-pane-row"
            >
              <div
                className="ide-design-pane ide-design-pane--canvas"
                style={effectiveDesignView === 'split' ? { flex: `0 0 ${splitRatio * 100}%`, minWidth: '440px' } : undefined}
              >

            {/* ── Canvas title strip ── */}
            <div
              className={`ide-design-authoring-issues${
                authoringIssueCounts.errorCount > 0
                  ? ' has-errors'
                  : authoringIssueCounts.warningCount > 0
                    ? ' has-warnings'
                    : ' is-clean'
              }`}
              data-testid="ide-design-authoring-issues"
            >
              <div className="ide-design-authoring-issues-summary">
                <span className="ide-design-authoring-issues-label">Authoring Issues</span>
                <span
                  className="ide-design-authoring-issues-count is-error"
                  data-testid="ide-design-authoring-issues-errors"
                >
                  {authoringIssueCounts.errorCount} errors
                </span>
                <span
                  className="ide-design-authoring-issues-count is-warn"
                  data-testid="ide-design-authoring-issues-warnings"
                >
                  {authoringIssueCounts.warningCount} warnings
                </span>
                <span className="ide-design-authoring-issues-status">
                  {authoringIssues.length === 0
                    ? 'No live authoring issues right now.'
                    : 'Live checks update as you edit.'}
                </span>
              </div>
              {authoringIssueCounts.topIssues.length > 0 ? (
                <div className="ide-design-authoring-issues-list">
                  {authoringIssueCounts.topIssues.map((issue, index) => (
                    <article
                      key={`${issue.kind}-${issue.portKey}`}
                      className={`ide-design-authoring-issue is-${issue.severity}`}
                      data-testid={`ide-design-authoring-issue-${index}`}
                    >
                      <div className="ide-design-authoring-issue-copy">
                        <div className="ide-design-authoring-issue-header">
                          <span className={`ide-design-authoring-issue-pill is-${issue.severity}`}>
                            {issue.severity === 'error' ? 'Error' : 'Warn'}
                          </span>
                          <strong>{issue.title}</strong>
                          <code>{describeDesignIssueLocation(issue, editorCircuit)}</code>
                        </div>
                        <p>{issue.message}</p>
                        <p>{issue.hint}</p>
                      </div>
                      <IdeButton
                        tone={issue.severity === 'error' ? 'secondary' : 'ghost'}
                        onClick={() => focusDesignIssue(issue)}
                        testId={`ide-design-authoring-issue-focus-${index}`}
                      >
                        Focus
                      </IdeButton>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="ide-design-canvas-titlebar" data-testid="ide-design-canvas-titlebar">
              <span className="ide-design-canvas-titlebar-label">Circuit Canvas</span>
              <span className="ide-design-canvas-titlebar-stat" data-testid="ide-design-canvas-stat-nodes">
                {editorCircuit.nodes.length} nodes
              </span>
              <span className="ide-design-canvas-titlebar-stat" data-testid="ide-design-canvas-stat-wires">
                {editorCircuit.connections.length} wires
              </span>
              <span className="ide-design-canvas-titlebar-stat" data-testid="ide-design-canvas-stat-zoom">
                {Math.round(camera.zoom * 100)}%
              </span>
              {traceState ? (
                <span className="ide-design-canvas-titlebar-stat is-trace" data-testid="ide-design-active-trace">
                  {traceState.label}
                </span>
              ) : null}
            </div>

            {/* ── Canvas area (fills remaining height) ── */}
            <div className="ide-design-sim-story-strip" data-testid="ide-design-sim-story-strip">
              <div className="ide-design-sim-story-main">
                <span className="ide-design-sim-story-pill" data-testid="ide-design-sim-story-tick">
                  Tick {simTick}
                </span>
                <span className="ide-design-sim-story-pill" data-testid="ide-design-sim-story-mode">
                  {simRunning ? 'Running' : 'Paused'}
                </span>
                {simulationStory.clockEvent ? (
                  <span
                    className={`ide-design-sim-story-pill is-clock is-${simulationStory.clockEvent}`}
                    data-testid="ide-design-sim-story-clock"
                  >
                    {simulationStory.clockLabel} {simulationStory.clockEvent} edge
                  </span>
                ) : null}
                {activeVerifySignal ? (
                  <span className="ide-design-sim-story-pill is-verify" data-testid="ide-design-verify-focus">
                    Verify linked to {activeVerifySignal}
                  </span>
                ) : null}
              </div>
              <p className="ide-design-sim-story-summary" data-testid="ide-design-sim-story-summary">
                {activeSimulationSummary}
              </p>
            </div>

            <div
              ref={canvasViewportRef}
              className="ide-design-canvasWrap"
              data-testid="ide-design-canvas-wrap"
              onPointerDown={() => setHasInteracted(true)}
              onWheel={() => setHasInteracted(true)}
            >
              {showDetails && (
                <section className="ide-design-compiler-strip" data-testid="ide-design-compiler-strip">
                  <div className="ide-design-compiler-item">
                    <span>IR Hash</span>
                    <code data-testid="ide-design-ir-hash">{irHash}</code>
                  </div>
                  <div className="ide-design-compiler-item">
                    <span>Dirty since verify</span>
                    <strong data-testid="ide-design-dirty-since-verify" className={dirtySinceVerify ? 'is-warn' : 'is-ok'}>
                      {dirtySinceVerify ? 'Yes' : 'No'}
                    </strong>
                  </div>
                  <div className="ide-design-compiler-item">
                    <span>Dirty since export</span>
                    <strong data-testid="ide-design-dirty-since-export" className={dirtySinceExport ? 'is-warn' : 'is-ok'}>
                      {dirtySinceExport ? 'Yes' : 'No'}
                    </strong>
                  </div>
                  <div className="ide-design-compiler-item">
                    <span>Errors</span>
                    <strong data-testid="ide-design-diagnostics-errors" className={compilerErrorCount > 0 ? 'is-error' : 'is-ok'}>
                      {compilerErrorCount}
                    </strong>
                  </div>
                  <div className="ide-design-compiler-item">
                    <span>Warnings</span>
                    <strong data-testid="ide-design-diagnostics-warnings" className={compilerWarningCount > 0 ? 'is-warn' : 'is-ok'}>
                      {compilerWarningCount}
                    </strong>
                  </div>
                  <div className="ide-design-compiler-item">
                    <span>Diagnostics linked</span>
                    <strong data-testid="ide-design-diagnostics-total">{compilerDiagnostics.length}</strong>
                  </div>
                </section>
              )}

              {pinnedProbeRows.length > 0 && (
                <div className="ide-design-probe-bar" data-testid="ide-design-probe-bar">
                  {pinnedProbeRows.map((probe) => (
                    <span
                      key={probe.key}
                      className="ide-design-probe-pill"
                      data-testid={`ide-design-probe-pill-${probe.key}`}
                    >
                      <code>{probe.label}</code>
                      <span className="ide-design-probe-value">{probe.value}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="ide-design-layout ide-design-layout-canvas-only">
                <section className="ide-design-canvas" data-testid="ide-design-canvas">
                  <div
                    className={`ide-design-tool-hud${isPlacementMode ? ' is-placement-mode' : ''}`}
                    data-testid="ide-design-tool-hud"
                    data-blocks-canvas-placement="1"
                  >
                    <span className="ide-design-tool-hud-label">{activeModeLabel}</span>
                    <span className="ide-design-tool-hud-hint">{toolHint}</span>
                    {isPlacementMode && placementModeLabel ? (
                      <div className="ide-design-tool-hud-placement" data-testid="ide-design-placement-cue">
                        <strong data-testid="ide-design-placement-label">{placementModeLabel}</strong>
                        <span>Click empty canvas to place it.</span>
                        <IdeButton tone="ghost" onClick={() => cancelActivePlacement('cancel')} testId="ide-design-placement-cancel">
                          Cancel
                        </IdeButton>
                      </div>
                    ) : null}
                    {toolMode === 'wire' && !isPlacementMode ? (
                      <span className="ide-design-tool-hud-wire" data-testid="ide-design-wire-cue">
                        {wireStartPort ? 'Source selected. Click a valid sink pin.' : 'Pick a source pin to start wiring.'}
                      </span>
                    ) : null}
                    {wireFeedback ? (
                      <div className="ide-design-tool-hud-feedback is-error" data-testid="ide-design-wire-feedback">
                        {wireFeedback}
                      </div>
                    ) : null}
                  </div>
                  {diagnosticRouteRequest && diagnosticRouteRequest.mode === 'design' && (
                    <div
                      className="ide-design-diagnostic-callout"
                      data-testid="ide-design-diagnostic-callout"
                      data-blocks-canvas-placement="1"
                      data-blocks-macro-placement="1"
                    >
                      <IdeCallout tone="warn">
                        Checking{diagnosticRouteRequest.signal ? ` signal ${diagnosticRouteRequest.signal}` : ''}
                        {typeof diagnosticRouteRequest.tick === 'number' ? ` at tick ${diagnosticRouteRequest.tick}` : ''}.
                        <div className="ide-inline-actions ide-design-diagnostic-callout-actions">
                          {onGoToProject && (
                            <IdeButton tone="secondary" onClick={onGoToProject} testId="ide-design-diagnostic-go-mapping">
                              Open mapping
                            </IdeButton>
                          )}
                          {onGoToVerify && (
                            <IdeButton tone="secondary" onClick={onGoToVerify} testId="ide-design-diagnostic-go-verify">
                              Rerun verify
                            </IdeButton>
                          )}
                          {onClearDiagnostic && (
                            <IdeButton tone="ghost" onClick={onClearDiagnostic} testId="ide-design-diagnostic-dismiss">
                              Dismiss
                            </IdeButton>
                          )}
                        </div>
                      </IdeCallout>
                    </div>
                  )}
                  <div
                    className={`ide-design-canvas-live ${toolMode === 'wire' ? 'is-wire-mode' : 'is-select-mode'} ${
                      presentationZoom === 'classroom' ? 'is-presentation-zoom' : ''
                    }`}
                    ref={canvasHostRef}
                    data-testid="ide-design-live-canvas"
                    data-tool-mode={toolMode}
                    data-interaction-mode={effectiveInteractionMode}
                    data-placement-active={isPlacementMode ? '1' : '0'}
                    data-presentation-zoom={presentationZoom}
                    data-macro-placement-active={activeInsertionMacro ? '1' : '0'}
                    onClick={handleCanvasPlacementClick}
                  >
                    <div
                      className="ide-design-canvas-mode-indicator"
                      data-testid="ide-design-canvas-mode-indicator"
                      data-blocks-canvas-placement="1"
                    >
                      {activeModeLabel}
                    </div>
                    <div
                      className="ide-design-canvas-zoom-indicator"
                      data-testid="ide-design-canvas-zoom-indicator"
                      data-blocks-canvas-placement="1"
                    >
                      tick {simTick}
                    </div>
                    <div
                      className="ide-design-canvas-mode-indicator"
                      data-testid="ide-design-presentation-zoom-indicator"
                      data-blocks-canvas-placement="1"
                    >
                      {presentationZoom === 'classroom' ? 'Classroom Zoom' : 'Dense Zoom'}
                    </div>
                    <div
                      className="ide-design-zoom-presets"
                      data-testid="ide-design-zoom-presets"
                      data-blocks-canvas-placement="1"
                      data-blocks-macro-placement="1"
                    >
                      {([0.5, 0.75, 1.0, 1.25] as const).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`ide-design-zoom-preset${Math.round(camera.zoom * 100) === Math.round(preset * 100) ? ' is-active' : ''}`}
                          onClick={() => setZoomToPreset(preset)}
                          data-testid={`ide-design-zoom-preset-${Math.round(preset * 100)}`}
                        >
                          {Math.round(preset * 100)}%
                        </button>
                      ))}
                      <button
                        type="button"
                        className="ide-design-zoom-preset"
                        onClick={fitToCircuit}
                        data-testid="ide-design-zoom-preset-fit"
                      >
                        Fit
                      </button>
                    </div>
                    <div
                      className="ide-design-canvas-controls"
                      data-testid="ide-design-canvas-controls"
                      data-blocks-canvas-placement="1"
                      data-blocks-macro-placement="1"
                    >
                      <IdeButton tone="ghost" onClick={fitToCircuit} testId="ide-design-fit-circuit-canvas">
                        Fit
                      </IdeButton>
                      <IdeButton
                        tone="ghost"
                        onClick={centerSelection}
                        disabled={selection.nodes.size === 0}
                        testId="ide-design-center-selection-canvas"
                      >
                        Center
                      </IdeButton>
                      <IdeButton
                        tone={presentationZoom === 'classroom' ? 'secondary' : 'ghost'}
                        onClick={() => setPresentationZoom((previous) => previous === 'dense' ? 'classroom' : 'dense')}
                        testId="ide-design-presentation-zoom-toggle-canvas"
                      >
                        {presentationZoom === 'classroom' ? 'Classroom' : 'Dense'}
                      </IdeButton>
                    </div>
                    {/* C-7: Debug overlay banner — shown when externally frozen at a verify tick */}
                    {externalDebugTick != null && (
                      <div
                        className="ide-design-debug-overlay-banner"
                        data-testid="ide-design-debug-banner"
                        data-blocks-canvas-placement="1"
                        data-blocks-macro-placement="1"
                        role="status"
                      >
                        <span aria-hidden="true">⏸</span>
                        <strong>Debug mode — tick {externalDebugTick}</strong>
                        <span className="ide-design-debug-banner-hint">
                          Canvas frozen at verification tick {externalDebugTick}.
                        </span>
                        {/* C-5b: Tick navigation controls */}
                        {(onPrevDebugTick || onNextDebugTick) && (
                          <div className="ide-design-debug-nav" data-testid="ide-design-debug-nav">
                            <IdeButton
                              tone="ghost"
                              onClick={onPrevDebugTick}
                              disabled={debugTickIndex === 0 || debugTickIndex == null}
                              testId="ide-design-debug-prev"
                            >
                              ← Prev
                            </IdeButton>
                            {debugTickIndex != null && debugTickCount != null && (
                              <span data-testid="ide-design-debug-tick-position">
                                {debugTickIndex + 1} / {debugTickCount}
                              </span>
                            )}
                            <IdeButton
                              tone="ghost"
                              onClick={onNextDebugTick}
                              disabled={debugTickIndex == null || debugTickCount == null || debugTickIndex >= debugTickCount - 1}
                              testId="ide-design-debug-next"
                            >
                              Next →
                            </IdeButton>
                          </div>
                        )}
                        {activeDebugContext && (
                          <div className="ide-design-failure-brief" data-testid="ide-design-failure-brief">
                            <span className="ide-design-failure-brief-summary">
                              Verify expected <code>{activeDebugContext.signal}</code>=<code>{activeDebugContext.expected}</code>{' '}
                              but Design sampled <code>{activeDebugContext.actual}</code>.
                            </span>
                            {debugInputSummary && (
                              <span className="ide-design-failure-brief-inputs" data-testid="ide-design-failure-brief-inputs">
                                Inputs: {debugInputSummary}
                              </span>
                            )}
                            {activeDebugContext.nextInspect && (
                              <span className="ide-design-failure-brief-next" data-testid="ide-design-failure-brief-next">
                                Next inspect: {activeDebugContext.nextInspect}
                              </span>
                            )}
                          </div>
                        )}
                        {onClearExternalDebug && (
                          <IdeButton tone="ghost" onClick={onClearExternalDebug} testId="ide-design-debug-clear">
                            Exit debug view
                          </IdeButton>
                        )}
                      </div>
                    )}
                    <LogicCanvas
                      engine={tickEngine}
                      circuit={editorCircuit}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      showToolbar={false}
                      getChipMetadata={getChipMetadata}
                      onCircuitChange={handleCircuitChange}
                      onSignalsUpdated={handleSignalsUpdated}
                      onInputToggled={handleInputToggled}
                      onProbeToggle={(nodeId, portName, label) =>
                        onRuntimeSimToggleProbe?.({
                          key: `${nodeId}.${portName}`,
                          label,
                        })
                      }
                      probedPorts={new Set(runtimeSim.probes.map((probe) => probe.key))}
                      showHints={false}
                      isRunning={simRunning}
                      tickRate={simSpeed}
                      tickCount={simTick}
                      debugSignals={externalDebugSignals ?? liveSignals}
                      debugTick={externalDebugTick ?? simTick}
                      isReplayMode={externalDebugTick != null ? true : undefined}
                      nodeDiagnosticBadges={nodeDiagnosticBadges}
                      onNodeDiagnosticBadgeClick={handleNodeDiagnosticBadgeClick}
                      ioPresentationMap={ioPresentationMap}
                      presentationZoomMode={presentationZoom}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      onPortClick={handlePortClick}
                      onConnectionRejected={(reason) => {
                        suppressNextToolModeWireFeedbackClearRef.current = true;
                        setWireFeedback(connectionRejectedMessage(reason));
                      }}
                      onPlacementCancel={() => cancelActivePlacement('escape')}
                      nodeEvalOrder={evalOrder}
                      changedNodeIds={changedNodeIds}
                      nodeIssueSeverities={nodeIssueSeverities}
                      issuePortSeverities={issuePortSeverities}
                      probeWireHighlights={traceState?.wireHighlights}
                      tracedNodeIds={(() => {
                        const verifyNodeId = verifyLinkedSignalKey ? verifyLinkedSignalKey.split('.')[0] : null;
                        if (!verifyNodeId) return traceState?.nodeIds ?? null;
                        const base = traceState?.nodeIds ? new Set(traceState.nodeIds) : new Set<string>();
                        base.add(verifyNodeId);
                        return base;
                      })()}
                      highlightedPortKeys={traceState?.portKeys}
                      onWireContextMenu={({ wireId, signalKey, clientX, clientY }) => {
                        if (!canvasViewportRef.current) return;
                        const rect = canvasViewportRef.current.getBoundingClientRect();
                        setWireContextMenu({
                          x: Math.max(12, Math.min(rect.width - 188, clientX - rect.left)),
                          y: Math.max(12, Math.min(rect.height - 132, clientY - rect.top)),
                          wireId,
                          signalKey,
                        });
                      }}
                    />
                    {/* Canvas interaction hint — fades after first interaction */}
                    <div
                      className="ide-canvas-hint is-visible"
                      aria-hidden="true"
                      data-blocks-canvas-placement="1"
                      style={{ opacity: hasInteracted ? 0.15 : 0.6, transition: 'opacity 0.4s ease' }}
                    >
                      <span>Ctrl + wheel: Zoom</span>
                      <span className="ide-canvas-hint-divider" />
                      <span>Space + drag: Pan</span>
                      <span className="ide-canvas-hint-divider" />
                      <span>F: Fit</span>
                    </div>
                    {editorCircuit.nodes.length === 0 && !isPlacementMode && (
                      <div className="ide-design-overlay-empty" data-testid="ide-design-empty-state">
                        <h3>Build a circuit in three steps</h3>
                        <ol className="ide-design-empty-steps" data-testid="ide-design-empty-checklist">
                          <li>
                            <span className="ide-design-empty-step-index">1</span>
                            <span>Pick a part from the palette on the left</span>
                          </li>
                          <li>
                            <span className="ide-design-empty-step-index">2</span>
                            <span>Click empty canvas to place one part</span>
                          </li>
                          <li>
                            <span className="ide-design-empty-step-index">3</span>
                            <span>Click an output pin, then a valid input pin to wire it</span>
                          </li>
                        </ol>
                        <div className="ide-design-empty-actions">
                          <IdeButton tone="secondary" onClick={addIoPins} testId="ide-design-empty-add-io">
                            Add Inputs/Outputs
                          </IdeButton>
                          <IdeButton tone="ghost" onClick={addAndGateStarter} testId="ide-design-empty-add-and">
                            Add AND Starter
                          </IdeButton>
                        </div>
                      </div>
                    )}
                    {actionToast && (
                      <div
                        className="ide-design-toast"
                        role="status"
                        data-testid="ide-design-action-toast"
                        data-blocks-canvas-placement="1"
                      >
                        {actionToast}
                      </div>
                    )}
                    {activeInsertionMacro ? (
                      <div
                        className="ide-macro-insertion-overlay"
                        data-testid="ide-macro-insertion-overlay"
                        role="button"
                        tabIndex={0}
                        aria-label={`Place ${activeInsertionMacro.name} on empty canvas. Press Escape to cancel.`}
                        onClick={handleInsertMacroOnCanvas}
                        onKeyDown={handleMacroInsertionOverlayKeyDown}
                      >
                        <div
                          className="ide-macro-insertion-overlay-card"
                          data-blocks-canvas-placement="1"
                          data-blocks-macro-placement="1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="ide-macro-insertion-overlay-header">
                            <strong data-testid="ide-macro-insertion-title">Placement Mode</strong>
                            <IdeButton
                              tone="ghost"
                              testId="ide-macro-insertion-cancel"
                              onClick={() => cancelMacroPlacement('cancel')}
                            >
                              Cancel
                            </IdeButton>
                          </div>
                          <p className="ide-macro-insertion-overlay-copy" data-testid="ide-macro-insertion-message">
                            Click empty canvas to place {activeInsertionMacro.name}.
                          </p>
                          <p className="ide-macro-insertion-overlay-hint">Press Esc to cancel.</p>
                        </div>
                      </div>
                    ) : null}
                    {wireContextMenu ? (
                      <div
                        className="ide-design-wire-context-menu"
                        data-testid="ide-design-wire-context-menu"
                        data-blocks-canvas-placement="1"
                        data-blocks-macro-placement="1"
                        style={{ left: wireContextMenu.x, top: wireContextMenu.y }}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="ide-design-wire-context-menu-item"
                          onClick={() => traceSelectedWire(wireContextMenu.wireId)}
                          data-testid="ide-design-wire-menu-trace"
                        >
                          Trace net
                        </button>
                        <button
                          type="button"
                          className="ide-design-wire-context-menu-item"
                          onClick={() => {
                            if (wireContextMenu.signalKey) {
                              onRuntimeSimToggleProbe?.({
                                key: wireContextMenu.signalKey,
                                label: wireContextMenu.signalKey,
                              });
                            }
                            setWireContextMenu(null);
                          }}
                          data-testid="ide-design-wire-menu-pin"
                        >
                          {runtimeSim.probes.some((probe) => probe.key === wireContextMenu.signalKey) ? 'Unpin signal' : 'Pin signal'}
                        </button>
                        <button
                          type="button"
                          className="ide-design-wire-context-menu-item"
                          onClick={() => {
                            clearTrace();
                            setWireContextMenu(null);
                          }}
                          disabled={!traceState}
                          data-testid="ide-design-wire-menu-clear"
                        >
                          Clear trace
                        </button>
                      </div>
                    ) : null}
                    {selectedNode && (
                      <div className="ide-node-inspector" data-testid="ide-node-inspector">
                        <div className="ide-node-inspector-header">
                          <span className="ide-node-inspector-type">{selectedNode.type}</span>
                          <button
                            className="ide-node-inspector-close"
                            onClick={() => clearSelection()}
                            aria-label="Close inspector"
                          >
                            ×
                          </button>
                        </div>
                        <div className="ide-node-inspector-body">
                          {selectedNodeSignals && selectedNodeSignals.length > 0 ? (
                            selectedNodeSignals.map(({ port, value }) => {
                              const valStr = value === 1 ? '1' : value === 0 ? '0' : '?';
                              return (
                                <div key={port} className="ide-node-inspector-port">
                                  <span className="ide-node-inspector-port-name">{port}</span>
                                  <span
                                    className="ide-node-inspector-port-value"
                                    data-val={valStr}
                                  >
                                    {valStr}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="ide-node-inspector-port-name">No ports</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>{/* close ide-design-canvasWrap */}
              </div>{/* close ide-design-pane--canvas */}

            {/* ── Split divider handle — drag to resize ── */}
            {effectiveDesignView === 'split' && (
              <div
                className={`ide-design-split-handle${isDraggingSplitter ? ' is-dragging' : ''}`}
                data-testid="ide-design-split-handle"
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  setIsDraggingSplitter(true);
                }}
                onPointerMove={(e) => {
                  if (!isDraggingSplitter || !paneRowRef.current) return;
                  const rect = paneRowRef.current.getBoundingClientRect();
                  const minPaneRatio = Math.min(0.35, 320 / Math.max(rect.width, 1));
                  const ratio = Math.max(minPaneRatio, Math.min(1 - minPaneRatio, (e.clientX - rect.left) / rect.width));
                  requestAnimationFrame(() => setSplitRatio(ratio));
                }}
                onPointerUp={(e) => {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  setIsDraggingSplitter(false);
                }}
              />
            )}

            {/* ── HDL Pane — visible in hdl and split views ── */}
            {effectiveDesignView !== 'canvas' && (
              <div
                className="ide-design-pane ide-design-pane--hdl"
                data-testid="ide-design-hdl-pane"
                style={effectiveDesignView === 'split' ? { flex: `0 0 ${(1 - splitRatio) * 100}%`, minWidth: '320px' } : undefined}
              >
                {/* VHDL section */}
                <div className="ide-design-hdl-header" data-testid="ide-design-hdl-header">
                  <span className="ide-design-hdl-header-title">Generated VHDL</span>
                  <span className="ide-design-hdl-header-lang">top.vhd</span>
                  {!hdlDraftText && !topHdl && liveHdlResult.vhd && (
                    <span className="ide-design-sync-badge ide-design-sync-badge-live" data-testid="ide-design-live-badge">
                      Live
                    </span>
                  )}
                  {hdlDraftText && hdlDraftText !== (topHdl ?? liveHdlResult.vhd) && (
                    <span className="ide-design-sync-badge" data-testid="ide-design-sync-badge">
                      Modified
                    </span>
                  )}
                  {liveHdlResult.warnings.length > 0 && (
                    <span className="ide-design-sync-badge ide-design-sync-badge-warn">
                      {liveHdlResult.warnings.length} warning{liveHdlResult.warnings.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div className="ide-inline-actions ide-design-hdl-actions">
                    <button
                      type="button"
                      className="ide-design-hdl-action-btn is-secondary"
                      onClick={() => {
                        const text = hdlDraftText !== '' ? hdlDraftText : (topHdl ?? liveHdlResult.vhd);
                        if (text && typeof navigator !== 'undefined' && navigator.clipboard) {
                          void navigator.clipboard.writeText(text);
                        }
                      }}
                      data-testid="ide-design-hdl-copy"
                    >
                      Copy
                    </button>
                    {hdlDraftText && hdlDraftText !== (topHdl ?? liveHdlResult.vhd) && onApplyHdl && (
                      <button
                        type="button"
                        className="ide-design-hdl-action-btn"
                        onClick={() => onApplyHdl(hdlDraftText)}
                        data-testid="ide-design-apply-hdl"
                      >
                        Apply HDL → Graph
                      </button>
                    )}
                    {hdlDraftText && (
                      <button
                        type="button"
                        className="ide-design-hdl-action-btn is-secondary"
                        onClick={() => setHdlDraftText('')}
                        data-testid="ide-design-regen-hdl"
                      >
                        Reset to live
                      </button>
                    )}
                    {onGoToImport && (
                      <button
                        type="button"
                        className="ide-design-hdl-action-btn is-secondary"
                        onClick={onGoToImport}
                        data-testid="ide-design-hdl-go-import"
                      >
                        Open Import
                      </button>
                    )}
                  </div>
                </div>
                {liveHdlResult.error && (
                  <IdeCallout tone="error" title="HDL generation failed">
                    {liveHdlResult.error}
                  </IdeCallout>
                )}
                <textarea
                  className="ide-code-textarea ide-design-hdl-textarea"
                  data-testid="ide-design-hdl-textarea"
                  value={hdlDraftText !== '' ? hdlDraftText : (topHdl ?? liveHdlResult.vhd)}
                  onChange={(e) => setHdlDraftText(e.target.value)}
                  placeholder="Build a circuit in Canvas view to generate live VHDL, or import HDL via Import."
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                {/* Verilog section */}
                {liveHdlResult.verilog && (
                  <div className="ide-design-verilog-block">
                    <div className="ide-design-hdl-header" data-testid="ide-design-verilog-header">
                      <span className="ide-design-hdl-header-title">top.v</span>
                      <span className="ide-design-hdl-header-lang ide-design-hdl-header-lang--verilog">Verilog</span>
                      <span className="ide-design-sync-badge ide-design-sync-badge-live">Live</span>
                      <div className="ide-inline-actions ide-design-hdl-actions">
                        <button
                          type="button"
                          className="ide-design-hdl-action-btn is-secondary"
                          onClick={() => {
                            if (liveHdlResult.verilog && typeof navigator !== 'undefined' && navigator.clipboard) {
                              void navigator.clipboard.writeText(liveHdlResult.verilog);
                            }
                          }}
                          data-testid="ide-design-verilog-copy"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="ide-code-textarea ide-design-hdl-textarea ide-design-hdl-textarea--compact"
                      data-testid="ide-design-verilog-textarea"
                      value={liveHdlResult.verilog}
                      readOnly
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                  </div>
                )}
              </div>
            )}
            </div>{/* close ide-design-pane-row */}

          </div>
        </IdePanel>
      </IdeSurfaceLayout>
      <MacroSaveDialog
        isOpen={macroDialogState !== null}
        analysis={macroDialogState?.analysis ?? null}
        defaultName={macroDialogState?.suggestedName}
        onClose={() => setMacroDialogState(null)}
        onSave={handleSaveMacro}
      />
    </>
  );
};

type DesignIoRow = NonNullable<DesignSurfaceProps['ioRows']>[number];

function resolveNodeIoPresentation(
  node: Node,
  ioRow?: DesignIoRow
): NodeIoPresentation {
  const tokenSource = [ioRow?.label, ioRow?.pin, node.label, node.id]
    .filter((entry): entry is string => typeof entry === 'string')
    .join(' ')
    .toUpperCase();

  const isInputNode = node.type === 'INPUT' || node.type === 'Switch';
  const isOutputNode = node.type === 'OUTPUT' || node.type === 'Lamp';
  const pinAlias = normalizeAlias(ioRow?.pin ?? '');

  if (isInputNode && /(CLK100MHZ|CLK|CLOCK)/.test(tokenSource)) {
    return {
      kind: 'clock',
      label: pinAlias.length > 0 ? pinAlias : 'CLK100MHZ',
      pinAlias: pinAlias.length > 0 ? pinAlias : 'CLK100MHZ',
    };
  }

  if (isInputNode && /(BTN[CUDLR]|BTN\d+)/.test(tokenSource)) {
    const alias = extractAlias(tokenSource, /(BTN[CUDLR]|BTN\d+)/);
    return {
      kind: 'button',
      label: alias,
      pinAlias: pinAlias.length > 0 ? pinAlias : alias,
    };
  }

  if (isInputNode && /(SW\d+)/.test(tokenSource)) {
    const alias = extractAlias(tokenSource, /(SW\d+)/);
    return {
      kind: 'switch',
      label: alias,
      pinAlias: pinAlias.length > 0 ? pinAlias : alias,
    };
  }

  if (isOutputNode && /(LD\d+|LED\d+)/.test(tokenSource)) {
    const alias = extractAlias(tokenSource, /(LD\d+|LED\d+)/);
    return {
      kind: 'led',
      label: alias,
      pinAlias: pinAlias.length > 0 ? pinAlias : alias,
    };
  }

  return {
    kind: isInputNode ? 'switch' : isOutputNode ? 'led' : 'generic',
    label: getStudentFacingIoLabel(ioRow, String(node.label ?? node.id)).toUpperCase(),
    pinAlias: pinAlias.length > 0 ? pinAlias : undefined,
  };
}

function extractAlias(source: string, pattern: RegExp): string {
  const match = pattern.exec(source);
  return (match?.[1] ?? source).toUpperCase();
}

function normalizeAlias(value: string): string {
  return value.trim().toUpperCase();
}

function describeSimulationStory(
  inputRows: DesignLiveIoValueRow[],
  outputRows: DesignLiveIoValueRow[],
  trace: RuntimeSimState['trace'],
  running: boolean
): DesignSimulationStory {
  const latest = trace[trace.length - 1];
  const previous = trace.length >= 2 ? trace[trace.length - 2] : null;
  const storySource = [...inputRows, ...outputRows];
  const changedRows = previous
    ? storySource.filter((row) => (previous.signals[row.signalKey] ?? row.value) !== row.value)
    : [];
  const changedInputs = changedRows.filter((row) => row.kind === 'input');
  const changedOutputs = changedRows.filter((row) => row.kind === 'output');
  const clockRow = inputRows.find((row) => /clk|clock/i.test(row.label));
  const previousClockValue = clockRow && previous ? previous.signals[clockRow.signalKey] ?? null : null;
  const clockEvent =
    clockRow && previousClockValue != null && previousClockValue !== clockRow.value
      ? clockRow.value === 1
        ? 'rising'
        : 'falling'
      : null;

  if (!latest) {
    return {
      summary: 'No runtime samples yet. Run or step simulation to observe cause and effect.',
      clockEvent: null,
      clockLabel: clockRow?.label ?? null,
    };
  }

  if (changedRows.length === 0) {
    const primaryOutput = outputRows[0];
    return {
      summary: primaryOutput
        ? `${primaryOutput.label} held at ${primaryOutput.value} on tick ${latest.tick}.`
        : `Tick ${latest.tick} recorded with no mapped outputs yet.`,
      clockEvent,
      clockLabel: clockRow?.label ?? null,
    };
  }

  const inputSummary =
    changedInputs.length > 0
      ? `Inputs ${changedInputs.map((row) => `${row.label}→${row.value}`).join(', ')}`
      : running
        ? 'Inputs steady'
        : 'No input change';
  const outputSummary =
    changedOutputs.length > 0
      ? `outputs ${changedOutputs.map((row) => `${row.label}→${row.value}`).join(', ')}`
      : 'outputs steady';

  return {
    summary: `${inputSummary}; ${outputSummary} at tick ${latest.tick}.`,
    clockEvent,
    clockLabel: clockRow?.label ?? null,
  };
}

function formatVerifyDebugInputSnapshot(
  snapshot: Array<{ label: string; value: string }>
): string {
  return snapshot
    .map((entry) => `${entry.label}=${entry.value}`)
    .join(', ');
}

function describeVerifyDebugSummary(context: VerifyDebugContext): string {
  const base = `Verify expected ${context.signal}=${context.expected} but sampled ${context.actual} at tick ${context.tick}.`;
  if (context.patternSummary) {
    return `${base} ${context.patternSummary}`;
  }
  return base;
}

function normalizeSignalLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\[[^\]]+\]/g, '');
}

function resolveVerifyLinkedSignalKey(
  activeVerifySignal: string | null | undefined,
  ioRows: Array<{ nodeId: string; label: string; port: string; direction: 'in' | 'out' }>,
  liveSignals: Map<string, 0 | 1>,
  runtimeSignals: Record<string, 0 | 1>
): string | null {
  const raw = (activeVerifySignal ?? '').trim();
  if (raw.length === 0) return null;
  const normalized = normalizeSignalLookup(raw);
  const availableSignalKeys = new Set<string>([
    ...liveSignals.keys(),
    ...Object.keys(runtimeSignals),
  ]);

  for (const key of availableSignalKeys) {
    if (normalizeSignalLookup(key) === normalized) return key;
  }

  const matchedRow = ioRows.find((row) => normalizeSignalLookup(row.label) === normalized);
  if (matchedRow) {
    const preferredKey = `${matchedRow.nodeId}.${matchedRow.port}`;
    if (availableSignalKeys.has(preferredKey)) return preferredKey;
    const fallbackKeys = matchedRow.direction === 'out'
      ? [`${matchedRow.nodeId}.in`, `${matchedRow.nodeId}.out`]
      : [`${matchedRow.nodeId}.out`, `${matchedRow.nodeId}.in`];
    const fallback = fallbackKeys.find((candidate) => availableSignalKeys.has(candidate));
    if (fallback) return fallback;
    return preferredKey;
  }

  for (const key of availableSignalKeys) {
    const [nodeId] = key.split('.');
    if (normalizeSignalLookup(nodeId) === normalized) return key;
  }

  return null;
}

function normalizeCircuitForCanvas(circuit: Circuit): Circuit {
  return {
    ...circuit,
    nodes: circuit.nodes.map((node) => {
      const fallbackX = typeof node.x === 'number' ? node.x : 0;
      const fallbackY = typeof node.y === 'number' ? node.y : 0;
      const position = node.position ?? { x: fallbackX, y: fallbackY };
      return {
        ...node,
        position,
        x: position.x,
        y: position.y,
        config: node.config ?? {},
        state: node.state ?? {},
      };
    }),
    connections: circuit.connections.map((connection) => ({ ...connection })),
  };
}

function pickPrimaryNodeSignalKey(
  node: Node,
  pins: string[],
  runtimeSignals: Record<string, 0 | 1>,
  liveSignals: Map<string, 0 | 1>
): string | null {
  const preferredPins: string[] = [];
  const pushPin = (pin: string | null | undefined) => {
    if (!pin || preferredPins.includes(pin)) return;
    preferredPins.push(pin);
  };

  if (node.type === 'OUTPUT' || node.type === 'Lamp') {
    pushPin('in');
    pushPin('out');
  } else if (node.type === 'INPUT' || node.type === 'Switch' || node.type === 'Clock') {
    pushPin('out');
    pushPin('in');
  } else {
    pushPin('out');
    pushPin('Q');
    pushPin('sum');
    pushPin('cout');
    pushPin('in');
    pushPin('a');
  }

  for (const pin of pins) pushPin(pin);

  for (const pin of preferredPins) {
    const signalKey = `${node.id}.${pin}`;
    if (liveSignals.has(signalKey) || Object.prototype.hasOwnProperty.call(runtimeSignals, signalKey)) {
      return signalKey;
    }
  }

  const fallbackPin = preferredPins[0] ?? pins[0];
  return fallbackPin ? `${node.id}.${fallbackPin}` : null;
}

function describeSignalSnapshot(
  signalKey: string | null,
  trace: RuntimeSimState['trace'],
  runtimeSignals: Record<string, 0 | 1>,
  liveSignals: Map<string, 0 | 1>
): DesignSignalSnapshot | null {
  if (!signalKey) return null;

  const matchingSamples = trace.filter((entry) =>
    Object.prototype.hasOwnProperty.call(entry.signals, signalKey)
  );
  const latestTraceValue =
    matchingSamples.length > 0
      ? matchingSamples[matchingSamples.length - 1]?.signals[signalKey] ?? null
      : null;
  const currentValue = liveSignals.get(signalKey) ?? runtimeSignals[signalKey] ?? latestTraceValue;
  const previousTraceValue =
    matchingSamples.length >= 2
      ? matchingSamples[matchingSamples.length - 2]?.signals[signalKey] ?? null
      : latestTraceValue;
  const previousValue = previousTraceValue ?? currentValue ?? null;

  let transition: DesignSignalSnapshot['transition'] = '—';
  if (currentValue != null && previousValue != null) {
    if (previousValue === currentValue) transition = 'stable';
    else transition = currentValue > previousValue ? 'rising' : 'falling';
  }
  let lastTransitionTick: number | null = null;
  for (let index = matchingSamples.length - 1; index > 0; index -= 1) {
    const currentSample = matchingSamples[index]?.signals[signalKey];
    const previousSample = matchingSamples[index - 1]?.signals[signalKey];
    if (currentSample == null || previousSample == null) continue;
    if (currentSample !== previousSample) {
      lastTransitionTick = matchingSamples[index]?.tick ?? null;
      break;
    }
  }

  return {
    currentValue: currentValue ?? null,
    previousValue,
    transition,
    samples: matchingSamples.length,
    lastTransitionTick,
  };
}

function describeNodeConnectionSummary(
  nodeId: string,
  circuit: Circuit,
  resolveConnectionEndpoint: (
    raw: Circuit['connections'][number]['from'] | Circuit['connections'][number]['to']
  ) => { nodeId: string; portName: string }
): DesignNodeConnectionSummary {
  let fanIn = 0;
  let fanOut = 0;
  const upstream: string[] = [];

  for (const connection of circuit.connections) {
    const from = resolveConnectionEndpoint(connection.from);
    const to = resolveConnectionEndpoint(connection.to);
    if (to.nodeId === nodeId) {
      fanIn += 1;
      upstream.push(`${from.nodeId}.${from.portName}`);
    }
    if (from.nodeId === nodeId) {
      fanOut += 1;
    }
  }

  let incomingLabel = 'Primary source';
  if (fanIn === 1) incomingLabel = upstream[0] ?? 'Primary source';
  else if (fanIn > 1) incomingLabel = `${fanIn} upstream sources`;

  return { fanIn, fanOut, incomingLabel };
}

function describeEndpointLabel(nodeId: string, node?: Node, ioRow?: DesignIoRow | null): string {
  const label = ioRow?.label?.trim() || node?.label?.trim();
  return label && label.length > 0 ? label : node?.type === 'INPUT' || node?.type === 'OUTPUT' ? nodeId : node?.id ?? nodeId;
}

function buildTracePortKeySet(wireIds: Iterable<string>): Set<string> {
  const portKeys = new Set<string>();
  for (const wireId of wireIds) {
    const parsed = parseWireId(wireId);
    if (!parsed) continue;
    portKeys.add(`${parsed.fromNodeId}:${parsed.fromPort}`);
    portKeys.add(`${parsed.toNodeId}:${parsed.toPort}`);
  }
  return portKeys;
}

function buildWireTraceBundle(
  circuit: Circuit,
  wireId: string
): { wireHighlights: Map<string, string[]>; nodeIds: Set<string>; portKeys: Set<string> } | null {
  const parsed = parseWireId(wireId);
  if (!parsed) return null;

  const matchingWireIds = new Set<string>();
  const nodeIds = new Set<string>();
  const portKeys = new Set<string>();

  for (const connection of circuit.connections) {
    const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
    const fromPort =
      typeof connection.from === 'string'
        ? connection.fromPort ?? connection.fromPin ?? 'out'
        : connection.from.portName ?? connection.from.port ?? 'out';
    if (fromNodeId !== parsed.fromNodeId || fromPort !== parsed.fromPort) continue;

    const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
    const toPort =
      typeof connection.to === 'string'
        ? connection.toPort ?? connection.toPin ?? 'in'
        : connection.to.portName ?? connection.to.port ?? 'in';
    const nextWireId = `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}`;
    matchingWireIds.add(nextWireId);
    nodeIds.add(fromNodeId);
    nodeIds.add(toNodeId);
    portKeys.add(`${fromNodeId}:${fromPort}`);
    portKeys.add(`${toNodeId}:${toPort}`);
  }

  if (matchingWireIds.size === 0) return null;

  const wireHighlights = new Map<string, string[]>();
  for (const id of matchingWireIds) {
    wireHighlights.set(id, ['#fbbf24']);
  }

  return { wireHighlights, nodeIds, portKeys };
}

function dedupeDesignIssues(issues: DesignIssue[]): DesignIssue[] {
  const seen = new Set<string>();
  const result: DesignIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.kind}:${issue.portKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result.sort(compareDesignIssues);
}

function describeDesignIssueLocation(issue: DesignIssue, circuit: Circuit): string {
  const node = circuit.nodes.find((entry) => entry.id === issue.nodeId);
  const nodeLabel = node?.label?.trim() ? node.label.trim() : node?.id ?? issue.nodeId;
  const prefix = `${issue.nodeId}.`;
  const rawPortName =
    issue.focusTarget.portKey ??
    (issue.portKey.startsWith(prefix) ? issue.portKey.slice(prefix.length) : '');
  if (!rawPortName || rawPortName === '__self') {
    return nodeLabel;
  }
  return `${nodeLabel}.${rawPortName}`;
}

function predictNextNodeIds(circuit: Circuit, count: number): string[] {
  const prefix = 'node-v2-';
  let maxNumeric = 0;
  for (const node of circuit.nodes) {
    const match = /^node-v2-(\d+)$/.exec(node.id);
    if (!match) continue;
    const value = Number.parseInt(match[1] ?? '0', 10);
    if (Number.isFinite(value)) {
      maxNumeric = Math.max(maxNumeric, value);
    }
  }
  return Array.from({ length: Math.max(0, count) }, (_, index) => `${prefix}${maxNumeric + index + 1}`);
}

const NODE_PIN_CATALOG: Record<string, string[]> = {
  INPUT: ['out'],
  OUTPUT: ['in'],
  Switch: ['out'],
  Lamp: ['in'],
  Clock: ['out'],
  AND: ['a', 'b', 'out'],
  OR: ['a', 'b', 'out'],
  XOR: ['a', 'b', 'out'],
  NOT: ['in', 'out'],
  NAND: ['a', 'b', 'out'],
  NOR: ['a', 'b', 'out'],
  XNOR: ['a', 'b', 'out'],
  BUF: ['in', 'out'],
  DFlipFlop: ['D', 'CLK', 'Q'],
};

function deriveNodePins(node: Node | undefined, circuit: Circuit): string[] {
  if (!node) return [];
  const canonicalMetadata = getDesignChipMetadata(node.type);
  if (canonicalMetadata) {
    return Array.from(
      new Set([
        ...canonicalMetadata.inputs.map((port) => port.id),
        ...canonicalMetadata.outputs.map((port) => port.id),
      ])
    );
  }
  const listed = NODE_PIN_CATALOG[node.type];
  if (listed && listed.length > 0) return listed;

  const inferred = new Set<string>();
  for (const connection of circuit.connections) {
    const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
    const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
    if (fromNodeId === node.id) {
      const fromPort =
        typeof connection.from === 'string'
          ? connection.fromPort ?? connection.fromPin ?? 'out'
          : connection.from.portName ?? connection.from.port ?? 'out';
      inferred.add(fromPort);
    }
    if (toNodeId === node.id) {
      const toPort =
        typeof connection.to === 'string'
          ? connection.toPort ?? connection.toPin ?? 'in'
          : connection.to.portName ?? connection.to.port ?? 'in';
      inferred.add(toPort);
    }
  }

  if (inferred.size === 0) {
    inferred.add('in');
    inferred.add('out');
  }

  return Array.from(inferred).sort();
}

function buildCircuitIrHashPayload(circuit: Circuit): unknown {
  const nodes = circuit.nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      position: {
        x: Math.round((node.position?.x ?? 0) * 1000) / 1000,
        y: Math.round((node.position?.y ?? 0) * 1000) / 1000,
      },
      config: node.config ?? {},
      state: node.state ?? {},
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const connections = circuit.connections
    .map((connection) => {
      const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
      const fromPort = typeof connection.from === 'string'
        ? connection.fromPort ?? connection.fromPin ?? 'out'
        : connection.from.portName ?? connection.from.port ?? 'out';
      const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
      const toPort = typeof connection.to === 'string'
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

  return { nodes, connections };
}

function describeNodeProperties(node: Node): Array<{ key: string; value: string }> {
  const values = new Map<string, unknown>();
  values.set('type', node.type);
  values.set('x', Math.round((node.position?.x ?? 0) * 1000) / 1000);
  values.set('y', Math.round((node.position?.y ?? 0) * 1000) / 1000);

  const config = node.config ?? {};
  const state = node.state ?? {};
  for (const key of Object.keys(config).sort(compareText)) {
    values.set(`config.${key}`, (config as Record<string, unknown>)[key]);
  }
  for (const key of Object.keys(state).sort(compareText)) {
    values.set(`state.${key}`, (state as Record<string, unknown>)[key]);
  }

  return Array.from(values.entries()).map(([key, value]) => ({
    key,
    value: stringifyPropertyValue(value),
  }));
}

function summarizeSelectionTypes(
  selectedNodeIds: Set<string>,
  circuit: Circuit
): Array<{ type: string; count: number }> {
  const typeCounts = new Map<string, number>();
  for (const nodeId of selectedNodeIds) {
    const node = circuit.nodes.find((entry) => entry.id === nodeId);
    if (!node) continue;
    typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1);
  }
  return Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => compareText(left.type, right.type));
}

function resolveDiagnosticNodeIds(diagnostic: IdeDiagnostic, circuit: Circuit): string[] {
  const directNodeId = normalizeDiagnosticToken(diagnostic.owner.nodeId);
  if (directNodeId.length > 0) {
    const exists = circuit.nodes.find((node) => normalizeDiagnosticToken(node.id) === directNodeId);
    return exists ? [exists.id] : [];
  }

  const candidateTokens = new Set<string>();
  candidateTokens.add(normalizeDiagnosticToken(diagnostic.owner.portName));
  candidateTokens.add(normalizeDiagnosticToken(diagnostic.owner.mappingKey));
  if (Array.from(candidateTokens).every((entry) => entry.length === 0)) return [];

  const matches: string[] = [];
  for (const node of circuit.nodes) {
    const nodePins = deriveNodePins(node, circuit);
    if (diagnosticMatchesNodeTokens(candidateTokens, node, nodePins)) {
      matches.push(node.id);
    }
  }
  return matches;
}

function diagnosticMatchesNodeTokens(
  candidateTokens: Set<string>,
  node: Node,
  nodePins: string[]
): boolean {
  const nodeTokens = new Set<string>([
    normalizeDiagnosticToken(node.id),
    normalizeDiagnosticToken(node.label),
    normalizeDiagnosticToken(node.type),
  ]);

  for (const pin of nodePins) {
    nodeTokens.add(normalizeDiagnosticToken(pin));
    nodeTokens.add(normalizeDiagnosticToken(`${node.id}.${pin}`));
    if (node.label) {
      nodeTokens.add(normalizeDiagnosticToken(`${node.label}.${pin}`));
    }
  }

  for (const candidate of candidateTokens) {
    if (!candidate) continue;
    for (const token of nodeTokens) {
      if (!token) continue;
      if (candidate === token || candidate.endsWith(`.${token}`) || token.endsWith(`.${candidate}`)) {
        return true;
      }
    }
  }
  return false;
}

function stringifyPropertyValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function normalizeDiagnosticToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
