import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Circuit, CompositeNodeDef, Node } from '@redbyte/rb-logic-core';
import { getComponentSupport, isNodeTypeSupportedFor, TickEngine } from '@redbyte/rb-logic-core';
import {
  LogicCanvas,
  describePortRefForStudents,
  describeWireRejectionForStudents,
  describeWireSourceCue,
  findSmartSpawnPosition,
  useLogicViewStore,
  wireRejectionMessage,
  type ChipMetadata,
  type NodeIoPresentation,
} from '@redbyte/rb-logic-view';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { digestValue } from '../../../utils/digest';
import { parseWireId } from '../../../utils/wireId';
import type { IdeDiagnostic, IdeDiagnosticRouteRequest } from '../diagnostics';
import type { DesignFocusRequest } from '../designFocus';
import {
  DesignFocusBanner,
  type DesignFocusContext,
} from '../components/DesignFocusBanner';
import { DesignFocusInspector } from '../components/DesignFocusInspector';
import { buildDesignDebugSignalTrace, getFaninCone, getFanoutCone } from '../pathTrace';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeEmptyState,
  IdeInspectorSection,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { RuntimeSimState, RuntimeSignalProbe, RuntimeVerifyRun } from '../projectRuntime';
import { useBoardSignal } from '../BoardSignalContext';
import { getStudentFacingIoLabel, normalizeIoSignalKey } from '../ioLabels';
import type { TimingGuidance } from '../timingGuidance';
import type {
  FullAdderLabDesignChecklist,
  GuidedLabTaskDefinition,
} from '../labTaskDefinition';
import {
  formatVerifyDebugInputSnapshot,
  formatVerifyMismatchBrief,
  getVerifyDebugDisplaySignal,
  type VerifyDebugContext,
} from '../verifyDebug';
import { netlistFromCircuit } from '../../../export/netlistExport';
import { vhdlFromNetlist } from '../../../export/vhdlExport';
import { synthesizableVerilogFromNetlist } from '../../../export/verilogExport';
import { buildVhdlTopLevelBindings } from '../../../fpga/boards/basys3/basys3Bundle';
import { getBasys3BoardResource } from '../../../fpga/boards/basys3/basys3Pins';
import { resolveBasys3SignalBinding } from '../../../fpga/boards/basys3/basys3SignalSemantics';
import { SIGNAL_LANGUAGE } from '../productLanguage';
import { PROFESSIONAL_CLASSROOM_COPY } from '../productUiStandards';
import { getDesignChipMetadata } from '../designChipMetadata';
import {
  getDesignChipMetadataForNode,
  normalizeRegisterWidth,
  REGISTER_FAMILY_TYPES,
} from '../registerFamilyChipMetadata';
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
import { DesignWorkspaceFrame } from './DesignWorkspaceFrame';
import {
  DEFAULT_DESIGN_SPLIT_RATIO,
  DESIGN_ARTIFACT_DESCRIPTORS,
  resolveDesignWorkspacePreset,
  type DesignArtifact,
} from './designWorkspaceConfig';
import type { IdeChromeContract } from '../chromeContract';

export const CHROME_CONTRACT = {
  surfaceId: 'design',
  topStripSlots: ['command-bar', 'status-row'],
  leftDockPolicy: 'always',
  rightDockPolicy: 'always',
  exitPaths: [],
} satisfies IdeChromeContract;

/** Maps internal node type strings to student-readable labels for toast feedback. */
function nodeTypeLabel(nodeType: string): string {
  const supportLabel = getComponentSupport(nodeType)?.label;
  if (supportLabel) return supportLabel;

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
    Ground: 'Ground',
    DLatch: 'D latch',
    DFlipFlop: 'D flip-flop',
    Register1: '1-bit register',
    RegisterBus: 'bus register',
    StateBank: 'state bank',
    TFlipFlop: 'T flip-flop',
    JKFlipFlop: 'JK flip-flop',
    RSLatch: 'RS latch',
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
  return wireRejectionMessage(reason);
}

export interface DesignSurfaceProps {
  onCircuitMutated?: (circuit: Circuit) => void;
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
  onRuntimeUndo?: () => void;
  onRuntimeRedo?: () => void;
  runtimeUndoDepth?: number;
  runtimeRedoDepth?: number;
  compilerStatus?: DesignCompilerStatus;
  onDiagnosticAction?: (diagnostic: IdeDiagnostic) => void;
  diagnosticRouteRequest?: IdeDiagnosticRouteRequest | null;
  /**
   * One-shot focus ticket from the Project surface. When set, the Design
   * surface arms the referenced macro for placement (macro) or seeds the
   * palette query (custom-component) so the student lands on the asset they
   * asked for. The consumer should call `onClearDesignFocus` after handling.
   */
  designFocusRequest?: DesignFocusRequest | null;
  onClearDesignFocus?: () => void;
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
  starterContext?: {
    name: string;
    lab?: string;
    concept?: string;
    summary?: string;
    expectedBehavior?: string;
    nextAction?: string;
  };
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
  /**
   * Full composite definitions for custom components. Used by the focused
   * asset inspector to surface port-by-port interface truth. The palette
   * continues to use the lighter `customComponentTypes` projection.
   */
  customComponentDefs?: CompositeNodeDef[];
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
  replaySession?: Pick<RuntimeVerifyRun, 'waveform' | 'meta'> | null;
  onClearExternalDebug?: () => void;
  onClearVerifyFocus?: () => void;
  // C-5b: Tick navigation within the debug waveform
  onPrevDebugTick?: () => void;
  onNextDebugTick?: () => void;
  onSelectDebugTickIndex?: (index: number) => void;
  debugTickIndex?: number;
  debugTickCount?: number;
  // A2: Verify → Design signal linkage
  activeVerifySignal?: string | null;
  timingGuidance?: TimingGuidance;
  guidedLabTask?: GuidedLabTaskDefinition | null;
  guidedLabDesignChecklist?: FullAdderLabDesignChecklist | null;
  onAddGuidedLabInput?: (label: string) => void;
  onAddGuidedLabOutput?: (label: string) => void;
  onAddGuidedLabFullAdder?: () => void;
}

export interface DesignCompilerStatus {
  dirtySinceVerify: boolean;
  dirtySinceExport: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: IdeDiagnostic[];
}

interface StaleReplayBreadcrumb {
  tick: number;
  caseIndex: number | null;
  caseCount: number | null;
  signal: string | null;
  timingHint: string | null;
  sourceSession: Pick<RuntimeVerifyRun, 'waveform' | 'meta'> | null;
}

interface PaletteItem {
  type: string;
  title: string;
  category: 'IO' | 'Logic' | 'Sequential' | 'Components';
  subtitle: string;
  glyph: string;
  searchTerms: string[];
  /** Sequential palette grouping (Design dock only). */
  sequentialTier?: 'registers' | 'timing' | 'legacy';
  /** Optional badge on the palette card (e.g. Native / Legacy). */
  paletteBadge?: string;
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

interface PlacementGhostState {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
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

type DesignDockSectionId = 'board' | 'live-inputs';

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

const CORE_PALETTE_ITEMS: PaletteItem[] = [
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
    type: 'AND3',
    title: 'AND3 Gate',
    category: 'Logic',
    subtitle: '3-input AND: high only when all three inputs are high.',
    glyph: 'AND3',
    searchTerms: ['gate', 'logic', 'three input', '3 input'],
  },
  {
    type: 'OR3',
    title: 'OR3 Gate',
    category: 'Logic',
    subtitle: '3-input OR: high when any input is high.',
    glyph: 'OR3',
    searchTerms: ['gate', 'logic', 'three input', '3 input'],
  },
  {
    type: 'NAND3',
    title: 'NAND3 Gate',
    category: 'Logic',
    subtitle: '3-input NAND: low only when all three inputs are high.',
    glyph: 'NAND3',
    searchTerms: ['gate', 'logic', 'three input', '3 input', 'universal'],
  },
  {
    type: 'NOR3',
    title: 'NOR3 Gate',
    category: 'Logic',
    subtitle: '3-input NOR: high only when all three inputs are low.',
    glyph: 'NOR3',
    searchTerms: ['gate', 'logic', 'three input', '3 input', 'universal'],
  },
  {
    type: 'XOR3',
    title: 'XOR3 Gate',
    category: 'Logic',
    subtitle: '3-input XOR: high when an odd number of inputs are high.',
    glyph: 'XOR3',
    searchTerms: ['gate', 'logic', 'three input', '3 input', 'parity'],
  },
  {
    type: 'Register1',
    title: 'Register (1-bit)',
    category: 'Sequential',
    sequentialTier: 'registers',
    paletteBadge: 'Native',
    subtitle: 'Preferred 1-bit register: width, CE, reset kind, and polarities are first-class.',
    glyph: 'REG1',
    searchTerms: ['register', 'dff', 'state', 'memory', 'fdce', 'sequential', 'flip flop'],
  },
  {
    type: 'RegisterBus',
    title: 'Register (Bus)',
    category: 'Sequential',
    sequentialTier: 'registers',
    paletteBadge: 'Native',
    subtitle: 'Packed multi-bit register with per-bit D[i] / Q[i] taps for combinational logic.',
    glyph: 'REGB',
    searchTerms: ['register', 'bus', 'state', 'bank', 'vector', 'slice', 'tap', 'bit'],
  },
  {
    type: 'StateBank',
    title: 'State Bank',
    category: 'Sequential',
    sequentialTier: 'registers',
    paletteBadge: 'Native',
    subtitle: 'Grouped state for FSM-style clusters — same semantics as Register (Bus), different intent.',
    glyph: 'BANK',
    searchTerms: ['state', 'bank', 'register bank', 'fsm', 'sequential'],
  },
  // Slice N7 — chrome rebuild: Sim Clock palette entry REMOVED.
  // Canonical clock model (Plan §4.1): one clock concept visible to the user — the
  // board clock CLK100MHZ from Board Resources. Pure-sim sequential designs auto-
  // inject `__sim_clk__` (rb-apps/.../verifySchedule.ts), so students never need
  // to place a Clock node themselves. Existing serialized projects with legacy
  // Clock nodes (no role) continue to load and elaborate correctly via the IR
  // backward-compat path established in Slice M.
  {
    type: 'DFlipFlop',
    title: 'DFF',
    category: 'Sequential',
    sequentialTier: 'legacy',
    paletteBadge: 'Legacy',
    subtitle: 'Classic single-bit D flip-flop — prefer Register (1-bit) for new native projects.',
    glyph: 'DFF',
    searchTerms: ['flip flop', 'flipflop', 'register', 'state', 'memory'],
  },
  {
    type: 'INPUT',
    title: 'Input Pin',
    category: 'IO',
    subtitle: 'Generic named input — give it any signal name. To start from a specific Basys3 switch, button, or clock, use Board Resources instead.',
    glyph: 'IN',
    searchTerms: ['input', 'pin', 'source', 'io', 'i/o'],
  },
  {
    type: 'OUTPUT',
    title: 'Output Pin',
    category: 'IO',
    subtitle: 'Generic named output — give it any signal name. To start from a specific Basys3 LED or display segment, use Board Resources instead.',
    glyph: 'OUT',
    searchTerms: ['output', 'pin', 'sink', 'probe', 'io', 'i/o'],
  },
  {
    type: 'Ground',
    title: 'Ground',
    category: 'IO',
    subtitle: 'Constant logic 0 source for reset and clear wiring.',
    glyph: '0',
    searchTerms: ['ground', 'constant', 'zero', 'low', 'clear'],
  },
];

const CORE_COMPOSITE_PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'RSLatch',
    title: 'RS Latch',
    category: 'Components',
    paletteBadge: '⚠ Latch',
    subtitle: 'Bistable latch with set/reset. Vivado warns on inferred latches — use Register (1-bit) for FPGA designs. Latches are valid for simulation and theory work.',
    glyph: 'RS',
    searchTerms: ['latch', 'memory', 'state', 'bistable'],
  },
  {
    type: 'DLatch',
    title: 'D Latch',
    category: 'Components',
    paletteBadge: '⚠ Latch',
    subtitle: 'Level-sensitive latch with enable. Vivado warns on inferred latches — use Register (1-bit) for FPGA designs. Latches are valid for simulation and theory work.',
    glyph: 'DL',
    searchTerms: ['latch', 'memory', 'state', 'gated', 'level'],
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
    type: 'TFlipFlop',
    title: 'T Flip-flop',
    category: 'Components',
    paletteBadge: 'Legacy',
    subtitle: 'Legacy toggle primitive — prefer Register (1-bit) with feedback for new builds.',
    glyph: 'TFF',
    searchTerms: ['flip flop', 'flipflop', 'toggle', 'state', 'tff'],
  },
  {
    type: 'FullAdder',
    title: 'Full Adder',
    category: 'Components',
    subtitle: 'Built-in arithmetic block for sum and carry logic.',
    glyph: 'ADD',
    searchTerms: ['adder', 'arithmetic', 'sum', 'carry'],
  },
  // Counter4Bit removed from palette — stub implementation (no real counting logic).
  // Restore when Counter4Bit composite is properly implemented with flip-flops.
];

const PALETTE_ITEMS: PaletteItem[] = CORE_PALETTE_ITEMS.filter((item) =>
  isNodeTypeSupportedFor(item.type, 'authoring') &&
  isNodeTypeSupportedFor(item.type, 'classroom')
);

const COMPOSITE_PALETTE_ITEMS: PaletteItem[] = CORE_COMPOSITE_PALETTE_ITEMS.filter((item) =>
  isNodeTypeSupportedFor(item.type, 'authoring') &&
  isNodeTypeSupportedFor(item.type, 'classroom')
);

const PALETTE_SECTION_ORDER: PaletteSectionDefinition[] = [
  {
    id: 'board',
    title: 'Board Resources',
    description:
      'Basys3 physical pins — place these to name your I/O signals directly from the board. Placing SW3 creates an input pin pre-configured as SW3; placing LD0 creates an output pin pre-configured as LD0. You will still assign board mappings in Map Pins.',
  },
  {
    id: 'io',
    title: 'Inputs & Outputs',
    description:
      'Generic pins for abstract or board-agnostic designs. Name them anything you like. Use Board Resources (above) to start from specific Basys3 hardware signals instead.',
  },
  {
    id: 'logic',
    title: 'Logic Gates',
    description: 'Core combinational building blocks for the main circuit path.',
  },
  {
    id: 'sequential',
    title: 'Sequential & Timing',
    description:
      'Native registers and state banks first, then timing sources — legacy DFF/TFF sit in clearly marked tiers.',
  },
  {
    id: 'reusable',
    title: 'Reusable Blocks',
    description: 'Built-in helpers, saved macros, and custom parts you can place quickly.',
  },
];

