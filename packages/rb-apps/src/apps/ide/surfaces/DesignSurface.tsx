import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ProblemsPanel } from '../components/ProblemsPanel';
import { selectProblemCount, useEngineeringProblems } from '../engineeringProblems';
import type { Circuit, CompositeNodeDef, Node } from '@redbyte/rb-logic-core';
import { busForNode, busRangeLabel, getComponentSupport, TickEngine } from '@redbyte/rb-logic-core';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import {
  FIT_ZOOM_STEPS,
  LogicCanvas,
  describePortRefForStudents,
  describeWireRejectionForStudents,
  findSmartSpawnPosition,
  useLogicViewStore,
  wireRejectionMessage,
  type ChipMetadata,
  type NodeIoPresentation,
  buildGeometryIndex,
  unionBounds,
  type SchematicBusGroup,
} from '@redbyte/rb-logic-view';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { parseWireId } from '../../../utils/wireId';
import type { IdeDiagnostic, IdeDiagnosticRouteRequest } from '../diagnostics';
import type { DesignFocusRequest } from '../designFocus';
import {
  DesignFocusBanner,
  type DesignFocusContext,
} from '../components/DesignFocusBanner';
import { DesignFocusInspector } from '../components/DesignFocusInspector';
import { buildDesignDebugSignalTrace, getFaninCone, getFanoutCone } from '../pathTrace';
import { arrangeCircuitByDependency, hasRunnableBoundaryPath } from '../designGraphLayout';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeEmptyState,
  IdeInspectorSection,
  IdeModal,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { RuntimeSimState, RuntimeSignalProbe, RuntimeVerifyRun } from '../projectRuntime';
import type { VerifyScenarioStep } from '../verifyScenarioSteps';
import {
  buildSequentialReplayModel,
  findNextReplayIndex,
  findPreviousReplayIndex,
} from '../sequentialReplay';
import type { RuntimeLogicValue } from '../sim/simTypes';
import { resolveBoardSignal, useBoardSignal } from '../BoardSignalContext';
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
import type { HdlSource } from '../../../fpga/toolchainBackend';
import { deriveSemanticZoomTier, type SemanticZoomTier } from '../semanticZoom';
import { buildVhdlTopLevelBindings } from '../../../fpga/boards/basys3/basys3Bundle';
import {
  getBasys3BoardResource,
  isBasys3ResourceCompatibleWithSignal,
  listBasys3CompatibleResources,
} from '../../../fpga/boards/basys3/basys3Pins';
import { listBasys3DesignBoardResourceInventory } from '../../../fpga/boards/basys3/basys3BoardSurfaceProjection';
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
import {
  centerDesignSelectionWithContext,
  readDesignCanvasViewport,
  reconcileDesignCanvasCamera,
  type DesignCanvasGraphAnchor,
  type DesignCanvasViewport,
} from './designCanvasCamera';
import type { IdeChromeContract } from '../chromeContract';
import {
  deriveDesignHierarchy,
  deriveDesignSources,
  flattenDesignHierarchy,
} from '../designProjectProjection';
import {
  COMPONENT_DEFINITION_REGISTRY,
  createComponentDefinitionRegistry,
  type ComponentDefinition,
  type ComponentDefinitionCategory,
  type ComponentDesignPaletteSection,
} from '../componentDefinitions';
import { deriveLibraryCardFacts } from '../componentLibraryPresentation';
import {
  DESIGN_TOOLBAR_COMMAND_GROUPS,
  IDE_COMMAND_IDS,
  IDE_COMMAND_EVENT_NAME,
  REQUIRED_DESIGN_TOOLBAR_COMMAND_IDS,
  listDesignToolbarCommandGroupOrder,
  moveDesignToolbarCommandGroup,
  type DesignToolbarCommandGroupId,
  type IdeCommandId,
} from '../ideCommandRegistry';
import { workspacePreferencesStore } from '../workspacePreferences';
import { useEngineeringSelection } from '../engineeringSelection';
import { RelatedMenu } from '../components/RelatedMenu';
import { useEngineeringRelationshipIndex } from '../engineeringRelationships';
import {
  TOP_MODULE_ID,
  analyzeModuleSelection,
  moduleUsageCount,
  readInstanceName,
  type CreateModuleInput,
  type CreateModuleResult,
  type ModuleSelectionAnalysis,
  type ProjectHierarchyDocument,
} from '../projectHierarchy';
import './design-workbench-v3.css';
import './design/design-schematic.css';
import './design/design-instrument.css';

export const CHROME_CONTRACT = {
  surfaceId: 'design',
  topStripSlots: ['command-bar', 'status-row'],
  leftDockPolicy: 'always',
  rightDockPolicy: 'contextual',
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
  projectId?: string;
  projectName?: string;
  onCircuitMutated?: (circuit: Circuit) => void;
  onRuntimeAddNode?: (nodeType: string, position: { x: number; y: number }) => void;
  onRuntimeAddIo?: (direction: 'input' | 'output', position: { x: number; y: number }) => void;
  onRuntimeCreateBus?: (input: {
    name: string;
    direction: 'input' | 'output';
    width: number;
    position?: { x: number; y: number };
  }) => { ok: true; busId: string } | { ok: false; error: string };
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
    required?: boolean;
    timingRole?: HardwareTimingRole;
    boardResourceType?: HardwareBoardResourceType;
  }>;
  onSetMappingPin?: (rowId: string, pin: string) => void;
  onGoToHardware?: () => void;
  onGoToImport?: () => void;
  onGoToProject?: () => void;
  onGoToVerify?: () => void;
  onClearDiagnostic?: () => void;
  topHdl?: string;
  hdlSources?: readonly HdlSource[];
  onApplyHdl?: (hdl: string) => void;
  topEntityName?: string;
  hierarchy?: ProjectHierarchyDocument;
  onOpenModule?: (moduleId: string) => void;
  onCreateModuleFromSelection?: (input: CreateModuleInput) => CreateModuleResult | null;
  onPlaceModuleInstance?: (
    moduleId: string,
    position: { x: number; y: number },
    instanceName?: string,
  ) => Node | null;
  onRenameModuleInstance?: (nodeId: string, instanceName: string) => void;
  onDuplicateModuleDefinition?: (moduleId: string) => string | null;
  onDeleteModuleDefinition?: (moduleId: string) => boolean;
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
  externalDebugSignals?: Map<string, RuntimeLogicValue> | null;
  externalDebugTick?: number | null;
  externalDebugContext?: VerifyDebugContext | null;
  replaySession?: DesignReplaySession | null;
  replaySteps?: VerifyScenarioStep[] | null;
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
  sourceSession: DesignReplaySession | null;
}

type DesignReplaySession =
  Pick<RuntimeVerifyRun, 'waveform' | 'meta'> &
  Partial<Pick<RuntimeVerifyRun, 'report' | 'evidence'>>;

