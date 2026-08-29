import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { ProjectHealth } from '../projectHealth';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeEmptyState,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfaceCommandStrip, SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { RuntimeSimState, RuntimeVerifyRun } from '../projectRuntime';
import { computeScenarioContentHash, type VerifyScenario } from '../verifyScenario';
import { useIoBus } from '../ioBus';
import { HardwareBoard2D } from '../components/HardwareBoard2D';
import { Basys3BoardView } from '../components/Basys3BoardView';
import { useBoardSignal } from '../BoardSignalContext';
import { getIoSignalLookupKeys, getStudentFacingIoLabel, normalizeIoSignalKey } from '../ioLabels';
import { SIGNAL_LANGUAGE } from '../productLanguage';
import { PROFESSIONAL_CLASSROOM_COPY } from '../productUiStandards';
import type { IoSignalRole } from '../ioSignalRoles';
import {
  deriveHardwareExportFailureTruth,
  isDesignOwnedExportDiagnostic,
  deriveProjectWorkflowAuthority,
  type ProjectWorkflowAuthority,
} from '../projectWorkflowAuthority';
import { createClockTimingGuidance, deriveTimingGuidanceFromRun, type TimingGuidance } from '../timingGuidance';
import type {
  FullAdderLabHardwareChecklist,
  GuidedLabTaskDefinition,
} from '../labTaskDefinition';
import {
  BOARD_CONSTRAINTS_STAGE_LABEL,
  EXPORT_STAGE_LABEL,
  PROGRAM_STAGE_LABEL,
  VERIFY_STAGE_LABEL,
} from '../workflowStages';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import type { HardwareMappingDocumentV2, HardwareMappingEntryV2 } from '@redbyte/rb-utils';
import type { ProjectIoMappingKind } from '../examplesCatalog';
import { deriveMappingCompleteness } from '../hardwareMappingBridge';
import {
  buildSequentialPins,
  buildStructuredHardwareEntryViews,
  parsePinsInput,
  type HardwareMappingV2EditOperation,
} from '../hardwareMappingV2EditorModel';
import type { ExportDiagnosticView } from '../viewmodels/buildExportViewModel';
import type { Basys3SemanticMappingProjection } from '../../../fpga/boards/basys3/basys3ExportContract';
import {
  buildBusEntryFromMemberRows,
  buildGuidedBoundaryOptions,
  buildGuidedHdlCatalogFromText,
  suggestEntryIdFromHdl,
} from '../hardwareMappingGuidance';
import {
  BASYS3_BOARD_PROFILE,
  getBasys3BoardResource,
  listBasys3BoardResources,
  resolveBasys3BoardAlias,
  resolveBasys3PackagePin,
  type Basys3BoardResource,
} from '../../../fpga/boards/basys3/basys3Pins';
import { listBasys3CompatibleBoardAliases } from '../../../fpga/boards/basys3/basys3BoardSurfaceProjection';
import { buildPinPlannerRows } from './board/pinPlannerProjection';
import { PinPlannerTable } from './board/PinPlannerTable';
import { ConflictRepairPanel } from './board/ConflictRepairPanel';
import {
  detectBusNamingConvention,
  formatBusBitLogical,
  planBusMapping,
  resolveProposalRowTargets,
} from './board/busMappingPlanner';
import type { IdeChromeContract } from '../chromeContract';
import './hardware-mapping-workspace-v3.css';

export const CHROME_CONTRACT = {
  surfaceId: 'hardware',
  topStripSlots: ['command-bar', 'mode-banner'],
  leftDockPolicy: 'always',
  rightDockPolicy: 'always',
  exitPaths: [
    {
      fromMode: 'bringup',
      label: `Back to ${BOARD_CONSTRAINTS_STAGE_LABEL}`,
      testId: 'ide-hw-mode-exit-back',
    },
    {
      fromMode: 'proof',
      label: `Back to ${BOARD_CONSTRAINTS_STAGE_LABEL}`,
      testId: 'ide-hw-mode-exit-back',
    },
    {
      fromMode: 'live',
      label: `Back to ${BOARD_CONSTRAINTS_STAGE_LABEL}`,
      testId: 'ide-hw-mode-exit-back',
    },
  ],
} satisfies IdeChromeContract;

const OPEN_SIMULATE_LABEL = `Open ${VERIFY_STAGE_LABEL}`;
const OPEN_BUILD_EXPORT_LABEL = `Open ${EXPORT_STAGE_LABEL}`;

function formatHardwareWorkflowDestinationText(value: string): string {
  return value
    .replaceAll('Open Verify', OPEN_SIMULATE_LABEL)
    .replaceAll('open Verify', `open ${VERIFY_STAGE_LABEL}`)
    .replaceAll('Open Export', OPEN_BUILD_EXPORT_LABEL)
    .replaceAll('open Export', `open ${EXPORT_STAGE_LABEL}`);
}

export interface HardwareMappingRow {
  id: string;
  nodeId?: string;
  /** Logic node port (e.g. `out` on an INPUT boundary). */
  port?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
  mappingKind?: ProjectIoMappingKind;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
}

function formatMappingKindChip(kind: ProjectIoMappingKind | undefined): string {
  switch (kind ?? 'scalar') {
    case 'scalar':
      return 'Scalar';
    case 'bit':
      return 'Bit';
    case 'slice':
      return 'Slice';
    case 'bus':
      return 'Bus';
    case 'group':
      return 'Group';
    default:
      return 'Scalar';
  }
}

function formatCompletenessChip(complete: 'unmapped' | 'partial' | 'complete'): string {
  switch (complete) {
    case 'unmapped':
      return 'Unmapped';
    case 'partial':
      return 'Partial';
    case 'complete':
      return 'Complete';
  }
}

function formatBoardResourceChip(t: HardwareBoardResourceType | undefined): string | null {
  if (!t || t === 'generic') return null;
  switch (t) {
    case 'switch':
      return 'Switch';
    case 'button':
      return 'Button';
    case 'led':
      return 'LED';
    case 'clock_pin':
      return 'Clock pin';
    case 'seven_seg':
      return '7-seg';
    default:
      return null;
  }
}

function formatTimingRoleChip(t: HardwareTimingRole | undefined): string | null {
  if (!t || t === 'generic') return null;
  switch (t) {
    case 'clock':
      return 'Role: clock';
    case 'reset':
      return 'Role: reset';
    case 'manual_step':
      return 'Role: manual step';
    case 'enable':
      return 'Role: enable';
    default:
      return null;
  }
}

export interface HardwareSurfaceProps {
  projectName: string;
  expectedBehavior: string;
  mappingRows: HardwareMappingRow[];
  /** Exact semantic-to-artifact bindings produced by the export contract. */
  mappingProjection?: Basys3SemanticMappingProjection[];
  missingRequiredPortsFromExport?: number;
  expectedIoRows: Array<{
    signal: string;
    tick: number;
    expected: string;
  }>;
  vectorsCount: number;
  health: ProjectHealth;
  workflowAuthority?: ProjectWorkflowAuthority;
  runtimeSim?: RuntimeSimState;
  onSimSetInput?: (nodeId: string, v: 0 | 1) => void;
  onGenerateBringUpVectors: () => void;
  onOpenExport: () => void;
  onOpenVerify: () => void;
  onGoToDesign?: () => void;
  /** Jump to Project surface — authoritative student-facing pin table (typed Map Pins). */
  onGoToProject?: () => void;
  onSetMappingPin?: (rowId: string, alias: string) => void;
  /** Atomic batch variant — applies a bus proposal without transient duplicate-pin states. */
  onSetMappingPins?: (updates: Record<string, string>) => void;
  hardwareMappingV2?: HardwareMappingDocumentV2;
  onApplyHardwareMappingEdit?: (operation: HardwareMappingV2EditOperation) => void;
  signalRoles?: Record<string, IoSignalRole>;
  timingGuidance?: TimingGuidance;
  /** Last completed verify run — provides scenario/run provenance for the board view. */
  verifyLastRun?: RuntimeVerifyRun;
  /** Currently active scenario — compared to verifyLastRun to detect drift. */
  activeScenario?: VerifyScenario;
  /** Full scenario library — used to check if switch-back CTA target still exists. */
  scenarios?: VerifyScenario[];
  /** True when the active scenario uses auto-generated (starter) vectors. */
  vectorsAreAutoGenerated?: boolean;
  /** Switch the active scenario by ID — used for switch-back CTA. */
  onSwitchScenario?: (scenarioId: string) => void;
  /** Live export validation errors (Basys3) — surfaced for teachable repair in Map Pins. */
  exportBlockingDiagnostics?: ExportDiagnosticView[];
  exportViewStatus?: 'ok' | 'blocked';
  /** Top entity name from export authority — shown next to HDL port hints. */
  designTopEntityName?: string;
  /** First VHDL source text (project HDL) — used to populate top-port picker. */
  topLevelVhdlText?: string;
  /** Jump to Design / Export / etc. from an export diagnostic action. */
  onRepairExportDiagnostic?: (diagnostic: ExportDiagnosticView) => void;
  guidedLabTask?: GuidedLabTaskDefinition | null;
  guidedLabHardwareChecklist?: FullAdderLabHardwareChecklist | null;
  onApplyGuidedLabMapping?: () => void;
}

/** Convert a raw signal key like "ld[5]" or "sw3" into a human label like "LED LD5" / "Switch SW3". */
export function signalHumanLabel(signal: string): string {
  const ldMatch = signal.match(/ld\[?(\d+)\]?/i);
  if (ldMatch) return `LED LD${ldMatch[1]}`;
  const swMatch = signal.match(/sw\[?(\d+)\]?/i);
  if (swMatch) return `Switch SW${swMatch[1]}`;
  const btnMatch = signal.match(/btn([cudlr])/i);
  if (btnMatch) return `Button BTN${btnMatch[1].toUpperCase()}`;
  return signal.toUpperCase();
}

function formatProjectSignalName(row: HardwareMappingRow): string {
  const label = getStudentFacingIoLabel(row, row.id).trim() || row.id;
  return splitMappingSignalLabel(label).logical;
}

function splitMappingSignalLabel(label: string): { logical: string; physical: string | null } {
  const normalized = label.replace(/\s+/g, ' ').trim().toUpperCase();
  const parenthetical = normalized.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (!parenthetical) return { logical: normalized, physical: null };
  const physical = parenthetical[1]?.trim() || null;
  const logical = parenthetical[2]?.trim() || normalized;
  return { logical, physical: physical && physical !== logical ? physical : null };
}

function resolveBoardControlAlias(pin: string | undefined): string | null {
  const trimmed = pin?.trim() ?? '';
  if (!trimmed) return null;
  return resolveBasys3BoardAlias(trimmed) ?? trimmed.toUpperCase();
}

function matchBusBitName(candidate: string): { base: string; bit: number } | null {
  const trimmed = candidate.replace(/\s+/g, ' ').trim();
  const bracket = trimmed.match(/^(.*)\[(\d+)\]$/);
  if (bracket && bracket[1].trim()) {
    return { base: bracket[1].trim(), bit: Number(bracket[2]) };
  }
  const suffix = trimmed.match(/^(.*?)(\d+)$/);
  if (suffix && suffix[1].trim()) {
    return { base: suffix[1].trim(), bit: Number(suffix[2]) };
  }
  return null;
}

/**
 * A row belongs to a bus family only through a name that is NOT itself a
 * board resource alias — 'A0 (SW0)' is bit 0 of bus A, never bit 0 of "SW".
 */
function resolveBusBitIdentity(row: HardwareMappingRow): { base: string; bit: number; logical: string } | null {
  const label = (getStudentFacingIoLabel(row, row.id).trim() || row.id).replace(/\s+/g, ' ').trim();
  const parenthetical = label.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  const candidates = parenthetical
    ? [parenthetical[1].trim(), parenthetical[2].trim(), row.id]
    : [label, row.id];
  for (const candidate of candidates) {
    if (!candidate || resolveBasys3BoardAlias(candidate)) continue;
    const match = matchBusBitName(candidate);
    if (match) return { ...match, logical: candidate };
  }
  return null;
}

function describeBoardControl(pin: string | undefined): string {
  return resolveBoardControlAlias(pin) ?? 'Choose in resource control';
}

function describePackagePin(pin: string | undefined): string {
  const trimmed = pin?.trim() ?? '';
  if (!trimmed) return 'Not assigned';
  return resolveBasys3PackagePin(trimmed) ?? 'Unknown pin';
}

function formatPlannerResourceKind(resource: Basys3BoardResource | null | undefined): string {
  if (!resource) return 'Board resource';
  switch (resource.category) {
    case 'clock':
      return 'Board clock';
    case 'switch':
      return 'Slide switch';
    case 'button':
      return 'Pushbutton';
    case 'led':
      return 'LED';
    case 'seven_seg':
      return '7-segment';
    case 'pmod':
      return 'Pmod';
    case 'xadc':
      return 'XADC';
    case 'vga':
      return 'VGA';
    case 'uart':
      return 'USB-UART';
    case 'ps2':
      return 'PS/2';
    case 'qspi':
      return 'Quad SPI';
    default:
      return 'Board resource';
  }
}

function formatPlannerDirection(resource: Basys3BoardResource | null | undefined): string {
  if (!resource) return 'I/O';
  switch (resource.direction) {
    case 'in':
      return 'Input';
    case 'out':
      return 'Output';
    case 'inout':
      return 'Bidirectional';
    case 'system':
      return 'System';
    default:
      return 'I/O';
  }
}

function sanitizeXdcPortRef(name: string): string {
  const normalized = name
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return '';
  return /^[A-Za-z]/.test(normalized) ? normalized : `sig_${normalized}`;
}

function buildHardwareXdcPortRef(row: HardwareMappingRow | null): string | null {
  if (!row) return null;
  const labelRef = sanitizeXdcPortRef(row.label ?? '');
  if (labelRef) return labelRef;
  return sanitizeXdcPortRef(`${row.nodeId ?? row.id}_${row.port ?? ''}`) || null;
}

function mappingPinConflictKey(pin: string | undefined): string {
  const trimmed = pin?.trim() ?? '';
  if (!trimmed) return '';
  return resolveBasys3PackagePin(trimmed) ?? trimmed.toUpperCase();
}