const SEQUENTIAL_PALETTE_SUBSECTIONS: readonly {
  key: 'sequentialRegisters' | 'sequentialTiming' | 'sequentialLegacy';
  title: string;
  description: string;
  testId: string;
}[] = [
  {
    key: 'sequentialRegisters',
    title: 'Registers & state banks',
    description: 'Native path: width, clock enable, reset behavior, and edge polarity are explicit.',
    testId: 'ide-design-palette-sequential-registers',
  },
  {
    key: 'sequentialTiming',
    title: 'Timing',
    description: 'Clock sources that drive sequential updates (map to board timing in Map Pins).',
    testId: 'ide-design-palette-sequential-timing',
  },
  {
    key: 'sequentialLegacy',
    title: 'Legacy primitives',
    description: 'Classic DFF for imports and tutorials — new work should start with Native registers.',
    testId: 'ide-design-palette-sequential-legacy',
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
      title: 'Switches (SW0–SW15)',
      description: 'Adds a pre-named input pin. Assign its board mapping in Map Pins.',
      entries: inputs.filter((entry) => entry.kind === 'switch'),
    },
    {
      id: 'buttons',
      title: 'Buttons (BTNC/U/L/R/D)',
      description: 'Adds a pre-named button input. Assign its board mapping in Map Pins.',
      entries: inputs.filter((entry) => entry.kind === 'button'),
    },
    {
      id: 'system',
      title: 'Clock & Reset',
      // Slice N7 — sharpened messaging to make CLK100MHZ the single canonical
      // clock surface. Sequential designs without an explicit board clock
      // automatically use an internal sim clock — students do not place one.
      description: 'CLK100MHZ is the Basys3 100 MHz board clock. Drag it onto the canvas for any sequential FPGA design. Designs without a board clock automatically use an internal sim clock for simulation only — no manual setup needed.',
      entries: inputs.filter((entry) => entry.kind === 'clock' || entry.kind === 'reset'),
    },
    {
      id: 'leds',
      title: 'LEDs (LD0–LD15)',
      description: 'Adds a pre-named output pin. Assign its board mapping in Map Pins.',
      entries: outputs.filter((entry) => entry.kind === 'led'),
    },
    {
      id: 'display',
      title: 'Seven Segment Display',
      description: 'Segment, digit-select, and decimal point outputs. Assign board mappings in Map Pins.',
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

type DesignCanvasViewport = { width: number; height: number };

function isDesignCanvasViewport(value: unknown): value is DesignCanvasViewport {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DesignCanvasViewport>;
  return (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    Number.isFinite(candidate.width) &&
    Number.isFinite(candidate.height) &&
    candidate.width > 0 &&
    candidate.height > 0
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
  matchKeys: string[];
}

interface DesignSimulationStory {
  summary: string;
  clockEvent: 'rising' | 'falling' | null;
  clockLabel: string | null;
}

interface DesignSequentialInspectorContext {
  kind: 'clock' | 'flip-flop' | 'latch' | 'rs-latch' | 'register-family';
  roleLabel: string;
  behaviorSummary: string;
  nextStep: string;
  controlLabel: string | null;
  controlSourceLabel: string | null;
  controlActivity: string | null;
  ioSummaryLabel: string;
  ioSummary: string;
  stateSummaryLabel: string;
  stateSummary: string;
  timingContext: string;
  actionKind: 'trace-control' | 'go-to-hardware' | null;
  actionLabel: string | null;
  actionPort: string | null;
}

/** Short teaching copy for the selection identity card — not a substitute for the sequential callout. */
interface DesignNodeTeachingProfile {
  partKind: string;
  whatItIs: string;
  structureHint: string | null;
}

const NODE_TEACHING_COMBINATIONAL_TYPES = new Set<string>([
  'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR',
  'AND3', 'OR3', 'NAND3', 'NOR3', 'XOR3',
  'MUX', 'DEMUX', 'DECODER', 'ENCODER', 'HALFADDER', 'FULLADDER', 'BUFFER',
]);
const NODE_TEACHING_BOARD_IO_TYPES = new Set<string>(['INPUT', 'OUTPUT', 'Switch', 'Lamp', 'Clock']);

function teachingFirstSentence(behaviorSummary: string): string {
  const t = behaviorSummary.trim();
  const cut = t.indexOf('. ');
  if (cut === -1) return t.length > 240 ? `${t.slice(0, 237)}…` : t;
  return t.slice(0, cut + 1);
}

function resolveNodeInspectionTeachingProfile(
  node: Node,
  input: {
    sequential: DesignSequentialInspectorContext | null;
    customComponentDefs?: CompositeNodeDef[];
    customComponentTypes?: Array<{ type: string; title: string; description: string }>;
  }
): DesignNodeTeachingProfile {
  const { sequential, customComponentDefs, customComponentTypes } = input;
  const fromTypes = customComponentTypes?.find((c) => c.type === node.type);
  const fromDefs = customComponentDefs?.find((c) => c.name === node.type);
  if (fromTypes || fromDefs) {
    const title = fromTypes?.title?.trim() || fromDefs?.name?.trim() || nodeTypeLabel(node.type);
    const desc = (fromTypes?.description ?? fromDefs?.description ?? '').trim();
    return {
      partKind: 'Saved component',
      whatItIs:
        desc.length > 0
          ? desc
          : `Reusable “${title}” from your project — it behaves like a single block; connect only through its ports.`,
      structureHint:
        'Internals are fixed in this build — use the port list in the lower inspector to see inputs and outputs.',
    };
  }
  if (sequential) {
    return {
      partKind: 'Sequential',
      whatItIs: teachingFirstSentence(sequential.behaviorSummary),
      structureHint:
        'Port roles and timing are expanded in the Sequential guidance card below; follow clock/enable before you trust Q outputs.',
    };
  }
  if (NODE_TEACHING_BOARD_IO_TYPES.has(node.type)) {
    if (node.type === 'INPUT' || node.type === 'Switch') {
      return {
        partKind: 'Board I/O',
        whatItIs: 'Drives a test or board input into the schematic — Map Pins ties it to a physical switch or pin when you go to the board.',
        structureHint: null,
      };
    }
    if (node.type === 'OUTPUT' || node.type === 'Lamp') {
      return {
        partKind: 'Board I/O',
        whatItIs: 'Receives a net that should reach an LED or other board output; Map Pins assigns the Basys3 pin name.',
        structureHint: null,
      };
    }
    if (node.type === 'Clock') {
      return {
        partKind: 'Board I/O',
        whatItIs: 'A timing source for clocked (sequential) logic — fan out from here to flip-flop CLK and register clock pins.',
        structureHint: null,
      };
    }
  }
  if (NODE_TEACHING_COMBINATIONAL_TYPES.has(node.type)) {
    return {
      partKind: 'Combinational',
      whatItIs: 'Pure Boolean logic: outputs depend only on the current input values, not on earlier clock cycles.',
      structureHint: null,
    };
  }
  return {
    partKind: 'Primitive',
    whatItIs: `${nodeTypeLabel(node.type)} — a built-in palette block for this course.`,
    structureHint: null,
  };
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

/**
 * Gate type swap families — all types within a family share identical port names
 * and can be swapped without dropping any connections.
 *
 * 2-input family: a, b, out
 * 3-input family: a, b, c, out
 */
const GATE_SWAP_FAMILIES: Partial<Record<string, readonly string[]>> = {
  AND:   ['NAND', 'NOR', 'OR', 'XOR', 'XNOR'],
  NAND:  ['AND', 'NOR', 'OR', 'XOR', 'XNOR'],
  NOR:   ['AND', 'NAND', 'OR', 'XOR', 'XNOR'],
  OR:    ['AND', 'NAND', 'NOR', 'XOR', 'XNOR'],
  XOR:   ['AND', 'NAND', 'NOR', 'OR', 'XNOR'],
  XNOR:  ['AND', 'NAND', 'NOR', 'OR', 'XOR'],
  AND3:  ['NAND3', 'NOR3', 'OR3', 'XOR3'],
  NAND3: ['AND3', 'NOR3', 'OR3', 'XOR3'],
  NOR3:  ['AND3', 'NAND3', 'OR3', 'XOR3'],
  OR3:   ['AND3', 'NAND3', 'NOR3', 'XOR3'],
  XOR3:  ['AND3', 'NAND3', 'NOR3', 'OR3'],
};

export const DesignSurface: React.FC<DesignSurfaceProps> = ({
  onCircuitMutated,
  onRuntimeAddNode,
  onRuntimeAddIo,
  onRuntimeAddBoardIo,
  onRuntimeConnect,
  onRuntimeUndo,
  onRuntimeRedo,
  runtimeUndoDepth,
  runtimeRedoDepth,
  compilerStatus,
  onDiagnosticAction,
  diagnosticRouteRequest,
  designFocusRequest,
  onClearDesignFocus,
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
  starterContext,
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
  customComponentDefs,
  macros = [],
  onSaveMacro,
  onDeleteMacro,
  onInstantiateMacro,
  externalDebugSignals,
  externalDebugTick,
  externalDebugContext,
  replaySession,
  onClearExternalDebug,
  onClearVerifyFocus,
  onPrevDebugTick,
  onNextDebugTick,
  onSelectDebugTickIndex,
  debugTickIndex,
  debugTickCount,
  activeVerifySignal,
  timingGuidance,
  guidedLabTask,
  guidedLabDesignChecklist,
  onAddGuidedLabInput,
  onAddGuidedLabOutput,
  onAddGuidedLabFullAdder,
}) => {
  const circuit = useCircuitStore((state) => state.circuit);
  const addNode = useCircuitStore((state) => state.addNode);
  const updateCircuit = useCircuitStore((state) => state.updateCircuit);
  const deleteNode = useCircuitStore((state) => state.deleteNode);
  const deleteConnection = useCircuitStore((state) => state.deleteConnection);
  const setEngine = useCircuitStore((state) => state.setEngine);
  const setTickEngine = useCircuitStore((state) => state.setTickEngine);
  const updateNode = useCircuitStore((state) => state.updateNode);
  const undoDepth = runtimeUndoDepth ?? 0;
  const redoDepth = runtimeRedoDepth ?? 0;

  const camera = useLogicViewStore((state) => state.camera);
  const toolMode = useLogicViewStore((state) => state.toolMode);
  const setToolMode = useLogicViewStore((state) => state.setToolMode);
  const setInteractionMode = useLogicViewStore((state) => state.setInteractionMode);
  const selectMultipleNodes = useLogicViewStore((state) => state.selectMultipleNodes);
  const snapToGrid = useLogicViewStore((state) => state.snapToGrid);
  const gridSize = useLogicViewStore((state) => state.gridSize);
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
  const [collapsedDockSections, setCollapsedDockSections] = useState<ReadonlySet<DesignDockSectionId>>(
    // Board Resources start expanded — students need board parts (SW, LD, CLK100MHZ) immediately visible.
    // Live Inputs stays collapsed — it is a runtime/debug tool, not a primary authoring surface.
    () => new Set<DesignDockSectionId>(['live-inputs'])
  );
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const previousWireCountRef = useRef(editorCircuit.connections.length);
  const [canvasSize, setCanvasSize] = useState({ width: 880, height: 520 });
  const [paneRowSize, setPaneRowSize] = useState({ width: 0, height: 0 });
  const [presentationZoom, setPresentationZoom] = useState<'dense' | 'classroom'>('dense');
  const [canvasViewToolsOpen, setCanvasViewToolsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [wireFeedback, setWireFeedback] = useState<string | null>(null);
  const [focusedIssueSignalKey, setFocusedIssueSignalKey] = useState<string | null>(null);
  const [diagnosticFilterNodeId, setDiagnosticFilterNodeId] = useState<string | null>(null);
  const [tickEngine] = useState(() => new TickEngine(editorCircuit, { tickRate: 10 }));
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [showEvalOrder, setShowEvalOrder] = useState(false);
  const [designView, setDesignView] = useState<'canvas' | 'hdl' | 'split'>('canvas');
  const [designDebugEnabled, setDesignDebugEnabled] = useState(() => readDesignDebugQueryParam());
  const [hdlDraftText, setHdlDraftText] = useState('');
  const [primaryArtifact, setPrimaryArtifact] = useState<DesignArtifact>('vhdl');
  const [secondaryArtifactOpen, setSecondaryArtifactOpen] = useState(false);
  const splitRatio = useLayoutStore((state) => state.splitRatio);
  const setSplitRatio = useLayoutStore((state) => state.setSplitRatio);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const isDraggingSplitterRef = useRef(false); // sync ref — avoids stale closure in pointermove
  const hasAdjustedSplitDefaultRef = useRef(false);
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
  const [placementGhost, setPlacementGhost] = useState<PlacementGhostState | null>(null);

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
  // Auto-trace refs: track which node was auto-traced and read traceState without dep
  const autoTracedNodeRef = useRef<string | null>(null);
  /** When set, traceState wire-net was auto-applied from a lone wire selection (clears on deselect / clear / non-wire trace). */
  const autoWireSelectionTraceIdRef = useRef<string | null>(null);
  const traceStateRef = useRef<DesignTraceState | null>(null);
  traceStateRef.current = traceState;

  const clearTrace = useCallback(() => {
    lastTracedPortRef.current = null;
    autoWireSelectionTraceIdRef.current = null;
    setTraceState(null);
  }, []);

  // Force canvas host to recompute its size when view mode changes.
  // Double-rAF: first frame applies display changes, second measures new dims.
  useLayoutEffect(() => {
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
    return () => cancelAnimationFrame(outer);
  }, [designView]);

  useEffect(() => {
    if (designView !== 'split') return;
    if (hasAdjustedSplitDefaultRef.current) return;
    if (Math.abs(splitRatio - 0.5) > 0.001) return;
    setSplitRatio(DEFAULT_DESIGN_SPLIT_RATIO);
    hasAdjustedSplitDefaultRef.current = true;
  }, [designView, setSplitRatio, splitRatio]);
  const hasAutoFitRef = useRef(false);
  const lastViewportSeedRef = useRef<string | undefined>(undefined);
  const pendingDebugToggleRef = useRef<DesignDebugToggleSample | null>(null);
  const [staleReplayBreadcrumb, setStaleReplayBreadcrumb] = useState<StaleReplayBreadcrumb | null>(null);
  const runtimeSimTick = runtimeSim.tick;
  const simSpeed = runtimeSim.speedHz;
  const runtimeLiveSignals = useMemo(() => {
    const entries = Object.entries(runtimeSim.signals)
      .map(([key, value]) => [key, value === 1 ? 1 : 0] as const)
      .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
    return new Map<string, 0 | 1>(entries);
  }, [runtimeSim.signals]);
  const replayTrace = useMemo(
    () => normalizeReplayWaveformTrace(replaySession?.waveform ?? []),
    [replaySession?.waveform]
  );
  const isReplaySuppressed =
    staleReplayBreadcrumb != null &&
    staleReplayBreadcrumb.sourceSession === (replaySession ?? null) &&
    externalDebugTick != null;
  const effectiveExternalDebugTick = isReplaySuppressed ? null : externalDebugTick;
  const effectiveExternalDebugSignals = isReplaySuppressed ? null : externalDebugSignals;
  const effectiveExternalDebugContext = isReplaySuppressed ? null : externalDebugContext;
  const replayTickTraceIndex = useMemo(() => {
    if (effectiveExternalDebugTick == null || replayTrace.length === 0) return null;
    if (
      debugTickIndex != null &&
      replayTrace[debugTickIndex]?.tick === effectiveExternalDebugTick
    ) {
      return debugTickIndex;
    }
    const matchedIndex = replayTrace.findIndex((entry) => entry.tick === effectiveExternalDebugTick);
    return matchedIndex >= 0 ? matchedIndex : null;
  }, [debugTickIndex, effectiveExternalDebugTick, replayTrace]);
  const replayTraceWindow = useMemo(() => {
    if (replayTickTraceIndex == null) return null;
    return replayTrace.slice(0, replayTickTraceIndex + 1);
  }, [replayTickTraceIndex, replayTrace]);
  const replaySignals = useMemo(() => {
    if (effectiveExternalDebugTick == null) return null;
    const mergedSignals = new Map<string, 0 | 1>(runtimeLiveSignals);
    if (effectiveExternalDebugSignals) {
      // Prefer the explicit Verify-selected snapshot for current values.
      for (const [signalKey, value] of effectiveExternalDebugSignals.entries()) {
        mergedSignals.set(signalKey, value);
      }
      return mergedSignals;
    }
    if (replayTickTraceIndex == null) return mergedSignals;
    const replaySample = replayTrace[replayTickTraceIndex];
    if (!replaySample) return mergedSignals;
    for (const [signalKey, value] of Object.entries(replaySample.signals)) {
      mergedSignals.set(signalKey, value === 1 ? 1 : 0);
    }
    return mergedSignals;
  }, [effectiveExternalDebugSignals, effectiveExternalDebugTick, replayTickTraceIndex, replayTrace, runtimeLiveSignals]);
  const isReplayMode = effectiveExternalDebugTick != null;
  const liveSignals = replaySignals ?? runtimeLiveSignals;
  const displayTrace = replayTraceWindow ?? runtimeSim.trace;
  const displayRuntimeSignals = useMemo(() => {
    const mergedSignals = {
      ...runtimeSim.signals,
    };
    for (const [signalKey, value] of liveSignals.entries()) {
      mergedSignals[signalKey] = value;
    }
    return mergedSignals;
  }, [liveSignals, runtimeSim.signals]);
  const simTick = isReplayMode ? effectiveExternalDebugTick : runtimeSimTick;
  const simRunning = !isReplayMode && runtimeSim.running;
  const simModeLabel = isReplayMode ? 'Replay' : simRunning ? 'Running' : 'Paused';
  const ioRowByNodeId = useMemo(() => {
    const index = new Map<string, (typeof ioRows)[number]>();
    for (const row of ioRows) {
      const key = row.nodeId?.trim();
      if (!key) continue;
      index.set(key, row);
    }
    return index;
  }, [ioRows]);

  const handlePortClick = useCallback(
    (nodeId: string, portName: string) => {
      const portKey = `${nodeId}.${portName}`;
      if (lastTracedPortRef.current === portKey) {
        clearTrace();
        return;
      }
      lastTracedPortRef.current = portKey;
      autoWireSelectionTraceIdRef.current = null;
      const { wireIds, nodeIds } = getFaninCone(editorCircuit, nodeId);
      const highlights = new Map<string, string[]>();
      wireIds.forEach((wid) => highlights.set(wid, ['#fbbf24']));
      const portKeys = buildTracePortKeySet(wireIds);
      portKeys.add(`${nodeId}:${portName}`);
      const highlightedNodes = new Set(nodeIds);
      highlightedNodes.add(nodeId);
      setTraceState({
        kind: 'fanin-port',
        sourceKey: portKey,
        label: buildStudentFaninPortTraceLabel(editorCircuit, nodeId, portName, ioRowByNodeId),
        signalKey: `${nodeId}.${portName}`,
        wireHighlights: highlights,
        nodeIds: highlightedNodes,
        portKeys,
      });
    },
    [clearTrace, editorCircuit, ioRowByNodeId]
  );

  // Fan-out trace — highlights all wires/nodes driven by the selected source node
  const handleFanoutTrace = useCallback(
    (nodeId: string) => {
      const fanoutKey = `fanout:${nodeId}`;
      if (lastTracedPortRef.current === fanoutKey) {
        clearTrace();
        return;
      }
      lastTracedPortRef.current = fanoutKey;
      autoWireSelectionTraceIdRef.current = null;
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
        label: buildStudentFanoutPortTraceLabel(editorCircuit, nodeId, ioRowByNodeId),
        signalKey: null,
        wireHighlights: highlights,
        nodeIds: highlightedNodes,
        portKeys,
      });
    },
    [clearTrace, editorCircuit, ioRowByNodeId]
  );

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
    (nodeId: string, requestedValue: 0 | 1, source: 'canvas' | 'dock' | 'inspector') => {
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
  const markReplayStale = useCallback(() => {
    if (externalDebugTick != null) {
      const debugContext = externalDebugContext?.tick === externalDebugTick ? externalDebugContext : null;
      setStaleReplayBreadcrumb({
        tick: externalDebugTick,
        caseIndex: debugTickIndex ?? null,
        caseCount: debugTickCount ?? null,
        signal: debugContext?.signal ?? activeVerifySignal ?? null,
        timingHint: formatReplayTimingHint(replaySession?.meta ?? null),
        sourceSession: replaySession ?? null,
      });
      onClearExternalDebug?.();
    }
  }, [
    activeVerifySignal,
    debugTickCount,
    debugTickIndex,
    externalDebugContext,
    externalDebugTick,
    onClearExternalDebug,
    replaySession,
  ]);
  const emitCircuitMutation = useCallback((nextCircuit?: Circuit) => {
    markReplayStale();
    onCircuitMutated?.(nextCircuit ?? useCircuitStore.getState().circuit);
  }, [
    markReplayStale,
    onCircuitMutated,
  ]);
  const handleResumeLiveEditing = useCallback(() => {
    endWire();
    setWireFeedback(null);
    clearTrace();
    onRuntimeSimSetSelectedSignal?.(null);
    onClearVerifyFocus?.();
    onClearExternalDebug?.();
  }, [
    clearTrace,
    endWire,
    onClearExternalDebug,
    onClearVerifyFocus,
    onRuntimeSimSetSelectedSignal,
  ]);
  const getChipMetadata = useCallback((nodeType: string, node?: Node): ChipMetadata | undefined => {
    if (node) {
      return getDesignChipMetadataForNode(node) ?? getDesignChipMetadata(nodeType);
    }
    return getDesignChipMetadata(nodeType);
  }, []);

  const { setActiveBoardSignal } = useBoardSignal();
  const activeInsertionMacro = useMemo(
    () => macros.find((entry) => entry.id === activeMacroInsertionId) ?? null,
    [activeMacroInsertionId, macros]
  );
  const placementModeLabel = activeInsertionMacro?.name ?? pendingPlacement?.label ?? null;
  const starterNextAction =
    starterContext?.nextAction?.trim() ||
    'Inspect the scaffold on the canvas, then continue editing or move to Verify.';
  const isPlacementMode = placementModeLabel != null;
  // NOTE: commitRuntimeMutation was removed. onRuntime* callbacks (addDesignNode,
  // addDesignIo, addDesignBoardIo, connectDesignNodes) mutate projectRuntime directly.
  // Calling emitCircuitMutation after them races against useLayoutEffect in IdeApp
  // (projectRuntimeCircuitToEditorStore) and passes a stale circuitStore snapshot to
  // applyCircuitMutation, which then overwrites the freshly-added node. Call onRuntime*
  // functions directly; IdeApp's useLayoutEffect syncs projectRuntime → circuitStore.

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
      deleteNode(nodeId, { skipHistory: true });
    }

    for (const wireId of selectedWireIds) {
      const parsed = parseWireId(wireId);
      if (!parsed) continue;
      deleteConnection(parsed.fromNodeId, parsed.fromPort, parsed.toNodeId, parsed.toPort, {
        skipHistory: true,
      });
    }

    clearSelection();
    if (selectedNodeIds.length + selectedWireIds.length > 0) {
      setActionToast('Removed selected nodes and wires.');
      emitCircuitMutation();
    }
  }, [clearSelection, deleteConnection, deleteNode, emitCircuitMutation, selection.nodes, selection.wires]);

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
    updateCircuit(next, { skipHistory: true, enforceLimits: true });
    selectMultipleNodes(result.pastedNodes.map((n) => n.id));
    setActionToast(`Pasted ${result.pastedNodes.length} node${result.pastedNodes.length !== 1 ? 's' : ''}.`);
    setPasteStep(nextStep);
    emitCircuitMutation(next);
  }, [circuit, clipboard, emitCircuitMutation, pasteStep, selectMultipleNodes, updateCircuit]);

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
    updateCircuit(next, { skipHistory: true, enforceLimits: true });
    selectMultipleNodes(result.pastedNodes.map((n) => n.id));
    const count = result.pastedNodes.length;
    setActionToast(`Duplicated ${count} node${count !== 1 ? 's' : ''}.`);
    emitCircuitMutation(next);
  }, [circuit, emitCircuitMutation, selection.nodes, selectMultipleNodes, updateCircuit]);

  // CP-4: Select all nodes (Ctrl+A)
  const handleSelectAll = useCallback(() => {
    if (circuit.nodes.length === 0) return;
    selectMultipleNodes(circuit.nodes.map((n) => n.id));
  }, [circuit.nodes, selectMultipleNodes]);

  // CP-5: Cut = copy then delete selection (Ctrl+X)
  const handleCut = useCallback(() => {
    if (selection.nodes.size === 0) return;
    handleCopy();
    deleteSelection();
  }, [deleteSelection, handleCopy, selection.nodes]);

  const handleAlignSelection = useCallback((edge: 'left' | 'top') => {
    if (selection.nodes.size < 2) return;
    const selectedNodes = circuit.nodes.filter((node) => selection.nodes.has(node.id));
    if (selectedNodes.length < 2) return;

    const targetCoordinate =
      edge === 'left'
        ? Math.min(...selectedNodes.map((node) => node.position?.x ?? 0))
        : Math.min(...selectedNodes.map((node) => node.position?.y ?? 0));

    let didChange = false;
    const next = {
      ...circuit,
      nodes: circuit.nodes.map((node) => {
        if (!selection.nodes.has(node.id)) return node;
        const currentPosition = {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        };
        const nextPosition =
          edge === 'left'
            ? { x: targetCoordinate, y: currentPosition.y }
            : { x: currentPosition.x, y: targetCoordinate };

        if (
          currentPosition.x === nextPosition.x &&
          currentPosition.y === nextPosition.y
        ) {
          return node;
        }

        didChange = true;
        return {
          ...node,
          position: nextPosition,
        };
      }),
    };

    if (!didChange) return;

    updateCircuit(next, { skipHistory: true, enforceLimits: true });
    setActionToast(
      `Aligned ${selectedNodes.length} node${selectedNodes.length !== 1 ? 's' : ''} to the ${edge}.`
    );
    emitCircuitMutation(next);
  }, [circuit, emitCircuitMutation, selection.nodes, updateCircuit]);

  const handleDistributeSelectionHorizontally = useCallback(() => {
    if (selection.nodes.size < 3) return;
    const selectedNodes = circuit.nodes.filter((node) => selection.nodes.has(node.id));
    if (selectedNodes.length < 3) return;

    const sortedNodes = [...selectedNodes].sort((left, right) => {
      const leftX = left.position?.x ?? 0;
      const rightX = right.position?.x ?? 0;
      if (leftX !== rightX) return leftX - rightX;
      const leftY = left.position?.y ?? 0;
      const rightY = right.position?.y ?? 0;
      if (leftY !== rightY) return leftY - rightY;
      return left.id.localeCompare(right.id);
    });

    const leftmostX = sortedNodes[0]?.position?.x ?? 0;
    const rightmostX = sortedNodes[sortedNodes.length - 1]?.position?.x ?? 0;
    const step = (rightmostX - leftmostX) / (sortedNodes.length - 1);
    const distributedXById = new Map(
      sortedNodes.map((node, index) => [node.id, leftmostX + step * index])
    );

    let didChange = false;
    const next = {
      ...circuit,
      nodes: circuit.nodes.map((node) => {
        if (!selection.nodes.has(node.id)) return node;
        const targetX = distributedXById.get(node.id);
        if (typeof targetX !== 'number') return node;

        const currentPosition = {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        };

        if (currentPosition.x === targetX) {
          return node;
        }

        didChange = true;
        return {
          ...node,
          position: {
            x: targetX,
            y: currentPosition.y,
          },
        };
      }),
    };

    if (!didChange) return;

    updateCircuit(next, { skipHistory: true, enforceLimits: true });
    setActionToast(
      `Distributed ${selectedNodes.length} node${selectedNodes.length !== 1 ? 's' : ''} horizontally.`
    );
    emitCircuitMutation(next);
  }, [circuit, emitCircuitMutation, selection.nodes, updateCircuit]);

  const handleNudgeSelection = useCallback((dx: number, dy: number) => {
    if (selection.nodes.size === 0) return;
    if (dx === 0 && dy === 0) return;

    const next = {
      ...circuit,
      nodes: circuit.nodes.map((node) =>
        selection.nodes.has(node.id)
          ? {
              ...node,
              position: {
                x: (node.position?.x ?? 0) + dx,
                y: (node.position?.y ?? 0) + dy,
              },
            }
          : node
      ),
    };

    updateCircuit(next, { skipHistory: true, enforceLimits: true });
    emitCircuitMutation(next);
  }, [circuit, emitCircuitMutation, selection.nodes, updateCircuit]);

  // Shift+F: fit camera to selected nodes, or all nodes if nothing selected
  const handleFitToSelection = useCallback(() => {
    const nodesToFit =
      selection.nodes.size > 0
        ? editorCircuit.nodes.filter((n) => selection.nodes.has(n.id))
        : editorCircuit.nodes;
    if (nodesToFit.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const node of nodesToFit) {
      const px = node.position?.x ?? 0;
      const py = node.position?.y ?? 0;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
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
  }, [canvasSize, editorCircuit.nodes, selection.nodes, setCamera]);

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

  // S2/S3: Project → Design focus handoff.
  //
  // The request itself is a one-shot ticket (consumed below via
  // onClearDesignFocus). `focusedAssetContext` is the durable banner-facing
  // projection so the student can see "you are working on X" until they
  // explicitly clear it or finish placement. We do NOT introduce a parallel
  // selection authority — the actual placement/palette state still lives in
  // `activeMacroInsertionId` and `paletteQuery`.
  const [focusedAssetContext, setFocusedAssetContext] =
    useState<DesignFocusContext | null>(null);
  const lastHandledFocusRequestIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!designFocusRequest) return;
    if (lastHandledFocusRequestIdRef.current === designFocusRequest.requestId) return;
    lastHandledFocusRequestIdRef.current = designFocusRequest.requestId;

    if (designFocusRequest.kind === 'macro') {
      const macro = macros.find((m) => m.id === designFocusRequest.targetId);
      if (macro) {
        setActiveMacroInsertionId(macro.id);
        setFocusedAssetContext({
          kind: 'macro',
          macroId: macro.id,
          name: macro.name,
          ioSummary: `${macro.inputs.length} in · ${macro.outputs.length} out`,
          description: macro.description,
        });
      } else {
        // Asset disappeared between Project dispatch and Design consume;
        // surface a minimal context so the student sees something happened.
        setFocusedAssetContext({
          kind: 'macro',
          macroId: designFocusRequest.targetId,
          name: designFocusRequest.displayName,
          ioSummary: '— · —',
        });
      }
      setPaletteQuery(designFocusRequest.displayName);
    } else if (designFocusRequest.kind === 'custom-component') {
      const componentType = (customComponentTypes ?? []).find(
        (entry) => entry.type === designFocusRequest.targetId
      );
      setPaletteQuery(designFocusRequest.displayName);
      setFocusedAssetContext({
        kind: 'custom-component',
        componentName: designFocusRequest.displayName,
        description: componentType?.description,
      });
    }

    onClearDesignFocus?.();
  }, [designFocusRequest, macros, customComponentTypes, onClearDesignFocus]);

  // Auto-clear the focused-asset banner when placement completes. Detect
  // the transition activeMacroInsertionId: truthy → null, which is the
  // signal emitted by successful click-to-place (onInstantiateMacro).
  const previousMacroArmedRef = useRef(false);
  useEffect(() => {
    const isArmed = activeMacroInsertionId !== null;
    if (
      previousMacroArmedRef.current &&
      !isArmed &&
      focusedAssetContext?.kind === 'macro'
    ) {
      setFocusedAssetContext(null);
    }
    previousMacroArmedRef.current = isArmed;
  }, [activeMacroInsertionId, focusedAssetContext]);

  const handleClearFocusedAsset = useCallback(() => {
    setActiveMacroInsertionId(null);
    setPaletteQuery('');
    setFocusedAssetContext(null);
  }, []);

  // S3: inspector-facing derivations for the focused asset. Honest
  // truth only — macros expand on instantiation and have no instance
  // count, so we only surface the count for custom components.
  const focusedMacroDefinition = useMemo<MacroDefinition | undefined>(() => {
    if (!focusedAssetContext || focusedAssetContext.kind !== 'macro') return undefined;
    return macros.find((m) => m.id === focusedAssetContext.macroId);
  }, [focusedAssetContext, macros]);

  const focusedComponentDef = useMemo<CompositeNodeDef | undefined>(() => {
    if (!focusedAssetContext || focusedAssetContext.kind !== 'custom-component') {
      return undefined;
    }
    return (customComponentDefs ?? []).find(
      (def) => def.name === focusedAssetContext.componentName
    );
  }, [focusedAssetContext, customComponentDefs]);

  const focusedComponentInstanceCount = useMemo<number | undefined>(() => {
    if (!focusedAssetContext || focusedAssetContext.kind !== 'custom-component') {
      return undefined;
    }
    const typeName = focusedAssetContext.componentName;
    return editorCircuit.nodes.filter((node) => node.type === typeName).length;
  }, [focusedAssetContext, editorCircuit.nodes]);

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
    const sequential = filtered.filter((item) => item.category === 'Sequential');
    return {
      logic: filtered.filter((item) => item.category === 'Logic'),
      sequential,
      sequentialRegisters: sequential.filter((item) => item.sequentialTier === 'registers'),
      sequentialTiming: sequential.filter((item) => item.sequentialTier === 'timing'),
      sequentialLegacy: sequential.filter((item) => item.sequentialTier === 'legacy'),
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
          getBasys3BoardResource(entry.alias)?.packagePin,
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
          getBasys3BoardResource(entry.alias)?.packagePin,
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
      // Defensive: always ensure position is valid
      const safePosition = {
        x: typeof position.x === 'number' && isFinite(position.x) ? position.x : 0,
        y: typeof position.y === 'number' && isFinite(position.y) ? position.y : 0,
      };
      if (onRuntimeAddNode) {
        markReplayStale();
        onRuntimeAddNode(nodeType, safePosition);
      } else {
        addNode(nodeType, safePosition, { skipHistory: true });
        emitCircuitMutation();
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
      emitCircuitMutation,
      markReplayStale,
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
  }, [camera.x, camera.y, camera.zoom, canvasSize.height, canvasSize.width, editorCircuit.nodes, onRuntimeAddIo, spawnAtCanvasCenter]);

  const addAndGateStarter = useCallback(() => {
    if (onRuntimeAddIo && onRuntimeAddNode && onRuntimeConnect) {
      const center = {
        x: (canvasSize.width / 2 - camera.x) / camera.zoom,
        y: (canvasSize.height / 2 - camera.y) / camera.zoom,
      };
      const basePosition = findSmartSpawnPosition(editorCircuit.nodes as Node[], center);
      const [inputAId, inputBId, andId, outputId] = predictNextNodeIds(editorCircuit, 4);

      onRuntimeAddIo('input', { x: basePosition.x - 170, y: basePosition.y - 72 });
      onRuntimeAddIo('input', { x: basePosition.x - 170, y: basePosition.y + 24 });
      onRuntimeAddNode('AND', { x: basePosition.x, y: basePosition.y - 24 });
      onRuntimeAddIo('output', { x: basePosition.x + 170, y: basePosition.y - 24 });

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
    onRuntimeAddIo,
    onRuntimeAddNode,
    onRuntimeConnect,
    spawnAtCanvasCenter,
  ]);

  const addAndGateOnly = useCallback(() => {
    spawnAtCanvasCenter('AND');
    setActionToast('Added AND gate. Switch to Wire, then connect the ports.');
  }, [spawnAtCanvasCenter]);

  const cancelPendingPlacement = useCallback(
    (reason: 'cancel' | 'escape' | 'tool') => {
      if (!pendingPlacement) return;
      setPendingPlacement(null);
      setPlacementGhost(null);
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
        setPlacementGhost(null);
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
    (clientX: number, clientY: number, options?: { keepPlacing?: boolean }) => {
      if (!pendingPlacement) return;
      const position = resolveCanvasPlacementPosition(clientX, clientY);
      if (!position) return;
      const keepPlacing = options?.keepPlacing === true;

      const nextNodeId = predictNextNodeIds(editorCircuit, 1)[0] ?? null;
      if (pendingPlacement.kind === 'node' && pendingPlacement.nodeType) {
        if (onRuntimeAddNode) {
          markReplayStale();
          onRuntimeAddNode(pendingPlacement.nodeType, position);
        } else {
          addNode(pendingPlacement.nodeType, position, { skipHistory: true });
          emitCircuitMutation();
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
          addNode(entry.direction === 'in' ? 'INPUT' : 'OUTPUT', position, { skipHistory: true });
          emitCircuitMutation();
        }
        setActionToast(`Added ${entry.alias} to canvas.`);
      }

      setWireFeedback(null);
      if (!keepPlacing) {
        setPendingPlacement(null);
        setPlacementGhost(null);
      }
      if (!keepPlacing && interactionMode === 'placing') {
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
      emitCircuitMutation,
      interactionMode,
      markReplayStale,
      onRuntimeAddBoardIo,
      onRuntimeAddIo,
      onRuntimeAddNode,
      pendingPlacement,
      resolveCanvasPlacementPosition,
      selectMultipleNodes,
      setInteractionMode,
    ]
  );

  const updatePlacementGhost = useCallback(
    (clientX: number, clientY: number) => {
      if (!pendingPlacement || activeInsertionMacro || !canvasHostRef.current) return;
      const position = resolveCanvasPlacementPosition(clientX, clientY);
      if (!position) return;
      setPlacementGhost({
        screenX: position.x * camera.zoom + camera.x,
        screenY: position.y * camera.zoom + camera.y,
        worldX: position.x,
        worldY: position.y,
      });
    },
    [
      activeInsertionMacro,
      camera.x,
      camera.y,
      camera.zoom,
      pendingPlacement,
      resolveCanvasPlacementPosition,
    ]
  );

  useEffect(() => {
    if (!pendingPlacement || activeInsertionMacro || !canvasHostRef.current) {
      setPlacementGhost(null);
      return;
    }
    const rect = canvasHostRef.current.getBoundingClientRect();
    updatePlacementGhost(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [activeInsertionMacro, canvasSize.height, canvasSize.width, pendingPlacement, updatePlacementGhost]);

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
    (nextCircuit: Circuit, opts?: { isIntermediate?: boolean }) => {
      updateCircuit(normalizeCircuitForCanvas(nextCircuit), {
        skipHistory: true,
        enforceLimits: true,
      });
      if (!opts?.isIntermediate) {
        emitCircuitMutation(normalizeCircuitForCanvas(nextCircuit));
      }
      lastTracedPortRef.current = null;
      setTraceState(null);
      setWireContextMenu(null);
      setWireFeedback(null);
    },
    [emitCircuitMutation, updateCircuit]
  );

  const handleUndo = useCallback(() => {
    if (!onRuntimeUndo) return;
    onRuntimeUndo();
    if (externalDebugTick != null) {
      markReplayStale();
      onCircuitMutated?.(useCircuitStore.getState().circuit);
    }
    // Do NOT call emitCircuitMutation here — onRuntimeUndo mutates projectRuntime
    // directly; IdeApp's useLayoutEffect syncs projectRuntime → circuitStore.
    // Calling emitCircuitMutation would pass the stale circuitStore snapshot to
    // applyCircuitMutation and overwrite the undo.
  }, [externalDebugTick, markReplayStale, onCircuitMutated, onRuntimeUndo]);

  const handleRedo = useCallback(() => {
    if (!onRuntimeRedo) return;
    onRuntimeRedo();
    if (externalDebugTick != null) {
      markReplayStale();
      onCircuitMutated?.(useCircuitStore.getState().circuit);
    }
    // Same reasoning as handleUndo above.
  }, [externalDebugTick, markReplayStale, onCircuitMutated, onRuntimeRedo]);

  const measureCanvasViewport = useCallback(() => {
    if (!canvasHostRef.current) return null;
    const rect = canvasHostRef.current.getBoundingClientRect();
    const width = Math.max(640, Math.floor(rect.width));
    const height = Math.max(64, Math.floor(rect.height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  }, []);

  const fitToCircuit = useCallback((viewportOverride?: unknown) => {
    const viewport = isDesignCanvasViewport(viewportOverride)
      ? viewportOverride
      : measureCanvasViewport() ?? canvasSize;
    if (viewport.width !== canvasSize.width || viewport.height !== canvasSize.height) {
      setCanvasSize((previous) =>
        previous.width === viewport.width && previous.height === viewport.height ? previous : viewport
      );
    }
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
    const zoomX = (viewport.width * 0.9) / boundsWidth;
    const zoomY = (viewport.height * 0.9) / boundsHeight;
    const nextZoom = snapFitZoom(Math.max(0.55, Math.min(2.4, Math.min(zoomX, zoomY))));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setCamera({
      x: viewport.width / 2 - centerX * nextZoom,
      y: viewport.height / 2 - centerY * nextZoom,
      zoom: nextZoom,
    });
  }, [canvasSize, editorCircuit.nodes, measureCanvasViewport, setCamera]);

  const fitToCircuitRef = useRef(fitToCircuit);
  const previousDesignViewRef = useRef(designView);
  const designViewSettledFitFrameRef = useRef<number | null>(null);
  useEffect(() => { fitToCircuitRef.current = fitToCircuit; }, [fitToCircuit]);

  // Auto-fit on mode entry: whenever Design mounts with an existing circuit,
  // frame it immediately. Runs once per mount; does not fight subsequent user pan/zoom.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      if (editorCircuit.nodes.length > 0) {
        fitToCircuitRef.current();
        hasAutoFitRef.current = true;
      }
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

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
    hasAutoFitRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      fitToCircuitRef.current();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSeed]);

  useEffect(() => {
    if (designViewSettledFitFrameRef.current != null) {
      window.cancelAnimationFrame(designViewSettledFitFrameRef.current);
      designViewSettledFitFrameRef.current = null;
    }
    const previousView = previousDesignViewRef.current;
    const enteredSplit = previousDesignViewRef.current !== 'split' && designView === 'split';
    const returnedFromSplitToCanvas = previousView === 'split' && designView === 'canvas';
    previousDesignViewRef.current = designView;
    if (!enteredSplit && !returnedFromSplitToCanvas) return;
    if (enteredSplit) {
      setToolsExpanded(false);
      setSelectMode();
    }
    if (editorCircuit.nodes.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const viewport = measureCanvasViewport();
      fitToCircuitRef.current(viewport);
      // Store frame2 ID before any null assignment to avoid cleanup race
      const frame2 = window.requestAnimationFrame(() => {
        fitToCircuitRef.current(measureCanvasViewport());
        designViewSettledFitFrameRef.current = null;
      });
      designViewSettledFitFrameRef.current = frame2;
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (designViewSettledFitFrameRef.current != null) {
        window.cancelAnimationFrame(designViewSettledFitFrameRef.current);
        designViewSettledFitFrameRef.current = null;
      }
    };
  }, [designView, editorCircuit.nodes.length, measureCanvasViewport, setSelectMode, setToolsExpanded]);

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
  const selectedWireIdsAll = useMemo(() => Array.from(selection.wires), [selection.wires]);
  const selectedWireIds = useMemo(() => selectedWireIdsAll.slice(0, 5), [selectedWireIdsAll]);
  const suggestedMacroName = useMemo(
    () => (selectedNodeIdsAll.length > 0 ? `Macro_${selectedNodeIdsAll.length}` : 'My Macro'),
    [selectedNodeIdsAll.length]
  );
  const selectedNode = useMemo(
    () =>
      selectedNodeIds.length > 0 ? editorCircuit.nodes.find((node) => node.id === selectedNodeIds[0]) : undefined,
    [editorCircuit.nodes, selectedNodeIds]
  );

  const handleInspectorInputToggle = useCallback(() => {
    if (!selectedNode || !onRuntimeSimSetInput) return;
    const current = liveSignals.get(`${selectedNode.id}.out`) ?? 0;
    const next: 0 | 1 = current === 1 ? 0 : 1;
    queueDesignDebugToggleSample(selectedNode.id, next, 'inspector');
    onRuntimeSimSetInput(selectedNode.id, next);
    setActionToast(`${selectedNode.label || selectedNode.type} → ${next === 1 ? 'HIGH' : 'LOW'}`);
  }, [selectedNode, onRuntimeSimSetInput, liveSignals, queueDesignDebugToggleSample]);

  const handleGateSwap = useCallback((newType: string) => {
    if (!selectedNode) return;
    updateNode(selectedNode.id, { type: newType });
    emitCircuitMutation();
    setActionToast(`Gate changed to ${newType}`);
  }, [emitCircuitMutation, selectedNode, updateNode]);

  const patchSelectedRegisterFamilyConfig = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedNode || !REGISTER_FAMILY_TYPES.has(selectedNode.type)) return;
      updateNode(selectedNode.id, {
        config: { ...(selectedNode.config ?? {}), ...patch },
      });
      emitCircuitMutation();
    },
    [emitCircuitMutation, selectedNode, updateNode]
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
        // Do NOT call onCircuitMutated here. instantiateMacro directly mutates
        // runtime state (circuit + sim + health), then IdeApp's useLayoutEffect
        // projects that authoritative circuit back into circuitStore. Calling
        // onCircuitMutated here would still send the stale pre-insertion editor
        // snapshot back into projectRuntime and silently drop the macro.
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
      commitPendingPlacement(event.clientX, event.clientY, { keepPlacing: event.shiftKey });
    },
    [activeInsertionMacro, commitPendingPlacement, pendingPlacement, placeMacroAtClientPoint]
  );

  const handleCanvasPlacementPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pendingPlacement || activeInsertionMacro) return;
      updatePlacementGhost(event.clientX, event.clientY);
    },
    [activeInsertionMacro, pendingPlacement, updatePlacementGhost]
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
  const selectedNodeSignalMap = useMemo(
    () =>
      new Map<string, 0 | 1 | null>(
        (selectedNodeSignals ?? []).map((entry) => [entry.port, entry.value])
      ),
    [selectedNodeSignals]
  );
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
    let draftCount = 0;
    for (const issue of authoringIssues) {
      if (issue.severity === 'error') {
        errorCount += 1;
      } else if (issue.severity === 'warn') {
        warningCount += 1;
      } else {
        draftCount += 1;
      }
    }
    return {
      errorCount,
      warningCount,
      draftCount,
      topIssues: authoringIssues.slice(0, 3),
    };
  }, [authoringIssues]);

  // Phase 3 + Batch 1: real-time canvas issue glow — O(n+e), runs once per circuit mutation.
  const nodeIssueSeverities = useMemo(() => {
    const result = new Map<string, 'error' | 'warn'>();
    // System A: connectivity issues (multiple-drivers, floating-output, unconnected-input)
    for (const nodeId of designIssueMap.byNode.keys()) {
      const sev = nodeIssueSeverity(nodeId, designIssueMap);
      if (sev) result.set(nodeId, sev === 'error' ? 'error' : 'warn');
    }
    // System B: IR compiler diagnostics (combinational loops, missing clock, unknown type, etc.)
    // Nodes with IR errors get red glow; warn gets yellow only if not already red from System A.
    for (const [nodeId, diags] of diagnosticsByNode.entries()) {
      if (diags.some((d) => d.severity === 'error')) {
        result.set(nodeId, 'error');
      } else if (diags.some((d) => d.severity === 'warn') && !result.has(nodeId)) {
        result.set(nodeId, 'warn');
      }
    }
    return result;
  }, [designIssueMap, diagnosticsByNode]);
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
  const activeModeLabel = isPlacementMode
    ? placementModeLabel
      ? `Placing ${placementModeLabel}`
      : 'Placement Mode'
    : toolMode === 'wire'
      ? 'Wire Mode'
      : 'Select Mode';
  const showBlankStateCard = editorCircuit.nodes.length === 0 && !isPlacementMode;
  const zoomPercent = Math.round(camera.zoom * 100);
  const effectiveInteractionMode = isPlacementMode && interactionMode === 'idle' ? 'placing' : interactionMode;
  const wireSourceLabel = wireStartPort
    ? describePortRefForStudents(editorCircuit, wireStartPort, getChipMetadata)
    : null;
  const wireCueText = describeWireSourceCue(editorCircuit, wireStartPort, getChipMetadata);
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
        ? `Click to place ${placementModeLabel}. Hold Shift to keep placing. Esc cancels.`
        : toolMode === 'wire'
          ? wireStartPort
            ? 'Valid targets glow green — click one to connect. Esc cancels.'
          : 'Click any port to start a wire.'
        : 'Click a node to inspect · click a port to wire · drag to move';
  const cancelActiveWire = useCallback(() => {
    endWire();
    setWireFeedback(null);
  }, [endWire]);

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
    updateNode(
      editingLabelNodeId,
      { label: trimmed.length > 0 ? trimmed : undefined },
      { skipHistory: true }
    );
    emitCircuitMutation();
    setEditingLabelNodeId(null);
    setLabelDraft('');
  }, [editingLabelNodeId, emitCircuitMutation, labelDraft, updateNode]);

  const cancelNodeLabel = useCallback(() => {
    setEditingLabelNodeId(null);
    setLabelDraft('');
  }, []);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitNodeLabel(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelNodeLabel(); }
  }, [commitNodeLabel, cancelNodeLabel]);
  const beginNodeLabelEdit = useCallback((node: Node) => {
    setEditingLabelNodeId(node.id);
    setLabelDraft(node.label ?? '');
  }, []);
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
          matchKeys: [ioRowByNodeId.get(node.id)?.label, ioRowByNodeId.get(node.id)?.id, node.label, node.id]
            .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0),
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
          matchKeys: [ioRowByNodeId.get(node.id)?.label, ioRowByNodeId.get(node.id)?.id, node.label, node.id]
            .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0),
        };
      });
    return { inputRows, outputRows };
  }, [editorCircuit.nodes, ioRowByNodeId, liveSignals]);
  const simulationStory = useMemo(
    () => describeSimulationStory(liveIoSignals.inputRows, liveIoSignals.outputRows, displayTrace, simRunning, timingGuidance),
    [displayTrace, liveIoSignals.inputRows, liveIoSignals.outputRows, simRunning, timingGuidance]
  );
  const hasVerilogArtifact = liveHdlResult.verilog.trim().length > 0;
  const secondaryArtifact: DesignArtifact = primaryArtifact === 'vhdl' ? 'verilog' : 'vhdl';
  const primaryArtifactDescriptor = DESIGN_ARTIFACT_DESCRIPTORS[primaryArtifact];
  const secondaryArtifactDescriptor = DESIGN_ARTIFACT_DESCRIPTORS[secondaryArtifact];
  const secondaryArtifactAvailable = secondaryArtifact === 'vhdl' || hasVerilogArtifact;
  const primaryArtifactLabel = primaryArtifactDescriptor.label;
  const primaryArtifactFileName = primaryArtifactDescriptor.fileName;
  const secondaryArtifactLabel = secondaryArtifactDescriptor.label;
  const secondaryArtifactFileName = secondaryArtifactDescriptor.fileName;
  const artifactTabVhdlId = 'ide-design-artifact-tab-vhdl';
  const artifactTabVerilogId = 'ide-design-artifact-tab-verilog';
  const primaryArtifactPanelId = 'ide-design-primary-artifact-panel';
  const primaryVhdlText = hdlDraftText !== '' ? hdlDraftText : (topHdl ?? liveHdlResult.vhd);
  const primaryArtifactText = primaryArtifact === 'vhdl' ? primaryVhdlText : liveHdlResult.verilog;
  const secondaryArtifactText = secondaryArtifact === 'vhdl' ? (topHdl ?? liveHdlResult.vhd) : liveHdlResult.verilog;
  // Verilog is always generated from the current circuit and cannot be applied back to the graph.
  const primaryArtifactIsEditable = primaryArtifactDescriptor.editable;

  useEffect(() => {
    if (!hasVerilogArtifact && primaryArtifact === 'verilog') {
      setPrimaryArtifact('vhdl');
      setSecondaryArtifactOpen(false);
    }
  }, [hasVerilogArtifact, primaryArtifact]);
  useEffect(() => {
    if (
      staleReplayBreadcrumb != null &&
      externalDebugTick != null &&
      replaySession != null &&
      replaySession !== staleReplayBreadcrumb.sourceSession
    ) {
      setStaleReplayBreadcrumb(null);
    }
  }, [externalDebugTick, replaySession, staleReplayBreadcrumb]);
  const activeDebugContext = useMemo(
    () =>
      effectiveExternalDebugTick != null && effectiveExternalDebugContext?.tick === effectiveExternalDebugTick
        ? effectiveExternalDebugContext
        : null,
    [effectiveExternalDebugContext, effectiveExternalDebugTick]
  );
  const debugInputSummary = useMemo(
    () => formatVerifyDebugInputSnapshot(activeDebugContext?.inputSnapshot ?? []),
    [activeDebugContext]
  );
  const activeReplaySelectionLabel = useMemo(
    () => formatReplaySelectionLabel(debugTickIndex ?? null, debugTickCount ?? null, effectiveExternalDebugTick),
    [debugTickCount, debugTickIndex, effectiveExternalDebugTick]
  );
  const activeReplayTimingHint = useMemo(
    () => formatReplayTimingHint(replaySession?.meta ?? null),
    [replaySession?.meta]
  );
  const canRenderReplayScrubber =
    effectiveExternalDebugTick != null &&
    debugTickIndex != null &&
    debugTickCount != null &&
    debugTickCount > 1 &&
    onSelectDebugTickIndex !== undefined;
  const staleReplaySelectionLabel = useMemo(
    () =>
      staleReplayBreadcrumb
        ? formatReplaySelectionLabel(
            staleReplayBreadcrumb.caseIndex,
            staleReplayBreadcrumb.caseCount,
            staleReplayBreadcrumb.tick
          )
        : null,
    [staleReplayBreadcrumb]
  );
  const activeSimulationSelectionLabel = effectiveExternalDebugTick != null
    ? activeReplaySelectionLabel
    : staleReplaySelectionLabel ?? `Tick ${simTick}`;
  const activeSimulationSummary = activeDebugContext
    ? describeVerifyDebugSummary(activeDebugContext)
    : staleReplayBreadcrumb
      ? 'Replay invalidated. Resume live edits or return to Verify for a fresh waveform.'
      : simulationStory.summary;
  const showSimulationSummary =
    staleReplayBreadcrumb != null ||
    !!activeDebugContext ||
    !!activeVerifySignal ||
    canRenderReplayScrubber ||
    simRunning ||
    runtimeSim.trace.length > 0;
  const handleReplayScrubberChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!onSelectDebugTickIndex || debugTickCount == null) return;
      const nextIndex = Number.parseInt(event.target.value, 10);
      if (!Number.isFinite(nextIndex)) return;
      if (nextIndex < 0 || nextIndex >= debugTickCount) return;
      onSelectDebugTickIndex(nextIndex);
    },
    [debugTickCount, onSelectDebugTickIndex]
  );
  const authoringStatusToneClass =
    authoringIssueCounts.errorCount > 0 || compilerErrorCount > 0
      ? 'has-errors'
      : authoringIssueCounts.warningCount > 0 || compilerWarningCount > 0
        ? 'has-warnings'
        : authoringIssueCounts.draftCount > 0
          ? 'has-drafts'
        : 'is-clean';
  const topAuthoringIssue = authoringIssueCounts.topIssues[0] ?? null;
  const authoringStatusLabel =
    authoringIssueCounts.errorCount > 0 || compilerErrorCount > 0
      ? 'Blocking circuit issue'
      : authoringIssueCounts.warningCount > 0 || compilerWarningCount > 0
        ? 'Circuit needs review'
        : authoringIssueCounts.draftCount > 0
          ? 'Draft wiring in progress'
          : 'Ready to build';
  const totalAuthoringErrors = authoringIssueCounts.errorCount + compilerErrorCount;
  const totalAuthoringWarnings = authoringIssueCounts.warningCount + compilerWarningCount;
  const designCommandTone: 'idle' | 'ok' | 'warn' | 'error' =
    totalAuthoringErrors > 0
      ? 'error'
      : totalAuthoringWarnings > 0 || authoringIssueCounts.draftCount > 0
        ? 'warn'
        : 'ok';
  const designCommandTitle = useMemo(() => {
    if (effectiveExternalDebugTick != null) return 'Inspect replay';
    const view =
      designView === 'hdl' ? 'Code' : designView === 'split' ? 'Split' : 'Canvas';
    if (activeVerifySignal) return `${view} / Verify-linked`;
    return view;
  }, [activeVerifySignal, designView, effectiveExternalDebugTick]);
  const designCommandDescription = effectiveExternalDebugTick != null
    ? 'Replay focus is active below. Scrub cases and inspect propagation before resuming live edits.'
    : activeVerifySignal
      ? `Build the circuit while keeping Verify focus on ${activeVerifySignal}.`
      : designView === 'hdl'
        ? `Edit ${primaryArtifactLabel} while keeping the circuit aligned with live propagation.`
        : designView === 'split'
          ? `Compare the circuit against ${primaryArtifactLabel} before moving into Verify.`
          : 'Build the circuit and inspect live propagation before moving into Verify.';
  /** Status + instrument chips only — counts live in the authoring strip / diagnostics. */
  const designCommandMeta = (
    <>
      <IdeStatusPill tone={designCommandTone}>{authoringStatusLabel}</IdeStatusPill>
      {effectiveExternalDebugTick != null ? (
        <span className="ide-surface-command-chip ide-surface-command-chip--instrument">Replay</span>
      ) : null}
      <span
        className={`ide-surface-command-chip${dirtySinceVerify ? ' is-attention' : ' is-ok'}`}
        data-testid="ide-design-verify-sync-chip"
      >
        {dirtySinceVerify ? 'Verify: stale' : 'Verify: aligned'}
      </span>
    </>
  );
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
  const activeVerifySignalPresentation = useMemo(
    () =>
      describeSignalFocusPresentation({
        focusLabel: activeVerifySignal,
        signalKey: verifyLinkedSignalKey,
        circuit: editorCircuit,
        ioRowByNodeId,
      }),
    [activeVerifySignal, verifyLinkedSignalKey, editorCircuit, ioRowByNodeId]
  );
  const debugLinkedSignalKey = useMemo(
    () => resolveVerifyLinkedSignalKey(activeDebugContext?.signal ?? null, ioRows, liveSignals, runtimeSim.signals),
    [activeDebugContext?.signal, ioRows, liveSignals, runtimeSim.signals]
  );
  const selectedSignalKey = runtimeSim.selectedSignalKey ?? debugLinkedSignalKey ?? verifyLinkedSignalKey ?? selectedWireSignalKey;
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
    autoWireSelectionTraceIdRef.current = null;
    setTraceState({
      kind: 'fanin-port',
      sourceKey: `verify:${verifyLinkedSignalKey}`,
      label: buildStudentVerifyDebugTraceLabel('Verify', verifyLinkedSignalKey, editorCircuit, ioRowByNodeId),
      signalKey: verifyLinkedSignalKey,
      wireHighlights: highlights,
      nodeIds: highlightedNodes,
      portKeys,
    });
    lastTracedPortRef.current = `${nodeId}.${portName}`;
  }, [editorCircuit, ioRowByNodeId, onRuntimeSimSetSelectedSignal, verifyLinkedSignalKey]);
  useEffect(() => {
    if (!debugLinkedSignalKey) {
      if (traceStateRef.current?.sourceKey.startsWith('debug:')) {
        lastTracedPortRef.current = null;
        setTraceState(null);
      }
      return;
    }
    onRuntimeSimSetSelectedSignal?.(debugLinkedSignalKey);
    const [nodeId, portName = 'out'] = debugLinkedSignalKey.split('.');
    if (!nodeId) return;
    const { wireIds, nodeIds } = getFaninCone(editorCircuit, nodeId);
    const highlights = new Map<string, string[]>();
    wireIds.forEach((wireId) => highlights.set(wireId, ['#fb7185']));
    const highlightedNodes = new Set(nodeIds);
    highlightedNodes.add(nodeId);
    const portKeys = buildTracePortKeySet(wireIds);
    portKeys.add(`${nodeId}:${portName}`);
    autoWireSelectionTraceIdRef.current = null;
    setTraceState({
      kind: 'fanin-port',
      sourceKey: `debug:${debugLinkedSignalKey}:${activeDebugContext?.tick ?? effectiveExternalDebugTick ?? 'tick'}`,
      label: buildStudentVerifyDebugTraceLabel('Debug', debugLinkedSignalKey, editorCircuit, ioRowByNodeId),
      signalKey: debugLinkedSignalKey,
      wireHighlights: highlights,
      nodeIds: highlightedNodes,
      portKeys,
    });
    lastTracedPortRef.current = `${nodeId}.${portName}`;
  }, [
    activeDebugContext?.tick,
    debugLinkedSignalKey,
    editorCircuit,
    effectiveExternalDebugTick,
    ioRowByNodeId,
    onRuntimeSimSetSelectedSignal,
  ]);
  const selectedSignalValue = selectedSignalKey ? displayRuntimeSignals[selectedSignalKey] ?? 0 : 0;
  const selectedSignalHistory = useMemo(() => {
    if (!selectedSignalKey) return [];
    const history = resolveSignalTraceSamples(selectedSignalKey, displayTrace, runtimeSim.trace)
      .slice(-32)
      .map((entry) => ({
      tick: entry.tick,
      value: entry.signals[selectedSignalKey] ?? 0,
    }));
    return history;
  }, [displayTrace, runtimeSim.trace, selectedSignalKey]);
  const pinnedProbeRows = useMemo(
    () =>
      runtimeSim.probes.map((probe) => ({
        ...probe,
        value: displayRuntimeSignals[probe.key] ?? 0,
      })),
    [displayRuntimeSignals, runtimeSim.probes]
  );
  // B1: Eval order — computed from engine topology, refreshed when circuit changes
  const evalOrder = useMemo(() => {
    if (!showEvalOrder) return null;
    try { return tickEngine.getEngine().getEvaluationOrder(); } catch { return null; }
  }, [showEvalOrder, editorCircuit.nodes, editorCircuit.connections, tickEngine]);

  // B1: Changed nodes — node IDs whose output differed between the last 2 sim ticks
  const changedNodeIds = useMemo<Set<string> | null>(() => {
    const trace = displayTrace;
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
  }, [displayTrace]);

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
    const minCanvasWidth = 320;
    const minCodeWidth = 360;
    const canvasWidth = totalWidth * splitRatio;
    const hdlWidth = totalWidth * (1 - splitRatio);
    // Stack when either pane would be too narrow to be usable
    return totalWidth < minCanvasWidth + minCodeWidth || canvasWidth < minCanvasWidth || hdlWidth < minCodeWidth ? 'stacked' : 'split';
  }, [designView, paneRowSize.width, splitRatio]);
  const workspacePreset = useMemo(
    () => resolveDesignWorkspacePreset({ mode: designView, effectiveMode: effectiveDesignView }),
    [designView, effectiveDesignView]
  );
  const showPartialBlankAuthoring =
    workspacePreset.showCanvasTools &&
    !showBlankStateCard &&
    !isPlacementMode &&
    editorCircuit.nodes.length > 0 &&
    (editorCircuit.connections?.length ?? 0) === 0;
  const hasVisibleDiagnosticsConsole =
    compilerErrorCount > 0 || compilerWarningCount > 0 || diagnosticsDrawerRows.length > 0;
  const designConsoleMode = hasVisibleDiagnosticsConsole ? workspacePreset.consoleMode : 'hidden';
  const showFullAuthoringStatus = workspacePreset.showFullAuthoringStatus;
  const showCompactAuthoringStatus = workspacePreset.showCompactAuthoringStatus;
  const isCanvasWorkspace = workspacePreset.mode === 'canvas';
  const isCodeWorkspace = workspacePreset.mode === 'hdl';
  const isSplitWorkspace = workspacePreset.mode === 'split';
  const showSplitCompareToolbar = isSplitWorkspace && effectiveDesignView === 'split';
  const showSimulationStrip = workspacePreset.showSimulationStrip;
  const hasMeaningfulSimulationStory =
    showSimulationStrip &&
    (showSimulationSummary || isReplayMode || staleReplayBreadcrumb != null || simulationStory.clockEvent != null);
  const showRuntimeStatus =
    hasMeaningfulSimulationStory || traceState != null || (isSplitWorkspace && !showSimulationStrip);
  const showWorkspaceStatusBar =
    (!isCodeWorkspace && (showFullAuthoringStatus || showCompactAuthoringStatus || workspacePreset.showCanvasTools)) ||
    totalAuthoringErrors > 0 ||
    totalAuthoringWarnings > 0 ||
    authoringIssueCounts.draftCount > 0 ||
    liveHdlResult.error != null ||
    showRuntimeStatus;
  const designStatusNote =
    liveHdlResult.error != null
      ? `HDL generation failed: ${liveHdlResult.error}`
      : topAuthoringIssue?.title ?? null;
  const workspaceRuntimeLabel = traceState ? 'Trace' : 'Runtime';
  const runtimePrimaryPill = isSplitWorkspace && !showSimulationStrip
    ? `Tick ${simTick}`
    : activeSimulationSelectionLabel;
  const runtimeSecondaryPill = isReplayMode
    ? 'Replay'
    : staleReplayBreadcrumb
      ? 'Replay stale'
      : simModeLabel;
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
    const candidate = pickPrimaryNodeSignalKey(selectedNode, selectedNodePins, displayRuntimeSignals, liveSignals);
    return candidate;
  }, [displayRuntimeSignals, focusedIssueSignalKey, liveSignals, selectedNode, selectedNodePins]);
  const selectedNodeSignalSnapshot = useMemo(
    () => describeSignalSnapshot(selectedNodePrimarySignalKey, displayTrace, displayRuntimeSignals, liveSignals, runtimeSim.trace),
    [displayRuntimeSignals, displayTrace, liveSignals, runtimeSim.trace, selectedNodePrimarySignalKey]
  );
  const selectedNodeConnectionSummary = useMemo(() => {
    if (!selectedNode) return null;
    return describeNodeConnectionSummary(selectedNode.id, editorCircuit, resolveConnectionEndpoint);
  }, [editorCircuit, resolveConnectionEndpoint, selectedNode]);
  const selectedSequentialInspector = useMemo(
    () =>
      buildSequentialInspectorContext({
        node: selectedNode,
        nodeSignals: selectedNodeSignalMap,
        ioRow: selectedNodeIoRow,
        connectionSummary: selectedNodeConnectionSummary,
        circuit: editorCircuit,
        ioRowByNodeId,
        trace: displayTrace,
        fallbackTrace: runtimeSim.trace,
        runtimeSignals: displayRuntimeSignals,
        liveSignals,
      }),
    [
      displayRuntimeSignals,
      displayTrace,
      editorCircuit,
      ioRowByNodeId,
      liveSignals,
      runtimeSim.trace,
      selectedNode,
      selectedNodeConnectionSummary,
      selectedNodeIoRow,
      selectedNodeSignalMap,
    ]
  );
  const selectedNodeTeachingProfile = useMemo(
    () =>
      selectedNode
        ? resolveNodeInspectionTeachingProfile(selectedNode, {
            sequential: selectedSequentialInspector,
            customComponentDefs,
            customComponentTypes,
          })
        : null,
    [customComponentDefs, customComponentTypes, selectedNode, selectedSequentialInspector]
  );
  const selectedNodeInputDrivers = useMemo(() => {
    if (!selectedNode || liveSignals.size === 0) return [];
    return editorCircuit.connections
      .filter((conn) => resolveConnectionEndpoint(conn.to).nodeId === selectedNode.id)
      .map((conn) => {
        const src = resolveConnectionEndpoint(conn.from);
        const srcNode = editorCircuit.nodes.find((n) => n.id === src.nodeId);
        return {
          port: resolveConnectionEndpoint(conn.to).portName,
          driverLabel: describeEndpointLabel(src.nodeId, srcNode, ioRowByNodeId.get(src.nodeId)),
          value: liveSignals.get(`${src.nodeId}.${src.portName}`) ?? null,
        };
      });
  }, [editorCircuit, ioRowByNodeId, liveSignals, resolveConnectionEndpoint, selectedNode]);

  // Auto-trace: when sim is running and a node is selected with no existing trace,
  // trigger a fanout highlight automatically. Clears when selection is lost.
  useEffect(() => {
    if (runtimeSim.running && selectedNode) {
      if (!traceStateRef.current) {
        handleFanoutTrace(selectedNode.id);
        autoTracedNodeRef.current = selectedNode.id;
      }
    } else if (!selectedNode && autoTracedNodeRef.current !== null) {
      clearTrace();
      autoTracedNodeRef.current = null;
    }
    // traceStateRef intentionally omitted — read via ref to avoid retriggering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, runtimeSim.running, handleFanoutTrace, clearTrace]);

  const primarySelectedWireId = selectedWireIds[0] ?? null;
  const selectedWireContext = useMemo(() => {
    if (!primarySelectedWireId) return null;
    const parsed = parseWireId(primarySelectedWireId);
    if (!parsed) return null;
    const sourceNode = editorCircuit.nodes.find((node) => node.id === parsed.fromNodeId);
    const targetNode = editorCircuit.nodes.find((node) => node.id === parsed.toNodeId);
    const signalKey = `${parsed.fromNodeId}.${parsed.fromPort}`;
    const snapshot = describeSignalSnapshot(signalKey, displayTrace, displayRuntimeSignals, liveSignals, runtimeSim.trace);
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
  }, [displayRuntimeSignals, displayTrace, editorCircuit.connections, editorCircuit.nodes, ioRowByNodeId, liveSignals, primarySelectedWireId, resolveConnectionEndpoint, runtimeSim.trace]);
  const activeInspectorSignalKey = selectedWireContext?.signalKey ?? selectedNodePrimarySignalKey ?? selectedSignalKey;
  const activeInspectorSignalLabel = useMemo(
    () => describeStudentSignalKey(activeInspectorSignalKey, editorCircuit, ioRowByNodeId),
    [activeInspectorSignalKey, editorCircuit, ioRowByNodeId]
  );
  const activeInspectorSignalLandingTarget = useMemo(() => {
    if (!activeInspectorSignalKey) return null;
    const dotIndex = activeInspectorSignalKey.indexOf('.');
    if (dotIndex === -1) return null;
    const nodeId = activeInspectorSignalKey.slice(0, dotIndex);
    const portName = activeInspectorSignalKey.slice(dotIndex + 1);
    if (!nodeId || !portName) return null;
    const node = editorCircuit.nodes.find((entry) => entry.id === nodeId);
    if (!node) return null;
    return {
      signalKey: activeInspectorSignalKey,
      nodeId,
      portName,
      nodeLabel: describeEndpointLabel(nodeId, node, ioRowByNodeId.get(nodeId)),
      signalLabel: describeStudentSignalKey(activeInspectorSignalKey, editorCircuit, ioRowByNodeId),
    };
  }, [activeInspectorSignalKey, editorCircuit, ioRowByNodeId]);
  const activeInspectorSignalFocusPresentation = useMemo(
    () =>
      describeSignalFocusPresentation({
        focusLabel: activeDebugContext?.signal ?? activeVerifySignal,
        signalKey: activeInspectorSignalKey,
        circuit: editorCircuit,
        ioRowByNodeId,
      }),
    [activeDebugContext?.signal, activeVerifySignal, activeInspectorSignalKey, editorCircuit, ioRowByNodeId]
  );
  const activeInspectorSignalSnapshot = useMemo(
    () => describeSignalSnapshot(activeInspectorSignalKey, displayTrace, displayRuntimeSignals, liveSignals, runtimeSim.trace),
    [activeInspectorSignalKey, displayRuntimeSignals, displayTrace, liveSignals, runtimeSim.trace]
  );
  const selectedNodeReplayCausation = useMemo(() => {
    if (!isReplayMode || !selectedNode) return null;
    return describeReplayCausation({
      snapshot: selectedNodeSignalSnapshot,
      driverLabels: selectedNodeInputDrivers.map((entry) => entry.driverLabel),
      inspectLabel: describeEndpointLabel(selectedNode.id, selectedNode, selectedNodeIoRow),
    });
  }, [isReplayMode, selectedNode, selectedNodeInputDrivers, selectedNodeIoRow, selectedNodeSignalSnapshot]);
  const selectedWireReplayCausation = useMemo(() => {
    if (!isReplayMode || !selectedWireContext) return null;
    return describeReplayCausation({
      snapshot: selectedWireContext.snapshot,
      driverLabels: [selectedWireContext.sourceLabel],
      inspectLabel: selectedWireContext.targetLabel,
    });
  }, [isReplayMode, selectedWireContext]);
  const activeInspectorSignalDriverLabels = useMemo(
    () =>
      resolveDirectSignalDriverLabels(
        activeInspectorSignalKey,
        editorCircuit,
        ioRowByNodeId,
        resolveConnectionEndpoint
      ),
    [activeInspectorSignalKey, editorCircuit, ioRowByNodeId, resolveConnectionEndpoint]
  );
  const activeInspectorReplayCausation = useMemo(() => {
    if (!isReplayMode || !activeInspectorSignalKey) return null;
    return describeReplayCausation({
      snapshot: activeInspectorSignalSnapshot,
      driverLabels: activeInspectorSignalDriverLabels,
      inspectLabel:
        activeInspectorSignalLandingTarget?.nodeLabel ?? activeInspectorSignalFocusPresentation?.inspectLabel ?? null,
    });
  }, [
    activeInspectorSignalDriverLabels,
    activeInspectorSignalFocusPresentation?.inspectLabel,
    activeInspectorSignalKey,
    activeInspectorSignalLandingTarget?.nodeLabel,
    activeInspectorSignalSnapshot,
    isReplayMode,
  ]);
  const activeDebugRepairContext = useMemo(() => {
    if (!activeDebugContext || !debugLinkedSignalKey) return null;
    const normalizedDebugSignal = normalizeSignalLookup(activeDebugContext.signal);
    const matchedDebugRow =
      ioRows.find((row) => normalizeSignalLookup(row.id) === normalizedDebugSignal) ??
      ioRows.find((row) => normalizeSignalLookup(row.label) === normalizedDebugSignal);
    const debugRepairSignalKey = matchedDebugRow
      ? `${matchedDebugRow.nodeId}.${matchedDebugRow.port}`
      : debugLinkedSignalKey;
    const dotIndex = debugRepairSignalKey.indexOf('.');
    if (dotIndex === -1) return null;
    const nodeId = debugRepairSignalKey.slice(0, dotIndex);
    const portName = debugRepairSignalKey.slice(dotIndex + 1);
    if (!nodeId || !portName) return null;

    const targetNode = editorCircuit.nodes.find((entry) => entry.id === nodeId);
    const targetLabel = describeEndpointLabel(nodeId, targetNode, ioRowByNodeId.get(nodeId));
    const exactIncoming = editorCircuit.connections.find((connection) => {
      const to = resolveConnectionEndpoint(connection.to);
      return to.nodeId === nodeId && to.portName === portName;
    });
    const anyIncoming = editorCircuit.connections.find((connection) => {
      const to = resolveConnectionEndpoint(connection.to);
      return to.nodeId === nodeId;
    });
    const directConnection =
      matchedDebugRow?.direction === 'out'
        ? anyIncoming ?? exactIncoming
        : exactIncoming ?? anyIncoming;

    if (!directConnection) {
      return {
        signalKey: debugRepairSignalKey,
        targetLabel,
        targetType: targetNode ? nodeTypeLabel(targetNode.type) : 'Signal',
        driverLabel: null,
        driverType: null,
        driverNodeId: null,
        incomingWires: 0,
        outgoingWires: 0,
        wireId: null,
      };
    }

    const from = resolveConnectionEndpoint(directConnection.from);
    const directTo = resolveConnectionEndpoint(directConnection.to);
    const driverNode = editorCircuit.nodes.find((entry) => entry.id === from.nodeId);
    const incomingWires = editorCircuit.connections.filter((connection) => {
      const to = resolveConnectionEndpoint(connection.to);
      return to.nodeId === from.nodeId;
    }).length;
    const outgoingWires = editorCircuit.connections.filter((connection) => {
      const connectionFrom = resolveConnectionEndpoint(connection.from);
      return connectionFrom.nodeId === from.nodeId;
    }).length;

    return {
      signalKey: debugRepairSignalKey,
      targetLabel,
      targetType: targetNode ? nodeTypeLabel(targetNode.type) : 'Signal',
      driverLabel: describeEndpointLabel(from.nodeId, driverNode, ioRowByNodeId.get(from.nodeId)),
      driverType: driverNode ? nodeTypeLabel(driverNode.type) : 'Unknown node',
      driverNodeId: from.nodeId,
      incomingWires,
      outgoingWires,
      wireId: `${from.nodeId}.${from.portName}-${directTo.nodeId}.${directTo.portName}`,
    };
  }, [activeDebugContext, debugLinkedSignalKey, editorCircuit, ioRowByNodeId, ioRows, resolveConnectionEndpoint]);
  const activeDebugSignalTrace = useMemo(() => {
    if (!activeDebugRepairContext?.signalKey) return null;
    return buildDesignDebugSignalTrace(editorCircuit, {
      targetSignalKey: activeDebugRepairContext.signalKey,
      maxDepth: 4,
      resolveNodeLabel: (node, nodeId) => describeEndpointLabel(nodeId, node, ioRowByNodeId.get(nodeId)),
      resolveNodeTypeLabel: (node) => (node ? nodeTypeLabel(node.type) : 'Signal'),
    });
  }, [activeDebugRepairContext?.signalKey, editorCircuit, ioRowByNodeId]);
  const focusActiveInspectorSignalNode = useCallback(() => {
    if (!activeInspectorSignalLandingTarget) return;
    setToolMode('select');
    selectMultipleNodes([activeInspectorSignalLandingTarget.nodeId], false);
    setFocusedIssueSignalKey(activeInspectorSignalLandingTarget.signalKey);
    onRuntimeSimSetSelectedSignal?.(activeInspectorSignalLandingTarget.signalKey);
    focusNodeOnCanvas(activeInspectorSignalLandingTarget.nodeId);
  }, [activeInspectorSignalLandingTarget, focusNodeOnCanvas, onRuntimeSimSetSelectedSignal, selectMultipleNodes, setToolMode]);
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
    const issueTone = primaryIssue.severity === 'draft' ? 'warn' : primaryIssue.severity;
    return (
      <div
        className={`ide-design-selection-issues is-${issueTone}`}
        data-testid="ide-design-selection-issues"
      >
        <div className="ide-design-selection-issues-header">
          <span className={`ide-design-selection-issues-pill is-${issueTone}`}>
            {primaryIssue.severity === 'error'
              ? 'Error'
              : primaryIssue.severity === 'warn'
                ? 'Warn'
                : 'Draft'}
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
  const hasSingleSelectedNode = !!selectedNode && selection.nodes.size === 1;
  const hasMultiNodeSelection = selection.nodes.size > 1;
  const hasMultiWireSelection = !hasMultiNodeSelection && selectedWireIdsAll.length > 1;
  const multiWireNetSummary = useMemo(() => {
    if (selectedWireIdsAll.length < 2 || selection.nodes.size > 0) return null;
    return summarizeMultiWireNetSelection(editorCircuit, selectedWireIdsAll, ioRowByNodeId);
  }, [editorCircuit, ioRowByNodeId, selectedWireIdsAll, selection.nodes.size]);
  const hasInspectorSelectionContext =
    hasSingleSelectedNode ||
    hasMultiNodeSelection ||
    hasMultiWireSelection ||
    !!selectedWireContext ||
    !!activeInspectorSignalKey;
  const primarySelectionIssue = selectionAuthoringIssues[0] ?? null;
  const primarySelectionDiagnostic = selectedNodeDiagnostics[0] ?? null;
  const selectionStatusLabel = primarySelectionIssue
    ? primarySelectionIssue.severity === 'error'
      ? 'Needs fix'
      : primarySelectionIssue.severity === 'warn'
        ? 'Needs review'
        : 'In progress'
    : primarySelectionDiagnostic
      ? primarySelectionDiagnostic.severity === 'error'
        ? 'Compiler issue'
        : 'Compiler warning'
      : hasInspectorSelectionContext
        ? 'Ready'
        : 'Idle';
  const selectionStatusTone =
    (primarySelectionIssue?.severity === 'draft' ? 'warn' : primarySelectionIssue?.severity) ??
    (primarySelectionDiagnostic?.severity === 'error'
      ? 'error'
      : primarySelectionDiagnostic?.severity === 'warn'
        ? 'warn'
        : 'ok');
  const designRightDockMode =
    isCanvasWorkspace &&
    (hasInspectorSelectionContext ||
      activeVerifySignal != null ||
      activeDebugContext != null ||
      effectiveExternalDebugTick != null ||
      simRunning ||
      diagnosticRouteRequest != null)
      ? 'visible'
      : workspacePreset.rightDockMode;
  const designRightDockRevealKey = useMemo(() => {
    if (!isCanvasWorkspace) return null;
    if (hasInspectorSelectionContext) {
      const selectedNodesKey = [...selectedNodeIdsAll].sort().join(',');
      const selectedWiresKey = [...selectedWireIdsAll].sort().join(',');
      return `selection:${selectedNodesKey}|${selectedWiresKey}`;
    }
    if (activeVerifySignal != null) {
      return `signal:${activeVerifySignal}`;
    }
    if (activeDebugContext != null) {
      return `debug:${activeDebugContext.signal ?? activeVerifySignal ?? 'tick'}:${activeDebugContext.tick ?? effectiveExternalDebugTick ?? 'tick'}`;
    }
    if (effectiveExternalDebugTick != null) {
      return `tick:${effectiveExternalDebugTick}`;
    }
    if (diagnosticRouteRequest != null) {
      return `diagnostic:${diagnosticRouteRequest.requestId}:${diagnosticRouteRequest.diagnosticId}:${diagnosticRouteRequest.nodeId ?? diagnosticRouteRequest.wireId ?? diagnosticRouteRequest.portName ?? diagnosticRouteRequest.signal ?? 'route'}`;
    }
    if (simRunning) {
      return 'sim-running';
    }
    return null;
  }, [
    activeDebugContext,
    activeVerifySignal,
    diagnosticRouteRequest,
    effectiveExternalDebugTick,
    hasInspectorSelectionContext,
    isCanvasWorkspace,
    selectedNodeIdsAll,
    selectedWireIdsAll,
    simRunning,
  ]);
  const renderNodeLabelEditor = (node: Node) => (
    <div className="ide-design-label-editor" data-testid="ide-design-label-editor">
      {editingLabelNodeId === node.id ? (
        <div className="ide-design-label-editor-row">
          <input
            className="ide-text-input ide-design-label-input"
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={handleLabelKeyDown}
            onBlur={commitNodeLabel}
            autoFocus
            placeholder="Enter label..."
            data-testid="ide-design-label-input"
            maxLength={32}
          />
          <IdeButton tone="secondary" onClick={commitNodeLabel} testId="ide-design-label-save">Save</IdeButton>
          <IdeButton tone="ghost" onClick={cancelNodeLabel} testId="ide-design-label-cancel">Cancel</IdeButton>
        </div>
      ) : (
        <IdeButton tone="secondary" onClick={() => beginNodeLabelEdit(node)} testId="ide-design-label-edit-btn">
          {node.label ? `Rename ${node.label}` : 'Add label'}
        </IdeButton>
      )}
    </div>
  );

  const applyWireNetTraceForWireId = useCallback(
    (wireId: string, origin: 'manual' | 'selection' | 'multi-same-net') => {
      const bundle = buildWireTraceBundle(editorCircuit, wireId);
      const parsed = parseWireId(wireId);
      if (!bundle || !parsed) return;
      if (origin === 'manual') {
        autoWireSelectionTraceIdRef.current = null;
        // Intentionally no action toast: traceState.label (title bar + inspector) and canvas
        // highlight already confirm the same relationship — a toast duplicates noise.
      } else {
        // selection or multi-same-net: one canonical wire id for auto-trace ref bookkeeping
        autoWireSelectionTraceIdRef.current = wireId;
      }
      setTraceState({
        kind: 'wire-net',
        sourceKey: wireId,
        label: buildStudentWireNetTraceLabel(editorCircuit, parsed.fromNodeId, parsed.fromPort, ioRowByNodeId),
        signalKey: `${parsed.fromNodeId}.${parsed.fromPort}`,
        wireHighlights: bundle.wireHighlights,
        nodeIds: bundle.nodeIds,
        portKeys: bundle.portKeys,
      });
      lastTracedPortRef.current = null;
      setWireContextMenu(null);
    },
    [editorCircuit, ioRowByNodeId]
  );

  const traceSelectedWire = useCallback(
    (wireId: string) => {
      applyWireNetTraceForWireId(wireId, 'manual');
    },
    [applyWireNetTraceForWireId]
  );

  // Auto: selecting a single wire shows every segment driven by the same source (fanout) without an extra "Trace net" click.
  useEffect(() => {
    if (verifyLinkedSignalKey || debugLinkedSignalKey) return;
    if (selection.nodes.size > 0) return;
    if (selection.wires.size !== 1) {
      if (selection.wires.size === 0) {
        const id = autoWireSelectionTraceIdRef.current;
        if (id && traceStateRef.current?.kind === 'wire-net' && traceStateRef.current.sourceKey === id) {
          setTraceState(null);
          autoWireSelectionTraceIdRef.current = null;
        }
      }
      return;
    }
    const wireId = Array.from(selection.wires)[0]!;
    if (
      autoWireSelectionTraceIdRef.current === wireId &&
      traceStateRef.current?.kind === 'wire-net' &&
      traceStateRef.current.sourceKey === wireId
    ) {
      return;
    }
    applyWireNetTraceForWireId(wireId, 'selection');
  }, [
    applyWireNetTraceForWireId,
    debugLinkedSignalKey,
    selection.nodes.size,
    selection.wires,
    verifyLinkedSignalKey,
  ]);

  // Multi-wire: if every segment is from the same driver, re-use the same full-net highlight as
  // single-wire auto-trace (one electrical story). If drivers differ, clear trace to avoid
  // implying a single net.
  useEffect(() => {
    if (verifyLinkedSignalKey || debugLinkedSignalKey) return;
    if (selection.wires.size <= 1) return;
    if (selection.nodes.size > 0) return;
    const wireIds = Array.from(selection.wires);
    const netSummary = summarizeMultiWireNetSelection(editorCircuit, wireIds, ioRowByNodeId);
    if (netSummary.sameNet && wireIds.length > 0) {
      const canonical = [...wireIds].sort()[0]!;
      applyWireNetTraceForWireId(canonical, 'multi-same-net');
      return;
    }
    clearTrace();
  }, [
    applyWireNetTraceForWireId,
    clearTrace,
    debugLinkedSignalKey,
    editorCircuit,
    ioRowByNodeId,
    selection.nodes.size,
    selection.wires,
    verifyLinkedSignalKey,
  ]);

  useEffect(() => {
    if (selection.nodes.size === 0) return;
    if (!autoWireSelectionTraceIdRef.current) return;
    if (
      traceStateRef.current?.kind === 'wire-net' &&
      traceStateRef.current.sourceKey === autoWireSelectionTraceIdRef.current
    ) {
      setTraceState(null);
    }
    autoWireSelectionTraceIdRef.current = null;
  }, [selection.nodes.size]);

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
        return;
      }

      // Ctrl+A / Cmd+A: select all nodes
      if ((event.ctrlKey || event.metaKey) && event.key === 'a' && !isTextInput) {
        event.preventDefault();
        handleSelectAll();
        return;
      }

      // Ctrl+X / Cmd+X: cut (copy + delete)
      if ((event.ctrlKey || event.metaKey) && event.key === 'x' && !isTextInput) {
        event.preventDefault();
        handleCut();
        return;
      }

      // Shift+F: fit camera to selection (falls back to all nodes)
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
          && event.key.toLowerCase() === 'f' && !isTextInput) {
        event.preventDefault();
        handleFitToSelection();
        return;
      }

      // Arrow keys: nudge selected nodes for precise grouped movement.
      if (!event.ctrlKey && !event.metaKey && !event.altKey && !isTextInput) {
        const baseStep = snapToGrid ? gridSize : Math.max(1, Math.round(gridSize / 2));
        const step = event.shiftKey ? baseStep * 4 : baseStep;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleNudgeSelection(-step, 0);
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleNudgeSelection(step, 0);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          handleNudgeSelection(0, -step);
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          handleNudgeSelection(0, step);
          return;
        }
      }

      // Gate hotkeys (bare, no modifier): a=AND, o=OR, n=NOT, x=XOR
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !isTextInput) {
        if (event.key === 'a') { event.preventDefault(); beginNodePlacement('AND'); return; }
        if (event.key === 'o') { event.preventDefault(); beginNodePlacement('OR'); return; }
        if (event.key === 'n') { event.preventDefault(); beginNodePlacement('NOT'); return; }
        if (event.key === 'x') { event.preventDefault(); beginNodePlacement('XOR'); return; }
      }

      // Ctrl+Z / Cmd+Z: undo — fires only when CanvasHost has not already handled it
      // (CanvasHost calls e.preventDefault() for Ctrl+Z when canvas is active, so we
      // check defaultPrevented to avoid a double-undo when both handlers fire)
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
          && !isTextInput && !event.defaultPrevented) {
        event.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z: redo — same defaultPrevented guard
      if ((event.ctrlKey || event.metaKey) && !isTextInput && !event.defaultPrevented &&
          (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault();
        handleRedo();
        return;
      }

      // Delete / Backspace: delete selection — use live store state to avoid double-delete
      // CanvasHost handles Delete too (without preventDefault), so we read live state to
      // check whether the canvas handler has already cleared the selection.
      if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextInput) {
        const liveSelection = useLogicViewStore.getState().selection;
        if (liveSelection.nodes.size > 0 || liveSelection.wires.size > 0) {
          deleteSelection();
        }
        return;
      }

      // Escape: clear selection globally (idempotent — safe even if CanvasHost also fires)
      if (event.key === 'Escape' && !isTextInput) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [beginNodePlacement, clearSelection, deleteSelection, gridSize, handleCopy, handleCut, handleDuplicate, handleFitToSelection, handleNudgeSelection, handlePaste, handleRedo, handleSelectAll, handleUndo, snapToGrid, toggleSnapToGrid]);

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
  const boardResourcesCount = filteredBoardGroups.reduce((count, group) => count + group.entries.length, 0);
  const boardResultsForcedOpen = paletteHasQuery && filteredBoardGroups.length > 0;
  const isBoardSectionCollapsed = !boardResultsForcedOpen && collapsedDockSections.has('board');
  const isLiveInputsSectionCollapsed = collapsedDockSections.has('live-inputs');
  const hasPaletteResults =
    filteredPaletteByCategory.logic.length > 0 ||
    filteredPaletteByCategory.sequential.length > 0 ||
    filteredPaletteByCategory.io.length > 0 ||
    filteredPaletteByCategory.components.length > 0 ||
    filteredCustomComponents.length > 0 ||
    filteredMacros.length > 0 ||
    filteredBoardGroups.length > 0;

  const toggleDockSection = useCallback((sectionId: DesignDockSectionId) => {
    setCollapsedDockSections((previous) => {
      const next = new Set(previous);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const renderNodePaletteCard = (
    item: Pick<PaletteItem, 'type' | 'title' | 'subtitle' | 'glyph' | 'paletteBadge'>,
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
            {options?.badge || item.paletteBadge ? (
              <span className="ide-palette-card-badge">{options?.badge ?? item.paletteBadge}</span>
            ) : null}
          </span>
          <span className="ide-palette-card-subtitle">{item.subtitle}</span>
        </span>
      </button>
    );
  };
  const [boardPaletteSection, ioPaletteSection, logicPaletteSection, sequentialPaletteSection, reusablePaletteSection] =
    PALETTE_SECTION_ORDER;
  const renderSelectionIdentityCard = () => {
    if (hasSingleSelectedNode && selectedNode) {
      const displayName = selectedNode.label?.trim() || nodeTypeLabel(selectedNode.type);
      const typeName = nodeTypeLabel(selectedNode.type);
      const studentNodeLabel = describeNodeForStudents(selectedNode, selectedNodeIoRow);
      const boardSummary = selectedNodeIoRow
        ? `${selectedNodeIoRow.label} -> ${selectedNodeIoRow.pin || 'unmapped'}`
        : 'No board mapping';
      const selectedLogicalDirection = selectedNodeIoRow
        ? selectedNodeIoRow.direction === 'in'
          ? `Input signal - ${SIGNAL_LANGUAGE.inputSignal}`
          : `Output signal - ${SIGNAL_LANGUAGE.outputSignal}`
        : selectedNode.type === 'INPUT'
          ? `Input signal - ${SIGNAL_LANGUAGE.inputSignal}`
          : selectedNode.type === 'OUTPUT' || selectedNode.type === 'Lamp'
            ? `Output signal - ${SIGNAL_LANGUAGE.outputSignal}`
            : 'Internal part or signal path';
      const selectedBoardResource = selectedNodeIoRow?.label?.trim()
        ? selectedNodeIoRow.label.trim()
        : selectedNodeIoRow
          ? 'Unassigned board resource'
          : 'Not mapped to a board resource';
      const selectedPackagePin = selectedNodeIoRow?.pin?.trim()
        ? selectedNodeIoRow.pin.trim()
        : 'No package pin yet';
      const showSelectedSignalModel = Boolean(
        selectedNodeIoRow ||
        selectedNode.type === 'INPUT' ||
        selectedNode.type === 'Switch' ||
        selectedNode.type === 'OUTPUT' ||
        selectedNode.type === 'Lamp'
      );
      const defaultNextStep = primarySelectionIssue?.hint
        ?? (selectedNodeIoRow
          ? 'Rename it, inspect its mapped signal, or trace the connected net next.'
          : 'Rename it, inspect its pins, or trace the connected net next.');
      const nextStep = selectedSequentialInspector?.nextStep ?? defaultNextStep;
      return (
        <div className="ide-design-selection-inspector" data-testid="ide-design-selection-inspector">
          <div className="ide-design-inspector-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="ide-design-inspector-eyebrow">Selection</span>
            <div className="ide-design-inspector-identity-row">
              <div className="ide-design-inspector-title-block">
                <div className="ide-design-selection-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-inspector-identity-title">{displayName}</strong>
                  {selectedNode.label?.trim() ? (
                    <>
                      <span className="ide-design-identity-sep"> / </span>
                      <span>{typeName}</span>
                    </>
                  ) : null}
                </div>
                <p className="ide-design-inspector-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  <span data-testid="ide-design-inspector-part-kind">
                    {selectedNodeTeachingProfile?.partKind ?? 'Part'}
                  </span>
                  <span className="ide-design-identity-sep"> · </span>
                  <span data-testid="ide-design-selection-type">{typeName}</span>
                </p>
                {selectedNodeTeachingProfile ? (
                  <div className="ide-design-inspector-meaning" data-testid="ide-design-inspector-meaning">
                    <p
                      className="ide-design-inspector-what-it-is"
                      data-testid="ide-design-inspector-what-it-is"
                    >
                      {selectedNodeTeachingProfile.whatItIs}
                    </p>
                    {selectedNodeTeachingProfile.structureHint ? (
                      <p
                        className="ide-design-inspector-structure-hint"
                        data-testid="ide-design-inspector-structure-hint"
                      >
                        {selectedNodeTeachingProfile.structureHint}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className={`ide-design-inspector-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="ide-design-inspector-next-step" data-testid="ide-design-inspector-next-step">
              {nextStep}
            </p>
            {renderSelectionGuidance()}
            <div className="ide-design-inspector-facts ide-kv-list">
              {showSelectedSignalModel ? (
                <div
                  className="ide-design-inspector-signal-model"
                  data-testid="ide-design-selected-signal-model"
                >
                  <div>
                    <span>Label</span>
                    <strong>{displayName}</strong>
                  </div>
                  <div>
                    <span>Logical direction</span>
                    <strong>{selectedLogicalDirection}</strong>
                  </div>
                  <div>
                    <span>Board resource</span>
                    <strong>{selectedBoardResource}</strong>
                  </div>
                  <div>
                    <span>Package pin</span>
                    <strong>{selectedPackagePin}</strong>
                  </div>
                </div>
              ) : null}
              <div className="ide-kv-row">
                <span>Reference</span>
                <code data-testid="ide-design-selection-id">{studentNodeLabel}</code>
              </div>
              <div className="ide-kv-row">
                <span>Board mapping</span>
                <span>{boardSummary}</span>
              </div>
              {selectedSequentialInspector ? (
                <>
                  <div className="ide-kv-row">
                    <span>Timing role</span>
                    <span data-testid="ide-design-sequential-role">{selectedSequentialInspector.roleLabel}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Timing context</span>
                    <span data-testid="ide-design-sequential-timing-context">
                      {selectedSequentialInspector.timingContext}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      );
    }
    if (hasMultiNodeSelection) {
      return (
        <div className="ide-design-selection-inspector" data-testid="ide-design-multiselect-summary">
          <div className="ide-design-inspector-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="ide-design-inspector-eyebrow">Selection</span>
            <div className="ide-design-inspector-identity-row">
              <div className="ide-design-inspector-title-block">
                <div className="ide-design-selection-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-multiselect-count">{selection.nodes.size} nodes selected</strong>
                </div>
                <p className="ide-design-inspector-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  Use Arrow keys to nudge this group, align shared edges when it gets messy, or press Ctrl+D / Cmd+D to duplicate it.
                </p>
              </div>
              <span className={`ide-design-inspector-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="ide-design-inspector-next-step" data-testid="ide-design-inspector-next-step">
              Keep refining the selection as one working unit, then save it as a reusable block when the group stabilizes.
            </p>
            <div className="ide-design-selection-pins" data-testid="ide-design-multiselect-types">
              {selectedTypeSummary.map((entry) => (
                <span key={entry.type} className="ide-design-pin-pill">
                  {nodeTypeLabel(entry.type)}: {entry.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (hasMultiWireSelection) {
      return (
        <div className="ide-design-selection-inspector" data-testid="ide-design-multiselect-summary">
          <div className="ide-design-inspector-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="ide-design-inspector-eyebrow">Selection</span>
            <div className="ide-design-inspector-identity-row">
              <div className="ide-design-inspector-title-block">
                <div className="ide-design-selection-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-multiwire-count">{selectedWireIdsAll.length} wire segments selected</strong>
                </div>
                <p className="ide-design-inspector-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  {multiWireNetSummary?.headline ?? 'Multiple wires — comparing signal paths'}
                </p>
                {multiWireNetSummary ? (
                  <div className="ide-design-inspector-meaning" data-testid="ide-design-multiwire-net-meaning">
                    <p className="ide-design-inspector-what-it-is" data-testid="ide-design-multiwire-net-detail">
                      {multiWireNetSummary.detail}
                    </p>
                    {multiWireNetSummary.groupLabels.length > 0 ? (
                      <p
                        className="ide-design-inspector-structure-hint"
                        data-testid="ide-design-multiwire-group-labels"
                        title={multiWireNetSummary.groupLabels.join('\n')}
                      >
                        Signal groups: {multiWireNetSummary.groupLabels.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className={`ide-design-inspector-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="ide-design-inspector-next-step" data-testid="ide-design-inspector-next-step">
              {multiWireNetSummary?.sameNet
                ? 'To read live value for one hop, select a single wire. The canvas still shows the full net while several segments on that net stay selected.'
                : 'Pick one net at a time: deselect until you have one driver in this list, or a single wire, then use Trace and the signal panel on the right.'}
            </p>
          </div>
        </div>
      );
    }
    if (selectedWireContext) {
      const nextStep = primarySelectionIssue?.hint ?? 'Trace this net, pin it, or inspect its source and sink below.';
      return (
        <div className="ide-design-selection-inspector" data-testid="ide-design-selection-inspector">
          <div className="ide-design-inspector-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="ide-design-inspector-eyebrow">Selection</span>
            <div className="ide-design-inspector-identity-row">
              <div className="ide-design-inspector-title-block">
                <div className="ide-design-selection-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-inspector-identity-title">
                    {describeStudentSignalKey(selectedWireContext.signalKey, editorCircuit, ioRowByNodeId)}
                  </strong>
                </div>
                <p className="ide-design-inspector-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  Wire net from {selectedWireContext.sourceLabel} to {selectedWireContext.targetLabel}
                </p>
              </div>
              <span className={`ide-design-inspector-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="ide-design-inspector-next-step" data-testid="ide-design-inspector-next-step">
              {nextStep}
            </p>
            <div className="ide-design-inspector-facts ide-kv-list">
              <div className="ide-kv-row">
                <span>Type</span>
                <span data-testid="ide-design-selection-type">Wire</span>
              </div>
              <div className="ide-kv-row">
                <span>Connection</span>
                <code data-testid="ide-design-selection-id">
                  {`${selectedWireContext.sourceLabel} -> ${selectedWireContext.targetLabel}`}
                </code>
              </div>
              <div className="ide-kv-row">
                <span>Branches</span>
                <span>{selectedWireContext.branchCount}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (activeInspectorSignalKey) {
      const signalFocusSubtitle =
        activeDebugContext != null
          ? activeInspectorSignalFocusPresentation?.focusLabel
            ? `Debug focus ${activeInspectorSignalFocusPresentation.focusLabel}`
            : 'Debug focus'
          : activeVerifySignal != null
            ? activeInspectorSignalFocusPresentation?.focusLabel
              ? `Verify focus ${activeInspectorSignalFocusPresentation.focusLabel}`
              : 'Verify focus'
            : 'Signal focus';
      const bridgeNextStep =
        activeInspectorSignalLandingTarget && activeInspectorSignalFocusPresentation?.needsBridge
          ? `${activeDebugContext != null ? 'Debug signal' : 'Verify signal'} ${activeInspectorSignalFocusPresentation.focusLabel} maps here as ${activeInspectorSignalFocusPresentation.signalLabel}. ${primarySelectionIssue?.hint ?? 'Inspect the highlighted path first.'}`
          : null;
      const nextStep =
        bridgeNextStep ??
        primarySelectionIssue?.hint ??
        (activeInspectorSignalLandingTarget
          ? `Start at ${activeInspectorSignalLandingTarget.signalLabel} and inspect the highlighted path first.`
          : 'Pin this signal or step simulation to inspect how it changes.');
      return (
        <div className="ide-design-selection-inspector" data-testid="ide-design-selection-inspector">
          <div className="ide-design-inspector-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="ide-design-inspector-eyebrow">Selection</span>
            <div className="ide-design-inspector-identity-row">
              <div className="ide-design-inspector-title-block">
                <div className="ide-design-selection-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-inspector-identity-title">{activeInspectorSignalLabel}</strong>
                </div>
                <p className="ide-design-inspector-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  {signalFocusSubtitle}
                </p>
              </div>
              <span className={`ide-design-inspector-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="ide-design-inspector-next-step" data-testid="ide-design-inspector-next-step">
              {nextStep}
            </p>
            <div className="ide-design-inspector-facts ide-kv-list">
              <div className="ide-kv-row">
                <span>Type</span>
                <span data-testid="ide-design-selection-type">Signal</span>
              </div>
              <div className="ide-kv-row">
                <span>Signal</span>
                <code data-testid="ide-design-selection-id">{activeInspectorSignalLabel}</code>
              </div>
              <div className="ide-kv-row">
                <span>Samples</span>
                <span>{activeInspectorSignalSnapshot?.samples ?? selectedSignalHistory.length}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (isReplayMode) {
      return (
        <div className="ide-design-inspector-empty-card ide-design-inspector-replay-idle" data-testid="ide-design-inspector-empty">
          <span className="ide-design-inspector-eyebrow ide-design-inspector-eyebrow--inspect">Inspect mode</span>
          <div className="ide-design-inspector-title-block">
            <div className="ide-design-selection-identity">
              <strong data-testid="ide-design-inspector-identity-title">{activeReplaySelectionLabel}</strong>
            </div>
            <p className="ide-design-inspector-subtitle" data-testid="ide-design-inspector-identity-subtitle">
              {activeReplayTimingHint ?? 'Verify-authored replay'}
            </p>
          </div>
          <div className="ide-design-replay-idle-guide" data-testid="ide-design-replay-idle-guide">
            {activeDebugContext ? (
              <div className="ide-design-replay-failure-context" data-testid="ide-design-replay-failure-context">
                <span className="ide-design-replay-failure-signal">{getVerifyDebugDisplaySignal(activeDebugContext)}</span>
                <span className="ide-design-replay-failure-verdict">expected&nbsp;<code>{activeDebugContext.expected}</code>&nbsp;got&nbsp;<code>{activeDebugContext.actual}</code></span>
              </div>
            ) : activeVerifySignal ? (
              <p className="ide-design-replay-guide-hint">
                Focus: <code>{activeVerifySignalPresentation?.focusLabel ?? activeVerifySignal}</code>
              </p>
            ) : null}
            <p className="ide-design-replay-guide-hint" data-testid="ide-design-replay-guide-hint">
              Click any gate or wire on the canvas to see its value at this tick.
            </p>
          </div>
          {renderReplayContextActions()}
        </div>
      );
    }
    // R3 reconciliation: when Project → Design focus is active, the canvas banner
    // already owns "what you landed on". The large empty Selection card only
    // competed with that story — show a single deferral line until there is a
    // real canvas selection to inspect.
    if (focusedAssetContext) {
      return (
        <div className="ide-design-selection-deferred" data-testid="ide-design-selection-deferred">
          <p className="ide-copy" style={{ margin: 0 }}>
            <span className="ide-design-inspector-eyebrow">Canvas selection</span>
            {' — '}
            Project focus is active. Select a node or wire to inspect it here, or use{' '}
            <strong>Clear focus</strong> on the canvas banner.
          </p>
        </div>
      );
    }
    return (
      <div className="ide-design-inspector-empty-card" data-testid="ide-design-inspector-empty">
        <span className="ide-design-inspector-eyebrow">Inspector</span>
        <div className="ide-design-inspector-title-block">
          <div className="ide-design-selection-identity">
            <strong data-testid="ide-design-inspector-identity-title">Canvas ready</strong>
          </div>
          <p className="ide-design-inspector-subtitle" data-testid="ide-design-inspector-identity-subtitle">
            Selection state, mapping, and signal context land here.
          </p>
          <p className="ide-design-logical-io-note" data-testid="ide-design-logical-io-explainer">
            {SIGNAL_LANGUAGE.designLogicalIo} A label is the name shown in RedByte; mapping binds that signal to a board resource and package pin.
          </p>
        </div>
        {!showBlankStateCard ? (
          <p className="ide-design-inspector-next-step" data-testid="ide-design-inspector-next-step">
            Select a node, wire, or verify-linked signal to inspect it without leaving the canvas.
          </p>
        ) : null}
      </div>
    );
  };
  const renderSelectionGuidance = () => {
    if (selectionIssueSummary || primarySelectionDiagnostic) {
      return (
        <div className="ide-design-inspector-guidance" data-testid="ide-design-inspector-guidance">
          {selectionIssueSummary}
          {primarySelectionIssue ? (
            <div className="ide-inline-actions">
              <IdeButton
                tone="secondary"
                onClick={() => focusDesignIssue(primarySelectionIssue)}
                testId="ide-design-inspector-focus-issue"
              >
                Focus issue
              </IdeButton>
            </div>
          ) : null}
          {selectedNodeDiagnostics.length > 0 ? (
            <div className="ide-design-inspector-diagnostics" data-testid="ide-design-selection-diagnostics">
              <ul className="ide-design-inspector-diagnostic-list">
                {selectedNodeDiagnostics.slice(0, 3).map((diagnostic) => (
                  <li
                    key={`${diagnostic.code}-${diagnostic.message}`}
                    className={`ide-design-inspector-diagnostic-item is-${diagnostic.severity === 'error' ? 'error' : 'warn'}`}
                  >
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );
    }
    return null;
  };
  const renderSelectionActions = () => {
    if (hasSingleSelectedNode && selectedNode) {
      return (
        <div className="ide-design-inspector-section-stack">
          <div className="ide-design-inspector-action-group" data-testid="ide-design-inspector-edit-group">
            <span className="ide-design-inspector-group-label">Edit</span>
            <div className="ide-design-inspector-action-grid">
              <IdeButton tone="secondary" onClick={handleCopy} testId="ide-design-copy-btn">
                Copy
              </IdeButton>
              <IdeButton tone="secondary" onClick={handleDuplicate} testId="ide-design-duplicate-btn">
                Duplicate
              </IdeButton>
            </div>
            {(() => {
              const swapTargets = GATE_SWAP_FAMILIES[selectedNode.type];
              return swapTargets && swapTargets.length > 0 ? (
                <div className="ide-design-inspector-subgroup" data-testid="ide-design-swap-group">
                  <span className="ide-design-inspector-group-label">Swap type</span>
                  <div className="ide-design-swap-chips">
                    {swapTargets.map((targetType) => (
                      <button
                        key={targetType}
                        type="button"
                        className="ide-design-swap-chip"
                        data-testid={`ide-design-swap-${targetType.toLowerCase()}`}
                        onClick={() => handleGateSwap(targetType)}
                      >
                        {targetType}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
            {renderSelectionProperties()}
          </div>
          <div className="ide-design-inspector-action-group" data-testid="ide-design-trace-group">
            <span className="ide-design-inspector-group-label">Net tracing</span>
            <div className="ide-design-inspector-action-grid">
              {primarySelectionIssue ? (
                <IdeButton tone="secondary" onClick={() => focusDesignIssue(primarySelectionIssue)}>
                  Focus issue
                </IdeButton>
              ) : null}
              <IdeButton tone="ghost" onClick={traceSelectedContext} disabled={!preferredNodeTracePort} testId="ide-design-context-trace">
                Trace net
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => selectedNode && handleFanoutTrace(selectedNode.id)} disabled={!selectedNodeHasFanout} testId="ide-design-context-trace-fanout">
                Trace {'->'}
              </IdeButton>
              <IdeButton tone="ghost" onClick={pinActiveInspectorSignal} disabled={!activeInspectorSignalKey} testId="ide-design-context-pin">
                {isActiveInspectorSignalPinned ? 'Unpin' : 'Pin'}
              </IdeButton>
              <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                Clear
              </IdeButton>
            </div>
          </div>
          {selectedSequentialInspector?.actionLabel &&
          ((selectedSequentialInspector.actionKind === 'trace-control' && selectedSequentialInspector.actionPort) ||
            (selectedSequentialInspector.actionKind === 'go-to-hardware' && onGoToHardware)) ? (
            <div className="ide-design-inspector-action-group" data-testid="ide-design-sequential-action-group">
              <span className="ide-design-inspector-group-label">Sequential next step</span>
              <div className="ide-design-inspector-action-grid">
                {selectedSequentialInspector.actionKind === 'trace-control' && selectedSequentialInspector.actionPort ? (
                  <IdeButton
                    tone="secondary"
                    onClick={() => handlePortClick(selectedNode.id, selectedSequentialInspector.actionPort)}
                    testId="ide-design-context-sequential-action"
                  >
                    {selectedSequentialInspector.actionLabel}
                  </IdeButton>
                ) : null}
                {selectedSequentialInspector.actionKind === 'go-to-hardware' && onGoToHardware ? (
                  <IdeButton
                    tone="secondary"
                    onClick={onGoToHardware}
                    testId="ide-design-context-sequential-action"
                  >
                    {selectedSequentialInspector.actionLabel}
                  </IdeButton>
                ) : null}
              </div>
            </div>
          ) : null}
          {(selectedNode.type === 'INPUT' || selectedNode.type === 'Switch') && onRuntimeSimSetInput ? (
            <div className="ide-design-inspector-action-group" data-testid="ide-design-inspector-input-control">
              <span className="ide-design-inspector-group-label">Input control</span>
              <div className="ide-design-inspector-action-grid">
                {(() => {
                  const currentVal = liveSignals.get(`${selectedNode.id}.out`) ?? 0;
                  return (
                    <button
                      type="button"
                      className={`ide-design-input-toggle ${currentVal === 1 ? 'is-on' : 'is-off'}`}
                      data-testid="ide-design-inspector-input-toggle"
                      aria-pressed={currentVal === 1}
                      onClick={handleInspectorInputToggle}
                    >
                      {currentVal === 1 ? 'HIGH — click to set LOW' : 'LOW — click to set HIGH'}
                    </button>
                  );
                })()}
              </div>
            </div>
          ) : null}
          <div className="ide-design-inspector-action-group ide-design-inspector-group--danger" data-testid="ide-design-inspector-danger-group">
            <span className="ide-design-inspector-group-label">Danger</span>
            <div className="ide-design-inspector-action-grid">
              <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-inspector-delete">
                Delete node
              </IdeButton>
            </div>
          </div>
        </div>
      );
    }
    if (hasMultiNodeSelection) {
      return (
        <div className="ide-design-inspector-section-stack">
          <div className="ide-design-inspector-action-group" data-testid="ide-design-inspector-edit-group">
            <span className="ide-design-inspector-group-label">Edit</span>
            <div className="ide-design-inspector-action-grid">
              <IdeButton tone="secondary" onClick={handleCopy} testId="ide-design-copy-btn">
                Copy ({selection.nodes.size})
              </IdeButton>
              <IdeButton tone="secondary" onClick={handleDuplicate} testId="ide-design-duplicate-btn">
                Duplicate ({selection.nodes.size})
              </IdeButton>
              {clipboard ? (
                <IdeButton tone="secondary" onClick={handlePaste} testId="ide-design-paste-btn">
                  Paste
                </IdeButton>
              ) : null}
            </div>
          </div>
          <div className="ide-design-inspector-action-group" data-testid="ide-design-inspector-arrange-group">
            <span className="ide-design-inspector-group-label">Arrange</span>
            <div className="ide-design-inspector-action-grid">
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('left')} testId="ide-design-align-left-btn">
                Align left
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('top')} testId="ide-design-align-top-btn">
                Align top
              </IdeButton>
              <IdeButton
                tone="ghost"
                onClick={handleDistributeSelectionHorizontally}
                disabled={selection.nodes.size < 3}
                testId="ide-design-distribute-horizontal-btn"
              >
                Distribute horizontally
              </IdeButton>
            </div>
          </div>
          {onSaveMacro && selectedNodeIdsAll.length >= 2 ? (
            <div className="ide-design-inspector-action-group">
              <span className="ide-design-inspector-group-label">Compose</span>
              <div className="ide-design-inspector-action-grid">
                <IdeButton tone="ghost" onClick={openMacroDialog} testId="ide-design-save-macro-open">
                  Save as Macro...
                </IdeButton>
              </div>
            </div>
          ) : null}
          {onSaveAsComponent && selectedNodeIdsAll.length >= 2 ? (
            <div className="ide-design-inspector-action-group">
              <span className="ide-design-inspector-group-label">Reusable block</span>
              <div className="ide-design-inspector-action-grid">
                {saveComponentOpen ? (
                  <>
                    <input
                      className="ide-text-input"
                      type="text"
                      placeholder="Component name..."
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
                    Save as Component...
                  </IdeButton>
                )}
              </div>
              {savedComponentToast ? (
                <IdeCallout tone="success" testId="ide-design-save-component-toast">
                  Saved "{savedComponentToast}" and added it to the Custom palette.
                </IdeCallout>
              ) : null}
            </div>
          ) : null}
          <div className="ide-design-inspector-action-group ide-design-inspector-group--danger" data-testid="ide-design-inspector-danger-group">
            <span className="ide-design-inspector-group-label">Danger</span>
            <div className="ide-design-inspector-action-grid">
              <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-inspector-delete">
                Delete {selection.nodes.size} nodes
              </IdeButton>
            </div>
          </div>
        </div>
      );
    }
    if (selectedWireContext) {
      return (
        <div className="ide-design-inspector-section-stack">
          <div className="ide-design-inspector-action-group" data-testid="ide-design-trace-group">
            <span className="ide-design-inspector-group-label">Net tracing</span>
            <div className="ide-design-inspector-action-grid">
              <IdeButton tone="secondary" onClick={() => traceSelectedWire(selectedWireContext.wireId)} testId="ide-design-context-trace">
                Trace net
              </IdeButton>
              <IdeButton tone="secondary" onClick={pinActiveInspectorSignal} disabled={!activeInspectorSignalKey} testId="ide-design-context-pin">
                {isActiveInspectorSignalPinned ? 'Unpin signal' : 'Pin signal'}
              </IdeButton>
              <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                Clear trace
              </IdeButton>
              <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-context-delete-wire">
                Delete wire
              </IdeButton>
            </div>
          </div>
        </div>
      );
    }
    if (activeInspectorSignalKey) {
      return (
        <div className="ide-design-inspector-section-stack">
          <div className="ide-design-inspector-action-group" data-testid="ide-design-trace-group">
            <span className="ide-design-inspector-group-label">Signal actions</span>
            <div className="ide-design-inspector-action-grid">
              {activeInspectorSignalLandingTarget ? (
                <IdeButton tone="secondary" onClick={focusActiveInspectorSignalNode} testId="ide-design-inspector-focus-node">
                  Inspect {activeInspectorSignalLandingTarget.nodeLabel}
                </IdeButton>
              ) : null}
              <IdeButton tone="secondary" onClick={pinActiveInspectorSignal} testId="ide-design-context-pin">
                {isActiveInspectorSignalPinned ? 'Unpin signal' : 'Pin signal'}
              </IdeButton>
              <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                Clear trace
              </IdeButton>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };
  const renderSelectionProperties = () => {
    if (hasSingleSelectedNode && selectedNode) {
      const registerCfg = REGISTER_FAMILY_TYPES.has(selectedNode.type)
        ? ((selectedNode.config ?? {}) as Record<string, unknown>)
        : null;
      const registerWidth = registerCfg ? normalizeRegisterWidth(selectedNode.type, registerCfg) : 1;
      return (
        <div className="ide-design-inspector-inline-editor" data-testid="ide-design-inspector-inline-editor">
          {renderNodeLabelEditor(selectedNode)}
          {registerCfg ? (
            <div className="ide-design-register-config" data-testid="ide-design-register-config">
              <span className="ide-design-inspector-group-label">Register semantics</span>
              <p className="ide-design-inspector-hint">
                Matches simulation and export. For bus registers, width controls how many D[i]/Q[i] taps appear on the
                chip.
              </p>
              {selectedNode.type !== 'Register1' ? (
                <label className="ide-design-inspector-field">
                  <span>Width (bits)</span>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    className="ide-export-pin-input"
                    value={registerWidth}
                    onChange={(event) => {
                      const next = Math.min(32, Math.max(1, parseInt(event.target.value, 10) || 1));
                      patchSelectedRegisterFamilyConfig({ width: next });
                    }}
                    data-testid="ide-design-register-width"
                  />
                </label>
              ) : null}
              <label className="ide-design-inspector-field ide-design-inspector-field--checkbox">
                <input
                  type="checkbox"
                  checked={registerCfg.hasEnable === true}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ hasEnable: event.target.checked })}
                  data-testid="ide-design-register-has-enable"
                />
                <span>Model clock enable (EN / CE)</span>
              </label>
              <label className="ide-design-inspector-field">
                <span>Clock edge</span>
                <select
                  className="ide-export-pin-input"
                  value={String(registerCfg.clockPolarity ?? 'rising_edge')}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ clockPolarity: event.target.value })}
                  data-testid="ide-design-register-clock-edge"
                >
                  <option value="rising_edge">Rising edge</option>
                  <option value="falling_edge">Falling edge</option>
                </select>
              </label>
              <label className="ide-design-inspector-field">
                <span>Reset kind</span>
                <select
                  className="ide-export-pin-input"
                  value={String(registerCfg.resetKind ?? 'none')}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ resetKind: event.target.value })}
                  data-testid="ide-design-register-reset-kind"
                >
                  <option value="none">None</option>
                  <option value="async_clear">Async clear</option>
                  <option value="async_preset">Async preset</option>
                  <option value="sync_reset">Synchronous reset</option>
                  <option value="sync_set">Synchronous set</option>
                </select>
              </label>
              <label className="ide-design-inspector-field">
                <span>Reset polarity</span>
                <select
                  className="ide-export-pin-input"
                  value={String(registerCfg.resetPolarity ?? 'active_high')}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ resetPolarity: event.target.value })}
                  data-testid="ide-design-register-reset-polarity"
                >
                  <option value="active_high">Active high</option>
                  <option value="active_low">Active low</option>
                </select>
              </label>
              <label className="ide-design-inspector-field">
                <span>Enable polarity</span>
                <select
                  className="ide-export-pin-input"
                  value={String(registerCfg.enablePolarity ?? 'active_high')}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ enablePolarity: event.target.value })}
                  data-testid="ide-design-register-enable-polarity"
                >
                  <option value="active_high">Active high</option>
                  <option value="active_low">Active low</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      );
    }
    return null;
  };
  const renderReplayContextRows = () => {
    const hasReplayContext =
      effectiveExternalDebugTick != null ||
      staleReplayBreadcrumb != null ||
      activeVerifySignal != null ||
      activeDebugContext != null;
    if (!hasReplayContext) {
      return null;
    }

    return (
      <>
        <div className="ide-kv-row">
          <span>Selected case</span>
          <span>{activeSimulationSelectionLabel}</span>
        </div>
        <div className="ide-kv-row">
          <span>State</span>
          <span>
            {staleReplayBreadcrumb
              ? 'Stale breadcrumb only'
              : effectiveExternalDebugTick != null
                ? 'Verify-authored replay'
                : 'Live circuit'}
          </span>
        </div>
        <div className="ide-kv-row">
          <span>Mode</span>
          <span>{simModeLabel}</span>
        </div>
        {activeReplayTimingHint ? (
          <div className="ide-kv-row">
            <span>Sample</span>
            <span>{activeReplayTimingHint}</span>
          </div>
        ) : null}
        {simulationStory.clockEvent ? (
          <div className="ide-kv-row">
            <span>Clock</span>
            <span>{simulationStory.clockLabel} {simulationStory.clockEvent} edge</span>
          </div>
        ) : null}
        {activeVerifySignal ? (
          <div className="ide-kv-row">
            <span>Verify focus</span>
            <code>{activeVerifySignalPresentation?.focusLabel ?? activeVerifySignal}</code>
          </div>
        ) : null}
        {activeDebugContext ? (
          <div className="ide-kv-row">
            <span>Expected / observed</span>
            <span>
              <code>{activeDebugContext.expected}</code> / <code>{activeDebugContext.actual}</code>
            </span>
          </div>
        ) : null}
      </>
    );
  };
  const renderReplayContextActions = () => {
    const hasReplayContext =
      effectiveExternalDebugTick != null ||
      staleReplayBreadcrumb != null ||
      activeVerifySignal != null ||
      activeDebugContext != null;

    if (!hasReplayContext || !onGoToVerify) {
      return null;
    }

    return (
      <div className="ide-inline-actions ide-copy-top-gap">
        <IdeButton
          tone="secondary"
          onClick={onGoToVerify}
          testId="ide-design-replay-context-return"
        >
          Return to Verify waveform
        </IdeButton>
      </div>
    );
  };
  /** When the workspace strip already shows the full trace sentence, the dock line repeats it — use a calmer "Active" with tooltip. */
  const formatTraceStateDock = (inActiveTrace: boolean) => {
    if (!inActiveTrace) {
      return { text: 'No trace locked' as const, title: undefined as string | undefined };
    }
    if (showWorkspaceStatusBar && traceState) {
      return { text: 'Active' as const, title: traceState.label };
    }
    return { text: traceState!.label, title: undefined as string | undefined };
  };
  const renderSelectionState = () => {
    if (hasSingleSelectedNode && selectedNode) {
      if (selectedSequentialInspector) {
        return (
          <div className="ide-design-inspector-section-stack">
            <IdeCallout
              tone="info"
              title="Sequential guidance"
              testId="ide-design-sequential-guidance"
            >
              <span data-testid="ide-design-sequential-guidance-copy">
                {selectedSequentialInspector.behaviorSummary}
              </span>
            </IdeCallout>
            <div className="ide-design-live-summary">
              <div className="ide-kv-list">
                <div className="ide-kv-row">
                  <span>Role</span>
                  <span>{selectedSequentialInspector.roleLabel}</span>
                </div>
                {selectedSequentialInspector.controlLabel ? (
                  <div className="ide-kv-row">
                    <span>{selectedSequentialInspector.controlLabel}</span>
                    <span data-testid="ide-design-sequential-control-source">
                      {selectedSequentialInspector.controlSourceLabel ?? 'No source wired'}
                    </span>
                  </div>
                ) : null}
                {selectedSequentialInspector.controlLabel && selectedSequentialInspector.controlActivity ? (
                  <div className="ide-kv-row">
                    <span>Control activity</span>
                    <span data-testid="ide-design-sequential-control-activity">
                      {selectedSequentialInspector.controlActivity}
                    </span>
                  </div>
                ) : !selectedSequentialInspector.controlLabel && selectedSequentialInspector.controlActivity ? (
                  <div className="ide-kv-row">
                    <span>Signal activity</span>
                    <span data-testid="ide-design-sequential-control-activity">
                      {selectedSequentialInspector.controlActivity}
                    </span>
                  </div>
                ) : null}
                <div className="ide-kv-row">
                  <span>{selectedSequentialInspector.ioSummaryLabel}</span>
                  <span data-testid="ide-design-sequential-input-summary">{selectedSequentialInspector.ioSummary}</span>
                </div>
                <div className="ide-kv-row">
                  <span>{selectedSequentialInspector.stateSummaryLabel}</span>
                  <span data-testid="ide-design-sequential-output-summary">{selectedSequentialInspector.stateSummary}</span>
                </div>
                <div className="ide-kv-row">
                  <span>Timing context</span>
                  <span>{selectedSequentialInspector.timingContext}</span>
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
                {selectedNodeReplayCausation ? (
                  <div className="ide-kv-row">
                    <span>Why now</span>
                    <span data-testid="ide-design-replay-causation">{selectedNodeReplayCausation}</span>
                  </div>
                ) : null}
                <div className="ide-kv-row">
                  <span>Trace state</span>
                  {(() => {
                    const dock = formatTraceStateDock(traceState?.nodeIds.has(selectedNode.id) ?? false);
                    return (
                      <span data-testid="ide-design-context-trace-state" title={dock.title}>
                        {dock.text}
                      </span>
                    );
                  })()}
                </div>
                {renderReplayContextRows()}
              </div>
            </div>
            {selectedNodeSignals && selectedNodeSignals.length > 0 ? (
              <div className="ide-design-selection-pins" data-testid="ide-design-selection-pins">
                {selectedNodeSignals.map((entry) => {
                  const val = entry.value;
                  const valStr = val === 1 ? '1' : val === 0 ? '0' : '?';
                  return (
                    <span
                      key={`${selectedNode.id}-${entry.port}`}
                      className={`ide-design-pin-pill ide-design-pin-pill--val${val === 1 ? '-hi' : val === 0 ? '-lo' : '-unk'}`}
                      data-testid={`ide-design-pin-pill-${selectedNode.id}-${entry.port}`}
                    >
                      {entry.port}
                      <span className="ide-design-pin-pill-value">{valStr}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}
            {renderReplayContextActions()}
          </div>
        );
      }
      return (
        <div className="ide-design-inspector-section-stack">
          {selectedNodeReplayCausation ? (
            <div className="ide-design-replay-causation-card" data-testid="ide-design-replay-causation-card">
              <span className="ide-design-replay-causation-label">Why now</span>
              <p className="ide-design-replay-causation-text" data-testid="ide-design-replay-causation">{selectedNodeReplayCausation}</p>
            </div>
          ) : null}
          <div className="ide-design-live-summary">
            <div className="ide-kv-list">
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
                <span>Trace state</span>
                {(() => {
                  const dock = formatTraceStateDock(traceState?.nodeIds.has(selectedNode.id) ?? false);
                  return (
                    <span data-testid="ide-design-context-trace-state" title={dock.title}>
                      {dock.text}
                    </span>
                  );
                })()}
              </div>
              {renderReplayContextRows()}
            </div>
          </div>
          {selectedNodeSignals && selectedNodeSignals.length > 0 ? (
            <div className="ide-design-selection-pins" data-testid="ide-design-selection-pins">
              {selectedNodeSignals.map((entry) => {
                const val = entry.value;
                const valStr = val === 1 ? '1' : val === 0 ? '0' : '?';
                return (
                  <span
                    key={`${selectedNode.id}-${entry.port}`}
                    className={`ide-design-pin-pill ide-design-pin-pill--val${val === 1 ? '-hi' : val === 0 ? '-lo' : '-unk'}`}
                    data-testid={`ide-design-pin-pill-${selectedNode.id}-${entry.port}`}
                  >
                    {entry.port}
                    <span className="ide-design-pin-pill-value">{valStr}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
          {selectedNodeInputDrivers.length > 0 && (
            <div className="ide-design-selection-drivers" data-testid="ide-design-input-drivers">
              {selectedNodeInputDrivers.map((d) => (
                <div key={d.port} className="ide-kv-row" data-testid={`ide-design-driver-row-${d.port}`}>
                  <span>{describePortForStudents(d.port)}</span>
                  <span>{d.driverLabel} · {d.value === 1 ? 'HIGH' : d.value === 0 ? 'LOW' : '?'}</span>
                </div>
              ))}
            </div>
          )}
          {renderReplayContextActions()}
        </div>
      );
    }
    if (selectedWireContext) {
      return (
        <div className="ide-design-live-summary">
          <div className="ide-kv-list">
            <div className="ide-kv-row" data-testid="ide-design-wire-connection">
              <span>Connection</span>
              <span>{selectedWireContext.sourceLabel} → {selectedWireContext.targetLabel}</span>
            </div>
            <div className="ide-kv-row">
              <span>Signal</span>
              <code>{describeStudentSignalKey(selectedWireContext.signalKey, editorCircuit, ioRowByNodeId)}</code>
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
            {selectedWireReplayCausation ? (
              <div className="ide-kv-row">
                <span>Why now</span>
                <span data-testid="ide-design-replay-causation">{selectedWireReplayCausation}</span>
              </div>
            ) : null}
            <div className="ide-kv-row">
              <span>Driver / Source</span>
              <span>{selectedWireContext.sourceLabel} · {describePortForStudents(selectedWireContext.sourcePort)}</span>
            </div>
            <div className="ide-kv-row">
              <span>Sink</span>
              <span>{selectedWireContext.targetLabel} · {describePortForStudents(selectedWireContext.targetPort)}</span>
            </div>
            <div className="ide-kv-row">
              <span>Trace state</span>
              {(() => {
                const inWireTrace = Boolean(
                  traceState?.kind === 'wire-net' && traceState.sourceKey === selectedWireContext.wireId,
                );
                const dock = formatTraceStateDock(inWireTrace);
                return (
                  <span data-testid="ide-design-context-trace-state" title={dock.title}>
                    {dock.text}
                  </span>
                );
              })()}
            </div>
            {renderReplayContextRows()}
          </div>
          {renderReplayContextActions()}
        </div>
      );
    }
    if (activeInspectorSignalKey) {
      return (
        <div className="ide-design-live-summary">
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Signal</span>
              <code data-testid="ide-design-signal-selected">{activeInspectorSignalLabel}</code>
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
            {activeInspectorReplayCausation ? (
              <div className="ide-kv-row">
                <span>Why now</span>
                <span data-testid="ide-design-replay-causation">{activeInspectorReplayCausation}</span>
              </div>
            ) : null}
            <div className="ide-kv-row">
              <span>Samples</span>
              <span>{activeInspectorSignalSnapshot?.samples ?? selectedSignalHistory.length}</span>
            </div>
            <div className="ide-kv-row">
              <span>Trace state</span>
              {(() => {
                const dock = formatTraceStateDock(Boolean(traceState));
                return (
                  <span data-testid="ide-design-context-trace-state" title={dock.title}>
                    {dock.text}
                  </span>
                );
              })()}
            </div>
            {renderReplayContextRows()}
          </div>
          {renderReplayContextActions()}
        </div>
      );
    }
    if (hasMultiNodeSelection || hasMultiWireSelection) {
      return null;
    }
    return (
      <IdeCallout tone="info" title="Signal / State">
        Select one node, wire, or signal to inspect live values, transitions, and replay context here.
      </IdeCallout>
    );
  };
  const renderAdvancedDetails = () => (
    <div className="ide-design-inspector-section-stack">
      {hasSingleSelectedNode && selectedNode ? (
        <>
          <div className="ide-design-selection-properties" data-testid="ide-design-selection-properties">
            <span className="ide-design-inspector-group-label">Raw properties</span>
            <div className="ide-kv-list">
              {selectedNodeProperties.map((entry) => (
                <div key={`${selectedNode.id}-${entry.key}`} className="ide-kv-row">
                  <span>{entry.key}</span>
                  <code>{entry.value}</code>
                </div>
              ))}
            </div>
          </div>
          <div className="ide-design-selection-warnings" data-testid="ide-design-selection-warnings">
            <span className="ide-design-inspector-group-label">Node diagnostics</span>
            {selectedNodeDiagnostics.length > 0 ? (
              <ul className="ide-design-selection-warning-list">
                {selectedNodeDiagnostics.map((diagnostic) => (
                  <li
                    key={`${selectedNode.id}-${diagnostic.code}-${diagnostic.message}`}
                    className={`ide-design-selection-warning-item ${
                      diagnostic.severity === 'error' ? 'is-error' : 'is-warning'
                    }`}
                  >
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ide-copy">No compiler diagnostics are attached to this node.</p>
            )}
          </div>
          <div data-testid="ide-design-net-pins">
            <span className="ide-design-inspector-group-label">Net / Pins</span>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Selected</span>
                <code>{selectedNode.id}</code>
              </div>
              <div className="ide-kv-row">
                <span>Pin count</span>
                <span>{selectedNodePins.length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Connected wires</span>
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
          </div>
          <div>
            <span className="ide-design-inspector-group-label">Evaluation order</span>
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
            {showEvalOrder && selectedNodeEvalStats ? (
              <div className="ide-kv-list ide-copy-top-gap">
                {selectedNodeEvalStats.step != null ? (
                  <div className="ide-kv-row">
                    <span>Eval step</span>
                    <span data-testid="ide-design-eval-step">#{selectedNodeEvalStats.step}</span>
                  </div>
                ) : null}
                <div className="ide-kv-row">
                  <span>Signal depth</span>
                  <span data-testid="ide-design-signal-depth">{selectedNodeEvalStats.depth}</span>
                </div>
                <div className="ide-kv-row">
                  <span>Outgoing connections</span>
                  <span data-testid="ide-design-fanout">{selectedNodeEvalStats.fanout}</span>
                </div>
              </div>
            ) : showEvalOrder ? (
              <p className="ide-copy ide-copy-top-gap">Select a node to see its evaluation order stats.</p>
            ) : null}
          </div>
        </>
      ) : null}
      {selectedWireIdsAll.length > 0 ? (
        <div className="ide-copy-top-gap">
          <strong>Selected wires:</strong> {selectedWireIdsAll.length}
        </div>
      ) : null}
      <details
        className="ide-design-inspector-workspace-debug"
        data-testid="ide-design-inspector-workspace-debug"
      >
        <summary className="ide-design-inspector-debug-summary">Workspace details</summary>
        <div className="ide-kv-list">
          <div className="ide-kv-row">
            <span>Nodes / Wires</span>
            <span>{circuit.nodes.length} / {circuit.connections.length}</span>
          </div>
          <div className="ide-kv-row">
            <span>Tool</span>
            <span>{activeModeLabel}</span>
          </div>
          <div className="ide-kv-row">
            <span>Snap</span>
            <span>{snapToGrid ? 'On' : 'Off'}</span>
          </div>
          <div className="ide-kv-row">
            <span>Interaction</span>
            <span data-testid="ide-design-interaction-indicator">{interactionLabel}</span>
          </div>
          <div className="ide-kv-row">
            <span>Zoom</span>
            <span data-testid="ide-design-zoom-indicator">{zoomPercent}%</span>
          </div>
          <div className="ide-kv-row">
            <span>View</span>
            <span>{effectiveDesignView === 'stacked' ? 'Split stacked' : effectiveDesignView}</span>
          </div>
        </div>
      </details>
    </div>
  );
  return (
    <>
      <IdeSurfaceLayout
        mode="design"
        layoutIntent="workbench"
        consoleHasBlocking={compilerErrorCount > 0}
        consoleHasEntries={diagnosticsDrawerRows.length > 0}
        leftDockMode={workspacePreset.leftDockMode}
        rightDockMode={designRightDockMode}
        rightDockCanCollapse={false}
        rightDockRevealKey={designRightDockRevealKey}
        consoleMode={designConsoleMode}
        shellDensity={workspacePreset.shellDensity}
        surfaceFrame={workspacePreset.surfaceFrame}
        productSpine={{
          statusLabel: authoringStatusLabel,
          statusTone: designCommandTone,
          detail: designCommandDescription,
          primaryLabel: activeVerifySignal || effectiveExternalDebugTick != null
            ? 'Return to Verify waveform'
            : 'Open Verify',
          onPrimary: onGoToVerify,
          recoveryLabel: onGoToProject ? 'Project' : undefined,
          onRecovery: onGoToProject,
          doneLabel: editorCircuit.nodes.length > 0
            ? `${editorCircuit.nodes.length} part${editorCircuit.nodes.length === 1 ? '' : 's'} on the canvas; verify when the graph matches the assignment.`
            : PROFESSIONAL_CLASSROOM_COPY.designBlankAction,
          blockedLabel: showBlankStateCard
            ? 'Canvas is empty.'
            : totalAuthoringErrors > 0
              ? `${totalAuthoringErrors} blocking circuit issue${totalAuthoringErrors === 1 ? '' : 's'}.`
              : totalAuthoringWarnings > 0
                ? `${totalAuthoringWarnings} circuit warning${totalAuthoringWarnings === 1 ? '' : 's'} to review.`
                : dirtySinceVerify
                  ? 'Verify evidence is stale after design edits.'
                  : 'No design blocker visible.',
        }}
        dock={
        <>
          <SurfacePanel className="ide-design-palette" testId="ide-design-dock-palette">
            <header className="ide-design-subheader ide-design-palette-header">
              <div>
                <h3>Build Library</h3>
              </div>
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
              {paletteHasQuery && (
                <p className="ide-design-palette-results" data-testid="ide-design-palette-results">
                  {hasPaletteResults
                    ? `${filteredPaletteByCategory.logic.length + filteredPaletteByCategory.sequential.length + filteredPaletteByCategory.io.length + filteredPaletteByCategory.components.length} results`
                    : `No results for "${paletteQuery.trim()}".`}
                </p>
              )}
            </div>

            <div className="ide-design-palette-sections">
              {/* Board Resources — first: primary destination for board-aware work */}
              {filteredBoardGroups.length > 0 ? (
                <section
                  className="ide-palette-section ide-palette-section--board"
                  data-testid="ide-design-palette-section-board"
                  data-collapsed={isBoardSectionCollapsed ? 'true' : 'false'}
                >
                  <header className="ide-palette-section-header">
                    <div className="ide-palette-section-title-row">
                      <h4>{boardPaletteSection.title}</h4>
                    </div>
                    <div className="ide-palette-section-meta">
                      <span className="ide-palette-section-count">{boardResourcesCount}</span>
                      <button
                        type="button"
                        className="ide-palette-section-toggle"
                        data-testid="ide-design-palette-toggle-board"
                        aria-expanded={isBoardSectionCollapsed ? 'false' : 'true'}
                        onClick={() => toggleDockSection('board')}
                      >
                        {isBoardSectionCollapsed ? 'Show' : 'Hide'}
                      </button>
                    </div>
                  </header>
                  {!isBoardSectionCollapsed ? (
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
                                      : `${entry.alias}${getBasys3BoardResource(entry.alias)?.packagePin ? ` · ${getBasys3BoardResource(entry.alias)?.packagePin}` : ''} - ${describeBoardEntry(entry)}`
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
                  ) : null}
                </section>
              ) : null}

              {/* Inputs & Outputs — second: generic pins for abstract designs */}
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

              {/* Logic Gates */}
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

              {/* Sequential & Timing */}
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
                  {SEQUENTIAL_PALETTE_SUBSECTIONS.map((subsection) => {
                    const items = filteredPaletteByCategory[subsection.key];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={subsection.key} className="ide-palette-subsection" data-testid={subsection.testId}>
                        <div className="ide-palette-subsection-header">
                          <div>
                            <h5>{subsection.title}</h5>
                            <p>{subsection.description}</p>
                          </div>
                          <span className="ide-palette-subsection-count">{items.length}</span>
                        </div>
                        <div className="ide-palette-card-list">
                          {items.map((item) => renderNodePaletteCard(item))}
                        </div>
                      </div>
                    );
                  })}
                  <p className="ide-palette-section-hint" data-testid="ide-design-palette-sequential-workflow-hint">
                    Tip: after choosing a register, hold Shift while clicking the canvas to place another of the same
                    type — useful for counters and multi-bit state.
                  </p>
                </section>
              ) : null}

              {/* Reusable Blocks — macros, custom parts, built-in helpers */}
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
                          renderNodePaletteCard(item, { badge: item.paletteBadge ?? 'Built-in' })
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
              <header className="ide-design-subheader ide-design-input-panel-header">
                <div className="ide-design-input-panel-title-row">
                  <h3>Quick Inputs</h3>
                  <span className="ide-palette-section-count">{allLiveInputRows.length}</span>
                </div>
                <button
                  type="button"
                  className="ide-palette-section-toggle"
                  data-testid="ide-design-live-inputs-toggle"
                  aria-expanded={isLiveInputsSectionCollapsed ? 'false' : 'true'}
                  onClick={() => toggleDockSection('live-inputs')}
                >
                  {isLiveInputsSectionCollapsed ? 'Show' : 'Hide'}
                </button>
              </header>
              {!isLiveInputsSectionCollapsed ? (
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
              ) : null}
            </SurfacePanel>
          )}
        </>
      }
      inspector={
        <>
          {focusedAssetContext && (
            <DesignFocusInspector
              context={focusedAssetContext}
              macro={focusedMacroDefinition}
              componentDef={focusedComponentDef}
              instanceCount={focusedComponentInstanceCount}
            />
          )}
          {renderSelectionIdentityCard()}
          {(() => {
            const content = renderSelectionActions();
            return content ? (
              <IdeInspectorSection title="Actions" testId="ide-design-inspector-actions" collapsible={false}>
                {content}
              </IdeInspectorSection>
            ) : null;
          })()}
          {hasInspectorSelectionContext ? (
            <React.Fragment key="design-inspector-selection-context">
              <IdeInspectorSection title="Live / Signal State" testId="ide-design-context-inspector" collapsible={false}>
                {renderSelectionState()}
                {selectedSignalKey ? (
                  <div className="ide-inline-actions ide-copy-top-gap">
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
                ) : null}
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
              <IdeInspectorSection
                title="Details"
                testId="ide-design-inspector-details"
                defaultOpen={false}
                hierarchySurface="design"
                hierarchyRole="advanced"
              >
                {renderAdvancedDetails()}
              </IdeInspectorSection>
            </React.Fragment>
          ) : (
            <React.Fragment key="design-inspector-idle-context">
              {(() => {
                const totalErrors = authoringIssueCounts.errorCount + compilerErrorCount;
                const totalWarnings = authoringIssueCounts.warningCount + compilerWarningCount;
                const inputCountIdle = circuit.nodes.filter(
                  (n) => n.type === 'INPUT' || n.type === 'Switch'
                ).length;
                const outputCountIdle = circuit.nodes.filter(
                  (n) => n.type === 'OUTPUT' || n.type === 'Lamp'
                ).length;
                const nodeCountIdle = circuit.nodes.length;
                const connectionCountIdle = circuit.connections.length;
                const isEmptyCanvas = nodeCountIdle === 0;
                const idleInputRows = liveIoSignals.inputRows;
                const idleOutputRows = liveIoSignals.outputRows;
                const hasIdleIoState = idleInputRows.length > 0 || idleOutputRows.length > 0;
                return (
                  <div
                    className="ide-design-inspector-canvas-default"
                    data-testid="ide-design-inspector-canvas-default"
                  >
                    <div
                      className="ide-design-inspector-idle-card"
                      data-testid="ide-design-inspector-idle-card"
                    >
                      <span className="ide-design-inspector-idle-eyebrow">
                        Design overview
                      </span>
                      {isEmptyCanvas ? (
                        <p className="ide-copy ide-design-inspector-idle-empty-line">
                          Empty canvas. Drop a gate, an input, or load an example to begin.
                        </p>
                      ) : (
                        <dl
                          className="ide-design-inspector-idle-stats"
                          data-testid="ide-design-inspector-idle-stats"
                        >
                          <div className="ide-design-inspector-idle-stat">
                            <dt>Inputs</dt>
                            <dd data-testid="ide-design-inspector-idle-inputs">
                              {inputCountIdle}
                            </dd>
                          </div>
                          <div className="ide-design-inspector-idle-stat">
                            <dt>Outputs</dt>
                            <dd data-testid="ide-design-inspector-idle-outputs">
                              {outputCountIdle}
                            </dd>
                          </div>
                          <div className="ide-design-inspector-idle-stat">
                            <dt>Nodes</dt>
                            <dd data-testid="ide-design-inspector-idle-nodes">
                              {nodeCountIdle}
                            </dd>
                          </div>
                          <div className="ide-design-inspector-idle-stat">
                            <dt>Wires</dt>
                            <dd data-testid="ide-design-inspector-idle-wires">
                              {connectionCountIdle}
                            </dd>
                          </div>
                        </dl>
                      )}
                      {hasIdleIoState ? (
                        <div
                          className="ide-design-inspector-io-state"
                          data-testid="ide-design-inspector-io-state"
                        >
                          <div className="ide-design-inspector-io-state-header">
                            <span>Current I/O</span>
                            <span className="ide-design-inspector-io-state-kicker">Design state</span>
                          </div>
                          <div className="ide-design-inspector-io-state-list">
                            {[...idleInputRows, ...idleOutputRows].map((row) => (
                              <div
                                key={`${row.kind}-${row.id}`}
                                className={`ide-design-inspector-io-state-row is-${row.kind}`}
                                data-testid={`ide-design-inspector-${row.kind}-${row.id}`}
                              >
                                <span className="ide-design-inspector-io-state-label">
                                  <strong>{row.label}</strong>
                                  <span>{row.kind === 'input' ? 'input' : 'output'}</span>
                                  {row.pinAlias ? <code>{row.pinAlias}</code> : null}
                                </span>
                                <code
                                  className="ide-design-inspector-io-state-value"
                                  data-testid={`ide-design-inspector-${row.kind}-${row.id}-value`}
                                >
                                  {row.value}
                                </code>
                              </div>
                            ))}
                          </div>
                          <p
                            className="ide-copy ide-design-inspector-proof-boundary"
                            data-testid="ide-design-inspector-proof-boundary"
                          >
                            This is live design state only. Verify owns behavior proof before trust or export.
                          </p>
                        </div>
                      ) : null}
                      {totalErrors > 0 || totalWarnings > 0 ? (
                        <p
                          className="ide-copy ide-design-inspector-idle-issues"
                          data-testid="ide-design-inspector-idle-issues"
                        >
                          {totalErrors > 0
                            ? `${totalErrors} error${totalErrors !== 1 ? 's' : ''}`
                            : null}
                          {totalErrors > 0 && totalWarnings > 0 ? ', ' : null}
                          {totalWarnings > 0
                            ? `${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`
                            : null}
                          {' '}waiting in build status. Select a part or jump from the top status deck to resolve them.
                        </p>
                      ) : !isEmptyCanvas ? (
                        <p className="ide-copy ide-design-inspector-idle-tip">
                          Select a part, a wire, or a Verify-linked signal to open actions and live state.
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          )}

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
        <DesignWorkspaceFrame view={effectiveDesignView}>
          <div className="ide-surface-command-stack">

            {/* ── Compact primary toolbar ── */}
          <div
            className={`ide-design-control-bar${isCanvasWorkspace ? ' is-canvas' : isSplitWorkspace ? ' is-split' : ' is-code'}${
              showWorkspaceStatusBar ? ' has-status' : ''
            }`}
            data-testid="ide-design-control-bar"
            data-hierarchy-surface="design"
            data-hierarchy-role="context"
          >
            <div
              className="ide-design-workspace-header"
              data-testid="ide-design-workspace-header"
              title={designCommandDescription}
            >
              <div className="ide-design-workspace-heading" data-testid="ide-design-workspace-heading">
                <span className="ide-design-workspace-label">Design</span>
                <div className="ide-design-workspace-heading-main">
                  <span className="ide-design-workspace-title" data-testid="ide-design-workspace-title">
                    {designCommandTitle}
                  </span>
                  {designCommandMeta}
                  <p className="ide-design-logical-io-note" data-testid="ide-design-logical-io-explainer">
                    {SIGNAL_LANGUAGE.designLogicalIo} Labels name RedByte signals; Map Pins binds them to board resources and package pins.
                  </p>
                </div>
              </div>
              <div className="ide-inline-actions ide-design-workspace-actions" data-testid="ide-design-workspace-actions">
                {onGoToVerify ? (
                  <IdeButton
                    tone="secondary"
                    onClick={onGoToVerify}
                    testId="ide-design-command-strip-primary-cta"
                    hierarchySurface="design"
                    hierarchyRole="next"
                  >
                    {activeVerifySignal || effectiveExternalDebugTick != null
                      ? 'Return to Verify waveform'
                      : 'Open Verify'}
                  </IdeButton>
                ) : null}
                {onGoToProject ? (
                  <IdeButton
                    tone="secondary"
                    onClick={onGoToProject}
                    testId="ide-design-command-strip-secondary-cta"
                  >
                    Project
                  </IdeButton>
                ) : null}
              </div>
            </div>
            {guidedLabTask && guidedLabDesignChecklist ? (
              <section className="ide-guided-lab-card" data-testid="ide-design-guided-full-adder-checklist">
                <div>
                  <p className="ide-surface-block-label">Active lab</p>
                  <h3>{guidedLabTask.shortTitle}</h3>
                  <p>{guidedLabTask.buildGoal}</p>
                  <div className="ide-guided-lab-checklist">
                    {guidedLabDesignChecklist.items.map((item) => (
                      <span
                        key={item.id}
                        className={`ide-guided-lab-check ${item.complete ? 'is-complete' : 'is-missing'}`}
                        data-testid={`ide-design-guided-full-adder-item-${item.id}`}
                      >
                        <strong>{item.complete ? 'OK' : 'TODO'}</strong>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ide-guided-lab-actions">
                  {guidedLabDesignChecklist.missingInputs.map((label) => (
                    <IdeButton
                      key={label}
                      tone="secondary"
                      onClick={() => onAddGuidedLabInput?.(label)}
                      testId={`ide-design-guided-full-adder-add-input-${label.toLowerCase()}`}
                    >
                      Add {label}
                    </IdeButton>
                  ))}
                  {guidedLabDesignChecklist.missingOutputs.map((label) => (
                    <IdeButton
                      key={label}
                      tone="secondary"
                      onClick={() => onAddGuidedLabOutput?.(label)}
                      testId={`ide-design-guided-full-adder-add-output-${label.toLowerCase()}`}
                    >
                      Add {label}
                    </IdeButton>
                  ))}
                  {!guidedLabDesignChecklist.hasFullAdderBlock ? (
                    <IdeButton
                      tone="secondary"
                      onClick={onAddGuidedLabFullAdder}
                      testId="ide-design-guided-full-adder-add-block"
                    >
                      Add FullAdder
                    </IdeButton>
                  ) : null}
                  <IdeButton tone="ghost" onClick={() => setPaletteQuery('full adder')} testId="ide-design-guided-full-adder-open-library">
                    Open Library
                  </IdeButton>
                  {onGoToVerify ? (
                    <IdeButton tone="secondary" onClick={onGoToVerify} testId="ide-design-guided-full-adder-open-verify">
                      Open Verify
                    </IdeButton>
                  ) : null}
                </div>
              </section>
            ) : null}
            <div className="ide-design-toolbar" data-testid="ide-design-toolbar">
              {/* Groups 1+2: Canvas tools — only visible when canvas is in the view */}
              {isCodeWorkspace ? (
                <div className="ide-toolbar-group is-code-context" data-testid="ide-design-code-context">
                  <span className="ide-design-code-context-label">Code focus</span>
                  <span className="ide-design-code-context-desc" data-testid="ide-design-code-context-primary-artifact">
                    Viewing {primaryArtifactFileName} ({primaryArtifactLabel}) as the primary artifact.
                    Switch artifacts and open the secondary drawer from the code pane header.
                  </span>
                </div>
              ) : showSplitCompareToolbar ? (
                <div className="ide-toolbar-group is-split-context" data-testid="ide-design-split-context">
                  <span className="ide-design-code-context-label">Comparison</span>
                  <span className="ide-design-code-context-desc" data-testid="ide-design-split-context-summary">
                    Stage the circuit against {primaryArtifactLabel} with minimal build chrome and keep code slightly favored.
                  </span>
                  <div className="ide-inline-actions ide-design-split-compare-tools" data-testid="ide-design-split-compare-tools">
                    <IdeButton tone="ghost" onClick={() => fitToCircuit()} testId="ide-design-fit-circuit-split">
                      Fit Circuit
                    </IdeButton>
                    <IdeButton
                      tone="ghost"
                      onClick={centerSelection}
                      disabled={selection.nodes.size === 0}
                      testId="ide-design-center-selection-split"
                    >
                      Center Selection
                    </IdeButton>
                  </div>
                </div>
              ) : workspacePreset.showCanvasTools ? (
                <>
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
                    <IdeButton tone="ghost" onClick={() => fitToCircuit()} testId="ide-design-fit-circuit-primary">
                      Fit
                    </IdeButton>
                    <IdeButton tone="danger" onClick={deleteSelection} disabled={!hasSelection} testId="ide-design-tool-delete">
                      Delete
                    </IdeButton>
                  </div>
                </>
              ) : null}

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
                      {v === 'canvas' ? 'Canvas' : v === 'hdl' ? 'Code' : 'Split'}
                    </button>
                  ))}
                </div>
                {!showSplitCompareToolbar ? (
                  <button
                    type="button"
                    className="ide-toolbar-toggle"
                    aria-expanded={toolsExpanded}
                    onClick={() => setToolsExpanded((v) => !v)}
                    data-testid="ide-design-tools-toggle"
                  >
                    {toolsExpanded ? 'Hide tools ▲' : 'Tools ▼'}
                  </button>
                ) : null}
              </div>
            </div>

            {/* ── Expanded secondary toolbar ── */}
            {toolsExpanded && !showSplitCompareToolbar && (
              <div className="ide-design-toolbarExpanded" data-testid="ide-design-toolbar-expanded">
                <span className="ide-design-depth-pill" data-testid="ide-design-undo-depth">
                  Undo {undoDepth}
                </span>
                <span className="ide-design-depth-pill" data-testid="ide-design-redo-depth">
                  Redo {redoDepth}
                </span>
                <IdeButton tone="ghost" onClick={zoomOut} testId="ide-design-zoom-out">-</IdeButton>
                <IdeButton tone="ghost" onClick={zoomIn} testId="ide-design-zoom-in">+</IdeButton>
                <IdeButton tone="ghost" onClick={() => fitToCircuit()} testId="ide-design-fit-circuit">Zoom to Fit</IdeButton>
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
                    {showDetails ? 'Hide details' : 'Show details'}
                </IdeButton>
              </div>
            )}

            {/* ── Stacked-view notice — shown only when split auto-collapsed to column ── */}
            {starterContext ? (
              <section className="ide-design-starter-banner" data-testid="ide-design-starter-banner">
                <div className="ide-design-starter-banner-main">
                  <div className="ide-design-starter-banner-head">
                    <span className="ide-design-starter-banner-eyebrow">Starter loaded</span>
                    <div className="ide-design-starter-banner-tags">
                      {starterContext.lab ? (
                        <span className="ide-design-starter-banner-tag" data-testid="ide-design-starter-banner-lab">
                          {starterContext.lab}
                        </span>
                      ) : null}
                      {starterContext.concept ? (
                        <span className="ide-design-starter-banner-tag">{starterContext.concept}</span>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="ide-design-starter-banner-title" data-testid="ide-design-starter-banner-title">
                    {starterContext.name}
                  </h3>
                  {starterContext.summary || starterContext.expectedBehavior ? (
                    <details
                      className="ide-design-starter-details"
                      data-testid="ide-design-starter-details"
                      data-hierarchy-surface="design"
                      data-hierarchy-role="advanced"
                    >
                      <summary data-testid="ide-design-starter-details-summary">Starter brief</summary>
                      <div className="ide-design-starter-details-body" data-testid="ide-design-starter-details-body">
                        {starterContext.summary ? (
                          <p className="ide-design-starter-banner-summary">{starterContext.summary}</p>
                        ) : null}
                        {starterContext.expectedBehavior ? (
                          <p className="ide-design-starter-banner-expected">
                            <strong>Expected behavior:</strong> {starterContext.expectedBehavior}
                          </p>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </div>
                <div className="ide-design-starter-banner-next">
                  <span className="ide-design-starter-banner-next-label">Next</span>
                  <p
                    className="ide-design-starter-banner-next-copy"
                    data-testid="ide-design-starter-banner-next-action"
                  >
                    {starterNextAction}
                  </p>
                  <div className="ide-design-starter-banner-actions">
                    {onGoToVerify ? (
                      <IdeButton tone="ghost" onClick={onGoToVerify} testId="ide-design-starter-go-to-verify">
                        Open Verify
                      </IdeButton>
                    ) : null}
                    {onGoToProject ? (
                      <IdeButton tone="ghost" onClick={onGoToProject} testId="ide-design-starter-back-to-project">
                        Back to Project
                      </IdeButton>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {showWorkspaceStatusBar ? (
              <div className="ide-design-workspace-status-bar" data-testid="ide-design-workspace-status-bar">
                <div
                  className={`ide-design-workspace-health ${authoringStatusToneClass}`}
                  data-testid="ide-design-authoring-issues"
                >
                  <div className="ide-design-workspace-health-main">
                    <div className="ide-design-workspace-health-row">
                      <span className="ide-design-workspace-health-label">Circuit health</span>
                      <span
                        className="ide-design-workspace-health-count is-error"
                        data-testid="ide-design-authoring-issues-errors"
                      >
                        {authoringIssueCounts.errorCount} errors
                      </span>
                      <span
                        className="ide-design-workspace-health-count is-warn"
                        data-testid="ide-design-authoring-issues-warnings"
                      >
                        {authoringIssueCounts.warningCount} warnings
                      </span>
                      <span
                        className="ide-design-workspace-health-count is-warn"
                        data-testid="ide-design-authoring-issues-drafts"
                        hidden={authoringIssueCounts.draftCount === 0}
                      >
                        {authoringIssueCounts.draftCount} drafts
                      </span>
                      <span className="ide-design-workspace-health-status">
                        {authoringStatusLabel}
                      </span>
                    </div>
                    {traceState ? (
                      <div className="ide-design-workspace-health-meta">
                        <span className="ide-design-canvas-titlebar-stat is-trace" data-testid="ide-design-active-trace">
                          {traceState.label}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {designStatusNote ? (
                    <p className="ide-design-workspace-status-note" data-testid="ide-design-authoring-issue-0">
                      {designStatusNote}
                    </p>
                  ) : null}
                </div>

                {showRuntimeStatus ? (
                  <div
                    className={`ide-design-sim-story-strip ide-design-workspace-runtime${canRenderReplayScrubber ? ' has-replay-scrubber' : ''}${isReplayMode ? ' is-replay-mode' : ''}`}
                    data-testid="ide-design-sim-story-strip"
                  >
                    <div className="ide-design-sim-story-topline">
                      <div className="ide-design-sim-story-main">
                        <span className="ide-design-sim-story-label" data-testid="ide-design-runtime-label">{workspaceRuntimeLabel}</span>
                        <span className="ide-design-sim-story-pill" data-testid="ide-design-sim-story-tick">
                          {runtimePrimaryPill}
                        </span>
                        <span
                          className="ide-design-sim-story-pill"
                          data-testid="ide-design-sim-story-mode"
                        >
                          {runtimeSecondaryPill}
                        </span>
                        {isReplayMode && activeReplayTimingHint ? (
                          <span className="ide-design-sim-story-pill ide-design-sim-story-pill--timing" data-testid="ide-design-sim-story-sample">
                            {activeReplayTimingHint}
                          </span>
                        ) : null}
                        {isSplitWorkspace && !showSimulationStrip ? (
                          <>
                            <span className="ide-design-sim-story-pill" data-testid="ide-design-split-stat-tick">Tick {simTick}</span>
                            <span className="ide-design-sim-story-pill" data-testid="ide-design-split-stat-mode">
                              {simModeLabel}
                            </span>
                          </>
                        ) : null}
                        {activeVerifySignal ? (
                          <>
                            <span className="ide-design-verify-link-badge" data-testid="ide-design-verify-link-badge">
                              Verify focus {activeVerifySignalPresentation?.focusLabel ?? activeVerifySignal}
                            </span>
                            <span className="ide-design-verify-focus-hint" data-testid="ide-design-verify-focus">
                              Inspect{' '}
                              {activeVerifySignalPresentation?.inspectLabel ??
                                activeVerifySignalPresentation?.focusLabel ??
                                activeVerifySignal}{' '}
                              first
                            </span>
                            <span className="ide-design-sim-story-pill" data-testid="ide-design-split-stat-verify">
                              Verify {activeVerifySignalPresentation?.focusLabel ?? activeVerifySignal}
                            </span>
                          </>
                        ) : null}
                      </div>
                      {simulationStory.clockEvent ? (
                        <div className="ide-design-sim-story-context" data-testid="ide-design-sim-story-context">
                          <span data-testid="ide-design-sim-story-clock">
                            {simulationStory.clockLabel} {simulationStory.clockEvent} edge
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {activeSimulationSummary && (showSimulationSummary || traceState || (isSplitWorkspace && !showSimulationStrip)) ? (
                      <p className="ide-design-sim-story-summary" data-testid="ide-design-sim-story-summary">
                        {activeSimulationSummary}
                      </p>
                    ) : null}
                    {canRenderReplayScrubber && (
                      <div className="ide-design-replay-transport" data-testid="ide-design-replay-transport">
                        <div className="ide-design-debug-nav" data-testid="ide-design-debug-nav">
                          {onPrevDebugTick ? (
                            <IdeButton
                              tone="ghost"
                              onClick={onPrevDebugTick}
                              disabled={debugTickIndex === 0 || debugTickIndex == null}
                              testId="ide-design-debug-prev"
                            >
                              Prev
                            </IdeButton>
                          ) : null}
                          {canRenderReplayScrubber ? (
                            <div className="ide-design-replay-scrubber-track">
                              <input
                                type="range"
                                min={0}
                                max={Math.max(debugTickCount - 1, 0)}
                                step={1}
                                value={debugTickIndex}
                                onChange={handleReplayScrubberChange}
                                className="ide-design-replay-scrubber"
                                data-testid="ide-design-replay-scrubber"
                                aria-label="Replay scrubber"
                              />
                            </div>
                          ) : null}
                          {onNextDebugTick ? (
                            <IdeButton
                              tone="ghost"
                              onClick={onNextDebugTick}
                              disabled={debugTickIndex == null || debugTickCount == null || debugTickIndex >= debugTickCount - 1}
                              testId="ide-design-debug-next"
                            >
                              Next
                            </IdeButton>
                          ) : null}
                          {debugTickIndex != null && debugTickCount != null ? (
                            <span
                              className="ide-design-replay-scrubber-readout"
                              data-testid="ide-design-replay-scrubber-readout"
                            >
                              {`${debugTickIndex + 1} / ${debugTickCount}`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="ide-design-workspace-status-actions" data-testid="ide-design-workspace-status-actions">
                  {topAuthoringIssue ? (
                    <IdeButton
                      tone={topAuthoringIssue.blocking ? 'secondary' : 'ghost'}
                      onClick={() => focusDesignIssue(topAuthoringIssue)}
                      testId="ide-design-authoring-issue-focus-0"
                    >
                      Review issue
                    </IdeButton>
                  ) : null}
                  {traceState ? (
                    <IdeButton
                      tone="ghost"
                      onClick={clearTrace}
                      testId="ide-design-workspace-clear-trace"
                    >
                      Clear trace
                    </IdeButton>
                  ) : null}
                  {workspacePreset.showCanvasTools ? (
                    <IdeButton
                      tone="ghost"
                      onClick={addIoPins}
                      testId="ide-design-status-add-io"
                    >
                      Add boundary I/O
                    </IdeButton>
                  ) : null}
                  {workspacePreset.showCanvasTools && !showBlankStateCard ? (
                    <IdeButton
                      tone={showPartialBlankAuthoring ? 'secondary' : 'ghost'}
                      onClick={addAndGateOnly}
                      testId="ide-design-status-add-and"
                    >
                      Add AND
                    </IdeButton>
                  ) : null}
                  {onGoToProject ? (
                    <IdeButton
                      tone="ghost"
                      onClick={onGoToProject}
                      testId="ide-design-status-examples"
                    >
                      Examples
                    </IdeButton>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          </div>
            {effectiveDesignView === 'stacked' && (
              <div className="ide-design-stacked-notice" data-testid="ide-design-stacked-notice">
                <span className="ide-design-stacked-notice-icon" aria-hidden="true">||</span>
                <span>
                  Side-by-side split is stacked because the window is too narrow.
                  Widen the window to restore split layout.
                </span>
              </div>
            )}

            {/* ── Content Pane Row — owns height below toolbar — switches between column/row ── */}
            <div
              ref={paneRowRef}
              className="ide-design-pane-row"
              data-design-view={effectiveDesignView}
              data-testid="ide-design-pane-row"
            >
              {workspacePreset.showCanvasPane ? (
                <div
                  className="ide-design-pane ide-design-pane--canvas"
                  style={effectiveDesignView === 'split' ? { flex: `0 0 ${splitRatio * 100}%` } : undefined}
                >

            <div
              ref={canvasViewportRef}
              className="ide-design-canvasWrap"
              data-testid="ide-design-canvas-wrap"
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
                <section
                  className="ide-design-canvas"
                  data-testid="ide-design-canvas"
                  data-hierarchy-surface="design"
                  data-hierarchy-role="primary"
                  data-hierarchy-focal="circuit-canvas"
                >
                  <div
                    className={`ide-design-tool-hud${isPlacementMode ? ' is-placement-mode' : ''}`}
                    data-testid="ide-design-tool-hud"
                    data-blocks-canvas-placement="1"
                  >
                    <span className="ide-design-tool-hud-label">{activeModeLabel}</span>
                    <span className="ide-design-tool-hud-hint">{toolHint}</span>
                    {toolMode === 'wire' && !isPlacementMode ? (
                      <div
                        className="ide-design-tool-hud-wire"
                        data-testid="ide-design-wire-cue"
                        data-wire-source-label={wireSourceLabel ?? ''}
                        data-wire-active={wireStartPort ? '1' : '0'}
                      >
                        <span>{wireCueText}</span>
                        {wireStartPort ? (
                          <button
                            type="button"
                            className="ide-design-tool-hud-action"
                            onClick={cancelActiveWire}
                            data-testid="ide-design-wire-cancel"
                          >
                            Cancel wire
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {wireFeedback ? (
                      <div className="ide-design-tool-hud-feedback is-error" data-testid="ide-design-wire-feedback">
                        {wireFeedback}
                      </div>
                    ) : null}
                  </div>
                  {focusedAssetContext && (
                    <DesignFocusBanner
                      context={focusedAssetContext}
                      isPlacementArmed={
                        focusedAssetContext.kind === 'macro' &&
                        activeMacroInsertionId === focusedAssetContext.macroId
                      }
                      onClear={handleClearFocusedAsset}
                      onBackToProject={onGoToProject}
                    />
                  )}
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
                  {activeDebugContext ? (
                    <div
                      className="ide-design-debug-context-banner"
                      data-testid="ide-design-debug-context-banner"
                      data-blocks-canvas-placement="1"
                      data-blocks-macro-placement="1"
                      role="status"
                    >
                      <div className="ide-design-debug-context-main">
                        <span className="ide-design-debug-context-eyebrow">Compare failed</span>
                        <strong>
                          Inspecting {getVerifyDebugDisplaySignal(activeDebugContext)}
                        </strong>
                        <span>
                          Expected <code>{activeDebugContext.expected}</code>, observed{' '}
                          <code>{activeDebugContext.actual}</code>
                          {activeDebugContext.caseIndex != null
                            ? ` on case ${activeDebugContext.caseIndex + 1}`
                            : ` at tick ${activeDebugContext.tick}`}
                          .
                        </span>
                        {activeDebugContext.inputSnapshot.length > 0 ? (
                          <span>
                            Inputs: <code>{formatVerifyDebugInputSnapshot(activeDebugContext.inputSnapshot)}</code>
                          </span>
                        ) : null}
                        <span>Check the gate or wire driving this output.</span>
                      </div>
                      <div className="ide-design-debug-context-facts">
                        <span data-testid="ide-design-debug-context-target">
                          Output <strong>{activeDebugRepairContext?.targetLabel ?? getVerifyDebugDisplaySignal(activeDebugContext)}</strong>
                        </span>
                        {activeDebugRepairContext?.driverLabel ? (
                          <>
                            <span data-testid="ide-design-debug-context-driver">
                              Driver <strong>{activeDebugRepairContext.driverLabel}</strong>
                            </span>
                            <span data-testid="ide-design-debug-context-driver-type">
                              Type <strong>{activeDebugRepairContext.driverType}</strong>
                            </span>
                            <span data-testid="ide-design-debug-context-wire-count">
                              Incoming wires <strong>{activeDebugRepairContext.incomingWires}</strong> / Outgoing wires{' '}
                              <strong>{activeDebugRepairContext.outgoingWires}</strong>
                            </span>
                          </>
                        ) : (
                          <span data-testid="ide-design-debug-context-driver">
                            No direct driver found for this output.
                          </span>
                        )}
                        {activeDebugRepairContext?.wireId ? (
                          <code data-testid="ide-design-debug-context-wire">{activeDebugRepairContext.wireId}</code>
                        ) : null}
                      </div>
                      {activeDebugSignalTrace ? (
                        <div className="ide-design-debug-trace-panel" data-testid="ide-design-debug-trace-panel">
                          <div className="ide-design-debug-trace-header">
                            <span className="ide-design-debug-context-eyebrow">Signal trace</span>
                            <strong>Follow the highlighted upstream path before changing expected values.</strong>
                            <span>
                              This is not automatic root-cause proof; it shows what feeds{' '}
                              <code>{activeDebugSignalTrace.targetLabel}</code> so the next gate or wire is inspectable.
                            </span>
                          </div>
                          <ol className="ide-design-debug-trace-list">
                            {activeDebugSignalTrace.nodes.map((traceNode) => (
                              <li
                                key={traceNode.nodeId}
                                className={`ide-design-debug-trace-row${
                                  traceNode.depth === 0 ? ' is-target' : ''
                                }${traceNode.openInputPorts.length > 0 ? ' has-open-inputs' : ''}`}
                                data-testid={`ide-design-debug-trace-node-${traceNode.nodeId}`}
                              >
                                <span className="ide-design-debug-trace-depth">
                                  {traceNode.depth === 0 ? 'failed output' : `upstream ${traceNode.depth}`}
                                </span>
                                <span className="ide-design-debug-trace-identity">
                                  <strong>{traceNode.label}</strong>
                                  <small>{traceNode.typeLabel}</small>
                                </span>
                                <span className="ide-design-debug-trace-feed">
                                  {traceNode.upstreamLabels.length > 0 ? (
                                    <>
                                      upstream:{' '}
                                      <code>{traceNode.upstreamLabels.join(', ')}</code>
                                    </>
                                  ) : (
                                    'source or un-driven endpoint'
                                  )}
                                </span>
                                {traceNode.openInputPorts.length > 0 ? (
                                  <span className="ide-design-debug-trace-open-inputs">
                                    open input: <code>{traceNode.openInputPorts.join(', ')}</code>
                                  </span>
                                ) : null}
                                <IdeButton
                                  tone="ghost"
                                  onClick={() => {
                                    setToolMode('select');
                                    selectMultipleNodes([traceNode.nodeId], false);
                                    focusNodeOnCanvas(traceNode.nodeId);
                                  }}
                                  testId={`ide-design-debug-trace-focus-${traceNode.nodeId}`}
                                >
                                  Focus
                                </IdeButton>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                      <div className="ide-design-debug-context-actions">
                        {onClearExternalDebug ? (
                          <IdeButton
                            tone="primary"
                            onClick={handleResumeLiveEditing}
                            testId="ide-design-debug-context-resume-editing"
                          >
                            Resume editing
                          </IdeButton>
                        ) : null}
                        {activeDebugRepairContext?.driverNodeId ? (
                          <IdeButton
                            tone="secondary"
                            onClick={() => {
                              setToolMode('select');
                              selectMultipleNodes([activeDebugRepairContext.driverNodeId!], false);
                              focusNodeOnCanvas(activeDebugRepairContext.driverNodeId!);
                            }}
                            testId="ide-design-debug-context-focus-driver"
                          >
                            Focus driver
                          </IdeButton>
                        ) : null}
                        {onGoToVerify ? (
                          <IdeButton
                            tone="secondary"
                            onClick={onGoToVerify}
                            testId="ide-design-debug-context-return"
                          >
                            Return to Verify
                          </IdeButton>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`ide-design-canvas-live ${toolMode === 'wire' ? 'is-wire-mode' : 'is-select-mode'} ${
                      presentationZoom === 'classroom' ? 'is-presentation-zoom' : ''
                    }`}
                    ref={canvasHostRef}
                    data-testid="ide-design-live-canvas"
                    data-tool-mode={toolMode}
                    data-interaction-mode={effectiveInteractionMode}
                    data-wire-active={wireStartPort ? '1' : '0'}
                    data-wire-source-label={wireSourceLabel ?? ''}
                    data-placement-active={isPlacementMode ? '1' : '0'}
                    data-presentation-zoom={presentationZoom}
                    data-macro-placement-active={activeInsertionMacro ? '1' : '0'}
                    onClick={handleCanvasPlacementClick}
                    onPointerMove={handleCanvasPlacementPointerMove}
                    onPointerLeave={() => {
                      if (pendingPlacement) {
                        setPlacementGhost(null);
                      }
                    }}
                  >
                    {toolMode !== 'select' || isPlacementMode ? (
                      <div
                        className="ide-design-canvas-mode-indicator"
                        data-testid="ide-design-canvas-mode-indicator"
                        data-blocks-canvas-placement="1"
                      >
                        {activeModeLabel}
                      </div>
                    ) : null}
                    <div
                      className={`ide-design-canvas-view-tools${
                        showSplitCompareToolbar || canvasViewToolsOpen ? ' is-open' : ' is-compact'
                      }${showSplitCompareToolbar ? ' is-split' : ''}`}
                      data-testid="ide-design-canvas-view-tools"
                      data-open={showSplitCompareToolbar || canvasViewToolsOpen ? 'true' : 'false'}
                      data-blocks-canvas-placement="1"
                      data-blocks-macro-placement="1"
                    >
                      <button
                        type="button"
                        className="ide-design-view-tools-toggle"
                        data-testid="ide-design-view-tools-toggle"
                        aria-expanded={showSplitCompareToolbar || canvasViewToolsOpen}
                        aria-label={
                          showSplitCompareToolbar || canvasViewToolsOpen
                            ? 'Hide canvas view tools'
                            : 'Show canvas view tools'
                        }
                        onClick={() => setCanvasViewToolsOpen((previous) => !previous)}
                      >
                        <span>View</span>
                        <strong>{zoomPercent}%</strong>
                      </button>
                      <div className="ide-design-canvas-view-meta">
                        <span
                          className="ide-design-canvas-zoom-indicator"
                          data-testid="ide-design-canvas-zoom-indicator"
                        >
                          <span data-testid="ide-design-canvas-stat-zoom">{zoomPercent}%</span> zoom
                        </span>
                        {showSplitCompareToolbar ? (
                          <span
                            className="ide-design-canvas-presentation-indicator"
                            data-testid="ide-design-split-canvas-indicator"
                          >
                            Circuit pane
                          </span>
                        ) : presentationZoom === 'classroom' ? (
                          <span
                            className="ide-design-canvas-presentation-indicator"
                            data-testid="ide-design-presentation-zoom-indicator"
                          >
                            Classroom
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="ide-design-canvas-controls"
                        data-testid="ide-design-canvas-controls"
                      >
                        <IdeButton tone="ghost" onClick={() => fitToCircuit()} testId="ide-design-fit-circuit-canvas">
                          Fit
                        </IdeButton>
                        {!showSplitCompareToolbar ? (
                          <>
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
                          </>
                        ) : null}
                      </div>
                      {!showSplitCompareToolbar ? (
                        <div
                          className="ide-design-zoom-presets"
                          data-testid="ide-design-zoom-presets"
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
                            onClick={() => fitToCircuit()}
                            data-testid="ide-design-zoom-preset-fit"
                          >
                            Fit
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {staleReplayBreadcrumb && (
                      <div
                        className="ide-design-debug-overlay-banner ide-design-debug-overlay-banner--stale"
                        data-testid="ide-design-replay-stale-banner"
                        data-blocks-canvas-placement="1"
                        data-blocks-macro-placement="1"
                        role="status"
                      >
                        <span aria-hidden="true">!</span>
                        <strong>Replay stale — {staleReplaySelectionLabel}</strong>
                        <span className="ide-design-debug-banner-hint">
                          The circuit changed after this Verify sample. The canvas is back on the live design.
                        </span>
                        {staleReplayBreadcrumb.signal && (
                          <span className="ide-design-debug-banner-hint">
                            Last focus: <code>{staleReplayBreadcrumb.signal}</code>
                          </span>
                        )}
                        {staleReplayBreadcrumb.timingHint && (
                          <span className="ide-design-debug-banner-hint">{staleReplayBreadcrumb.timingHint}</span>
                        )}
                        <IdeButton
                          tone="ghost"
                          onClick={() => setStaleReplayBreadcrumb(null)}
                          testId="ide-design-replay-stale-dismiss"
                        >
                          Dismiss
                        </IdeButton>
                      </div>
                    )}
                    {/* C-7: Debug overlay banner — shown when externally frozen at a verify tick */}
                    {effectiveExternalDebugTick != null && !canRenderReplayScrubber && (
                      <div
                        className="ide-design-debug-overlay-banner"
                        data-testid="ide-design-debug-banner"
                        data-blocks-canvas-placement="1"
                        data-blocks-macro-placement="1"
                        role="status"
                      >
                        <span aria-hidden="true">⏸</span>
                        <strong>Debug mode — {activeReplaySelectionLabel}</strong>
                        <span className="ide-design-debug-banner-hint">
                          Canvas frozen at verification {activeReplaySelectionLabel}.
                        </span>
                        {activeReplayTimingHint && (
                          <span className="ide-design-debug-banner-hint">{activeReplayTimingHint}</span>
                        )}
                        {!canRenderReplayScrubber && (onPrevDebugTick || onNextDebugTick) && (
                          <div className="ide-design-debug-nav" data-testid="ide-design-debug-nav">
                            {onPrevDebugTick ? (
                              <IdeButton
                                tone="ghost"
                                onClick={onPrevDebugTick}
                                disabled={debugTickIndex === 0 || debugTickIndex == null}
                                testId="ide-design-debug-prev"
                              >
                                ← Prev
                              </IdeButton>
                            ) : null}
                            {debugTickIndex != null && debugTickCount != null && (
                                        <span
                                          className="ide-design-replay-scrubber-readout"
                                          data-testid="ide-design-replay-scrubber-readout"
                                        >
                                          {`${debugTickIndex + 1} / ${debugTickCount}`}
                              </span>
                            )}
                            {onNextDebugTick ? (
                              <IdeButton
                                tone="ghost"
                                onClick={onNextDebugTick}
                                disabled={debugTickIndex == null || debugTickCount == null || debugTickIndex >= debugTickCount - 1}
                                testId="ide-design-debug-next"
                              >
                                Next →
                              </IdeButton>
                            ) : null}
                          </div>
                        )}
                        {activeDebugContext && (
                          <div className="ide-design-failure-brief" data-testid="ide-design-failure-brief">
                            <span className="ide-design-failure-brief-summary">
                              {formatVerifyMismatchBrief(activeDebugContext)}
                            </span>
                            {debugInputSummary && (
                              <span className="ide-design-failure-brief-inputs" data-testid="ide-design-failure-brief-inputs">
                                Inputs: {debugInputSummary}
                              </span>
                            )}
                            {activeDebugContext.patternSummary && (
                              <span className="ide-design-failure-brief-pattern" data-testid="ide-design-failure-brief-pattern">
                                Why it happened: {activeDebugContext.patternSummary}
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
                          <IdeButton tone="ghost" onClick={handleResumeLiveEditing} testId="ide-design-debug-clear">
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
                      showHud={false}
                      getChipMetadata={getChipMetadata}
                      onCircuitChange={handleCircuitChange}
                      onDeleteFeedback={setActionToast}
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
                      debugSignals={effectiveExternalDebugSignals ?? liveSignals}
                      debugTick={effectiveExternalDebugTick ?? simTick}
                      isReplayMode={isReplayMode ? true : undefined}
                      nodeDiagnosticBadges={nodeDiagnosticBadges}
                      onNodeDiagnosticBadgeClick={handleNodeDiagnosticBadgeClick}
                      ioPresentationMap={ioPresentationMap}
                      presentationZoomMode={presentationZoom}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      onPortClick={handlePortClick}
                      onConnectionRejected={(reason, context) => {
                        suppressNextToolModeWireFeedbackClearRef.current = false;
                        setWireFeedback(
                          context
                            ? describeWireRejectionForStudents(
                                editorCircuit,
                                reason,
                                context.from,
                                context.to,
                                getChipMetadata
                              )
                            : connectionRejectedMessage(reason)
                        );
                      }}
                      onNodeDoubleClick={(nodeId) => {
                        const node = editorCircuit.nodes.find((n) => n.id === nodeId);
                        if (node) beginNodeLabelEdit(node);
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
                    {pendingPlacement && !activeInsertionMacro ? (
                      <div
                        className="ide-design-placement-hit-layer"
                        data-testid="ide-design-placement-hit-layer"
                        onClick={handleCanvasPlacementClick}
                        onPointerMove={handleCanvasPlacementPointerMove}
                        onPointerLeave={() => setPlacementGhost(null)}
                      />
                    ) : null}
                    {pendingPlacement && placementGhost && !activeInsertionMacro ? (
                      <div
                        className="ide-design-placement-ghost"
                        data-testid="ide-design-placement-cue"
                        style={{
                          left: placementGhost.screenX,
                          top: placementGhost.screenY,
                        }}
                      >
                        <strong data-testid="ide-design-placement-label">{pendingPlacement.label}</strong>
                        <span>Shift keeps placing</span>
                        <span>Esc cancels</span>
                      </div>
                    ) : null}
                    {showBlankStateCard && (
                      <div className="ide-design-overlay-empty" data-testid="ide-design-empty-state">
                        <span className="ide-design-empty-eyebrow">Start on canvas</span>
                        <h3>{PROFESSIONAL_CLASSROOM_COPY.designBlankAction}</h3>
                        <p className="ide-design-empty-summary">
                          Use the library for gates and registers. {SIGNAL_LANGUAGE.designLogicalIo}
                        </p>
                        <p
                          className="ide-design-logical-io-note"
                          data-testid="ide-design-logical-io-explainer"
                        >
                          Labels name logical signals in RedByte. Mapping later binds those signals to a board resource and package pin.
                        </p>
                        <ol className="ide-design-empty-steps" data-testid="ide-design-empty-checklist">
                          <li>
                            <span>1. Add logical inputs and outputs</span>
                          </li>
                          <li>
                            <span>2. Place a gate or register</span>
                          </li>
                          <li>
                            <span>3. Wire source ports to destination ports</span>
                          </li>
                        </ol>
                        <div className="ide-design-empty-actions">
                          <IdeButton tone="secondary" onClick={addIoPins} testId="ide-design-empty-add-io">
                            Add boundary I/O
                          </IdeButton>
                          <IdeButton tone="ghost" onClick={addAndGateStarter} testId="ide-design-empty-add-and">
                            Drop starter gate
                          </IdeButton>
                          {onGoToProject && (
                            <IdeButton tone="ghost" onClick={onGoToProject} testId="ide-design-empty-go-to-project">
                              Examples
                            </IdeButton>
                          )}
                        </div>
                      </div>
                    )}
                    {showPartialBlankAuthoring ? (
                      <div
                        className="ide-design-authoring-quickstrip"
                        data-testid="ide-design-authoring-quickstrip"
                        data-blocks-canvas-placement="1"
                      >
                        <div className="ide-design-authoring-quickstrip-copy">
                          <span className="ide-design-authoring-quickstrip-label">Next on canvas</span>
                          <strong>Drop a gate, wire ports, then run Verify.</strong>
                          <p data-testid="ide-design-logical-io-explainer">
                            {SIGNAL_LANGUAGE.designLogicalIo}
                          </p>
                        </div>
                        <div className="ide-design-authoring-quickstrip-actions">
                          <IdeButton tone="secondary" onClick={addAndGateOnly} testId="ide-design-quick-add-and">
                            Add AND
                          </IdeButton>
                          <IdeButton tone="ghost" onClick={setWireMode} testId="ide-design-quick-wire">
                            Wire
                          </IdeButton>
                          {onGoToVerify ? (
                            <IdeButton tone="ghost" onClick={onGoToVerify} testId="ide-design-quick-open-verify">
                              Open Verify
                            </IdeButton>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
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
                  </div>
                </section>
              </div>
            </div>{/* close ide-design-canvasWrap */}
                </div>
              ) : null}

            {/* ── Split divider handle — drag to resize ── */}
            {effectiveDesignView === 'split' && (
              <div
                className={`ide-design-split-handle${isDraggingSplitter ? ' is-dragging' : ''}`}
                data-testid="ide-design-split-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to resize panels"
                title="Drag to resize panels"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  isDraggingSplitterRef.current = true;
                  setIsDraggingSplitter(true);
                }}
                onPointerMove={(e) => {
                  if (!isDraggingSplitterRef.current || !paneRowRef.current) return;
                  const rect = paneRowRef.current.getBoundingClientRect();
                  // Clamp: keep both panes readable, with extra room reserved for code.
                  const canvasMin = 320 / Math.max(rect.width, 1);
                  const hdlMin = 360 / Math.max(rect.width, 1);
                  const ratio = Math.max(canvasMin, Math.min(1 - hdlMin, (e.clientX - rect.left) / rect.width));
                  setSplitRatio(ratio);
                }}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  isDraggingSplitterRef.current = false;
                  setIsDraggingSplitter(false);
                }}
              />
            )}

            {/* ── HDL Pane — visible in hdl and split views ── */}
            {workspacePreset.showCodePane && (
              <div
                className="ide-design-pane ide-design-pane--hdl"
                data-testid="ide-design-hdl-pane"
                style={effectiveDesignView === 'split' ? { flex: `0 0 ${(1 - splitRatio) * 100}%` } : undefined}
              >
                {/* Primary artifact section */}
                <div className="ide-design-hdl-header" data-testid="ide-design-hdl-header">
                  <span className="ide-design-hdl-header-title">Primary Artifact</span>
                  <span className="ide-design-hdl-header-lang">{primaryArtifactFileName}</span>
                  <span
                    className={`ide-design-hdl-header-lang${primaryArtifact === 'verilog' ? ' ide-design-hdl-header-lang--verilog' : ''}`}
                    data-testid="ide-design-primary-artifact-label"
                  >
                    {primaryArtifactLabel}
                  </span>
                  <span className="ide-design-sync-badge ide-design-sync-badge-live" data-testid="ide-design-primary-artifact-badge">
                    Primary
                  </span>
                  {liveHdlResult.warnings.length > 0 && (
                    <span className="ide-design-sync-badge ide-design-sync-badge-warn">
                      {liveHdlResult.warnings.length} warning{liveHdlResult.warnings.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div className="ide-inline-actions ide-design-hdl-actions">
                    <div
                      className="ide-design-artifact-selector"
                      data-testid="ide-design-artifact-selector"
                      role="tablist"
                      aria-orientation="horizontal"
                      aria-label="Generated code artifact selector"
                    >
                      <button
                        type="button"
                        role="tab"
                        id={artifactTabVhdlId}
                        className={`ide-design-artifact-tab${primaryArtifact === 'vhdl' ? ' is-active' : ''}`}
                        data-testid="ide-design-artifact-vhdl"
                        aria-selected={primaryArtifact === 'vhdl'}
                        aria-controls={primaryArtifactPanelId}
                        tabIndex={primaryArtifact === 'vhdl' ? 0 : -1}
                        onClick={() => setPrimaryArtifact('vhdl')}
                      >
                        VHDL
                      </button>
                      <button
                        type="button"
                        role="tab"
                        id={artifactTabVerilogId}
                        className={`ide-design-artifact-tab${primaryArtifact === 'verilog' ? ' is-active' : ''}`}
                        data-testid="ide-design-artifact-verilog"
                        aria-selected={primaryArtifact === 'verilog'}
                        aria-controls={primaryArtifactPanelId}
                        tabIndex={primaryArtifact === 'verilog' ? 0 : -1}
                        onClick={() => setPrimaryArtifact('verilog')}
                        disabled={!hasVerilogArtifact}
                      >
                        Verilog
                      </button>
                    </div>
                    <button
                      type="button"
                      className="ide-design-hdl-action-btn is-secondary"
                      onClick={() => setSecondaryArtifactOpen((current) => !current)}
                      data-testid="ide-design-secondary-artifact-toggle"
                      disabled={!secondaryArtifactAvailable}
                    >
                      {secondaryArtifactAvailable
                        ? secondaryArtifactOpen
                          ? `Hide ${secondaryArtifactLabel}`
                          : `Show ${secondaryArtifactLabel}`
                        : 'Verilog unavailable'}
                    </button>
                    <button
                      type="button"
                      className="ide-design-hdl-action-btn is-secondary"
                      onClick={() => {
                        if (primaryArtifactText && typeof navigator !== 'undefined' && navigator.clipboard) {
                          void navigator.clipboard.writeText(primaryArtifactText);
                        }
                      }}
                      data-testid="ide-design-hdl-copy"
                    >
                      Copy
                    </button>
                    {primaryArtifactIsEditable && hdlDraftText && hdlDraftText !== (topHdl ?? liveHdlResult.vhd) && onApplyHdl && (
                      <button
                        type="button"
                        className="ide-design-hdl-action-btn"
                        onClick={() => onApplyHdl(hdlDraftText)}
                        data-testid="ide-design-apply-hdl"
                      >
                        Apply HDL → Graph
                      </button>
                    )}
                    {primaryArtifactIsEditable && hdlDraftText ? (
                      <button
                        type="button"
                        className="ide-design-hdl-action-btn is-secondary"
                        onClick={() => setHdlDraftText('')}
                        data-testid="ide-design-regen-hdl"
                      >
                        Reset to live
                      </button>
                    ) : null}
                    {onGoToImport && (
                      <button
                        type="button"
                        className="ide-design-hdl-action-btn is-secondary"
                        onClick={onGoToImport}
                        data-testid="ide-design-hdl-go-import"
                      >
                        Import HDL
                      </button>
                    )}
                  </div>
                </div>
                <div className="ide-design-hdl-body" data-testid="ide-design-hdl-body">
                  {liveHdlResult.error && (
                    <IdeCallout tone="error" title="HDL generation failed">
                      {liveHdlResult.error}
                    </IdeCallout>
                  )}
                  <IdeCallout tone="info" title="Generated from the circuit" testId="ide-design-generated-code-note">
                    This code is read-only in Design. Edit the canvas to regenerate it, or use Import to bring HDL into RedByte.
                  </IdeCallout>
                  <div className="ide-design-hdl-primary-pane" data-testid="ide-design-primary-artifact-pane">
                    <textarea
                      className={`ide-code-textarea ide-design-hdl-textarea ide-design-hdl-textarea--primary${primaryArtifactIsEditable ? '' : ' is-readonly'}`}
                      id={primaryArtifactPanelId}
                      role="tabpanel"
                      aria-labelledby={primaryArtifact === 'vhdl' ? artifactTabVhdlId : artifactTabVerilogId}
                      data-testid="ide-design-hdl-textarea"
                      data-artifact={primaryArtifact}
                      value={primaryArtifactText}
                      onChange={primaryArtifactIsEditable ? (e) => setHdlDraftText(e.target.value) : undefined}
                      placeholder={
                        primaryArtifact === 'vhdl'
                          ? 'VHDL is generated from the current circuit. Use Import to bring HDL into RedByte.'
                          : 'Verilog is generated from the current circuit in real time.'
                      }
                      readOnly={!primaryArtifactIsEditable}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                    />
                  </div>
                  {secondaryArtifactOpen && secondaryArtifactAvailable ? (
                    <div className="ide-design-hdl-secondary-drawer" data-testid="ide-design-secondary-artifact-drawer">
                      <div className="ide-design-hdl-secondary-header" data-testid="ide-design-secondary-artifact-header">
                        <span className="ide-design-hdl-secondary-title">Secondary Artifact</span>
                        <span className="ide-design-hdl-header-lang">{secondaryArtifactFileName}</span>
                        <span
                          className={`ide-design-hdl-header-lang${secondaryArtifact === 'verilog' ? ' ide-design-hdl-header-lang--verilog' : ''}`}
                        >
                          {secondaryArtifactLabel}
                        </span>
                      </div>
                      <textarea
                        className="ide-code-textarea ide-design-hdl-textarea ide-design-hdl-textarea--compact ide-design-hdl-textarea--secondary"
                        data-testid="ide-design-secondary-artifact-textarea"
                        data-artifact={secondaryArtifact}
                        aria-label={`${secondaryArtifactLabel} secondary artifact`}
                        title={`${secondaryArtifactLabel} secondary artifact`}
                        value={secondaryArtifactText}
                        readOnly
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                    </div>
                  ) : null}
                </div>{/* close ide-design-hdl-body */}
              </div>
            )}
            </div>{/* close ide-design-pane-row */}

        </DesignWorkspaceFrame>
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
  const isInputNode = node.type === 'INPUT' || node.type === 'Switch';
  const isOutputNode = node.type === 'OUTPUT' || node.type === 'Lamp';
  const tokenSource = [ioRow?.label, ioRow?.pin, node.label, node.id]
    .filter((entry): entry is string => typeof entry === 'string')
    .join(' ')
    .toUpperCase();
  const boardBinding = resolveBasys3SignalBinding({
    id: ioRow?.id ?? node.id,
    label: ioRow?.label ?? node.label ?? node.id,
    pin: ioRow?.pin,
    direction: ioRow?.direction ?? (isInputNode ? 'in' : 'out'),
    timingRole: ioRow?.timingRole,
    boardResourceType: ioRow?.boardResourceType,
  });

  if (boardBinding) {
    const resourceKind =
      boardBinding.resource.category === 'clock'
        ? 'clock'
        : boardBinding.resource.category === 'button'
          ? 'button'
          : boardBinding.resource.category === 'switch'
            ? 'switch'
            : boardBinding.resource.category === 'led'
              ? 'led'
              : undefined;
    if (resourceKind) {
      return {
        kind: resourceKind,
        label: boardBinding.alias,
        pinAlias: boardBinding.packagePin,
      };
    }
  }

  const pinAlias = normalizeAlias(ioRow?.pin ?? '');

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
  running: boolean,
  timingGuidance?: TimingGuidance
): DesignSimulationStory {
  const toTimingMatchKey = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const latest = trace[trace.length - 1];
  const previous = trace.length >= 2 ? trace[trace.length - 2] : null;
  const storySource = [...inputRows, ...outputRows];
  const changedRows = previous
    ? storySource.filter((row) => (previous.signals[row.signalKey] ?? row.value) !== row.value)
    : [];
  const changedInputs = changedRows.filter((row) => row.kind === 'input');
  const changedOutputs = changedRows.filter((row) => row.kind === 'output');
  const exactClockSignalName = timingGuidance?.kind === 'clock'
    ? normalizeIoSignalKey(timingGuidance.signalName ?? '')
    : '';
  const fuzzyClockSignalName = timingGuidance?.kind === 'clock'
    ? toTimingMatchKey(timingGuidance.signalName ?? '')
    : '';
  const clockRow = fuzzyClockSignalName.length > 0
    ? inputRows.find((row) => {
        const entries = [row.label, row.id, ...row.matchKeys].filter((value) => value.trim().length > 0);
        const exactKeys = entries
          .map((value) => normalizeIoSignalKey(value))
          .filter((value) => value.length > 0);
        if (exactClockSignalName.length > 0 && exactKeys.includes(exactClockSignalName)) {
          return true;
        }
        const fuzzyKeys = entries
          .map((value) => toTimingMatchKey(value))
          .filter((value) => value.length > 0);
        return fuzzyKeys.includes(fuzzyClockSignalName);
      })
    : undefined;
  const resolvedClockLabel = clockRow
    ? clockRow.matchKeys.find((value) => toTimingMatchKey(value) === fuzzyClockSignalName)
        ?? clockRow.label
    : null;
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
      clockLabel: resolvedClockLabel,
    };
  }

  if (changedRows.length === 0) {
    const primaryOutput = outputRows[0];
    return {
      summary: primaryOutput
        ? `${primaryOutput.label} held at ${primaryOutput.value} on tick ${latest.tick}.`
        : `Tick ${latest.tick} recorded with no mapped outputs yet.`,
      clockEvent,
      clockLabel: resolvedClockLabel,
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
    clockLabel: resolvedClockLabel,
  };
}

function formatReplaySelectionLabel(
  caseIndex: number | null,
  caseCount: number | null,
  tick: number | null | undefined
): string {
  if (tick == null) return 'replay sample';
  if (caseIndex == null || caseIndex < 0) return `t${tick}`;
  const caseNumber = caseIndex + 1;
  if (caseCount != null && caseCount > 0) {
    return `Case ${caseNumber} / ${caseCount} · t${tick}`;
  }
  return `Case ${caseNumber} · t${tick}`;
}

function formatReplayTimingHint(meta: RuntimeVerifyRun['meta'] | null | undefined): string | null {
  if (!meta || meta.clockingProtocol !== 'clocked_macro') return null;
  const samplePointLabel =
    meta.samplePoint === 'post-rising-edge' ? 'Sampled post-rising-edge' : 'Sampled at the selected Verify tick';
  if (meta.clockSignalName && meta.clockSignalName.trim().length > 0) {
    return `${samplePointLabel} on ${meta.clockSignalName}.`;
  }
  return `${samplePointLabel}.`;
}

function describeVerifyDebugSummary(context: VerifyDebugContext): string {
  const signal = getVerifyDebugDisplaySignal(context);
  const base = `Verify failed on ${signal}: expected ${context.expected}, observed ${context.actual} at tick ${context.tick}.`;
  if (context.patternSummary) {
    return `${base} ${context.patternSummary}`;
  }
  return base;
}

function formatReplayCausationValue(value: 0 | 1 | null): string {
  return value == null ? '?' : `${value}`;
}

function describeReplayChange(snapshot: DesignSignalSnapshot | null): string {
  if (!snapshot) return 'Current sample unavailable';

  const currentValue = formatReplayCausationValue(snapshot.currentValue);
  const previousValue = formatReplayCausationValue(snapshot.previousValue);

  if (snapshot.transition === 'rising') {
    return `Rose ${previousValue} to ${currentValue} at t${snapshot.lastTransitionTick ?? '?'}`;
  }
  if (snapshot.transition === 'falling') {
    return `Fell ${previousValue} to ${currentValue} at t${snapshot.lastTransitionTick ?? '?'}`;
  }
  if (
    snapshot.previousValue != null &&
    snapshot.currentValue != null &&
    snapshot.previousValue === snapshot.currentValue
  ) {
    return `No change from previous case (still ${currentValue})`;
  }
  if (snapshot.lastTransitionTick != null) {
    return `Holding ${currentValue} since t${snapshot.lastTransitionTick}`;
  }
  return `Holding ${currentValue}`;
}

function formatReplayDriverLabels(labels: readonly string[]): string | null {
  const uniqueLabels = Array.from(
    new Set(labels.map((label) => label.trim()).filter((label) => label.length > 0))
  );
  if (uniqueLabels.length === 0) return null;
  if (uniqueLabels.length === 1) return uniqueLabels[0] ?? null;
  if (uniqueLabels.length === 2) return `${uniqueLabels[0]} and ${uniqueLabels[1]}`;
  return `${uniqueLabels[0]}, ${uniqueLabels[1]}, and ${uniqueLabels.length - 2} more`;
}

function describeReplayCausation(input: {
  snapshot: DesignSignalSnapshot | null;
  driverLabels: readonly string[];
  inspectLabel?: string | null;
}): string {
  const parts = [describeReplayChange(input.snapshot)];
  const driverLabel = formatReplayDriverLabels(input.driverLabels);
  if (driverLabel) {
    parts.push(`upstream path from ${driverLabel}`);
  }
  const inspectLabel = input.inspectLabel?.trim();
  if (inspectLabel) {
    parts.push(`inspect ${inspectLabel} first`);
  }
  return `${parts.join('; ')}.`;
}

function normalizeSignalLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\[[^\]]+\]/g, '');
}

function resolveDirectSignalDriverLabels(
  signalKey: string | null | undefined,
  circuit: Circuit,
  ioRowByNodeId: Map<string, DesignIoRow>,
  resolveConnectionEndpoint: (
    raw: Circuit['connections'][number]['from'] | Circuit['connections'][number]['to']
  ) => { nodeId: string; portName: string }
): string[] {
  if (!signalKey) return [];
  const dotIndex = signalKey.indexOf('.');
  if (dotIndex === -1) return [];

  const nodeId = signalKey.slice(0, dotIndex);
  const portName = signalKey.slice(dotIndex + 1);
  if (!nodeId || !portName) return [];

  const driverLabels = circuit.connections
    .filter((connection) => {
      const to = resolveConnectionEndpoint(connection.to);
      return to.nodeId === nodeId && to.portName === portName;
    })
    .map((connection) => {
      const from = resolveConnectionEndpoint(connection.from);
      const sourceNode = circuit.nodes.find((entry) => entry.id === from.nodeId);
      return describeEndpointLabel(from.nodeId, sourceNode, ioRowByNodeId.get(from.nodeId));
    });

  if (driverLabels.length > 0) {
    return Array.from(new Set(driverLabels));
  }

  if (portName === 'out') {
    const node = circuit.nodes.find((entry) => entry.id === nodeId);
    return [describeEndpointLabel(nodeId, node, ioRowByNodeId.get(nodeId))];
  }

  return [];
}

function resolveVerifyLinkedSignalKey(
  activeVerifySignal: string | null | undefined,
  ioRows: DesignIoRow[],
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

  const matchedRow =
    ioRows.find((row) => normalizeSignalLookup(row.id) === normalized) ??
    ioRows.find((row) => normalizeSignalLookup(row.label) === normalized);
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
  liveSignals: Map<string, 0 | 1>,
  fallbackTrace?: RuntimeSimState['trace']
): DesignSignalSnapshot | null {
  if (!signalKey) return null;

  const matchingSamples = resolveSignalTraceSamples(signalKey, trace, fallbackTrace);
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

function normalizeReplayWaveformTrace(
  waveform: Pick<RuntimeVerifyRun, 'waveform'>['waveform']
): RuntimeSimState['trace'] {
  return [...waveform]
    .map((sample) => ({
      tick: sample.tick,
      signals: Object.fromEntries(
        Object.entries(sample.signals ?? {}).map(([signalKey, value]) => [
          signalKey,
          value === '1' ? 1 : 0,
        ])
      ) as Record<string, 0 | 1>,
    }))
    .sort((left, right) => left.tick - right.tick);
}

function resolveSignalTraceSamples(
  signalKey: string | null,
  trace: RuntimeSimState['trace'],
  fallbackTrace?: RuntimeSimState['trace']
): RuntimeSimState['trace'] {
  if (!signalKey) return [];

  const preferredSamples = trace.filter((entry) =>
    Object.prototype.hasOwnProperty.call(entry.signals, signalKey)
  );
  if (preferredSamples.length > 0 || !fallbackTrace) {
    return preferredSamples;
  }

  return fallbackTrace.filter((entry) =>
    Object.prototype.hasOwnProperty.call(entry.signals, signalKey)
  );
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

function findNodeById(circuit: Circuit, nodeId: string): Node | undefined {
  return circuit.nodes.find((n) => n.id === nodeId);
}

/** Board / instance name for trace banners — prefers Map Pins label, then schematic label, then type + id. */
function formatTracePartName(node: Node | undefined, ioRow: DesignIoRow | undefined, nodeId: string): string {
  const name = ioRow?.label?.trim() || node?.label?.trim();
  if (name) return name;
  if (node) {
    const t = nodeTypeLabel(node.type);
    return nodeId.length > 8 ? `${t} (…${nodeId.slice(-4)})` : `${t} (${nodeId})`;
  }
  return nodeId;
}

function buildStudentFaninPortTraceLabel(
  circuit: Circuit,
  nodeId: string,
  portName: string,
  ioByNodeId: Map<string, DesignIoRow>
): string {
  const node = findNodeById(circuit, nodeId);
  const part = formatTracePartName(node, ioByNodeId.get(nodeId), nodeId);
  return `What feeds ${part} · ${portName} — drivers on this input highlighted`;
}

function buildStudentFanoutPortTraceLabel(
  circuit: Circuit,
  sourceNodeId: string,
  ioByNodeId: Map<string, DesignIoRow>
): string {
  const node = findNodeById(circuit, sourceNodeId);
  const part = formatTracePartName(node, ioByNodeId.get(sourceNodeId), sourceNodeId);
  return `What ${part} drives — every path from this source highlighted`;
}

function buildStudentWireNetTraceLabel(
  circuit: Circuit,
  fromNodeId: string,
  fromPort: string,
  ioByNodeId: Map<string, DesignIoRow>
): string {
  const node = findNodeById(circuit, fromNodeId);
  const part = formatTracePartName(node, ioByNodeId.get(fromNodeId), fromNodeId);
  return `One net: ${part} · ${fromPort} — every segment of this signal highlighted`;
}

function buildStudentVerifyDebugTraceLabel(
  mode: 'Verify' | 'Debug',
  signalKey: string,
  circuit: Circuit,
  ioByNodeId: Map<string, DesignIoRow>
): string {
  const [nodeId, portName = 'out'] = signalKey.split('.');
  if (!nodeId) return `${mode}: ${signalKey}`;
  const node = findNodeById(circuit, nodeId);
  const part = formatTracePartName(node, ioByNodeId.get(nodeId), nodeId);
  return `${mode}: what drives ${part} · ${portName} — same highlight`;
}

/** Buckets multiple selected wire segment ids by their driver (from-end of the edge), matching one-net auto-trace. */
interface DesignMultiWireNetSummary {
  totalWires: number;
  distinctGroupCount: number;
  sameNet: boolean;
  /** Sorted driver display labels, e.g. "SW0 · out" */
  groupLabels: string[];
  headline: string;
  detail: string;
}

function summarizeMultiWireNetSelection(
  circuit: Circuit,
  wireIds: readonly string[],
  ioByNodeId: Map<string, DesignIoRow>
): DesignMultiWireNetSummary {
  const byDriver = new Map<string, number>();
  for (const wid of wireIds) {
    const p = parseWireId(wid);
    if (!p) continue;
    const key = `${p.fromNodeId}.${p.fromPort}`;
    byDriver.set(key, (byDriver.get(key) ?? 0) + 1);
  }
  if (byDriver.size === 0) {
    return {
      totalWires: wireIds.length,
      distinctGroupCount: 0,
      sameNet: false,
      groupLabels: [],
      headline: 'Wires selected',
      detail: "We could not read one or more connection ids. Deselect and try again.",
    };
  }
  const groupLabels: string[] = [];
  for (const key of [...byDriver.keys()].sort((a, b) => a.localeCompare(b))) {
    const sampleWire = wireIds.find((w) => {
      const q = parseWireId(w);
      return q && `${q.fromNodeId}.${q.fromPort}` === key;
    });
    if (!sampleWire) continue;
    const p = parseWireId(sampleWire);
    if (!p) continue;
    const node = findNodeById(circuit, p.fromNodeId);
    const part = formatTracePartName(node, ioByNodeId.get(p.fromNodeId), p.fromNodeId);
    groupLabels.push(`${part} · ${p.fromPort}`);
  }
  const distinct = groupLabels.length;
  const sameNet = distinct === 1;
  const totalWires = wireIds.length;
  if (sameNet) {
    const g = groupLabels[0] ?? 'this driver';
    return {
      totalWires,
      distinctGroupCount: 1,
      sameNet: true,
      groupLabels,
      headline: 'Same net — all selected segments share one driver',
      detail: `The ${totalWires} segments you picked all branch from one source (${g}) — it is one electrical signal. The canvas keeps the full net highlighted; select one segment when you want a single-hop readout in the panel.`,
    };
  }
  const list = groupLabels.join(' · ');
  return {
    totalWires,
    distinctGroupCount: distinct,
    sameNet: false,
    groupLabels,
    headline: `Multiple signals — ${distinct} different drivers in this selection`,
    detail: `These ${totalWires} segments span more than one path (${list}). Tracing and live current value are clearest for one net at a time: deselect until one wire, or one signal group, remains.`,
  };
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
  const nodeLabel = describeNodeForStudents(node);
  const prefix = `${issue.nodeId}.`;
  const rawPortName =
    issue.focusTarget.portKey ??
    (issue.portKey.startsWith(prefix) ? issue.portKey.slice(prefix.length) : '');
  if (!rawPortName || rawPortName === '__self') {
    return nodeLabel;
  }
  return `${nodeLabel} · ${describePortForStudents(rawPortName)}`;
}

function describeNodeForStudents(node: Node | undefined, ioRow?: DesignIoRow | null): string {
  if (!node) return 'Selected part';
  const preferred = ioRow?.label?.trim() || node.label?.trim();
  if (preferred) return preferred;
  return nodeTypeLabel(node.type);
}

function buildSequentialInspectorContext(input: {
  node: Node | undefined;
  nodeSignals: Map<string, 0 | 1 | null>;
  ioRow: DesignIoRow | null;
  connectionSummary: DesignNodeConnectionSummary | null;
  circuit: Circuit;
  ioRowByNodeId: Map<string, DesignIoRow>;
  trace: RuntimeSimState['trace'];
  fallbackTrace?: RuntimeSimState['trace'];
  runtimeSignals: Record<string, 0 | 1>;
  liveSignals: Map<string, 0 | 1>;
}): DesignSequentialInspectorContext | null {
  const { node, nodeSignals, ioRow, connectionSummary, circuit, ioRowByNodeId, trace, fallbackTrace, runtimeSignals, liveSignals } = input;
  if (!node) return null;

  if (node.type === 'Clock') {
    const outputSnapshot = describeSignalSnapshot(`${node.id}.out`, trace, runtimeSignals, liveSignals, fallbackTrace);
    const boardSummary = ioRow ? `${ioRow.label} -> ${ioRow.pin || 'unmapped'}` : 'No board timing source mapped yet';
    const fanout = connectionSummary?.fanOut ?? 0;
    return {
      kind: 'clock',
      roleLabel: 'Timing source',
      behaviorSummary: ioRow
        ? 'This clock is the named timing source for the sequential logic it drives.'
        : 'This clock drives timing edges, but it is not mapped to a board timing source yet.',
      nextStep: ioRow
        ? 'Trace the fanout into the state elements this clock drives next.'
        : 'Map this clock to a board timing source before trusting board-level timing behavior.',
      controlLabel: null,
      controlSourceLabel: null,
      controlActivity: describeSequentialActivity(outputSnapshot),
      ioSummaryLabel: 'Output state',
      ioSummary: `Clock output=${formatInspectorBinaryValue(nodeSignals.get('out'))}`,
      stateSummaryLabel: 'Fan-out',
      stateSummary: `${fanout} downstream ${fanout === 1 ? 'path' : 'paths'}`,
      timingContext: boardSummary,
      actionKind: ioRow ? null : 'go-to-hardware',
      actionLabel: ioRow ? null : 'Go to Map Pins',
      actionPort: null,
    };
  }

  if (node.type === 'Register1' || node.type === 'RegisterBus' || node.type === 'StateBank') {
    const cfg = (node.config ?? {}) as Record<string, unknown>;
    const width = normalizeRegisterWidth(node.type, cfg);
    const hasEnable = cfg.hasEnable === true;
    const resetKind = String(cfg.resetKind ?? 'none');
    const resetPolarityLabel = String(cfg.resetPolarity ?? 'active_high').toLowerCase().includes('low')
      ? 'active low'
      : 'active high';
    const enablePolarityLabel = String(cfg.enablePolarity ?? 'active_high').toLowerCase().includes('low')
      ? 'active low'
      : 'active high';
    const clockEdge =
      String(cfg.clockPolarity ?? 'rising_edge').toLowerCase() === 'falling_edge' ? 'falling_edge' : 'rising_edge';
    const edgeLabel = clockEdge === 'falling_edge' ? 'falling' : 'rising';

    const controlPort = 'CLK';
    const controlSource = resolveNodeInputSource(node.id, controlPort, circuit, ioRowByNodeId);
    const controlSignalKey = controlSource?.signalKey ?? `${node.id}.${controlPort}`;
    const controlSnapshot = describeSignalSnapshot(controlSignalKey, trace, runtimeSignals, liveSignals, fallbackTrace);
    const commonControl = {
      controlSourceLabel: controlSource?.label ?? 'No clock source wired',
      controlActivity: describeSequentialActivity(controlSnapshot),
    };

    const roleLabel =
      node.type === 'StateBank' ? 'State bank' : node.type === 'RegisterBus' ? 'Bus register' : 'Native register';

    const resetLine =
      resetKind === 'none'
        ? 'Reset is off in config — RST can remain unwired.'
        : `Reset mode ${resetKind.replace(/_/g, ' ')} (${resetPolarityLabel}).`;

    const enableLine = hasEnable
      ? `Clock enable (EN/CE) is on; enable polarity is ${enablePolarityLabel}.`
      : 'Clock enable is off in config — the register behaves as if EN were always active.';

    const tapLine =
      node.type === 'Register1'
        ? 'Use Q and Q_inv for downstream combinational logic.'
        : `Bus width ${width}: use packed Q or per-bit outputs Q[0]…Q[${Math.max(0, width - 1)}] as taps.`;

    const behaviorSummary = `Samples on the ${edgeLabel} clock edge. ${enableLine} ${resetLine} ${tapLine}`;

    const inputPorts: string[] = ['D', 'CLK'];
    if (hasEnable) inputPorts.push('EN');
    if (resetKind !== 'none') inputPorts.push('RST');

    const stateSummary =
      node.type === 'Register1'
        ? summarizeSequentialPorts(nodeSignals, ['Q', 'Q_inv'])
        : summarizeRegisterBusOutputs(nodeSignals, width);

    return {
      kind: 'register-family',
      roleLabel,
      behaviorSummary,
      nextStep: controlSource
        ? `CLK is wired — confirm the ${edgeLabel} edge matches your intent in Verify / Map Pins.`
        : 'Wire CLK to a clock or manual step source before expecting updates.',
      controlLabel: 'Clock',
      ioSummaryLabel: 'Inputs',
      ioSummary: summarizeSequentialPorts(nodeSignals, inputPorts),
      stateSummaryLabel: 'State / taps',
      stateSummary,
      timingContext: `${edgeLabel === 'falling' ? 'Falling' : 'Rising'}-edge sampling · width ${width}`,
      actionKind: 'trace-control',
      actionLabel: 'Trace clock path',
      actionPort: 'CLK',
      ...commonControl,
    };
  }

  const controlPort =
    node.type === 'DLatch'
      ? 'EN'
      : node.type === 'RSLatch' || node.type === 'SRLatch'
        ? resolveSequentialRsControlPort(nodeSignals)
        : node.type === 'DFlipFlop' || node.type === 'TFlipFlop' || node.type === 'JKFlipFlop'
          ? 'CLK'
          : null;
  if (!controlPort) return null;

  const controlSource = resolveNodeInputSource(node.id, controlPort, circuit, ioRowByNodeId);
  const controlSignalKey = controlSource?.signalKey ?? `${node.id}.${controlPort}`;
  const controlSnapshot = describeSignalSnapshot(controlSignalKey, trace, runtimeSignals, liveSignals, fallbackTrace);
  const commonControl = {
    controlSourceLabel: controlSource?.label ?? `No ${describePortForStudents(controlPort).toLowerCase()} source wired`,
    controlActivity: describeSequentialActivity(controlSnapshot),
  };

  if (node.type === 'DLatch') {
    return {
      kind: 'latch',
      roleLabel: 'Level-sensitive latch',
      behaviorSummary: 'The latch is transparent while Enable is high and holds state when Enable returns low.',
      nextStep: 'Trace the enable path next so you can confirm when this latch should pass data versus hold state.',
      controlLabel: 'Enable',
      ioSummaryLabel: 'Inputs',
      ioSummary: summarizeSequentialPorts(nodeSignals, ['D', 'EN']),
      stateSummaryLabel: 'State outputs',
      stateSummary: summarizeSequentialPorts(nodeSignals, ['Q', 'Q_inv']),
      timingContext: controlSource?.label ?? 'No enable source named yet',
      actionKind: 'trace-control',
      actionLabel: 'Trace control path',
      actionPort: 'EN',
      ...commonControl,
    };
  }

  if (node.type === 'RSLatch' || node.type === 'SRLatch') {
    return {
      kind: 'rs-latch',
      roleLabel: 'Level-sensitive latch',
      behaviorSummary: 'Set and Reset drive the stored state directly, so those control levels must stay intentional.',
      nextStep: 'Trace the active Set or Reset path next so you can confirm which control line is driving the stored state.',
      controlLabel: 'Set / Reset',
      ioSummaryLabel: 'Inputs',
      ioSummary: summarizeSequentialPorts(nodeSignals, ['S', 'R']),
      stateSummaryLabel: 'State outputs',
      stateSummary: summarizeSequentialPorts(nodeSignals, ['Q', 'Q_inv']),
      timingContext: controlSource?.label ?? 'No Set or Reset source named yet',
      actionKind: 'trace-control',
      actionLabel: 'Trace control path',
      actionPort: controlPort,
      ...commonControl,
    };
  }

  const flipFlopCopy =
    node.type === 'DFlipFlop'
      ? {
          roleLabel: 'Edge-triggered state',
          behaviorSummary: 'This flip-flop captures D on the active clock edge and holds Q between clock edges.',
          ioPorts: ['D', 'CLK'],
        }
      : node.type === 'TFlipFlop'
        ? {
            roleLabel: 'Edge-triggered toggle state',
            behaviorSummary: 'This flip-flop toggles its stored state on clock edges according to T and optional Clear.',
            ioPorts: ['T', 'CLK', 'CLR'],
          }
        : {
            roleLabel: 'Edge-triggered JK state',
            behaviorSummary: 'This flip-flop uses J and K on the active clock edge to decide the next stored state.',
            ioPorts: ['J', 'K', 'CLK', 'CLR'],
          };

  return {
    kind: 'flip-flop',
    roleLabel: flipFlopCopy.roleLabel,
    behaviorSummary: flipFlopCopy.behaviorSummary,
    nextStep: controlSource
      ? 'Trace the clock path next so you can confirm which edge should update the stored output.'
      : 'Wire your clock input to the CLK port. For a manual clock (e.g. an ENTER switch), that switch must connect here.',
    controlLabel: 'Clock',
    ioSummaryLabel: 'Inputs',
    ioSummary: summarizeSequentialPorts(nodeSignals, flipFlopCopy.ioPorts),
    stateSummaryLabel: 'State outputs',
    stateSummary: summarizeSequentialPorts(nodeSignals, ['Q', 'Q_inv']),
    timingContext: controlSource?.label ?? 'No clock source named yet',
    actionKind: 'trace-control',
    actionLabel: 'Trace control path',
    actionPort: controlPort,
    ...commonControl,
  };
}

function resolveSequentialRsControlPort(
  nodeSignals: Map<string, 0 | 1 | null>
): string {
  if (nodeSignals.has('S')) return 'S';
  if (nodeSignals.has('R')) return 'R';
  return 'S';
}

function resolveNodeInputSource(
  nodeId: string,
  portName: string,
  circuit: Circuit,
  ioRowByNodeId: Map<string, DesignIoRow>
): { signalKey: string; label: string } | null {
  for (const connection of circuit.connections) {
    const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
    const toPort =
      typeof connection.to === 'string'
        ? connection.toPort ?? connection.toPin ?? 'in'
        : connection.to.portName ?? connection.to.port ?? 'in';
    if (toNodeId !== nodeId || toPort !== portName) continue;

    const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
    const fromPort =
      typeof connection.from === 'string'
        ? connection.fromPort ?? connection.fromPin ?? 'out'
        : connection.from.portName ?? connection.from.port ?? 'out';
    const sourceNode = circuit.nodes.find((entry) => entry.id === fromNodeId);
    const sourceIoRow = ioRowByNodeId.get(fromNodeId);
    const sourceLabel = describeEndpointLabel(fromNodeId, sourceNode, sourceIoRow);
    const pinSuffix = sourceIoRow?.pin ? ` (${sourceIoRow.pin})` : '';
    return {
      signalKey: `${fromNodeId}.${fromPort}`,
      label: `${sourceLabel}${pinSuffix} · ${describePortForStudents(fromPort)}`,
    };
  }
  return null;
}

function summarizeSequentialPorts(
  nodeSignals: Map<string, 0 | 1 | null>,
  ports: readonly string[]
): string {
  const entries = ports
    .filter((port) => nodeSignals.has(port))
    .map((port) => `${describePortForStudents(port)}=${formatInspectorBinaryValue(nodeSignals.get(port))}`);
  return entries.length > 0 ? entries.join(', ') : 'No live signal values yet';
}

function summarizeRegisterBusOutputs(nodeSignals: Map<string, 0 | 1 | null>, width: number): string {
  const bitSummaries: string[] = [];
  const limit = Math.min(width, 8);
  for (let i = 0; i < limit; i += 1) {
    const key = `Q[${i}]`;
    if (!nodeSignals.has(key)) continue;
    bitSummaries.push(`${key}=${formatInspectorBinaryValue(nodeSignals.get(key))}`);
  }
  const packedLabel = nodeSignals.has('Q') ? formatInspectorBinaryValue(nodeSignals.get('Q')) : '?';
  const more = width > limit ? ` (+${width - limit} more bits)` : '';
  if (bitSummaries.length === 0) {
    return `Packed Q=${packedLabel}${more} — per-bit Q[i] taps appear after run or when ports are resolved.`;
  }
  return `Packed Q=${packedLabel}${more} · ${bitSummaries.join(', ')}`;
}

function formatInspectorBinaryValue(value: 0 | 1 | null | undefined): string {
  return value === 1 ? '1' : value === 0 ? '0' : '?';
}

function describeSequentialActivity(snapshot: DesignSignalSnapshot | null): string {
  if (!snapshot || snapshot.currentValue == null) return 'No runtime samples yet';
  if ((snapshot.transition === 'rising' || snapshot.transition === 'falling') && snapshot.lastTransitionTick != null) {
    return `${snapshot.transition} at tick ${snapshot.lastTransitionTick}`;
  }
  if (snapshot.transition === 'stable') {
    return `stable at ${formatInspectorBinaryValue(snapshot.currentValue)}`;
  }
  return 'No runtime samples yet';
}

function describePortForStudents(portName: string): string {
  const bracketBit = /^(q|d)\[(\d+)\]$/i.exec(portName.trim());
  if (bracketBit) {
    const kind = bracketBit[1].toUpperCase() === 'Q' ? 'State bit' : 'Data bit';
    return `${kind} ${bracketBit[2]}`;
  }
  const normalized = portName.trim().toLowerCase();
  const labels: Record<string, string> = {
    a: 'Input A',
    b: 'Input B',
    c: 'Input C',
    d: 'D',
    en: 'Enable',
    clk: 'Clock',
    clr: 'Clear',
    reset: 'Reset',
    in: 'Input',
    out: 'Output',
    q: 'Q',
    q_inv: 'Q bar',
    j: 'J',
    k: 'K',
    s: 'Set',
    r: 'Reset',
    sel: 'Select',
  };
  if (labels[normalized]) return labels[normalized];
  if (normalized.length <= 3) return normalized.toUpperCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function describeStudentSignalKey(
  signalKey: string | null | undefined,
  circuit: Circuit,
  ioRowByNodeId?: Map<string, DesignIoRow>
): string {
  const raw = signalKey?.trim();
  if (!raw) return 'Signal';
  const dotIndex = raw.indexOf('.');
  if (dotIndex === -1) return raw;
  const nodeId = raw.slice(0, dotIndex);
  const portName = raw.slice(dotIndex + 1);
  const node = circuit.nodes.find((entry) => entry.id === nodeId);
  const nodeLabel = describeNodeForStudents(node, ioRowByNodeId?.get(nodeId));
  if (!portName || portName === 'out') return nodeLabel;
  return `${nodeLabel} · ${describePortForStudents(portName)}`;
}

function describeSignalFocusPresentation(input: {
  focusLabel: string | null | undefined;
  signalKey: string | null | undefined;
  circuit: Circuit;
  ioRowByNodeId: Map<string, DesignIoRow>;
}): {
  focusLabel: string;
  inspectLabel: string;
  signalLabel: string;
  needsBridge: boolean;
} | null {
  const { focusLabel, signalKey, circuit, ioRowByNodeId } = input;
  const rawFocusLabel = focusLabel?.trim();
  if (!rawFocusLabel) return null;

  const normalizedFocusLabel = normalizeSignalLookup(rawFocusLabel);
  let inspectLabel = rawFocusLabel;
  if (signalKey) {
    const dotIndex = signalKey.indexOf('.');
    if (dotIndex !== -1) {
      const nodeId = signalKey.slice(0, dotIndex);
      const node = circuit.nodes.find((entry) => entry.id === nodeId);
      const endpointLabel = describeEndpointLabel(nodeId, node, ioRowByNodeId.get(nodeId));
      if (endpointLabel && normalizeSignalLookup(endpointLabel) !== normalizedFocusLabel) {
        inspectLabel = endpointLabel;
      }
    }
  }

  const signalLabel = describeStudentSignalKey(signalKey ?? rawFocusLabel, circuit, ioRowByNodeId);
  const needsBridge =
    normalizeSignalLookup(signalLabel) !== normalizedFocusLabel &&
    normalizeSignalLookup(inspectLabel) !== normalizedFocusLabel;

  return {
    focusLabel: rawFocusLabel,
    inspectLabel,
    signalLabel,
    needsBridge,
  };
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
  Ground: ['out'],
  DLatch: ['D', 'EN', 'Q', 'Q_inv'],
  DFlipFlop: ['D', 'CLK', 'Q', 'Q_inv'],
  TFlipFlop: ['T', 'CLK', 'CLR', 'Q', 'Q_inv'],
  JKFlipFlop: ['J', 'K', 'CLK', 'CLR', 'Q', 'Q_inv'],
};

function deriveNodePins(node: Node | undefined, circuit: Circuit): string[] {
  if (!node) return [];
  const dynamicMetadata = getDesignChipMetadataForNode(node);
  if (dynamicMetadata) {
    return Array.from(
      new Set([
        ...dynamicMetadata.inputs.map((port) => port.id),
        ...dynamicMetadata.outputs.map((port) => port.id),
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