interface PaletteItem {
  type: string;
  title: string;
  category: ComponentDefinitionCategory;
  section: ComponentDesignPaletteSection;
  subtitle: string;
  glyph: string;
  searchTerms: string[];
  /** Sequential palette grouping (Design dock only). */
  sequentialTier?: 'registers' | 'timing' | 'legacy';
  /** Optional badge on the palette card (e.g. Native / Legacy). */
  paletteBadge?: string;
  /** Compact interface line rendered on the card (e.g. "A, B → Y"). */
  portSummary?: string;
  /** One port per line, surfaced through the card tooltip. */
  interfaceDetail?: string;
  /** Support chip when the part is not fully simulatable + exportable. */
  capabilityBadge?: string | null;
  /** Tooltip explanation for the capability chip. */
  capabilityTitle?: string | null;
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

const DESIGN_TOOLBAR_CUSTOMIZATION_OPTIONS: readonly {
  id: IdeCommandId;
  label: string;
}[] = [
  { id: IDE_COMMAND_IDS.selectDesignTool, label: 'Select tool' },
  { id: IDE_COMMAND_IDS.selectWireTool, label: 'Wire tool' },
  { id: IDE_COMMAND_IDS.undoDesignEdit, label: 'Undo' },
  { id: IDE_COMMAND_IDS.redoDesignEdit, label: 'Redo' },
  { id: IDE_COMMAND_IDS.arrangeDesign, label: 'Arrange circuit' },
  { id: IDE_COMMAND_IDS.fitDesignCanvas, label: 'Fit canvas' },
  { id: IDE_COMMAND_IDS.zoomOutDesignCanvas, label: 'Zoom out' },
  { id: IDE_COMMAND_IDS.zoomInDesignCanvas, label: 'Zoom in' },
];

const CANVAS_PLACEMENT_BLOCK_SELECTOR =
  '[data-blocks-canvas-placement="1"], [data-blocks-macro-placement="1"]';

const LIBRARY_COLLAPSED_SECTIONS_KEY = 'rb.ide.design.libraryCollapsed.v1';

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

function definitionToPaletteItem(definition: ComponentDefinition): PaletteItem {
  const facts = deriveLibraryCardFacts(definition);
  return {
    type: definition.runtimeType,
    title: definition.displayName,
    category: definition.category,
    section: definition.designPalette.section,
    subtitle: definition.description,
    glyph: definition.symbol,
    searchTerms: [...definition.searchTerms],
    sequentialTier: definition.designPalette.sequentialTier,
    paletteBadge: definition.designPalette.badge,
    portSummary: facts.portSummary,
    interfaceDetail: facts.interfaceDetail,
    capabilityBadge: facts.capabilityBadge,
    capabilityTitle: facts.capabilityTitle,
  };
}

// Built-in cards are a projection of ComponentDefinition. The registry omits
// the retired Sim Clock and unsupported Counter4Bit entries, while its current
// support capabilities decide which definitions are student-authorable.
const BUILTIN_PALETTE_ITEMS: readonly PaletteItem[] = COMPONENT_DEFINITION_REGISTRY.definitions
  .filter(
    (definition) =>
      definition.designPalette.authoringCapability.supported &&
      definition.designPalette.classroomCapability.supported
  )
  .map(definitionToPaletteItem);

const PALETTE_ITEMS = BUILTIN_PALETTE_ITEMS.filter((item) => item.section !== 'reusable');
const COMPOSITE_PALETTE_ITEMS = BUILTIN_PALETTE_ITEMS.filter(
  (item) => item.section === 'reusable'
);

const PALETTE_SECTION_ORDER: PaletteSectionDefinition[] = [
  {
    id: 'board',
    title: 'Board Resources',
    description:
      'Basys3 physical pins — place these to name your I/O signals directly from the board. Placing SW3 creates an input pin pre-configured as SW3; placing LD0 creates an output pin pre-configured as LD0. You will still assign board mappings in Board & Constraints.',
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
    description: 'Clock sources that drive sequential updates (map to board timing in Board & Constraints).',
    testId: 'ide-design-palette-sequential-timing',
  },
  {
    key: 'sequentialLegacy',
    title: 'Legacy primitives',
    description: 'Classic DFF for imports and tutorials — new work should start with Native registers.',
    testId: 'ide-design-palette-sequential-legacy',
  },
];

const BASYS3_DESIGN_BOARD_ITEMS = listBasys3DesignBoardResourceInventory({
  // RST is a logical authoring helper, not a Basys3 board resource. Keep it
  // only through the projection's explicit synthetic-non-board contract.
  includeSyntheticReset: true,
});

const BASYS3_INPUT_ITEMS: BoardIoPaletteItem[] = BASYS3_DESIGN_BOARD_ITEMS.filter(
  (item) => item.direction === 'in'
);

const BASYS3_OUTPUT_ITEMS: BoardIoPaletteItem[] = BASYS3_DESIGN_BOARD_ITEMS.filter(
  (item) => item.direction === 'out'
);

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
      description: 'Adds a pre-named input pin. Assign its board mapping in Board & Constraints.',
      entries: inputs.filter((entry) => entry.kind === 'switch'),
    },
    {
      id: 'buttons',
      title: 'Buttons (BTNC/U/L/R/D)',
      description: 'Adds a pre-named button input. Assign its board mapping in Board & Constraints.',
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
      description: 'Adds a pre-named output pin. Assign its board mapping in Board & Constraints.',
      entries: outputs.filter((entry) => entry.kind === 'led'),
    },
    {
      id: 'display',
      title: 'Seven Segment Display',
      description: 'Segment, digit-select, and decimal point outputs. Assign board mappings in Board & Constraints.',
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
  currentValue: RuntimeLogicValue | null;
  previousValue: RuntimeLogicValue | null;
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
  value: RuntimeLogicValue;
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
        whatItIs: 'Drives a test or board input into the schematic — Board & Constraints ties it to a physical switch or pin when you go to the board.',
        structureHint: null,
      };
    }
    if (node.type === 'OUTPUT' || node.type === 'Lamp') {
      return {
        partKind: 'Board I/O',
        whatItIs: 'Receives a net that should reach an LED or other board output; Board & Constraints assigns the Basys3 pin name.',
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
  projectId,
  projectName,
  onCircuitMutated,
  onRuntimeAddNode,
  onRuntimeAddIo,
  onRuntimeCreateBus,
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
  onSetMappingPin,
  onGoToHardware,
  onGoToImport,
  onGoToProject,
  onGoToVerify,
  onClearDiagnostic,
  topHdl,
  hdlSources = [],
  onApplyHdl,
  topEntityName,
  hierarchy,
  onOpenModule,
  onCreateModuleFromSelection,
  onPlaceModuleInstance,
  onRenameModuleInstance,
  onDuplicateModuleDefinition,
  onDeleteModuleDefinition,
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
  replaySteps,
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

  // ── Engineering-object continuity ──────────────────────────────────────
  // The schematic publishes its single-node selection to the workbench and
  // follows node/signal selections made elsewhere (Cases, Board, Package).
  const selectNodeInStore = useLogicViewStore((state) => state.selectNode);
  const globalSelected = useEngineeringSelection((state) => state.selected);
  const globalOrigin = useEngineeringSelection((state) => state.origin);
  const publishSelection = useEngineeringSelection((state) => state.select);
  const clearGlobalSelection = useEngineeringSelection((state) => state.clear);
  const relationshipIndex = useEngineeringRelationshipIndex();
  const schematicModuleId = hierarchy?.activeModuleId ?? TOP_MODULE_ID;
  useEffect(() => {
    if (selection.nodes.size === 1) {
      const nodeId = Array.from(selection.nodes)[0];
      const relation = schematicModuleId === TOP_MODULE_ID ? relationshipIndex.resolveNode(nodeId) : null;
      const next = relation
        ? { kind: 'signal' as const, fieldId: relation.fieldId, runSignal: relation.run?.resolution.runSignal ?? null, nodeId }
        : { kind: 'node' as const, moduleId: schematicModuleId, nodeId };
      if (globalSelected && JSON.stringify(globalSelected) === JSON.stringify(next)) return;
      publishSelection(next, 'schematic');
      return;
    }
    if (selection.nodes.size === 0 && globalOrigin === 'schematic' && globalSelected && (globalSelected.kind === 'node' || globalSelected.kind === 'signal')) {
      clearGlobalSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, schematicModuleId]);
  useEffect(() => {
    if (!globalSelected || globalOrigin === 'schematic') return;
    const nodeId =
      globalSelected.kind === 'node' && globalSelected.moduleId === schematicModuleId
        ? globalSelected.nodeId
        : globalSelected.kind === 'signal' && schematicModuleId === TOP_MODULE_ID
          ? globalSelected.nodeId ?? relationshipIndex.resolveField(globalSelected.fieldId)?.nodeId ?? null
          : null;
    if (!nodeId || !editorCircuit.nodes.some((node) => node.id === nodeId)) return;
    if (selection.nodes.size === 1 && selection.nodes.has(nodeId)) return;
    selectNodeInStore(nodeId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSelected, globalOrigin, schematicModuleId]);

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
  /**
   * Collapsed library sections persist per browser so a student's rail
   * arrangement survives reloads. Storage failures degrade to all-open.
   */
  const [collapsedLibrarySections, setCollapsedLibrarySections] = useState<ReadonlySet<string>>(
    () => {
      try {
        const raw = localStorage.getItem(LIBRARY_COLLAPSED_SECTIONS_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
      } catch {
        return new Set<string>();
      }
    }
  );
  const toggleLibrarySection = useCallback((sectionId: string) => {
    setCollapsedLibrarySections((previous) => {
      const next = new Set(previous);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      try {
        localStorage.setItem(LIBRARY_COLLAPSED_SECTIONS_KEY, JSON.stringify([...next]));
      } catch {
        // Storage-denied environments simply lose collapse persistence.
      }
      return next;
    });
  }, []);
  /** Keyboard navigation between library cards: Arrow/Home/End roving focus. */
  const handleLibraryRailKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const cards = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        'button.rb-lib-row, button.rb-lib-chip'
      )
    ).filter((card) => !card.disabled);
    if (cards.length === 0) return;
    const activeIndex = cards.findIndex((card) => card === document.activeElement);
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? cards.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(cards.length - 1, activeIndex + 1)
            : Math.max(0, activeIndex - 1);
    cards[nextIndex]?.focus();
  }, []);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [canvasHostElement, setCanvasHostElement] = useState<HTMLDivElement | null>(null);
  const bindCanvasHost = useCallback((element: HTMLDivElement | null) => {
    canvasHostRef.current = element;
    setCanvasHostElement((current) => (current === element ? current : element));
  }, []);
  const lastMeasuredCanvasViewportRef = useRef<DesignCanvasViewport | null>(null);
  const canvasObservationGenerationRef = useRef(0);
  const previousWireCountRef = useRef(editorCircuit.connections.length);
  const [canvasSize, setCanvasSize] = useState({ width: 880, height: 520 });
  const [paneRowSize, setPaneRowSize] = useState({ width: 0, height: 0 });
  // Model-driven semantic zoom: the canvas density tier follows the camera —
  // zoom out to read the whole design (legible `classroom`), zoom in to edit
  // closely (compact `dense`). Hysteresis (previous tier) prevents flicker.
  const semanticZoomTierRef = useRef<SemanticZoomTier>('dense');
  const presentationZoom: SemanticZoomTier = deriveSemanticZoomTier(
    camera.zoom,
    semanticZoomTierRef.current,
  );
  semanticZoomTierRef.current = presentationZoom;
  const [diagnosticsDialogOpen, setDiagnosticsDialogOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [wireFeedback, setWireFeedback] = useState<string | null>(null);
  const [focusedIssueSignalKey, setFocusedIssueSignalKey] = useState<string | null>(null);
  const [diagnosticFilterNodeId, setDiagnosticFilterNodeId] = useState<string | null>(null);
  const [tickEngine] = useState(() => new TickEngine(editorCircuit, { tickRate: 10 }));
  const workspacePreferences = useSyncExternalStore(
    workspacePreferencesStore.subscribe,
    workspacePreferencesStore.getSnapshot,
    workspacePreferencesStore.getSnapshot
  );
  const designView: 'canvas' | 'hdl' | 'split' =
    workspacePreferences.design.view === 'code'
      ? 'hdl'
      : workspacePreferences.design.view;
  const setDesignView = useCallback((view: 'canvas' | 'hdl' | 'split') => {
    workspacePreferencesStore.setDesignView(view === 'hdl' ? 'code' : view);
  }, []);
  const canvasAppearance = workspacePreferences.design.canvasAppearance;
  const canvasDensity = workspacePreferences.design.canvasDensity;
  const designLayers = workspacePreferences.design.layers;
  // Boundary buses, derived from signal identity: one bracket per NAME[i] family.
  const designBusGroups = useMemo<SchematicBusGroup[]>(() => {
    const groups = new Map<string, { name: string; direction: 'in' | 'out'; bits: { nodeId: string; bit: number }[] }>();
    for (const relation of relationshipIndex.signals) {
      if (!relation.bus) continue;
      const key = `${relation.direction}:${relation.bus.name}`;
      const group = groups.get(key) ?? { name: relation.bus.name, direction: relation.direction, bits: [] };
      group.bits.push({ nodeId: relation.nodeId, bit: relation.bus.bit });
      groups.set(key, group);
    }
    return Array.from(groups.values()).filter((group) => group.bits.length > 1);
  }, [relationshipIndex.signals]);
  const toolbarCommandIds = workspacePreferences.design.toolbarCommandIds;
  const toolbarCommandSet = useMemo(() => new Set(toolbarCommandIds), [toolbarCommandIds]);
  const toolbarVisible = useCallback(
    (commandId: IdeCommandId) => toolbarCommandSet.has(commandId),
    [toolbarCommandSet]
  );
  const toggleToolbarCommand = useCallback((commandId: IdeCommandId, visible: boolean) => {
    const current = workspacePreferencesStore.getSnapshot().design.toolbarCommandIds;
    const next = visible
      ? [...current, commandId]
      : current.filter((id) => id !== commandId);
    workspacePreferencesStore.setDesignToolbarCommandIds(next);
  }, []);
  const orderedToolbarGroupIds = useMemo(
    () => listDesignToolbarCommandGroupOrder(toolbarCommandIds),
    [toolbarCommandIds]
  );
  const toolbarGroupOrder = useMemo(
    () => new Map(orderedToolbarGroupIds.map((groupId, index) => [groupId, index + 1])),
    [orderedToolbarGroupIds]
  );
  const reorderToolbarGroup = useCallback(
    (groupId: DesignToolbarCommandGroupId, direction: 'up' | 'down') => {
      const current = workspacePreferencesStore.getSnapshot().design.toolbarCommandIds;
      workspacePreferencesStore.setDesignToolbarCommandIds(
        moveDesignToolbarCommandGroup(current, groupId, direction)
      );
    },
    []
  );
  const [activeLeftDockTab, setActiveLeftDockTab] = useState<
    'components' | 'hierarchy' | 'sources' | 'board'
  >('components');
  const [activeRightDockTab, setActiveRightDockTab] = useState<
    'inspector' | 'properties' | 'constraints'
  >('inspector');
  const [activeBottomDockTab, setActiveBottomDockTab] = useState<
    'problems' | 'console' | 'simulation'
  >('problems');
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
  const [moduleDialog, setModuleDialog] = useState<{
    analysis: ModuleSelectionAnalysis;
    moduleName: string;
    instanceName: string;
    portNames: Record<string, string>;
    error: string | null;
  } | null>(null);
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
  const [editingModuleInstanceId, setEditingModuleInstanceId] = useState<string | null>(null);
  const [moduleInstanceNameDraft, setModuleInstanceNameDraft] = useState('');

  // V-2: Fanin path tracer — highlights all wires/nodes feeding the clicked port
  const [traceState, setTraceState] = useState<DesignTraceState | null>(null);
  const [wireContextMenu, setWireContextMenu] = useState<DesignWireContextMenuState | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number } | null>(null);
  /** True when the label editor should float over the node on the canvas
   * (double-click, F2, context menu) instead of the inspector row. */
  const [renameOnCanvas, setRenameOnCanvas] = useState(false);
  const lastTracedPortRef = useRef<string | null>(null);
  const previousToolModeRef = useRef(toolMode);
  const previousHasSelectionRef = useRef(false);
  const suppressNextToolModeWireFeedbackClearRef = useRef(false);
  // Auto-trace refs: track which node was auto-traced and read traceState without dep
  const autoTracedNodeRef = useRef<string | null>(null);
  /** When set, traceState wire-net was auto-applied from a lone wire selection (clears on deselect / clear / non-wire trace). */
  const autoWireSelectionTraceIdRef = useRef<string | null>(null);
  /** Signal focus projected from a selected wire; clear only this owned focus when that wire selection ends. */
  const selectedWireSignalFocusRef = useRef<string | null>(null);
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
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<0.5 | 1 | 2>(1);
  const [designLearningMode, setDesignLearningMode] = useState<'edit' | 'live'>('edit');
  const runtimeSimTick = runtimeSim.tick;
  const simSpeed = runtimeSim.speedHz;
  const runtimeLiveSignals = useMemo(() => {
    const entries = Object.entries(runtimeSim.signals)
      .map(([key, value]) => [key, value] as const)
      .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
    const signals = new Map<string, RuntimeLogicValue>(entries);
    const connectedTargetNodeIds = new Set(
      editorCircuit.connections.map((connection) =>
        typeof connection.to === 'string' ? connection.to : connection.to.nodeId
      )
    );
    for (const node of editorCircuit.nodes) {
      if ((node.type === 'OUTPUT' || node.type === 'Lamp') && !connectedTargetNodeIds.has(node.id)) {
        signals.set(`${node.id}.in`, 'X');
        signals.set(`${node.id}.out`, 'X');
      }
    }
    return signals;
  }, [editorCircuit.connections, editorCircuit.nodes, runtimeSim.signals]);
  const replayTrace = useMemo(
    () => normalizeReplayWaveformTrace(replaySession?.waveform ?? []),
    [replaySession?.waveform]
  );
  const sequentialReplay = useMemo(
    () =>
      buildSequentialReplayModel({
        waveform: replaySession?.waveform ?? [],
        report: replaySession?.report ?? null,
        ioRows: replaySession?.evidence?.ioRows ?? null,
        steps: replaySteps,
        clockSignalName: replaySession?.meta.clockSignalName,
      }),
    [
      replaySession?.meta.clockSignalName,
      replaySession?.evidence?.ioRows,
      replaySession?.report,
      replaySession?.waveform,
      replaySteps,
    ]
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
    const mergedSignals = new Map<string, RuntimeLogicValue>(runtimeLiveSignals);
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
      mergedSignals.set(signalKey, value);
    }
    return mergedSignals;
  }, [effectiveExternalDebugSignals, effectiveExternalDebugTick, replayTickTraceIndex, replayTrace, runtimeLiveSignals]);
  const isReplayMode = effectiveExternalDebugTick != null;
  const effectiveLearningMode = isReplayMode ? 'replay' : designLearningMode;
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
    for (const node of editorCircuit.nodes) {
      if (index.has(node.id)) continue;
      const direction =
        node.type === 'INPUT' || node.type === 'Switch' || node.type === 'Clock'
          ? 'in'
          : node.type === 'OUTPUT' || node.type === 'Lamp'
            ? 'out'
            : null;
      if (!direction) continue;
      const nodeKeys = [node.id, node.label]
        .filter((value): value is string => typeof value === 'string')
        .map(normalizeIoPresentationMatchKey)
        .filter((value) => value.length >= 3);
      const inferredRow = ioRows.find((row) => {
        if (row.direction !== direction) return false;
        const rowKeys = [row.id, row.label]
          .filter((value): value is string => typeof value === 'string')
          .map(normalizeIoPresentationMatchKey)
          .filter((value) => value.length >= 3);
        return nodeKeys.some((nodeKey) =>
          rowKeys.some((rowKey) => nodeKey === rowKey || nodeKey.includes(rowKey) || rowKey.includes(nodeKey))
        );
      });
      if (inferredRow) index.set(node.id, inferredRow);
    }
    return index;
  }, [editorCircuit.nodes, ioRows]);

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
    setDesignLearningMode('edit');
  }, [
    clearTrace,
    endWire,
    onClearExternalDebug,
    onClearVerifyFocus,
    onRuntimeSimSetSelectedSignal,
  ]);
  const getChipMetadata = useCallback((nodeType: string, node?: Node): ChipMetadata | undefined => {
    const moduleDefinitionId = node && typeof node.config?.moduleDefinitionId === 'string'
      ? node.config.moduleDefinitionId
      : null;
    const nativeModule = hierarchy?.modules.find(
      (module) => module.id === moduleDefinitionId || module.name === nodeType,
    );
    if (nativeModule) {
      return {
        name: nativeModule.displayName,
        inputs: nativeModule.ports
          .filter((port) => port.direction === 'input')
          .map((port) => ({ id: port.name, name: port.name })),
        outputs: nativeModule.ports
          .filter((port) => port.direction === 'output')
          .map((port) => ({ id: port.name, name: port.name })),
        color: '#5b68d8',
        layer: 1,
      };
    }
    if (node) {
      return getDesignChipMetadataForNode(node) ?? getDesignChipMetadata(nodeType);
    }
    return getDesignChipMetadata(nodeType);
  }, [hierarchy]);

  const { setActiveBoardSignal } = useBoardSignal();
  const activeInsertionMacro = useMemo(
    () => macros.find((entry) => entry.id === activeMacroInsertionId) ?? null,
    [activeMacroInsertionId, macros]
  );
  const placementModeLabel = activeInsertionMacro?.name ?? pendingPlacement?.label ?? null;
  const starterNextAction =
    starterContext?.nextAction?.trim() ||
    'Inspect the scaffold on the canvas, then continue editing or move to Simulate.';
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

  const applySelectionPositions = useCallback(
    (positionById: Map<string, { x: number; y: number }>, toast: string) => {
      let didChange = false;
      const next = {
        ...circuit,
        nodes: circuit.nodes.map((node) => {
          const target = positionById.get(node.id);
          if (!target) return node;
          const current = { x: node.position?.x ?? 0, y: node.position?.y ?? 0 };
          if (current.x === target.x && current.y === target.y) return node;
          didChange = true;
          return { ...node, position: target };
        }),
      };
      if (!didChange) return;
      updateCircuit(next, { skipHistory: true, enforceLimits: true });
      setActionToast(toast);
      emitCircuitMutation(next);
    },
    [circuit, emitCircuitMutation, updateCircuit]
  );

  const handleAlignSelection = useCallback(
    (edge: 'left' | 'right' | 'h-center' | 'top' | 'bottom' | 'v-center') => {
      if (selection.nodes.size < 2) return;
      const selectedNodes = circuit.nodes.filter((node) => selection.nodes.has(node.id));
      if (selectedNodes.length < 2) return;

      const axis = edge === 'left' || edge === 'right' || edge === 'h-center' ? 'x' : 'y';
      const coordinates = selectedNodes.map((node) => node.position?.[axis] ?? 0);
      const minimum = Math.min(...coordinates);
      const maximum = Math.max(...coordinates);
      const target =
        edge === 'left' || edge === 'top'
          ? minimum
          : edge === 'right' || edge === 'bottom'
            ? maximum
            : (minimum + maximum) / 2;

      const positionById = new Map(
        selectedNodes.map((node) => {
          const current = { x: node.position?.x ?? 0, y: node.position?.y ?? 0 };
          return [node.id, axis === 'x' ? { x: target, y: current.y } : { x: current.x, y: target }] as const;
        })
      );
      const edgeLabel =
        edge === 'h-center' ? 'horizontal center' : edge === 'v-center' ? 'vertical center' : edge;
      applySelectionPositions(
        new Map(positionById),
        `Aligned ${selectedNodes.length} node${selectedNodes.length !== 1 ? 's' : ''} to the ${edgeLabel}.`
      );
    },
    [applySelectionPositions, circuit.nodes, selection.nodes]
  );

  const handleDistributeSelection = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      if (selection.nodes.size < 3) return;
      const selectedNodes = circuit.nodes.filter((node) => selection.nodes.has(node.id));
      if (selectedNodes.length < 3) return;

      const key = axis === 'horizontal' ? 'x' : 'y';
      const secondary = axis === 'horizontal' ? 'y' : 'x';
      const sortedNodes = [...selectedNodes].sort((left, right) => {
        const primaryDelta = (left.position?.[key] ?? 0) - (right.position?.[key] ?? 0);
        if (primaryDelta !== 0) return primaryDelta;
        const secondaryDelta = (left.position?.[secondary] ?? 0) - (right.position?.[secondary] ?? 0);
        if (secondaryDelta !== 0) return secondaryDelta;
        return left.id.localeCompare(right.id);
      });

      const first = sortedNodes[0]?.position?.[key] ?? 0;
      const last = sortedNodes[sortedNodes.length - 1]?.position?.[key] ?? 0;
      const step = (last - first) / (sortedNodes.length - 1);
      const positionById = new Map(
        sortedNodes.map((node, index) => {
          const current = { x: node.position?.x ?? 0, y: node.position?.y ?? 0 };
          const distributed = first + step * index;
          return [
            node.id,
            key === 'x' ? { x: distributed, y: current.y } : { x: current.x, y: distributed },
          ] as const;
        })
      );
      applySelectionPositions(
        new Map(positionById),
        `Distributed ${selectedNodes.length} node${selectedNodes.length !== 1 ? 's' : ''} ${axis === 'horizontal' ? 'horizontally' : 'vertically'}.`
      );
    },
    [applySelectionPositions, circuit.nodes, selection.nodes]
  );

  const handleDistributeSelectionHorizontally = useCallback(
    () => handleDistributeSelection('horizontal'),
    [handleDistributeSelection]
  );

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
        item.section,
        item.subtitle,
        ...item.searchTerms,
      ])
    );
    const sequential = filtered.filter((item) => item.section === 'sequential');
    return {
      logic: filtered.filter((item) => item.section === 'logic'),
      sequential,
      sequentialRegisters: sequential.filter((item) => item.sequentialTier === 'registers'),
      sequentialTiming: sequential.filter((item) => item.sequentialTier === 'timing'),
      sequentialLegacy: sequential.filter((item) => item.sequentialTier === 'legacy'),
      io: filtered.filter((item) => item.section === 'io'),
      components: filtered.filter((item) => item.section === 'reusable'),
    };
  }, [paletteQueryTerms]);
  const commonPaletteItems = useMemo(() => {
    if (paletteQueryTerms.length > 0) return [];
    const commonOrder = ['INPUT', 'OUTPUT', 'XOR', 'AND', 'OR', 'NOT', 'Register1'];
    const orderByType = new Map(commonOrder.map((type, index) => [type, index]));
    return [...PALETTE_ITEMS, ...COMPOSITE_PALETTE_ITEMS]
      .filter((item) => orderByType.has(item.type))
      .sort(
        (left, right) =>
          (orderByType.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
          (orderByType.get(right.type) ?? Number.MAX_SAFE_INTEGER)
      );
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

  // Bus authoring dialog: create a first-class vector boundary (A[3:0]) as
  // one durable action. Members land on the canvas and gain IO rows for Board.
  const [busDialog, setBusDialog] = useState<{
    direction: 'input' | 'output';
    name: string;
    width: number;
    error: string | null;
  } | null>(null);
  const openBusDialog = useCallback((direction: 'input' | 'output') => {
    setBusDialog({ direction, name: '', width: 4, error: null });
  }, []);
  const submitBusDialog = useCallback(() => {
    if (!busDialog || !onRuntimeCreateBus) {
      setBusDialog(null);
      return;
    }
    const center = {
      x: (canvasSize.width / 2 - camera.x) / camera.zoom,
      y: (canvasSize.height / 2 - camera.y) / camera.zoom,
    };
    const basePosition = findSmartSpawnPosition(editorCircuit.nodes as Node[], center);
    const outcome = onRuntimeCreateBus({
      name: busDialog.name.trim(),
      direction: busDialog.direction,
      width: busDialog.width,
      position: { x: basePosition.x, y: basePosition.y },
    });
    if (outcome.ok) {
      setBusDialog(null);
      setActionToast(
        `Created ${busDialog.name.trim()}[${Math.max(0, busDialog.width - 1)}:0] ${busDialog.direction} bus.`
      );
    } else {
      setBusDialog({ ...busDialog, error: outcome.error });
    }
  }, [busDialog, onRuntimeCreateBus, canvasSize.width, canvasSize.height, camera.x, camera.y, camera.zoom, editorCircuit]);

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

  /**
   * Palette drag-to-place. A press on a library card starts a potential drag;
   * moving past the threshold arms the same pendingPlacement pipeline the
   * click path uses, the ghost follows the pointer, and releasing over the
   * canvas commits through commitPendingPlacement (Shift keeps placing).
   * Releasing anywhere else cancels. A press-and-release without movement
   * stays a plain click, so the click-to-arm flow is unchanged.
   */
  const paletteDragRef = useRef<{
    spec:
      | { kind: 'node'; nodeType: string; label: string }
      | { kind: 'board-io'; entry: BoardIoPaletteItem; label: string };
    startX: number;
    startY: number;
    armed: boolean;
  } | null>(null);

  const beginPaletteCardDrag = useCallback(
    (
      event: React.PointerEvent,
      spec:
        | { kind: 'node'; nodeType: string; label: string }
        | { kind: 'board-io'; entry: BoardIoPaletteItem; label: string }
    ) => {
      if (event.button !== 0 || isReplayMode) return;
      paletteDragRef.current = {
        spec,
        startX: event.clientX,
        startY: event.clientY,
        armed: false,
      };
    },
    [isReplayMode]
  );

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = paletteDragRef.current;
      if (!drag) return;
      if (!drag.armed) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
        drag.armed = true;
        if (drag.spec.kind === 'node') {
          beginNodePlacement(drag.spec.nodeType);
        } else {
          beginBoardIoPlacement(drag.spec.entry);
        }
      }
      updatePlacementGhost(event.clientX, event.clientY);
    };
    const handleUp = (event: PointerEvent) => {
      const drag = paletteDragRef.current;
      paletteDragRef.current = null;
      if (!drag?.armed) return;
      const host = canvasHostRef.current;
      const rect = host?.getBoundingClientRect();
      const overCanvas =
        rect != null &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      const releaseTarget =
        typeof document.elementFromPoint === 'function'
          ? (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)
          : null;
      if (overCanvas && !isCanvasPlacementBlocked(releaseTarget)) {
        commitPendingPlacement(event.clientX, event.clientY, { keepPlacing: event.shiftKey });
      } else {
        cancelPendingPlacement('cancel');
      }
    };
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [
    beginBoardIoPlacement,
    beginNodePlacement,
    cancelPendingPlacement,
    commitPendingPlacement,
    updatePlacementGhost,
  ]);

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
      const normalizedCircuit = normalizeCircuitForCanvas(nextCircuit);
      updateCircuit(normalizedCircuit, {
        skipHistory: true,
        enforceLimits: true,
      });
      // Live input toggles are exploratory runtime state, not authored circuit
      // mutations. Keeping their canvas state local avoids invalidating a
      // current Verify run or reinitializing the sequential simulator.
      if (effectiveLearningMode === 'live') {
        return;
      }
      if (!opts?.isIntermediate) {
        emitCircuitMutation(normalizedCircuit);
      }
      lastTracedPortRef.current = null;
      setTraceState(null);
      setWireContextMenu(null);
      setWireFeedback(null);
    },
    [effectiveLearningMode, emitCircuitMutation, updateCircuit]
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
    return readDesignCanvasViewport(canvasHostRef.current.clientWidth, canvasHostRef.current.clientHeight);
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
    const bounds = unionBounds(buildGeometryIndex(editorCircuit.nodes as Node[]).values());
    if (!bounds) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const FIT_MARGIN = 48;
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const zoomX = (viewport.width - FIT_MARGIN * 2) / boundsWidth;
    const zoomY = (viewport.height - FIT_MARGIN * 2) / boundsHeight;
    // Continuous fit: fill the sheet inside the margin, floored so a large design stays
    // legible and capped so a small one does not balloon. Zoom in/out still steps.
    const nextZoom = Math.round(Math.max(0.35, Math.min(1.6, Math.min(zoomX, zoomY))) * 100) / 100;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    setCamera({
      x: viewport.width / 2 - centerX * nextZoom,
      y: viewport.height / 2 - centerY * nextZoom,
      zoom: nextZoom,
    });
  }, [canvasSize, editorCircuit.nodes, measureCanvasViewport, setCamera]);

  const fitToCircuitRef = useRef(fitToCircuit);
  const previousDesignViewRef = useRef(designView);
  useEffect(() => { fitToCircuitRef.current = fitToCircuit; }, [fitToCircuit]);

  const handleArrangeCircuit = useCallback(() => {
    if (editorCircuit.nodes.length < 2) {
      setActionToast('Place at least two parts before arranging.');
      return;
    }
    const next = arrangeCircuitByDependency(editorCircuit);
    updateCircuit(next, { skipHistory: true, enforceLimits: true });
    clearSelection();
    clearTrace();
    emitCircuitMutation(next);
    setActionToast(`Arranged ${next.nodes.length} parts by signal flow. Undo restores the previous layout.`);
    window.requestAnimationFrame(() => fitToCircuitRef.current());
  }, [clearSelection, clearTrace, editorCircuit, emitCircuitMutation, updateCircuit]);

  const cameraGraphAnchors = useMemo<DesignCanvasGraphAnchor[]>(
    () => editorCircuit.nodes.map((node) => ({
      x: node.position?.x ?? node.x ?? 0,
      y: node.position?.y ?? node.y ?? 0,
    })),
    [editorCircuit.nodes]
  );
  const cameraGraphAnchorsRef = useRef(cameraGraphAnchors);
  cameraGraphAnchorsRef.current = cameraGraphAnchors;

  useLayoutEffect(() => {
    if (!canvasHostElement) return;
    const generation = canvasObservationGenerationRef.current + 1;
    canvasObservationGenerationRef.current = generation;
    let active = true;
    let pendingFrame: number | null = null;
    let pendingViewport: DesignCanvasViewport | null = null;

    const commitViewport = (nextViewport: DesignCanvasViewport) => {
      if (
        !active ||
        canvasObservationGenerationRef.current !== generation ||
        canvasHostRef.current !== canvasHostElement
      ) {
        return;
      }
      const previousViewport = lastMeasuredCanvasViewportRef.current;
      if (
        previousViewport?.width === nextViewport.width &&
        previousViewport.height === nextViewport.height
      ) {
        return;
      }
      lastMeasuredCanvasViewportRef.current = nextViewport;
      setCanvasSize(nextViewport);
      if (!previousViewport) return;

      const currentCamera = useLogicViewStore.getState().camera;
      const reconciledCamera = reconcileDesignCanvasCamera(
        currentCamera,
        previousViewport,
        nextViewport,
        cameraGraphAnchorsRef.current
      );
      if (reconciledCamera) {
        setCamera(reconciledCamera);
      } else {
        fitToCircuitRef.current(nextViewport);
      }
    };

    const queueViewport = (width: number, height: number) => {
      const nextViewport = readDesignCanvasViewport(width, height);
      if (!nextViewport) return;
      pendingViewport = nextViewport;
      if (pendingFrame != null) return;
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = null;
        const latestViewport = pendingViewport;
        pendingViewport = null;
        if (latestViewport) commitViewport(latestViewport);
      });
    };

    const initialViewport = readDesignCanvasViewport(
      canvasHostElement.clientWidth,
      canvasHostElement.clientHeight
    );
    if (initialViewport) commitViewport(initialViewport);
    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === canvasHostElement) ?? entries[0];
      if (!entry) return;
      queueViewport(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvasHostElement);
    return () => {
      active = false;
      canvasObservationGenerationRef.current += 1;
      if (pendingFrame != null) window.cancelAnimationFrame(pendingFrame);
      observer.disconnect();
    };
  }, [canvasHostElement, setCamera]);

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

  /** Return to 100% while keeping the world point at the viewport center fixed. */
  const zoomTo100 = useCallback(() => {
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    const worldX = (centerX - camera.x) / camera.zoom;
    const worldY = (centerY - camera.y) / camera.zoom;
    setCamera({ x: centerX - worldX, y: centerY - worldY, zoom: 1 });
  }, [camera.x, camera.y, camera.zoom, canvasSize.height, canvasSize.width, setCamera]);

  useEffect(() => {
    const onIdeCommand = (event: Event) => {
      const commandId = (event as CustomEvent<{ commandId?: string }>).detail?.commandId;
      if (commandId === IDE_COMMAND_IDS.arrangeDesign) handleArrangeCircuit();
      else if (commandId === IDE_COMMAND_IDS.fitDesignCanvas) fitToCircuit();
      else if (commandId === IDE_COMMAND_IDS.zoomInDesignCanvas) zoomIn();
      else if (commandId === IDE_COMMAND_IDS.zoomOutDesignCanvas) zoomOut();
    };
    window.addEventListener(IDE_COMMAND_EVENT_NAME, onIdeCommand);
    return () => window.removeEventListener(IDE_COMMAND_EVENT_NAME, onIdeCommand);
  }, [fitToCircuit, handleArrangeCircuit, zoomIn, zoomOut]);

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
    const targetZoom = Math.max(0.85, camera.zoom);
    const anchorsFor = (nodes: typeof editorCircuit.nodes) =>
      nodes.map((node) => ({
        x: node.position?.x ?? node.x ?? 0,
        y: node.position?.y ?? node.y ?? 0,
      }));
    const nextCamera = centerDesignSelectionWithContext(
      { ...camera, zoom: targetZoom },
      canvasSize,
      anchorsFor(selectedNodes),
      anchorsFor(editorCircuit.nodes)
    );
    if (!nextCamera) return;
    setCamera(nextCamera);
    setActionToast(
      selectedNodes.length === 1
        ? 'Centered selected node with circuit context.'
        : `Centered ${selectedNodes.length} selected nodes with circuit context.`
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
    const previousView = previousDesignViewRef.current;
    previousDesignViewRef.current = designView;
    if (previousView === 'split' || designView !== 'split') return;
    setSelectMode();
  }, [designView, setSelectMode]);

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
  // Related… follows the selected boundary signal into its other representations.
  const designRelated = selectedNode ? relationshipIndex.resolveNode(selectedNode.id) : null;
  // Failing checks of the current replay, as schematic nodes. A stale replay
  // (the design changed since) draws nothing: the failure may no longer exist.
  const replayMismatchNodeIds = useMemo(() => {
    const rows = replaySession?.report?.rows ?? [];
    if (rows.length === 0 || staleReplayBreadcrumb) return null;
    const nodeIds = new Set<string>();
    for (const row of rows) {
      if (row.status !== 'fail') continue;
      const relation = relationshipIndex.resolveRunSignal(row.signal) ?? relationshipIndex.resolveField(row.signal);
      if (relation?.nodeId) nodeIds.add(relation.nodeId);
    }
    return nodeIds.size > 0 ? nodeIds : null;
  }, [relationshipIndex, replaySession?.report?.rows, staleReplayBreadcrumb]);

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

  const openModuleDialog = useCallback(() => {
    const analysis = analyzeModuleSelection(
      editorCircuit,
      selectedNodeIdsAll,
      hierarchy?.modules.map((module) => module.name) ?? [],
    );
    const nextNumber = (hierarchy?.modules.length ?? 0) + 1;
    const moduleName = `LogicBlock${nextNumber}`;
    setModuleDialog({
      analysis,
      moduleName,
      instanceName: `u_logic_block_${nextNumber}`,
      portNames: Object.fromEntries(
        [...analysis.inputs, ...analysis.outputs].map((port) => [port.id, port.suggestedName]),
      ),
      error: analysis.errors[0] ?? null,
    });
  }, [editorCircuit, hierarchy?.modules, selectedNodeIdsAll]);

  const confirmCreateModule = useCallback(() => {
    if (!moduleDialog || !onCreateModuleFromSelection || !moduleDialog.analysis.ok) return;
    try {
      const created = onCreateModuleFromSelection({
        moduleName: moduleDialog.moduleName,
        instanceName: moduleDialog.instanceName,
        selectedNodeIds: moduleDialog.analysis.selectedNodeIds,
        portNames: moduleDialog.portNames,
      });
      if (!created) {
        setModuleDialog((current) => current ? { ...current, error: 'The module could not be created.' } : current);
        return;
      }
      setModuleDialog(null);
      clearSelection();
      setSavedComponentToast(created.definition.displayName);
      setActionToast(`Created ${created.definition.displayName} and replaced the selection with ${readInstanceName(created.instance)}.`);
      if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
      savedToastTimerRef.current = setTimeout(() => setSavedComponentToast(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The module could not be created.';
      setModuleDialog((current) => current ? { ...current, error: message } : current);
    }
  }, [clearSelection, moduleDialog, onCreateModuleFromSelection]);

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
    if (!selectedNode) {
      setActiveBoardSignal(null);
      return;
    }
    const row = ioRowByNodeId.get(selectedNode.id) ?? ioRowByNodeId.get(`${selectedNode.id}.out`);
    setActiveBoardSignal(resolveBoardSignal(row?.pin));
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
  const problemsLedgerCount = useEngineeringProblems(selectProblemCount);
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
  const hasRunnablePath = useMemo(
    () => hasRunnableBoundaryPath(editorCircuit),
    [editorCircuit]
  );
  const blankWorkflowResetAppliedRef = useRef(false);
  useEffect(() => {
    if (editorCircuit.nodes.length !== 0) {
      blankWorkflowResetAppliedRef.current = false;
      return;
    }
    if (blankWorkflowResetAppliedRef.current) return;
    blankWorkflowResetAppliedRef.current = true;
    clearSelection();
    clearTrace();
    onRuntimeSimSetSelectedSignal?.(null);
    onClearVerifyFocus?.();
    onClearExternalDebug?.();
    setDesignLearningMode('edit');
  }, [
    clearSelection,
    clearTrace,
    editorCircuit.nodes.length,
    onClearExternalDebug,
    onClearVerifyFocus,
    onRuntimeSimSetSelectedSignal,
  ]);
  const zoomPercent = Math.round(camera.zoom * 100);
  const effectiveInteractionMode = isPlacementMode && interactionMode === 'idle' ? 'placing' : interactionMode;
  const wireSourceLabel = wireStartPort
    ? describePortRefForStudents(editorCircuit, wireStartPort, getChipMetadata)
    : null;
  const toolHint =
    effectiveInteractionMode === 'boxSelecting'
      ? 'Drag to marquee-select multiple nodes. Hold Ctrl/Cmd or Shift to add to selection.'
      : isPlacementMode && placementModeLabel
        ? `Click to place ${placementModeLabel}. Hold Shift to keep placing. Esc cancels.`
        : toolMode === 'wire'
          ? wireStartPort
            ? 'Compatible destination ports glow green. Click one to connect; Esc cancels.'
            : 'Click a square output port on a part\'s right edge, then a green input port on the left edge.'
        : 'Select a part to edit its signal name and actions in the inspector; drag the part to move it.';
  const cancelActiveWire = useCallback(() => {
    endWire();
    setWireFeedback(null);
  }, [endWire]);
  const handleWireModePointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (toolMode !== 'wire' || isPlacementMode || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-port-id], [data-wire-id], button, input, select, textarea')) return;

      // A near miss should not move a part, start a marquee, or shift the camera.
      // Keep an active source armed so the student can simply try the enlarged target again.
      event.preventDefault();
      event.stopPropagation();
      setWireFeedback(
        wireStartPort
          ? 'No destination port selected. The source is still active; click a green square port.'
          : 'No port selected. Click a square port on a part edge to start the wire.'
      );
    },
    [isPlacementMode, toolMode, wireStartPort]
  );

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
    setRenameOnCanvas(false);
  }, [editingLabelNodeId, emitCircuitMutation, labelDraft, updateNode]);

  const cancelNodeLabel = useCallback(() => {
    setEditingLabelNodeId(null);
    setLabelDraft('');
    setRenameOnCanvas(false);
  }, []);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitNodeLabel(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelNodeLabel(); }
  }, [commitNodeLabel, cancelNodeLabel]);
  const beginNodeLabelEdit = useCallback((node: Node, location: 'inspector' | 'canvas' = 'inspector') => {
    setEditingLabelNodeId(node.id);
    setLabelDraft(node.label ?? '');
    setRenameOnCanvas(location === 'canvas');
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
  const activeSequentialReplayFrame = useMemo(
    () =>
      debugTickIndex == null || replaySession?.meta.circuitKind !== 'sequential'
        ? null
        : sequentialReplay.frameAt(debugTickIndex),
    [debugTickIndex, replaySession?.meta.circuitKind, sequentialReplay]
  );
  const previousReplayEventIndex =
    debugTickIndex == null
      ? null
      : findPreviousReplayIndex(sequentialReplay.eventSampleIndexes, debugTickIndex);
  const nextReplayEventIndex =
    debugTickIndex == null
      ? null
      : findNextReplayIndex(sequentialReplay.eventSampleIndexes, debugTickIndex);
  const previousReplayTransitionIndex =
    debugTickIndex == null
      ? null
      : findPreviousReplayIndex(sequentialReplay.transitionSampleIndexes, debugTickIndex);
  const nextReplayTransitionIndex =
    debugTickIndex == null
      ? null
      : findNextReplayIndex(sequentialReplay.transitionSampleIndexes, debugTickIndex);
  const selectReplayIndex = useCallback(
    (index: number | null) => {
      if (index == null) return;
      setReplayPlaying(false);
      onSelectDebugTickIndex?.(index);
    },
    [onSelectDebugTickIndex]
  );
  useEffect(() => {
    if (!replayPlaying || !canRenderReplayScrubber || !onSelectDebugTickIndex) return;
    const interval = window.setInterval(() => {
      if (debugTickIndex == null || debugTickCount == null) {
        setReplayPlaying(false);
        return;
      }
      const nextIndex = findNextReplayIndex(
        sequentialReplay.eventSampleIndexes,
        debugTickIndex
      );
      if (nextIndex == null) {
        setReplayPlaying(false);
        return;
      }
      onSelectDebugTickIndex(nextIndex);
    }, Math.round(700 / replaySpeed));
    return () => window.clearInterval(interval);
  }, [
    canRenderReplayScrubber,
    debugTickCount,
    debugTickIndex,
    onSelectDebugTickIndex,
    replayPlaying,
    replaySpeed,
    sequentialReplay.eventSampleIndexes,
  ]);
  useEffect(() => {
    if (!isReplayMode) setReplayPlaying(false);
  }, [isReplayMode]);
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
      ? 'Replay invalidated. Resume live edits or return to Simulate for a fresh waveform.'
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
  const topAuthoringIssueNode = topAuthoringIssue
    ? editorCircuit.nodes.find((node) => node.id === topAuthoringIssue.nodeId) ?? null
    : null;
  const topAuthoringIssueLabel = topAuthoringIssue
    ? ioRowByNodeId.get(topAuthoringIssue.nodeId)?.label ||
      topAuthoringIssueNode?.label ||
      topAuthoringIssue.nodeId
    : null;
  const primaryCompilerDiagnostic =
    compilerDiagnostics.find((diagnostic) => diagnostic.severity === 'error') ??
    compilerDiagnostics[0] ??
    null;
  const primaryDesignIssueSummary = primaryCompilerDiagnostic
    ? `${primaryCompilerDiagnostic.title}: ${primaryCompilerDiagnostic.message}`
    : topAuthoringIssue
      ? `${topAuthoringIssue.title}${topAuthoringIssueLabel ? ` on ${topAuthoringIssueLabel}` : ''}. ${topAuthoringIssue.message} ${topAuthoringIssue.hint}`
      : null;
  const totalAuthoringErrors = authoringIssueCounts.errorCount + compilerErrorCount;
  const totalAuthoringWarnings = authoringIssueCounts.warningCount + compilerWarningCount;
  const logicalInputCount = ioRows.filter((row) => row.direction === 'in').length;
  const logicalOutputCount = ioRows.filter((row) => row.direction === 'out').length;
  const hasLogicalIoBoundary = logicalInputCount > 0 && logicalOutputCount > 0;
  const designStructureReady =
    editorCircuit.nodes.length > 0 && hasLogicalIoBoundary && totalAuthoringErrors === 0;
  const authoringStatusLabel =
    totalAuthoringErrors > 0
      ? 'Blocking circuit issue'
      : editorCircuit.nodes.length === 0
        ? 'Empty canvas'
        : !hasLogicalIoBoundary
          ? 'Add circuit I/O'
          : totalAuthoringWarnings > 0 || authoringIssueCounts.draftCount > 0
            ? 'Review wiring'
            : 'Clean';
  const designCommandTone: 'idle' | 'ok' | 'warn' | 'error' =
    totalAuthoringErrors > 0
      ? 'error'
      : !designStructureReady || totalAuthoringWarnings > 0 || authoringIssueCounts.draftCount > 0
        ? 'warn'
        : 'ok';
  const designCommandDescription = totalAuthoringErrors > 0 && primaryDesignIssueSummary
    ? `${primaryDesignIssueSummary} Repair this Design blocker before Simulate or Build & Export.`
    : effectiveExternalDebugTick != null
      ? 'Replay focus is active below. Scrub cases and inspect propagation before resuming live edits.'
      : activeVerifySignal
        ? `Build the circuit while keeping Verify focus on ${activeVerifySignal}.`
        : designView === 'hdl'
          ? `Edit ${primaryArtifactLabel} while keeping the circuit aligned with live propagation.`
          : designView === 'split'
            ? `Compare the circuit against ${primaryArtifactLabel} before moving into Simulate.`
            : 'Build the circuit and inspect live propagation before moving into Simulate.';
  const ioPresentationMap = useMemo(() => {
    const map: Record<string, NodeIoPresentation> = {};
    const exposesBoardAssignments = !hierarchy || hierarchy.activeModuleId === TOP_MODULE_ID;
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
      const presentation = resolveNodeIoPresentation(node, ioRowByNodeId.get(node.id));
      map[node.id] = exposesBoardAssignments
        ? presentation
        : { ...presentation, pinAlias: undefined };
    }
    return map;
  }, [editorCircuit.nodes, hierarchy, ioRowByNodeId]);
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
  const hasDesignDiagnostics =
    compilerErrorCount > 0 || compilerWarningCount > 0 || diagnosticsDrawerRows.length > 0;
  const isCanvasWorkspace = workspacePreset.mode === 'canvas';
  const isCodeWorkspace = workspacePreset.mode === 'hdl';
  const isSplitWorkspace = workspacePreset.mode === 'split';
  const showSplitCanvasContext = isSplitWorkspace && effectiveDesignView === 'split';
  const showSimulationStrip = workspacePreset.showSimulationStrip;
  const hasMeaningfulSimulationStory =
    showSimulationStrip &&
    (showSimulationSummary || isReplayMode || staleReplayBreadcrumb != null || simulationStory.clockEvent != null);
  const hasMeaningfulSplitRuntimeContext =
    isSplitWorkspace &&
    !showSimulationStrip &&
    (simRunning || simTick > 0 || runtimeSim.trace.length > 1);
  const isSelectionOwnedWireTrace =
    traceState?.kind === 'wire-net' &&
    autoWireSelectionTraceIdRef.current != null &&
    traceState.sourceKey === autoWireSelectionTraceIdRef.current;
  const showRuntimeStatus =
    hasMeaningfulSimulationStory ||
    (traceState != null && !isSelectionOwnedWireTrace) ||
    hasMeaningfulSplitRuntimeContext;
  const showWorkspaceStatusBar =
    totalAuthoringErrors > 0 ||
    totalAuthoringWarnings > 0 ||
    authoringIssueCounts.draftCount > 0 ||
    liveHdlResult.error != null ||
    showRuntimeStatus;
  const designStatusNote =
    liveHdlResult.error != null
      ? `HDL generation failed: ${liveHdlResult.error}`
      : primaryDesignIssueSummary;
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
  const designHierarchy = useMemo(
    () =>
      deriveDesignHierarchy({
        topModule: {
          id: projectId?.trim() || topEntityName?.trim() || 'top',
          name: topEntityName?.trim() || 'top',
        },
        circuit: editorCircuit,
        customComponents: customComponentDefs,
        selectedNodeId: selectedNode?.id ?? null,
      }),
    [customComponentDefs, editorCircuit, projectId, selectedNode?.id, topEntityName]
  );
  const designHierarchyRows = useMemo(
    () => flattenDesignHierarchy(designHierarchy.root),
    [designHierarchy]
  );
  /** Which instance a definition was entered through, for breadcrumb context. */
  const [drilledInstance, setDrilledInstance] = useState<{ moduleId: string; instanceName: string } | null>(null);
  const activeModuleKey = hierarchy?.activeModuleId ?? TOP_MODULE_ID;
  useEffect(() => {
    setDrilledInstance((current) =>
      current && current.moduleId !== activeModuleKey ? null : current
    );
  }, [activeModuleKey]);

  /**
   * Per-hierarchy-location camera memory: leaving a module stores its camera,
   * returning restores it, and a first visit frames the module's content.
   */
  const moduleCameraMemoryRef = useRef(new Map<string, { x: number; y: number; zoom: number }>());
  const lastCameraLocationRef = useRef<string | null>(null);
  const restoreCameraForLocationRef = useRef<() => void>(() => {});
  restoreCameraForLocationRef.current = () => {
    const stored = moduleCameraMemoryRef.current.get(activeModuleKey);
    if (stored) {
      setCamera(stored);
    } else {
      fitToCircuit();
    }
  };
  useEffect(() => {
    const previous = lastCameraLocationRef.current;
    if (previous !== null && previous !== activeModuleKey) {
      moduleCameraMemoryRef.current.set(previous, useLogicViewStore.getState().camera);
      restoreCameraForLocationRef.current();
    }
    lastCameraLocationRef.current = activeModuleKey;
  }, [activeModuleKey]);

  const activeNativeModule = useMemo(
    () => hierarchy?.modules.find((module) => module.id === hierarchy.activeModuleId) ?? null,
    [hierarchy],
  );
  const isEditingTopModule = !hierarchy || hierarchy.activeModuleId === TOP_MODULE_ID;
  const designSources = useMemo(
    () =>
      deriveDesignSources({
        topModule: {
          id: projectId?.trim() || topEntityName?.trim() || 'top',
          name: topEntityName?.trim() || 'top',
        },
        circuit: editorCircuit,
        customComponents: customComponentDefs,
        hdlSources,
      }),
    [customComponentDefs, editorCircuit, hdlSources, projectId, topEntityName]
  );
  const selectedBoardResource = useMemo(
    () =>
      selectedNodeIoRow
        ? getBasys3BoardResource(selectedNodeIoRow.pin)
        : null,
    [selectedNodeIoRow]
  );
  const selectedBoardResourceOptions = useMemo(() => {
    if (!selectedNodeIoRow) return [];
    const compatibleResources = listBasys3CompatibleResources(selectedNodeIoRow);
    if (
      selectedBoardResource &&
      !compatibleResources.some((resource) => resource.id === selectedBoardResource.id)
    ) {
      compatibleResources.unshift(selectedBoardResource);
    }
    return compatibleResources.sort((left, right) =>
      left.alias.localeCompare(right.alias, 'en-US', { numeric: true })
    );
  }, [selectedBoardResource, selectedNodeIoRow]);
  const selectedBoardResourceCompatible = useMemo(
    () =>
      Boolean(
        selectedNodeIoRow &&
          selectedBoardResource &&
          isBasys3ResourceCompatibleWithSignal(selectedBoardResource, selectedNodeIoRow)
      ),
    [selectedBoardResource, selectedNodeIoRow]
  );
  const componentDefinitionRegistry = useMemo(
    () => createComponentDefinitionRegistry(customComponentDefs),
    [customComponentDefs]
  );
  const selectedComponentDefinition = useMemo(
    () => selectedNode ? componentDefinitionRegistry.getByRuntimeType(selectedNode.type) : undefined,
    [componentDefinitionRegistry, selectedNode]
  );
  const selectedNativeModule = useMemo(() => {
    if (!selectedNode || !hierarchy) return null;
    const moduleId = typeof selectedNode.config?.moduleDefinitionId === 'string'
      ? selectedNode.config.moduleDefinitionId
      : null;
    return hierarchy.modules.find((module) => module.id === moduleId || module.name === selectedNode.type) ?? null;
  }, [hierarchy, selectedNode]);
  const selectedBoardConflict = useMemo(() => {
    if (!selectedNodeIoRow || !selectedBoardResource) return null;
    return (
      ioRows.find((row) => {
        if (row.id === selectedNodeIoRow.id || !row.pin) return false;
        return getBasys3BoardResource(row.pin)?.packagePin === selectedBoardResource.packagePin;
      }) ?? null
    );
  }, [ioRows, selectedBoardResource, selectedNodeIoRow]);
  const handleHierarchyOpen = useCallback(
    (nodeId: string | null, depth: number, componentType?: string) => {
      setDesignView('canvas');
      if (!nodeId) {
        clearSelection();
        return;
      }
      if (depth === 1) {
        selectMultipleNodes([nodeId], false);
        setActiveRightDockTab('inspector');
        return;
      }
      // Native module rows can actually enter the definition; only legacy
      // composite rows without a module counterpart stay inspect-only.
      const nativeModule = componentType
        ? hierarchy?.modules.find(
            (module) => module.name === componentType || module.displayName === componentType
          )
        : undefined;
      if (nativeModule && onOpenModule) {
        onOpenModule(nativeModule.id);
        return;
      }
      setPaletteQuery(componentType ?? '');
      setActiveLeftDockTab('components');
      setActionToast('Opened the matching custom definition in Components. Nested definitions remain inspect-only.');
    },
    [clearSelection, hierarchy, onOpenModule, selectMultipleNodes, setDesignView]
  );
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
        className={`rb-insp-sel-issues is-${issueTone}`}
        data-testid="ide-design-selection-issues"
      >
        <div className="rb-insp-sel-issues-header">
          <span className={`rb-insp-sel-issues-pill is-${issueTone}`}>
            {primaryIssue.severity === 'error'
              ? 'Error'
              : primaryIssue.severity === 'warn'
                ? 'Warn'
                : 'Draft'}
          </span>
          <strong data-testid="ide-design-selection-issue-title">{primaryIssue.title}</strong>
        </div>
        <p className="rb-insp-sel-issues-message" data-testid="ide-design-selection-issue-message">
          {primaryIssue.message}
        </p>
        <p className="rb-insp-sel-issues-hint" data-testid="ide-design-selection-issue-hint">
          {primaryIssue.hint}
        </p>
        {selectionAuthoringIssues.length > 1 ? (
          <ul className="rb-insp-sel-issues-list">
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
  const renderNodeLabelEditor = (node: Node) => (
    <div className="ide-design-label-editor" data-testid="ide-design-label-editor">
      {editingLabelNodeId === node.id && !renameOnCanvas ? (
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

  const focusSelectedPath = useCallback(() => {
    const nodeId = selectedNode?.id ?? selectedWireContext?.targetNodeId ?? null;
    if (!nodeId) return;
    // Driver = what drives this node (its fan-in cone). Loads is the fan-out trace.
    const fanin = getFaninCone(editorCircuit, nodeId);
    const nodeIds = new Set([...fanin.nodeIds, nodeId]);
    const wireIds = new Set([...fanin.wireIds]);
    if (selectedWireContext) wireIds.add(selectedWireContext.wireId);
    const wireHighlights = new Map<string, string[]>();
    wireIds.forEach((wireId) => wireHighlights.set(wireId, ['#fbbf24']));
    setTraceState({
      kind: 'fanin-port',
      sourceKey: `path:${nodeId}`,
      label: `Focused path · ${
        selectedNode
          ? describeEndpointLabel(nodeId, selectedNode, ioRowByNodeId.get(nodeId))
          : selectedWireContext?.targetLabel ?? nodeId
      }`,
      signalKey: selectedWireContext?.signalKey ?? `${nodeId}.${preferredNodeTracePort ?? 'out'}`,
      wireHighlights,
      nodeIds,
      portKeys: buildTracePortKeySet(wireIds),
    });
    setWireContextMenu(null);
    setActionToast('Focused the selected signal path. Unrelated logic is dimmed.');
  }, [
    editorCircuit,
    ioRowByNodeId,
    preferredNodeTracePort,
    selectedNode,
    selectedWireContext,
  ]);

  useEffect(() => {
    if (!wireContextMenu && !nodeContextMenu && !canvasContextMenu) return;
    const closeAllMenus = () => {
      setWireContextMenu(null);
      setNodeContextMenu(null);
      setCanvasContextMenu(null);
    };
    const handlePointerDown = () => closeAllMenus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAllMenus();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canvasContextMenu, nodeContextMenu, wireContextMenu]);

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
    if (selectedWireSignalKey) {
      selectedWireSignalFocusRef.current = selectedWireSignalKey;
      if (
        runtimeSim.selectedSignalKey !== selectedWireSignalKey &&
        !verifyLinkedSignalKey &&
        !debugLinkedSignalKey
      ) {
        onRuntimeSimSetSelectedSignal(selectedWireSignalKey);
      }
      return;
    }

    const ownedSignalKey = selectedWireSignalFocusRef.current;
    if (!ownedSignalKey) return;
    selectedWireSignalFocusRef.current = null;
    if (
      runtimeSim.selectedSignalKey === ownedSignalKey &&
      !verifyLinkedSignalKey &&
      !debugLinkedSignalKey
    ) {
      onRuntimeSimSetSelectedSignal(null);
    }
  }, [
    debugLinkedSignalKey,
    onRuntimeSimSetSelectedSignal,
    runtimeSim.selectedSignalKey,
    selectedWireSignalKey,
    verifyLinkedSignalKey,
  ]);

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

      // F2: rename the single selected node in place on the canvas.
      if (event.key === 'F2' && !isTextInput && !event.defaultPrevented) {
        const liveSelection = useLogicViewStore.getState().selection;
        if (liveSelection.nodes.size === 1) {
          const nodeId = [...liveSelection.nodes][0];
          const liveNode = useCircuitStore.getState().circuit.nodes.find((n) => n.id === nodeId);
          if (liveNode) {
            event.preventDefault();
            beginNodeLabelEdit(liveNode as Node, 'canvas');
          }
        }
        return;
      }

      // S: select tool — advertised by the toolbar tooltip. W stays canvas-scoped
      // inside CanvasHost; S has no canvas binding, so the surface owns it.
      if (
        event.key.toLowerCase() === 's' &&
        !isTextInput &&
        !event.defaultPrevented &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        setSelectMode();
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
  }, [beginNodeLabelEdit, beginNodePlacement, clearSelection, deleteSelection, gridSize, handleCopy, handleCut, handleDuplicate, handleFitToSelection, handleNudgeSelection, handlePaste, handleRedo, handleSelectAll, handleUndo, setSelectMode, snapToGrid, toggleSnapToGrid]);

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
  const hasPaletteResults =
    filteredPaletteByCategory.logic.length > 0 ||
    filteredPaletteByCategory.sequential.length > 0 ||
    filteredPaletteByCategory.io.length > 0 ||
    filteredPaletteByCategory.components.length > 0 ||
    filteredCustomComponents.length > 0 ||
    filteredMacros.length > 0 ||
    filteredBoardGroups.length > 0;

  const renderNodePaletteCard = (
    item: Pick<PaletteItem, 'type' | 'title' | 'subtitle' | 'glyph' | 'paletteBadge'> &
      Partial<Pick<PaletteItem, 'portSummary' | 'interfaceDetail' | 'capabilityBadge' | 'capabilityTitle'>>,
    options?: {
      badge?: string;
      className?: string;
      onClick?: () => void;
      testId?: string;
      title?: string;
    }
  ) => {
    const isPending = pendingPlacement?.kind === 'node' && pendingPlacement.nodeType === item.type;
    const tooltip =
      options?.title ??
      [
        `${item.title} - ${item.subtitle}`,
        item.interfaceDetail || null,
        item.capabilityTitle || null,
        'Click to arm placement, or drag onto the canvas.',
      ]
        .filter(Boolean)
        .join('\n');
    return (
      <button
        key={item.type}
        type="button"
        className={`rb-lib-row${options?.className ? ` ${options.className}` : ''}${isPending ? ' is-placement-active' : ''}`}
        onClick={options?.onClick ?? (() => beginNodePlacement(item.type))}
        onPointerDown={
          options?.onClick
            ? undefined
            : (event) => beginPaletteCardDrag(event, { kind: 'node', nodeType: item.type, label: item.title })
        }
        data-testid={options?.testId ?? `ide-design-palette-${item.type.toLowerCase()}`}
        aria-pressed={isPending}
        title={tooltip}
      >
        <span className="rb-lib-glyph" aria-hidden="true">{item.glyph}</span>
        <span className="rb-lib-name ide-design-component-tile-title">{item.title}</span>
        <code className="rb-lib-pins">{item.portSummary ?? item.subtitle}</code>
        {item.capabilityBadge ? (
          <span className="rb-lib-cap" title={item.capabilityTitle ?? undefined}>{item.capabilityBadge}</span>
        ) : null}
        {options?.badge || item.paletteBadge ? <span className="rb-lib-badge">{options?.badge ?? item.paletteBadge}</span> : null}
      </button>
    );
  };
  /** A search always shows every match, regardless of collapsed sections. */
  const librarySectionOpen = useCallback(
    (sectionId: string): boolean => paletteHasQuery || !collapsedLibrarySections.has(sectionId),
    [collapsedLibrarySections, paletteHasQuery]
  );
  const renderLibrarySectionToggle = (sectionId: string, label: string) => (
    <button
      type="button"
      className="rb-lib-toggle"
      aria-expanded={librarySectionOpen(sectionId)}
      aria-label={`${librarySectionOpen(sectionId) ? 'Collapse' : 'Expand'} ${label}`}
      onClick={() => toggleLibrarySection(sectionId)}
      disabled={paletteHasQuery}
      data-testid={`ide-design-library-toggle-${sectionId}`}
    >
      <span aria-hidden="true">{librarySectionOpen(sectionId) ? '▾' : '▸'}</span>
    </button>
  );
  const [boardPaletteSection, ioPaletteSection, logicPaletteSection, sequentialPaletteSection, reusablePaletteSection] =
    PALETTE_SECTION_ORDER;
  const selectedNodeInspectorModel = selectedNode
    ? (() => {
        const displayName = selectedNode.label?.trim() || nodeTypeLabel(selectedNode.type);
        const typeName = nodeTypeLabel(selectedNode.type);
        const studentNodeLabel = describeNodeForStudents(selectedNode, selectedNodeIoRow);
        const mappedBoardResource = selectedNodeIoRow
          ? getBasys3BoardResource(selectedNodeIoRow.pin)
          : null;
        const boardSummary = selectedNodeIoRow
          ? mappedBoardResource
            ? `${mappedBoardResource.alias} -> ${mappedBoardResource.packagePin}`
            : 'Unassigned'
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
        const selectedBoardResource = mappedBoardResource?.alias
          ?? (selectedNodeIoRow ? 'Unassigned board resource' : 'Not mapped to a board resource');
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

        return {
          boardSummary,
          displayName,
          nextStep,
          selectedBoardResource,
          selectedLogicalDirection,
          selectedPackagePin,
          showSelectedSignalModel,
          studentNodeLabel,
          typeName,
        };
      })()
    : null;
  const renderSelectionIdentityCard = () => {
    if (hasSingleSelectedNode && selectedNode && selectedNodeInspectorModel) {
      const { displayName, typeName } = selectedNodeInspectorModel;
      return (
        <div className="rb-insp-sel-inspector" data-testid="ide-design-selection-inspector">
          <div className="rb-insp-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="rb-insp-eyebrow">Selection</span>
            <div className="rb-insp-identity-row">
              <div className="rb-insp-title-block">
                <div className="rb-insp-sel-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-inspector-identity-title">{displayName}</strong>
                </div>
                <p className="rb-insp-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  <span data-testid="ide-design-inspector-part-kind">
                    {selectedNodeTeachingProfile?.partKind ?? 'Part'}
                  </span>
                  <span className="rb-insp-sep"> · </span>
                  <span data-testid="ide-design-selection-type">{typeName}</span>
                </p>
              </div>
              <span className={`rb-insp-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <div className="rb-insp-name-control" data-testid="ide-design-inspector-name-control">
              <span className="rb-insp-group-label">
                {selectedNode.type === 'INPUT' || selectedNode.type === 'OUTPUT' ? 'Signal name' : 'Part label'}
              </span>
              {renderNodeLabelEditor(selectedNode)}
            </div>
            {renderSelectionGuidance()}
          </div>
        </div>
      );
    }
    if (hasMultiNodeSelection) {
      return (
        <div className="rb-insp-sel-inspector" data-testid="ide-design-multiselect-summary">
          <div className="rb-insp-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="rb-insp-eyebrow">Selection</span>
            <div className="rb-insp-identity-row">
              <div className="rb-insp-title-block">
                <div className="rb-insp-sel-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-multiselect-count">{selection.nodes.size} nodes selected</strong>
                </div>
                <p className="rb-insp-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  Use Arrow keys to nudge this group, align shared edges when it gets messy, or press Ctrl+D / Cmd+D to duplicate it.
                </p>
              </div>
              <span className={`rb-insp-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="rb-insp-next-step" data-testid="ide-design-inspector-next-step">
              Keep refining the selection as one working unit, then save it as a reusable block when the group stabilizes.
            </p>
            <div className="rb-insp-sel-pins" data-testid="ide-design-multiselect-types">
              {selectedTypeSummary.map((entry) => (
                <span key={entry.type} className="rb-insp-pin">
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
        <div className="rb-insp-sel-inspector" data-testid="ide-design-multiselect-summary">
          <div className="rb-insp-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="rb-insp-eyebrow">Selection</span>
            <div className="rb-insp-identity-row">
              <div className="rb-insp-title-block">
                <div className="rb-insp-sel-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-multiwire-count">{selectedWireIdsAll.length} wire segments selected</strong>
                </div>
                <p className="rb-insp-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  {multiWireNetSummary?.headline ?? 'Multiple wires — comparing signal paths'}
                </p>
                {multiWireNetSummary ? (
                  <div className="rb-insp-meaning" data-testid="ide-design-multiwire-net-meaning">
                    <p className="rb-insp-what-it-is" data-testid="ide-design-multiwire-net-detail">
                      {multiWireNetSummary.detail}
                    </p>
                    {multiWireNetSummary.groupLabels.length > 0 ? (
                      <p
                        className="rb-insp-structure-hint"
                        data-testid="ide-design-multiwire-group-labels"
                        title={multiWireNetSummary.groupLabels.join('\n')}
                      >
                        Signal groups: {multiWireNetSummary.groupLabels.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className={`rb-insp-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="rb-insp-next-step" data-testid="ide-design-inspector-next-step">
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
        <div className="rb-insp-sel-inspector" data-testid="ide-design-selection-inspector">
          <div className="rb-insp-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="rb-insp-eyebrow">Selection</span>
            <div className="rb-insp-identity-row">
              <div className="rb-insp-title-block">
                <div className="rb-insp-sel-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-inspector-identity-title">
                    {describeStudentSignalKey(selectedWireContext.signalKey, editorCircuit, ioRowByNodeId)}
                  </strong>
                </div>
                <p className="rb-insp-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  Wire net from {selectedWireContext.sourceLabel} to {selectedWireContext.targetLabel}
                </p>
              </div>
              <span className={`rb-insp-status is-${selectionStatusTone}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <p className="rb-insp-next-step" data-testid="ide-design-inspector-next-step">
              {nextStep}
            </p>
            <div className="rb-insp-facts rb-insp-facts">
              <div className="rb-insp-row">
                <span>Type</span>
                <span data-testid="ide-design-selection-type">Wire</span>
              </div>
              <div className="rb-insp-row">
                <span>Connection</span>
                <code data-testid="ide-design-selection-id">
                  {`${selectedWireContext.sourceLabel} -> ${selectedWireContext.targetLabel}`}
                </code>
              </div>
              <div className="rb-insp-row">
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
        <div className="rb-insp-sel-inspector" data-testid="ide-design-selection-inspector">
          <div className="rb-insp-identity-card" data-testid="ide-design-inspector-identity-card">
            <span className="rb-insp-eyebrow">Selection</span>
            <div className="rb-insp-identity-row">
              <div className="rb-insp-title-block">
                <div className="rb-insp-sel-identity" data-testid="ide-design-selection-identity">
                  <strong data-testid="ide-design-inspector-identity-title">{activeInspectorSignalLabel}</strong>
                </div>
                <p className="rb-insp-subtitle" data-testid="ide-design-inspector-identity-subtitle">
                  {signalFocusSubtitle}
                </p>
              </div>
            </div>
            {primarySelectionIssue?.hint ? (
              <p className="rb-insp-next-step" data-testid="ide-design-inspector-next-step">
                {primarySelectionIssue.hint}
              </p>
            ) : null}
            <div className="rb-insp-facts rb-insp-facts">
              <div className="rb-insp-row">
                <span>Type</span>
                <span data-testid="ide-design-selection-type">Signal</span>
              </div>
              <div className="rb-insp-row">
                <span>Signal</span>
                <code data-testid="ide-design-selection-id">{activeInspectorSignalLabel}</code>
              </div>
              <div className="rb-insp-row">
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
        <div className="rb-insp-empty-card rb-insp-replay-idle" data-testid="ide-design-inspector-empty">
          <span className="rb-insp-eyebrow rb-insp-eyebrow--inspect">Inspect mode</span>
          <div className="rb-insp-title-block">
            <div className="rb-insp-sel-identity">
              <strong data-testid="ide-design-inspector-identity-title">{activeReplaySelectionLabel}</strong>
            </div>
            <p className="rb-insp-subtitle" data-testid="ide-design-inspector-identity-subtitle">
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
        <div className="rb-insp-sel-deferred" data-testid="ide-design-selection-deferred">
          <p className="ide-copy" style={{ margin: 0 }}>
            <span className="rb-insp-eyebrow">Canvas selection</span>
            {' — '}
            Project focus is active. Select a node or wire to inspect it here, or use{' '}
            <strong>Clear focus</strong> on the canvas banner.
          </p>
        </div>
      );
    }
    return (
      <div className="rb-insp-empty-card" data-testid="ide-design-inspector-empty">
        <span className="rb-insp-eyebrow">Inspector</span>
        <div className="rb-insp-title-block">
          <div className="rb-insp-sel-identity">
            <strong data-testid="ide-design-inspector-identity-title">Canvas ready</strong>
          </div>
          <p className="rb-insp-subtitle" data-testid="ide-design-inspector-identity-subtitle">
            Selection state, mapping, and signal context land here.
          </p>
          <p className="ide-design-logical-io-note" data-testid="ide-design-logical-io-explainer">
            {SIGNAL_LANGUAGE.designLogicalIo} A label is the name shown in RedByte; mapping binds that signal to a board resource and package pin.
          </p>
        </div>
        {!showBlankStateCard ? (
          <p className="rb-insp-next-step" data-testid="ide-design-inspector-next-step">
            Select a node, wire, or verify-linked signal to inspect it without leaving the canvas.
          </p>
        ) : null}
      </div>
    );
  };
  const renderSelectionGuidance = () => {
    if (selectionIssueSummary || primarySelectionDiagnostic) {
      return (
        <div className="rb-insp-guidance" data-testid="ide-design-inspector-guidance">
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
            <div className="rb-insp-diagnostics" data-testid="ide-design-selection-diagnostics">
              <ul className="rb-insp-diagnostic-list">
                {selectedNodeDiagnostics.slice(0, 3).map((diagnostic) => (
                  <li
                    key={`${diagnostic.code}-${diagnostic.message}`}
                    className={`rb-insp-diagnostic-item is-${diagnostic.severity === 'error' ? 'error' : 'warn'}`}
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
  const renderSelectedNodeDetails = () => {
    if (!hasSingleSelectedNode || !selectedNode || !selectedNodeInspectorModel) {
      return null;
    }

    const {
      boardSummary,
      displayName,
      nextStep,
      selectedBoardResource,
      selectedLogicalDirection,
      selectedPackagePin,
      showSelectedSignalModel,
      studentNodeLabel,
    } = selectedNodeInspectorModel;

    return (
      <div className="rb-insp-selection-details-content">
        {selectedNodeTeachingProfile ? (
          <div className="rb-insp-meaning" data-testid="ide-design-inspector-meaning">
            <p
              className="rb-insp-what-it-is"
              data-testid="ide-design-inspector-what-it-is"
            >
              {selectedNodeTeachingProfile.whatItIs}
            </p>
            {selectedNodeTeachingProfile.structureHint ? (
              <p
                className="rb-insp-structure-hint"
                data-testid="ide-design-inspector-structure-hint"
              >
                {selectedNodeTeachingProfile.structureHint}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="rb-insp-next-step" data-testid="ide-design-inspector-next-step">
          {nextStep}
        </p>
        <div className="rb-insp-facts rb-insp-facts">
          {showSelectedSignalModel ? (
            <div
              className="rb-insp-signal-model"
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
          {(() => {
            const membership = busForNode(editorCircuit, selectedNode.id);
            if (!membership) return null;
            return (
              <div className="rb-insp-row" data-testid="ide-design-selection-bus">
                <span>Bus</span>
                <span>
                  <code>{busRangeLabel(membership.bus)}</code> · bit {membership.index}
                </span>
              </div>
            );
          })()}
          <div className="rb-insp-row">
            <span>Reference</span>
            <code data-testid="ide-design-selection-id">{studentNodeLabel}</code>
          </div>
          <div className="rb-insp-row">
            <span>Board mapping</span>
            <span>{boardSummary}</span>
          </div>
          {selectedSequentialInspector ? (
            <>
              <div className="rb-insp-row">
                <span>Timing role</span>
                <span data-testid="ide-design-sequential-role">{selectedSequentialInspector.roleLabel}</span>
              </div>
              <div className="rb-insp-row">
                <span>Timing context</span>
                <span data-testid="ide-design-sequential-timing-context">
                  {selectedSequentialInspector.timingContext}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };
  const renderSelectionActions = () => {
    if (hasSingleSelectedNode && selectedNode) {
      return (
        <div className="rb-insp-section-stack">
          <div className="rb-insp-action-group" data-testid="ide-design-inspector-edit-group">
            <span className="rb-insp-group-label">Edit</span>
            <div className="rb-insp-action-grid">
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
                <div className="rb-insp-subgroup" data-testid="ide-design-swap-group">
                  <span className="rb-insp-group-label">Swap type</span>
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
          </div>
          {selectedNativeModule ? (
            <div className="rb-insp-action-group" data-testid="ide-design-module-instance-actions">
              <span className="rb-insp-group-label">Module instance</span>
              <p className="ide-design-instance-identity" data-testid="ide-design-instance-identity">
                <strong>{readInstanceName(selectedNode) || selectedNode.label || selectedNode.id}</strong>
                <span> : {selectedNativeModule.displayName}</span>
              </p>
              <div className="rb-insp-action-grid">
                <IdeButton
                  tone="primary"
                  onClick={() => onOpenModule?.(selectedNativeModule.id)}
                  testId="ide-design-open-module-definition"
                >
                  Open definition
                </IdeButton>
                <IdeButton
                  tone="secondary"
                  onClick={() => {
                    setEditingModuleInstanceId(selectedNode.id);
                    setModuleInstanceNameDraft(readInstanceName(selectedNode));
                  }}
                  testId="ide-design-rename-module-instance"
                >
                  Rename instance
                </IdeButton>
              </div>
              {editingModuleInstanceId === selectedNode.id ? (
                <div className="ide-design-inline-instance-rename">
                  <input
                    value={moduleInstanceNameDraft}
                    onChange={(event) => setModuleInstanceNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && moduleInstanceNameDraft.trim()) {
                        onRenameModuleInstance?.(selectedNode.id, moduleInstanceNameDraft.trim());
                        setEditingModuleInstanceId(null);
                      }
                      if (event.key === 'Escape') setEditingModuleInstanceId(null);
                    }}
                    aria-label="Instance name"
                    data-testid="ide-design-module-instance-name-input"
                    autoFocus
                  />
                  <IdeButton tone="primary" disabled={!moduleInstanceNameDraft.trim()} onClick={() => {
                    if (!moduleInstanceNameDraft.trim()) return;
                    onRenameModuleInstance?.(selectedNode.id, moduleInstanceNameDraft.trim());
                    setEditingModuleInstanceId(null);
                  }} testId="ide-design-module-instance-name-save">Save name</IdeButton>
                  <IdeButton tone="ghost" onClick={() => setEditingModuleInstanceId(null)}>Cancel</IdeButton>
                </div>
              ) : null}
              <p className="ide-copy">
                {selectedNativeModule.displayName} · {selectedNativeModule.ports.length} ports · editable visual source
              </p>
            </div>
          ) : null}
          <div className="rb-insp-action-group" data-testid="ide-design-trace-group">
            <span className="rb-insp-group-label">Net tracing</span>
            <div className="rb-insp-action-grid">
              {primarySelectionIssue ? (
                <IdeButton tone="secondary" onClick={() => focusDesignIssue(primarySelectionIssue)}>
                  Focus issue
                </IdeButton>
              ) : null}
              <IdeButton tone="secondary" onClick={focusSelectedPath} disabled={!selectedNode} testId="ide-design-context-focus-path">
                Focus path
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => selectedNode && handleFanoutTrace(selectedNode.id)} disabled={!selectedNodeHasFanout} testId="ide-design-context-trace-fanout">
                Trace net
              </IdeButton>
              <IdeButton tone="ghost" onClick={pinActiveInspectorSignal} disabled={!activeInspectorSignalKey} testId="ide-design-context-pin">
                {isActiveInspectorSignalPinned ? 'Unpin' : 'Pin'}
              </IdeButton>
              <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                Clear
              </IdeButton>
              {designRelated ? (
                <RelatedMenu relation={designRelated} activeScenarioId={null} hasRun={designRelated.run !== null} origin="schematic" testId="ide-design-related" />
              ) : null}
            </div>
          </div>
          {selectedSequentialInspector?.actionLabel &&
          ((selectedSequentialInspector.actionKind === 'trace-control' && selectedSequentialInspector.actionPort) ||
            (selectedSequentialInspector.actionKind === 'go-to-hardware' && onGoToHardware)) ? (
            <div className="rb-insp-action-group" data-testid="ide-design-sequential-action-group">
              <span className="rb-insp-group-label">Sequential next step</span>
              <div className="rb-insp-action-grid">
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
            <div className="rb-insp-action-group" data-testid="ide-design-inspector-input-control">
              <span className="rb-insp-group-label">Input control</span>
              <div className="rb-insp-action-grid">
                {(() => {
                  const currentVal = liveSignals.get(`${selectedNode.id}.out`) ?? 0;
                  return (
                    <button
                      type="button"
                      className={`ide-design-input-control ${currentVal === 1 ? 'is-on' : 'is-off'}`}
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
          <div className="rb-insp-action-group rb-insp-group--danger" data-testid="ide-design-inspector-danger-group">
            <span className="rb-insp-group-label">Danger</span>
            <div className="rb-insp-action-grid">
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
        <div className="rb-insp-section-stack">
          <div className="rb-insp-action-group" data-testid="ide-design-inspector-edit-group">
            <span className="rb-insp-group-label">Edit</span>
            <div className="rb-insp-action-grid">
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
          <div className="rb-insp-action-group" data-testid="ide-design-inspector-arrange-group">
            <span className="rb-insp-group-label">Align</span>
            <div className="rb-insp-action-grid ide-design-align-grid">
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('left')} testId="ide-design-align-left-btn">
                Left
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('h-center')} testId="ide-design-align-hcenter-btn">
                Center
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('right')} testId="ide-design-align-right-btn">
                Right
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('top')} testId="ide-design-align-top-btn">
                Top
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('v-center')} testId="ide-design-align-vcenter-btn">
                Middle
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => handleAlignSelection('bottom')} testId="ide-design-align-bottom-btn">
                Bottom
              </IdeButton>
            </div>
            <span className="rb-insp-group-label">Distribute</span>
            <div className="rb-insp-action-grid">
              <IdeButton
                tone="ghost"
                onClick={handleDistributeSelectionHorizontally}
                disabled={selection.nodes.size < 3}
                testId="ide-design-distribute-horizontal-btn"
              >
                Horizontally
              </IdeButton>
              <IdeButton
                tone="ghost"
                onClick={() => handleDistributeSelection('vertical')}
                disabled={selection.nodes.size < 3}
                testId="ide-design-distribute-vertical-btn"
              >
                Vertically
              </IdeButton>
            </div>
          </div>
          {onSaveMacro && selectedNodeIdsAll.length >= 2 ? (
            <div className="rb-insp-action-group">
              <span className="rb-insp-group-label">Compose</span>
              <div className="rb-insp-action-grid">
                <IdeButton tone="ghost" onClick={openMacroDialog} testId="ide-design-save-macro-open">
                  Save as Macro...
                </IdeButton>
              </div>
            </div>
          ) : null}
          {(onCreateModuleFromSelection || onSaveAsComponent) && selectedNodeIdsAll.length >= 2 ? (
            <div className="rb-insp-action-group">
              <span className="rb-insp-group-label">Hierarchy</span>
              <div className="rb-insp-action-grid">
                {onCreateModuleFromSelection ? (
                  <IdeButton tone="primary" onClick={openModuleDialog} testId="ide-design-create-module-open">
                    Create component from selection…
                  </IdeButton>
                ) : saveComponentOpen ? (
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
                  Created "{savedComponentToast}" as an editable project component.
                </IdeCallout>
              ) : null}
            </div>
          ) : null}
          <div className="rb-insp-action-group rb-insp-group--danger" data-testid="ide-design-inspector-danger-group">
            <span className="rb-insp-group-label">Danger</span>
            <div className="rb-insp-action-grid">
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
        <div className="rb-insp-section-stack">
          <div className="rb-insp-action-group" data-testid="ide-design-trace-group">
            <span className="rb-insp-group-label">Net tracing</span>
            <div className="rb-insp-action-grid">
              <IdeButton tone="secondary" onClick={focusSelectedPath} testId="ide-design-context-focus-path">
                Focus path
              </IdeButton>
              <IdeButton tone="secondary" onClick={pinActiveInspectorSignal} disabled={!activeInspectorSignalKey} testId="ide-design-context-pin">
                {isActiveInspectorSignalPinned ? 'Unpin signal' : 'Pin signal'}
              </IdeButton>
              <IdeButton tone="ghost" onClick={clearTrace} disabled={!traceState} testId="ide-design-context-clear-trace">
                Clear trace
              </IdeButton>
              {designRelated ? (
                <RelatedMenu relation={designRelated} activeScenarioId={null} hasRun={designRelated.run !== null} origin="schematic" testId="ide-design-related" />
              ) : null}
              <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-context-delete-wire">
                Disconnect
              </IdeButton>
            </div>
          </div>
        </div>
      );
    }
    if (activeInspectorSignalKey) {
      return (
        <div className="rb-insp-section-stack">
          <div className="rb-insp-action-group" data-testid="ide-design-trace-group">
            <span className="rb-insp-group-label">Signal actions</span>
            <div className="rb-insp-action-grid">
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
              {designRelated ? (
                <RelatedMenu relation={designRelated} activeScenarioId={null} hasRun={designRelated.run !== null} origin="schematic" testId="ide-design-related" />
              ) : null}
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
      if (!registerCfg) return null;
      const registerWidth = registerCfg ? normalizeRegisterWidth(selectedNode.type, registerCfg) : 1;
      return (
        <div className="rb-insp-inline-editor" data-testid="ide-design-inspector-inline-editor">
          <div className="ide-design-register-config" data-testid="ide-design-register-config">
              <span className="rb-insp-group-label">Register semantics</span>
              <p className="rb-insp-hint">
                Matches simulation and export. For bus registers, width controls how many D[i]/Q[i] taps appear on the
                chip.
              </p>
              {selectedNode.type !== 'Register1' ? (
                <label className="rb-insp-field">
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
              <label className="rb-insp-field rb-insp-field--checkbox">
                <input
                  type="checkbox"
                  checked={registerCfg.hasEnable === true}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ hasEnable: event.target.checked })}
                  data-testid="ide-design-register-has-enable"
                />
                <span>Model clock enable (EN / CE)</span>
              </label>
              <label className="rb-insp-field">
                <span>Clock edge</span>
                <select
                  className="ide-export-pin-input"
                  value={String(registerCfg.clockPolarity ?? 'rising_edge')}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ clockPolarity: event.target.value })}
                  data-testid="ide-design-register-clock-edge"
                >
                  <option value="rising_edge">Rising edge</option>
                  <option value="falling_edge" disabled>Falling edge · unsupported</option>
                </select>
              </label>
              <label className="rb-insp-field">
                <span>Reset kind</span>
                <select
                  className="ide-export-pin-input"
                  value={String(registerCfg.resetKind ?? 'none')}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ resetKind: event.target.value })}
                  data-testid="ide-design-register-reset-kind"
                >
                  <option value="none">None</option>
                  <option value="async_clear">Async clear</option>
                  <option value="async_preset" disabled>Async preset · unsupported</option>
                  <option value="sync_reset" disabled>Synchronous reset · unsupported</option>
                  <option value="sync_set" disabled>Synchronous set · unsupported</option>
                </select>
              </label>
              <label className="rb-insp-field">
                <span>Reset polarity</span>
                <select
                  className="ide-export-pin-input"
                  value={String(registerCfg.resetPolarity ?? 'active_high')}
                  onChange={(event) => patchSelectedRegisterFamilyConfig({ resetPolarity: event.target.value })}
                  data-testid="ide-design-register-reset-polarity"
                >
                  <option value="active_high">Active high</option>
                  <option value="active_low" disabled>Active low · unsupported</option>
                </select>
              </label>
              <label className="rb-insp-field">
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
              <IdeCallout tone="info">
                Supported learning path: one scalar Register1, rising-edge capture,
                and optional active-high asynchronous clear. Unsupported imported
                settings stay visible for repair but cannot be newly selected.
              </IdeCallout>
          </div>
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
        <div className="rb-insp-row">
          <span>Selected case</span>
          <span>{activeSimulationSelectionLabel}</span>
        </div>
        <div className="rb-insp-row">
          <span>State</span>
          <span>
            {staleReplayBreadcrumb
              ? 'Stale breadcrumb only'
              : effectiveExternalDebugTick != null
                ? 'Verify-authored replay'
                : 'Live circuit'}
          </span>
        </div>
        <div className="rb-insp-row">
          <span>Mode</span>
          <span>{simModeLabel}</span>
        </div>
        {activeReplayTimingHint ? (
          <div className="rb-insp-row">
            <span>Sample</span>
            <span>{activeReplayTimingHint}</span>
          </div>
        ) : null}
        {simulationStory.clockEvent ? (
          <div className="rb-insp-row">
            <span>Clock</span>
            <span>{simulationStory.clockLabel} {simulationStory.clockEvent} edge</span>
          </div>
        ) : null}
        {activeVerifySignal ? (
          <div className="rb-insp-row">
            <span>Verify focus</span>
            <code>{activeVerifySignalPresentation?.focusLabel ?? activeVerifySignal}</code>
          </div>
        ) : null}
        {activeDebugContext ? (
          <div className="rb-insp-row">
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
          Return to Simulate waveform
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
          <div className="rb-insp-section-stack">
            <IdeCallout
              tone="info"
              title="Sequential guidance"
              testId="ide-design-sequential-guidance"
            >
              <span data-testid="ide-design-sequential-guidance-copy">
                {selectedSequentialInspector.behaviorSummary}
              </span>
            </IdeCallout>
            <div className="rb-insp-live-summary">
              <div className="rb-insp-facts">
                <div className="rb-insp-row">
                  <span>Role</span>
                  <span>{selectedSequentialInspector.roleLabel}</span>
                </div>
                {selectedSequentialInspector.controlLabel ? (
                  <div className="rb-insp-row">
                    <span>{selectedSequentialInspector.controlLabel}</span>
                    <span data-testid="ide-design-sequential-control-source">
                      {selectedSequentialInspector.controlSourceLabel ?? 'No source wired'}
                    </span>
                  </div>
                ) : null}
                {selectedSequentialInspector.controlLabel && selectedSequentialInspector.controlActivity ? (
                  <div className="rb-insp-row">
                    <span>Control activity</span>
                    <span data-testid="ide-design-sequential-control-activity">
                      {selectedSequentialInspector.controlActivity}
                    </span>
                  </div>
                ) : !selectedSequentialInspector.controlLabel && selectedSequentialInspector.controlActivity ? (
                  <div className="rb-insp-row">
                    <span>Signal activity</span>
                    <span data-testid="ide-design-sequential-control-activity">
                      {selectedSequentialInspector.controlActivity}
                    </span>
                  </div>
                ) : null}
                <div className="rb-insp-row">
                  <span>{selectedSequentialInspector.ioSummaryLabel}</span>
                  <span data-testid="ide-design-sequential-input-summary">{selectedSequentialInspector.ioSummary}</span>
                </div>
                <div className="rb-insp-row">
                  <span>{selectedSequentialInspector.stateSummaryLabel}</span>
                  <span data-testid="ide-design-sequential-output-summary">{selectedSequentialInspector.stateSummary}</span>
                </div>
                <div className="rb-insp-row">
                  <span>Timing context</span>
                  <span>{selectedSequentialInspector.timingContext}</span>
                </div>
                <div className="rb-insp-row">
                  <span>Current</span>
                  <code data-testid="ide-design-context-current">{selectedNodeSignalSnapshot?.currentValue ?? 0}</code>
                </div>
                <div className="rb-insp-row">
                  <span>Previous</span>
                  <code data-testid="ide-design-context-previous">{selectedNodeSignalSnapshot?.previousValue ?? 0}</code>
                </div>
                <div className="rb-insp-row">
                  <span>Transition</span>
                  <span data-testid="ide-design-context-transition">{selectedNodeSignalSnapshot?.transition ?? 'stable'}</span>
                </div>
                <div className="rb-insp-row">
                  <span>Last transition</span>
                  <span data-testid="ide-design-context-last-transition">{selectedNodeSignalSnapshot?.lastTransitionTick ?? '—'}</span>
                </div>
                {selectedNodeReplayCausation ? (
                  <div className="rb-insp-row">
                    <span>Why now</span>
                    <span data-testid="ide-design-replay-causation">{selectedNodeReplayCausation}</span>
                  </div>
                ) : null}
                <div className="rb-insp-row">
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
              <div className="rb-insp-sel-pins" data-testid="ide-design-selection-pins">
                {selectedNodeSignals.map((entry) => {
                  const val = entry.value;
                  const valStr = val === 1 ? '1' : val === 0 ? '0' : '?';
                  return (
                    <span
                      key={`${selectedNode.id}-${entry.port}`}
                      className={`rb-insp-pin rb-insp-pin--val${val === 1 ? '-hi' : val === 0 ? '-lo' : '-unk'}`}
                      data-testid={`ide-design-pin-pill-${selectedNode.id}-${entry.port}`}
                    >
                      {entry.port}
                      <span className="rb-insp-pin-value">{valStr}</span>
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
        <div className="rb-insp-section-stack">
          {selectedNodeReplayCausation ? (
            <div className="ide-design-replay-causation-card" data-testid="ide-design-replay-causation-card">
              <span className="ide-design-replay-causation-label">Why now</span>
              <p className="ide-design-replay-causation-text" data-testid="ide-design-replay-causation">{selectedNodeReplayCausation}</p>
            </div>
          ) : null}
          <div className="rb-insp-live-summary">
            <div className="rb-insp-facts">
              <div className="rb-insp-row">
                <span>Current</span>
                <code data-testid="ide-design-context-current">{selectedNodeSignalSnapshot?.currentValue ?? 0}</code>
              </div>
              <div className="rb-insp-row">
                <span>Previous</span>
                <code data-testid="ide-design-context-previous">{selectedNodeSignalSnapshot?.previousValue ?? 0}</code>
              </div>
              <div className="rb-insp-row">
                <span>Transition</span>
                <span data-testid="ide-design-context-transition">{selectedNodeSignalSnapshot?.transition ?? 'stable'}</span>
              </div>
              <div className="rb-insp-row">
                <span>Last transition</span>
                <span data-testid="ide-design-context-last-transition">{selectedNodeSignalSnapshot?.lastTransitionTick ?? '—'}</span>
              </div>
              <div className="rb-insp-row">
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
            <div className="rb-insp-sel-pins" data-testid="ide-design-selection-pins">
              {selectedNodeSignals.map((entry) => {
                const val = entry.value;
                const valStr = val === 1 ? '1' : val === 0 ? '0' : '?';
                return (
                  <span
                    key={`${selectedNode.id}-${entry.port}`}
                    className={`rb-insp-pin rb-insp-pin--val${val === 1 ? '-hi' : val === 0 ? '-lo' : '-unk'}`}
                    data-testid={`ide-design-pin-pill-${selectedNode.id}-${entry.port}`}
                  >
                    {entry.port}
                    <span className="rb-insp-pin-value">{valStr}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
          {selectedNodeInputDrivers.length > 0 && (
            <div className="rb-insp-sel-drivers" data-testid="ide-design-input-drivers">
              {selectedNodeInputDrivers.map((d) => (
                <div key={d.port} className="rb-insp-row" data-testid={`ide-design-driver-row-${d.port}`}>
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
        <div className="rb-insp-live-summary">
          <div className="rb-insp-facts">
            <div className="rb-insp-row" data-testid="ide-design-wire-connection">
              <span>Connection</span>
              <span>{selectedWireContext.sourceLabel} → {selectedWireContext.targetLabel}</span>
            </div>
            <div className="rb-insp-row">
              <span>Signal</span>
              <code>{describeStudentSignalKey(selectedWireContext.signalKey, editorCircuit, ioRowByNodeId)}</code>
            </div>
            <div className="rb-insp-row">
              <span>Current</span>
              <code data-testid="ide-design-context-current">{selectedWireContext.snapshot?.currentValue ?? 0}</code>
            </div>
            <div className="rb-insp-row">
              <span>Previous</span>
              <code data-testid="ide-design-context-previous">{selectedWireContext.snapshot?.previousValue ?? 0}</code>
            </div>
            <div className="rb-insp-row">
              <span>Transition</span>
              <span data-testid="ide-design-context-transition">{selectedWireContext.snapshot?.transition ?? 'stable'}</span>
            </div>
            <div className="rb-insp-row">
              <span>Last transition</span>
              <span data-testid="ide-design-context-last-transition">{selectedWireContext.snapshot?.lastTransitionTick ?? '—'}</span>
            </div>
            {selectedWireReplayCausation ? (
              <div className="rb-insp-row">
                <span>Why now</span>
                <span data-testid="ide-design-replay-causation">{selectedWireReplayCausation}</span>
              </div>
            ) : null}
            <div className="rb-insp-row">
              <span>Driver / Source</span>
              <span>{selectedWireContext.sourceLabel} · {describePortForStudents(selectedWireContext.sourcePort)}</span>
            </div>
            <div className="rb-insp-row">
              <span>Sink</span>
              <span>{selectedWireContext.targetLabel} · {describePortForStudents(selectedWireContext.targetPort)}</span>
            </div>
            <div className="rb-insp-row">
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
        <div className="rb-insp-live-summary">
          <div className="rb-insp-facts">
            <div className="rb-insp-row">
              <span>Signal</span>
              <code data-testid="ide-design-signal-selected">{activeInspectorSignalLabel}</code>
            </div>
            <div className="rb-insp-row">
              <span>Current</span>
              <code data-testid="ide-design-signal-current-value">{activeInspectorSignalSnapshot?.currentValue ?? 0}</code>
            </div>
            <div className="rb-insp-row">
              <span>Previous</span>
              <code>{activeInspectorSignalSnapshot?.previousValue ?? 0}</code>
            </div>
            <div className="rb-insp-row">
              <span>Transition</span>
              <span>{activeInspectorSignalSnapshot?.transition ?? 'stable'}</span>
            </div>
            <div className="rb-insp-row">
              <span>Last transition</span>
              <span data-testid="ide-design-context-last-transition">{activeInspectorSignalSnapshot?.lastTransitionTick ?? '—'}</span>
            </div>
            {activeInspectorReplayCausation ? (
              <div className="rb-insp-row">
                <span>Why now</span>
                <span data-testid="ide-design-replay-causation">{activeInspectorReplayCausation}</span>
              </div>
            ) : null}
            <div className="rb-insp-row">
              <span>Samples</span>
              <span>{activeInspectorSignalSnapshot?.samples ?? selectedSignalHistory.length}</span>
            </div>
            <div className="rb-insp-row">
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
  const renderInlineBoardAssignment = () => {
    if (!isEditingTopModule) {
      return (
        <IdeEmptyState
          title="Board mapping belongs to the top module"
          body="Component definitions expose logical ports. Return to the top module to bind those project signals to Basys3 resources."
          primaryAction={<IdeButton tone="secondary" onClick={() => onOpenModule?.(TOP_MODULE_ID)}>Return to top</IdeButton>}
          testId="ide-design-module-board-boundary"
        />
      );
    }
    if (!selectedNodeIoRow) {
      return (
        <IdeEmptyState
          title="Select a top-level I/O pin"
          body="Choose an input or output on the canvas to assign its Basys3 resource without leaving Design."
          primaryAction={
            onGoToHardware ? (
              <IdeButton tone="secondary" onClick={onGoToHardware}>
                Open Board &amp; Constraints
              </IdeButton>
            ) : undefined
          }
          testId="ide-design-inline-board-empty"
        />
      );
    }

    return (
      <section className="rb-insp-board" data-testid="ide-design-inline-board-assignment">
        <header>
          <span className="ide-surface-block-label">Top-level {selectedNodeIoRow.direction === 'in' ? 'input' : 'output'}</span>
          <h3>{selectedNodeIoRow.label}</h3>
          <p>
            Logical signal <code>{selectedNodeIoRow.id}</code> keeps its project identity; this control changes only its
            board binding.
          </p>
        </header>
        <label className="rb-insp-field">
          <span>Basys3 resource</span>
          <select
            value={selectedBoardResource?.packagePin ?? ''}
            onChange={(event) => onSetMappingPin?.(selectedNodeIoRow.id, event.target.value)}
            disabled={!onSetMappingPin}
            data-testid="ide-design-inline-board-resource"
          >
            <option value="">Unassigned</option>
            {selectedBoardResourceOptions.map((resource) => (
              <option key={resource.id} value={resource.packagePin}>
                {resource.alias} · {resource.packagePin} · {resource.label}
                {!isBasys3ResourceCompatibleWithSignal(resource, selectedNodeIoRow)
                  ? ' · incompatible with this signal role'
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <dl className="rb-insp-facts">
          <div><dt>Direction</dt><dd>{selectedNodeIoRow.direction === 'in' ? 'Input' : 'Output'}</dd></div>
          <div><dt>Required class</dt><dd>{describeRequiredBoardResourceClass(selectedNodeIoRow, selectedBoardResource, timingGuidance)}</dd></div>
          <div><dt>Package pin</dt><dd>{selectedBoardResource?.packagePin ?? 'Not assigned'}</dd></div>
          <div><dt>I/O standard</dt><dd>{selectedBoardResource?.ioStandard ?? 'Assigned with resource'}</dd></div>
          <div><dt>Constraint alias</dt><dd>{selectedBoardResource?.alias ?? 'None'}</dd></div>
          <div><dt>Timing status</dt><dd>{describeBoardTimingStatus(selectedNodeIoRow, selectedBoardResource, timingGuidance)}</dd></div>
          <div><dt>Conflict status</dt><dd>{selectedBoardConflict ? `Also used by ${selectedBoardConflict.label}` : 'No conflict'}</dd></div>
        </dl>
        {selectedBoardResource && !selectedBoardResourceCompatible ? (
          <IdeCallout tone="error" title="Incompatible board resource">
            {selectedBoardResource.alias} does not match the required signal role. Choose a compatible resource before export.
          </IdeCallout>
        ) : null}
        {selectedBoardConflict ? (
          <IdeCallout tone="error" title="Resource conflict">
            {selectedBoardResource?.alias} is also assigned to {selectedBoardConflict.label}. Resolve the conflict before export.
          </IdeCallout>
        ) : null}
        <div className="ide-inline-actions">
          <IdeButton
            tone="ghost"
            disabled={!selectedNodeIoRow.pin || !onSetMappingPin}
            onClick={() => onSetMappingPin?.(selectedNodeIoRow.id, '')}
            testId="ide-design-inline-board-clear"
          >
            Clear assignment
          </IdeButton>
          {onGoToHardware ? (
            <IdeButton tone="secondary" onClick={onGoToHardware} testId="ide-design-inline-board-open-board">
              Open Board &amp; Constraints
            </IdeButton>
          ) : null}
        </div>
        <p className="ide-copy rb-insp-proof-boundary">
          This creates package constraints for export. It does not prove synthesis, implementation, programming, or physical board behavior.
        </p>
      </section>
    );
  };
  const renderBottomWorkspace = () => (
    <div className="ide-design-bottom-workspace" data-testid="ide-design-bottom-workspace">
      <div className="wb-toolwindow-tabs rb-design-dock-tabs" role="tablist" aria-label="Design bottom panel">
        {(['problems', 'console', 'simulation'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeBottomDockTab === tab}
            className={`wb-toolwindow-tab${activeBottomDockTab === tab ? ' is-active' : ''}`}
            onClick={() => setActiveBottomDockTab(tab)}
            data-testid={`ide-design-bottom-tab-${tab}`}
          >
            {tab === 'problems' ? (
              <>Problems <span className="wb-toolwindow-count">{problemsLedgerCount}</span></>
            ) : tab === 'simulation' ? 'Simulation' : 'Output'}
          </button>
        ))}
      </div>
      <div className="ide-design-bottom-content">
        {activeBottomDockTab === 'problems' ? (
          <ProblemsPanel origin="bottom-panel" />
        ) : activeBottomDockTab === 'console' ? (
          <div className="ide-design-console-readout">
            <strong>{liveHdlResult.error ? 'HDL generation stopped' : 'HDL preview is current'}</strong>
            <span>{editorCircuit.nodes.length} nodes · {editorCircuit.connections.length} connections · {liveHdlResult.warnings.length} HDL warnings</span>
            <p>{liveHdlResult.error ?? 'Generated previews are current for this browser session. Build & Export owns the handoff package.'}</p>
          </div>
        ) : (
          <div className="ide-design-simulation-readout">
            <strong>{isReplayMode ? 'Verify replay' : runtimeSim.running ? 'Exploratory simulation running' : 'Exploratory simulation paused'}</strong>
            <span>Tick {runtimeSim.tick} · {runtimeSim.probes.length} pinned signals · {(isReplayMode ? displayTrace : runtimeSim.trace).length} trace samples</span>
            <div className="ide-inline-actions">
              {isReplayMode ? (
                <IdeButton tone="secondary" onClick={onGoToVerify}>Open Simulate waveform</IdeButton>
              ) : (
                <>
              <IdeButton tone="secondary" onClick={runtimeSim.running ? pauseSimulation : startSimulation}>
                {runtimeSim.running ? 'Pause' : 'Run'}
              </IdeButton>
              <IdeButton tone="ghost" onClick={stepSimulation}>Step</IdeButton>
              <IdeButton tone="ghost" onClick={resetSimulation}>Reset</IdeButton>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <>
      <IdeSurfaceLayout
        mode="design"
        layoutIntent="workbench"
        leftDockMode={workspacePreset.leftDockMode}
        rightDockMode={
          hasInspectorSelectionContext || focusedAssetContext
            ? workspacePreset.rightDockMode
            : 'hidden'
        }
        consoleMode="auto"
        console={renderBottomWorkspace()}
        consoleHasBlocking={compilerErrorCount > 0}
        consoleHasEntries={
          authoringIssues.length > 0 ||
          compilerDiagnostics.length > 0 ||
          runtimeSim.trace.length > 0 ||
          liveHdlResult.warnings.length > 0
        }
        shellDensity={workspacePreset.shellDensity}
        surfaceFrame={workspacePreset.surfaceFrame}
        productSpine={{
          statusLabel: authoringStatusLabel,
          statusTone: designCommandTone,
          detail: designCommandDescription,
          primaryLabel: activeVerifySignal || effectiveExternalDebugTick != null
            ? 'Return to Simulate waveform'
            : 'Open Simulate',
          onPrimary: onGoToVerify,
          recoveryLabel: onGoToProject ? 'Project' : undefined,
          onRecovery: onGoToProject,
          doneLabel: designStructureReady
            ? `Logical I/O boundary is present and no blocking structural diagnostic remains.`
            : editorCircuit.nodes.length > 0
              ? 'Finish the logical I/O boundary and clear blocking structural diagnostics.'
              : PROFESSIONAL_CLASSROOM_COPY.designBlankAction,
          blockedLabel: showBlankStateCard
            ? 'Canvas is empty.'
            : totalAuthoringErrors > 0
              ? `${totalAuthoringErrors} blocking circuit issue${totalAuthoringErrors === 1 ? '' : 's'}.`
              : !hasLogicalIoBoundary
                ? 'Add at least one logical input and one logical output.'
              : totalAuthoringWarnings > 0
                ? `${totalAuthoringWarnings} circuit warning${totalAuthoringWarnings === 1 ? '' : 's'} to review.`
                : dirtySinceVerify
                  ? 'Verify evidence is stale after design edits.'
                  : 'No design blocker visible.',
        }}
        dock={
        <div className="ide-design-dock-stack" data-testid="ide-design-left-dock-workspace">
          <div className="wb-toolwindow-tabs rb-design-dock-tabs" role="tablist" aria-label="Design tools">
            {(['components', 'hierarchy', 'sources', 'board'] as const)
              .filter((tab) => isEditingTopModule || tab !== 'board')
              .map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeLeftDockTab === tab}
                className={`wb-toolwindow-tab${activeLeftDockTab === tab ? ' is-active' : ''}`}
                onClick={() => setActiveLeftDockTab(tab)}
                data-testid={`ide-design-left-tab-${tab}`}
              >
                {tab === 'components' ? 'Components' : tab === 'board' ? 'Board I/O' : `${tab[0].toUpperCase()}${tab.slice(1)}`}
              </button>
            ))}
          </div>
          {activeLeftDockTab === 'components' ? (
          <SurfacePanel className="ide-design-palette" testId="ide-design-dock-palette">
            <div className="rb-lib-toolbar">
              <div className="wb-search">
              <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4" /><path d="M9 9l3.5 3.5" strokeLinecap="round" /></svg>
              <input
                type="search"
                className="rb-lib-search-input"
                aria-label="Filter component library"
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Filter parts"
                data-testid="ide-design-search"
              />
              {onRuntimeCreateBus ? (
                <button type="button" className="wb-btn wb-btn--ghost rb-lib-bus" onClick={() => openBusDialog('input')} data-testid="ide-design-library-new-bus" title="Create a bus port">
                  Bus +
                </button>
              ) : null}
              </div>
              {paletteHasQuery && (
                <p className="rb-lib-results" data-testid="ide-design-palette-results">
                  {hasPaletteResults
                    ? `${filteredPaletteByCategory.logic.length + filteredPaletteByCategory.sequential.length + filteredPaletteByCategory.io.length + filteredPaletteByCategory.components.length} results`
                    : `No results for "${paletteQuery.trim()}".`}
                </p>
              )}
            </div>

            <div className="rb-lib-sections" onKeyDown={handleLibraryRailKeyDown}>
              {/* One list: every primitive appears once under its category. */}
              {/* Board Resources — first: primary destination for board-aware work */}

              {/* Inputs & Outputs — second: generic pins for abstract designs */}
              {filteredPaletteByCategory.io.length > 0 ? (
                <section
                  className="rb-lib-section"
                  data-testid="ide-design-palette-section-io"
                  data-collapsed={librarySectionOpen('io') ? 'false' : 'true'}
                >
                  <header className="rb-lib-section-header">
                    <div className="rb-lib-section-title">
                      <h4>{ioPaletteSection.title}</h4>
                      <span className="rb-lib-count">
                        {filteredPaletteByCategory.io.length}
                      </span>
                      {renderLibrarySectionToggle('io', ioPaletteSection.title)}
                    </div>
                  </header>
                  {librarySectionOpen('io') ? (
                    <div className="rb-lib-list">
                      {filteredPaletteByCategory.io.map((item) => renderNodePaletteCard(item))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* Logic Gates */}
              {filteredPaletteByCategory.logic.length > 0 ? (
                <section
                  className="rb-lib-section"
                  data-testid="ide-design-palette-section-logic"
                  data-collapsed={librarySectionOpen('logic') ? 'false' : 'true'}
                >
                  <header className="rb-lib-section-header">
                    <div className="rb-lib-section-title">
                      <h4>{logicPaletteSection.title}</h4>
                      <span className="rb-lib-count">
                        {filteredPaletteByCategory.logic.length}
                      </span>
                      {renderLibrarySectionToggle('logic', logicPaletteSection.title)}
                    </div>
                  </header>
                  {librarySectionOpen('logic') ? (
                    <div className="rb-lib-list">
                      {filteredPaletteByCategory.logic.map((item) => renderNodePaletteCard(item))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* Sequential & Timing */}
              {filteredPaletteByCategory.sequential.length > 0 ? (
                <section
                  className="rb-lib-section"
                  data-testid="ide-design-palette-section-sequential"
                  data-collapsed={librarySectionOpen('sequential') ? 'false' : 'true'}
                >
                  <header className="rb-lib-section-header">
                    <div className="rb-lib-section-title">
                      <h4>{sequentialPaletteSection.title}</h4>
                      <span className="rb-lib-count">
                        {filteredPaletteByCategory.sequential.length}
                      </span>
                      {renderLibrarySectionToggle('sequential', sequentialPaletteSection.title)}
                    </div>
                  </header>
                  {librarySectionOpen('sequential') ? SEQUENTIAL_PALETTE_SUBSECTIONS.map((subsection) => {
                    const items = filteredPaletteByCategory[subsection.key];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={subsection.key} className="rb-lib-subsection" data-testid={subsection.testId}>
                        <div className="rb-lib-subheader">
                          <h5>{subsection.title}</h5>
                          <span className="rb-lib-count">{items.length}</span>
                        </div>
                        <div className="rb-lib-list">
                          {items.map((item) => renderNodePaletteCard(item))}
                        </div>
                      </div>
                    );
                  }) : null}
                  {librarySectionOpen('sequential') ? (
                    <p className="ide-palette-section-hint" data-testid="ide-design-palette-sequential-workflow-hint">
                      Tip: after choosing a register, hold Shift while clicking the canvas to place another of the same
                      type — useful for counters and multi-bit state.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {/* Reusable Blocks — macros, custom parts, built-in helpers */}
              {filteredPaletteByCategory.components.length > 0 ||
              filteredCustomComponents.length > 0 ||
              filteredMacros.length > 0 ? (
                <section
                  className="rb-lib-section"
                  data-testid="ide-design-palette-section-reusable"
                  data-collapsed={librarySectionOpen('reusable') ? 'false' : 'true'}
                >
                  <header className="rb-lib-section-header">
                    <div className="rb-lib-section-title">
                      <h4>{reusablePaletteSection.title}</h4>
                      <span className="rb-lib-count">
                        {filteredPaletteByCategory.components.length +
                          filteredCustomComponents.length +
                          filteredMacros.length}
                      </span>
                      {renderLibrarySectionToggle('reusable', reusablePaletteSection.title)}
                    </div>
                  </header>

                  {librarySectionOpen('reusable') && filteredPaletteByCategory.components.length > 0 ? (
                    <div
                      className="rb-lib-subsection"
                      data-testid="ide-design-palette-built-in-blocks"
                    >
                      <div className="rb-lib-subheader">
                        <h5>Built-in Blocks</h5>
                        <span className="rb-lib-count">
                          {filteredPaletteByCategory.components.length}
                        </span>
                      </div>
                      <div className="rb-lib-list">
                        {filteredPaletteByCategory.components.map((item) =>
                          renderNodePaletteCard(item, { badge: item.paletteBadge ?? 'Built-in' })
                        )}
                      </div>
                    </div>
                  ) : null}

                  {librarySectionOpen('reusable') && filteredCustomComponents.length > 0 ? (
                    <div className="rb-lib-subsection" data-testid="ide-palette-group-custom">
                      <div className="rb-lib-subheader">
                        <h5>Custom Parts</h5>
                        <span className="rb-lib-count">
                          {filteredCustomComponents.length}
                        </span>
                      </div>
                      <div className="rb-lib-list">
                        {filteredCustomComponents.map((item) => {
                          const definition = hierarchy?.modules.find((module) => module.name === item.type);
                          return (
                            <div key={item.type} className="rb-lib-row rb-lib-row--module" data-testid={`ide-design-palette-custom-${item.type.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                              <span className="rb-lib-glyph" aria-hidden="true">M</span>
                              <span className="rb-lib-name">{item.title}</span>
                              <code className="rb-lib-pins">{definition ? `${definition.ports.length} ports` : 'custom'}</code>
                              <span className="rb-lib-row-actions">
                                {definition && onPlaceModuleInstance && definition.id !== hierarchy?.activeModuleId ? (
                                  <button type="button" className="wb-btn wb-btn--ghost" data-testid={`ide-design-palette-place-${definition.id}`} title="Place an instance on the schematic" onClick={() => {
                                    const center = { x: (canvasSize.width / 2 - camera.x) / camera.zoom, y: (canvasSize.height / 2 - camera.y) / camera.zoom };
                                    onPlaceModuleInstance(definition.id, findSmartSpawnPosition(editorCircuit.nodes as Node[], center));
                                  }}>Place</button>
                                ) : null}
                                {definition && onOpenModule ? <button type="button" className="wb-btn wb-btn--ghost" title="Open the module definition" onClick={() => onOpenModule(definition.id)}>Open</button> : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {librarySectionOpen('reusable') ? (
                    <MacroLibraryPanel
                      macros={filteredMacros}
                      totalMacroCount={macros.length}
                      searchQuery={paletteQuery}
                      activeMacroId={activeMacroInsertionId}
                      onSelectMacro={handleSelectMacro}
                      onDeleteMacro={onDeleteMacro ? handleDeleteMacro : undefined}
                    />
                  ) : null}
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
          ) : activeLeftDockTab === 'hierarchy' ? (
            <SurfacePanel className="ide-design-project-browser" testId="ide-design-hierarchy">
              <header className="ide-design-subheader">
                <div><h3>Project Hierarchy</h3><p>{projectName ? `${projectName} · ` : ''}Open, reuse, and manage visual module sources.</p></div>
              </header>
              {hierarchy ? (
                <div className="ide-native-module-browser" data-testid="ide-design-native-module-browser">
                  <button
                    type="button"
                    className={isEditingTopModule ? 'is-active' : ''}
                    onClick={() => onOpenModule?.(TOP_MODULE_ID)}
                    data-testid="ide-design-open-top-module"
                  >
                    <span aria-hidden="true">◇</span>
                    <span><strong>{topEntityName || 'top'}</strong><small>Top module · board I/O owner</small></span>
                  </button>
                  {hierarchy.modules.map((module) => {
                    // Usage is counted in the circuit currently on the canvas
                    // (top OR an open module definition), so nested instances count too.
                    const usageCount = moduleUsageCount(editorCircuit, module.id);
                    return (
                      <article key={module.id} className={hierarchy.activeModuleId === module.id ? 'is-active' : ''}>
                        <button type="button" onClick={() => onOpenModule?.(module.id)} data-testid={`ide-design-open-module-${module.id}`}>
                          <span aria-hidden="true">▣</span>
                          <span><strong>{module.displayName}</strong><small>{module.ports.length} ports · {usageCount} instance{usageCount === 1 ? '' : 's'}</small></span>
                        </button>
                        <div className="ide-native-module-actions">
                          {onPlaceModuleInstance && module.id !== hierarchy.activeModuleId ? (
                            <button
                              type="button"
                              data-testid={`ide-design-place-module-${module.id}`}
                              title={isEditingTopModule ? 'Place an instance in the top design' : 'Place an instance inside the open module'}
                              onClick={() => {
                                const center = {
                                  x: (canvasSize.width / 2 - camera.x) / camera.zoom,
                                  y: (canvasSize.height / 2 - camera.y) / camera.zoom,
                                };
                                onPlaceModuleInstance(module.id, findSmartSpawnPosition(editorCircuit.nodes as Node[], center));
                              }}
                            >Use</button>
                          ) : null}
                          {isEditingTopModule && usageCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const instanceIds = editorCircuit.nodes
                                  .filter(
                                    (node) =>
                                      node.config?.moduleDefinitionId === module.id ||
                                      node.type === module.name
                                  )
                                  .map((node) => node.id);
                                selectMultipleNodes(instanceIds, false);
                                setActionToast(
                                  `Selected ${instanceIds.length} ${module.displayName} instance${instanceIds.length === 1 ? '' : 's'}.`
                                );
                              }}
                              data-testid={`ide-design-select-instances-${module.id}`}
                            >Instances</button>
                          ) : null}
                          {onDuplicateModuleDefinition ? <button type="button" onClick={() => onDuplicateModuleDefinition(module.id)}>Duplicate</button> : null}
                          {onDeleteModuleDefinition ? <button type="button" disabled={usageCount > 0} onClick={() => onDeleteModuleDefinition(module.id)}>Delete</button> : null}
                        </div>
                      </article>
                    );
                  })}
                  {hierarchy.modules.length === 0 ? (
                    <IdeEmptyState title="No custom components yet" body="Select connected logic on the top canvas, then choose Create component from selection." primaryAction={null} />
                  ) : null}
                </div>
              ) : (
                <div className="ide-design-tree" role="tree" aria-label="Module hierarchy">
                  {designHierarchyRows.map((node) => (
                    <button key={node.hierarchyId} type="button" role="treeitem" aria-level={node.depth + 1} aria-selected={node.selected} className={node.selected ? 'is-selected' : ''} style={{ '--rb-tree-depth': node.depth } as React.CSSProperties} onClick={() => handleHierarchyOpen(node.nodeId, node.depth, node.openTarget.componentType)}>
                      <span className="ide-design-tree-glyph" aria-hidden="true">{node.depth === 0 ? '◇' : node.children.length > 0 ? '▣' : '◆'}</span>
                      <span><strong>{node.label}</strong><small>{node.depth === 0 ? 'Top module' : node.runtimeType}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </SurfacePanel>
          ) : activeLeftDockTab === 'sources' ? (
            <SurfacePanel className="ide-design-project-browser" testId="ide-design-sources">
              <header className="ide-design-subheader">
                <div><h3>Design Sources</h3><p>Real project-owned documents only.</p></div>
              </header>
              <div className="ide-design-source-list">
                {designSources.entries.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => {
                      if (source.kind === 'visual-circuit') setDesignView('canvas');
                      else if (source.kind === 'hdl-source') setDesignView('hdl');
                      else {
                        setPaletteQuery(source.label);
                        setActiveLeftDockTab('components');
                      }
                    }}
                    data-testid={`ide-design-source-${source.kind}`}
                  >
                    <span aria-hidden="true">{source.kind === 'hdl-source' ? '</>' : source.kind === 'visual-circuit' ? '◇' : '▣'}</span>
                    <span>
                      <strong>{source.label}</strong>
                      <small>
                        {source.fileBacked
                          ? `${source.language.toUpperCase()} · preserved read-only source`
                          : source.kind === 'visual-circuit'
                            ? `${source.nodeCount} nodes · ${source.connectionCount} connections · canvas editable`
                            : `${source.nodeCount} nodes · definition inspect-only`}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="ide-copy">Generated VHDL and Verilog previews are outputs of the current visual source, not invented project files.</p>
            </SurfacePanel>
          ) : (
            <SurfacePanel className="ide-design-project-browser" testId="ide-design-board-dock">
              <header className="ide-design-subheader">
                <div><h3>Board I/O</h3></div>
              </header>
              {/* The list lives here, so the filter does too — one query, filtered per tab. */}
              <div className="rb-lib-toolbar">
                <div className="wb-search">
                  <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4" /><path d="M9 9l3.5 3.5" /></svg>
                  <input
                    type="search"
                    className="rb-lib-search-input"
                    aria-label="Filter board resources"
                    value={paletteQuery}
                    onChange={(event) => setPaletteQuery(event.target.value)}
                    placeholder="Filter resources, pins"
                    data-testid="ide-design-board-search"
                  />
                </div>
              </div>
              {/* Placeable board resources: switches, buttons, clock, LEDs, seven-segment. */}
              {filteredBoardGroups.length > 0 ? (
                <section
                  className="rb-lib-section"
                  data-testid="ide-design-palette-section-board"
                  data-collapsed={librarySectionOpen('board') ? 'false' : 'true'}
                >
                  <header className="rb-lib-section-header">
                    <div className="rb-lib-section-title">
                      <h4>{boardPaletteSection.title}</h4>
                    </div>
                    <div className="rb-lib-section-meta">
                      <span className="rb-lib-count">{boardResourcesCount}</span>
                      {renderLibrarySectionToggle('board', boardPaletteSection.title)}
                    </div>
                  </header>
                  {librarySectionOpen('board') ? (
                  <div className="rb-lib-board-groups" data-testid="ide-design-board-io-palette">
                      {filteredBoardGroups.map((group) => (
                        <div
                          key={group.id}
                          className="rb-lib-board-group"
                          data-testid={`ide-design-board-group-${group.id}`}
                        >
                          <div className="rb-lib-subheader">
                            <h5>{group.title}</h5>
                            <span className="rb-lib-count">{group.entries.length}</span>
                          </div>
                          <div className="rb-lib-chips">
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
                                  className={`rb-lib-chip${isPlaced ? ' is-placed' : ''}${isPending ? ' is-placement-active' : ''}`}
                                  type="button"
                                  onClick={() => beginBoardIoPlacement(entry)}
                                  onPointerDown={(event) =>
                                    beginPaletteCardDrag(event, {
                                      kind: 'board-io',
                                      entry,
                                      label: entry.alias,
                                    })
                                  }
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
              <div className="ide-design-board-binding-list">
                {ioRows.map((row) => {
                  const resource = getBasys3BoardResource(row.pin);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        selectMultipleNodes([row.nodeId], false);
                        setActiveRightDockTab('constraints');
                      }}
                    >
                      <span><strong>{row.label}</strong><small>{row.direction === 'in' ? 'Input' : 'Output'}</small></span>
                      <code>{resource ? `${resource.alias} · ${resource.packagePin}` : 'Unassigned'}</code>
                    </button>
                  );
                })}
              </div>
              {ioRows.length === 0 ? (
                <IdeEmptyState title="No top-level I/O" body="Place an input or output pin to create a board-assignable signal." primaryAction={null} />
              ) : null}
              {onGoToHardware ? (
                <IdeButton tone="secondary" onClick={onGoToHardware}>Open Board &amp; Constraints</IdeButton>
              ) : null}
            </SurfacePanel>
          )}
        </div>
      }
      inspector={
        <>
          <div className="wb-toolwindow-tabs rb-design-dock-tabs" role="tablist" aria-label="Design inspector">
            {(['inspector', 'properties', 'constraints'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeRightDockTab === tab}
                className={`wb-toolwindow-tab${activeRightDockTab === tab ? ' is-active' : ''}`}
                onClick={() => setActiveRightDockTab(tab)}
                data-testid={`ide-design-right-tab-${tab}`}
              >
                {tab === 'inspector' ? 'Inspector' : tab === 'properties' ? 'Properties' : 'Constraints'}
              </button>
            ))}
          </div>
          <div hidden={activeRightDockTab !== 'inspector'}>
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
          {hasSingleSelectedNode && selectedNode ? (
            <IdeInspectorSection
              title="Selection details"
              testId="ide-design-inspector-selection-details"
              collapsible={false}
            >
              {renderSelectedNodeDetails()}
            </IdeInspectorSection>
          ) : null}
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
                  <div className="rb-insp-facts ide-copy-top-gap" data-testid="ide-design-probe-list">
                    {pinnedProbeRows.map((probe) => (
                      <div className="rb-insp-row" key={probe.key}>
                        <code>{probe.label}</code>
                        <span>{probe.value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
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
                    className="rb-insp-canvas-default"
                    data-testid="ide-design-inspector-canvas-default"
                  >
                    <div
                      className="rb-insp-idle-card"
                      data-testid="ide-design-inspector-idle-card"
                    >
                      <span className="rb-insp-idle-eyebrow">
                        Design overview
                      </span>
                      {isEmptyCanvas ? (
                        <p className="ide-copy rb-insp-idle-empty-line">
                          Empty canvas. Drop a gate, an input, or load an example to begin.
                        </p>
                      ) : (
                        <dl
                          className="rb-insp-idle-stats"
                          data-testid="ide-design-inspector-idle-stats"
                        >
                          <div className="rb-insp-idle-stat">
                            <dt>Inputs</dt>
                            <dd data-testid="ide-design-inspector-idle-inputs">
                              {inputCountIdle}
                            </dd>
                          </div>
                          <div className="rb-insp-idle-stat">
                            <dt>Outputs</dt>
                            <dd data-testid="ide-design-inspector-idle-outputs">
                              {outputCountIdle}
                            </dd>
                          </div>
                          <div className="rb-insp-idle-stat">
                            <dt>Nodes</dt>
                            <dd data-testid="ide-design-inspector-idle-nodes">
                              {nodeCountIdle}
                            </dd>
                          </div>
                          <div className="rb-insp-idle-stat">
                            <dt>Wires</dt>
                            <dd data-testid="ide-design-inspector-idle-wires">
                              {connectionCountIdle}
                            </dd>
                          </div>
                        </dl>
                      )}
                      {hasIdleIoState ? (
                        <div
                          className="rb-insp-io-state"
                          data-testid="ide-design-inspector-io-state"
                        >
                          <div className="rb-insp-io-state-header">
                            <span>Current I/O</span>
                            <span className="rb-insp-io-state-kicker">Design state</span>
                          </div>
                          <div className="rb-insp-io-state-list">
                            {[...idleInputRows, ...idleOutputRows].map((row) => (
                              <div
                                key={`${row.kind}-${row.id}`}
                                className={`rb-insp-io-state-row is-${row.kind}`}
                                data-testid={`ide-design-inspector-${row.kind}-${row.id}`}
                              >
                                <span className="rb-insp-io-state-label">
                                  <strong>{row.label}</strong>
                                  <span>{row.kind === 'input' ? 'input' : 'output'}</span>
                                  {row.pinAlias ? <code>{row.pinAlias}</code> : null}
                                </span>
                                <code
                                  className="rb-insp-io-state-value"
                                  data-testid={`ide-design-inspector-${row.kind}-${row.id}-value`}
                                >
                                  {row.value}
                                </code>
                              </div>
                            ))}
                          </div>
                          <p
                            className="ide-copy rb-insp-proof-boundary"
                            data-testid="ide-design-inspector-proof-boundary"
                          >
                            This is live design state only. Verify owns behavior proof before trust or export.
                          </p>
                        </div>
                      ) : null}
                      {totalErrors > 0 || totalWarnings > 0 ? (
                        <p
                          className="ide-copy rb-insp-idle-issues"
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
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          )}
          </div>
          {activeRightDockTab === 'properties' ? (
            <div className="rb-insp-props" data-testid="ide-design-properties-panel">
              {renderSelectionIdentityCard()}
              {hasSingleSelectedNode && selectedNode ? (
                <>
                  {renderSelectedNodeDetails()}
                  {renderSelectionProperties()}
                  {selectedComponentDefinition ? (
                    <section className="rb-insp-section" data-testid="ide-design-component-contract">
                      <span className="rb-insp-group-label">Component contract</span>
                      <dl className="rb-insp-facts">
                        <div><dt>Component type</dt><dd>{selectedComponentDefinition.displayName}</dd></div>
                        <div><dt>Category</dt><dd>{selectedComponentDefinition.category.replaceAll('-', ' ')}</dd></div>
                        <div><dt>Ports</dt><dd>{selectedComponentDefinition.ports.length}</dd></div>
                        <div><dt>Compatibility</dt><dd>{selectedComponentDefinition.compatibilityTier === 1 ? 'Native visual path' : `Limited path · Tier ${selectedComponentDefinition.compatibilityTier}`}</dd></div>
                        <div><dt>Simulation</dt><dd>{selectedComponentDefinition.simulationCapability.supported ? 'Supported' : 'Not supported'}</dd></div>
                        <div><dt>HDL export</dt><dd>{selectedComponentDefinition.exportCapability.supported ? 'Supported' : 'Not supported'}</dd></div>
                      </dl>
                      <p className="ide-copy">{selectedComponentDefinition.compatibilityNote}</p>
                    </section>
                  ) : null}
                </>
              ) : (
                <IdeEmptyState title="No editable selection" body="Select one component to inspect its current project-owned properties." primaryAction={null} />
              )}
            </div>
          ) : null}
          {activeRightDockTab === 'constraints' ? renderInlineBoardAssignment() : null}
        </>
      }
    >
        <DesignWorkspaceFrame view={effectiveDesignView} canvasAppearance={canvasAppearance} canvasDensity={canvasDensity}>
          <div className="ide-surface-command-stack">

            {/* ── Schematic document header: module trail · wire cue · mode ── */}
            <div
              className="wb-toolbar rb-design-header"
              data-testid="ide-design-control-bar"
              data-hierarchy-surface="design"
              data-hierarchy-role="context"
            >
              <nav className="rb-design-breadcrumb" aria-label="Design hierarchy" data-testid="ide-design-module-breadcrumb">
                <button type="button" onClick={() => onOpenModule?.(TOP_MODULE_ID)} className={isEditingTopModule ? 'is-current' : ''}>
                  {topEntityName || 'top'}
                </button>
                {activeNativeModule ? (
                  <>
                    <span className="wb-sep" aria-hidden="true">›</span>
                    <button type="button" className="is-current" onClick={() => onOpenModule?.(activeNativeModule.id)}>
                      {drilledInstance?.moduleId === activeNativeModule.id ? (
                        <span data-testid="ide-design-breadcrumb-instance">
                          {drilledInstance.instanceName}
                          <span className="ide-design-breadcrumb-of"> : {activeNativeModule.displayName}</span>
                        </span>
                      ) : (
                        activeNativeModule.displayName
                      )}
                    </button>
                  </>
                ) : null}
              </nav>
              {toolMode === 'wire' && !isPlacementMode ? (
                <div className="rb-design-wirecue" data-testid="ide-design-wire-cuebar" data-wire-active={wireStartPort ? '1' : '0'}>
                  <span className="rb-design-wirecue-badge">Wire</span>
                  <span
                    className={`rb-design-wirecue-msg${wireFeedback ? ' is-error' : ''}`}
                    data-testid="ide-design-wire-cue"
                    data-wire-source-label={wireSourceLabel ?? ''}
                    data-wire-active={wireStartPort ? '1' : '0'}
                  >
                    {wireFeedback ? (
                      <span data-testid="ide-design-wire-feedback">{wireFeedback}</span>
                    ) : wireStartPort ? (
                      <span><code>{wireSourceLabel}</code> selected — choose a compatible input</span>
                    ) : (
                      <span>Choose an output port to start a wire</span>
                    )}
                  </span>
                  {wireStartPort ? (
                    <button type="button" className="wb-btn wb-btn--ghost" onClick={cancelActiveWire} data-testid="ide-design-wire-cancel">
                      Cancel
                    </button>
                  ) : (
                    <span className="wb-toolbar-meta" aria-hidden="true">Esc cancels</span>
                  )}
                </div>
              ) : null}
              {isPlacementMode && placementModeLabel ? (
                <span className="wb-toolbar-meta" data-testid="ide-design-placement-hint">
                  Placing <code>{placementModeLabel}</code> · click the canvas · Esc cancels
                </span>
              ) : null}
              <span className="wb-toolbar-spacer" />
              {!isCodeWorkspace ? (
                <div
                  className={`rb-design-health ${authoringStatusToneClass}`}
                  data-testid="ide-design-authoring-summary"
                  title={designStatusNote ?? authoringStatusLabel}
                >
                  <span className="rb-design-health-dot" aria-hidden="true" />
                  <span className="rb-design-health-label" data-testid="ide-design-authoring-summary-status">{authoringStatusLabel}</span>
                  <code className="rb-design-health-counts" data-testid="ide-design-authoring-summary-counts">
                    {totalAuthoringErrors}E {totalAuthoringWarnings}W
                  </code>
                </div>
              ) : null}
              {effectiveLearningMode === 'live' ? (
                <div className="wb-toolbar-group" data-testid="ide-design-live-transport" aria-label="Exploratory simulation controls">
                  <button type="button" className="wb-btn" onClick={simRunning ? pauseSimulation : startSimulation} data-testid="ide-design-live-run">
                    {simRunning ? 'Pause' : 'Run'}
                  </button>
                  <button type="button" className="wb-btn wb-btn--ghost" onClick={stepSimulation} data-testid="ide-design-live-step">Step</button>
                  <button type="button" className="wb-btn wb-btn--ghost" onClick={resetSimulation} data-testid="ide-design-live-reset">Reset</button>
                  <span className="wb-toolbar-meta" data-testid="ide-design-live-tick"><code>tick {runtimeSim.tick}</code></span>
                  <span className="wb-toolbar-sep" />
                </div>
              ) : null}
              {!isCodeWorkspace ? (
                <div className="wb-segment rb-design-mode" role="group" aria-label="Design mode" data-testid="ide-design-learning-mode" data-mode={effectiveLearningMode}>
                  <button
                    type="button"
                    className="wb-btn"
                    aria-pressed={effectiveLearningMode === 'edit'}
                    onClick={handleResumeLiveEditing}
                    data-testid="ide-design-learning-mode-edit"
                    title="Author circuit structure"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="wb-btn"
                    aria-pressed={effectiveLearningMode === 'live'}
                    disabled={!hasRunnablePath}
                    title={hasRunnablePath ? 'Explore current circuit values (exploratory, not saved evidence)' : 'Connect at least one input to one output through supported logic.'}
                    onClick={() => {
                      onClearExternalDebug?.();
                      setDesignLearningMode('live');
                    }}
                    data-testid="ide-design-learning-mode-live"
                  >
                    Live
                  </button>
                  <button
                    type="button"
                    className="wb-btn"
                    aria-pressed={effectiveLearningMode === 'replay'}
                    disabled={!replaySession || replayTrace.length === 0}
                    title={replaySession && replayTrace.length > 0 ? 'Inspect the recorded run (read-only evidence)' : 'Run a scenario in Simulate to create a replay.'}
                    onClick={() => onSelectDebugTickIndex?.(0)}
                    data-testid="ide-design-learning-mode-replay"
                  >
                    Replay
                  </button>
                </div>
              ) : null}
            </div>
            {guidedLabTask && guidedLabDesignChecklist ? (
              <section
                className="ide-design-context-disclosure"
                data-testid="ide-design-guided-lab-disclosure"
                aria-label={`Lab checklist: ${guidedLabTask.shortTitle}`}
              >
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
                </div>
              </section>
              </section>
            ) : null}
            {/* ── Schematic toolbar: tool · history · view · camera · layout ── */}
            <div className="wb-toolbar rb-design-toolbar" data-testid="ide-design-toolbar">
              {isCodeWorkspace ? (
                <span className="wb-toolbar-title" data-testid="ide-design-code-context">
                  <code data-testid="ide-design-code-context-primary-artifact">{primaryArtifactFileName}</code>
                </span>
              ) : workspacePreset.showCanvasTools ? (
                <>
                  <div className="wb-segment" data-testid="ide-design-tool-segmented" role="group" aria-label="Tool">
                    <button type="button" className="wb-btn" onClick={setSelectMode} data-testid="ide-design-tool-select" aria-pressed={toolMode === 'select'} title="Select tool (S)">
                      <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M3 2l8 5.5-3.6.8L9.2 12l-1.6.7-1.8-3.6L3 11.5z" /></svg>
                      Select
                    </button>
                    <button type="button" className="wb-btn" onClick={setWireMode} data-testid="ide-design-tool-wire" aria-pressed={toolMode === 'wire'} title="Wire tool (W)">
                      <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 11h4v-8h6" /><circle cx="2" cy="11" r="1.4" fill="currentColor" /><circle cx="12" cy="3" r="1.4" fill="currentColor" /></svg>
                      Wire
                    </button>
                  </div>
                  <span className="wb-toolbar-sep" />
                  <button type="button" className="wb-btn wb-btn--ghost wb-btn--icon" onClick={handleUndo} disabled={undoDepth === 0} data-testid="ide-design-tool-undo" title="Undo (Ctrl Z)" aria-label="Undo">↶</button>
                  <button type="button" className="wb-btn wb-btn--ghost wb-btn--icon" onClick={handleRedo} disabled={redoDepth === 0} data-testid="ide-design-tool-redo" title="Redo (Ctrl Y)" aria-label="Redo">↷</button>
                  <span className="wb-toolbar-sep" />
                </>
              ) : null}
              <div className="wb-segment" data-testid="ide-design-view-toggle" role="group" aria-label="Document view">
                {(['canvas', 'hdl', 'split'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="wb-btn"
                    aria-pressed={designView === v}
                    onClick={() => setDesignView(v)}
                    data-testid={`ide-design-view-${v}`}
                  >
                    {v === 'canvas' ? 'Schematic' : v === 'hdl' ? 'HDL' : 'Split'}
                  </button>
                ))}
              </div>
              {workspacePreset.showCanvasTools ? (
                <>
                  <span className="wb-toolbar-sep" />
                  <button type="button" className="wb-btn wb-btn--ghost" onClick={() => fitToCircuit()} data-testid="ide-design-fit-circuit-canvas" title="Fit design">Fit</button>
                  <button type="button" className="wb-btn wb-btn--ghost" onClick={centerSelection} disabled={selection.nodes.size === 0} data-testid="ide-design-center-selection-canvas" title="Fit selection">Selection</button>
                  <button type="button" className="wb-btn wb-btn--ghost wb-btn--icon" onClick={zoomOut} data-testid="ide-design-zoom-out" aria-label="Zoom out" title="Zoom out">−</button>
                  <button type="button" className="wb-btn wb-btn--ghost rb-design-zoom" onClick={zoomTo100} data-testid="ide-design-zoom-readout" title="Zoom — click to return to 100%">
                    <code data-testid="ide-design-canvas-stat-zoom">{Math.round(camera.zoom * 100)}%</code>
                  </button>
                  <button type="button" className="wb-btn wb-btn--ghost wb-btn--icon" onClick={zoomIn} data-testid="ide-design-zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
                  <span className="wb-toolbar-sep" />
                  <div className="wb-segment rb-design-trace" role="group" aria-label="Trace" data-testid="ide-design-trace-toolbar">
                    <button type="button" className="wb-btn" onClick={focusSelectedPath} disabled={!selectedNode} data-testid="ide-design-trace-driver" title="Focus the path that drives the selected object (Shift+D)">
                      <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 7h6M7.5 4l3 3-3 3M10.5 3v8" /></svg>
                      Driver
                    </button>
                    <button type="button" className="wb-btn" onClick={() => selectedNode && handleFanoutTrace(selectedNode.id)} disabled={!selectedNodeHasFanout} data-testid="ide-design-trace-loads" title="Highlight everything the selected object drives">
                      <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 7h5M6.5 7l4-3.5M6.5 7l4 3.5M10.5 3.5h2M10.5 10.5h2" /></svg>
                      Loads
                    </button>
                    {designRelated ? (
                      <RelatedMenu relation={designRelated} activeScenarioId={null} hasRun={designRelated.run !== null} origin="schematic" testId="ide-design-trace-related" />
                    ) : null}
                  </div>
                  <span className="wb-toolbar-sep" />
                  <details className="rb-design-menu" data-testid="ide-design-layers" data-blocks-canvas-placement="1" data-blocks-macro-placement="1">
                    <summary className="wb-btn wb-btn--ghost" title="Presentation layers (persisted with the workspace)">Layers ▾</summary>
                    <div className="wb-menu rb-design-menu-popup" aria-label="Schematic layers">
                      {(
                        [
                          ['netLabels', 'Net labels'],
                          ['values', 'Live values'],
                          ['boardBindings', 'Board bindings'],
                          ['hierarchy', 'Hierarchy boundaries'],
                          ['buses', 'Bus brackets'],
                          ['diagnostics', 'Diagnostics'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={designLayers[id]}
                          className="wb-menu-item"
                          onClick={() => workspacePreferencesStore.setDesignLayer(id, !designLayers[id])}
                          data-testid={`ide-design-layer-${id}`}
                        >
                          <span className="wb-menu-item-check" aria-hidden="true">{designLayers[id] ? '●' : ''}</span>
                          <span className="wb-menu-item-label">{label}</span>
                        </button>
                      ))}
                      <div className="wb-menu-sep" />
                      <button
                        type="button"
                        className="wb-menu-item"
                        onClick={() => {
                          for (const id of ['netLabels', 'values', 'boardBindings', 'hierarchy', 'buses', 'diagnostics'] as const) workspacePreferencesStore.setDesignLayer(id, true);
                        }}
                        data-testid="ide-design-layers-reset"
                      >
                        <span className="wb-menu-item-check" aria-hidden="true" /><span className="wb-menu-item-label">Show all layers</span>
                      </button>
                    </div>
                  </details>
                  <details className="rb-design-menu" data-testid="ide-design-toolbar-overflow" data-blocks-canvas-placement="1" data-blocks-macro-placement="1">
                    <summary className="wb-btn wb-btn--ghost">Layout ▾</summary>
                    <div className="wb-menu rb-design-menu-popup" aria-label="Layout and canvas">
                      <button type="button" className="wb-menu-item" onClick={handleArrangeCircuit} disabled={editorCircuit.nodes.length < 2 || isReplayMode} data-testid="ide-design-arrange">
                        <span className="wb-menu-item-check" aria-hidden="true" /><span className="wb-menu-item-label">Arrange by dependency</span><span className="wb-menu-item-key" />
                      </button>
                      <button type="button" className="wb-menu-item" onClick={toggleSnapToGrid} data-testid="ide-design-tool-snap" aria-pressed={snapToGrid}>
                        <span className="wb-menu-item-check" aria-hidden="true">{snapToGrid ? '●' : ''}</span><span className="wb-menu-item-label">Snap to grid</span><span className="wb-menu-item-key">G</span>
                      </button>
                      <button type="button" className="wb-menu-item" onClick={resetView} data-testid="ide-design-zoom-reset">
                        <span className="wb-menu-item-check" aria-hidden="true" /><span className="wb-menu-item-label">Reset view</span><span className="wb-menu-item-key" />
                      </button>
                      <div className="wb-menu-sep" />
                      <label className="wb-menu-item rb-design-menu-field">
                        <span className="wb-menu-item-check" aria-hidden="true" /><span className="wb-menu-item-label">Canvas</span>
                        <select value={canvasAppearance} onChange={(event) => workspacePreferencesStore.setDesignCanvasAppearance(event.target.value as 'dark' | 'light' | 'system')} aria-label="Canvas appearance">
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">Follow application</option>
                        </select>
                      </label>
                      <label className="wb-menu-item rb-design-menu-field">
                        <span className="wb-menu-item-check" aria-hidden="true" /><span className="wb-menu-item-label">Density</span>
                        <select value={canvasDensity} onChange={(event) => workspacePreferencesStore.setDesignCanvasDensity(event.target.value as 'comfortable' | 'compact')} aria-label="Canvas density">
                          <option value="comfortable">Comfortable</option>
                          <option value="compact">Compact</option>
                        </select>
                      </label>
                    </div>
                  </details>
                </>
              ) : null}
              <span className="wb-toolbar-spacer" />
            </div>
            {/* ── Expanded secondary toolbar ── */}
            {/* ── Stacked-view notice — shown only when split auto-collapsed to column ── */}
            {/* Starter identity lives in the project name and the Project overview; no narration strip. */}

            {showWorkspaceStatusBar ? (
              <div
                className={`ide-design-workspace-status-bar${isReplayMode ? ' is-replay-mode' : ''}`}
                data-testid="ide-design-workspace-status-bar"
              >
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
                        {totalAuthoringErrors} errors
                      </span>
                      <span
                        className="ide-design-workspace-health-count is-warn"
                        data-testid="ide-design-authoring-issues-warnings"
                      >
                        {totalAuthoringWarnings} warnings
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
                      <div
                        className="ide-design-replay-transport"
                        data-testid="ide-design-replay-transport"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === ' ') {
                            event.preventDefault();
                            setReplayPlaying((playing) => !playing);
                          } else if (event.key === 'ArrowLeft') {
                            event.preventDefault();
                            selectReplayIndex(
                              event.shiftKey
                                ? previousReplayTransitionIndex
                                : previousReplayEventIndex
                            );
                          } else if (event.key === 'ArrowRight') {
                            event.preventDefault();
                            selectReplayIndex(
                              event.shiftKey
                                ? nextReplayTransitionIndex
                                : nextReplayEventIndex
                            );
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            setReplayPlaying(false);
                            onClearExternalDebug?.();
                          }
                        }}
                      >
                        <div className="ide-design-replay-transport-heading">
                          <strong>Circuit replay</strong>
                          <span>Authored events and signal transitions · read-only canvas</span>
                        </div>
                        {activeSequentialReplayFrame ? (
                          <div
                            className="ide-design-replay-state-context"
                            data-testid="ide-design-replay-state-context"
                          >
                            <span>Event {activeSequentialReplayFrame.eventNumber} / {activeSequentialReplayFrame.eventCount}</span>
                            <span>D {activeSequentialReplayFrame.data ?? '?'}</span>
                            <span>CLK {activeSequentialReplayFrame.clock ?? '?'}</span>
                            <span>RESET {activeSequentialReplayFrame.reset ?? '?'}</span>
                            <span>Edge {activeSequentialReplayFrame.edge}</span>
                            <span>Q {activeSequentialReplayFrame.preState ?? '?'} → {activeSequentialReplayFrame.postState ?? '?'}</span>
                            <span>{activeSequentialReplayFrame.stateChanged ? 'State changed' : 'State held'}</span>
                          </div>
                        ) : null}
                        <div className="ide-design-debug-nav" data-testid="ide-design-debug-nav">
                          <IdeButton
                            tone="ghost"
                            onClick={() => selectReplayIndex(sequentialReplay.eventSampleIndexes[0] ?? 0)}
                            disabled={previousReplayEventIndex == null}
                            testId="ide-design-replay-first"
                          >
                            First event
                          </IdeButton>
                          <IdeButton
                            tone="ghost"
                            onClick={() => selectReplayIndex(previousReplayEventIndex)}
                            disabled={previousReplayEventIndex == null}
                            testId="ide-design-debug-prev"
                          >
                            Prev event
                          </IdeButton>
                          <IdeButton
                            tone="ghost"
                            onClick={() => selectReplayIndex(previousReplayTransitionIndex)}
                            disabled={previousReplayTransitionIndex == null}
                            testId="ide-design-replay-prev-transition"
                          >
                            Prev transition
                          </IdeButton>
                          <IdeButton
                            tone="primary"
                            onClick={() => setReplayPlaying((playing) => !playing)}
                            testId="ide-design-replay-play"
                          >
                            {replayPlaying ? 'Pause' : 'Play'}
                          </IdeButton>
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
                          <IdeButton
                            tone="ghost"
                            onClick={() => selectReplayIndex(nextReplayTransitionIndex)}
                            disabled={nextReplayTransitionIndex == null}
                            testId="ide-design-replay-next-transition"
                          >
                            Next transition
                          </IdeButton>
                          <IdeButton
                            tone="ghost"
                            onClick={() => selectReplayIndex(nextReplayEventIndex)}
                            disabled={nextReplayEventIndex == null}
                            testId="ide-design-debug-next"
                          >
                            Next event
                          </IdeButton>
                          <IdeButton
                            tone="ghost"
                            onClick={() =>
                              selectReplayIndex(
                                sequentialReplay.eventSampleIndexes[
                                  sequentialReplay.eventSampleIndexes.length - 1
                                ] ?? null
                              )
                            }
                            disabled={nextReplayEventIndex == null}
                            testId="ide-design-replay-last"
                          >
                            Last event
                          </IdeButton>
                          <label className="ide-design-replay-speed">
                            Speed
                            <select
                              value={replaySpeed}
                              onChange={(event) => setReplaySpeed(Number(event.target.value) as 0.5 | 1 | 2)}
                              data-testid="ide-design-replay-speed"
                            >
                              <option value={0.5}>0.5×</option>
                              <option value={1}>1×</option>
                              <option value={2}>2×</option>
                            </select>
                          </label>
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
                  {hasDesignDiagnostics ? (
                    <IdeButton
                      tone={compilerErrorCount > 0 ? 'secondary' : 'ghost'}
                      onClick={() => setDiagnosticsDialogOpen(true)}
                      testId="ide-design-open-diagnostics"
                    >
                      Diagnostics
                    </IdeButton>
                  ) : null}
                  {topAuthoringIssue ? (
                    <IdeButton
                      tone={topAuthoringIssue.blocking ? 'secondary' : 'ghost'}
                      onClick={() => focusDesignIssue(topAuthoringIssue)}
                      testId="ide-design-authoring-issue-focus-0"
                    >
                      {topAuthoringIssue.kind === 'floating-output' && topAuthoringIssueLabel
                        ? `Fix ${topAuthoringIssueLabel} wiring`
                        : 'Review issue'}
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
                </div>
              </div>
            ) : null}
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
              className="ide-design-canvasWrap ide-design-canvas-work-object"
              data-testid="ide-design-canvas-wrap"
              data-work-object="circuit"
              aria-label="Circuit authoring workspace"
            >
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
                  className="rb-sch-frame"
                  data-testid="ide-design-canvas"
                  data-hierarchy-surface="design"
                  data-hierarchy-role="primary"
                  data-hierarchy-focal="circuit-canvas"
                >
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
                              Rerun simulation
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
                            Return to Simulate
                          </IdeButton>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`rb-sch-stage ${toolMode === 'wire' ? 'is-wire-mode' : 'is-select-mode'} ${
                      presentationZoom === 'classroom' ? 'is-presentation-zoom' : ''
                    }`}
                    ref={bindCanvasHost}
                    data-testid="ide-design-live-canvas"
                    data-tool-mode={toolMode}
                    data-interaction-mode={effectiveInteractionMode}
                    data-learning-mode={effectiveLearningMode}
                    data-wire-active={wireStartPort ? '1' : '0'}
                    data-wire-source-label={wireSourceLabel ?? ''}
                    data-placement-active={isPlacementMode ? '1' : '0'}
                    data-presentation-zoom={presentationZoom}
                    data-macro-placement-active={activeInsertionMacro ? '1' : '0'}
                    onPointerDownCapture={handleWireModePointerDownCapture}
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
                        className="rb-sch-mode"
                        data-testid="ide-design-canvas-mode-indicator"
                        data-blocks-canvas-placement="1"
                      >
                        {activeModeLabel}
                      </div>
                    ) : null}
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
                      appearance={canvasAppearance === 'dark' ? 'dark' : 'light'}
                      renderer="schematic"
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
                        if (!node) return;
                        const moduleDefinitionId = typeof node.config?.moduleDefinitionId === 'string'
                          ? node.config.moduleDefinitionId
                          : null;
                        const nativeModule = hierarchy?.modules.find(
                          (module) => module.id === moduleDefinitionId || module.name === node.type,
                        );
                        if (nativeModule && onOpenModule) {
                          setDrilledInstance({
                            moduleId: nativeModule.id,
                            instanceName: readInstanceName(node) || node.label || node.id,
                          });
                          onOpenModule(nativeModule.id);
                          return;
                        }
                        beginNodeLabelEdit(node, 'canvas');
                      }}
                      onPlacementCancel={() => cancelActivePlacement('escape')}
                      layers={designLayers}
                      mismatchNodeIds={replayMismatchNodeIds}
                      busGroups={designBusGroups}
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
                      onNodeContextMenu={({ nodeId, clientX, clientY }) => {
                        if (isReplayMode || !canvasViewportRef.current) return;
                        const rect = canvasViewportRef.current.getBoundingClientRect();
                        // Right-click adopts the node into the selection, the standard
                        // precondition for the selection-based menu actions below.
                        selectMultipleNodes([nodeId], false);
                        setNodeContextMenu({
                          x: Math.max(12, Math.min(rect.width - 188, clientX - rect.left)),
                          y: Math.max(12, Math.min(rect.height - 190, clientY - rect.top)),
                          nodeId,
                        });
                      }}
                      onCanvasContextMenu={({ clientX, clientY }) => {
                        if (isReplayMode || !canvasViewportRef.current) return;
                        const rect = canvasViewportRef.current.getBoundingClientRect();
                        setCanvasContextMenu({
                          x: Math.max(12, Math.min(rect.width - 188, clientX - rect.left)),
                          y: Math.max(12, Math.min(rect.height - 168, clientY - rect.top)),
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
                        <span className="ide-design-empty-eyebrow">Blank circuit</span>
                        <h3>Start a circuit</h3>
                        <div className="ide-design-empty-actions">
                          <IdeButton tone="secondary" onClick={() => beginNodePlacement('INPUT')} testId="ide-design-empty-add-input">
                            Add input
                          </IdeButton>
                          <IdeButton tone="secondary" onClick={() => beginNodePlacement('OUTPUT')} testId="ide-design-empty-add-output">
                            Add output
                          </IdeButton>
                          {onRuntimeCreateBus ? (
                            <IdeButton tone="secondary" onClick={() => openBusDialog('input')} testId="ide-design-empty-add-bus">
                              Add bus
                            </IdeButton>
                          ) : null}
                          <IdeButton tone="ghost" onClick={() => beginNodePlacement('AND')} testId="ide-design-empty-place-gate">
                            Place gate
                          </IdeButton>
                        </div>
                        <p className="ide-design-empty-summary">The Component Library stays available for every supported gate and register.</p>
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
                          <strong>Drop a gate, wire ports, then run Simulate.</strong>
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
                    {nodeContextMenu ? (() => {
                      const menuNode = editorCircuit.nodes.find((n) => n.id === nodeContextMenu.nodeId);
                      if (!menuNode) return null;
                      const moduleDefinitionId = typeof menuNode.config?.moduleDefinitionId === 'string'
                        ? menuNode.config.moduleDefinitionId
                        : null;
                      const nativeModule = hierarchy?.modules.find(
                        (module) => module.id === moduleDefinitionId || module.name === menuNode.type,
                      );
                      return (
                        <div
                          className="ide-design-wire-context-menu"
                          data-testid="ide-design-node-context-menu"
                          data-blocks-canvas-placement="1"
                          data-blocks-macro-placement="1"
                          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {nativeModule && onOpenModule ? (
                            <button
                              type="button"
                              className="ide-design-wire-context-menu-item"
                              onClick={() => {
                                setDrilledInstance({
                                  moduleId: nativeModule.id,
                                  instanceName:
                                    readInstanceName(menuNode) || menuNode.label || menuNode.id,
                                });
                                onOpenModule(nativeModule.id);
                                setNodeContextMenu(null);
                              }}
                              data-testid="ide-design-node-menu-open-module"
                            >
                              Open {nativeModule.displayName} definition
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="ide-design-wire-context-menu-item"
                            onClick={() => {
                              beginNodeLabelEdit(menuNode, 'canvas');
                              setNodeContextMenu(null);
                            }}
                            data-testid="ide-design-node-menu-rename"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="ide-design-wire-context-menu-item"
                            onClick={() => {
                              handleDuplicate();
                              setNodeContextMenu(null);
                            }}
                            data-testid="ide-design-node-menu-duplicate"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="ide-design-wire-context-menu-item"
                            onClick={() => {
                              handleCopy();
                              setNodeContextMenu(null);
                            }}
                            data-testid="ide-design-node-menu-copy"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            className="ide-design-wire-context-menu-item"
                            onClick={() => {
                              deleteSelection();
                              setNodeContextMenu(null);
                            }}
                            data-testid="ide-design-node-menu-delete"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })() : null}
                    {canvasContextMenu ? (
                      <div
                        className="ide-design-wire-context-menu"
                        data-testid="ide-design-canvas-context-menu"
                        data-blocks-canvas-placement="1"
                        data-blocks-macro-placement="1"
                        style={{ left: canvasContextMenu.x, top: canvasContextMenu.y }}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="ide-design-wire-context-menu-item"
                          onClick={() => {
                            handlePaste();
                            setCanvasContextMenu(null);
                          }}
                          disabled={!clipboard}
                          data-testid="ide-design-canvas-menu-paste"
                        >
                          Paste
                        </button>
                        <button
                          type="button"
                          className="ide-design-wire-context-menu-item"
                          onClick={() => {
                            handleSelectAll();
                            setCanvasContextMenu(null);
                          }}
                          disabled={editorCircuit.nodes.length === 0}
                          data-testid="ide-design-canvas-menu-select-all"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="ide-design-wire-context-menu-item"
                          onClick={() => {
                            fitToCircuit();
                            setCanvasContextMenu(null);
                          }}
                          data-testid="ide-design-canvas-menu-fit"
                        >
                          Fit view
                        </button>
                        <button
                          type="button"
                          className="ide-design-wire-context-menu-item"
                          onClick={() => {
                            handleArrangeCircuit();
                            setCanvasContextMenu(null);
                          }}
                          disabled={editorCircuit.nodes.length < 2}
                          data-testid="ide-design-canvas-menu-arrange"
                        >
                          Arrange circuit
                        </button>
                      </div>
                    ) : null}
                    {renameOnCanvas && editingLabelNodeId ? (() => {
                      const renameNode = editorCircuit.nodes.find((n) => n.id === editingLabelNodeId);
                      if (!renameNode) return null;
                      const screenX = (renameNode.position?.x ?? renameNode.x ?? 0) * camera.zoom + camera.x;
                      const screenY = (renameNode.position?.y ?? renameNode.y ?? 0) * camera.zoom + camera.y;
                      return (
                        <div
                          className="ide-design-canvas-rename"
                          data-testid="ide-design-canvas-rename"
                          data-blocks-canvas-placement="1"
                          data-blocks-macro-placement="1"
                          style={{
                            left: Math.max(8, Math.min(canvasSize.width - 168, screenX - 80)),
                            top: Math.max(8, Math.min(canvasSize.height - 40, screenY + 34)),
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <input
                            className="ide-text-input ide-design-canvas-rename-input"
                            type="text"
                            value={labelDraft}
                            onChange={(e) => setLabelDraft(e.target.value)}
                            onKeyDown={handleLabelKeyDown}
                            onBlur={commitNodeLabel}
                            autoFocus
                            placeholder="Signal or part name…"
                            aria-label={`Rename ${nodeTypeLabel(renameNode.type)}`}
                            data-testid="ide-design-canvas-rename-input"
                            maxLength={32}
                          />
                        </div>
                      );
                    })() : null}
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
                          ? `Close ${secondaryArtifactLabel}`
                          : `Open ${secondaryArtifactLabel}`
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
      {moduleDialog ? (
        <IdeModal
          title="Create project component"
          testId="ide-design-create-module-dialog"
          onClose={() => setModuleDialog(null)}
          body={
            <div className="ide-module-create-dialog">
              <p className="ide-copy">
                The selected {moduleDialog.analysis.selectedComponentCount} components will become one editable definition and one reusable instance.
              </p>
              <div className="ide-module-create-fields">
                <label>
                  <span>Module name</span>
                  <input value={moduleDialog.moduleName} onChange={(event) => setModuleDialog((current) => current ? { ...current, moduleName: event.target.value, error: null } : current)} data-testid="ide-design-create-module-name" />
                </label>
                <label>
                  <span>Instance name</span>
                  <input value={moduleDialog.instanceName} onChange={(event) => setModuleDialog((current) => current ? { ...current, instanceName: event.target.value, error: null } : current)} data-testid="ide-design-create-instance-name" />
                </label>
              </div>
              <section className="ide-module-port-editor" aria-label="Module ports">
                <header><strong>Inferred ports</strong><span>{moduleDialog.analysis.inputs.length} in · {moduleDialog.analysis.outputs.length} out</span></header>
                {[...moduleDialog.analysis.inputs, ...moduleDialog.analysis.outputs].map((port) => (
                  <label key={port.id}>
                    <span className={`is-${port.direction}`}>{port.direction === 'input' ? 'IN' : 'OUT'}</span>
                    <input
                      value={moduleDialog.portNames[port.id] ?? ''}
                      onChange={(event) => setModuleDialog((current) => current ? {
                        ...current,
                        portNames: { ...current.portNames, [port.id]: event.target.value },
                        error: null,
                      } : current)}
                      data-testid={`ide-design-create-port-${port.id}`}
                    />
                    <code>{port.internalRefs.map((ref) => `${ref.nodeId}.${ref.portName}`).join(', ')}</code>
                  </label>
                ))}
              </section>
              {moduleDialog.analysis.warnings.map((warning) => <IdeCallout key={warning} tone="warn">{warning}</IdeCallout>)}
              {moduleDialog.error ? <IdeCallout tone="error" testId="ide-design-create-module-error">{moduleDialog.error}</IdeCallout> : null}
            </div>
          }
          actions={
            <>
              <IdeButton tone="ghost" onClick={() => setModuleDialog(null)}>Cancel</IdeButton>
              <IdeButton
                tone="primary"
                onClick={confirmCreateModule}
                disabled={!moduleDialog.analysis.ok || !moduleDialog.moduleName.trim() || !moduleDialog.instanceName.trim()}
                testId="ide-design-create-module-confirm"
              >
                Create and replace selection
              </IdeButton>
            </>
          }
        />
      ) : null}
      {busDialog ? (
        <IdeModal
          title="Create bus"
          testId="ide-design-create-bus-dialog"
          onClose={() => setBusDialog(null)}
          body={
            <div className="ide-module-create-dialog">
              <p className="ide-copy">
                A bus is a declared vector signal — one identity that carries several
                bits (for example <code>A[3:0]</code>). Bits appear on the canvas and
                map to the board as a group.
              </p>
              <div className="ide-module-create-fields">
                <label>
                  <span>Direction</span>
                  <select
                    value={busDialog.direction}
                    onChange={(event) =>
                      setBusDialog((current) =>
                        current
                          ? { ...current, direction: event.target.value as 'input' | 'output', error: null }
                          : current
                      )
                    }
                    data-testid="ide-design-create-bus-direction"
                  >
                    <option value="input">Input</option>
                    <option value="output">Output</option>
                  </select>
                </label>
                <label>
                  <span>Name</span>
                  <input
                    value={busDialog.name}
                    placeholder="A"
                    onChange={(event) =>
                      setBusDialog((current) =>
                        current ? { ...current, name: event.target.value, error: null } : current
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitBusDialog();
                      }
                    }}
                    data-testid="ide-design-create-bus-name"
                  />
                </label>
                <label>
                  <span>Width (bits)</span>
                  <input
                    type="number"
                    min={2}
                    max={32}
                    value={busDialog.width}
                    onChange={(event) =>
                      setBusDialog((current) =>
                        current
                          ? {
                              ...current,
                              width: Math.max(2, Math.min(32, Number.parseInt(event.target.value, 10) || 2)),
                              error: null,
                            }
                          : current
                      )
                    }
                    data-testid="ide-design-create-bus-width"
                  />
                </label>
              </div>
              <p className="ide-copy ide-copy--flush" data-testid="ide-design-create-bus-preview">
                Creates <code>{(busDialog.name.trim() || 'A')}[{Math.max(1, busDialog.width - 1)}:0]</code>{' '}
                — {busDialog.width} {busDialog.direction} bit{busDialog.width === 1 ? '' : 's'}.
              </p>
              {busDialog.error ? (
                <IdeCallout tone="error" testId="ide-design-create-bus-error">
                  {busDialog.error}
                </IdeCallout>
              ) : null}
            </div>
          }
          actions={
            <>
              <IdeButton tone="ghost" onClick={() => setBusDialog(null)}>Cancel</IdeButton>
              <IdeButton
                tone="primary"
                onClick={submitBusDialog}
                disabled={busDialog.name.trim().length === 0}
                testId="ide-design-create-bus-confirm"
              >
                Create bus
              </IdeButton>
            </>
          }
        />
      ) : null}
      {diagnosticsDialogOpen ? (
        <IdeModal
          title="Design diagnostics"
          testId="ide-design-diagnostics-dialog"
          onClose={() => setDiagnosticsDialogOpen(false)}
          body={
            <section
              className="ide-design-diagnostics-dialog"
              data-filtered-node={diagnosticFilterNodeId ?? 'all'}
            >
              <header className="ide-design-diagnostics-drawer-header">
                <p className="ide-copy" data-testid="ide-design-diagnostics-filtered-node">
                  {diagnosticFilterNodeId ? (
                    <>Focused on <code>{diagnosticFilterNodeId}</code></>
                  ) : (
                    'All circuit diagnostics'
                  )}
                </p>
                {diagnosticFilterNodeId ? (
                  <IdeButton
                    tone="ghost"
                    onClick={clearDiagnosticFilter}
                    testId="ide-design-diagnostics-clear-filter"
                  >
                    Clear filter
                  </IdeButton>
                ) : null}
              </header>
              <div className="ide-design-diagnostics-list" data-testid="ide-design-diagnostics-list">
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
                      {onDiagnosticAction ? (
                        <div className="ide-inline-actions">
                          <IdeButton
                            tone="secondary"
                            onClick={() => {
                              setDiagnosticsDialogOpen(false);
                              onDiagnosticAction(diagnostic);
                            }}
                            testId={`ide-design-diagnostic-action-${diagnostic.id}`}
                          >
                            Open fix path
                          </IdeButton>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="ide-copy">No diagnostics currently linked to this design.</p>
                )}
              </div>
            </section>
          }
          actions={
            <IdeButton tone="primary" onClick={() => setDiagnosticsDialogOpen(false)}>
              Close
            </IdeButton>
          }
        />
      ) : null}
    </>
  );
};

type DesignIoRow = NonNullable<DesignSurfaceProps['ioRows']>[number];

type DesignBoardTimingRole = 'clock' | 'reset' | 'none';

interface DesignBoardTimingSemantics {
  role: DesignBoardTimingRole;
  manualClock: boolean;
  physicalCategory: 'clock' | 'switch' | 'button' | null;
}

function normalizeDesignTimingToken(value: string | undefined): string {
  return normalizeIoSignalKey(value ?? '').replace(/[_.]/g, '');
}

function timingGuidanceNamesRow(
  ioRow: DesignIoRow,
  timingGuidance?: TimingGuidance
): boolean {
  if (timingGuidance?.kind !== 'clock' || !timingGuidance.signalName) return false;
  const timingToken = normalizeDesignTimingToken(timingGuidance.signalName);
  if (!timingToken) return false;
  return [ioRow.id, ioRow.nodeId, ioRow.label]
    .map(normalizeDesignTimingToken)
    .some((candidate) => candidate.length > 0 && candidate === timingToken);
}

function rowHasResetIntent(ioRow: DesignIoRow): boolean {
  if (ioRow.direction !== 'in') return false;
  return [ioRow.id, ioRow.nodeId, ioRow.label]
    .map(normalizeDesignTimingToken)
    .some((candidate) => /^(reset|rst|clear|clr)/.test(candidate));
}

function resolveDesignBoardTimingSemantics(
  ioRow: DesignIoRow,
  resource: ReturnType<typeof getBasys3BoardResource>,
  timingGuidance?: TimingGuidance
): DesignBoardTimingSemantics {
  const physicalCategory =
    resource?.category === 'clock' ||
    resource?.category === 'switch' ||
    resource?.category === 'button'
      ? resource.category
      : ioRow.boardResourceType === 'clock_pin'
        ? 'clock'
        : ioRow.boardResourceType === 'switch' || ioRow.boardResourceType === 'button'
          ? ioRow.boardResourceType
          : null;
  const role: DesignBoardTimingRole =
    ioRow.direction === 'in' &&
    (
      ioRow.timingRole === 'clock' ||
      ioRow.timingRole === 'manual_step' ||
      ioRow.boardResourceType === 'clock_pin' ||
      timingGuidanceNamesRow(ioRow, timingGuidance)
    )
      ? 'clock'
      : ioRow.timingRole === 'reset' || rowHasResetIntent(ioRow)
        ? 'reset'
        : 'none';
  const manualClock =
    role === 'clock' &&
    (
      physicalCategory === 'switch' ||
      physicalCategory === 'button' ||
      (ioRow.timingRole === 'manual_step' && physicalCategory !== 'clock')
    );
  return { role, manualClock, physicalCategory };
}

function describeRequiredBoardResourceClass(
  ioRow: DesignIoRow,
  resource: ReturnType<typeof getBasys3BoardResource>,
  timingGuidance?: TimingGuidance
): string {
  const timing = resolveDesignBoardTimingSemantics(ioRow, resource, timingGuidance);
  if (timing.role === 'clock') {
    if (timing.manualClock) {
      if (timing.physicalCategory === 'switch') return 'Manual clock switch';
      if (timing.physicalCategory === 'button') return 'Manual clock button';
      return 'Manual clock switch or button';
    }
    return 'Dedicated clock input';
  }
  if (timing.role === 'reset') {
    if (timing.physicalCategory === 'switch') return 'Reset-capable switch';
    if (timing.physicalCategory === 'button') return 'Reset-capable button';
    return 'Reset-capable switch or button';
  }
  switch (ioRow.boardResourceType) {
    case 'switch':
      return 'Slide switch';
    case 'button':
      return 'Pushbutton';
    case 'led':
      return 'LED';
    case 'seven_seg':
      return 'Seven-segment output';
    default:
      return ioRow.direction === 'in' ? 'Switch or button' : 'LED or display output';
  }
}

function describeBoardTimingStatus(
  ioRow: DesignIoRow,
  resource: ReturnType<typeof getBasys3BoardResource>,
  timingGuidance?: TimingGuidance
): string {
  const timing = resolveDesignBoardTimingSemantics(ioRow, resource, timingGuidance);
  if (timing.role === 'clock') {
    if (!resource) {
      return timing.manualClock ? 'Manual clock resource not assigned' : 'Clock source not assigned';
    }
    if (resource.category === 'clock') {
      return `${resource.frequencyMHz ?? 100} MHz board clock assigned`;
    }
    if (resource.category === 'switch') return `Manual clock switch ${resource.alias} assigned`;
    if (resource.category === 'button') return `Manual clock button ${resource.alias} assigned`;
    return 'Assigned resource is not a clock source';
  }
  if (timing.role === 'reset') {
    if (!resource) return 'Reset resource not assigned';
    if (resource.category === 'switch') return `Reset switch ${resource.alias} assigned`;
    if (resource.category === 'button') return `Reset button ${resource.alias} assigned`;
    return 'Assigned resource is not reset-capable';
  }
  return resource?.category === 'clock'
    ? 'Clock resource is incompatible with this signal'
    : 'Not a timing-control signal';
}

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
        label: getLogicalIoPresentationLabel(ioRow, node),
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

function getLogicalIoPresentationLabel(ioRow: DesignIoRow | undefined, node: Node): string {
  const authoredLabel = ioRow?.label?.trim() ?? '';
  const parenthetical = authoredLabel.match(/\(([^)]+)\)/);
  if (parenthetical?.[1]?.trim()) {
    return parenthetical[1].trim().toUpperCase();
  }
  return getStudentFacingIoLabel(ioRow, String(node.label ?? node.id)).toUpperCase();
}

function normalizeIoPresentationMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
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
  liveSignals: Map<string, RuntimeLogicValue>,
  runtimeSignals: Record<string, RuntimeLogicValue>
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
  runtimeSignals: Record<string, RuntimeLogicValue>,
  liveSignals: Map<string, RuntimeLogicValue>
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
  runtimeSignals: Record<string, RuntimeLogicValue>,
  liveSignals: Map<string, RuntimeLogicValue>,
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
  if (
    (currentValue === 0 || currentValue === 1) &&
    (previousValue === 0 || previousValue === 1)
  ) {
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
          value === '1' ? 1 : value === '0' ? 0 : value === 'Z' ? 'Z' : 'X',
        ])
      ) as Record<string, RuntimeLogicValue>,
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
  nodeSignals: Map<string, RuntimeLogicValue | null>;
  ioRow: DesignIoRow | null;
  connectionSummary: DesignNodeConnectionSummary | null;
  circuit: Circuit;
  ioRowByNodeId: Map<string, DesignIoRow>;
  trace: RuntimeSimState['trace'];
  fallbackTrace?: RuntimeSimState['trace'];
  runtimeSignals: Record<string, RuntimeLogicValue>;
  liveSignals: Map<string, RuntimeLogicValue>;
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
      actionLabel: ioRow ? null : 'Go to Board & Constraints',
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
        ? `CLK is wired — confirm the ${edgeLabel} edge matches your intent in Simulate / Board & Constraints.`
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

function formatInspectorBinaryValue(value: RuntimeLogicValue | null | undefined): string {
  return value === 1 ? '1' : value === 0 ? '0' : value === 'X' ? 'X' : value === 'Z' ? 'Z' : '?';
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
  // An output pin's only port is its feed; the student-facing signal is the pin itself.
  if (node?.type === 'OUTPUT' && portName === 'in') return nodeLabel;
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

function normalizeDiagnosticToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