function formatLogicalSignalList(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? 'This signal';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

function buildAllowedBoardAliasesForRow(row: HardwareMappingRow | null): Set<string> | undefined {
  if (!row) return undefined;
  return new Set(listBasys3CompatibleBoardAliases(row));
}

/** Format a single assertion entry as a plain student-readable sentence. */
export function formatAssertionPlain(a: {
  tick: number;
  signal: string;
  expected: string;
  actual: string | null;
  pass: boolean;
  hasData: boolean;
}): string {
  const sigLabel = signalHumanLabel(a.signal);
  const expectedWord = a.expected === '1' ? 'ON' : 'OFF';
  if (!a.hasData) {
    return `${sigLabel} could not be read at step ${a.tick} — no trace data available.`;
  }
  if (a.pass) {
    return `${sigLabel} is ${expectedWord} at step ${a.tick}.`;
  }
  const actualWord = a.actual === '1' ? 'ON' : 'OFF';
  return `${sigLabel} should be ${expectedWord} at step ${a.tick}, but it stayed ${actualWord}.`;
}

const HARDWARE_EMPTY_SIM: RuntimeSimState = {
  tick: 0, running: false, stepMode: false, speedHz: 1, irHash: '', traceHash: '',
  inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
};

interface AssertionEntry {
  tick: number;
  signal: string;
  expected: string;
  actual: string | null; // null = no trace data for this tick
  pass: boolean;
  hasData: boolean;
}

type HwMode = 'live' | 'bringup' | 'proof' | 'map';

function resolveInitialHardwareMode(input: {
  mappingRows: HardwareMappingRow[];
  vectorsCount: number;
  missingRequiredPortsFromExport?: number;
}): HwMode {
  void input;
  return 'map';
}

export const HardwareSurface: React.FC<HardwareSurfaceProps> = ({
  projectName,
  expectedBehavior,
  mappingRows,
  mappingProjection = [],
  missingRequiredPortsFromExport = 0,
  expectedIoRows,
  vectorsCount,
  health,
  workflowAuthority,
  runtimeSim,
  onSimSetInput,
  onGenerateBringUpVectors,
  onOpenExport,
  onOpenVerify,
  onGoToDesign,
  onGoToProject,
  onSetMappingPin,
  onSetMappingPins,
  hardwareMappingV2,
  onApplyHardwareMappingEdit,
  signalRoles,
  timingGuidance,
  verifyLastRun,
  activeScenario,
  scenarios = [],
  vectorsAreAutoGenerated = false,
  onSwitchScenario,
  exportBlockingDiagnostics = [],
  designTopEntityName,
  topLevelVhdlText,
  guidedLabTask,
  guidedLabHardwareChecklist,
  onApplyGuidedLabMapping,
}) => {
  const { activeBoardSignal, hoverBoardSignal, setActiveBoardSignal, setHoverBoardSignal } = useBoardSignal();
  const [hwMode, setHwMode] = useState<HwMode>(() =>
    resolveInitialHardwareMode({
      mappingRows,
      vectorsCount,
      missingRequiredPortsFromExport,
    })
  );
  const [bringupStepIndex, setBringupStepIndex] = useState(0);
  const [selectedMappingRowId, setSelectedMappingRowId] = useState<string | null>(() => mappingRows[0]?.id ?? null);

  // Slice N4 — chrome rebuild: Esc returns the user to Map Pins from any
  // sub-mode (bringup / proof / live). Without this, students who entered a
  // sub-mode by accident reported being unable to escape unless they
  // navigated away from the surface and came back.
  useEffect(() => {
    if (hwMode === 'map') return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Don't steal Escape from inputs, dialogs, or component-local handlers.
      // Guard against non-Element targets (window, document) which don't expose .closest().
      const target = event.target;
      if (target && target instanceof Element) {
        if (target.closest('input, textarea, select, [role="dialog"], [contenteditable="true"]')) {
          return;
        }
      }
      setHwMode('map');
      setSelectedMappingRowId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hwMode]);
  const [selectedBoardResourceAlias, setSelectedBoardResourceAlias] = useState<string | null>(() =>
    resolveBoardControlAlias(mappingRows[0]?.pin) ?? null
  );
  const [structuredPinDrafts, setStructuredPinDrafts] = useState<Record<string, string>>({});
  const [entryMetadataSelection, setEntryMetadataSelection] = useState<string>('');
  const [newEntryKind, setNewEntryKind] = useState<HardwareMappingEntryV2['kind']>('scalar');
  const [newEntryId, setNewEntryId] = useState('');
  const [newEntryDirection, setNewEntryDirection] = useState<'in' | 'out'>('in');
  const [newEntryPortName, setNewEntryPortName] = useState('');
  const [newEntryNodeId, setNewEntryNodeId] = useState('');
  const [newEntryPort, setNewEntryPort] = useState('');
  const [newEntryLabel, setNewEntryLabel] = useState('');
  const [newEntryAlias, setNewEntryAlias] = useState('');
  const [newEntryWidth, setNewEntryWidth] = useState('4');
  const [newEntryMsb, setNewEntryMsb] = useState('3');
  const [newEntryLsb, setNewEntryLsb] = useState('0');
  const [newEntryPinsCsv, setNewEntryPinsCsv] = useState('');
  const [newGroupMembersCsv, setNewGroupMembersCsv] = useState('');
  const [newGroupRole, setNewGroupRole] = useState<'switch_bank' | 'led_bank' | 'button_row' | 'custom'>('custom');
  const [guidedBoundaryRowId, setGuidedBoundaryRowId] = useState('');
  const [guidedHdlKey, setGuidedHdlKey] = useState('');
  const [guidedShowAdvanced, setGuidedShowAdvanced] = useState(false);
  const [guidedBusMemberRowIds, setGuidedBusMemberRowIds] = useState<string[]>([]);
  const [simulatedBoardTraceIndex, setSimulatedBoardTraceIndex] = useState(0);
  const guidedBoundarySelectId = useId();
  const guidedHdlSelectId = useId();
  const guidedKindSelectId = useId();
  const guidedEntryIdInputId = useId();
  const guidedPortNameInputId = useId();
  const sim = runtimeSim ?? HARDWARE_EMPTY_SIM;
  const effectiveTimingGuidance = useMemo(() => {
    if (timingGuidance) return timingGuidance;
    const runGuidance = deriveTimingGuidanceFromRun(verifyLastRun);
    if (runGuidance.isSequential) return runGuidance;
    const semanticClockSignal = Object.entries(signalRoles ?? {}).find(([, role]) => role === 'clock')?.[0];
    const clockLikeRow = mappingRows.find(
      (row) => row.direction === 'in' && /(^clk$|clock|clk100mhz)/i.test(getStudentFacingIoLabel(row))
    );
    if (semanticClockSignal || clockLikeRow) {
      return createClockTimingGuidance(semanticClockSignal ?? getStudentFacingIoLabel(clockLikeRow!));
    }
    return runGuidance;
  }, [mappingRows, signalRoles, timingGuidance, verifyLastRun]);

  const clockRoleKeys = useMemo(() => {
    const next = new Set<string>();
    const roleSource = Object.keys(signalRoles ?? {}).length > 0
      ? signalRoles ?? {}
      : verifyLastRun?.report.signalRoles ?? {};
    for (const [key, role] of Object.entries(roleSource)) {
      if (role === 'clock') {
        const normalized = normalizeIoSignalKey(key);
        if (normalized) next.add(normalized);
      }
    }
    return next;
  }, [signalRoles, verifyLastRun?.reportHash]);

  const explicitTimingMode = useMemo<'synchronous_board_clock' | 'manual_event_driven_lab' | 'combinational'>(() => {
    const mode = verifyLastRun?.scheduleContract?.timingMode;
    if (mode === 'synchronous_board_clock' || mode === 'manual_event_driven_lab' || mode === 'combinational') {
      return mode;
    }
    if (!effectiveTimingGuidance.isSequential) return 'combinational';
    const hasSemanticClockPinned = mappingRows.some(
      (row) =>
        row.direction === 'in' &&
        row.pin.trim().length > 0 &&
        getIoSignalLookupKeys(row, mappingRows).some((key) => clockRoleKeys.has(key))
    );
    const hasExplicitBoardClock = mappingRows.some(
      (row) =>
        row.direction === 'in' &&
        /(^clk$|clk100mhz|clock)/i.test(getStudentFacingIoLabel(row)) &&
        row.pin.trim().length > 0
    );
    const hasBasys3PrimaryOscillatorPin = mappingRows.some(
      (row) => row.direction === 'in' && row.pin.trim().toUpperCase() === 'W5'
    );
    return hasSemanticClockPinned || hasExplicitBoardClock || hasBasys3PrimaryOscillatorPin
      ? 'synchronous_board_clock'
      : 'manual_event_driven_lab';
  }, [
    clockRoleKeys,
    effectiveTimingGuidance.isSequential,
    mappingRows,
    verifyLastRun?.scheduleContract?.timingMode,
  ]);

  // Prefer semantic verify roles for clock detection; fall back only when no role map exists yet.
  const hasClockMapping = useMemo(
    () => {
      const requiredClockRows = mappingRows.filter(
        (row) => {
          if (row.direction !== 'in' || !row.required) return false;

          if (clockRoleKeys.size > 0) {
            return getIoSignalLookupKeys(row, mappingRows).some((key) => clockRoleKeys.has(key));
          }

          return /(^clk$|clock|clk100mhz)/i.test(getStudentFacingIoLabel(row));
        }
      );
      if (explicitTimingMode !== 'synchronous_board_clock') {
        // Manual-event and combinational projects do not require a board oscillator mapping.
        return true;
      }
      if (requiredClockRows.length === 0) {
        return false;
      }
      return requiredClockRows.every((row) => row.pin.trim().length > 0);
    },
    [clockRoleKeys, explicitTimingMode, mappingRows]
  );
  /** Dock / progress row: avoid “missing clock” alarm when lab timing does not use the board oscillator. */
  const clockDockPresentation = useMemo(() => {
    if (explicitTimingMode === 'manual_event_driven_lab') {
      return {
        label: 'Board oscillator',
        pillTone: 'idle' as const,
        checkClass: 'is-ok' as const,
        checkGlyph: '✓' as const,
        statusText: 'Not required for lab timing',
      };
    }
    if (explicitTimingMode === 'combinational') {
      return {
        label: 'Clock / timing',
        pillTone: 'idle' as const,
        checkClass: 'is-ok' as const,
        checkGlyph: '✓' as const,
        statusText: 'Combinational design',
      };
    }
    return {
      label: effectiveTimingGuidance.signalLabelSingular,
      pillTone: (hasClockMapping ? 'ok' : 'warn') as const,
      checkClass: (hasClockMapping ? 'is-ok' : 'is-missing') as const,
      checkGlyph: (hasClockMapping ? '✓' : '○') as const,
      statusText: hasClockMapping ? 'Mapped for synthesis' : 'Needs clock pin',
    };
  }, [effectiveTimingGuidance.signalLabelSingular, explicitTimingMode, hasClockMapping]);
  const hasOutputMapping = useMemo(
    () => {
      const requiredOutputs = mappingRows.filter(
        (row) => row.direction === 'out' && row.required
      );
      if (requiredOutputs.length === 0) {
        // No boundary outputs to map — same "N/A satisfied" idea as clock for non-board-clock labs.
        return true;
      }
      return requiredOutputs.every((row) => row.pin.trim().length > 0);
    },
    [mappingRows]
  );

  const SSD_PINS = /^(CA|CB|CC|CD|CE|CF|CG|DP|AN[0-3])$/i;
  const hasSsdMapping = useMemo(
    () => mappingRows.some((row) => SSD_PINS.test(getStudentFacingIoLabel(row))),
    [mappingRows]
  );

  const hasButtonMapping = useMemo(
    () =>
      mappingRows.some(
        (row) => row.direction === 'in' && /^btn(c|u|d|l|r)/i.test(getStudentFacingIoLabel(row))
      ),
    [mappingRows]
  );

  // ── Map mode: all aliases currently assigned to rows ──────────────────
  const mapModeAliases = useMemo(() => {
    const s = new Set<string>();
    for (const row of mappingRows) {
      const pin = resolveBoardControlAlias(row.pin);
      if (pin) s.add(pin);
    }
    return s;
  }, [mappingRows]);
  const mappingProjectionById = useMemo(
    () => new Map(mappingProjection.map((projection) => [projection.logicalSignalId, projection])),
    [mappingProjection]
  );

  // ── Map mode: highlight the current pin of the selected row ───────────
  const selectedMappingRowPin = useMemo(() => {
    if (!selectedMappingRowId) return null;
    const row = mappingRows.find((r) => r.id === selectedMappingRowId);
    return resolveBoardControlAlias(row?.pin) ?? null;
  }, [selectedMappingRowId, mappingRows]);
  const selectedMappingRow = useMemo(
    () => (selectedMappingRowId ? mappingRows.find((row) => row.id === selectedMappingRowId) ?? null : null),
    [mappingRows, selectedMappingRowId]
  );
  const selectedMappingProjection = selectedMappingRow
    ? mappingProjectionById.get(selectedMappingRow.id) ?? null
    : null;
  const selectedProjectionResource = selectedMappingProjection
    ? getBasys3BoardResource(selectedMappingProjection.packagePin ?? undefined)
    : null;
  const selectedMappingLabel = selectedMappingProjection?.logicalLabel
    ? splitMappingSignalLabel(selectedMappingProjection.logicalLabel).logical
    : selectedMappingRow
      ? formatProjectSignalName(selectedMappingRow)
      : null;
  const selectedMappingBoardControl = selectedProjectionResource?.alias ??
    (selectedMappingRow ? describeBoardControl(selectedMappingRow.pin) : null);
  const selectedMappingPackagePin = selectedMappingProjection?.packagePin ??
    (selectedMappingRow ? describePackagePin(selectedMappingRow.pin) : null);
  const selectedMappingResource =
    selectedMappingRow
      ? formatBoardResourceChip(selectedMappingRow.boardResourceType) ??
        (selectedMappingRow.direction === 'in' ? 'Input control' : 'Output control')
      : null;
  const selectedMappedBoardResource = selectedMappingRow
    ? getBasys3BoardResource(selectedMappingRow.pin)
    : null;

  // ── Map mode: group rows by signal type for the assignment table ───────
  const pinUsageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of mappingRows) {
      const key = mappingPinConflictKey(row.pin);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [mappingRows]);
  const mappedRowsByPackagePin = useMemo(() => {
    const result = new Map<string, HardwareMappingRow[]>();
    for (const row of mappingRows) {
      const packagePin = resolveBasys3PackagePin(row.pin);
      if (!packagePin) continue;
      const rows = result.get(packagePin) ?? [];
      rows.push(row);
      result.set(packagePin, rows);
    }
    return result;
  }, [mappingRows]);
  const pinPlannerRows = useMemo(
    () =>
      buildPinPlannerRows(mappingRows, BASYS3_BOARD_PROFILE, {
        mappingProjection,
        resolvePackagePin: resolveBasys3PackagePin,
      }),
    [mappingRows, mappingProjection]
  );
  const conflictingMappingRows = useMemo(
    () => {
      if (mappingProjection.length > 0) {
        return mappingRows.filter((row) => {
          const conflictState = mappingProjectionById.get(row.id)?.conflictState ?? 'none';
          return conflictState !== 'none' &&
            conflictState !== 'missing-pin' &&
            conflictState !== 'invalid-resource';
        });
      }
      return mappingRows.filter((row) => {
        const key = mappingPinConflictKey(row.pin);
        return key.length > 0 && (pinUsageCounts.get(key) ?? 0) > 1;
      });
    },
    [mappingProjection.length, mappingProjectionById, mappingRows, pinUsageCounts]
  );
  const selectedAllowedBoardAliases = useMemo(
    () => buildAllowedBoardAliasesForRow(selectedMappingRow),
    [selectedMappingRow]
  );
  const plannerResources = useMemo(() => listBasys3BoardResources({ plannerOnly: true }), []);
  const compatiblePlannerResources = useMemo(
    () =>
      selectedAllowedBoardAliases
        ? plannerResources.filter((resource) => selectedAllowedBoardAliases.has(resource.alias))
        : [],
    [plannerResources, selectedAllowedBoardAliases]
  );
  const selectedBusPlan = useMemo(() => {
    if (!selectedMappingRow || compatiblePlannerResources.length === 0) return null;
    const identity = resolveBusBitIdentity(selectedMappingRow);
    if (!identity) return null;
    const familyRows = mappingRows.flatMap((row) => {
      if (row.direction !== selectedMappingRow.direction) return [];
      const bit = resolveBusBitIdentity(row);
      return bit && bit.base.toUpperCase() === identity.base.toUpperCase() ? [{ row, bit }] : [];
    });
    if (familyRows.length < 2) return null;
    const width = Math.max(...familyRows.map((entry) => entry.bit.bit)) + 1;
    const convention = detectBusNamingConvention(
      familyRows.map((entry) => entry.bit.logical),
      identity.base
    );
    const familyRowIds = new Set(familyRows.map((entry) => entry.row.id));
    const existingAssignments = mappingRows.flatMap((row) => {
      const packagePin = resolveBasys3PackagePin(row.pin);
      if (!packagePin) return [];
      const bit = familyRowIds.has(row.id) ? resolveBusBitIdentity(row) : null;
      const logical = bit
        ? formatBusBitLogical(identity.base, bit.bit, convention)
        : formatProjectSignalName(row);
      return [{ logical, packagePin }];
    });
    const proposal = planBusMapping(
      {
        busName: identity.base,
        width,
        bitOrder: 'lsb-first',
        direction: selectedMappingRow.direction,
        convention,
      },
      compatiblePlannerResources,
      existingAssignments,
      { skipOccupied: true }
    );
    const resolution = resolveProposalRowTargets(proposal, mappingRows);
    if (resolution.targets.length === 0) return null;
    return { base: identity.base, familyCount: familyRows.length, proposal, resolution };
  }, [compatiblePlannerResources, mappingRows, selectedMappingRow]);
  const applySelectedBusPlan = useCallback(() => {
    if (!selectedBusPlan) return;
    const updates = Object.fromEntries(
      selectedBusPlan.resolution.targets.map((target) => [target.rowId, target.pin])
    );
    if (onSetMappingPins) {
      onSetMappingPins(updates);
    } else if (onSetMappingPin) {
      for (const [rowId, pin] of Object.entries(updates)) {
        onSetMappingPin(rowId, pin);
      }
    }
  }, [onSetMappingPin, onSetMappingPins, selectedBusPlan]);
  const officialCatalogResources = useMemo(() => listBasys3BoardResources(), []);
  const resourcePlannerGroups = useMemo(() => {
    const groups = new Map<string, Basys3BoardResource[]>();
    for (const resource of plannerResources) {
      const rows = groups.get(resource.group) ?? [];
      rows.push(resource);
      groups.set(resource.group, rows);
    }
    return Array.from(groups.entries()).map(([label, resources]) => ({ label, resources }));
  }, [plannerResources]);
  const selectedBoardResource =
    (selectedBoardResourceAlias ? getBasys3BoardResource(selectedBoardResourceAlias) : null) ??
    selectedMappedBoardResource;
  const selectedResourceNeedsApply = Boolean(
    selectedBoardResourceAlias && selectedMappedBoardResource?.alias !== selectedBoardResourceAlias
  );
  const selectedBoardResourceRows = selectedBoardResource
    ? mappedRowsByPackagePin.get(selectedBoardResource.packagePin) ?? []
    : [];
  const selectedBoardResourceStatus =
    selectedBoardResourceRows.length > 1
      ? 'Conflict'
      : selectedBoardResourceRows.length === 1
        ? `Mapped to ${formatProjectSignalName(selectedBoardResourceRows[0])}`
        : selectedBoardResource?.supportedInPlanner
          ? 'Available'
          : 'Catalog only';
  const selectedXdcPortRef = selectedMappingProjection?.artifactPortName ??
    buildHardwareXdcPortRef(selectedMappingRow) ?? selectedBoardResource?.xdcPort ?? 'signal';
  const selectedBoardResourceXdc = selectedMappingProjection?.exactXdcLine
    ? [
        selectedMappingProjection.exactXdcLine,
        `set_property IOSTANDARD ${selectedMappingProjection.ioStandard} [get_ports {${selectedMappingProjection.artifactPortName}}]`,
      ].join('\n')
    : selectedBoardResource
      ? [
          `set_property PACKAGE_PIN ${selectedBoardResource.packagePin} [get_ports {${selectedXdcPortRef}}]`,
          `set_property IOSTANDARD LVCMOS33 [get_ports {${selectedXdcPortRef}}]`,
        ].join('\n')
      : '';
  const mapModeGroups = useMemo(() => {
    const groups: Array<{ id: string; label: string; rows: HardwareMappingRow[] }> = [
      { id: 'clock-reset', label: 'Clock / Reset', rows: [] },
      { id: 'inputs', label: 'Inputs', rows: [] },
      { id: 'outputs', label: 'Outputs', rows: [] },
      { id: 'optional', label: 'Optional', rows: [] },
    ];
    for (const row of mappingRows) {
      const lbl = formatProjectSignalName(row);
      const lookupKeys = getIoSignalLookupKeys(row, mappingRows);
      if (lookupKeys.some((key) => clockRoleKeys.has(key))) {
        groups[0].rows.push(row);
      } else if (lookupKeys.some((key) => signalRoles?.[key] === 'reset') || /(^|[^A-Z])(RST|RESET)([^A-Z]|$)/.test(lbl)) {
        groups[0].rows.push(row);
      } else if (/CLK|CLOCK/.test(lbl)) {
        groups[0].rows.push(row);
      } else if (!row.required) {
        groups[3].rows.push(row);
      } else if (row.direction === 'in') {
        groups[1].rows.push(row);
      } else if (row.direction === 'out') {
        groups[2].rows.push(row);
      } else {
        groups[3].rows.push(row);
      }
    }
    return groups.filter((g) => g.rows.length > 0);
  }, [clockRoleKeys, mappingRows, signalRoles]);
  const structuredEntries = useMemo(
    () => (hardwareMappingV2 ? buildStructuredHardwareEntryViews(hardwareMappingV2) : []),
    [hardwareMappingV2]
  );
  const selectedStructuredEntry = useMemo(
    () => structuredEntries.find((entry) => entry.id === entryMetadataSelection) ?? null,
    [entryMetadataSelection, structuredEntries]
  );
  const guidedBoundaryOptions = useMemo(() => buildGuidedBoundaryOptions(mappingRows), [mappingRows]);
  const guidedHdlCatalog = useMemo(() => buildGuidedHdlCatalogFromText(topLevelVhdlText), [topLevelVhdlText]);

  useEffect(() => {
    if (!guidedBoundaryRowId || guidedShowAdvanced) return;
    const row = mappingRows.find((r) => r.id === guidedBoundaryRowId);
    if (!row?.nodeId) return;
    setNewEntryNodeId(row.nodeId);
    setNewEntryPort((row.port ?? '').trim());
    setNewEntryDirection(row.direction);
    if (row.label.trim()) setNewEntryLabel(row.label);
    setNewEntryId(row.id);
  }, [guidedBoundaryRowId, guidedShowAdvanced, mappingRows]);

  useEffect(() => {
    if (!guidedHdlKey) return;
    const entry = guidedHdlCatalog.find((candidate) => candidate.key === guidedHdlKey);
    if (!entry) return;
    if (entry.kind === 'scalar') {
      setNewEntryPortName(entry.portName);
      setNewEntryId((previous) => (previous.trim() ? previous : suggestEntryIdFromHdl(entry)));
      return;
    }
    setNewEntryPortName(entry.baseName);
    setNewEntryKind('bus');
    setNewEntryWidth(String(entry.msb - entry.lsb + 1));
    setNewEntryId((previous) => (previous.trim() ? previous : suggestEntryIdFromHdl(entry)));
  }, [guidedHdlKey, guidedHdlCatalog]);

  const applyStructuredEdit = (operation: HardwareMappingV2EditOperation) => {
    onApplyHardwareMappingEdit?.(operation);
  };

  const applyEntryPins = (entryId: string) => {
    const value = structuredPinDrafts[entryId] ?? '';
    const normalizedPins = parsePinsInput(value);
    applyStructuredEdit({
      type: 'map_entry_pins',
      entryId,
      pins: normalizedPins,
    });
  };

  const applySequentialPinsForEntry = (entryId: string, prefix: string, startIndex: number, count: number) => {
    const pins = buildSequentialPins(prefix, startIndex, count);
    if (pins.length === 0) return;
    applyStructuredEdit({
      type: 'map_entry_pins',
      entryId,
      pins,
    });
    setStructuredPinDrafts((previous) => ({
      ...previous,
      [entryId]: pins.join(', '),
    }));
  };

  const resetGuidedCreateForm = () => {
    setGuidedBoundaryRowId('');
    setGuidedHdlKey('');
    setGuidedBusMemberRowIds([]);
    setNewEntryId('');
    setNewEntryPinsCsv('');
  };

  const moveGuidedBusMember = (index: number, delta: -1 | 1) => {
    setGuidedBusMemberRowIds((previous) => {
      const next = [...previous];
      const target = index + delta;
      if (target < 0 || target >= next.length) return previous;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  };

  const createStructuredEntry = () => {
    const trimmedId = newEntryId.trim();
    const trimmedPortName = newEntryPortName.trim() || trimmedId;
    const trimmedLabel = newEntryLabel.trim();
    const trimmedAlias = newEntryAlias.trim();
    if (!trimmedId || !trimmedPortName) return;
    const pins = parsePinsInput(newEntryPinsCsv);
    let entry: HardwareMappingEntryV2 | null = null;

    if (newEntryKind === 'bus' && guidedBusMemberRowIds.length > 0) {
      const memberRows = guidedBusMemberRowIds
        .map((rowId) => guidedBoundaryOptions.find((opt) => opt.rowId === rowId))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      if (memberRows.length !== guidedBusMemberRowIds.length) return;
      const busEntry = buildBusEntryFromMemberRows({
        entryId: trimmedId,
        portName: trimmedPortName,
        direction: newEntryDirection,
        label: trimmedLabel || undefined,
        alias: trimmedAlias || undefined,
        memberRows,
        pins,
      });
      if (!busEntry) return;
      applyStructuredEdit({ type: 'upsert_entry', entry: busEntry });
      resetGuidedCreateForm();
      return;
    }

    if (newEntryKind === 'scalar') {
      if (!newEntryNodeId.trim() || !newEntryPort.trim()) return;
      entry = {
        kind: 'scalar',
        id: trimmedId,
        direction: newEntryDirection,
        width: 1,
        portName: trimmedPortName,
        nodeId: newEntryNodeId.trim(),
        port: newEntryPort.trim(),
        label: trimmedLabel || undefined,
        alias: trimmedAlias || undefined,
        pin: pins[0] ?? '',
      };
    } else if (newEntryKind === 'bit') {
      if (!newEntryNodeId.trim() || !newEntryPort.trim()) return;
      const bitIndex = Number.parseInt(newEntryLsb, 10);
      if (!Number.isFinite(bitIndex)) return;
      entry = {
        kind: 'bit',
        id: trimmedId,
        direction: newEntryDirection,
        portName: trimmedPortName,
        nodeId: newEntryNodeId.trim(),
        port: newEntryPort.trim(),
        bitIndex,
        label: trimmedLabel || undefined,
        alias: trimmedAlias || undefined,
        pin: pins[0] ?? '',
      };
    } else if (newEntryKind === 'slice') {
      if (!newEntryNodeId.trim() || !newEntryPort.trim()) return;
      const msb = Number.parseInt(newEntryMsb, 10);
      const lsb = Number.parseInt(newEntryLsb, 10);
      if (!Number.isFinite(msb) || !Number.isFinite(lsb) || msb < lsb) return;
      const span = msb - lsb + 1;
      entry = {
        kind: 'slice',
        id: trimmedId,
        direction: newEntryDirection,
        portName: trimmedPortName,
        nodeId: newEntryNodeId.trim(),
        port: newEntryPort.trim(),
        msb,
        lsb,
        label: trimmedLabel || undefined,
        alias: trimmedAlias || undefined,
        pins: Array.from({ length: span }, (_, index) => pins[index] ?? ''),
      };
    } else if (newEntryKind === 'bus') {
      const width = Number.parseInt(newEntryWidth, 10);
      if (!Number.isFinite(width) || width <= 0) return;
      entry = {
        kind: 'bus',
        id: trimmedId,
        direction: newEntryDirection,
        portName: trimmedPortName,
        width,
        label: trimmedLabel || undefined,
        alias: trimmedAlias || undefined,
        bits: Array.from({ length: width }, (_, index) => ({
          id: `${trimmedId}[${index}]`,
          bitIndex: index,
          nodeId: newEntryNodeId.trim() || `${trimmedId}_node`,
          port: newEntryPort.trim() || (newEntryDirection === 'in' ? 'out' : 'in'),
          pin: pins[index] ?? '',
          label: trimmedLabel ? `${trimmedLabel}[${index}]` : `${trimmedId}[${index}]`,
        })),
      };
    } else {
      const memberIds = newGroupMembersCsv
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
      entry = {
        kind: 'group',
        id: trimmedId,
        direction: newEntryDirection,
        portName: trimmedPortName,
        label: trimmedLabel || undefined,
        alias: trimmedAlias || undefined,
        groupRole: newGroupRole,
        memberIds,
      };
    }
    if (!entry) return;
    applyStructuredEdit({
      type: 'upsert_entry',
      entry,
    });
    resetGuidedCreateForm();
  };

  const [debounceDismissed, setDebounceDismissed] = useState(() => {
    try { return localStorage.getItem('rb-debounce-tip-dismissed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (debounceDismissed) {
      try { localStorage.setItem('rb-debounce-tip-dismissed', '1'); } catch { /* ignore */ }
    }
  }, [debounceDismissed]);

  const ioBusIoRows = useMemo(
    () =>
      mappingRows
        .filter((r): r is HardwareMappingRow & { nodeId: string } => Boolean(r.nodeId))
        .map((r) => ({
          nodeId: r.nodeId,
          label: getStudentFacingIoLabel(r, r.id),
          direction: r.direction,
        })),
    [mappingRows]
  );
  const ioBus = useIoBus({
    ioRows: ioBusIoRows,
    runtimeSim: sim,
    setInput: onSimSetInput ?? (() => {}),
  });
  const mappedSw = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ioBus.meta.swNodeIds[i] != null),
    [ioBus.meta.swNodeIds]
  );
  const mappedLd = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ioBus.meta.ldNodeIds[i] != null),
    [ioBus.meta.ldNodeIds]
  );
  const effectiveBoardSignal = hoverBoardSignal ?? activeBoardSignal;
  const inferredReadiness = useMemo(
    () => ({
      hasCircuit: !health.blockingIssues.some((issue) => issue.code === 'RBP1000'),
      hasIoMapping:
        mappingProjection.length > 0
          ? mappingProjection.some((row) => row.required) &&
            mappingProjection.every((row) => !row.required || row.conflictState === 'none')
          : mappingRows.filter((row) => row.required).length > 0 &&
            mappingRows.every((row) => !row.required || row.pin.trim().length > 0),
      hasVectors: vectorsCount > 0,
      hasBlockingDesignIssue: health.blockingIssues.some((issue) => issue.code === 'RBP1006'),
      blockingDesignIssueMessage: health.blockingIssues.find((issue) => issue.code === 'RBP1006')?.message,
      verifyQualification: health.lastVerify?.qualification,
    }),
    [health.blockingIssues, health.lastVerify?.qualification, mappingProjection, mappingRows, vectorsCount]
  );
  const resolvedWorkflowAuthority = useMemo(
    () =>
      workflowAuthority ??
      deriveProjectWorkflowAuthority({
        projectHealthCore: health,
        readiness: inferredReadiness,
        verifyLastRun: health.lastVerify,
      }),
    [health, inferredReadiness, workflowAuthority]
  );
  const projectVerifyState = resolvedWorkflowAuthority.verifyState;
  const verifyCurrent = resolvedWorkflowAuthority.verifyCurrent;
  const compareCurrent = resolvedWorkflowAuthority.compareCurrent;
  const compareMatches = resolvedWorkflowAuthority.compareMatches;
  const compareDiffers = resolvedWorkflowAuthority.compareDiffers;
  const compareTraceOnly = resolvedWorkflowAuthority.compareTraceOnly;
  const exportCurrent = resolvedWorkflowAuthority.exportCurrent;
  const exportReady = resolvedWorkflowAuthority.exportPackageCurrent;

  // ── Scenario drift detection ─────────────────────────────────────────
  // Two distinct drift kinds produce different copy and CTAs.
  /** Active scenario differs from the one that produced the verify run. */
  const isDifferentScenario = Boolean(
    verifyLastRun && activeScenario && verifyLastRun.scenarioId !== activeScenario.id
  );
  /** Same scenario, but its content changed after the run (hash drift). */
  const isSameScenarioEdited = Boolean(
    verifyLastRun && activeScenario &&
    verifyLastRun.scenarioId === activeScenario.id &&
    typeof verifyLastRun.scenarioContentHash === 'string' &&
    verifyLastRun.scenarioContentHash !== computeScenarioContentHash(activeScenario)
  );
  const scenarioDrifted = isDifferentScenario || isSameScenarioEdited;

  /** The scenario the last run was for, if it still exists in the library (enables switch-back CTA). */
  const switchBackScenario = useMemo(
    () =>
      isDifferentScenario && verifyLastRun
        ? (scenarios.find((s) => s.id === verifyLastRun.scenarioId) ?? null)
        : null,
    [isDifferentScenario, scenarios, verifyLastRun]
  );
  const effectiveBlockingIssues = useMemo(
    () =>
      health.blockingIssues.filter((issue) => {
        if (issue.code === 'RBP1004' && verifyCurrent) return false;
        if (issue.code === 'RBP2002' && exportCurrent) return false;
        return true;
      }),
    [exportCurrent, health.blockingIssues, verifyCurrent]
  );
  const hardwareState = exportReady
    ? 'ready'
    : health.lastExport?.status === 'ok'
      ? 'export-stale'
      : 'export-needed';
  const unmappedRequiredPins = useMemo(
    () => mappingRows.filter((row) => {
      if (!row.required) return false;
      if (mappingProjection.length === 0) return row.pin.trim().length === 0;
      const conflictState = mappingProjectionById.get(row.id)?.conflictState;
      return conflictState === 'missing-pin' || conflictState === 'invalid-resource';
    }),
    [mappingProjection.length, mappingProjectionById, mappingRows]
  );
  const hasBoundaryRows = mappingRows.length > 0;
  const hasRequiredMappingRows = mappingRows.some((row) => row.required);
  const hasNoBoundaryRows = !hasBoundaryRows || !hasRequiredMappingRows;
  // The Export pin table and Map Pins rows describe the same missing bindings in
  // normal projects. Use the larger view instead of adding them, which would
  // present one cleared row as two separate assignments.
  const projectedUnresolvedRequiredCount = mappingProjection.filter(
    (row) => row.required &&
      (row.conflictState === 'missing-pin' || row.conflictState === 'invalid-resource')
  ).length;
  const projectedConflictingRequiredCount = mappingProjection.filter(
    (row) => row.required &&
      row.conflictState !== 'none' &&
      row.conflictState !== 'missing-pin' &&
      row.conflictState !== 'invalid-resource'
  ).length;
  const unresolvedRequiredCount = Math.max(
    mappingProjection.length > 0 ? projectedUnresolvedRequiredCount : unmappedRequiredPins.length,
    missingRequiredPortsFromExport
  );
  const conflictingRequiredCount = mappingProjection.length > 0
    ? projectedConflictingRequiredCount
    : conflictingMappingRows.filter((row) => row.required).length;
  const mappingAttentionCount = unresolvedRequiredCount + conflictingRequiredCount;
  const totalRequiredCount = useMemo(
    () => mappingProjection.length > 0
      ? mappingProjection.filter((row) => row.required).length
      : mappingRows.filter((row) => row.required).length,
    [mappingProjection, mappingRows]
  );
  const mappedRequiredCount = Math.max(0, totalRequiredCount - unresolvedRequiredCount);
  const mappingReady =
    hasRequiredMappingRows &&
    hasClockMapping &&
    hasOutputMapping &&
    unresolvedRequiredCount === 0 &&
    conflictingRequiredCount === 0;
  const nextMappingIssueRow =
    conflictingMappingRows.find((row) => row.required) ??
    unmappedRequiredPins[0] ??
    null;
  const hasPresentedDesignBlocker = exportBlockingDiagnostics.some(
    (diagnostic) => isDesignOwnedExportDiagnostic(diagnostic.code, explicitTimingMode)
  );

  const selectedSignalHasPin = selectedMappingProjection
    ? Boolean(selectedMappingProjection.packagePin)
    : Boolean(selectedMappingRow?.pin.trim().length);
  const selectedProjectionHasConflict = Boolean(
    selectedMappingProjection &&
      selectedMappingProjection.conflictState !== 'none' &&
      selectedMappingProjection.conflictState !== 'missing-pin' &&
      selectedMappingProjection.conflictState !== 'invalid-resource'
  );
  const selectedSignalConflict = Boolean(
    selectedProjectionHasConflict ||
      (selectedMappingRow &&
        (() => {
          const key = mappingPinConflictKey(selectedMappingRow.pin);
          return key.length > 0 && (pinUsageCounts.get(key) ?? 0) > 1;
        })())
  );
  const selectedConflictLabels = useMemo(() => {
    if (!selectedMappingRow || !selectedSignalConflict) return [];

    const selectedProjection = mappingProjectionById.get(selectedMappingRow.id);
    const selectedPackagePin = selectedProjection?.packagePin ?? resolveBasys3PackagePin(selectedMappingRow.pin);
    const selectedArtifactPort = selectedProjection?.artifactPortName.trim().toLowerCase() ?? '';
    const conflictingRows = selectedProjection?.conflictState === 'artifact-port-collision' && selectedArtifactPort
      ? mappingRows.filter((row) =>
          mappingProjectionById.get(row.id)?.artifactPortName.trim().toLowerCase() === selectedArtifactPort
        )
      : selectedPackagePin
        ? mappingRows.filter((row) =>
            (mappingProjectionById.get(row.id)?.packagePin ?? resolveBasys3PackagePin(row.pin)) === selectedPackagePin
          )
        : [selectedMappingRow];

    return Array.from(new Set(
      (conflictingRows.length > 0 ? conflictingRows : [selectedMappingRow])
        .map((row) => mappingProjectionById.get(row.id)?.logicalLabel ?? formatProjectSignalName(row))
        .filter(Boolean)
    )).sort((left, right) => left.localeCompare(right));
  }, [mappingProjectionById, mappingRows, selectedMappingRow, selectedSignalConflict]);
  const selectedConflictSignalList = formatLogicalSignalList(selectedConflictLabels);
  const selectedConflictState = selectedMappingProjection?.conflictState;
  const selectedConflictHasDuplicatePackagePin = Boolean(
    selectedMappingPackagePin &&
      mappingRows.filter((row) =>
        (mappingProjectionById.get(row.id)?.packagePin ?? resolveBasys3PackagePin(row.pin)) === selectedMappingPackagePin
      ).length > 1
  );
  const selectedConflictTitle = selectedConflictHasDuplicatePackagePin
    ? `${selectedConflictSignalList} share one package pin`
    : selectedConflictState === 'artifact-port-collision'
      ? `${selectedConflictSignalList} share one artifact port`
      : 'Mapping conflict needs repair';
  const selectedConflictMessage = selectedConflictHasDuplicatePackagePin
    ? `${selectedConflictSignalList} are assigned to ${selectedMappingBoardControl} (package pin ${selectedMappingPackagePin}). Choose a different compatible resource for one signal and save the repair.`
    : selectedConflictState === 'artifact-port-collision'
      ? `${selectedConflictSignalList} resolve to artifact port ${selectedMappingProjection?.artifactPortName}. Rename or remap one signal before export.`
      : `${selectedConflictSignalList} has an incompatible mapping. Choose a compatible resource and save the repair.`;
  const selectedSignalStatus = !selectedMappingRow
    ? null
    : selectedSignalConflict
      ? 'Conflict'
      : selectedSignalHasPin
        ? 'Mapped'
        : selectedMappingRow.required
          ? 'Missing required'
          : 'Optional';
  const boardWorkspacePrompt = hasNoBoundaryRows
    ? 'Add boundary inputs and outputs in Design, then return to assign Basys3 controls.'
    : !selectedMappingRow
      ? 'Select a signal row to choose a matching Basys3 control.'
      : selectedSignalHasPin
        ? `This signal is mapped to ${selectedMappingBoardControl} / ${selectedMappingPackagePin}.`
        : `Choose a Basys3 control for ${selectedMappingLabel}.`;

  const hasOtherBlockingIssue = useMemo(
    () =>
      effectiveBlockingIssues.some(
        (issue) =>
          issue.code !== 'RBP1001' &&
          issue.code !== 'RBP1005' &&
          issue.code !== 'RBP1004' &&
          issue.code !== 'RBP2002'
      ),
    [effectiveBlockingIssues]
  );
  const failureTruth = useMemo(
    () =>
      deriveHardwareExportFailureTruth({
        workflowAuthority: resolvedWorkflowAuthority,
        hasRequiredMappingGap: !mappingReady,
        hasOtherBlockingIssue,
      }),
    [hasOtherBlockingIssue, mappingReady, resolvedWorkflowAuthority]
  );
  const failureTruthMessage = formatHardwareWorkflowDestinationText(failureTruth.message);
  const failureTruthPrimaryCtaLabel = formatHardwareWorkflowDestinationText(
    failureTruth.primaryCtaLabel
  );
  const mappingHandoffBlockedByDesign =
    mappingReady && (failureTruth.condition === 'design-blocked' || hasPresentedDesignBlocker);
  const readinessCalloutTone = failureTruth.severity === 'ready'
    ? 'success'
    : failureTruth.severity === 'blocked'
      ? 'error'
      : failureTruth.condition === 'verify-not-run' ||
          failureTruth.condition === 'mapping-review' ||
          failureTruth.condition === 'trace-only'
        ? 'info'
        : 'warn';
  const hardwareReadinessTitle =
    failureTruth.condition === 'ready'
      ? 'E0 handoff ready'
      : failureTruth.title;
  const hardwareReadinessMessage =
    failureTruth.condition === 'ready'
      ? 'Verify Compare and Export are current for the browser package. Vivado build, bitstream programming, and physical board observation are not proven in RedByte and must be captured as external E1/E2/E3 evidence.'
      : failureTruthMessage;
  const mappingReadyFollowUp = useMemo(() => {
    switch (failureTruth.condition) {
      case 'design-blocked':
        return {
          commandStrip:
            'Pin mapping is complete, but the circuit still has a Design blocker. Repair Design before relying on Hardware or Export.',
          headerHint: 'Mapping complete - Design repair required before Export.',
        };
      case 'verify-not-run':
        return {
          commandStrip:
            'Pin mapping is complete. Open Simulate to create current evidence before you rely on Hardware or Export.',
          headerHint: 'Mapping complete — open Simulate to create trusted export evidence.',
        };
      case 'verify-stale':
        return {
          commandStrip:
            'Pin mapping is complete, but Verify evidence is stale. Re-run Verify before you rely on Hardware or Export.',
          headerHint: 'Mapping complete — Verify evidence is stale. Open Simulate to refresh before export.',
        };
      case 'trace-only':
        return {
          commandStrip:
            'Pin mapping is complete. Run Compare in Verify to create current evidence before you rely on Hardware or Export.',
          headerHint: 'Mapping complete — run Compare checks in Verify for trusted export evidence.',
        };
      case 'assertions-differ':
        return {
          commandStrip:
            'Pin mapping is complete, but the latest Compare run differs. Open Simulate to inspect the mismatch before you rely on Hardware or Export.',
          headerHint:
            'Mapping complete — latest Compare run differs. Open Simulate to inspect the mismatch before export.',
        };
      case 'mapping-review':
        return {
          commandStrip:
            'Pin mapping is complete, but the last passing comparison used incomplete mapping. Re-run Compare in Verify so the evidence matches the current board bindings.',
          headerHint:
            'Mapping complete — rerun Compare in Verify so the evidence matches the current mapping.',
        };
      case 'ready':
        return {
          commandStrip:
            'E0 only: pin mapping, Verify Compare, and Export are current. RedByte does not prove Vivado build, bitstream programming, or board observation; E1/E2/E3 remain external.',
          headerHint:
            'Mapping complete - E0 export package is current; E1/E2/E3 proof stays external.',
        };
      default:
        return {
          commandStrip: failureTruthMessage,
          headerHint: `Mapping complete — ${failureTruthPrimaryCtaLabel.toLowerCase()} to continue.`,
        };
    }
  }, [failureTruth.condition, failureTruthMessage, failureTruthPrimaryCtaLabel]);
  const dominantPrimaryAction = useMemo(() => {
    switch (failureTruth.primaryCtaIntent) {
      case 'map-pins':
        return () => {
          setHwMode('map');
          setSelectedMappingRowId(null);
        };
      case 'design':
        return onGoToDesign ?? (() => {});
      case 'build-current-bundle':
      case 're-export-current-bundle':
        return onOpenExport;
      case 'verify':
        return onOpenVerify;
      case 'program-handoff':
        return () => setHwMode('proof');
      default:
        return () => {};
    }
  }, [failureTruth.primaryCtaIntent, onGoToDesign, onOpenExport, onOpenVerify]);
  const showBlockedHero = failureTruth.severity === 'blocked';
  const heroSecondaryAction =
    showBlockedHero && failureTruth.primaryCtaIntent !== 'design' && onGoToDesign
      ? onGoToDesign
      : null;
  const heroSecondaryLabel = heroSecondaryAction ? 'Open Design' : null;
  const blockedHero = showBlockedHero
    ? {
        title: failureTruth.title,
        body: failureTruthMessage,
        primaryLabel: failureTruthPrimaryCtaLabel,
        primaryAction: dominantPrimaryAction,
        primaryTestId: 'ide-hardware-blocked-primary',
      }
    : null;

  // ── Verify status for callout ────────────────────────────────────────
  const verifyStatus = !health.lastVerify
    ? 'NOT RUN'
    : compareTraceOnly
      ? 'TRACE ONLY'
    : compareDiffers
      ? 'CHECKS DIFFER'
      : compareMatches
        ? 'CHECKS MATCH'
        : compareCurrent
          ? 'SIMULATION CURRENT'
          : 'STALE';
  const exportStatus = health.lastExport?.status === 'ok'
    ? exportReady
      ? 'CURRENT'
      : 'STALE'
    : health.lastExport?.status === 'blocked'
      ? 'BLOCKED'
      : 'MISSING';
  const nextActionHero = useMemo(() => {
    if (hasNoBoundaryRows) {
      return {
        title: 'Add boundary I/O in Design first',
        body: PROFESSIONAL_CLASSROOM_COPY.hardwareNoSignals,
        primaryLabel: 'Open Design',
        primaryAction: onGoToDesign ?? (() => {}),
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: null,
        secondaryAction: null,
      };
    }

    if (blockedHero) {
      return {
        title: blockedHero.title,
        body: blockedHero.body,
        primaryLabel: blockedHero.primaryLabel,
        primaryAction: blockedHero.primaryAction,
        primaryTestId: blockedHero.primaryTestId,
        secondaryLabel: onGoToDesign ? 'Open Design' : null,
        secondaryAction: onGoToDesign ?? null,
      };
    }

    if (!mappingReady) {
      const unresolvedLabel = conflictingRequiredCount > 0
        ? `${conflictingRequiredCount} required signal${conflictingRequiredCount === 1 ? '' : 's'} share a package pin and must be reassigned.`
        : unresolvedRequiredCount > 0
          ? `${unresolvedRequiredCount} required pin${unresolvedRequiredCount === 1 ? '' : 's'} still need board assignments.`
          : 'Finish the required clock and output mappings before you rely on the board view.';
      const openBoardMap = () => {
        setHwMode('map');
        setSelectedMappingRowId(null);
      };
      return {
        title: 'Map the board pins first',
        body: `Choose a signal row, then assign a compatible Basys3 resource in the selected-signal control. ${unresolvedLabel}`,
        primaryLabel: 'Show board mapping',
        primaryAction: openBoardMap,
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: onGoToDesign ? 'Open Design' : null,
        secondaryAction: onGoToDesign ?? null,
      };
    }

    if (
      failureTruth.primaryCtaIntent === 'build-current-bundle' ||
      failureTruth.primaryCtaIntent === 're-export-current-bundle'
    ) {
      return {
        title: failureTruth.title,
        body: failureTruthMessage,
        primaryLabel: failureTruthPrimaryCtaLabel,
        primaryAction: dominantPrimaryAction,
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: onOpenVerify ? OPEN_SIMULATE_LABEL : null,
        secondaryAction: onOpenVerify ?? null,
      };
    }

    if (failureTruth.primaryCtaIntent === 'verify' || compareDiffers) {
      return {
        title: failureTruth.title,
        body: failureTruthMessage,
        primaryLabel: failureTruthPrimaryCtaLabel || OPEN_SIMULATE_LABEL,
        primaryAction: onOpenVerify,
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: hwMode !== 'bringup' && vectorsCount > 0 ? 'Board Check' : null,
        secondaryAction: hwMode !== 'bringup' && vectorsCount > 0 ? () => setHwMode('bringup') : null,
      };
    }

    if (scenarioDrifted) {
      return {
        title: isDifferentScenario ? 'Re-run Verify for the active scenario' : 'Re-run Verify after the scenario edit',
        body: isDifferentScenario
          ? `The current board view still reflects “${verifyLastRun?.scenarioName ?? 'the previous scenario'}”. Re-run Verify before you prepare hardware for the active scenario.`
          : `“${verifyLastRun?.scenarioName ?? 'Current scenario'}” changed after the last run. Refresh Verify before you trust this hardware checklist.`,
        primaryLabel: 'Re-run Verify',
        primaryAction: onOpenVerify,
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel:
          isDifferentScenario && switchBackScenario && onSwitchScenario
            ? `Switch to “${switchBackScenario.name}”`
            : null,
        secondaryAction:
          isDifferentScenario && switchBackScenario && onSwitchScenario
            ? () => onSwitchScenario(verifyLastRun!.scenarioId)
            : null,
      };
    }

    if (vectorsCount === 0) {
      return {
        title: 'Generate bring-up steps',
        body: 'Create a guided browser bring-up sequence so you can set inputs and verify assertions before leaving RedByte for downstream Vivado work.',
        primaryLabel: 'Generate Bring-Up Steps',
        primaryAction: onGenerateBringUpVectors,
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: 'Open Pre-flight',
        secondaryAction: () => setHwMode('proof'),
      };
    }

    if (hwMode !== 'bringup') {
      return {
        title: 'Review board inputs with guided bring-up',
        body: 'Use the board-first bring-up checklist to set inputs and watch highlighted outputs before you leave RedByte for the external Vivado flow.',
        primaryLabel: 'Open Board Check',
        primaryAction: () => setHwMode('bringup'),
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: OPEN_BUILD_EXPORT_LABEL,
        secondaryAction: onOpenExport,
      };
    }

    return {
      title: 'Follow the board check steps, then review pre-flight',
      body: 'Once the guided checks match, open Pre-flight for E0 handoff notes and downstream Vivado steps.',
      primaryLabel: 'Open Pre-flight',
      primaryAction: () => setHwMode('proof'),
      primaryTestId: 'ide-hardware-next-primary',
      secondaryLabel: 'Simulation',
      secondaryAction: () => setHwMode('live'),
    };
  }, [
    blockedHero,
    compareDiffers,
    dominantPrimaryAction,
    failureTruthMessage,
    failureTruth.primaryCtaIntent,
    failureTruthPrimaryCtaLabel,
    failureTruth.title,
    hasNoBoundaryRows,
    hwMode,
    isDifferentScenario,
    mappingReady,
    onGenerateBringUpVectors,
    onGoToDesign,
    onOpenExport,
    onOpenVerify,
    onSwitchScenario,
    scenarioDrifted,
    switchBackScenario,
    unresolvedRequiredCount,
    conflictingRequiredCount,
    vectorsCount,
    verifyLastRun,
    onGoToProject,
  ]);

  // ── Bring-Up: group expectedIoRows by tick ──────────────────────────
  const bringupTickGroups = useMemo(() => {
    const map = new Map<number, Array<{ signal: string; expected: string }>>();
    for (const row of expectedIoRows) {
      const bucket = map.get(row.tick) ?? [];
      bucket.push({ signal: row.signal, expected: row.expected });
      map.set(row.tick, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [expectedIoRows]);

  // ── Bring-Up: compare current step expected vs actual LD values ─────
  const mismatchedLd = useMemo<boolean[]>(() => {
    if (hwMode !== 'bringup' || bringupTickGroups.length === 0)
      return Array(16).fill(false);
    const currentGroup = bringupTickGroups[bringupStepIndex];
    if (!currentGroup) return Array(16).fill(false);
    const [, signals] = currentGroup;
    return Array.from({ length: 16 }, (_, i) => {
      const sig = signals.find(
        (s) =>
          s.signal.toLowerCase() === `ld${i}` ||
          s.signal.toLowerCase() === `ld[${i}]`
      );
      if (!sig) return false;
      return sig.expected !== String(ioBus.state.ld[i]);
    });
  }, [hwMode, bringupTickGroups, bringupStepIndex, ioBus.state.ld]);

  const bringupStepPass = useMemo(
    () => mismatchedLd.every((v) => !v),
    [mismatchedLd]
  );

  // ── Bring-Up inspector: actual vs expected rows ─────────────────────
  const bringupStepRows = useMemo(() => {
    const group = bringupTickGroups[bringupStepIndex];
    if (!group) return [];
    const [, signals] = group;
    return signals.map((s) => {
      const ldMatch = s.signal.match(/ld\[?(\d+)\]?/i);
      const rawActual = ldMatch ? String(ioBus.state.ld[Number(ldMatch[1])] ?? '—') : '—';
      const pass = rawActual === s.expected;
      const expectedWord = s.expected === '1' ? 'ON' : 'OFF';
      const actualWord = rawActual === '—' ? '—' : rawActual === '1' ? 'ON' : 'OFF';
      return [
        signalHumanLabel(s.signal),
        expectedWord,
        actualWord,
        <IdeStatusPill key={`${s.signal}-pill`} tone={pass ? 'ok' : 'error'}>
          {pass ? 'MATCH' : 'DIFFER'}
        </IdeStatusPill>,
      ];
    });
  }, [bringupTickGroups, bringupStepIndex, ioBus.state.ld]);

  // ── Live: signal event log from sim trace ───────────────────────────
  const nodeKeyToMeta = useMemo(() => {
    const m = new Map<string, { label: string; direction: 'in' | 'out' }>();
    for (const r of ioBusIoRows) {
      const meta = { label: r.label, direction: r.direction };
      for (const key of [
        r.id,
        r.label,
        r.nodeId,
        r.nodeId ? `${r.nodeId}.out` : '',
        r.nodeId ? `${r.nodeId}.in` : '',
      ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)) {
        m.set(key, meta);
        m.set(normalizeIoSignalKey(key), meta);
      }
    }
    return m;
  }, [ioBusIoRows]);

  const recordedVerifyTrace = useMemo(
    () =>
      (verifyLastRun?.waveform ?? []).map((sample) => ({
        tick: sample.tick,
        signals: Object.fromEntries(
          Object.entries(sample.signals)
            .filter(([, value]) => value === '0' || value === '1' || value === 0 || value === 1)
            .map(([key, value]) => [key, value === '1' || value === 1 ? 1 : 0])
        ) as Record<string, 0 | 1>,
      })),
    [verifyLastRun?.reportHash, verifyLastRun?.waveform]
  );
  const simulatedBoardTrace = sim.trace?.length ? sim.trace : recordedVerifyTrace;
  const boundedSimulatedBoardTraceIndex = Math.min(
    simulatedBoardTraceIndex,
    Math.max(0, simulatedBoardTrace.length - 1)
  );
  const selectedSimulatedBoardSample =
    simulatedBoardTrace[boundedSimulatedBoardTraceIndex] ?? null;

  const simulatedBoardState = useMemo(() => {
    const next = {
      sw: [...ioBus.state.sw],
      ld: [...ioBus.state.ld],
      btn: [...ioBus.state.btn],
    };
    if (!selectedSimulatedBoardSample) return next;
    const signalEntries = Object.entries(selectedSimulatedBoardSample.signals);
    for (const row of mappingRows) {
      const lookupKeys = new Set(
        [
          ...getIoSignalLookupKeys(row, mappingRows),
          row.id,
          row.label,
          row.nodeId,
          row.nodeId ? `${row.nodeId}.out` : '',
          row.nodeId ? `${row.nodeId}.in` : '',
        ]
          .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0)
          .map(normalizeIoSignalKey)
      );
      const matched = signalEntries.find(([key]) => lookupKeys.has(normalizeIoSignalKey(key)));
      if (!matched) continue;
      const value = matched[1] === 1 ? 1 : 0;
      const alias = resolveBoardControlAlias(row.pin);
      const switchMatch = /^SW(\d+)$/i.exec(alias ?? '');
      const ledMatch = /^LD(\d+)$/i.exec(alias ?? '');
      if (switchMatch && row.direction === 'in') next.sw[Number(switchMatch[1])] = value;
      if (ledMatch && row.direction === 'out') next.ld[Number(ledMatch[1])] = value;
    }
    return next;
  }, [
    ioBus.state.btn,
    ioBus.state.ld,
    ioBus.state.sw,
    mappingRows,
    selectedSimulatedBoardSample,
  ]);

  interface SignalChangeEvent {
    tick: number;
    label: string;
    from: 0 | 1;
    to: 0 | 1;
    direction: 'in' | 'out';
  }

  const signalChangeFeed = useMemo<SignalChangeEvent[]>(() => {
    if (!simulatedBoardTrace.length) return [];
    const events: SignalChangeEvent[] = [];
    const seenEvents = new Set<string>();
    let prev: Record<string, 0 | 1> = {};
    for (const sample of simulatedBoardTrace) {
      for (const [k, v] of Object.entries(sample.signals)) {
        const meta = nodeKeyToMeta.get(k) ?? nodeKeyToMeta.get(normalizeIoSignalKey(k));
        if (!meta) continue;
        const was = prev[k];
        if (was !== undefined && was !== v) {
          const eventKey = `${sample.tick}:${meta.direction}:${meta.label}:${was}:${v}`;
          if (!seenEvents.has(eventKey)) {
            seenEvents.add(eventKey);
            events.push({ tick: sample.tick, label: meta.label, from: was, to: v as 0 | 1, direction: meta.direction });
          }
        }
      }
      Object.assign(prev, sample.signals);
    }
    return events.slice(-30).reverse();
  }, [nodeKeyToMeta, simulatedBoardTrace]);

  // ── Assertions: trace × expected vectors ────────────────────────────
  const traceByTick = useMemo(() => {
    const map = new Map<number, Record<string, 0 | 1>>();
    for (const sample of sim.trace ?? []) {
      map.set(sample.tick, sample.signals);
    }
    return map;
  }, [sim.trace]);

  const hardwareAssertions = useMemo<AssertionEntry[]>(() => {
    return expectedIoRows.map((row) => {
      const ldMatch = row.signal.match(/ld\[?(\d+)\]?/i);
      if (!ldMatch) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const ldIdx = Number(ldMatch[1]);
      const nodeId = ioBus.meta.ldNodeIds[ldIdx];
      if (!nodeId) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const signals = traceByTick.get(row.tick);
      if (!signals) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const rawVal = signals[nodeId] ?? signals[`${nodeId}.out`] ?? signals[`${nodeId}.in`];
      if (rawVal === undefined) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const actual = String(rawVal);
      return { tick: row.tick, signal: row.signal, expected: row.expected, actual, pass: actual === row.expected, hasData: true };
    });
  }, [expectedIoRows, ioBus.meta.ldNodeIds, traceByTick]);

  const assertionsWithData = useMemo(() => hardwareAssertions.filter((a) => a.hasData), [hardwareAssertions]);
  const assertionFailCount = useMemo(() => assertionsWithData.filter((a) => !a.pass).length, [assertionsWithData]);
  const assertionPassCount = useMemo(() => assertionsWithData.filter((a) => a.pass).length, [assertionsWithData]);
  const hasAssertionData = assertionsWithData.length > 0;

  // ── Confidence score ─────────────────────────────────────────────────
  const clockConfidence = useMemo(() => {
    if (explicitTimingMode === 'manual_event_driven_lab') {
      return { label: 'Lab timing (no board clk pin required)', pass: true };
    }
    if (explicitTimingMode === 'combinational') {
      return { label: 'Combinational — no clock domain', pass: true };
    }
    return {
      label: `${effectiveTimingGuidance.signalLabelSingular} mapped for XDC`,
      pass: hasClockMapping,
    };
  }, [effectiveTimingGuidance.signalLabelSingular, explicitTimingMode, hasClockMapping]);

  const confidenceChecks = useMemo(() => [
    clockConfidence,
    { label: 'Outputs mapped', pass: hasOutputMapping },
    { label: 'Vectors generated', pass: vectorsCount > 0 },
    { label: 'Checks match', pass: hasAssertionData && assertionFailCount === 0 },
    { label: 'Compare current', pass: compareCurrent && !scenarioDrifted },
    { label: 'Export current', pass: exportReady },
  ], [
    clockConfidence,
    hasOutputMapping,
    vectorsCount,
    hasAssertionData,
    assertionFailCount,
    compareCurrent,
    scenarioDrifted,
    exportReady,
  ]);

  const confidenceScore = useMemo(
    () => Math.round((confidenceChecks.filter((c) => c.pass).length / confidenceChecks.length) * 100),
    [confidenceChecks]
  );

  // ── Dock: Bring-Up step table (expected only, compact) ──────────────
  const bringupDockRows = useMemo(() => {
    const group = bringupTickGroups[bringupStepIndex];
    if (!group) return [];
    const [, signals] = group;
    return signals.map((s) => [
      signalHumanLabel(s.signal),
      s.expected === '1' ? 'ON' : 'OFF',
    ]);
  }, [bringupTickGroups, bringupStepIndex]);

  // ── Bring-Up: board highlights for current step ──────────────────────
  const currentStepHighlights = useMemo(() => {
    if (hwMode !== 'bringup' || bringupTickGroups.length === 0) {
      return { sw: [] as number[], ld: [] as number[] };
    }
    const [, signals] = bringupTickGroups[bringupStepIndex] ?? [null, []];
    const sw: number[] = [];
    const ld: number[] = [];
    for (const s of (signals ?? [])) {
      const swM = s.signal.match(/sw\[?(\d+)\]?/i);
      if (swM) sw.push(Number(swM[1]));
      const ldM = s.signal.match(/ld\[?(\d+)\]?/i);
      if (ldM) ld.push(Number(ldM[1]));
    }
    return { sw, ld };
  }, [hwMode, bringupTickGroups, bringupStepIndex]);

  const currentTick = bringupTickGroups[bringupStepIndex]?.[0];

  const hardwareBoardChromeStage =
    hwMode === 'map'
      ? 'Board & Constraints'
      : hwMode === 'bringup'
        ? 'Stage 2 · Board Check'
        : hwMode === 'proof'
          ? 'Stage 3 · Pre-flight'
          : 'Stage 4 · Simulation';

  // ── Dock nodes ──────────────────────────────────────────────────────
  const liveDock = (
    <SurfacePanel className="ide-workbench-placeholder ide-hw-dock-panel ide-hw-dock--live" testId="ide-hw-live-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Simulated board preview</h3>
        <IdeStatusPill tone={simulatedBoardTrace.length > 0 ? 'ok' : 'idle'}>
          {simulatedBoardTrace.length > 0 ? 'Recorded trace' : 'No trace'}
        </IdeStatusPill>
      </header>
      <IdeCallout tone="info" title="Browser simulation only" testId="ide-hw-simulated-board-trust">
        <strong>Not observed hardware behavior</strong>
        <p className="ide-copy ide-copy--flush">
          This preview projects the selected Verify tick onto mapped Basys3 controls. It is not
          programming or physical-board evidence.
        </p>
      </IdeCallout>
      <div className="ide-kv-list">
        <div className="ide-kv-row">
          <span>Selected run tick</span>
          <code>{selectedSimulatedBoardSample?.tick ?? 'Not run'}</code>
        </div>
        <div className="ide-kv-row">
          <span>Mapped I/O</span>
          <span>{ioBusIoRows.length}</span>
        </div>
        <div className="ide-kv-row">
          <span>{clockDockPresentation.label}</span>
          <IdeStatusPill tone={clockDockPresentation.pillTone}>
            {clockDockPresentation.statusText}
          </IdeStatusPill>
        </div>
        <div className="ide-kv-row">
          <span>Outputs</span>
          <IdeStatusPill tone={hasOutputMapping ? 'ok' : 'warn'}>
            {hasOutputMapping ? 'Mapped' : 'Missing'}
          </IdeStatusPill>
        </div>
        <div className="ide-kv-row">
          <span>Vectors</span>
          <span>{vectorsCount}</span>
        </div>
      </div>
      {simulatedBoardTrace.length > 0 ? (
        <div className="ide-hw-simulated-trace" data-testid="ide-hw-simulated-board-trace">
          <div className="ide-inline-actions">
            <IdeButton
              tone="ghost"
              onClick={() => setSimulatedBoardTraceIndex((index) => Math.max(0, index - 1))}
              disabled={boundedSimulatedBoardTraceIndex === 0}
              testId="ide-hw-simulated-board-prev"
            >
              Previous
            </IdeButton>
            <strong data-testid="ide-hw-simulated-board-readout">
              Case {boundedSimulatedBoardTraceIndex + 1} / {simulatedBoardTrace.length}
            </strong>
            <IdeButton
              tone="ghost"
              onClick={() =>
                setSimulatedBoardTraceIndex((index) =>
                  Math.min(simulatedBoardTrace.length - 1, index + 1)
                )
              }
              disabled={boundedSimulatedBoardTraceIndex >= simulatedBoardTrace.length - 1}
              testId="ide-hw-simulated-board-next"
            >
              Next
            </IdeButton>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, simulatedBoardTrace.length - 1)}
            value={boundedSimulatedBoardTraceIndex}
            onChange={(event) => setSimulatedBoardTraceIndex(Number(event.target.value))}
            aria-label="Selected Verify trace case"
            data-testid="ide-hw-simulated-board-trace-scrubber"
          />
        </div>
      ) : null}
      <div className="ide-inline-actions">
        <IdeButton tone="secondary" onClick={onOpenVerify}>Run Verify</IdeButton>
        <IdeButton tone="ghost" onClick={onGenerateBringUpVectors}>Gen Vectors</IdeButton>
      </div>
      {onGoToDesign && (
        <div className="ide-hw-live-design-link">
          <IdeButton tone="ghost" onClick={onGoToDesign} testId="ide-hardware-go-design">
            Open in Design
          </IdeButton>
        </div>
      )}
    </SurfacePanel>
  );
  const mapDock = (
    <SurfacePanel className="ide-workbench-placeholder ide-hw-dock-panel ide-hw-dock--map" testId="ide-hw-map-dock">
      <header className="ide-workbench-placeholder-header ide-hw-map-dock-header">
        <div className="ide-hw-map-dock-head-main">
          <h3>Board & Constraints</h3>
          <p className="ide-copy ide-copy--flush ide-hw-map-dock-authority-line" data-testid="ide-hw-map-dock-authority-sub">
            Map signal -&gt; board control -&gt; package pin -&gt; XDC constraint.
          </p>
        </div>
        <IdeStatusPill tone={mappingReady ? 'ok' : 'warn'}>
          {hasNoBoundaryRows ? 'Design first' : mappingReady ? 'Complete' : `${mappingAttentionCount} to fix`}
        </IdeStatusPill>
      </header>
      <div className="ide-hw-map-progress" data-testid="ide-hw-map-progress">
        <div className="ide-hw-map-progress-row">
          <span className={`ide-hw-map-check ${clockDockPresentation.checkClass}`}>
            {clockDockPresentation.checkGlyph}
          </span>
          <span>{clockDockPresentation.label}</span>
          <IdeStatusPill tone={clockDockPresentation.pillTone}>
            {clockDockPresentation.statusText}
          </IdeStatusPill>
        </div>
        <div className="ide-hw-map-progress-row">
          <span className={`ide-hw-map-check ${hasOutputMapping ? 'is-ok' : 'is-missing'}`}>
            {hasOutputMapping ? '✓' : '○'}
          </span>
          <span>Outputs</span>
          <IdeStatusPill tone={hasOutputMapping ? 'ok' : 'warn'}>
            {hasOutputMapping ? 'Mapped' : 'Missing'}
          </IdeStatusPill>
        </div>
        {unresolvedRequiredCount > 0 && (
          <div className="ide-hw-map-progress-row">
            <span className="ide-hw-map-check is-missing">○</span>
            <span>All required</span>
            <IdeStatusPill tone="warn">{unresolvedRequiredCount} unassigned</IdeStatusPill>
          </div>
        )}
        {conflictingRequiredCount > 0 && (
          <div className="ide-hw-map-progress-row" data-testid="ide-hw-map-progress-conflicts">
            <span className="ide-hw-map-check is-missing">!</span>
            <span>Unique package pins</span>
            <IdeStatusPill tone="error">{conflictingRequiredCount} conflicted</IdeStatusPill>
          </div>
        )}
      </div>
      {missingRequiredPortsFromExport > 0 && (
        <IdeCallout tone="warn" title="Add project mappings first" testId="ide-hardware-map-export-gap">
          <p className="ide-copy ide-copy--flush">
            {missingRequiredPortsFromExport} required port{missingRequiredPortsFromExport === 1 ? '' : 's'} from your design still need board assignments.
          </p>
        </IdeCallout>
      )}
      <div className="ide-inline-actions">
        {hasNoBoundaryRows ? (
          <p className="ide-copy" style={{ margin: 0, fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
            Add inputs and outputs in Design, then return here to assign board pins.
          </p>
        ) : mappingHandoffBlockedByDesign ? (
          <IdeButton
            tone="secondary"
            onClick={onGoToDesign}
            disabled={!onGoToDesign}
            testId="ide-hardware-map-dock-primary"
            hierarchySurface="hardware"
            hierarchyRole="next"
          >
            Repair Design
          </IdeButton>
        ) : mappingReady ? (
          <IdeButton
            tone="secondary"
            onClick={onOpenExport}
            testId="ide-hardware-map-dock-primary"
            hierarchySurface="hardware"
            hierarchyRole="next"
          >
            {OPEN_BUILD_EXPORT_LABEL}
          </IdeButton>
        ) : (
          <div className="ide-hw-map-dock-hint" data-testid="ide-hw-map-dock-incomplete-hint">
            <p className="ide-copy" style={{ margin: 0, fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
              Select a row in the table, choose a compatible resource, then save the assignment.
            </p>
          </div>
        )}
      </div>
    </SurfacePanel>
  );

  const bringupDock = (
    <SurfacePanel className="ide-workbench-placeholder ide-hw-dock-panel ide-hw-dock--bringup" testId="ide-hw-bringup-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Board Check</h3>
        <IdeStatusPill
          tone={
            bringupTickGroups.length === 0
              ? 'warn'
              : bringupStepPass
                ? 'ok'
                : 'error'
          }
        >
          {bringupTickGroups.length === 0 ? 'No vectors' : bringupStepPass ? 'MATCH' : 'DIFFER'}
        </IdeStatusPill>
      </header>
      {hasAssertionData && (
        <div className="ide-hw-assert-summary" data-testid="ide-hw-assert-summary">
          <span className={assertionFailCount > 0 ? 'ide-hw-assert-fail-count' : 'ide-hw-assert-pass-count'}>
            {assertionFailCount > 0
              ? `${assertionFailCount} bring-up check${assertionFailCount > 1 ? 's' : ''} differed`
              : `${assertionPassCount} bring-up check${assertionPassCount === 1 ? '' : 's'} matched`}
          </span>
        </div>
      )}
      {bringupTickGroups.length === 0 ? (
        <IdeCallout tone="info" title="No bring-up vectors">
          <p className="ide-copy">Generate vectors first, then run the simulation.</p>
          <div className="ide-inline-actions">
            <IdeButton tone="primary" onClick={onGenerateBringUpVectors}
              testId="ide-hw-bringup-generate">
              Generate
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenVerify}>Run Verify</IdeButton>
          </div>
        </IdeCallout>
      ) : (
        <div className="ide-hw-bringup-step" data-testid="ide-hw-bringup-step">
          <div className="ide-hw-step-header">
            <span className="ide-hw-step-counter">
              Step {bringupStepIndex + 1} of {bringupTickGroups.length}
            </span>
            {currentTick !== undefined && (
              <code className="ide-hw-step-tick">t{currentTick}</code>
            )}
          </div>
          {(() => {
            const swSignals = (bringupTickGroups[bringupStepIndex]?.[1] ?? []).filter(s => /sw/i.test(s.signal));
            if (swSignals.length === 0) return null;
            const instructions = swSignals.map(s => {
              const label = signalHumanLabel(s.signal);
              return s.expected === '1' ? `turn ${label} ON` : `turn ${label} OFF`;
            });
            const text = instructions.length === 1
              ? instructions[0].charAt(0).toUpperCase() + instructions[0].slice(1)
              : `${instructions.slice(0, -1).join(', ')}, then ${instructions[instructions.length - 1]}`;
            return (
              <p className="ide-hw-step-instruction" data-testid="ide-hw-step-instruction">
                {text}
              </p>
            );
          })()}
          <IdeDataTable
            columns={['Signal', 'Expected']}
            rows={bringupDockRows}
            testId="ide-hw-bringup-step-table"
          />
          <div className="ide-hw-step-nav">
            <IdeButton
              tone="ghost"
              onClick={() => setBringupStepIndex(Math.max(0, bringupStepIndex - 1))}
              disabled={bringupStepIndex === 0}
              testId="ide-hw-bringup-prev"
            >
              ← Prev
            </IdeButton>
            <IdeButton
              tone="ghost"
              onClick={() =>
                setBringupStepIndex(
                  Math.min(bringupTickGroups.length - 1, bringupStepIndex + 1)
                )
              }
              disabled={bringupStepIndex === bringupTickGroups.length - 1}
              testId="ide-hw-bringup-next"
            >
              Next →
            </IdeButton>
          </div>
        </div>
      )}
    </SurfacePanel>
  );

  const confidencePassCount = confidenceChecks.filter((c) => c.pass).length;
  const proofDock = (
    <SurfacePanel className="ide-workbench-placeholder ide-hw-dock-panel ide-hw-dock--proof" testId="ide-hw-proof-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Pre-flight</h3>
        <IdeStatusPill tone={confidenceScore === 100 ? 'ok' : confidenceScore >= 60 ? 'warn' : 'error'}>
          {confidencePassCount}/{confidenceChecks.length}
        </IdeStatusPill>
      </header>
      <div className="ide-hw-confidence-list" data-testid="ide-hw-confidence-list">
        {confidenceChecks.map((check) => (
          <div key={check.label} className={`ide-hw-confidence-row ${check.pass ? 'is-pass' : 'is-pending'}`}>
            <span className="ide-hw-confidence-icon">{check.pass ? '✓' : '○'}</span>
            <span className="ide-hw-confidence-label">{check.label}</span>
          </div>
        ))}
      </div>
      <div className="ide-hw-cert-slab" data-testid="ide-hw-cert-slab">
        <div className="ide-hw-cert-row">
          <span className="ide-hw-cert-key">ASSERT</span>
          <code className="ide-hw-cert-val">{hasAssertionData ? `${assertionPassCount}P ${assertionFailCount}F` : '—'}</code>
        </div>
        <div className="ide-hw-cert-row">
          <span className="ide-hw-cert-key">COMPARE</span>
          <code className="ide-hw-cert-val">{verifyStatus}</code>
        </div>
        <div className="ide-hw-cert-row">
          <span className="ide-hw-cert-key">EXPORT</span>
          <code className="ide-hw-cert-val">{exportStatus}</code>
        </div>
        <div className="ide-hw-cert-row" data-testid="ide-hardware-cert-scenario">
          <span className="ide-hw-cert-key">SCENARIO</span>
          <code className={`ide-hw-cert-val ${scenarioDrifted ? 'ide-hw-cert-val--warn' : ''}`}>
            {verifyLastRun?.scenarioName ?? '—'}
            {scenarioDrifted ? ' [drift]' : ''}
          </code>
        </div>
      </div>
      <div className="ide-inline-actions">
        {failureTruth.condition === 'ready' ? (
          <IdeButton tone="primary" onClick={onOpenExport} testId="ide-hardware-build-export">
            {OPEN_BUILD_EXPORT_LABEL}
          </IdeButton>
        ) : (
          <IdeButton tone="primary" onClick={dominantPrimaryAction} testId="ide-hardware-build-export">
            {failureTruthPrimaryCtaLabel}
          </IdeButton>
        )}
      </div>
      {failureTruth.condition === 'ready' && (
        <div className="ide-hw-program-handoff" data-testid="ide-hardware-program-handoff-cta">
          <p className="ide-copy">
            The RedByte download is a <strong>Vivado project ZIP</strong> — it does <strong>not</strong> include a bitstream.
            In Vivado, open the project, run <strong>Generate Bitstream</strong>, then open{' '}
            <strong>Hardware Manager</strong>, add the generated <code>.bit</code> from the run folder, and use{' '}
            <strong>Program Device</strong> to flash the Basys3.
          </p>
          <p
            className="ide-copy"
            data-testid="ide-hardware-submission-hint"
            style={{ marginTop: 'var(--ide-space-2)', fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-muted)' }}
          >
            <strong>Typical lab hand-in</strong> (follow your rubric): the <strong>export ZIP</strong> from RedByte, plus
            what your course requires — often a <strong>passing Verify</strong> run and a{' '}
            <strong>working bitstream from Vivado</strong>, not RedByte export alone.
          </p>
        </div>
      )}
    </SurfacePanel>
  );

  const activeDock =
    hwMode === 'map'
      ? mapDock
      : hwMode === 'live'
        ? liveDock
        : hwMode === 'bringup'
          ? bringupDock
          : proofDock;

  // ── Inspector nodes ─────────────────────────────────────────────────
  const liveInspector = (
    <IdeInspectorSection title="Signal Log" defaultOpen>
      {signalChangeFeed.length === 0 ? (
        <p className="ide-copy" data-testid="ide-hw-signal-log-empty">
          No trace data — run Verify to record signal transitions.
        </p>
      ) : (
        <div className="ide-hw-event-log" data-testid="ide-hw-signal-log">
          {signalChangeFeed.map((ev, i) => (
            <div key={i} className="ide-hw-event-row">
              <code className="ide-hw-event-tick">t{ev.tick}</code>
              <span className={`ide-hw-event-dir ${ev.direction === 'in' ? 'is-input' : 'is-output'}`}>
                {ev.direction === 'in' ? '▶' : '◀'}
              </span>
              <code className="ide-hw-event-label">{ev.label}</code>
              <span className="ide-hw-event-change">{ev.from}→{ev.to}</span>
            </div>
          ))}
        </div>
      )}
    </IdeInspectorSection>
  );

  const bringupInspector = (
    <>
      <IdeInspectorSection title="Step Result" defaultOpen>
        {bringupStepRows.length === 0 ? (
          <p className="ide-copy">No signals.</p>
        ) : (
          <IdeDataTable
            columns={['Output', 'Expected', 'Observed', '']}
            rows={bringupStepRows}
            testId="ide-hw-bringup-result-table"
          />
        )}
      </IdeInspectorSection>
      <IdeInspectorSection title="Bring-Up Results" defaultOpen>
        {!hasAssertionData ? null : (
          <div className="ide-hw-assert-log" data-testid="ide-hw-assert-log">
            {hardwareAssertions.filter(a => a.hasData && !a.pass).slice(0, 10).map((a, i) => (
              <div
                key={i}
                className="ide-hw-assert-plain-row"
                data-testid={`ide-hw-assert-plain-${a.tick}-${a.signal}`}
              >
                <span className="ide-hw-assert-plain-fail">
                  {formatAssertionPlain(a)}
                </span>
                <span className="ide-hw-assert-plain-action">
                  {`Check whether ${signalHumanLabel(a.signal)} is correctly mapped and connected to the circuit output.`}
                </span>
              </div>
            ))}
            {hardwareAssertions.filter(a => a.hasData && a.pass).length > 0 &&
              hardwareAssertions.filter(a => a.hasData && !a.pass).length === 0 && (
              <p className="ide-copy ide-hw-assert-all-pass" data-testid="ide-hw-assert-all-pass">
                {`All ${assertionPassCount} bring-up check${assertionPassCount === 1 ? '' : 's'} passed.`}
              </p>
            )}
            <details className="ide-hw-assert-raw-details">
              <summary className="ide-hw-assert-raw-summary">Technical details</summary>
              <div className="ide-hw-assert-raw-list">
                {hardwareAssertions.slice(0, 30).map((a, i) => (
                  <code
                    key={i}
                    className={`ide-hw-assert-formal ${a.hasData ? (a.pass ? 'is-pass' : 'is-fail') : 'is-nodata'}`}
                    data-testid={`ide-hw-assert-row-${a.tick}-${a.signal}`}
                  >
                    {`ASSERT t${a.tick} ${a.signal}=${a.expected} \u2192 ${
                      !a.hasData ? 'NO_DATA' : a.pass ? 'PASS' : `FAIL(act=${a.actual})`
                    }`}
                  </code>
                ))}
                {hardwareAssertions.length > 30 && (
                  <code className="ide-hw-assert-formal is-nodata">
                    +{hardwareAssertions.length - 30} more
                  </code>
                )}
              </div>
            </details>
          </div>
        )}
      </IdeInspectorSection>
    </>
  );

  const proofInspector = (
    <>
      <IdeInspectorSection title="Assertion Summary" defaultOpen>
        {!hasAssertionData ? (
          <p className="ide-copy">Awaiting trace.</p>
        ) : assertionFailCount === 0 ? (
          <code
            className="ide-hw-assert-formal ide-hw-proof-assert-ok is-pass"
            data-testid="ide-hw-proof-assert-ok"
          >
            {'\u22A2'} {assertionPassCount} assertion{assertionPassCount === 1 ? '' : 's'} match observed outputs{confidenceScore === 100 ? ' \u220E' : ''}
          </code>
        ) : (
          <div data-testid="ide-hw-proof-assert-failures">
            <p className="ide-copy ide-hw-proof-assert-fail-note">
              {assertionFailCount} assertion{assertionFailCount > 1 ? 's' : ''} differ from observed outputs
            </p>
            <IdeDataTable
              columns={['Step', 'Output', 'Expected', 'Observed']}
              rows={hardwareAssertions
                .filter((a) => !a.pass && a.hasData)
                .slice(0, 10)
                .map((a) => [
                  `Step ${a.tick}`,
                  signalHumanLabel(a.signal),
                  a.expected === '1' ? 'ON' : 'OFF',
                  a.actual == null ? '—' : a.actual === '1' ? 'ON' : 'OFF',
                ])}
              testId="ide-hw-proof-fail-table"
            />
          </div>
        )}
      </IdeInspectorSection>
      <IdeInspectorSection title="Expected Behavior" defaultOpen={false}>
        <p className="ide-copy" data-testid="ide-hardware-expected-behavior">
          {expectedBehavior}
        </p>
      </IdeInspectorSection>
    </>
  );
  const mapInspector = (
    <>
      <IdeInspectorSection title="Mapping focus" defaultOpen>
        {!selectedMappingRow && !selectedBoardResourceAlias ? (
          <div className="ide-hw-selected-signal-card" data-testid="ide-hw-map-inspector-help">
            <strong>Ready to map</strong>
            <p className="ide-copy ide-copy--flush" data-testid="ide-hw-selected-signal-empty">
              Select a signal row in the mapping table, then choose a compatible Basys3 resource.
            </p>
            <p className="ide-copy ide-copy--flush">
              {SIGNAL_LANGUAGE.mappingBoundary}
            </p>
          </div>
        ) : selectedMappingRow ? (
          <div className="ide-hw-selected-signal-card" data-testid="ide-hw-selected-signal-card">
            <strong>{selectedMappingLabel}</strong>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Direction</span>
                <span>{selectedMappingRow.direction === 'in' ? 'Input' : 'Output'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Required</span>
                <span>{selectedMappingRow.required ? 'Required' : 'Optional'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Status</span>
                <span>{selectedSignalStatus}</span>
              </div>
              <div className="ide-kv-row">
                <span>Board control</span>
                <span>{selectedMappingBoardControl}</span>
              </div>
              <div className="ide-kv-row">
                <span>Package pin</span>
                <span>{selectedMappingPackagePin}</span>
              </div>
              <div className="ide-kv-row">
                <span>Target type</span>
                <span>{selectedMappingResource}</span>
              </div>
              <div className="ide-kv-row">
                <span>Next action</span>
                <span>{selectedSignalHasPin ? 'Edit the resource assignment' : 'Choose a compatible resource'}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="ide-copy" data-testid="ide-hw-selected-signal-empty">
            Select a signal row to inspect mapping details.
          </p>
        )}
      </IdeInspectorSection>
      <IdeInspectorSection title="Selected board control" defaultOpen>
        {selectedBoardResource ? (
          <div className="ide-hw-selected-signal-card" data-testid="ide-hw-selected-resource-card">
            <strong>{selectedBoardResource.alias}</strong>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Resource</span>
                <span>{selectedBoardResource.label}</span>
              </div>
              <div className="ide-kv-row">
                <span>Package pin</span>
                <span>{selectedBoardResource.packagePin}</span>
              </div>
              <div className="ide-kv-row">
                <span>Group</span>
                <span>{selectedBoardResource.group}</span>
              </div>
              <div className="ide-kv-row">
                <span>Type</span>
                <span>{formatPlannerResourceKind(selectedBoardResource)}</span>
              </div>
              <div className="ide-kv-row">
                <span>Status</span>
                <span>{selectedBoardResourceStatus}</span>
              </div>
            </div>
            {selectedBoardResource.category === 'clock' ? (
              <p className="ide-copy ide-copy--flush" data-testid="ide-hw-clock-truth">
                Basys3 clock resource: 100 MHz oscillator on package pin W5. Export emits a 10 ns
                create_clock constraint for the mapped top-level clock port.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="ide-copy">Choose a board control to inspect its package pin and mapping state.</p>
        )}
      </IdeInspectorSection>
      <IdeInspectorSection title="Advanced XDC preview" defaultOpen={false}>
        <p className="ide-copy ide-copy--flush">
          {EXPORT_STAGE_LABEL} uses the same saved {BOARD_CONSTRAINTS_STAGE_LABEL} assignment when
          generating <code>top.xdc</code>.
        </p>
        <pre className="ide-hw-xdc-preview" data-testid="ide-hw-xdc-preview">
          {selectedBoardResourceXdc || 'Select a board resource to preview its XDC binding.'}
        </pre>
      </IdeInspectorSection>
      <IdeInspectorSection title="Mapping diagnostics" defaultOpen={false}>
        {hasNoBoundaryRows ? (
          <p className="ide-copy" data-testid="ide-hw-map-empty">
            Add inputs and outputs in Design, then return here to assign board pins.
          </p>
        ) : unmappedRequiredPins.length === 0 ? (
          <p className="ide-copy">All required pins have Basys3 assignments.</p>
        ) : (
          <IdeDataTable
            columns={['Signal', 'Direction', 'Pin']}
            rows={unmappedRequiredPins.slice(0, 10).map((row) => [
              getStudentFacingIoLabel(row),
              row.direction === 'in' ? 'Input' : 'Output',
              row.pin || 'Unassigned',
            ])}
            testId="ide-hw-map-missing-table"
          />
        )}
        <p className="ide-copy" style={{ marginTop: 'var(--ide-space-2)' }}>
          {selectedMappingRow
            ? `Selected ${getStudentFacingIoLabel(selectedMappingRow)}. Choose a compatible resource in the selected-signal control to finish the binding.`
            : 'Select a signal row, then choose a compatible resource to bind it to a package pin.'}
        </p>
      </IdeInspectorSection>
      <IdeInspectorSection title="Preflight details" defaultOpen={false}>
        <div className="ide-kv-list" data-testid="ide-hw-map-preflight-details">
          <div className="ide-kv-row">
            <span>Verify status</span>
            <span>{verifyStatus}</span>
          </div>
          <div className="ide-kv-row">
            <span>Export status</span>
            <span>{exportStatus}</span>
          </div>
          <div className="ide-kv-row">
            <span>Required mapped</span>
            <span>{mappedRequiredCount}/{totalRequiredCount}</span>
          </div>
        </div>
      </IdeInspectorSection>
    </>
  );

  const activeInspector =
    hwMode === 'map'
      ? mapInspector
      : hwMode === 'live'
      ? liveInspector
      : hwMode === 'bringup'
        ? bringupInspector
        : proofInspector;
  const liveHardwareRows = useMemo(
    () => [
      ...Array.from({ length: 8 }, (_, index) => [`SW${index}`, String(ioBus.state.sw[index] ?? 0)]),
      ...Array.from({ length: 5 }, (_, index) => [
        ['BTNC', 'BTNU', 'BTND', 'BTNL', 'BTNR'][index],
        String(ioBus.state.btn[index] ?? 0),
      ]),
      ...Array.from({ length: 8 }, (_, index) => [`LD${index}`, String(ioBus.state.ld[index] ?? 0)]),
    ],
    [ioBus.state.btn, ioBus.state.ld, ioBus.state.sw]
  );
  const hardwareCommandDescription =
    hwMode === 'map'
      ? hasNoBoundaryRows
        ? PROFESSIONAL_CLASSROOM_COPY.hardwareNoSignals
        : mappingReady
          ? 'Every required signal has one coherent Basys3 resource and package pin. Continue to Build & Export to inspect the handoff package.'
          : selectedMappingRow
            ? `${selectedMappingLabel} is selected. Choose a compatible resource in the selected-signal control to assign the package pin.`
            : 'Pin mapping connects each circuit signal to a physical Basys3 resource. Select a signal row, choose a compatible resource, then save the assignment.'
      : nextActionHero.body;
  const hardwareCommandTitle =
    hwMode === 'map'
      ? hasNoBoundaryRows
        ? 'Add boundary I/O in Design first'
        : 'Map project signals to Basys3 controls'
      : nextActionHero.title;
  const hardwareCommandSecondaryAction =
    showBlockedHero ? heroSecondaryAction : nextActionHero.secondaryAction;
  const hardwareCommandSecondaryLabel =
    showBlockedHero ? heroSecondaryLabel : nextActionHero.secondaryLabel;
  const showHardwareCommandActions = hwMode !== 'map';
  const showHardwareCommandStrip = hwMode !== 'map';
  const hardwareCommandMeta = hwMode === 'map'
    ? (
      <>
        <IdeStatusPill
          tone={mappingReady ? 'ok' : 'warn'}
          testId="ide-hardware-mapping-progress"
        >
          {hasNoBoundaryRows
            ? 'DESIGN I/O NEEDED'
            : mappingReady
              ? 'MAPPING COMPLETE'
              : `${mappedRequiredCount} / ${totalRequiredCount} REQUIRED MAPPED`}
        </IdeStatusPill>
        <span className="ide-surface-command-chip">Basys3</span>
        <span className={`ide-surface-command-chip${mappingReady ? ' is-ok' : ''}`}>
          {mappingRows.length} signal{mappingRows.length === 1 ? '' : 's'}
        </span>
        {selectedMappingLabel ? (
          <span className="ide-surface-command-chip is-ok">Selected: {selectedMappingLabel}</span>
        ) : null}
      </>
    )
    : (
      <>
        <IdeStatusPill tone={failureTruth.severity === 'ready' ? 'ok' : failureTruth.severity === 'blocked' ? 'error' : 'warn'}>
          {failureTruth.statusLabel.toUpperCase()}
        </IdeStatusPill>
        <span className="ide-surface-command-chip">Basys3</span>
        <span className="ide-surface-command-chip">
          {explicitTimingMode === 'synchronous_board_clock'
            ? 'Mode: board clock'
            : explicitTimingMode === 'manual_event_driven_lab'
              ? 'Mode: manual event'
              : 'Mode: combinational'}
        </span>
        <span className={`ide-surface-command-chip${mappingReady ? ' is-ok' : ''}`}>
          {mappingReady ? 'Mapping current' : `${mappingRows.length} mapped rows`}
        </span>
        <span className={`ide-surface-command-chip${compareMatches ? ' is-ok' : ''}`}>
          {verifyStatus}
        </span>
        <span
          className={`ide-surface-command-chip${exportReady ? ' is-ok' : ''}`}
          data-testid="ide-hardware-export-status"
        >
          Export: {exportStatus}
        </span>
      </>
    );

  /** Shown in the main workspace (not the bottom console) so Verify → Export → Program and readiness are visible on first entry. */
  const hardwareWorkflowRibbon = (
    <section
      className="ide-hw-workflow-ribbon"
      data-testid="ide-hw-workflow-ribbon"
      aria-label="Hardware workflow: verify, export, then external Vivado proof"
    >
      <div className="ide-hardware-dep-chain" data-testid="ide-hardware-dep-chain">
        <button
          type="button"
          className={`ide-hardware-dep-step ${
            compareMatches || compareCurrent ? 'is-ok' : verifyCurrent && !compareMatches ? 'is-warn' : 'is-missing'
          }`}
          onClick={onOpenVerify}
          title={OPEN_SIMULATE_LABEL}
        >
          <span className="ide-hardware-dep-step__num">1</span>
          <span className="ide-hardware-dep-step__label">{VERIFY_STAGE_LABEL}</span>
          <span className="ide-hardware-dep-step__status">
            {compareMatches ? '✓' : verifyCurrent ? '⚠' : '—'}
          </span>
        </button>
        <span className="ide-hardware-dep-arrow" aria-hidden="true">
          →
        </span>
        <button
          type="button"
          className={`ide-hardware-dep-step ${
            hardwareState === 'ready' ? 'is-ok' : hardwareState === 'export-stale' ? 'is-warn' : 'is-missing'
          }`}
          onClick={onOpenExport}
          title={OPEN_BUILD_EXPORT_LABEL}
        >
          <span className="ide-hardware-dep-step__num">2</span>
          <span className="ide-hardware-dep-step__label">{EXPORT_STAGE_LABEL}</span>
          <span className="ide-hardware-dep-step__status">
            {hardwareState === 'ready'
              ? '✓'
              : hardwareState === 'export-stale'
                ? '⚠ Re-export needed'
                : '— Build needed'}
          </span>
        </button>
        <span className="ide-hardware-dep-arrow" aria-hidden="true">
          →
        </span>
        <span
          className={`ide-hardware-dep-step ide-hardware-dep-step--terminal ${
            failureTruth.condition === 'ready' ? 'is-warn' : 'is-locked'
          }`}
        >
          <span className="ide-hardware-dep-step__num">3</span>
          <span className="ide-hardware-dep-step__label">{PROGRAM_STAGE_LABEL}</span>
          <span className="ide-hardware-dep-step__status">
            {failureTruth.condition === 'ready' ? 'Vivado proof pending' : 'Locked'}
          </span>
        </span>
      </div>
      <IdeCallout
        tone={readinessCalloutTone}
        title={hardwareReadinessTitle}
        testId="ide-hardware-readiness-callout"
      >
        {hardwareReadinessMessage}
      </IdeCallout>
    </section>
  );

  if (hasNoBoundaryRows) {
    return (
      <IdeSurfaceLayout
        mode="hardware"
        layoutIntent="workbench"
        leftDockMode="hidden"
        rightDockMode="hidden"
        consoleMode="hidden"
        inspector={null}
      >
        <div
          className="ide-hardware-panel ide-hardware-panel--no-signals"
          data-testid="ide-hardware-panel"
        >
          <IdeEmptyState
            title="No signals to map yet"
            body={PROFESSIONAL_CLASSROOM_COPY.hardwareNoSignals}
            testId="ide-hw-map-empty"
            primaryAction={(
              <span data-testid="ide-primary-cta">
                <IdeButton
                  tone="primary"
                  onClick={onGoToDesign ?? (() => {})}
                  testId="ide-hardware-next-primary"
                  disabled={!onGoToDesign}
                >
                  Open Design
                </IdeButton>
              </span>
            )}
          />
        </div>
      </IdeSurfaceLayout>
    );
  }

  return (
    <IdeSurfaceLayout
      mode="hardware"
      layoutIntent="workbench"
      leftDockMode={hwMode === 'map' ? 'hidden' : 'collapsed'}
      rightDockMode={hwMode === 'map' ? 'hidden' : 'collapsed'}
      rightDockCanCollapse
      consoleMode="hidden"
      productSpine={{
        statusLabel: failureTruth.statusLabel,
        statusTone: failureTruth.severity === 'ready'
          ? 'ok'
          : failureTruth.severity === 'blocked'
            ? 'error'
            : 'warn',
        detail: showBlockedHero ? failureTruthMessage : nextActionHero.body,
        primaryLabel: showBlockedHero ? failureTruthPrimaryCtaLabel : nextActionHero.primaryLabel,
        onPrimary: showBlockedHero ? dominantPrimaryAction : nextActionHero.primaryAction,
        recoveryLabel: hardwareCommandSecondaryLabel ?? undefined,
        onRecovery: hardwareCommandSecondaryAction ?? undefined,
        doneLabel: mappingReady
          ? 'Required signals are mapped to Basys3 resources and package pins.'
          : 'Every required signal has a non-conflicting board resource and package pin.',
        blockedLabel: !hasRequiredMappingRows
          ? 'No required project IO boundary is available from Design.'
          : mappingReady
            ? failureTruthMessage
            : `${mappingAttentionCount} required mapping issue${mappingAttentionCount === 1 ? '' : 's'} still need attention.`,
      }}
      dock={hwMode === 'map' ? null : activeDock}
      inspector={
        hwMode === 'map' ? null : <>
          {hwMode !== 'map' && (
            <IdeInspectorSection title="Live Hardware State" defaultOpen>
              <IdeDataTable
                columns={['Signal', 'Value']}
                rows={liveHardwareRows}
                testId="ide-hardware-live-state-table"
              />
            </IdeInspectorSection>
          )}
          {activeInspector}
        </>
      }
    >
      <IdePanel
        title={hwMode === 'map' ? undefined : 'Hardware'}
        description={hwMode === 'map' ? undefined : 'Map pins, inspect export constraints, and keep Vivado/board proof external.'}
        right={hwMode === 'map' ? undefined : (
          <IdeStatusPill tone={failureTruth.severity === 'ready' ? 'ok' : failureTruth.severity === 'blocked' ? 'error' : 'warn'}>
            {failureTruth.statusLabel}
          </IdeStatusPill>
        )}
        testId="ide-hardware-panel"
        className={hasNoBoundaryRows ? 'ide-hardware-panel--no-signals' : undefined}
      >
        <div className="ide-surface-command-stack">
          {showHardwareCommandStrip ? (
            <SurfaceCommandStrip
              className="ide-hardware-command-strip"
              testId="ide-hardware-command-strip"
              label="Hardware"
              title={hardwareCommandTitle}
              description={hardwareCommandDescription}
              meta={hardwareCommandMeta}
              actions={
                showHardwareCommandActions ? (
                  <>
                    <span data-testid="ide-primary-cta">
                      <IdeButton
                        tone="primary"
                        onClick={showBlockedHero ? dominantPrimaryAction : nextActionHero.primaryAction}
                        testId={showBlockedHero ? 'ide-hardware-blocked-primary' : nextActionHero.primaryTestId}
                      >
                        {showBlockedHero ? failureTruthPrimaryCtaLabel : nextActionHero.primaryLabel}
                      </IdeButton>
                    </span>
                    {hardwareCommandSecondaryAction && hardwareCommandSecondaryLabel ? (
                      <IdeButton
                        tone="secondary"
                        onClick={hardwareCommandSecondaryAction}
                        testId={showBlockedHero ? 'ide-hardware-blocked-secondary' : 'ide-hardware-next-secondary'}
                      >
                        {hardwareCommandSecondaryLabel}
                      </IdeButton>
                    ) : null}
                  </>
                ) : undefined
              }
            />
          ) : null}
        </div>
        {/* Slice N4 — chrome rebuild: always-visible exit affordance from any
            sub-mode back to Map Pins. Previous design relied on the mode-tabs
            below the stage-rail caption, which students missed and reported as
            being "trapped" in the bringup/proof/live mode with no way out. */}
        {hwMode !== 'map' ? (
          <div
            className="ide-hw-mode-exit-banner"
            data-testid="ide-hw-mode-exit-banner"
            role="region"
            aria-label="Hardware sub-mode navigation"
          >
            <IdeButton
              tone="secondary"
              onClick={() => {
                setHwMode('map');
                setSelectedMappingRowId(null);
              }}
              testId="ide-hw-mode-exit-back"
            >
              ← Back to {BOARD_CONSTRAINTS_STAGE_LABEL}
            </IdeButton>
            <span className="ide-hw-mode-exit-hint" data-testid="ide-hw-mode-exit-hint">
              {hwMode === 'bringup'
                ? 'Board Check active — press Esc or click Back to return to Board & Constraints.'
                : hwMode === 'proof'
                  ? 'Pre-flight active — press Esc or click Back to return to Board & Constraints.'
                  : 'Simulation active — press Esc or click Back to return to Board & Constraints.'}
            </span>
          </div>
        ) : null}
        {/* ── Connection callout strip ── */}
        {/* ── Stage rail: workflow caption + primary stage tabs ── */}
        {hwMode !== 'map' ? (
        <div className="ide-hw-stage-rail ide-hw-stage-rail--demoted" data-testid="ide-hw-stage-rail">
          <div className="ide-hw-stage-rail-top">
            <div className="ide-hw-stage-rail-intro">
              <span className="ide-hw-stage-kicker">After mapping</span>
              <p className="ide-hw-stage-caption">
                Board check, pre-flight, and live simulation stay available, but pin binding is the main hardware job.
              </p>
            </div>
            {sim.tick > 0 ? (
              <span className="ide-hw-tick-badge" data-testid="ide-hw-tick-badge">
                Sim t{sim.tick}
              </span>
            ) : null}
          </div>
          <div
            className="ide-hw-mode-toggle"
            data-testid="ide-hw-mode-toggle"
            role="tablist"
            aria-label="Hardware bring-up stages"
          >
            <button
              type="button"
              role="tab"
              aria-selected={hwMode === 'map'}
              className={`ide-hw-mode-segment${hwMode === 'map' ? ' is-active' : ''}`}
              data-testid="ide-hw-mode-btn-map"
              onClick={() => {
                setHwMode('map');
                setSelectedMappingRowId(null);
              }}
            >
              <span className="ide-hw-mode-segment-title">Assignments</span>
              <span className="ide-hw-mode-segment-hint">Bind I/O and inspect XDC</span>
              <span className="ide-hw-mode-segment-status" aria-hidden="true">
                {mappingReady ? '✓' : mappingAttentionCount > 0 ? '○' : '·'}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={hwMode === 'bringup'}
              className={`ide-hw-mode-segment${hwMode === 'bringup' ? ' is-active' : ''}`}
              data-testid="ide-hw-mode-btn-bringup"
              onClick={() => {
                setHwMode('bringup');
                setSelectedMappingRowId(null);
              }}
            >
              <span className="ide-hw-mode-segment-title">Board Check</span>
              <span className="ide-hw-mode-segment-hint">Guided board checks</span>
              <span className="ide-hw-mode-segment-status" aria-hidden="true">
                {vectorsCount > 0 ? '✓' : '○'}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={hwMode === 'proof'}
              className={`ide-hw-mode-segment${hwMode === 'proof' ? ' is-active' : ''}`}
              data-testid="ide-hw-mode-btn-proof"
              onClick={() => {
                setHwMode('proof');
                setSelectedMappingRowId(null);
              }}
            >
              <span className="ide-hw-mode-segment-title">Pre-flight</span>
              <span className="ide-hw-mode-segment-hint">Readiness gate</span>
              <span className="ide-hw-mode-segment-status" aria-hidden="true">
                {confidenceScore === 100 ? '✓' : '·'}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={hwMode === 'live'}
              className={`ide-hw-mode-segment${hwMode === 'live' ? ' is-active' : ''}`}
              data-testid="ide-hw-mode-btn-live"
              onClick={() => {
                setHwMode('live');
                setSelectedMappingRowId(null);
              }}
            >
              <span className="ide-hw-mode-segment-title">Simulation</span>
              <span className="ide-hw-mode-segment-hint">Live sandbox</span>
              <span className="ide-hw-mode-segment-status" aria-hidden="true">
                ·
              </span>
            </button>
          </div>
        </div>
        ) : null}

        {/* ── Scenario provenance strip — hidden on map tab ── */}
        {hwMode !== 'map' && verifyLastRun && (
          <details className="ide-hardware-provenance-details" data-testid="ide-hardware-provenance-details">
            <summary className="ide-hardware-provenance-summary">Last Verify evidence</summary>
            <div className="ide-hardware-provenance-strip" data-testid="ide-hardware-provenance-strip">
            <span className="ide-hardware-provenance-run-label" data-testid="ide-hardware-provenance-run-label">
              Compared: &ldquo;{verifyLastRun.scenarioName}&rdquo;
            </span>
            <span className="ide-hardware-provenance-sep" aria-hidden="true">·</span>
            <span
              className={`ide-hardware-provenance-axis ide-hardware-provenance-axis--${scenarioDrifted ? 'warn' : 'ok'}`}
              data-testid="ide-hardware-scenario-axis"
            >
              {isDifferentScenario
                ? '⚠ Different scenario selected'
                : isSameScenarioEdited
                  ? '⚠ Scenario edited since run'
                  : '✓ Scenario current'}
            </span>
            {!scenarioDrifted && vectorsAreAutoGenerated && (
              <>
                <span className="ide-hardware-provenance-sep" aria-hidden="true">·</span>
                <span
                  className="ide-hardware-provenance-axis ide-hardware-provenance-axis--warn"
                  data-testid="ide-hardware-seal-axis"
                >
                  ~ Starter scenario
                </span>
              </>
            )}
            </div>
          </details>
        )}

        {/* ── Scenario drift callout ── */}
        {hwMode !== 'map' && scenarioDrifted && verifyLastRun && (
          <IdeCallout
            tone="warn"
            title={isDifferentScenario ? 'Different scenario active' : 'Scenario edited since last run'}
            testId="ide-hardware-drift-callout"
          >
            <p className="ide-copy" style={{ margin: 0 }}>
              {isDifferentScenario
                ? `The board view reflects verify results for \u201c${verifyLastRun.scenarioName}\u201d. You have a different scenario active — re-run Verify to get results for the current scenario.`
                : `\u201c${verifyLastRun.scenarioName}\u201d was edited after the last verify run. Re-run Verify to get a current result.`}
            </p>
            <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
              <IdeButton tone="primary" onClick={onOpenVerify} testId="ide-hardware-drift-reverify">
                Re-run Verify
              </IdeButton>
              {isDifferentScenario && switchBackScenario && onSwitchScenario && (
                <IdeButton
                  tone="ghost"
                  onClick={() => onSwitchScenario(verifyLastRun.scenarioId)}
                  testId="ide-hardware-drift-switchback"
                >
                  Switch to &ldquo;{switchBackScenario.name}&rdquo;
                </IdeButton>
              )}
            </div>
          </IdeCallout>
        )}

        {/* ── Starter-seal note — shown when verify is ready but unsealed ── */}
        {hwMode !== 'map' && compareCurrent && !scenarioDrifted && vectorsAreAutoGenerated && (
          <IdeCallout tone="warn" testId="ide-hardware-starter-seal-note">
            <p className="ide-copy" style={{ margin: 0 }}>
              <strong>Ready — starter scenario only.</strong>{' '}
              The board is backed by a starter scenario only. Author a real test scenario and rerun Compare before relying on this result for lab work.
            </p>
          </IdeCallout>
        )}

        {/* ── SSD guidance callout ── */}
        {hwMode !== 'map' && hasSsdMapping && (
          <IdeCallout tone="info" title="7-Segment Display" testId="ide-hw-ssd-callout">
            <p className="ide-copy" style={{ margin: 0 }}>
              Your circuit uses 7-segment display outputs. The Basys3 uses <strong>active-low</strong> segment
              lines (0 = segment ON). Digit select (AN0–AN3) are also active-low; AN0 controls the rightmost
              digit. Segment order: CA=seg[0], CB=seg[1], CC=seg[2], CD=seg[3], CE=seg[4], CF=seg[5],
              CG=seg[6], DP=decimal point.
            </p>
          </IdeCallout>
        )}

        {/* ── Debounce guidance callout ── */}
        {hwMode !== 'map' && hasButtonMapping && !debounceDismissed && (
          <IdeCallout tone="warn" title="Physical buttons bounce" testId="ide-hw-debounce-callout">
            <p className="ide-copy" style={{ margin: 0 }}>
              Physical push buttons produce multiple signal transitions when pressed or released. Add
              synchronizer flip-flops or a debounce delay to ensure reliable edge detection.
            </p>
            <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
              <IdeButton
                tone="ghost"
                onClick={() => setDebounceDismissed(true)}
                testId="ide-hw-debounce-dismiss"
              >
                Got it
              </IdeButton>
            </div>
          </IdeCallout>
        )}

        {/* Visual System v1: the assignment table and physical board are one mapping workspace. */}
        {hwMode === 'map' ? (
          <section
            className="ide-hw-v3"
            data-testid="ide-hw-board-workspace"
            data-hierarchy-surface="hardware"
            data-hierarchy-role="primary"
          >
            <header className="ide-hw-v3__progress" data-testid="ide-hw-board-resource-summary">
              <div className="ide-hw-v3__progress-copy">
                <p className="ide-surface-block-label">Board &amp; Constraints</p>
                <h2>Plan Basys3 I/O and constraint intent</h2>
                <strong data-testid="ide-hardware-mapping-progress">
                  {mappingReady
                    ? 'MAPPING COMPLETE'
                    : `${mappedRequiredCount} / ${totalRequiredCount} REQUIRED MAPPED`}
                </strong>
                <p className="ide-copy ide-copy--flush" data-testid="ide-hardware-signal-resource-pin-model">
                  {SIGNAL_LANGUAGE.mappingBoundary}
                </p>
              </div>
              <div
                className={'ide-hw-v3__metrics' + (mappingReady ? ' is-ready' : '')}
                data-testid="ide-hw-mapping-overview"
                aria-label="Pin mapping progress"
              >
                <div data-testid="ide-hw-mapping-overview-assigned"><span>Assigned</span><strong>{mappedRequiredCount}/{totalRequiredCount}</strong></div>
                <div data-testid="ide-hw-mapping-overview-unassigned">
                  <span>Unassigned</span>
                  <strong>{unresolvedRequiredCount}</strong>
                  <small>
                    {unresolvedRequiredCount === 0
                      ? 'all required mappings assigned'
                      : unresolvedRequiredCount === 1
                        ? 'mapping needs a resource'
                        : 'mappings need resources'}
                  </small>
                </div>
                <div className={conflictingRequiredCount > 0 ? 'is-conflict' : undefined} data-testid="ide-hw-mapping-overview-conflicts">
                  <span>Conflicts</span><strong>{conflictingRequiredCount}</strong>
                </div>
              </div>
              <div className="ide-hw-v3__next" data-testid="ide-hw-mapping-next-action">
                <span>
                  {mappingHandoffBlockedByDesign
                    ? 'Mapping complete · Design blocked'
                    : mappingReady
                      ? 'Ready for export'
                      : 'Next action'}
                </span>
                <strong>
                  {mappingHandoffBlockedByDesign
                    ? 'Repair the circuit in Design'
                    : mappingReady
                    ? 'Inspect the package in Build & Export'
                    : nextMappingIssueRow
                      ? (conflictingMappingRows.includes(nextMappingIssueRow) ? 'Resolve ' : 'Assign ') + formatProjectSignalName(nextMappingIssueRow)
                      : 'Review required assignments'}
                </strong>
                <div data-testid="ide-hardware-next-primary">
                  <IdeButton
                    tone="primary"
                    onClick={mappingHandoffBlockedByDesign
                      ? onGoToDesign
                      : mappingReady
                        ? onOpenExport
                        : () => {
                            if (!nextMappingIssueRow) return;
                            setSelectedMappingRowId(nextMappingIssueRow.id);
                            setSelectedBoardResourceAlias(resolveBoardControlAlias(nextMappingIssueRow.pin));
                          }}
                    disabled={
                      mappingHandoffBlockedByDesign
                        ? !onGoToDesign
                        : !mappingReady && !nextMappingIssueRow
                    }
                    testId={
                      mappingHandoffBlockedByDesign
                        ? 'ide-hw-open-design-blocker'
                        : mappingReady
                          ? 'ide-hw-continue-export'
                          : 'ide-hw-select-next-mapping'
                    }
                  >
                    {mappingHandoffBlockedByDesign
                      ? 'Open Design'
                      : mappingReady
                        ? 'Continue to Build & Export'
                        : 'Select next signal'}
                  </IdeButton>
                </div>
              </div>
            </header>

            <div className="ide-hw-v3__workspace">
              <section className="ide-hw-v3__assignments" aria-labelledby="ide-hw-v3-table-title">
                <header className="ide-hw-v3__section-header">
                  <div><p className="ide-surface-block-label">Signal assignments</p><h3 id="ide-hw-v3-table-title">Project I/O</h3></div>
                  <p className="ide-copy ide-copy--flush">Select Edit to keep one signal in the assignment editor.</p>
                </header>
                {mapModeGroups.length === 0 ? (
                  <IdeCallout tone="info" title="Nothing to map yet" testId="ide-hw-map-empty">
                    Add inputs and outputs in Design, then return here to assign board resources.
                  </IdeCallout>
                ) : (
                  <div className="ide-hw-v3__table-scroll">
                    <table
                      className="ide-hw-v3__table"
                      data-testid="ide-hw-map-table"
                      data-columns="Logical signal|Purpose|Board resource|Package pin|Status|Action"
                      data-work-priority="primary"
                    >
                      <thead><tr>
                        <th scope="col">Logical signal</th><th scope="col">Purpose</th><th scope="col">Board resource</th>
                        <th scope="col">Package pin</th><th scope="col">Status</th><th scope="col">Action</th>
                      </tr></thead>
                      {mapModeGroups.map((group) => (
                        <tbody key={group.id} data-testid={`ide-hw-map-group-${group.id}`}>
                          <tr className="ide-hw-v3__group-row">
                            <th scope="rowgroup" colSpan={6}>
                              <span className="ide-hw-v3__group-heading">
                                <strong>{group.label}</strong>
                                <small>{group.rows.length} {group.rows.length === 1 ? 'signal' : 'signals'}</small>
                              </span>
                            </th>
                          </tr>
                          {group.rows.map((row) => {
                          const projection = mappingProjectionById.get(row.id);
                          const isMissing = projection
                            ? projection.required && projection.conflictState === 'missing-pin'
                            : row.required && row.pin.trim().length === 0;
                          const completeness = deriveMappingCompleteness(row);
                          const resourceChip = formatBoardResourceChip(row.boardResourceType);
                          const timingChip = formatTimingRoleChip(row.timingRole);
                          const conflictKey = mappingPinConflictKey(row.pin);
                          const projectionHasConflict = Boolean(
                            projection &&
                              projection.conflictState !== 'none' &&
                              projection.conflictState !== 'missing-pin' &&
                              projection.conflictState !== 'invalid-resource'
                          );
                          const hasConflict = projectionHasConflict ||
                            (conflictKey.length > 0 && (pinUsageCounts.get(conflictKey) ?? 0) > 1);
                          const statusLabel = hasConflict
                            ? 'Conflict'
                            : projection?.conflictState === 'invalid-resource' || completeness === 'partial'
                              ? 'Needs review'
                              : isMissing
                                ? 'Unassigned'
                              : row.required
                                  ? 'Assigned'
                                  : 'Optional';
                          const signalIdentity = splitMappingSignalLabel(
                            projection?.logicalLabel ?? getStudentFacingIoLabel(row, row.id)
                          );
                          const artifactPortName = projection?.artifactPortName?.trim() || signalIdentity.physical;
                          return (
                            <tr
                              key={row.id}
                              className={'ide-hw-v3__mapping-row ' + (selectedMappingRowId === row.id ? 'is-selected ' : '') + (hasConflict ? 'is-conflict ' : '') + (isMissing ? 'is-missing' : '')}
                              data-testid={'ide-hw-map-row-' + row.id}
                              data-required={row.required ? 'true' : 'false'}
                              aria-selected={selectedMappingRowId === row.id}
                              onClick={() => {
                                setSelectedMappingRowId(row.id);
                                setSelectedBoardResourceAlias(resolveBoardControlAlias(row.pin));
                              }}
                            >
                              <th scope="row" data-testid={'ide-hw-map-row-signal-' + row.id}>
                                <strong>{signalIdentity.logical}</strong>
                                {artifactPortName ? <small>Artifact port: {artifactPortName}</small> : null}
                              </th>
                              <td data-testid={'ide-hw-map-row-role-' + row.id}>
                                {row.direction === 'in' ? 'Circuit input' : 'Circuit output'}
                                {timingChip ? ' · ' + timingChip : resourceChip ? ' · ' + resourceChip : ''}
                              </td>
                              <td data-testid={'ide-hw-map-row-binding-' + row.id}>{projection?.boardResourceLabel ?? describeBoardControl(row.pin)}</td>
                              <td>{projection?.packagePin ?? describePackagePin(row.pin)}</td>
                              <td data-testid={'ide-hw-map-row-status-' + row.id}><span className="ide-hw-v3__status">{statusLabel}</span></td>
                              <td>
                                <button
                                  type="button"
                                  className="ide-hw-v3__row-action"
                                  data-testid={'ide-hw-map-row-action-' + row.id}
                                  aria-pressed={selectedMappingRowId === row.id}
                                  onClick={() => {
                                    setSelectedMappingRowId(row.id);
                                    setSelectedBoardResourceAlias(resolveBoardControlAlias(row.pin));
                                  }}
                                >
                                  {hasConflict ? 'Resolve' : isMissing ? 'Assign' : 'Edit mapping'}
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      ))}
                    </table>
                  </div>
                )}
                <PinPlannerTable
                  rows={pinPlannerRows}
                  selectedRowId={selectedMappingRowId}
                  onSelectRow={(plannerRow) => {
                    setSelectedMappingRowId(plannerRow.rowId);
                    const row = mappingRows.find((candidate) => candidate.id === plannerRow.rowId);
                    setSelectedBoardResourceAlias(resolveBoardControlAlias(row?.pin));
                  }}
                />
              </section>

              <aside className="ide-hw-v3__side" aria-label="Selected mapping and board reference">
                <section
                  className={'ide-hw-v3__editor' + (selectedSignalConflict ? ' is-conflict' : '')}
                  data-testid="ide-hw-selected-mapping-editor"
                  aria-labelledby="ide-hw-selected-mapping-editor-title"
                >
                  <header className="ide-hw-v3__section-header">
                    <div><p className="ide-surface-block-label">Selected signal</p><h3 id="ide-hw-selected-mapping-editor-title">{selectedMappingLabel ?? 'Choose a signal'}</h3></div>
                    <strong data-testid="ide-hw-selected-mapping-status">{selectedSignalStatus}</strong>
                  </header>
                  {selectedMappingRow ? (
                    <>
                      <p className="ide-copy ide-copy--flush">
                        {selectedMappingRow.direction === 'in' ? 'Circuit input' : 'Circuit output'}{' · '}{selectedMappingRow.required ? 'Required' : 'Optional'}
                      </p>
                      {selectedSignalConflict ? (
                        <ConflictRepairPanel
                          testId="ide-hw-selected-mapping-conflict"
                          conflict={{
                            resource: selectedMappingBoardControl ?? selectedMappingRow.pin.toUpperCase(),
                            packagePin:
                              selectedMappingPackagePin === 'Not assigned' ? null : selectedMappingPackagePin,
                            currentOwner:
                              (mappedRowsByPackagePin.get(resolveBasys3PackagePin(selectedMappingRow.pin) ?? '') ?? [])
                                .filter((row) => row.id !== selectedMappingRow.id)
                                .map(formatProjectSignalName)[0] ?? formatProjectSignalName(selectedMappingRow),
                            requestedOwner: formatProjectSignalName(selectedMappingRow),
                            reason: selectedConflictMessage,
                          }}
                          onClear={
                            onSetMappingPin ? () => onSetMappingPin(selectedMappingRow.id, '') : undefined
                          }
                          onNextCompatible={
                            onSetMappingPin
                              ? () => {
                                  const next = compatiblePlannerResources.find(
                                    (resource) =>
                                      !(mappedRowsByPackagePin.get(resource.packagePin) ?? []).some(
                                        (row) => row.id !== selectedMappingRow.id
                                      )
                                  );
                                  if (next) onSetMappingPin(selectedMappingRow.id, next.packagePin);
                                }
                              : undefined
                          }
                          onCancel={() => setSelectedBoardResourceAlias(null)}
                        />
                      ) : null}
                      <label className="ide-hw-v3__field" htmlFor="ide-hw-direct-resource-select">
                        Basys3 resource
                        <select
                          id="ide-hw-direct-resource-select"
                          value={selectedBoardResourceAlias ?? ''}
                          onChange={(event) => setSelectedBoardResourceAlias(event.target.value || null)}
                          data-testid="ide-hw-direct-resource-select"
                        >
                          <option value="">Choose a compatible control</option>
                          {compatiblePlannerResources.map((resource) => {
                            const otherRows = (mappedRowsByPackagePin.get(resource.packagePin) ?? []).filter((candidate) => candidate.id !== selectedMappingRow.id);
                            return (
                              <option key={resource.id} value={resource.alias} disabled={otherRows.length > 0}>
                                {resource.alias} · {resource.label} · pin {resource.packagePin}{otherRows.length > 0 ? ' · already assigned' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <p className="ide-hw-v3__consequence" data-testid="ide-hw-selected-mapping-consequence">
                        {selectedBoardResource
                          ? selectedBoardResource.alias + ' uses package pin ' + selectedBoardResource.packagePin +
                            '. Export will bind artifact port ' + (selectedMappingProjection?.artifactPortName ?? selectedXdcPortRef) + ' in top.xdc.'
                          : 'Choose from the selector or click a highlighted Basys3 resource. Both update the same saved mapping.'}
                      </p>
                      <div className="ide-hw-v3__editor-actions">
                        <IdeButton
                          tone="secondary"
                          onClick={() => {
                            if (!selectedBoardResource || !onSetMappingPin) return;
                            onSetMappingPin(selectedMappingRow.id, selectedBoardResource.packagePin);
                          }}
                          disabled={!selectedResourceNeedsApply || !onSetMappingPin}
                          testId="ide-hw-assign-selected-resource"
                        >
                          {selectedResourceNeedsApply ? 'Save assignment' : selectedSignalHasPin ? 'Assignment saved' : 'Choose resource'}
                        </IdeButton>
                        {selectedSignalHasPin ? (
                          <IdeButton
                            tone="ghost"
                            onClick={() => {
                              onSetMappingPin?.(selectedMappingRow.id, '');
                              setSelectedBoardResourceAlias(null);
                            }}
                            disabled={!onSetMappingPin}
                            testId="ide-hw-clear-selected-resource"
                          >Clear</IdeButton>
                        ) : null}
                      </div>
                      {selectedBusPlan ? (
                        <div className="ide-hw-v3__editor-actions" data-testid="ide-hw-bus-plan">
                          <IdeButton
                            tone="ghost"
                            onClick={applySelectedBusPlan}
                            disabled={!onSetMappingPin && !onSetMappingPins}
                            testId="ide-hw-bus-plan-apply"
                            title={selectedBusPlan.resolution.targets
                              .map((target) => `${target.logical} -> ${target.pin}`)
                              .join(', ')}
                          >
                            {`Map ${selectedBusPlan.base} bus (${selectedBusPlan.resolution.targets.length} of ${selectedBusPlan.familyCount} bits) in order`}
                          </IdeButton>
                          {selectedBusPlan.proposal.conflicts.length > 0 ? (
                            <small data-testid="ide-hw-bus-plan-conflicts">
                              {`${selectedBusPlan.proposal.conflicts.length} bit(s) have no free compatible resource.`}
                            </small>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="ide-hardware-basys3-binding-chain" data-testid="ide-hardware-basys3-binding-chain" aria-label="Selected Basys3 binding chain">
                        <span data-testid="ide-hardware-chain-signal"><small>Signal</small><strong>{selectedMappingLabel}</strong></span>
                        {selectedMappingProjection ? (
                          <><span aria-hidden="true">-&gt;</span><span data-testid="ide-hardware-chain-artifact"><small>Artifact port</small><strong>{selectedMappingProjection.artifactPortName}</strong></span></>
                        ) : null}
                        <span aria-hidden="true">→</span>
                        <span data-testid="ide-hardware-chain-board"><small>Resource</small><strong>{selectedMappingBoardControl}</strong></span>
                        <span aria-hidden="true">→</span>
                        <span data-testid="ide-hardware-chain-pin"><small>Pin</small><strong>{selectedMappingPackagePin}</strong></span>
                        <pre data-testid="ide-hardware-basys3-binding-xdc">{selectedBoardResourceXdc || 'Assign a resource to preview the XDC constraint.'}</pre>
                      </div>
                    </>
                  ) : (
                    <p className="ide-copy ide-copy--flush">Select Assign or Edit in the table to begin.</p>
                  )}
                </section>

                <section className="ide-hw-v3__board" data-testid="ide-hw-map-board" data-work-priority="primary">
                  <header className="ide-hw-v3__section-header">
                    <div>
                      <p className="ide-surface-block-label">Interactive board</p>
                      <h3>Basys3</h3>
                      <p className="ide-copy ide-copy--flush" data-testid="ide-hw-board-task-copy">
                      {selectedMappingRow ? 'Click a highlighted compatible resource to assign it immediately.' : 'Select a logical signal, then choose its physical board resource here.'}
                      </p>
                    </div>
                  </header>
                  <div
                    className="ide-hw-v3__board-reference-graphic"
                    data-testid="ide-hw-board-reference-graphic"
                    role="region"
                    aria-label="Interactive Basys3 board assignment canvas"
                  >
                    <Basys3BoardView
                      mappedAliases={mapModeAliases}
                      highlightedAlias={selectedBoardResourceAlias ?? selectedMappingRowPin}
                      allowedAliases={selectedMappingRow ? new Set(compatiblePlannerResources.map((resource) => resource.alias)) : new Set<string>()}
                      assignmentMode={Boolean(selectedMappingRow)}
                      onSelectAlias={(alias) => {
                        if (!selectedMappingRow) return;
                        const resource = compatiblePlannerResources.find((candidate) => candidate.alias === alias);
                        if (!resource) return;
                        const occupiedByAnotherSignal = (mappedRowsByPackagePin.get(resource.packagePin) ?? [])
                          .some((candidate) => candidate.id !== selectedMappingRow.id);
                        if (occupiedByAnotherSignal) return;
                        setSelectedBoardResourceAlias(alias);
                        onSetMappingPin?.(selectedMappingRow.id, resource.packagePin);
                      }}
                    />
                  </div>
                </section>
              </aside>
            </div>

            {guidedLabTask && guidedLabHardwareChecklist ? (
              <section className="ide-hw-v3__lab" data-testid="ide-hardware-guided-full-adder-mapping">
                <div>
                  <p className="ide-surface-block-label">Active lab</p>
                  <h3>{guidedLabTask.shortTitle}</h3>
                  <p className="ide-copy ide-copy--flush">
                    {guidedLabHardwareChecklist.readyForExport ? 'The suggested Basys3 submission map is complete.' : 'Apply only the missing suggested assignments.'}
                  </p>
                </div>
                <IdeButton tone="secondary" onClick={onApplyGuidedLabMapping} disabled={!onApplyGuidedLabMapping} testId="ide-hardware-guided-full-adder-map-missing">
                  Map missing pins
                </IdeButton>
              </section>
            ) : null}

            <section className="ide-hw-v3__after" data-testid="ide-hw-after-mapping-tools">
              <div>
                <p className="ide-surface-block-label">After mapping</p>
                <p className="ide-copy ide-copy--flush">
                  Check the assignment, rehearse the lab, or drive the simulated board. Simulation is exploratory and is not hardware evidence.
                </p>
              </div>
              <div className="ide-hw-v3__after-actions" data-testid="ide-hw-mode-toggle">
                <IdeButton tone="secondary" onClick={() => { setHwMode('bringup'); setSelectedMappingRowId(null); }} testId="ide-hw-mode-btn-bringup">Board Check</IdeButton>
                <IdeButton tone="secondary" onClick={() => { setHwMode('proof'); setSelectedMappingRowId(null); }} testId="ide-hw-mode-btn-proof">Pre-flight</IdeButton>
                <IdeButton tone="ghost" onClick={() => { setHwMode('live'); setSelectedMappingRowId(null); }} testId="ide-hw-mode-btn-live">Open simulated board</IdeButton>
              </div>
            </section>
          </section>
        ) : (
        <div className="ide-hw-board-workspace" data-testid="ide-hw-board-workspace">
          <header className="ide-hw-board-chrome">
            <div className="ide-hw-board-chrome-text">
              <span className="ide-hw-board-chrome-eyebrow">Board workspace</span>
              <strong className="ide-hw-board-chrome-title" data-testid="ide-hw-board-chrome-stage">
                {hardwareBoardChromeStage}
              </strong>
            </div>
            <div className="ide-hw-board-chrome-trail">
              <span className="ide-hw-board-chrome-pill">Basys3</span>
              <span className="ide-hw-board-chrome-pill ide-hw-board-chrome-pill--muted">
                {explicitTimingMode === 'synchronous_board_clock'
                  ? 'Board clock'
                  : explicitTimingMode === 'manual_event_driven_lab'
                    ? 'Manual event'
                    : 'Combinational'}
              </span>
            </div>
          </header>
          <div className="ide-hw-board-canvas">
        <div className={`ide-hw-board-wrap ${hwMode === 'proof' ? 'is-proof' : ''}`}>
          <div className="ide-hw-board-inner">
            <HardwareBoard2D
              sw={hwMode === 'live' ? simulatedBoardState.sw : ioBus.state.sw}
              ld={hwMode === 'live' ? simulatedBoardState.ld : ioBus.state.ld}
              btn={hwMode === 'live' ? simulatedBoardState.btn : ioBus.state.btn}
              mappedSw={mappedSw}
              mappedLd={mappedLd}
              mismatchedLd={mismatchedLd}
              highlightedSw={currentStepHighlights.sw}
              highlightedLd={currentStepHighlights.ld}
              activeSignal={effectiveBoardSignal}
              onSelectSignal={(sig) => setActiveBoardSignal(sig)}
              onHoverSignal={(sig) => setHoverBoardSignal(sig)}
              onToggleSwitch={(i) => {
                ioBus.actions.toggleSwitch(i);
                setActiveBoardSignal({ type: 'sw', index: i });
              }}
              onSetSwitch={(i, value) => {
                ioBus.actions.setSwitch(i, value);
                setActiveBoardSignal({ type: 'sw', index: i });
              }}
              onPressButton={(i, down) => {
                ioBus.actions.setButton(i, down ? 1 : 0);
                if (down) setActiveBoardSignal({ type: 'btn', index: i });
              }}
            />
          </div>
          {hwMode === 'proof' && (
            <div
              className={`ide-hw-proof-verdict ${
                !hasAssertionData
                  ? 'is-pending'
                  : assertionFailCount === 0
                    ? 'is-valid'
                    : 'is-invalid'
              }`}
              data-testid="ide-hw-proof-verdict"
            >
              <span className="ide-hw-proof-verdict-label" data-testid="ide-hw-proof-verdict-label">
                {!hasAssertionData
                  ? 'PROOF PENDING'
                  : assertionFailCount === 0
                    ? 'PROOF VALID'
                    : 'PROOF INVALID'}
              </span>
            </div>
          )}
        </div>
          </div>
        </div>
        )}
        {/* ── Workflow ribbon: Verify → Export → Program — below the mapping work area ── */}
        {hardwareWorkflowRibbon}
      </IdePanel>
    </IdeSurfaceLayout>
  );
};
