import React, { useEffect, useId, useMemo, useState } from 'react';
import type { ProjectHealth } from '../projectHealth';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
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
import type { IoSignalRole } from '../ioSignalRoles';
import {
  deriveHardwareExportFailureTruth,
  deriveProjectWorkflowAuthority,
  type ProjectWorkflowAuthority,
} from '../projectWorkflowAuthority';
import { createClockTimingGuidance, deriveTimingGuidanceFromRun, type TimingGuidance } from '../timingGuidance';
import {
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
import {
  buildBusEntryFromMemberRows,
  buildGuidedBoundaryOptions,
  buildGuidedHdlCatalogFromText,
  suggestEntryIdFromHdl,
} from '../hardwareMappingGuidance';

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
  onSetMappingPin?: (rowId: string, alias: string) => void;
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
  if (input.mappingRows.length === 0) return 'map';
  const hasMissingRequiredPins = input.mappingRows.some(
    (row) => row.required && row.pin.trim().length === 0
  ) || (input.missingRequiredPortsFromExport ?? 0) > 0;
  if (hasMissingRequiredPins) return 'map';
  if (input.vectorsCount > 0) return 'bringup';
  return 'proof';
}

export const HardwareSurface: React.FC<HardwareSurfaceProps> = ({
  projectName,
  expectedBehavior,
  mappingRows,
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
  onSetMappingPin,
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
  exportViewStatus = 'ok',
  designTopEntityName,
  topLevelVhdlText,
  onRepairExportDiagnostic,
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
  const [selectedMappingRowId, setSelectedMappingRowId] = useState<string | null>(null);
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
  const guidedBoundarySelectId = useId();
  const guidedHdlSelectId = useId();
  const guidedKindSelectId = useId();
  const guidedEntryIdInputId = useId();
  const guidedPortNameInputId = useId();
  const guidedHelpExportRepairId = useId();
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
      return requiredOutputs.length > 0 && requiredOutputs.every((row) => row.pin.trim().length > 0);
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
      const pin = row.pin.trim().toUpperCase();
      if (pin) s.add(pin);
    }
    return s;
  }, [mappingRows]);

  // ── Map mode: highlight the current pin of the selected row ───────────
  const selectedMappingRowPin = useMemo(() => {
    if (!selectedMappingRowId) return null;
    const row = mappingRows.find((r) => r.id === selectedMappingRowId);
    return row?.pin?.trim().toUpperCase() || null;
  }, [selectedMappingRowId, mappingRows]);

  // ── Map mode: group rows by signal type for the assignment table ───────
  const mapModeGroups = useMemo(() => {
    const groups: Array<{ label: string; rows: HardwareMappingRow[] }> = [
      { label: effectiveTimingGuidance.signalLabelSingular, rows: [] },
      { label: 'Switches', rows: [] },
      { label: 'Buttons', rows: [] },
      { label: 'LEDs', rows: [] },
      { label: '7-Segment', rows: [] },
      { label: 'Other', rows: [] },
    ];
    for (const row of mappingRows) {
      const pin = row.pin.trim().toUpperCase();
      const lbl = getStudentFacingIoLabel(row).toUpperCase();
      if (getIoSignalLookupKeys(row, mappingRows).some((key) => clockRoleKeys.has(key))) {
        groups[0].rows.push(row);
      } else if (/CLK|W5/.test(pin) || /CLK|CLOCK/.test(lbl)) {
        groups[0].rows.push(row);
      } else if (/^SW\d/.test(pin) || /^SW\d/.test(lbl)) {
        groups[1].rows.push(row);
      } else if (/^BTN/.test(pin) || /^BTN/.test(lbl)) {
        groups[2].rows.push(row);
      } else if (/^LD\d/.test(pin) || /^LD\d/.test(lbl)) {
        groups[3].rows.push(row);
      } else if (/^(CA|CB|CC|CD|CE|CF|CG|DP|AN\d)/.test(pin) || /^(CA|CB|CC|CD|CE|CF|CG|DP|AN\d)/.test(lbl)) {
        groups[4].rows.push(row);
      } else {
        groups[5].rows.push(row);
      }
    }
    return groups.filter((g) => g.rows.length > 0);
  }, [clockRoleKeys, effectiveTimingGuidance.signalLabelSingular, mappingRows]);
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
        mappingRows.filter((row) => row.required).length > 0 &&
        mappingRows.every((row) => !row.required || row.pin.trim().length > 0),
      hasVectors: vectorsCount > 0,
      verifyQualification: health.lastVerify?.qualification,
    }),
    [health.blockingIssues, health.lastVerify?.qualification, mappingRows, vectorsCount]
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
  const compareMatches =
    resolvedWorkflowAuthority.comparePassCurrent && !resolvedWorkflowAuthority.comparePassIncomplete;
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
    () => mappingRows.filter((row) => row.required && row.pin.trim().length === 0),
    [mappingRows]
  );
  const hasBoundaryRows = mappingRows.length > 0;
  const hasRequiredMappingRows = mappingRows.some((row) => row.required);
  const hasNoBoundaryRows = !hasBoundaryRows || !hasRequiredMappingRows;
  const unresolvedRequiredCount = unmappedRequiredPins.length + missingRequiredPortsFromExport;
  const mappingReady = hasRequiredMappingRows && hasClockMapping && hasOutputMapping && unresolvedRequiredCount === 0;
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
  const hasBlocking = failureTruth.severity === 'blocked';
  const readinessCalloutTone = failureTruth.severity === 'ready'
    ? 'success'
    : failureTruth.severity === 'blocked'
      ? 'error'
      : failureTruth.condition === 'verify-not-run' ||
          failureTruth.condition === 'mapping-review' ||
          failureTruth.condition === 'trace-only'
        ? 'info'
        : 'warn';
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
        body: failureTruth.message,
        primaryLabel: failureTruth.primaryCtaLabel,
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
        body: 'Map Pins only works after Design has explicit inputs and outputs. Add boundary I/O in Design, then return here to assign Basys3 pins.',
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
      const unresolvedLabel = unresolvedRequiredCount > 0
        ? `${unresolvedRequiredCount} required pin${unresolvedRequiredCount === 1 ? '' : 's'} still need board assignments.`
        : 'Finish the required clock and output mappings before you rely on the board view.';
      return {
        title: 'Map the board pins first',
        body: `Choose a signal row, then click the matching board region. ${unresolvedLabel}`,
        primaryLabel: 'Open Map Pins',
        primaryAction: () => {
          setHwMode('map');
          setSelectedMappingRowId(null);
        },
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: onGoToDesign ? 'Open Design' : null,
        secondaryAction: onGoToDesign ?? null,
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
        body: 'Create a guided bring-up sequence so you can set inputs, verify assertions, and then move to programming with less guesswork.',
        primaryLabel: 'Generate Bring-Up Steps',
        primaryAction: onGenerateBringUpVectors,
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: 'Open Pre-flight',
        secondaryAction: () => setHwMode('proof'),
      };
    }

    if (hwMode !== 'bringup') {
      return {
        title: 'Prepare the board with guided bring-up',
        body: 'Use the board-first bring-up checklist to set inputs, watch the highlighted outputs, and confirm behavior before you program the Basys3.',
        primaryLabel: 'Open Board Test',
        primaryAction: () => setHwMode('bringup'),
        primaryTestId: 'ide-hardware-next-primary',
        secondaryLabel: 'Open Pre-flight',
        secondaryAction: () => setHwMode('proof'),
      };
    }

    return {
      title: 'Follow the board test steps, then check pre-flight',
      body: 'Once the guided checks match, open Pre-flight for the final Vivado Hardware Manager handoff.',
      primaryLabel: 'Open Pre-flight',
      primaryAction: () => setHwMode('proof'),
      primaryTestId: 'ide-hardware-next-primary',
      secondaryLabel: 'Simulation',
      secondaryAction: () => setHwMode('live'),
    };
  }, [
    blockedHero,
    hasNoBoundaryRows,
    hwMode,
    isDifferentScenario,
    mappingReady,
    onGenerateBringUpVectors,
    onGoToDesign,
    onOpenVerify,
    onSwitchScenario,
    scenarioDrifted,
    switchBackScenario,
    unresolvedRequiredCount,
    vectorsCount,
    verifyLastRun,
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
      m.set(r.nodeId, meta);
      m.set(`${r.nodeId}.out`, meta);
      m.set(`${r.nodeId}.in`, meta);
    }
    return m;
  }, [ioBusIoRows]);

  interface SignalChangeEvent {
    tick: number;
    label: string;
    from: 0 | 1;
    to: 0 | 1;
    direction: 'in' | 'out';
  }

  const signalChangeFeed = useMemo<SignalChangeEvent[]>(() => {
    if (!sim.trace?.length) return [];
    const events: SignalChangeEvent[] = [];
    let prev: Record<string, 0 | 1> = {};
    for (const sample of sim.trace) {
      for (const [k, v] of Object.entries(sample.signals)) {
        const meta = nodeKeyToMeta.get(k);
        if (!meta) continue;
        const was = prev[k];
        if (was !== undefined && was !== v) {
          events.push({ tick: sample.tick, label: meta.label, from: was, to: v as 0 | 1, direction: meta.direction });
        }
      }
      Object.assign(prev, sample.signals);
    }
    return events.slice(-30).reverse();
  }, [sim.trace, nodeKeyToMeta]);

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
      label: `${effectiveTimingGuidance.signalLabelSingular} ready for board`,
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
      ? 'Stage 1 · Map Pins'
      : hwMode === 'bringup'
        ? 'Stage 2 · Test on Board'
        : hwMode === 'proof'
          ? 'Stage 3 · Pre-flight'
          : 'Stage 4 · Simulation';

  const hardwareStageCaption = useMemo(() => {
    switch (hwMode) {
      case 'map':
        if (hasNoBoundaryRows) {
          return 'Add inputs and outputs in Design first, then bind each boundary signal to a physical pin on the Basys3.';
        }
        if (mappingReady) {
          return 'Mapping is complete. Continue to Test on Board with bring-up vectors, or open Export when you are ready to build a bitstream.';
        }
        return `Assign every required signal to a board pin (${unresolvedRequiredCount} remaining). Select a row in the list, then click the matching region on the board.`;
      case 'bringup':
        if (bringupTickGroups.length === 0) {
          return 'Generate bring-up vectors from Verify, then use these steps to set switches and confirm LEDs against the expected trace.';
        }
        return `Step ${bringupStepIndex + 1} of ${bringupTickGroups.length}${
          currentTick != null ? ` · vector tick ${currentTick}` : ''
        }. Follow the checklist on the left; the board highlights what to set; the inspector shows live values.`;
      case 'proof':
        return 'Confirm compare, export, and assertion evidence before programming. This is the last gate before Vivado Hardware Manager.';
      case 'live':
      default:
        return 'Explore the mapped board interactively. Switches and buttons drive the same I/O path as bring-up, without the guided step list.';
    }
  }, [
    bringupStepIndex,
    bringupTickGroups.length,
    currentTick,
    hasNoBoundaryRows,
    hwMode,
    mappingReady,
    unresolvedRequiredCount,
  ]);

  // ── Dock nodes ──────────────────────────────────────────────────────
  const liveDock = (
    <SurfacePanel className="ide-workbench-placeholder ide-hw-dock-panel ide-hw-dock--live" testId="ide-hw-live-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Live details</h3>
        <IdeStatusPill tone={sim.running ? 'ok' : sim.tick > 0 ? 'warn' : 'idle'}>
          {sim.running ? 'Sim running' : sim.tick > 0 ? 'Sim paused' : 'Not started'}
        </IdeStatusPill>
      </header>
      <div className="ide-kv-list">
        <div className="ide-kv-row">
          <span>Sim tick</span>
          <code>{sim.tick}</code>
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
      <header className="ide-workbench-placeholder-header">
        <h3>Map Pins</h3>
        <IdeStatusPill tone={mappingReady ? 'ok' : 'warn'}>
          {hasNoBoundaryRows ? 'Design first' : mappingReady ? 'Complete' : `${unresolvedRequiredCount} left`}
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
        ) : mappingReady ? (
          <IdeButton tone="primary" onClick={onOpenExport} testId="ide-hardware-map-dock-primary">
            Continue to Export →
          </IdeButton>
        ) : (
          <p className="ide-copy" style={{ margin: 0, fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
            Select a row in the table, then click the matching board region.
          </p>
        )}
      </div>
    </SurfacePanel>
  );

  const bringupDock = (
    <SurfacePanel className="ide-workbench-placeholder ide-hw-dock-panel ide-hw-dock--bringup" testId="ide-hw-bringup-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Test on Board</h3>
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
            Open Export Bundle
          </IdeButton>
        ) : (
          <IdeButton tone="primary" onClick={dominantPrimaryAction} testId="ide-hardware-build-export">
            {failureTruth.primaryCtaLabel}
          </IdeButton>
        )}
      </div>
      {failureTruth.condition === 'ready' && (
        <div className="ide-hw-program-handoff" data-testid="ide-hardware-program-handoff-cta">
          <p className="ide-copy">
            Open the <code>.bit</code> file in{' '}
            <strong>Vivado Hardware Manager</strong> and click{' '}
            <strong>Program Device</strong> to flash the Basys3.
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
      <IdeInspectorSection title="Mapping Status" defaultOpen>
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
      </IdeInspectorSection>
      <IdeInspectorSection title="How mapping works" defaultOpen={false}>
        <p className="ide-copy">
          Start by selecting a signal row, then click the highlighted Basys3 region to bind that row to a board pin.
        </p>
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
    hwMode === 'map' && !mappingReady && !hasNoBoundaryRows
      ? 'Assign the required Basys3 pins in the board workspace first, then continue to board preparation and programming.'
      : nextActionHero.body;
  const hardwareCommandSecondaryAction =
    showBlockedHero ? heroSecondaryAction : nextActionHero.secondaryAction;
  const hardwareCommandSecondaryLabel =
    showBlockedHero ? heroSecondaryLabel : nextActionHero.secondaryLabel;
  const showHardwareCommandActions = hwMode !== 'map' || mappingReady;

  return (
    <IdeSurfaceLayout
      mode="hardware"
      consoleHasBlocking={hasBlocking}
      consoleHasEntries={hasBlocking}
      rightDockMode="collapsed"
      consoleMode="collapsed"
      dock={activeDock}
      inspector={
        <>
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
      console={
        <section className="ide-workbench-console-content" data-testid="ide-hardware-console">
          <header className="ide-workbench-console-header">
            <h3>Hardware Console</h3>
            <span className="ide-workbench-console-mode">Hardware</span>
          </header>
          {/* Dependency chain strip — shows the 3-step prerequisite chain at a glance */}
          <div className="ide-hardware-dep-chain" data-testid="ide-hardware-dep-chain">
            <button
              className={`ide-hardware-dep-step ${compareMatches || compareCurrent ? 'is-ok' : verifyCurrent && !compareMatches ? 'is-warn' : 'is-missing'}`}
              onClick={onOpenVerify}
              title="Open Verify"
            >
              <span className="ide-hardware-dep-step__num">1</span>
              <span className="ide-hardware-dep-step__label">{VERIFY_STAGE_LABEL}</span>
              <span className="ide-hardware-dep-step__status">
                {compareMatches ? '✓' : verifyCurrent ? '⚠' : '—'}
              </span>
            </button>
            <span className="ide-hardware-dep-arrow" aria-hidden="true">→</span>
            <button
              className={`ide-hardware-dep-step ${hardwareState === 'ready' ? 'is-ok' : hardwareState === 'export-stale' ? 'is-warn' : 'is-missing'}`}
              onClick={onOpenExport}
              title="Open Export"
            >
              <span className="ide-hardware-dep-step__num">2</span>
              <span className="ide-hardware-dep-step__label">{EXPORT_STAGE_LABEL}</span>
              <span className="ide-hardware-dep-step__status">
                {hardwareState === 'ready' ? '✓' : hardwareState === 'export-stale' ? '⚠ Re-export needed' : '— Build needed'}
              </span>
            </button>
            <span className="ide-hardware-dep-arrow" aria-hidden="true">→</span>
            <span
              className={`ide-hardware-dep-step ide-hardware-dep-step--terminal ${failureTruth.condition === 'ready' ? 'is-ok' : 'is-locked'}`}
            >
              <span className="ide-hardware-dep-step__num">3</span>
              <span className="ide-hardware-dep-step__label">{PROGRAM_STAGE_LABEL}</span>
              <span className="ide-hardware-dep-step__status">
                {failureTruth.condition === 'ready' ? '✓ Ready' : 'Locked'}
              </span>
            </span>
          </div>
          <IdeCallout
            tone={readinessCalloutTone}
            title={failureTruth.title}
            testId="ide-hardware-readiness-callout"
          >
            {failureTruth.message}
          </IdeCallout>
        </section>
      }
    >
      <IdePanel
        title="Hardware"
        description="Map pins, prepare the board, and program the Basys3."
        right={
          <IdeStatusPill tone={failureTruth.severity === 'ready' ? 'ok' : failureTruth.severity === 'blocked' ? 'error' : 'warn'}>
            {failureTruth.statusLabel}
          </IdeStatusPill>
        }
        testId="ide-hardware-panel"
      >
        <div className="ide-surface-command-stack">
          <SurfaceCommandStrip
            className="ide-hardware-command-strip"
            testId="ide-hardware-command-strip"
            label="Hardware"
            title={
              hwMode === 'map' && !mappingReady && !hasNoBoundaryRows
                ? 'Continue mapping before you prepare or program the board'
                : nextActionHero.title
            }
            description={hardwareCommandDescription}
            meta={(
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
            )}
            actions={
              showHardwareCommandActions ? (
                <>
                  <span data-testid="ide-primary-cta">
                    <IdeButton
                      tone="primary"
                      onClick={showBlockedHero ? dominantPrimaryAction : nextActionHero.primaryAction}
                      testId={showBlockedHero ? 'ide-hardware-blocked-primary' : nextActionHero.primaryTestId}
                    >
                      {showBlockedHero ? failureTruth.primaryCtaLabel : nextActionHero.primaryLabel}
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
        </div>
        {/* ── Connection callout strip ── */}
        {false && <div className="ide-hw-callout" data-testid="ide-hw-callout">
          <span className="ide-hw-callout-label">Project:</span>
          <span className="ide-hw-callout-name">{projectName}</span>
          <span className="ide-hw-callout-sep" aria-hidden="true">·</span>
          <span>{mappingRows.length} mapped rows</span>
          {verifyStatus !== undefined && (
            <>
              <span className="ide-hw-callout-sep" aria-hidden="true">·</span>
              <span className={compareMatches ? 'ide-hw-callout-pass' : compareDiffers ? 'ide-hw-callout-fail' : ''}>
                Compare: {verifyStatus}
              </span>
              <span className="ide-hw-callout-sep" aria-hidden="true">|</span>
              <span data-testid="ide-hardware-export-status">
                Export: {exportStatus}
              </span>
            </>
          )}
        </div>}

        {/* ── Stage rail: workflow caption + primary stage tabs ── */}
        <div className="ide-hw-stage-rail" data-testid="ide-hw-stage-rail">
          <div className="ide-hw-stage-rail-top">
            <div className="ide-hw-stage-rail-intro">
              <span className="ide-hw-stage-kicker">Basys3 bring-up</span>
              <p className="ide-hw-stage-caption" data-testid="ide-hw-stage-caption">
                {hardwareStageCaption}
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
              <span className="ide-hw-mode-segment-title">Map Pins</span>
              <span className="ide-hw-mode-segment-hint">Assign I/O to pins</span>
              <span className="ide-hw-mode-segment-status" aria-hidden="true">
                {mappingReady ? '✓' : unresolvedRequiredCount > 0 ? '○' : '·'}
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
              <span className="ide-hw-mode-segment-title">Test on Board</span>
              <span className="ide-hw-mode-segment-hint">Guided vectors</span>
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
              <span className="ide-hw-mode-segment-hint">Evidence gate</span>
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
              <span className="ide-hw-mode-segment-hint">Free play</span>
              <span className="ide-hw-mode-segment-status" aria-hidden="true">
                ·
              </span>
            </button>
          </div>
        </div>

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
        {scenarioDrifted && verifyLastRun && (
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
        {compareCurrent && !scenarioDrifted && vectorsAreAutoGenerated && (
          <IdeCallout tone="warn" testId="ide-hardware-starter-seal-note">
            <p className="ide-copy" style={{ margin: 0 }}>
              <strong>Ready — starter scenario only.</strong>{' '}
              The board is backed by a starter scenario only. Author a real test scenario and rerun Compare before relying on this result for lab work.
            </p>
          </IdeCallout>
        )}

        {/* ── SSD guidance callout ── */}
        {hasSsdMapping && (
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
        {hasButtonMapping && !debounceDismissed && (
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

        {/* ── Board / Map — framed workspace ── */}
        {hwMode === 'map' ? (
          <div
            className="ide-hw-board-workspace ide-hw-board-workspace--map"
            data-testid="ide-hw-board-workspace"
          >
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
            <div className="ide-hw-board-canvas ide-hw-board-canvas--split">
          <div className="ide-hw-map-mode" data-testid="ide-hw-map-mode">
            <div className="ide-hw-map-table" data-testid="ide-hw-map-table">
              {exportViewStatus === 'blocked' && exportBlockingDiagnostics.length > 0 ? (
                <IdeCallout
                  tone="warn"
                  title="Export is blocked — repair mapping or top-level ports"
                  testId="ide-hw-export-repair-callout"
                >
                  <p id={guidedHelpExportRepairId} className="ide-copy ide-copy--flush">
                    The same Basys3 validation used in Export is failing for the current project.
                    {designTopEntityName ? (
                      <>
                        {' '}
                        Top entity: <code>{designTopEntityName}</code>.
                      </>
                    ) : null}{' '}
                    Use the details below to fix the mismatch in <strong>Map Pins</strong> (structured entries and pins)
                    or adjust boundary I/O in <strong>Design</strong> so top-level ports line up.
                  </p>
                  <ul className="ide-hw-export-repair-list">
                    {exportBlockingDiagnostics.map((diagnostic) => (
                      <li key={diagnostic.id}>
                        <strong>{diagnostic.title}</strong>
                        <div className="ide-copy ide-copy--flush">{diagnostic.message}</div>
                        {diagnostic.port ? (
                          <div className="ide-copy ide-copy--flush">
                            Port or signal referenced: <code>{diagnostic.port}</code>
                          </div>
                        ) : null}
                        {diagnostic.fix ? (
                          <div className="ide-copy ide-copy--flush">Suggested fix: {diagnostic.fix}</div>
                        ) : null}
                        {diagnostic.hint.length > 0 ? (
                          <ul>
                            {diagnostic.hint.map((hintLine) => (
                              <li key={hintLine}>{hintLine}</li>
                            ))}
                          </ul>
                        ) : null}
                        {diagnostic.actions.length > 0 && onRepairExportDiagnostic ? (
                          <div className="ide-inline-actions">
                            {diagnostic.actions.map((action) => (
                              <IdeButton
                                key={`${diagnostic.id}-${action.label}`}
                                tone="secondary"
                                onClick={() => onRepairExportDiagnostic(diagnostic)}
                              >
                                {action.label}
                              </IdeButton>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="ide-inline-actions">
                    <IdeButton tone="ghost" onClick={() => onOpenExport()} testId="ide-hw-export-repair-open-export">
                      Open Export
                    </IdeButton>
                    {onGoToDesign ? (
                      <IdeButton tone="ghost" onClick={() => onGoToDesign()} testId="ide-hw-export-repair-open-design">
                        Open Design
                      </IdeButton>
                    ) : null}
                  </div>
                </IdeCallout>
              ) : null}
              {hardwareMappingV2 && onApplyHardwareMappingEdit ? (
                <div className="ide-hw-structured-editor" data-testid="ide-hw-structured-editor">
                  <h4 className="ide-hw-structured-editor-title">Structured Map Pins (hardwareMappingV2)</h4>
                  <p className="ide-copy ide-hw-map-instructions">
                    <strong>Logical signals</strong> come from your circuit boundary; <strong>top port names</strong> must
                    match the generated VHDL entity. V2 is the canonical source for save, reload, and export.
                  </p>
                  {structuredEntries.length === 0 ? (
                    <p className="ide-copy ide-hw-structured-empty" data-testid="ide-hw-structured-empty">
                      No structured entries yet. Use <strong>Add mapping</strong> below: pick a boundary signal, optionally
                      align a top-level VHDL port, choose a mapping kind, then assign board pins.
                    </p>
                  ) : null}
                  <div
                    className="ide-hw-structured-entry-list"
                    role="region"
                    aria-label="Structured hardware mapping entries"
                  >
                    {structuredEntries.map((entry) => (
                      <div className="ide-hw-structured-entry-row" key={entry.id} data-testid={`ide-hw-structured-entry-${entry.id}`}>
                        <div className="ide-hw-structured-entry-main">
                          <strong>{entry.id}</strong>
                          <span className="ide-hw-map-chip ide-hw-map-chip--kind">{formatMappingKindChip(entry.kind)}</span>
                          <span className={`ide-hw-map-chip ide-hw-map-chip--complete ide-hw-map-chip--complete-${entry.completeness}`}>
                            {formatCompletenessChip(entry.completeness)}
                          </span>
                          <span className="ide-hw-map-chip">{entry.mappedBits}/{entry.totalBits || 1} pins</span>
                        </div>
                        <div className="ide-hw-structured-entry-actions">
                          <input
                            value={structuredPinDrafts[entry.id] ?? ''}
                            onChange={(event) =>
                              setStructuredPinDrafts((previous) => ({
                                ...previous,
                                [entry.id]: event.target.value,
                              }))
                            }
                            placeholder="Board pins (comma separated)"
                            aria-label={`Board pins for mapping ${entry.id}`}
                            data-testid={`ide-hw-structured-pins-${entry.id}`}
                          />
                          <IdeButton tone="secondary" onClick={() => applyEntryPins(entry.id)}>
                            Apply pins
                          </IdeButton>
                          {(entry.kind === 'bus' || entry.kind === 'slice') && (
                            <>
                              <IdeButton tone="ghost" onClick={() => applySequentialPinsForEntry(entry.id, 'SW', 0, entry.totalBits || 1)}>
                                SW bank
                              </IdeButton>
                              <IdeButton tone="ghost" onClick={() => applySequentialPinsForEntry(entry.id, 'LD', 0, entry.totalBits || 1)}>
                                LED bank
                              </IdeButton>
                            </>
                          )}
                          <IdeButton
                            tone="ghost"
                            onClick={() =>
                              applyStructuredEdit({
                                type: 'clear_entry_pins',
                                entryId: entry.id,
                              })
                            }
                          >
                            Clear
                          </IdeButton>
                          <IdeButton
                            tone="ghost"
                            onClick={() => setEntryMetadataSelection(entry.id)}
                          >
                            Edit role
                          </IdeButton>
                          <IdeButton
                            tone="danger"
                            onClick={() =>
                              applyStructuredEdit({
                                type: 'remove_entry',
                                entryId: entry.id,
                              })
                            }
                          >
                            Remove
                          </IdeButton>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedStructuredEntry && (
                    <div className="ide-hw-structured-meta-editor" data-testid="ide-hw-structured-meta-editor">
                      <h5 id={`ide-hw-meta-heading-${selectedStructuredEntry.id}`}>
                        {selectedStructuredEntry.id} timing and board role
                      </h5>
                      <div className="ide-hw-structured-meta-row">
                        <label htmlFor={`ide-hw-meta-timing-${selectedStructuredEntry.id}`}>
                          Timing role
                          <select
                            id={`ide-hw-meta-timing-${selectedStructuredEntry.id}`}
                            defaultValue={selectedStructuredEntry.timingRole ?? 'generic'}
                            aria-labelledby={`ide-hw-meta-heading-${selectedStructuredEntry.id}`}
                            onChange={(event) =>
                              applyStructuredEdit({
                                type: 'set_entry_meta',
                                entryId: selectedStructuredEntry.id,
                                label: selectedStructuredEntry.label,
                                alias: selectedStructuredEntry.alias,
                                timingRole: event.target.value as HardwareTimingRole,
                                boardResourceType: selectedStructuredEntry.boardResourceType,
                              })
                            }
                          >
                            <option value="generic">generic</option>
                            <option value="clock">clock</option>
                            <option value="reset">reset</option>
                            <option value="manual_step">manual_step</option>
                            <option value="enable">enable</option>
                          </select>
                        </label>
                        <label htmlFor={`ide-hw-meta-resource-${selectedStructuredEntry.id}`}>
                          Board resource type
                          <select
                            id={`ide-hw-meta-resource-${selectedStructuredEntry.id}`}
                            defaultValue={selectedStructuredEntry.boardResourceType ?? 'generic'}
                            aria-labelledby={`ide-hw-meta-heading-${selectedStructuredEntry.id}`}
                            onChange={(event) =>
                              applyStructuredEdit({
                                type: 'set_entry_meta',
                                entryId: selectedStructuredEntry.id,
                                label: selectedStructuredEntry.label,
                                alias: selectedStructuredEntry.alias,
                                timingRole: selectedStructuredEntry.timingRole,
                                boardResourceType: event.target.value as HardwareBoardResourceType,
                              })
                            }
                          >
                            <option value="generic">generic</option>
                            <option value="switch">switch</option>
                            <option value="button">button</option>
                            <option value="led">led</option>
                            <option value="clock_pin">clock_pin</option>
                            <option value="seven_seg">seven_seg</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                  <details open className="ide-hw-structured-add-details">
                    <summary>Add structured mapping</summary>
                    <p className="ide-copy ide-copy--flush">
                      Start from a <strong>boundary signal</strong> (circuit I/O). Optionally pick a{' '}
                      <strong>top-level VHDL port</strong> so the mapping&rsquo;s port name matches export.
                    </p>
                    <div className="ide-hw-structured-create-grid" data-testid="ide-hw-structured-create-grid">
                      <label htmlFor={guidedBoundarySelectId}>
                        Boundary signal (circuit)
                        <select
                          id={guidedBoundarySelectId}
                          value={guidedBoundaryRowId}
                          onChange={(event) => setGuidedBoundaryRowId(event.target.value)}
                          aria-describedby="ide-hw-guided-boundary-help"
                        >
                          <option value="">Select a mapped row…</option>
                          {guidedBoundaryOptions.map((opt) => (
                            <option key={opt.rowId} value={opt.rowId}>
                              {opt.label} ({opt.direction === 'in' ? 'input' : 'output'})
                            </option>
                          ))}
                        </select>
                      </label>
                      <span id="ide-hw-guided-boundary-help" className="ide-copy ide-copy--flush ide-hw-field-hint">
                        Uses the same rows as the pin map. Raw node id and logic port stay hidden unless you open Advanced.
                      </span>

                      <label htmlFor={guidedHdlSelectId}>
                        Top-level VHDL port (optional)
                        <select
                          id={guidedHdlSelectId}
                          value={guidedHdlKey}
                          onChange={(event) => setGuidedHdlKey(event.target.value)}
                          aria-describedby="ide-hw-guided-hdl-help"
                          disabled={guidedHdlCatalog.length === 0}
                        >
                          <option value="">
                            {guidedHdlCatalog.length === 0
                              ? 'No VHDL text on project — export preview will still validate'
                              : 'Match export port name…'}
                          </option>
                          {guidedHdlCatalog.map((entry) => (
                            <option key={entry.key} value={entry.key}>
                              {entry.displayLabel}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span id="ide-hw-guided-hdl-help" className="ide-copy ide-copy--flush ide-hw-field-hint">
                        Parsed from the first VHDL source in the project. Choosing a bus preset fills width and port name.
                      </span>

                      <label htmlFor={guidedKindSelectId}>
                        Mapping kind
                        <select
                          id={guidedKindSelectId}
                          value={newEntryKind}
                          onChange={(event) => setNewEntryKind(event.target.value as HardwareMappingEntryV2['kind'])}
                          aria-label="Structured mapping entry kind"
                        >
                          <option value="scalar">Scalar — one bit, one boundary node</option>
                          <option value="bit">Bit — single bit of a vector port</option>
                          <option value="slice">Slice — contiguous bits</option>
                          <option value="bus">Bus — multiple boundary bits (ordered)</option>
                          <option value="group">Group — bundle existing entries</option>
                        </select>
                      </label>

                      <label htmlFor={guidedEntryIdInputId}>
                        Entry id
                        <input
                          id={guidedEntryIdInputId}
                          value={newEntryId}
                          onChange={(event) => setNewEntryId(event.target.value)}
                          aria-describedby="ide-hw-guided-entryid-help"
                          autoComplete="off"
                        />
                      </label>
                      <span id="ide-hw-guided-entryid-help" className="ide-copy ide-copy--flush ide-hw-field-hint">
                        Stable id in hardwareMappingV2 — usually the same as the top-level port or row id.
                      </span>

                      <label htmlFor="ide-hw-guided-direction">
                        Direction
                        <select
                          id="ide-hw-guided-direction"
                          value={newEntryDirection}
                          onChange={(event) => setNewEntryDirection(event.target.value as 'in' | 'out')}
                        >
                          <option value="in">Input to the chip (board → FPGA)</option>
                          <option value="out">Output from the chip (FPGA → board)</option>
                        </select>
                      </label>

                      <label htmlFor={guidedPortNameInputId}>
                        Top port name (HDL / export)
                        <input
                          id={guidedPortNameInputId}
                          value={newEntryPortName}
                          onChange={(event) => setNewEntryPortName(event.target.value)}
                          aria-describedby="ide-hw-guided-portname-help"
                          autoComplete="off"
                        />
                      </label>
                      <span id="ide-hw-guided-portname-help" className="ide-copy ide-copy--flush ide-hw-field-hint">
                        Must match the entity port used in generated <code>top.vhd</code>.
                      </span>

                      <label htmlFor="ide-hw-guided-label">
                        Display label (optional)
                        <input
                          id="ide-hw-guided-label"
                          value={newEntryLabel}
                          onChange={(event) => setNewEntryLabel(event.target.value)}
                        />
                      </label>

                      <label htmlFor="ide-hw-guided-alias">
                        Constraint alias (optional)
                        <input
                          id="ide-hw-guided-alias"
                          value={newEntryAlias}
                          onChange={(event) => setNewEntryAlias(event.target.value)}
                        />
                      </label>

                      {newEntryKind === 'bus' && (
                        <div className="ide-hw-guided-bus-members" data-testid="ide-hw-guided-bus-members">
                          <span className="ide-hw-guided-bus-heading" id="ide-hw-guided-bus-legend">
                            Bus members (LSB first — bit 0 at the top)
                          </span>
                          <p className="ide-copy ide-copy--flush">
                            Add one boundary row per bit. Order is export bit order: first row is bit 0.
                          </p>
                          <ol aria-labelledby="ide-hw-guided-bus-legend">
                            {guidedBusMemberRowIds.map((rowId, index) => {
                              const opt = guidedBoundaryOptions.find((o) => o.rowId === rowId);
                              return (
                                <li key={`${rowId}-${index}`}>
                                  <span>{opt ? `${opt.label} (${rowId})` : rowId}</span>
                                  <span className="ide-inline-actions">
                                    <IdeButton
                                      tone="ghost"
                                      onClick={() => moveGuidedBusMember(index, -1)}
                                      testId={`ide-hw-bus-up-${index}`}
                                    >
                                      Up
                                    </IdeButton>
                                    <IdeButton
                                      tone="ghost"
                                      onClick={() => moveGuidedBusMember(index, 1)}
                                      testId={`ide-hw-bus-down-${index}`}
                                    >
                                      Down
                                    </IdeButton>
                                    <IdeButton
                                      tone="ghost"
                                      onClick={() =>
                                        setGuidedBusMemberRowIds((previous) => previous.filter((_, i) => i !== index))
                                      }
                                      testId={`ide-hw-bus-remove-${index}`}
                                    >
                                      Remove
                                    </IdeButton>
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                          <div className="ide-hw-guided-bus-add-grid">
                            {guidedBoundaryOptions
                              .filter((opt) => opt.direction === newEntryDirection)
                              .map((opt) => (
                                <IdeButton
                                  key={opt.rowId}
                                  tone="ghost"
                                  onClick={() =>
                                    setGuidedBusMemberRowIds((previous) =>
                                      previous.includes(opt.rowId) ? previous : [...previous, opt.rowId],
                                    )
                                  }
                                  testId={`ide-hw-bus-add-${opt.rowId}`}
                                >
                                  Add {opt.label}
                                </IdeButton>
                              ))}
                          </div>
                          <IdeButton
                            tone="ghost"
                            onClick={() => setGuidedBusMemberRowIds([])}
                            testId="ide-hw-bus-clear"
                          >
                            Clear bus order
                          </IdeButton>
                          <label htmlFor="ide-hw-guided-bus-width">
                            Width (when not using member list)
                            <input
                              id="ide-hw-guided-bus-width"
                              value={newEntryWidth}
                              onChange={(event) => setNewEntryWidth(event.target.value)}
                              aria-label="Bus width when synthesizing bits from a single node"
                            />
                          </label>
                        </div>
                      )}

                      {newEntryKind === 'slice' && (
                        <>
                          <label htmlFor="ide-hw-guided-msb">
                            MSB index
                            <input
                              id="ide-hw-guided-msb"
                              value={newEntryMsb}
                              onChange={(event) => setNewEntryMsb(event.target.value)}
                            />
                          </label>
                          <label htmlFor="ide-hw-guided-lsb-slice">
                            LSB index
                            <input
                              id="ide-hw-guided-lsb-slice"
                              value={newEntryLsb}
                              onChange={(event) => setNewEntryLsb(event.target.value)}
                            />
                          </label>
                        </>
                      )}
                      {newEntryKind === 'bit' && (
                        <label htmlFor="ide-hw-guided-bit-index">
                          Bit index
                          <input
                            id="ide-hw-guided-bit-index"
                            value={newEntryLsb}
                            onChange={(event) => setNewEntryLsb(event.target.value)}
                          />
                        </label>
                      )}

                      <label htmlFor="ide-hw-guided-pins">
                        Board pins (comma separated)
                        <input
                          id="ide-hw-guided-pins"
                          value={newEntryPinsCsv}
                          onChange={(event) => setNewEntryPinsCsv(event.target.value)}
                          aria-describedby="ide-hw-guided-pins-help"
                        />
                      </label>
                      <span id="ide-hw-guided-pins-help" className="ide-copy ide-copy--flush ide-hw-field-hint">
                        Physical Basys3 pin names (SW0, LD0, V17, …). Leave blank to assign later on the board.
                      </span>

                      {newEntryKind === 'group' && (
                        <>
                          <label htmlFor="ide-hw-guided-group-role">
                            Group role
                            <select
                              id="ide-hw-guided-group-role"
                              value={newGroupRole}
                              onChange={(event) =>
                                setNewGroupRole(event.target.value as 'switch_bank' | 'led_bank' | 'button_row' | 'custom')
                              }
                            >
                              <option value="custom">custom</option>
                              <option value="switch_bank">switch_bank</option>
                              <option value="led_bank">led_bank</option>
                              <option value="button_row">button_row</option>
                            </select>
                          </label>
                          <label htmlFor="ide-hw-guided-group-members">
                            Member entry ids (comma separated)
                            <input
                              id="ide-hw-guided-group-members"
                              value={newGroupMembersCsv}
                              onChange={(event) => setNewGroupMembersCsv(event.target.value)}
                              aria-describedby="ide-hw-guided-group-help"
                            />
                          </label>
                          <span id="ide-hw-guided-group-help" className="ide-copy ide-copy--flush ide-hw-field-hint">
                            Each id must reference an existing structured entry id.
                          </span>
                        </>
                      )}

                      <label className="ide-hw-checkbox-row">
                        <input
                          type="checkbox"
                          checked={guidedShowAdvanced}
                          onChange={(event) => setGuidedShowAdvanced(event.target.checked)}
                        />
                        Advanced — edit raw node id and logic port
                      </label>

                      {guidedShowAdvanced ? (
                        <>
                          <label htmlFor="ide-hw-guided-nodeid">
                            Node id
                            <input
                              id="ide-hw-guided-nodeid"
                              value={newEntryNodeId}
                              onChange={(event) => setNewEntryNodeId(event.target.value)}
                            />
                          </label>
                          <label htmlFor="ide-hw-guided-logic-port">
                            Logic port on node
                            <input
                              id="ide-hw-guided-logic-port"
                              value={newEntryPort}
                              onChange={(event) => setNewEntryPort(event.target.value)}
                            />
                          </label>
                        </>
                      ) : null}
                    </div>
                    <div className="ide-inline-actions">
                      <IdeButton tone="secondary" onClick={createStructuredEntry} testId="ide-hw-structured-create-btn">
                        Save structured entry
                      </IdeButton>
                    </div>
                  </details>
                </div>
              ) : null}
              <p className="ide-copy ide-hw-map-instructions">
                {hasNoBoundaryRows
                  ? 'Add inputs and outputs in Design, then return here to map Basys3 pins.'
                  : selectedMappingRowId
                  ? 'Click a board region to assign the pin.'
                  : 'Click a signal row, then click a board region to assign its pin.'}
              </p>
              {mapModeGroups.length === 0 ? (
                <IdeCallout tone="info" title="Nothing to map yet" testId="ide-hw-map-empty">
                  <p className="ide-copy ide-copy--flush">
                    Add inputs and outputs in Design, then return here to assign board pins.
                  </p>
                </IdeCallout>
              ) : mapModeGroups.map((group) => (
                <details key={group.label} open>
                  <summary className="ide-hw-map-group-label">{group.label}</summary>
                  <div className="ide-hw-map-group">
                    {group.rows.map((row) => {
                      const isMissing = row.required && row.pin.trim().length === 0;
                      const completeness = deriveMappingCompleteness(row);
                      const resourceChip = formatBoardResourceChip(row.boardResourceType);
                      const timingChip = formatTimingRoleChip(row.timingRole);
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className={`ide-hw-map-row ${selectedMappingRowId === row.id ? 'is-selected' : ''} ${isMissing ? 'is-required-missing' : ''} ${!row.required ? 'is-optional' : ''}`}
                          data-testid={`ide-hw-map-row-${row.id}`}
                          data-required={row.required ? 'true' : 'false'}
                          onClick={() =>
                            setSelectedMappingRowId(row.id === selectedMappingRowId ? null : row.id)
                          }
                        >
                          <span className="ide-hw-map-row-left">
                            <span className="ide-hw-map-row-label">{getStudentFacingIoLabel(row)}</span>
                            <div
                              className="ide-hw-map-row-v2-chips"
                              data-testid={`ide-hw-map-row-v2-${row.id}`}
                            >
                              <span
                                className="ide-hw-map-chip ide-hw-map-chip--kind"
                                title="hardwareMappingV2 entry kind"
                              >
                                {formatMappingKindChip(row.mappingKind)}
                              </span>
                              <span
                                className={`ide-hw-map-chip ide-hw-map-chip--complete ide-hw-map-chip--complete-${completeness}`}
                                title="Pin mapping completeness"
                              >
                                {formatCompletenessChip(completeness)}
                              </span>
                              {resourceChip ? (
                                <span className="ide-hw-map-chip ide-hw-map-chip--resource" title="Board resource">
                                  {resourceChip}
                                </span>
                              ) : null}
                              {timingChip ? (
                                <span className="ide-hw-map-chip ide-hw-map-chip--timing" title="Timing role">
                                  {timingChip}
                                </span>
                              ) : null}
                            </div>
                          </span>
                          <span className="ide-hw-map-row-meta">
                            {row.required ? (
                              isMissing
                                ? <span className="ide-hw-map-row-badge ide-hw-map-row-badge--missing">required</span>
                                : <span className="ide-hw-map-row-badge ide-hw-map-row-badge--ok">✓</span>
                            ) : (
                              <span className="ide-hw-map-row-badge ide-hw-map-row-badge--optional">optional</span>
                            )}
                            <code className="ide-hw-map-row-pin">{row.pin || '—'}</code>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
            <div className="ide-hw-map-board" data-testid="ide-hw-map-board">
              <Basys3BoardView
                mappedAliases={mapModeAliases}
                highlightedAlias={selectedMappingRowPin}
                onSelectAlias={(alias) => {
                  if (selectedMappingRowId && onSetMappingPin) {
                    onSetMappingPin(selectedMappingRowId, alias);
                    setSelectedMappingRowId(null);
                  }
                }}
              />
            </div>
          </div>
            </div>
          </div>
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
              sw={ioBus.state.sw}
              ld={ioBus.state.ld}
              btn={ioBus.state.btn}
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
      </IdePanel>
    </IdeSurfaceLayout>
  );
};
