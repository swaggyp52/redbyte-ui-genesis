import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TestVector } from '@redbyte/rb-utils';
import { getRuntimeVerifyRunKind, type RunVerificationInput, type RuntimeVerifyRun } from '../projectRuntime';
import { buildVerifyTickSignalIndex, normalizeSignalKey, type VerifyTickSignalIndexEntry } from '../verifyReport';
import { adaptVerifyPreflightIssue } from '../diagnostics';
import type { IdeExampleDefinition } from '../examplesCatalog';
import {
  deriveVerifyFailurePattern,
  getVerifyHint,
  type VerifyHintContext,
} from '../verifyHints';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import type { CustomTestVector } from '../components/VectorEditor';
import { resolveBoardSignal, useBoardSignal } from '../BoardSignalContext';
import type { VerifyDebugContext } from '../verifyDebug';
import {
  VerifyFailureExplanationPanel,
  type VerifyFailureExplanationCase,
} from './VerifyFailureExplanationPanel';
import {
  VerifyVectorListPanel,
} from './VerifyVectorListPanel';
import { VerifyThreePanel } from './VerifyThreePanel';
import { classifyVerifyFailure } from './verify-failure-classifier';
import { TruthTablePane } from './TruthTablePane';
import { buildVerifyStudentViewModel } from '../viewmodels/buildVerifyStudentViewModel';
import {
  buildVerifySessionViewModel,
  type VerifyPreRunInventory,
  type VerifySignalLane,
} from '../viewmodels/buildVerifySessionViewModel';
import {
  ScenarioBuilderPanel,
  type VerifyVectorDraftInput,
  type VerifyAuthorVector,
  type VerifyExpectedDraftValue,
  type SweepPreset,
} from './ScenarioBuilderPanel';
import { AssertionCanvas, type AssertionCanvasProps } from '../components/AssertionCanvas';
import type { StimulusClockPattern } from '../components/StimulusCanvas';
import { ScenarioLibraryHeader } from './ScenarioLibraryHeader';
import {
  computeScenarioContentHash,
  computeScenarioStimulusHash,
  computeVectorStimulusHash,
  type VerifyScenario,
} from '../verifyScenario';
import type { VerifyMode } from '../verifyMode';
import type {
  FullAdderLabDesignChecklist,
  GuidedLabTaskDefinition,
} from '../labTaskDefinition';
import type { ProjectKind, ScenarioAuthority } from '../projectIdentity';
import {
  createClockTimingGuidance,
  deriveTimingGuidance,
  deriveTimingGuidanceFromRun,
  formatTimingBadge,
  formatTimingProtocol as formatTimingProtocolLabel,
  formatTimingTickZero,
  formatTimingTooltip,
  type TimingGuidance,
} from '../timingGuidance';
import {
  INTERNAL_SIM_CLOCK_NAME,
  type VerifyScheduleContract,
} from '../../../fpga/boards/basys3/verifySchedule';
import { resolveBasys3SignalBinding } from '../../../fpga/boards/basys3/basys3SignalSemantics';
import {
  resolveActiveScheduleContract,
} from '../clockAuthority';
import {
  detectVerifyClockPolicy,
  type VerifyClockOverrideMode,
  type VerifyClockPolicy,
} from '../verifyClockPolicy';
import type {
  TruthTableComboRow,
  TruthTableKMap,
  TruthTableMode,
  TruthTableRow,
  TruthTableTraceInput,
} from './TruthTablePane';
import {
  VerifyHeaderRegion,
  VerifyResultRegion,
  VerifyStimulusRegion,
  VerifyWaveformRegion,
  VerifyWorkspaceRegion,
} from './verify/VerifyRegionLayout';
import {
  VerifyPrimaryStatusArea,
  type VerifyPrimaryStatusAreaProps,
} from './verify/VerifyPrimaryStatusArea';
import {
  VerifyContextHeader,
  VerifyResultsSummary,
  type VerifyResultsKind,
  type VerifyResultsMetric,
  type VerifyStateTone,
} from './verify/VerifySurfacePrimitives';
import { WaveformViewer, type WaveformSignalRow, type SignalLaneGroup } from './verify/WaveformInstrument';
import { explainSignal, type ExplainerCircuitGraph, type ExplainerSignalMapping } from './verify/signalExplainer';
import { WhyInspectorPanel } from './verify/WhyInspectorPanel';
import { VerifyCommandBar } from './verify/VerifyCommandBar';
import { VerifyWaveformPlaceholder } from './verify/VerifyWaveformPlaceholder';
import { TickReadoutStrip } from './verify/TickReadoutStrip';
import { VerifyLabSequencerPanel } from './verify/VerifyLabSequencerPanel';
import {
  buildLabSequencerSteps,
  buildLabSequencerStepsFromScenarioSteps,
  summarizeStateObservation,
} from '../verifyLabSequencer';
import type { VerifyScenarioStepKind } from '../verifyScenarioSteps';
import type { ScenarioStepDraft } from '../verifyScenarioSteps';
import type { VerifyScenarioStep } from '../verifyScenarioSteps';
import { deriveScenarioStepsFromVectors } from '../verifyScenarioSteps';
import type { IdeChromeContract } from '../chromeContract';
import { diagnoseVerifyFailure } from '../verifyFailureDiagnosis';

export const CHROME_CONTRACT = {
  surfaceId: 'verify',
  topStripSlots: ['command-bar', 'status-row'],
  leftDockPolicy: 'collapsed-default',
  rightDockPolicy: 'hidden',
  exitPaths: [],
} satisfies IdeChromeContract;

interface VerifyRow {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  vectorId?: string;
  caseIndex?: number;
}


export interface VerifyFailureTarget {
  signal: string;
  tick: number;
  expected: string;
  actual: string;
  vectorId?: string;
  caseIndex?: number;
}

function buildFailureCaseKey(
  tick: number,
  signal: string,
  vectorId?: string,
  caseIndex?: number
): string {
  return [
    tick,
    normalizeFieldId(signal),
    signal,
    vectorId?.trim() || 'no-vector',
    Number.isFinite(caseIndex) ? String(caseIndex) : 'no-case',
  ].join(':');
}

function isRepairableObservedFailure(failure: VerifyFailureExplanationCase): boolean {
  return failure.actual === '0' || failure.actual === '1';
}

interface VerifyMappedSignal {
  id: string;
  label?: string;
  pin?: string;
  nodeId?: string;
  direction: 'in' | 'out';
}

type VerifyStatus = 'idle' | 'pass' | 'fail';

interface VerifyMappedInput {
  id: string;
  label?: string;
  pin?: string;
  nodeId?: string;
}

export interface VerifySurfaceProps {
  deterministicHash: string;
  /** Current project display name — fed into the Verify context header. */
  projectName?: string;
  /** Board target (e.g. "Basys3") — fed into the Verify context header. */
  board?: string;
  hasVectors: boolean;
  vectors?: TestVector[];
  lastRun?: RuntimeVerifyRun;
  mappingComplete?: boolean;
  hasFloatingOutputWarning?: boolean;
  probeSignals?: Array<{ key: string; label?: string }>;
  mappedInputs?: VerifyMappedInput[];
  mappedSignals?: VerifyMappedSignal[];
  onVectorsChange?: (vectors: VerifyAuthorVector[]) => void;
  onGenerateBasicVectors?: () => void;
  onRunVerification?: (input: RunVerificationInput) => void;
  onClearVerification?: () => void;
  onOpenProjectVectors: () => void;
  onFixPath?: (target: VerifyFailureTarget) => void;
  example?: IdeExampleDefinition | null;
  onGoToDesign?: () => void;
  /** Navigate to Design and inject these input values into the runtime sim for propagation inspection. */
  onGoToDesignWithInputs?: (inputs: Record<string, 0 | 1>) => void;
  onGoToHardware?: () => void;
  onGoToImport?: () => void;
  verifyMode?: VerifyMode;
  unmappedOutputLabels?: string[];
  onPreviewVector?: (inputs: Record<string, number>) => void;
  onDebugTickSelected?: (
    tick: number,
    signals: Record<string, 0 | 1>,
    context?: VerifyDebugContext | null
  ) => void;
  onDeleteVector?: (vectorId: string) => void;
  vectorsAreAutoGenerated?: boolean;
  onGoToExport?: () => void;
  onSignalSelected?: (signalKey: string | null) => void;
  selectedTickOverride?: number | null;
  onSelectedTickChange?: (tick: number | null) => void;
  customVectors?: CustomTestVector[];
  onCustomVectorsChange?: (vectors: CustomTestVector[]) => void;
  // ─── Scenario library props ───────────────────────────────────────────────
  /** All scenarios in the library. When present, the scenario strip is rendered. */
  scenarios?: VerifyScenario[];
  /** ID of the currently active scenario. */
  activeScenarioId?: string | null;
  /** The resolved active scenario — used for stale detection. */
  activeScenario?: VerifyScenario | null;
  onCreateScenario?: () => void;
  onDuplicateScenario?: () => void;
  onRenameScenario?: (name: string) => void;
  onDeleteScenario?: (id: string) => void;
  onSwitchScenario?: (id: string) => void;
  onAppendScenarioStep?: (draft: ScenarioStepDraft) => void;
  onUpdateScenarioStep?: (
    stepId: string,
    patch: Partial<Omit<VerifyScenarioStep, 'id' | 'order' | 'origin'>>
  ) => void;
  onMoveScenarioStep?: (stepId: string, direction: 'up' | 'down') => void;
  onDeleteScenarioStep?: (stepId: string) => void;
  /** Live semantic signal roles from IO rows + schedule. Populates clockSignals before any verify run. Run roles override on conflict. */
  liveSignalRoles?: Record<string, 'clock' | 'reset' | 'input' | 'output'>;
  liveScheduleContract?: VerifyScheduleContract;
  timingGuidance?: TimingGuidance;
  projectKind?: ProjectKind;
  sourceExampleId?: string | null;
  scenarioAuthority?: ScenarioAuthority;
  guidedLabTask?: GuidedLabTaskDefinition | null;
  guidedLabDesignChecklist?: FullAdderLabDesignChecklist | null;
  onCreateGuidedLabTruthTable?: () => void;
  unsupportedFeedbackDiagnostic?: {
    title: string;
    message: string;
  } | null;
  /** Circuit graph for causal explanation (Why tab). Accepts raw Circuit shape. */
  circuitGraph?: {
    readonly nodes: ReadonlyArray<{ readonly id: string; readonly type: string; readonly label?: string; readonly config?: Record<string, unknown> }>;
    readonly connections: ReadonlyArray<{
      readonly from: string | { readonly nodeId: string; readonly portName?: string; readonly port?: string };
      readonly to: string | { readonly nodeId: string; readonly portName?: string; readonly port?: string };
      readonly fromPin?: string; readonly toPin?: string; readonly fromPort?: string; readonly toPort?: string;
    }>;
  };
}

// ─── SVG WaveformViewer (extracted to verify/WaveformInstrument.tsx) ─────────

type VerifyDrawerTab = 'why' | 'mismatches' | 'details';
type VerifyLayoutMode = 'wide' | 'standard' | 'compact';
type CaptureScopeKind =
  | 'cell'
  | 'row'
  | 'signal'
  | 'all-asserted'
  | 'all-visible-outputs';

interface CaptureScope {
  kind: CaptureScopeKind;
  tick?: number;
  signal?: string;
  vectorId?: string;
  rerunCompare?: boolean;
}

type VectorOwner = 'project' | 'custom';

interface OwnedVerifyVector extends VerifyAuthorVector {
  owner: VectorOwner;
}

interface VerifyCaptureContext {
  waveformByTick: Map<number, Record<string, string>>;
  inputSignalKeys: Set<string>;
  outputSignalKeys: Set<string>;
  mappedNonInputKeys: Set<string>;
  visibleOutputKeys: Set<string>;
  canonicalOutputKeyByWaveSignal: Map<string, string>;
}

interface CaptureApplicationResult {
  projectVectors: VerifyAuthorVector[];
  customVectors: CustomTestVector[];
  changed: boolean;
  capturedAnyExpected: boolean;
}

const VERIFY_UI_STORAGE_KEY = 'rb.verify-ui.v2';
const AUTO_VECTOR_DISMISS_KEY = 'rb.verify-autovector-dismissed.v1';
const DEFAULT_VERIFY_TICK_WIDTH = 72;
const MIN_VERIFY_TICK_WIDTH = 36;
const MAX_VERIFY_TICK_WIDTH = 144;
const VERIFY_WAVEFORM_LABEL_ALLOWANCE = 104;

// ─────────────────────────────────────────────────────────────────────────────

export const VerifySurface: React.FC<VerifySurfaceProps> = ({
  deterministicHash,
  projectName,
  board,
  hasVectors,
  vectors,
  lastRun,
  mappingComplete = true,
  hasFloatingOutputWarning = false,
  probeSignals = [],
  mappedInputs,
  mappedSignals,
  onVectorsChange,
  onGenerateBasicVectors,
  onRunVerification,
  onClearVerification,
  onOpenProjectVectors,
  onFixPath,
  example,
  onGoToDesign,
  onGoToDesignWithInputs,
  onGoToHardware,
  onGoToImport,
  verifyMode = 'combinational' as VerifyMode,
  unmappedOutputLabels = [],
  onPreviewVector,
  liveSignalRoles,
  liveScheduleContract,
  timingGuidance,
  onDebugTickSelected,
  onDeleteVector,
  vectorsAreAutoGenerated = false,
  onGoToExport,
  onSignalSelected,
  selectedTickOverride = null,
  onSelectedTickChange,
  customVectors = [],
  onCustomVectorsChange,
  scenarios,
  activeScenarioId,
  activeScenario,
  onCreateScenario,
  onDuplicateScenario,
  onRenameScenario,
  onDeleteScenario,
  onSwitchScenario,
  onAppendScenarioStep,
  onUpdateScenarioStep,
  onMoveScenarioStep,
  onDeleteScenarioStep,
  projectKind = 'blank',
  sourceExampleId = null,
  scenarioAuthority = 'none',
  guidedLabTask,
  guidedLabDesignChecklist,
  onCreateGuidedLabTruthTable,
  unsupportedFeedbackDiagnostic = null,
  circuitGraph,
}) => {
  const { setHoverBoardSignal } = useBoardSignal();
  const inputFieldSeed = useMemo(
    () =>
      mappedInputs && mappedInputs.length > 0
        ? mappedInputs
        : (mappedSignals ?? [])
            .filter((entry) => entry.direction === 'in')
            .map((entry) => ({
              id: entry.id,
              label: entry.label,
              pin: entry.pin,
              nodeId: entry.nodeId,
            })),
    [mappedInputs, mappedSignals]
  );

  const outputFieldSeed = useMemo(
    () =>
      (mappedSignals ?? [])
        .filter((entry) => entry.direction === 'out')
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          pin: entry.pin,
          nodeId: entry.nodeId,
        })),
    [mappedSignals]
  );

  const inputFields = useMemo(() => normalizeVerifyFields(inputFieldSeed), [inputFieldSeed]);
  const outputFields = useMemo(() => normalizeVerifyFields(outputFieldSeed), [outputFieldSeed]);
  const simOnlyClockFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const node of circuitGraph?.nodes ?? []) {
      const role = typeof node.config?.role === 'string' ? node.config.role.toLowerCase().trim() : '';
      if (node.type !== 'Clock' || role !== 'sim') continue;
      keys.add(normalizeFieldId(node.id));
    }
    return keys;
  }, [circuitGraph]);
  const inputFieldBoardBindings = useMemo(() => {
    const bindings = new Map<string, NonNullable<ReturnType<typeof resolveBasys3SignalBinding>>>();
    for (const entry of inputFieldSeed) {
      const entryKeys = [entry.nodeId, entry.id]
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeFieldId(value));
      if (entryKeys.some((key) => simOnlyClockFieldKeys.has(key))) {
        continue;
      }
      const binding = resolveBasys3SignalBinding({
        id: entry.id,
        label: entry.label,
        pin: entry.pin,
        direction: 'in',
      });
      if (!binding) continue;
      bindings.set(normalizeFieldId(entry.id), binding);
    }
    return bindings;
  }, [inputFieldSeed, simOnlyClockFieldKeys]);
  const boardClockInputField = useMemo(
    () => inputFields.find((field) => inputFieldBoardBindings.get(normalizeFieldId(field.id))?.role === 'clock') ?? null,
    [inputFieldBoardBindings, inputFields]
  );
  const boardClockBinding = useMemo(
    () => (boardClockInputField ? inputFieldBoardBindings.get(normalizeFieldId(boardClockInputField.id)) ?? null : null),
    [boardClockInputField, inputFieldBoardBindings]
  );
  const editableInputFields = useMemo(
    () =>
      inputFields.filter(
        (field) => inputFieldBoardBindings.get(normalizeFieldId(field.id))?.role !== 'clock'
      ),
    [inputFieldBoardBindings, inputFields]
  );
  const stimulusInputFields = useMemo(
    () =>
      boardClockInputField
        ? [
            boardClockInputField,
            ...editableInputFields.filter((field) => field.id !== boardClockInputField.id),
          ]
        : inputFields,
    [boardClockInputField, editableInputFields, inputFields]
  );
  const inputFieldAliases = useMemo(
    () => buildVerifyFieldAliasMap(inputFields, inputFieldSeed),
    [inputFieldSeed, inputFields]
  );
  const outputFieldAliases = useMemo(
    () => buildVerifyFieldAliasMap(outputFields, outputFieldSeed),
    [outputFieldSeed, outputFields]
  );

  const authoredVectors = useMemo(
    () => normalizeVectors(vectors, inputFields, outputFields, inputFieldAliases, outputFieldAliases),
    [inputFieldAliases, inputFields, outputFieldAliases, outputFields, vectors]
  );
  const effectiveNextRunVectors = useMemo(
    () => [...authoredVectors, ...customVectors],
    [authoredVectors, customVectors]
  );
  const customVectorCount = customVectors.length;
  const totalVectorCount = authoredVectors.length + customVectorCount;
  const totalExpectedCaseCount = useMemo(
    () =>
      authoredVectors.filter((vector) => Object.keys(vector.expected).length > 0).length +
      customVectors.filter((vector) => Object.keys(vector.expected ?? {}).length > 0).length,
    [authoredVectors, customVectors]
  );
  const hasVerifyCircuitStructure = useMemo(() => {
    const graphNodeCount = circuitGraph?.nodes.length ?? 0;
    const graphConnectionCount = circuitGraph?.connections.length ?? 0;
    return (
      graphNodeCount > 0 ||
      graphConnectionCount > 0 ||
      inputFields.length > 0 ||
      outputFields.length > 0 ||
      (mappedSignals?.length ?? 0) > 0 ||
      (mappedInputs?.length ?? 0) > 0
    );
  }, [circuitGraph, inputFields.length, mappedInputs?.length, mappedSignals?.length, outputFields.length]);
  const isNoCircuitTaskFirst =
    verifyMode !== 'blocked' &&
    !lastRun &&
    totalVectorCount === 0 &&
    totalExpectedCaseCount === 0 &&
    !hasVerifyCircuitStructure;
  const vectorCollectionSignature = useMemo(
    () => buildVectorCollectionSignature(authoredVectors, customVectors),
    [authoredVectors, customVectors]
  );

  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);

  const handleSignalSelect = useCallback((signal: string | null) => {
    setSelectedSignal(signal);
    onSignalSelected?.(signal != null ? normalizeSignalKey(signal) : null);
  }, [onSignalSelected]);
  const [draftTick, setDraftTick] = useState<number>(() => nextVectorTick(vectors));
  const [runState, setRunState] = useState<'idle' | 'running' | 'complete'>('idle');
  const [orphanPreflight, setOrphanPreflight] = useState(false);
  const [draftInputs, setDraftInputs] = useState<Record<string, '0' | '1'>>(() =>
    createDraftInputs(editableInputFields)
  );
  const [draftExpected, setDraftExpected] = useState<Record<string, VerifyExpectedDraftValue>>(() =>
    createDraftExpected(outputFields)
  );
  const [verifyTab, setVerifyTab] = useState<VerifyDrawerTab>('why');
  const [layoutMode, setLayoutMode] = useState<VerifyLayoutMode>(() => resolveVerifyLayoutMode());
  const [waveformDensity, setWaveformDensity] = useState<'small' | 'normal' | 'large'>('normal');
  const [tickZoom, setTickZoom] = useState<'all' | 'fail' | 'window'>('all');
  const [tickWidth, setTickWidth] = useState(DEFAULT_VERIFY_TICK_WIDTH);
  const [tickWindowCenter, setTickWindowCenter] = useState<number | null>(null);
  const [waveformToolsOpen, setWaveformToolsOpen] = useState(false);
  const [truthTableMode, setTruthTableMode] = useState<TruthTableMode>('ticks');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Next-run compare intent. This is authoring state only; it does not describe
  // the meaning of the persisted run currently shown in Verify.
  const [nextRunUsesAssertions, setNextRunUsesAssertions] = useState(
    () => getRuntimeVerifyRunKind(lastRun) === 'verify' || (!lastRun && totalExpectedCaseCount > 0)
  );
  const runModeTouchedByStudentRef = useRef(false);
  const vectorCollectionSignatureRef = useRef(vectorCollectionSignature);
  const [oracleApplied, setOracleApplied] = useState(false);
  const [selectedFailureKey, setSelectedFailureKey] = useState<string | null>(null);
  // selectedVectorId: pinpoints the specific authored row when a failure has vectorId.
  // null means no row is pinpointed (fallback to tick-only behavior).
  const [selectedVectorId, setSelectedVectorId] = useState<string | null>(null);
  const [pinnedSignalOrder, setPinnedSignalOrder] = useState<string[]>([]);
  const [manualLaneOrder, setManualLaneOrder] = useState<string[]>([]);
  const [hiddenSignals, setHiddenSignals] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<SignalLaneGroup, boolean>>({
    Inputs: true,
    Outputs: false,
    Internal: true,
  });
  const [cursorA, setCursorA] = useState<number | null>(null);
  const [cursorB, setCursorB] = useState<number | null>(null);
  const [previewingVectorId, setPreviewingVectorId] = useState<string | null>(null);
  const [isStepMode, setIsStepMode] = useState(false);
  const [pendingCaptureScope, setPendingCaptureScope] = useState<(CaptureScope & {
    awaitNextRunKey: string | null;
  }) | null>(null);
  const [pendingAssertionRun, setPendingAssertionRun] = useState(false);
  const [sweepPreset, setSweepPreset] = useState<SweepPreset>('binary-count');
  const [sweepSeed, setSweepSeed] = useState('0');
  const [sweepHoldTicks, setSweepHoldTicks] = useState(1);
  const [clockPatternCount, setClockPatternCount] = useState(4);
  const [clockOverrideMode, setClockOverrideMode] =
    useState<VerifyClockOverrideMode>('manual-pulses');
  const [clockRunCycles, setClockRunCycles] = useState(8);
  // ─── Timeline authoring helpers ──────────────────────────────────────────
  const [holdN, setHoldN] = useState(3);
  const [pulseSignal, setPulseSignal] = useState<string>(() => editableInputFields[0]?.id ?? '');
  const [autoVectorBannerDismissed, setAutoVectorBannerDismissed] = useState(() => {
    if (!vectorsAreAutoGenerated) return false;
    try {
      return sessionStorage.getItem(AUTO_VECTOR_DISMISS_KEY) === deterministicHash;
    } catch {
      return false;
    }
  });
  const waveformScrollRef = useRef<HTMLDivElement | null>(null);
  const lastAutoExpandedPassRunRef = useRef<string | null>(null);
  const scenarioBuilderDetailsRef = useRef<HTMLElement>(null);
  const [scenarioWorkbenchExpanded, setScenarioWorkbenchExpanded] = useState(() => Boolean(lastRun));
  const lastRunWorkbenchKey = useMemo(
    () =>
      lastRun
        ? `${lastRun.reportHash ?? 'no-report'}:${lastRun.generatedAtIso ?? 'no-generated-at'}`
        : 'no-run',
    [lastRun?.generatedAtIso, lastRun?.reportHash]
  );

  useEffect(() => {
    setScenarioWorkbenchExpanded(Boolean(lastRun));
  }, [lastRunWorkbenchKey, lastRun]);

  // N2 — restore oscilloscope UI state from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(VERIFY_UI_STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.selectedTick === 'number') setSelectedTick(s.selectedTick);
      if (s.cursorA === null || typeof s.cursorA === 'number') setCursorA(s.cursorA as number | null);
      if (s.cursorB === null || typeof s.cursorB === 'number') setCursorB(s.cursorB as number | null);
      if (typeof s.drawerOpen === 'boolean') setDrawerOpen(s.drawerOpen);
      if (typeof s.tickWidth === 'number') setTickWidth(clampTickWidth(s.tickWidth));
      if (Array.isArray(s.manualLaneOrder)) setManualLaneOrder(s.manualLaneOrder.filter((entry): entry is string => typeof entry === 'string'));
      if (Array.isArray(s.hiddenSignals)) setHiddenSignals(s.hiddenSignals.filter((entry): entry is string => typeof entry === 'string'));
      if (typeof s.waveformDensity === 'string' && ['small', 'normal', 'large'].includes(s.waveformDensity)) {
        setWaveformDensity(s.waveformDensity as 'small' | 'normal' | 'large');
      }
      if (typeof s.tickZoom === 'string' && ['all', 'fail', 'window'].includes(s.tickZoom)) {
        setTickZoom(s.tickZoom as 'all' | 'fail' | 'window');
      }
      if (s.collapsedGroups && typeof s.collapsedGroups === 'object') {
        const nextGroups = s.collapsedGroups as Partial<Record<SignalLaneGroup, boolean>>;
        setCollapsedGroups((previous) => ({
          Inputs: typeof nextGroups.Inputs === 'boolean' ? nextGroups.Inputs : previous.Inputs,
          Outputs: typeof nextGroups.Outputs === 'boolean' ? nextGroups.Outputs : previous.Outputs,
          Internal: typeof nextGroups.Internal === 'boolean' ? nextGroups.Internal : previous.Internal,
        }));
      }
    } catch { /* silent — sessionStorage unavailable */ }
  }, []); // mount-only

  // N2 — persist oscilloscope UI state on change
  useEffect(() => {
    try {
      sessionStorage.setItem(
        VERIFY_UI_STORAGE_KEY,
        JSON.stringify({
          selectedTick,
          cursorA,
          cursorB,
          drawerOpen,
          tickWidth,
          waveformDensity,
          tickZoom,
          manualLaneOrder,
          hiddenSignals,
          collapsedGroups,
        })
      );
    } catch { /* silent — storage quota or unavailable */ }
  }, [selectedTick, cursorA, cursorB, drawerOpen, tickWidth, waveformDensity, tickZoom, manualLaneOrder, hiddenSignals, collapsedGroups]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setLayoutMode(resolveVerifyLayoutMode());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-check dismiss state when hash or auto-generated flag changes (new project = re-show)
  useEffect(() => {
    if (!vectorsAreAutoGenerated) return;
    try {
      setAutoVectorBannerDismissed(sessionStorage.getItem(AUTO_VECTOR_DISMISS_KEY) === deterministicHash);
    } catch {
      setAutoVectorBannerDismissed(false);
    }
  }, [deterministicHash, vectorsAreAutoGenerated]);

  const handleDismissAutoVectorBanner = useCallback(() => {
    setAutoVectorBannerDismissed(true);
    try { sessionStorage.setItem(AUTO_VECTOR_DISMISS_KEY, deterministicHash); } catch {}
  }, [deterministicHash]);

  const handleDraftInputChange = useCallback((fieldId: string, value: '0' | '1') => {
    setDraftInputs((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleDraftExpectedChange = useCallback((fieldId: string, value: VerifyExpectedDraftValue) => {
    setDraftExpected((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const ROW_H_MAP: Record<string, number> = { small: 40, normal: 48, large: 76 };

  useEffect(() => {
    setDraftInputs((prev) => withInputFieldDefaults(prev, editableInputFields));
  }, [editableInputFields]);

  useEffect(() => {
    setDraftExpected((prev) => withExpectedFieldDefaults(prev, outputFields));
  }, [outputFields]);

  useEffect(() => {
    if (editableInputFields.length === 0) {
      setPulseSignal('');
      return;
    }
    if (!editableInputFields.some((field) => field.id === pulseSignal)) {
      setPulseSignal(editableInputFields[0]?.id ?? '');
    }
  }, [editableInputFields, pulseSignal]);

  useEffect(() => {
    setDraftTick(nextVectorTick(vectors));
  }, [vectors]);

  useEffect(() => {
    if (vectorCollectionSignatureRef.current === vectorCollectionSignature) return;
    vectorCollectionSignatureRef.current = vectorCollectionSignature;
    runModeTouchedByStudentRef.current = false;
  }, [vectorCollectionSignature]);

  useEffect(() => {
    if (lastRun || runModeTouchedByStudentRef.current) return;
    setNextRunUsesAssertions(totalExpectedCaseCount > 0);
  }, [lastRun, totalExpectedCaseCount]);

  const runRows = lastRun?.report.rows ?? [];
  useEffect(() => {
    if (!lastRun) return;
    if (getRuntimeVerifyRunKind(lastRun) === 'verify') {
      setNextRunUsesAssertions(true);
      return;
    }
    if (getRuntimeVerifyRunKind(lastRun) === 'trace') {
      setNextRunUsesAssertions(false);
    }
  }, [lastRun]);
  const tickIndex = useMemo(
    () => (lastRun?.report ? buildVerifyTickSignalIndex(lastRun.report) : { ticks: [], rowsByTick: {} }),
    [lastRun?.report]
  );
  const timelineTicks = tickIndex.ticks;
  const waveformTicks = useMemo(() => {
    const ticks = new Set<number>();
    const source = lastRun?.waveform ?? [];
    for (const sample of source) ticks.add(sample.tick);
    return Array.from(ticks).sort((a, b) => a - b);
  }, [lastRun?.waveform]);
  const allWaveformTicks = useMemo(
    () => (waveformTicks.length > 0 ? waveformTicks : timelineTicks),
    [waveformTicks, timelineTicks]
  );
  const canonicalWaveformSignalByRawKey = useMemo(
    () =>
      buildCanonicalWaveformSignalAliases({
        lastRun,
        inputFields,
        outputFields,
        mappedSignals,
      }),
    [inputFields, lastRun, mappedSignals, outputFields]
  );

  const signalTimeline = useMemo(() => {
    const signalValueMap = new Map<string, Map<number, string>>();
    const waveformSource = lastRun?.waveform ?? [];
    for (const sample of waveformSource) {
      for (const [rawSignal, value] of Object.entries(sample.signals)) {
        const signal =
          canonicalWaveformSignalByRawKey.get(normalizeFieldId(rawSignal)) ?? rawSignal;
        const values = signalValueMap.get(signal) ?? new Map<number, string>();
        values.set(sample.tick, value);
        signalValueMap.set(signal, values);
      }
    }

    const displayTicks = waveformTicks.length > 0 ? waveformTicks : timelineTicks;
    return Array.from(signalValueMap.entries())
      .sort((left, right) => compareText(left[0], right[0]))
      .map(([signal, values]) => ({
        signal,
        values: displayTicks.map((tick) => ({
          tick,
          value: values.get(tick) ?? '-',
        })),
      }));
  }, [canonicalWaveformSignalByRawKey, lastRun?.waveform, timelineTicks, waveformTicks]);

  const failingRows = useMemo(
    () => runRows.filter((row) => row.status === 'fail'),
    [runRows]
  );
  const failuresByTick = useMemo(() => {
    const grouped = new Map<number, VerifyRow[]>();
    for (const row of failingRows) {
      const current = grouped.get(row.tick);
      if (current) current.push(row);
      else grouped.set(row.tick, [row]);
    }
    return grouped;
  }, [failingRows]);
  const firstFailure = failingRows[0] ?? null;
  const selectedFailure = useMemo(
    () =>
      selectedFailureKey
        ? failingRows.find(
            (row) =>
              buildFailureCaseKey(row.tick, row.signal, row.vectorId, row.caseIndex) ===
                selectedFailureKey
          ) ?? null
        : null,
    [failingRows, selectedFailureKey]
  );
  const selectedFailureCase = selectedFailure ?? firstFailure;
  const selectedFailurePeers = useMemo(() => {
    if (!selectedFailureCase) return [];
    const selectedKey = buildFailureCaseKey(
      selectedFailureCase.tick,
      selectedFailureCase.signal,
      selectedFailureCase.vectorId,
      selectedFailureCase.caseIndex
    );
    return (failuresByTick.get(selectedFailureCase.tick) ?? []).filter(
      (row) =>
        buildFailureCaseKey(row.tick, row.signal, row.vectorId, row.caseIndex) !== selectedKey
    );
  }, [failuresByTick, selectedFailureCase]);
  const verifyPreflightIssues = useMemo(
    () => lastRun?.evidence?.preflight ?? [],
    [lastRun?.evidence?.preflight]
  );
  const verifyPreflightDiagnostics = useMemo(
    () => verifyPreflightIssues.map((issue) => adaptVerifyPreflightIssue(issue)),
    [verifyPreflightIssues]
  );
  const studentVerifyModel = useMemo(
    () =>
      buildVerifyStudentViewModel({
        lastRun,
        mappedSignals,
        selectedFailureKey,
        preflightDiagnostics: verifyPreflightDiagnostics,
      }),
    [lastRun, mappedSignals, selectedFailureKey, verifyPreflightDiagnostics]
  );
  const studentFailureRows = studentVerifyModel.failureRows;
  const studentSelectedFailure = studentVerifyModel.selectedFailure;
  const studentSelectedFailurePeers = studentVerifyModel.selectedPeers;
  const studentFailureRowByKey = useMemo(() => {
    const lookup = new Map<string, (typeof studentFailureRows)[number]>();
    for (const row of studentFailureRows) {
      lookup.set(row.key, row);
    }
    return lookup;
  }, [studentFailureRows]);
  const selectedFailureLabel =
    studentSelectedFailure?.signalLabel ?? selectedFailureCase?.signal ?? null;
  const getFailureSignalLabel = useCallback(
    (row: Pick<VerifyFailureTarget, 'tick' | 'signal' | 'vectorId' | 'caseIndex'>) =>
      studentFailureRowByKey.get(
        buildFailureCaseKey(row.tick, row.signal, row.vectorId, row.caseIndex)
      )?.signalLabel ?? row.signal,
    [studentFailureRowByKey]
  );
  const selectedFailureEvidence = useMemo(() => {
    if (!selectedFailureCase) return null;
    const failures = lastRun?.evidence?.failures ?? [];
    return (
      failures.find(
        (entry) =>
          entry.vectorId === selectedFailureCase.vectorId &&
          entry.signal === selectedFailureCase.signal &&
          entry.caseIndex === selectedFailureCase.caseIndex
      ) ??
      failures.find(
        (entry) =>
          entry.tick === selectedFailureCase.tick && entry.signal === selectedFailureCase.signal
      ) ??
      null
    );
  }, [lastRun?.evidence?.failures, selectedFailureCase]);
  const firstFailTickFromRows = failingRows[0]?.tick ?? null;
  const failTicksBySignal = useMemo(() => {
    const grouped = new Map<string, number[]>();
    for (const row of failingRows) {
      const current = grouped.get(row.signal);
      if (current) {
        if (!current.includes(row.tick)) current.push(row.tick);
      } else {
        grouped.set(row.signal, [row.tick]);
      }
    }
    for (const ticks of grouped.values()) {
      ticks.sort((left, right) => left - right);
    }
    return grouped;
  }, [failingRows]);
  const firstRunTick = runRows[0]?.tick ?? allWaveformTicks[0] ?? null;
  const hasResetSignalRole = useMemo(
    () => Object.values(lastRun?.report.signalRoles ?? {}).some((role) => role === 'reset'),
    [lastRun?.report.signalRoles]
  );

  // Coverage: unique input combinations tested vs. total possible (2^N), capped at 6 inputs
  const inputCoverage = useMemo(() => {
    const n = inputFields.length;
    if (n === 0 || n > 6 || authoredVectors.length === 0) return null;
    const seen = new Set(
      authoredVectors.map((v) => inputFields.map((f) => (v.inputs[f.id] ?? 0)).join(''))
    );
    const total = 1 << n;
    return { seen: seen.size, total, pct: Math.round((100 * seen.size) / total) };
  }, [authoredVectors, inputFields]);

  const mappedSignalKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const signal of mappedSignals ?? []) {
      const candidates = [signal.id, signal.label ?? ''];
      for (const candidate of candidates) {
        const normalized = normalizeFieldId(candidate);
        if (normalized) keys.add(normalized);
      }
    }
    return keys;
  }, [mappedSignals]);
  const failingSignalKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of failingRows) {
      const normalized = normalizeFieldId(row.signal);
      if (normalized) keys.add(normalized);
    }
    return keys;
  }, [failingRows]);
  const probeSignalKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const probe of probeSignals) {
      for (const candidate of [probe.key, probe.label ?? '']) {
        const normalized = normalizeFieldId(candidate);
        if (normalized) keys.add(normalized);
      }
    }
    return keys;
  }, [probeSignals]);
  const mappedSignalDirectionKeys = useMemo(() => {
    const keys = new Map<string, 'in' | 'out'>();
    for (const signal of mappedSignals ?? []) {
      for (const candidate of [signal.id, signal.label ?? '']) {
        const normalized = normalizeFieldId(candidate);
        if (normalized && !keys.has(normalized)) {
          keys.set(normalized, signal.direction);
        }
      }
    }
    return keys;
  }, [mappedSignals]);
  const matchedProbeSignalKeys = useMemo(() => {
    const matched = new Set<string>();
    if (probeSignalKeys.size === 0) return matched;
    for (const entry of signalTimeline) {
      const normalized = normalizeFieldId(entry.signal);
      if (probeSignalKeys.has(normalized)) matched.add(normalized);
    }
    return matched;
  }, [probeSignalKeys, signalTimeline]);
  const selectedFailureSignalKey = selectedFailureCase ? normalizeFieldId(selectedFailureCase.signal) : null;
  const selectedFailurePeerKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of selectedFailurePeers) {
      const normalized = normalizeFieldId(row.signal);
      if (normalized) keys.add(normalized);
    }
    return keys;
  }, [selectedFailurePeers]);

  // Sprint 11: signalMeta map keyed by display name for WaveformViewer
  const signalMetaMap = useMemo(() => {
    const map = new Map<string, { direction: 'in' | 'out'; pin?: string }>();
    for (const sig of mappedSignals ?? []) {
      map.set(sig.label ?? sig.id, { direction: sig.direction, pin: sig.pin });
      map.set(sig.id, { direction: sig.direction, pin: sig.pin });
    }
    return map;
  }, [mappedSignals]);
  const relevantSignalTimeline = useMemo(() => {
    const filtered = signalTimeline.filter((entry) => {
      const normalized = normalizeFieldId(entry.signal);
      return (
        mappedSignalKeys.has(normalized) ||
        failingSignalKeys.has(normalized) ||
        (selectedFailureCase !== null && matchedProbeSignalKeys.has(normalized))
      );
    });
    return filtered.length > 0 ? filtered : signalTimeline;
  }, [failingSignalKeys, mappedSignalKeys, matchedProbeSignalKeys, selectedFailureCase, signalTimeline]);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [showMismatchOnlySignals, setShowMismatchOnlySignals] = useState(false);
  const [signalsRailCollapsed, setSignalsRailCollapsed] = useState(true);
  const mismatchOnlyTimeline = useMemo(() => {
    const filtered = signalTimeline.filter((entry) =>
      failingSignalKeys.has(normalizeFieldId(entry.signal))
    );
    return filtered.length > 0 ? filtered : relevantSignalTimeline;
  }, [failingSignalKeys, relevantSignalTimeline, signalTimeline]);
  const visibleSignalTimelineBase = showMismatchOnlySignals
    ? mismatchOnlyTimeline
    : showAllSignals
      ? signalTimeline
      : relevantSignalTimeline;
  const pinnedSignals = useMemo(() => new Set(pinnedSignalOrder), [pinnedSignalOrder]);
  const visibleSignalTimeline = useMemo(() => {
    if (visibleSignalTimelineBase.length <= 1) return visibleSignalTimelineBase;
    const pinnedOrder = new Map(pinnedSignalOrder.map((signal, index) => [signal, index]));
    const manualOrder = new Map(manualLaneOrder.map((signal, index) => [signal, index]));
    const lanePriority = (signal: string): number => {
      const normalized = normalizeFieldId(signal);
      if (selectedFailureSignalKey && normalized === selectedFailureSignalKey) return 1;
      if (selectedFailurePeerKeys.has(normalized)) return 2;
      if (matchedProbeSignalKeys.has(normalized)) return 3;
      return 10; // fall through to group ordering
    };
    const laneGroupPriority = (signal: string): number => {
      const direction = mappedSignalDirectionKeys.get(normalizeFieldId(signal));
      if (direction === 'out') return 1; // Observed outputs before stimulus
      if (direction === 'in') return 2;  // Stimulus inputs after outputs
      return 3;                          // Internal last
    };
    return [...visibleSignalTimelineBase].sort((left, right) => {
      const leftManual = manualOrder.get(left.signal);
      const rightManual = manualOrder.get(right.signal);
      if (leftManual !== undefined || rightManual !== undefined) {
        if (leftManual === undefined) return 1;
        if (rightManual === undefined) return -1;
        return leftManual - rightManual;
      }
      const leftPinned = pinnedOrder.get(left.signal);
      const rightPinned = pinnedOrder.get(right.signal);
      if (leftPinned !== undefined || rightPinned !== undefined) {
        if (leftPinned === undefined) return 1;
        if (rightPinned === undefined) return -1;
        return leftPinned - rightPinned;
      }
      if (selectedFailureCase) {
        const failDelta = lanePriority(left.signal) - lanePriority(right.signal);
        if (failDelta !== 0) return failDelta;
      }
      // Always group: Stimulus (in) → Observed (out) → Internal
      const groupDelta = laneGroupPriority(left.signal) - laneGroupPriority(right.signal);
      if (groupDelta !== 0) return groupDelta;
      return compareText(left.signal, right.signal);
    });
  }, [
    manualLaneOrder,
    matchedProbeSignalKeys,
    mappedSignalDirectionKeys,
    pinnedSignalOrder,
    selectedFailureCase,
    selectedFailurePeerKeys,
    selectedFailureSignalKey,
    visibleSignalTimelineBase,
  ]);
  const hiddenSignalSet = useMemo(() => new Set(hiddenSignals), [hiddenSignals]);
  const laneGroupBySignal = useMemo(() => {
    const groups = new Map<string, SignalLaneGroup>();
    for (const entry of visibleSignalTimeline) {
      const direction = mappedSignalDirectionKeys.get(normalizeFieldId(entry.signal));
      if (direction === 'in') groups.set(entry.signal, 'Inputs');
      else if (direction === 'out') groups.set(entry.signal, 'Outputs');
      else groups.set(entry.signal, 'Internal');
    }
    return groups;
  }, [mappedSignalDirectionKeys, visibleSignalTimeline]);
  const groupedVisibleSignals = useMemo<Record<SignalLaneGroup, WaveformSignalRow[]>>(() => {
    const grouped: Record<SignalLaneGroup, WaveformSignalRow[]> = {
      Inputs: [],
      Outputs: [],
      Internal: [],
    };
    for (const entry of visibleSignalTimeline) {
      grouped[laneGroupBySignal.get(entry.signal) ?? 'Internal'].push(entry);
    }
    return grouped;
  }, [laneGroupBySignal, visibleSignalTimeline]);
  const passRunWithNoMismatches = (lastRun?.status ?? 'idle') === 'pass' && failingRows.length === 0;
  const effectiveCollapsedGroups = useMemo<Record<SignalLaneGroup, boolean>>(() => {
    const onlyInternalLanes =
      visibleSignalTimeline.length > 0 &&
      visibleSignalTimeline.every(
        (entry) => (laneGroupBySignal.get(entry.signal) ?? 'Internal') === 'Internal'
      );
    if (!onlyInternalLanes) return collapsedGroups;
    return {
      ...collapsedGroups,
      Internal: false,
    };
  }, [collapsedGroups, laneGroupBySignal, visibleSignalTimeline]);

  useEffect(() => {
    if (!passRunWithNoMismatches) return;
    if (groupedVisibleSignals.Inputs.length === 0) return;
    const runKey = lastRunWorkbenchKey === 'no-run' ? null : lastRunWorkbenchKey;
    if (!runKey || lastAutoExpandedPassRunRef.current === runKey) return;
    setCollapsedGroups((previous) =>
      previous.Inputs ? { ...previous, Inputs: false } : previous
    );
    lastAutoExpandedPassRunRef.current = runKey;
  }, [
    groupedVisibleSignals.Inputs.length,
    lastRunWorkbenchKey,
    passRunWithNoMismatches,
  ]);
  const displaySignalTimeline = useMemo(() => {
    return visibleSignalTimeline.filter((entry) => {
      if (hiddenSignalSet.has(entry.signal)) return false;
      const group = laneGroupBySignal.get(entry.signal) ?? 'Internal';
      return !effectiveCollapsedGroups[group];
    });
  }, [effectiveCollapsedGroups, hiddenSignalSet, laneGroupBySignal, visibleSignalTimeline]);
  const visibleSignalCount = displaySignalTimeline.length;
  const boardSignalByLane = useMemo(() => {
    const mapping = new Map<string, ReturnType<typeof resolveBoardSignal>>();
    for (const sig of mappedSignals ?? []) {
      const boardSignal =
        resolveBoardSignal(sig.pin) ??
        resolveBoardSignal(sig.label) ??
        resolveBoardSignal(sig.id);
      if (!boardSignal) continue;
      mapping.set(sig.label ?? sig.id, boardSignal);
      mapping.set(sig.id, boardSignal);
    }
    return mapping;
  }, [mappedSignals]);
  const resolveLaneBoardSignal = useCallback(
    (signal: string | null | undefined) => {
      if (!signal) return null;
      return boardSignalByLane.get(signal) ?? resolveBoardSignal(signal);
    },
    [boardSignalByLane]
  );
  const captureContext = useMemo(
    () =>
      buildCaptureContext({
        lastRun,
        inputFields,
        outputFields,
        mappedSignals,
        visibleSignals: displaySignalTimeline.map((entry) => entry.signal),
      }),
    [displaySignalTimeline, inputFields, lastRun, mappedSignals, outputFields]
  );
  const applyFailureSelection = useCallback((target: VerifyFailureTarget | VerifyRow | null) => {
    if (!target) return;
    setSelectedFailureKey(
      buildFailureCaseKey(target.tick, target.signal, target.vectorId, target.caseIndex)
    );
    setSelectedTick(target.tick);
    handleSignalSelect(target.signal);
    // Pin to specific authored row when vectorId is available.
    // When absent, fall back to tick-only; do not imply row-level pinpointing.
    setSelectedVectorId(target.vectorId ?? null);
    // Open the lower details tray so the authored row is visible without using a shell rail.
    setDrawerOpen(true);
  }, [handleSignalSelect]);
  const reviewFailureInVerify = useCallback(
    (target: VerifyFailureTarget | VerifyRow | null) => {
      if (!target) return;
      applyFailureSelection(target);
      setVerifyTab('details');
      setDrawerOpen(true);
    },
    [applyFailureSelection]
  );
  const openFailureInDesign = useCallback(
    (target: VerifyFailureTarget | VerifyRow | null) => {
      if (!target || !onFixPath) return;
      onFixPath({
        signal: target.signal,
        tick: target.tick,
        expected: target.expected,
        actual: target.actual,
        vectorId: target.vectorId,
        caseIndex: target.caseIndex,
      });
    },
    [onFixPath]
  );

  // Reveal the optional output-check editor inside the Stimulus Workbench.
  // Used by compare/failure CTAs to route students into the secondary checks path.
  const handleEditExpectedOutputs = useCallback(() => {
    setNextRunUsesAssertions(true);
    setScenarioWorkbenchExpanded(true);
    const details = scenarioBuilderDetailsRef.current;
    if (details) {
      details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const selectFailureAtTick = useCallback(
    (tick: number, preferredSignal?: string | null) => {
      const failuresAtTick = failuresByTick.get(tick) ?? [];
      if (failuresAtTick.length === 0) {
        setSelectedTick(tick);
        if (preferredSignal) handleSignalSelect(preferredSignal);
        return;
      }
      const preferredSignalKey = normalizeFieldId(preferredSignal ?? '');
      const nextFailure =
        failuresAtTick.find((row) => normalizeFieldId(row.signal) === preferredSignalKey) ??
        failuresAtTick[0];
      applyFailureSelection(nextFailure);
    },
    [applyFailureSelection, failuresByTick, handleSignalSelect]
  );
  const selectedTickRows = useMemo(() => {
    if (selectedTick === null) return [];
    const keyed = tickIndex.rowsByTick[String(selectedTick)] ?? [];
    return selectedSignal
      ? keyed.filter((row) => row.signal === selectedSignal)
      : keyed;
  }, [selectedSignal, selectedTick, tickIndex.rowsByTick]);

  // ─── AssertionCanvas data provider ────────────────────────────────────────
  // Build a function that returns expected/actual cell values for assertion overlay.
  // Data comes from: vectors (expected) + report (actual + mismatch status).
  const getAssertionCellValue = useCallback(
    (tick: number, signal: string) => {
      // Look up expected value from scenario vectors
      let expectedValue: 0 | 1 | null = null;
      for (const vec of vectors ?? []) {
        if (vec.tick === tick) {
          expectedValue = vec.expected?.[signal] == null ? null : normalizeBit(vec.expected[signal]);
          break;
        }
      }

      // Look up actual value from verify run report
      let actualValue: 0 | 1 | string = '-';
      let isMismatch = false;

      if (lastRun?.report) {
        for (const row of lastRun.report.rows) {
          if (row.tick === tick && row.signal === signal) {
            actualValue = row.actual;
            isMismatch = row.status === 'fail' && expectedValue !== null;
            break;
          }
        }
      }

      return {
        expected: expectedValue,
        actual: actualValue,
        isMismatch,
      };
    },
    [vectors, lastRun?.report]
  );

  useEffect(() => {
    if (allWaveformTicks.length === 0) {
      setSelectedTick(null);
      return;
    }

    const preferredTick =
      typeof lastRun?.firstFailingTick === 'number'
        ? lastRun.firstFailingTick
        : allWaveformTicks[0];
    setSelectedTick((previous) =>
      previous !== null && allWaveformTicks.includes(previous) ? previous : preferredTick
    );
  }, [allWaveformTicks, lastRun?.firstFailingTick]);

  useEffect(() => {
    if (selectedTickOverride === null) return;
    if (allWaveformTicks.length > 0 && !allWaveformTicks.includes(selectedTickOverride)) return;
    setSelectedTick((previous) => (previous === selectedTickOverride ? previous : selectedTickOverride));
  }, [allWaveformTicks, selectedTickOverride]);

  useEffect(() => {
    onSelectedTickChange?.(selectedTick);
  }, [onSelectedTickChange, selectedTick]);

  useEffect(() => {
    if (allWaveformTicks.length === 0) {
      setCursorA(null);
      setCursorB(null);
      return;
    }

    setCursorA((previous) =>
      previous !== null && allWaveformTicks.includes(previous)
        ? previous
        : selectedTick ?? allWaveformTicks[0]
    );
    setCursorB((previous) => {
      if (previous !== null && allWaveformTicks.includes(previous)) return previous;
      if (typeof firstFailTickFromRows === 'number' && allWaveformTicks.includes(firstFailTickFromRows)) {
        return firstFailTickFromRows;
      }
      return allWaveformTicks[allWaveformTicks.length - 1] ?? allWaveformTicks[0];
    });
  }, [allWaveformTicks, firstFailTickFromRows, selectedTick]);

  useEffect(() => {
    if (displaySignalTimeline.length === 0) {
      if (selectedSignal !== null) {
        handleSignalSelect(null);
      }
      return;
    }
    const firstFailSignal = failingRows[0]?.signal;
    const nextSignal =
      selectedSignal && displaySignalTimeline.some((entry) => entry.signal === selectedSignal)
        ? selectedSignal
        : firstFailSignal ?? displaySignalTimeline[0]?.signal ?? null;
    if (nextSignal !== selectedSignal) {
      handleSignalSelect(nextSignal);
    }
  }, [displaySignalTimeline, failingRows, handleSignalSelect, selectedSignal]);

  useEffect(() => {
    if (failingRows.length === 0) {
      setSelectedFailureKey(null);
      return;
    }
    setSelectedFailureKey((previous) =>
      previous &&
      failingRows.some(
        (row) =>
          buildFailureCaseKey(row.tick, row.signal, row.vectorId, row.caseIndex) === previous
      )
        ? previous
        : buildFailureCaseKey(
            failingRows[0].tick,
            failingRows[0].signal,
            failingRows[0].vectorId,
            failingRows[0].caseIndex
          )
    );
  }, [failingRows]);

  useEffect(() => {
    if (!lastRun || lastRun.status !== 'fail' || failingRows.length === 0) return;
    applyFailureSelection(failingRows[0]);
  }, [applyFailureSelection, failingRows, lastRunWorkbenchKey, lastRun?.status]);

  useEffect(() => {
    if (failingRows.length === 0 && showMismatchOnlySignals) {
      setShowMismatchOnlySignals(false);
    }
  }, [failingRows.length, showMismatchOnlySignals]);

  useEffect(() => {
    setPinnedSignalOrder((previous) => {
      const next = previous.filter((signal) =>
        displaySignalTimeline.some((entry) => entry.signal === signal)
      );
      if (next.length === previous.length && next.every((entry, index) => entry === previous[index])) {
        return previous;
      }
      return next;
    });
  }, [displaySignalTimeline]);

  useEffect(() => {
    if (lastRun) {
      setRunState('complete');
    }
  }, [lastRunWorkbenchKey]);

  // Auto-shape the lower analysis deck once per run:
  // fail runs open directly into mismatch analysis, while pass/trace runs
  // prioritize the waveform and collapse the lower drawer.
  // Also: auto-fit tick width and density to the actual run data.
  const autoHandledRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastRun) return;
    const key = lastRunWorkbenchKey;
    if (autoHandledRunRef.current === key) return;
    autoHandledRunRef.current = key;

    // Adaptive tick width: fit all ticks into the visible container
    const container = waveformScrollRef.current;
    const tickCount = lastRun.waveform?.length ?? 0;
    if (container && tickCount > 0) {
      setTickWidth(fitWaveformTickWidth(container.clientWidth, tickCount));
    }

    // Auto-density from signal count: compress rows when many signals
    const sigCount = Object.keys(lastRun.report?.signalRoles ?? {}).length;
    if (sigCount > 6) {
      setWaveformDensity('small');
    } else {
      setWaveformDensity('normal');
    }

    if (lastRun.status === 'fail' && getRuntimeVerifyRunKind(lastRun) === 'verify') {
      setVerifyTab('mismatches');
    }
    setDrawerOpen(false);
  }, [lastRun, lastRunWorkbenchKey, lastRun?.status]);

  const resultRows = useMemo(
    () =>
      runRows.map((row) => [
        String(row.tick),
        row.signal,
        row.expected,
        row.actual,
        row.status === 'pass' ? 'PASS' : 'FAIL',
      ]),
    [runRows]
  );

  // ─── Run result lookup: (vecId, signal) → 'pass' | 'fail' | 'none' ─────────
  // Used to colorize expected-output cells in the vector table.
  // Keyed by "vecId::signal" so same-tick rows are distinguished by identity.
  const runResultByVecAndSignal = useMemo(() => {
    const map = new Map<string, 'pass' | 'fail'>();
    for (const row of runRows) {
      if (row.vectorId) {
        map.set(`${row.vectorId}::${normalizeFieldId(row.signal)}`, row.status);
      }
    }
    return map;
  }, [runRows]);

  // ─── Expected-output cell toggle ─────────────────────────────────────────
  // Toggles v.expected[field] between 0 and 1 (immutable).
  const handleToggleVectorExpected = useCallback(
    (vectorId: string, fieldId: string) => {
      const updated = authoredVectors.map((v) => {
        if (v.id !== vectorId) return v;
        const current = v.expected[fieldId] ?? 0;
        return { ...v, expected: { ...v.expected, [fieldId]: (current === 1 ? 0 : 1) as 0 | 1 } };
      });
      onVectorsChange?.(updated);
      setOracleApplied(false);
    },
    [authoredVectors, onVectorsChange]
  );

  // ─── Fix expectation from failure ────────────────────────────────────────
  // Sets v.expected[signal] DIRECTLY to the failure's actual value.
  // This is NOT a blind toggle — it is an explicit "accept this actual as correct" action.
  // Constraint: only updates the specific (vectorId, signal) pair; leaves all other rows unchanged.
  const handleFixExpectation = useCallback(
    (vectorId: string, signal: string, actualValue: '0' | '1') => {
      const result = updateExpectedCellInVectorSets({
        projectVectors: authoredVectors,
        customVectors,
        tick: -1,
        signal,
        vectorId,
        nextValue: actualValue === '1' ? 1 : 0,
      });
      if (!result.changed) return;
      onVectorsChange?.(result.projectVectors);
      onCustomVectorsChange?.(result.customVectors);
      setNextRunUsesAssertions(true);
      setOracleApplied(false);
    },
    [authoredVectors, customVectors, onCustomVectorsChange, onVectorsChange]
  );

  // ─── Inline cell toggle ──────────────────────────────────────────────────
  // Toggles a scalar binary (0|1) input cell directly in the vector table.
  const handleToggleVectorCell = useCallback(
    (vectorId: string, fieldId: string) => {
      const updated = authoredVectors.map((v) => {
        if (v.id !== vectorId) return v;
        const current = v.inputs[fieldId] ?? 0;
        return { ...v, inputs: { ...v.inputs, [fieldId]: (current === 1 ? 0 : 1) as 0 | 1 } };
      });
      onVectorsChange?.(updated);
      setOracleApplied(false);
    },
    [authoredVectors, onVectorsChange]
  );

  // ─── Per-row duplicate ───────────────────────────────────────────────────
  // Creates a copy of the row at tick + 1 with a new id, then sorts by tick.
  const handleDuplicateVector = useCallback(
    (vectorId: string) => {
      const source = authoredVectors.find((v) => v.id === vectorId);
      if (!source) return;
      const newId = `vec-${String(Date.now()).slice(-6)}`;
      const copy: VerifyAuthorVector = {
        id: newId,
        tick: source.tick + 1,
        inputs: { ...source.inputs },
        expected: { ...source.expected },
      };
      const nextVectors = [...authoredVectors, copy].sort((a, b) => a.tick - b.tick);
      onVectorsChange?.(nextVectors);
      setOracleApplied(false);
    },
    [authoredVectors, onVectorsChange]
  );

  // ── Design schema authority: vector compatibility ─────────────────────────
  // Declared before vectorRows because vectorRows references vectorCompatibilityMap inline.
  const inputFieldIds = useMemo(() => new Set(inputFields.map((f) => f.id)), [inputFields]);
  const outputFieldIds = useMemo(() => new Set(outputFields.map((f) => f.id)), [outputFields]);

  type VectorCompatibility = 'compatible' | 'partial' | 'orphaned';
  const vectorCompatibilityMap = useMemo((): Map<string, VectorCompatibility> => {
    return new Map(
      authoredVectors.map((v) => {
        const inputKeys = Object.keys(v.inputs ?? {});
        const expectedKeys = Object.keys(v.expected ?? {});
        // Check inputs against current inputFields
        const inputMatchCount = inputKeys.filter((k) => inputFieldIds.has(k)).length;
        const inputOrphaned = inputKeys.length > 0 && inputMatchCount === 0;
        const inputPartial = inputKeys.length > 0 && inputMatchCount < inputKeys.length;
        // Check expected against current outputFields (only when outputFields is non-empty)
        const expectedMatchCount = outputFieldIds.size > 0
          ? expectedKeys.filter((k) => outputFieldIds.has(k)).length
          : expectedKeys.length;
        const expectedOrphaned = expectedKeys.length > 0 && outputFieldIds.size > 0 && expectedMatchCount === 0;
        const expectedPartial = expectedKeys.length > 0 && outputFieldIds.size > 0 && expectedMatchCount < expectedKeys.length;
        // Aggregate: orphaned if all signal references are dead, partial if some are
        const allOrphaned = (inputKeys.length + expectedKeys.length) > 0 && inputMatchCount === 0 && expectedMatchCount === 0;
        const someOrphaned = inputOrphaned || inputPartial || expectedOrphaned || expectedPartial;
        if (allOrphaned) return [v.id, 'orphaned' as VectorCompatibility];
        if (someOrphaned) return [v.id, 'partial' as VectorCompatibility];
        return [v.id, 'compatible' as VectorCompatibility];
      })
    );
  }, [authoredVectors, inputFieldIds, outputFieldIds]);

  const someVectorsOrphaned = useMemo(
    () => Array.from(vectorCompatibilityMap.values()).some((c) => c === 'orphaned'),
    [vectorCompatibilityMap]
  );

  const vectorRows = useMemo(
    () =>
      authoredVectors.map((vector, index) => {
        const vecId = vector.id ?? String(index);
        // Selection: visually override pass/fail tint when this row is pinpointed by a failure click.
        const isSelected = selectedVectorId !== null && vecId === selectedVectorId;
        // Per-row pass/fail status derived from run results
        const rowStatus: 'pass' | 'fail' | null = (() => {
          if (outputFields.length === 0) return null;
          let anyFail = false;
          let anyResult = false;
          for (const field of outputFields) {
            const resultKey = `${vecId}::${normalizeFieldId(field.id)}`;
            const s = runResultByVecAndSignal.get(resultKey);
            if (s === 'fail') { anyFail = true; anyResult = true; }
            else if (s === 'pass') { anyResult = true; }
          }
          if (!anyResult) return null;
          return anyFail ? 'fail' : 'pass';
        })();

        const cells: React.ReactNode[] = [
          // Tick cell — highlight entire row identity via data-selected
          <span
            key={`tick-${vecId}`}
            className={`ide-verify-vector-tick-cell${isSelected ? ' is-row-selected' : ''}`}
            data-testid={`ide-verify-vector-tick-${vecId}`}
            data-vector-status={rowStatus ?? 'none'}
            onClick={() => setSelectedTick(vector.tick)}
            style={{ cursor: 'pointer' }}
            title={`Tick ${vector.tick} — click to highlight in waveform`}
          >
            {String(vector.tick)}
            {rowStatus === 'fail' && <span className="ide-verify-row-badge ide-verify-row-badge--fail" aria-label="fail">✗</span>}
            {rowStatus === 'pass' && <span className="ide-verify-row-badge ide-verify-row-badge--pass" aria-label="pass">✓</span>}
            {(() => {
              const compat = vectorCompatibilityMap.get(vector.id);
              if (compat === 'orphaned') return <span className="ide-verify-compat-badge ide-verify-compat-badge--orphaned" title="This vector references signals not in the current circuit">⚠</span>;
              if (compat === 'partial') return <span className="ide-verify-compat-badge ide-verify-compat-badge--partial" title="This vector partially matches the current circuit signals">~</span>;
              return null;
            })()}
          </span>,
          ...inputFields.map((field) => {
            const val = vector.inputs[field.id] ?? 0;
            return (
              <button
                key={`${vecId}-in-${field.id}`}
                type="button"
                className={`ide-verify-vector-cell-toggle${isSelected ? ' is-row-selected' : ''}`}
                onClick={() => handleToggleVectorCell(vecId, field.id)}
                data-testid={`ide-verify-cell-toggle-${vecId}-${field.id}`}
                title={`Toggle ${field.label} (currently ${val})`}
              >
                {String(val)}
              </button>
            );
          }),
          // Expected-output columns — toggle + pass/fail tinting from run results
          ...outputFields.map((field) => {
            const val = vector.expected[field.id] ?? 0;
            const resultKey = `${vecId}::${normalizeFieldId(field.id)}`;
            const resultStatus = runResultByVecAndSignal.get(resultKey) ?? null;
            // Selection wins over pass/fail tint (constraint 3).
            // Fail is obvious; pass is subtle (constraint 2).
            let cellClass = 'ide-verify-vector-cell-toggle ide-verify-vector-cell-expected';
            if (isSelected) {
              cellClass += ' is-row-selected';
            } else if (resultStatus === 'fail') {
              cellClass += ' is-result-fail';
            } else if (resultStatus === 'pass') {
              cellClass += ' is-result-pass';
            }
            return (
              <button
                key={`${vecId}-exp-${field.id}`}
                type="button"
                className={cellClass}
                onClick={() => handleToggleVectorExpected(vecId, field.id)}
                data-testid={`ide-verify-cell-expected-${vecId}-${field.id}`}
                title={`Expected ${field.label}: ${val}${resultStatus === 'fail' ? ' ✗ FAIL' : resultStatus === 'pass' ? ' ✓' : ''}`}
              >
                {String(val)}
              </button>
            );
          }),
        ];
        if (onPreviewVector) {
          cells.push(
            <button
              key={`preview-${vecId}`}
              className={`ide-verify-preview-btn${previewingVectorId === vecId ? ' is-active' : ''}`}
              title="Apply these inputs to the circuit simulation — then switch to Design to see gate states"
              onClick={() => {
                onPreviewVector(vector.inputs as Record<string, number>);
                setPreviewingVectorId(vecId);
              }}
              data-testid={`ide-verify-preview-${vecId}`}
            >
              ▶
            </button>
          );
        }
        // Per-row duplicate button
        cells.push(
          <button
            key={`dup-${vecId}`}
            type="button"
            className="ide-verify-vector-dup-btn"
            onClick={() => handleDuplicateVector(vecId)}
            data-testid={`ide-verify-vector-dup-${vecId}`}
            aria-label="Duplicate row"
            title="Duplicate this row at tick + 1"
          >
            ⎘
          </button>
        );
        if (onDeleteVector) {
          cells.push(
            <button
              key={`delete-${vecId}`}
              type="button"
              className="ide-verify-vector-delete-btn"
              onClick={() => onDeleteVector(vecId)}
              data-testid={`ide-verify-vector-delete-${vecId}`}
              aria-label="Delete vector"
              title="Delete this vector"
            >
              ✕
            </button>
          );
        }
        return cells;
      }),
    [
      authoredVectors, inputFields, outputFields, onPreviewVector, onDeleteVector,
      previewingVectorId, handleToggleVectorCell, handleToggleVectorExpected,
      handleDuplicateVector, selectedVectorId, runResultByVecAndSignal, vectorCompatibilityMap,
    ]
  );

  const inspectorVectorRows = vectorRows;

  const status: VerifyStatus = lastRun ? (lastRun.status === 'pass' ? 'pass' : 'fail') : 'idle';
  const hasResults = runRows.length > 0;

  const isRunStale =
    lastRun !== undefined &&
    lastRun.deterministicHash !== '' &&
    deterministicHash !== '' &&
    lastRun.deterministicHash !== deterministicHash;

  const activeScheduleContract = useMemo(
    () =>
      resolveActiveScheduleContract({
        deterministicHash,
        liveScheduleContract,
        lastRun,
      }),
    [deterministicHash, liveScheduleContract, lastRun]
  );
  const detectedClockPolicy = useMemo(
    () =>
      detectVerifyClockPolicy({
        circuit: circuitGraph ? { nodes: [...circuitGraph.nodes] } : undefined,
        ioRows:
          mappedSignals && mappedSignals.length > 0
            ? mappedSignals.map((signal) => ({
                id: signal.id,
                label: signal.label ?? signal.id,
                direction: signal.direction,
                pin: signal.pin,
                nodeId: signal.nodeId,
              }))
            : [
                ...inputFields.map((field) => ({
                  id: field.id,
                  label: field.label,
                  direction: 'in' as const,
                  pin: inputFieldSeed.find((entry) => entry.id === field.id)?.pin,
                  nodeId: inputFieldSeed.find((entry) => entry.id === field.id)?.nodeId,
                })),
                ...outputFields.map((field) => ({
                  id: field.id,
                  label: field.label,
                  direction: 'out' as const,
                  pin: outputFieldSeed.find((entry) => entry.id === field.id)?.pin,
                  nodeId: outputFieldSeed.find((entry) => entry.id === field.id)?.nodeId,
                })),
              ],
        scheduleContract: activeScheduleContract,
      }),
    [
      activeScheduleContract,
      circuitGraph,
      inputFieldSeed,
      inputFields,
      mappedSignals,
      outputFieldSeed,
      outputFields,
    ]
  );
  useEffect(() => {
    if (!detectedClockPolicy) return;
    setClockOverrideMode(detectedClockPolicy.overrideMode);
    setClockRunCycles(detectedClockPolicy.runCycles);
  }, [
    detectedClockPolicy?.boardAlias,
    detectedClockPolicy?.overrideMode,
    detectedClockPolicy?.runCycles,
    detectedClockPolicy?.signalId,
    detectedClockPolicy?.sourceType,
  ]);
  const effectiveClockPolicy = useMemo<VerifyClockPolicy | null>(() => {
    if (!detectedClockPolicy) return null;
    const autoRunEnabled =
      clockOverrideMode === 'auto' ? detectedClockPolicy.autoRunEnabled : false;
    return {
      ...detectedClockPolicy,
      overrideMode: clockOverrideMode,
      autoRunEnabled,
      executionModel:
        clockOverrideMode === 'auto'
          ? detectedClockPolicy.executionModel
          : 'manual',
      runCycles: Math.max(1, totalVectorCount, clockRunCycles, detectedClockPolicy.runCycles),
      resetBehavior:
        clockOverrideMode === 'auto'
          ? detectedClockPolicy.resetBehavior
          : detectedClockPolicy.resetSignalName
            ? 'custom'
            : 'none',
      manualWarning:
        clockOverrideMode === 'auto'
          ? detectedClockPolicy.manualWarning
          : detectedClockPolicy.manualWarning ??
            'Manual clock source — use this only if your hardware design really clocks from a switch or button.',
    };
  }, [clockOverrideMode, clockRunCycles, detectedClockPolicy, totalVectorCount]);
  const autoClockModeActive = Boolean(
    effectiveClockPolicy?.overrideMode === 'auto' && effectiveClockPolicy.autoRunEnabled
  );
  const autoExternalClockMode = Boolean(
    autoClockModeActive && effectiveClockPolicy?.executionModel === 'external-input-auto-toggle'
  );
  const stimulusPanelInputFields = useMemo(
    () => (autoExternalClockMode ? editableInputFields : stimulusInputFields),
    [autoExternalClockMode, editableInputFields, stimulusInputFields]
  );

  // Manual-event / lab-style timing: after each verify run, default to stepping one case at a time
  // (Prev/Next + snapshot grid). Other timing modes default step UI off; users can opt in via toggle.
  useEffect(() => {
    if (!lastRun || (lastRun.waveform?.length ?? 0) === 0) return;
    const timingMode =
      lastRun.scheduleContract?.timingMode ?? activeScheduleContract?.timingMode;
    if (timingMode === 'manual_event_driven_lab') {
      setIsStepMode(true);
    } else {
      setIsStepMode(false);
    }
  }, [
    lastRunWorkbenchKey,
    lastRun?.waveform?.length,
    lastRun?.scheduleContract?.timingMode,
    activeScheduleContract?.timingMode,
  ]);

  const effectiveTimingGuidance = useMemo(() => {
    if (timingGuidance) return timingGuidance;
    if (activeScheduleContract) return deriveTimingGuidance(activeScheduleContract);
    const runGuidance = deriveTimingGuidanceFromRun(lastRun);
    if (runGuidance.isSequential) return runGuidance;
    const fallbackSignal = Object.entries(liveSignalRoles ?? {}).find(([, role]) => role === 'clock')?.[0];
    if (fallbackSignal || verifyMode === 'sequential') {
      return createClockTimingGuidance(fallbackSignal);
    }
    return runGuidance;
  }, [activeScheduleContract, verifyMode, lastRun, liveSignalRoles, timingGuidance]);

  const truthRows = useMemo<TruthTableRow[]>(() => {
    return runRows.map((row) => ({
      tick: row.tick,
      signal: row.signal,
      expected: row.expected,
      actual: row.actual,
      isFail: row.status === 'fail',
    }));
  }, [runRows]);
  const isSequentialRun = Boolean(
    effectiveTimingGuidance.isSequential ||
      verifyMode === 'sequential' ||
      lastRun?.meta?.circuitKind === 'sequential' ||
      lastRun?.schedule === 'clocked_macro'
  );
  const signalRoleLookup = useMemo(
    () => normalizeSignalRoles({
      ...(liveSignalRoles ?? {}),
      ...(lastRun?.report.signalRoles ?? {}),
    }),
    [liveSignalRoles, lastRun?.report.signalRoles]
  );
  const clockSignalNames = useMemo(() => {
    const names = new Map<string, string>();
    const registerSignalName = (signalName: string | null | undefined) => {
      const trimmed = signalName?.trim();
      if (!trimmed || trimmed === INTERNAL_SIM_CLOCK_NAME) return;
      const normalized = normalizeFieldId(trimmed);
      if (!names.has(normalized)) {
        names.set(normalized, trimmed);
      }
    };

    registerSignalName(activeScheduleContract?.clockSignalName);
    registerSignalName(effectiveTimingGuidance.signalName);
    registerSignalName(lastRun?.meta.clockSignalName ?? undefined);

    for (const [key, role] of Object.entries(liveSignalRoles ?? {})) {
      if (role === 'clock') registerSignalName(key);
    }
    for (const [key, role] of Object.entries(lastRun?.report.signalRoles ?? {})) {
      if (role === 'clock') registerSignalName(key);
    }

    return Array.from(names.values());
  }, [
    activeScheduleContract?.clockSignalName,
    effectiveTimingGuidance.signalName,
    lastRun?.meta.clockSignalName,
    liveSignalRoles,
    lastRun?.report.signalRoles,
  ]);
  const clockSignals = useMemo(
    () => new Set(clockSignalNames.map((signalName) => normalizeFieldId(signalName))),
    [clockSignalNames]
  );
  const clockActivitySummary = useMemo(
    () => buildClockActivitySummary(effectiveNextRunVectors, clockSignalNames),
    [clockSignalNames, effectiveNextRunVectors]
  );

  const nextRunNeedsClockActivity = useMemo(() => {
    if (effectiveNextRunVectors.length === 0) return false;
    if (autoClockModeActive) return false;
    if (verifyMode === 'sequential' && clockSignals.size > 0) {
      if (effectiveTimingGuidance.kind === 'latch-control') {
        return !clockActivitySummary.hasTransition;
      }
      return !clockActivitySummary.hasRisingEdge;
    }
    return false;
  }, [
    autoClockModeActive,
    clockActivitySummary.hasRisingEdge,
    clockActivitySummary.hasTransition,
    clockSignals.size,
    effectiveNextRunVectors.length,
    effectiveTimingGuidance.kind,
    verifyMode,
  ]);
  const boardClockSignalLabel =
    boardClockInputField?.label ??
    boardClockInputField?.id ??
    activeScheduleContract?.clockSignalName ??
    clockSignalNames[0] ??
    'CLK';
  const sequentialGuidanceCopy = useMemo(() => {
    if (effectiveTimingGuidance.kind === 'latch-control') {
      const signalName = effectiveTimingGuidance.signalName ?? 'EN';
      return {
        introTitle: 'Latch behavior detected',
        introStep: `Include ${signalName} changes so you can see when the latch is transparent versus holding state`,
        missingActivity:
          `No latch-control activity detected in your vectors. Toggle ${signalName} to show when the latch opens versus holds state.`,
        noTraceHint: `No latch-control activity — ${signalName} may never have opened the latch during the run`,
      };
    }
    if (boardClockBinding) {
      if (autoClockModeActive) {
        return {
          introTitle: 'Basys3 board clock source',
          introStep:
            `${boardClockSignalLabel} is bound to the Basys3 100 MHz oscillator ${boardClockBinding.alias} on ${boardClockBinding.packagePin}. RedByte will auto-toggle this board clock during Verify.`,
          missingActivity:
            'Auto board clock mode is active. Use manual pulses only when your design intentionally clocks from a switch or button.',
          noTraceHint:
            `Auto board clock mode is active for ${boardClockBinding.alias}.`,
        };
      }
      return {
        introTitle: 'Basys3 board clock source',
        introStep:
          `${boardClockSignalLabel} is bound to the Basys3 100 MHz oscillator ${boardClockBinding.alias} on ${boardClockBinding.packagePin}. Verify models it as a board clock source, not a manual switch-style input lane.`,
        missingActivity:
          `No ${boardClockBinding.alias} clock activity is present in your next run. Insert a deterministic clock pattern so the sequential design advances on the board-backed clock source.`,
        noTraceHint:
          `No ${boardClockBinding.alias} activity detected — the simulated board clock never advanced the circuit during this run`,
      };
    }
    return {
      introTitle: 'Sequential circuit — author your test sequence',
      introStep: 'Each row represents one clock cycle. Edit the input values to match the bit sequence you want to test.',
      missingActivity:
        'No clock transitions found in your vectors. Add at least one rising edge on the clock signal so the circuit advances to the next state.',
      noTraceHint: 'No clock activity detected — the simulation may not have advanced past tick 0',
    };
  }, [autoClockModeActive, boardClockBinding, boardClockSignalLabel, effectiveTimingGuidance]);
  // Schema-change detection: show banner when inputFields or outputFields IDs change across renders
  const prevInputFieldIdsRef = useRef<string>('');
  const prevOutputFieldIdsRef = useRef<string>('');
  const [showSchemaChangeBanner, setShowSchemaChangeBanner] = useState(false);
  useEffect(() => {
    const currentInputIds = inputFields.map((f) => f.id).sort().join(',');
    const currentOutputIds = outputFields.map((f) => f.id).sort().join(',');
    const inputChanged = prevInputFieldIdsRef.current !== '' && prevInputFieldIdsRef.current !== currentInputIds;
    const outputChanged = prevOutputFieldIdsRef.current !== '' && prevOutputFieldIdsRef.current !== currentOutputIds;
    if (inputChanged || outputChanged) {
      setShowSchemaChangeBanner(true);
      setOrphanPreflight(false); // dismiss any stale preflight
    }
    prevInputFieldIdsRef.current = currentInputIds;
    prevOutputFieldIdsRef.current = currentOutputIds;
  }, [inputFields, outputFields]);
  // Dismiss schema banner on next run
  useEffect(() => {
    if (runState === 'running') setShowSchemaChangeBanner(false);
  }, [runState]);

  const selectedFailurePattern = useMemo(
    () =>
      deriveVerifyFailurePattern({
        totalRows: runRows.length,
        failCount: failingRows.length,
        selectedFailure: selectedFailureCase,
        selectedPeerFailCount: selectedFailurePeers.length,
        selectedSignalFailTickCount: selectedFailureCase
          ? failTicksBySignal.get(selectedFailureCase.signal)?.length ?? 0
          : 0,
        selectedSignalFirstFailTick: selectedFailureCase
          ? failTicksBySignal.get(selectedFailureCase.signal)?.[0] ?? null
          : null,
        firstFailureTick: firstFailTickFromRows,
        firstRunTick,
        isSequentialRun,
        hasResetSignalRole,
        tick0Meaning: lastRun?.meta.tick0Meaning ?? null,
        samplePoint: lastRun?.meta.samplePoint ?? null,
      }),
    [
      failTicksBySignal,
      failingRows.length,
      firstFailTickFromRows,
      firstRunTick,
      hasResetSignalRole,
      isSequentialRun,
      lastRun?.meta.samplePoint,
      lastRun?.meta.tick0Meaning,
      runRows.length,
      selectedFailureCase,
      selectedFailurePeers.length,
    ]
  );
  const orderedTraceInputs = useMemo(
    () =>
      buildTraceInputDescriptors(
        inputFields,
        lastRun?.report.inputsAtTick ?? {},
        signalRoleLookup
      ),
    [inputFields, lastRun?.report.inputsAtTick, signalRoleLookup]
  );
  const traceInputsByTick = useMemo<Record<number, TruthTableTraceInput[]>>(
    () => buildTraceInputsByTick(lastRun?.report.inputsAtTick ?? {}, orderedTraceInputs),
    [lastRun?.report.inputsAtTick, orderedTraceInputs]
  );
  const truthTableEmptyReason = useMemo(() => {
    if (!lastRun) return 'Run the current stimulus to populate tick-by-tick observed values and saved checks.';
    if (verifyPreflightIssues.length > 0) {
      return 'Verification is blocked by missing mapped or undriven outputs. Fix the listed issues, then run again.';
    }
    if (runRows.length > 0) return '';
    if (waveformTicks.length > 0) {
      return 'No saved checks were set for this run. Save output checks in the stimulus table, then run again.';
    }
    if (isSequentialRun) {
      return 'No evaluable rows yet. Add stimulus rows with saved checks for this sequential circuit.';
    }
    return 'No output rows were produced. Check that your stimulus rows include any saved checks you expect to evaluate, then run again.';
  }, [isSequentialRun, lastRun, runRows.length, verifyPreflightIssues.length, waveformTicks.length]);
  const firstFailureTick = firstFailure?.tick ?? lastRun?.firstFailingTick;
  const selectedFailureInputs = useMemo(() => {
    if (!selectedFailureCase) return null;
    const vectorInputSnapshot =
      selectedFailureEvidence?.vectorId
        ? lastRun?.report.inputsByVectorId?.[selectedFailureEvidence.vectorId]
        : undefined;
    if (vectorInputSnapshot) {
      const snapshot = orderedTraceInputs
        .map((field) => ({
          label: field.label,
          value: String(vectorInputSnapshot[field.key] ?? '-'),
        }))
        .filter((entry) => entry.value !== '-');
      if (snapshot.length > 0) return snapshot;
    }
    const traceInputs = traceInputsByTick[selectedFailureCase.tick];
    if (traceInputs && traceInputs.length > 0) {
      return traceInputs;
    }
    const vector =
      selectedFailureCase.vectorId
        ? authoredVectors.find((entry) => entry.id === selectedFailureCase.vectorId)
        : authoredVectors.find((entry) => entry.tick === selectedFailureCase.tick);
    const fallbackInputOrder =
      orderedTraceInputs.length > 0
        ? orderedTraceInputs
        : inputFields.map((field) => ({ key: normalizeFieldId(field.id), label: field.label }));
    const snapshot: Array<{ label: string; value: string }> = [];
    if (vector) {
      for (const field of fallbackInputOrder) {
        snapshot.push({
          label: field.label,
          value: String(vector.inputs[field.key] ?? vector.inputs[normalizeFieldId(field.label)] ?? '-'),
        });
      }
      return snapshot;
    }

    const waveformSample = lastRun?.waveform.find((sample) => sample.tick === selectedFailureCase.tick);
    if (!waveformSample) return null;
    for (const field of fallbackInputOrder) {
      const normalizedField = field.key;
      const signalEntry = Object.entries(waveformSample.signals).find(
        ([signal]) => normalizeFieldId(signal) === normalizedField
      );
      snapshot.push({ label: field.label, value: signalEntry?.[1] ?? '-' });
    }
    return snapshot;
  }, [
    authoredVectors,
    inputFields,
    lastRun?.report.inputsByVectorId,
    lastRun?.waveform,
    orderedTraceInputs,
    selectedFailureCase,
    selectedFailureEvidence?.vectorId,
    traceInputsByTick,
  ]);
  const selectedFailureExplanationCase = useMemo<VerifyFailureExplanationCase | null>(() => {
    if (!selectedFailureCase) return null;
    return {
      tick: selectedFailureCase.tick,
      signal: selectedFailureCase.signal,
      signalLabel: studentSelectedFailure?.signalLabel ?? selectedFailureCase.signal,
      expected: selectedFailureCase.expected,
      actual: selectedFailureCase.actual,
      vectorId: selectedFailureCase.vectorId,
      caseIndex: selectedFailureCase.caseIndex,
    };
  }, [selectedFailureCase, studentSelectedFailure?.signalLabel]);
  const selectedFailurePeerExplanationCases = useMemo<VerifyFailureExplanationCase[]>(
    () =>
      selectedFailurePeers.map((row) => ({
        tick: row.tick,
        signal: row.signal,
        signalLabel: getFailureSignalLabel(row),
        expected: row.expected,
        actual: row.actual,
        vectorId: row.vectorId,
        caseIndex: row.caseIndex,
      })),
    [getFailureSignalLabel, selectedFailurePeers]
  );
  const selectedFailureRowRepairTargets = useMemo<VerifyFailureExplanationCase[]>(() => {
    if (!selectedFailureExplanationCase) return [];
    return [selectedFailureExplanationCase, ...selectedFailurePeerExplanationCases].filter(
      isRepairableObservedFailure
    );
  }, [selectedFailureExplanationCase, selectedFailurePeerExplanationCases]);
  const allFailedRepairTargets = useMemo<VerifyFailureExplanationCase[]>(
    () =>
      failingRows
        .map((row) => ({
          tick: row.tick,
          signal: row.signal,
          signalLabel: getFailureSignalLabel(row),
          expected: row.expected,
          actual: row.actual,
          vectorId: row.vectorId,
          caseIndex: row.caseIndex,
        }))
        .filter(isRepairableObservedFailure),
    [failingRows, getFailureSignalLabel]
  );
  const selectedFailureClassification = useMemo(() => {
    if (!selectedFailureCase) return null;
    return classifyVerifyFailure({
      expected: selectedFailureCase.expected,
      actual: selectedFailureCase.actual,
      isSequential: isSequentialRun,
      clockingProtocol: lastRun?.meta.clockingProtocol ?? null,
      samplePoint: lastRun?.meta.samplePoint ?? null,
    });
  }, [
    isSequentialRun,
    lastRun?.meta.clockingProtocol,
    lastRun?.meta.samplePoint,
    selectedFailureCase,
  ]);
  const inputSignalKeys = useMemo(
    () => new Set(inputFields.map((field) => normalizeFieldId(field.id))),
    [inputFields]
  );
  const selectedDebugContext = useMemo<VerifyDebugContext | null>(() => {
    if (!selectedFailureCase) return null;

    return {
      signal: selectedFailureCase.signal,
      signalLabel: studentSelectedFailure?.signalLabel ?? selectedFailureCase.signal,
      tick: selectedFailureCase.tick,
      expected: selectedFailureCase.expected,
      actual: selectedFailureCase.actual,
      vectorId: selectedFailureCase.vectorId ?? null,
      caseIndex: selectedFailureCase.caseIndex ?? null,
      inputSnapshot: selectedFailureInputs ?? [],
      patternSummary: selectedFailurePattern?.summary ?? null,
      nextInspect: selectedFailurePattern?.nextInspect ?? null,
    };
  }, [selectedFailureCase, selectedFailureInputs, selectedFailurePattern, studentSelectedFailure?.signalLabel]);
  const outputSignalOrder = useMemo(() => {
    const ordered = new Map<string, string>();
    for (const signal of mappedSignals ?? []) {
      if (signal.direction !== 'out') continue;
      const key = normalizeFieldId(signal.id);
      const label = (signal.label ?? signal.id).trim() || signal.id;
      if (key && !ordered.has(key)) ordered.set(key, label);
    }
    if (ordered.size === 0) {
      for (const row of runRows) {
        const key = normalizeFieldId(row.signal);
        if (!key || inputSignalKeys.has(key) || ordered.has(key)) continue;
        ordered.set(key, row.signal);
      }
    }
    return Array.from(ordered.entries()).map(([, label]) => label);
  }, [mappedSignals, runRows, inputSignalKeys]);
  const runRowLookup = useMemo(() => {
    const lookup = new Map<string, typeof runRows[number]>();
    for (const row of runRows) {
      lookup.set(`${row.tick}|${normalizeFieldId(row.signal)}`, row);
    }
    return lookup;
  }, [runRows]);
  const combosUnavailableReason = useMemo(() => {
    if (!lastRun) return 'Run the current stimulus first to build combinational combinations.';
    if (isSequentialRun) {
      return 'Combinational combos unavailable for sequential behavior (clocked circuit).';
    }
    if (inputFields.length === 0) return 'No mapped input signals are available.';
    if (inputFields.length > 6) return 'Combinational combos support up to 6 inputs.';
    if (runRows.length === 0) return 'No verify rows were generated for this run.';
    if (outputSignalOrder.length === 0) return 'No output signals were found in verification results.';
    return null;
  }, [inputFields.length, isSequentialRun, lastRun, outputSignalOrder.length, runRows.length]);
  const comboRows = useMemo<TruthTableComboRow[]>(() => {
    if (combosUnavailableReason) return [];
    const comboMap = new Map<string, TruthTableComboRow>();
    const inputsInOrder = inputFields.map((field) => field.id);
    for (const vector of authoredVectors) {
      const bits = inputsInOrder.map((id) => String(vector.inputs[id] ?? 0)).join('');
      if (comboMap.has(bits)) continue;
      const outputs = outputSignalOrder.map((signal) => {
        const row = runRowLookup.get(`${vector.tick}|${normalizeFieldId(signal)}`);
        return {
          signal,
          value: row?.actual ?? '-',
          expected: row?.expected,
          isFail: row?.status === 'fail',
          failureCase:
            row?.status === 'fail'
              ? {
                  tick: row.tick,
                  signal: row.signal,
                  expected: row.expected,
                  actual: row.actual,
                }
              : undefined,
        };
      });
      const primaryFailure = outputs.find((entry) => entry.isFail)?.failureCase;
      comboMap.set(bits, {
        tick: vector.tick,
        inputBits: bits,
        primaryFailure,
        outputs,
      });
    }
    return Array.from(comboMap.values()).sort((left, right) => {
      const leftValue = Number.parseInt(left.inputBits || '0', 2);
      const rightValue = Number.parseInt(right.inputBits || '0', 2);
      if (leftValue !== rightValue) return leftValue - rightValue;
      return left.tick - right.tick;
    });
  }, [authoredVectors, combosUnavailableReason, inputFields, outputSignalOrder, runRowLookup]);
  const kmapUnavailableReason = useMemo(() => {
    if (combosUnavailableReason) return combosUnavailableReason;
    if (inputFields.length < 2) return 'K-map requires at least 2 mapped inputs.';
    if (inputFields.length > 6) return 'K-map supports up to 6 mapped inputs.';
    if (outputSignalOrder.length === 0) return 'No output signals available for K-map generation.';
    if (comboRows.length === 0) return 'No combinational rows available to populate K-map cells.';
    return null;
  }, [comboRows.length, combosUnavailableReason, inputFields.length, outputSignalOrder.length]);
  const kmapRows = useMemo<TruthTableKMap[]>(() => {
    if (kmapUnavailableReason) return [];
    const inputCount = inputFields.length;
    const rowBitCount = Math.floor(inputCount / 2);
    const colBitCount = inputCount - rowBitCount;
    const rowCodes = grayCodes(rowBitCount);
    const colCodes = grayCodes(colBitCount);
    const comboByBits = new Map(comboRows.map((row) => [row.inputBits, row]));
    return outputSignalOrder.map((outputSignal) => ({
      outputSignal,
      rowCodes,
      colCodes,
      rows: rowCodes.map((rowCode) => ({
        rowCode,
        cells: colCodes.map((colCode) => {
          const bits = `${rowCode}${colCode}`;
          const combo = comboByBits.get(bits);
          const output = combo?.outputs.find((entry) => entry.signal === outputSignal);
          return {
            bits,
            value: output?.value ?? '-',
            isFail: output?.isFail ?? false,
            failureCase: output?.failureCase,
          };
        }),
      })),
    }));
  }, [comboRows, inputFields.length, kmapUnavailableReason, outputSignalOrder]);
  const canExportTestbench = status === 'pass';

  // Auto-switch to Combos view when a combinational run completes and combos are available.
  // Only switches if the user is still on the default 'ticks' view (preserves manual choice).
  useEffect(() => {
    if (!lastRun || combosUnavailableReason !== null) return;
    setTruthTableMode((prev) => (prev === 'ticks' ? 'combos' : prev));
  }, [lastRunWorkbenchKey, combosUnavailableReason]);

  // Derive floating signal names from evidence failures for signal-specific hints
  const floatingSignals = useMemo(() => {
    const failures = lastRun?.evidence?.failures ?? [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const f of failures) {
      if (
        (f.actualReason === 'missing-output-sample' || f.actualReason === 'missing-output-node') &&
        !seen.has(f.signal)
      ) {
        seen.add(f.signal);
        result.push(f.signal);
      }
    }
    return result;
  }, [lastRun?.evidence?.failures]);

  // Build per-signal plain-language failure diagnosis for the main viewport
  const failureDiagnosis = useMemo(() => {
    if (status !== 'fail' || failingRows.length === 0) return [];
    const failures = lastRun?.evidence?.failures ?? [];

    // Map each signal to its worst-case reason
    const reasonMap = new Map<string, { reason: string; expected: string; actual: string }>();
    for (const f of failures) {
      const existing = reasonMap.get(f.signal);
      const isBetter =
        !existing ||
        (f.actualReason === 'missing-output-node' && existing.reason !== 'missing-output-node') ||
        (f.actualReason === 'missing-output-sample' && existing.reason === 'matched');
      if (isBetter) {
        reasonMap.set(f.signal, { reason: f.actualReason, expected: f.expected, actual: f.actual });
      }
    }

    // Walk failingRows in order to get stable, deduplicated signal list
    const seen = new Set<string>();
    const result: Array<{ signal: string; label: string; action: string }> = [];
    for (const row of failingRows) {
      if (seen.has(row.signal)) continue;
      seen.add(row.signal);

      const entry = reasonMap.get(row.signal);
      const reason = entry?.reason ?? 'matched';
      const expected = entry?.expected ?? row.expected;
      const actual = entry?.actual ?? row.actual;

      let label: string;
      let action: string;
      if (reason === 'missing-output-node') {
        label = `${row.signal} is not connected to a design node`;
        action = `On Project, open Map Pins and wire this output to a real node before trusting checks.`;
      } else if (reason === 'missing-output-sample') {
        label = `${row.signal} is floating — the simulator could not see a value`;
        action = `In Design, add a net so ${row.signal} is driven; then re-run.`;
      } else {
        label = `${row.signal} did not match — wanted ${expected}, saw ${actual}`;
        action = `On the chart below, follow this signal’s lane, then open Design to fix the path that drives it.`;
      }
      result.push({ signal: row.signal, label, action });
    }
    return result;
  }, [status, failingRows, lastRun?.evidence?.failures]);

  // Compute verify hint (only shown in FAIL state)
  const verifyHint = useMemo((): string | null => {
    if (status !== 'fail' || failingRows.length === 0) return null;
    const totalRows = runRows.length;
    const failCount = failingRows.length;
    const ctx: VerifyHintContext = {
      hasDff: isSequentialRun,
      mappingComplete,
      allTicksFail: totalRows > 0 && failCount === totalRows,
      onlyFirstTickFails:
        failCount === 1 && timelineTicks.length > 1
          ? failingRows[0].tick === timelineTicks[0]
          : failCount > 0 &&
            failingRows.every((r) => r.tick === failingRows[0].tick) &&
            failingRows[0].tick === timelineTicks[0] &&
            timelineTicks.length > 1,
      mismatch: selectedFailureCase
        ? { expected: selectedFailureCase.expected, actual: selectedFailureCase.actual }
        : null,
      hasFloatingOutputWarning,
      floatingSignals,
      vectorsAreAutoGenerated,
    };
    return getVerifyHint({ ...ctx, pattern: selectedFailurePattern });
  }, [
    status,
    failingRows,
    runRows.length,
    isSequentialRun,
    timelineTicks,
    mappingComplete,
    hasFloatingOutputWarning,
    floatingSignals,
    selectedFailureCase,
    selectedFailurePattern,
    vectorsAreAutoGenerated,
  ]);

  const buildDebugSignalsAtTick = useCallback((tick: number | null): Record<string, 0 | 1> | null => {
    if (tick === null || !lastRun) return null;
    const sample = lastRun.waveform.find((entry) => entry.tick === tick);
    if (!sample) return null;
    const signals: Record<string, 0 | 1> = {};
    for (const [signal, value] of Object.entries(sample.signals)) {
      if (value === '1') signals[signal] = 1;
      else if (value === '0') signals[signal] = 0;
    }
    return signals;
  }, [lastRun]);
  const syncSelectedSignalForHandoff = useCallback(() => {
    onSignalSelected?.(selectedSignal != null ? normalizeSignalKey(selectedSignal) : null);
  }, [onSignalSelected, selectedSignal]);
  const handleStimulusSelectedTickChange = useCallback((tick: number) => {
    setSelectedTick(tick);
  }, []);

  // Navigate to Design: inject selected-tick inputs into the runtime sim when available,
  // giving the student immediate propagation context for the observed stimulus.
  const handleGoToDesignFromVerify = useCallback(() => {
    syncSelectedSignalForHandoff();
    if (onDebugTickSelected && lastRun) {
      const tick = selectedTick ?? lastRun.firstFailingTick ?? lastRun.waveform?.[0]?.tick ?? null;
      if (tick !== null) {
        onDebugTickSelected(
          tick,
          buildDebugSignalsAtTick(tick) ?? {},
          selectedDebugContext && selectedDebugContext.tick === tick ? selectedDebugContext : null
        );
        return;
      }
    }
    if (onGoToDesignWithInputs && lastRun?.report.inputsAtTick) {
      const tick = selectedTick ?? lastRun.report.vectors?.[0]?.tick ?? 0;
      const inputs = lastRun.report.inputsAtTick[tick];
      if (inputs) {
        onGoToDesignWithInputs(inputs as Record<string, 0 | 1>);
        return;
      }
    }
    onGoToDesign?.();
  }, [buildDebugSignalsAtTick, lastRun, onDebugTickSelected, onGoToDesign, onGoToDesignWithInputs, selectedDebugContext, selectedTick, syncSelectedSignalForHandoff]);
  const handleInspectFailureInDesign = useCallback(
    (target: VerifyFailureTarget | VerifyRow | null) => {
      if (target) {
        applyFailureSelection(target);
        openFailureInDesign(target);
      }
      handleGoToDesignFromVerify();
    },
    [applyFailureSelection, handleGoToDesignFromVerify, openFailureInDesign]
  );
  const handleThreePanelFailureSelect = useCallback(
    (failureKey: string) => {
      const target = failingRows.find(
        (row) =>
          buildFailureCaseKey(row.tick, row.signal, row.vectorId, row.caseIndex) === failureKey
      );
      if (target) applyFailureSelection(target);
    },
    [applyFailureSelection, failingRows]
  );

  const handleJumpToFirstFailure = () => {
    if (firstFailureTick == null) return;
    if (firstFailure) {
      applyFailureSelection(firstFailure);
      return;
    }
    setSelectedTick(firstFailureTick);
  };

  // Phase 8.1: Fail Navigator derived state
  const failTicksSorted = useMemo(
    () => Array.from(new Set(failingRows.map((r) => r.tick))).sort((a, b) => a - b),
    [failingRows]
  );

  const currentFailIndex =
    selectedFailureCase ? failTicksSorted.indexOf(selectedFailureCase.tick) : -1;
  const selectedFailureDisplayLabel = selectedFailureLabel ?? selectedFailureCase?.signal ?? null;
  const selectedFailurePositionLabel =
    failTicksSorted.length > 0
      ? currentFailIndex >= 0
        ? `Fail ${currentFailIndex + 1} / ${failTicksSorted.length}`
        : `${failTicksSorted.length} fail tick${failTicksSorted.length !== 1 ? 's' : ''}`
      : null;
  const selectedFailureRepairCaseLabel =
    selectedFailureExplanationCase?.caseIndex !== undefined &&
    selectedFailureExplanationCase.caseIndex !== null
      ? `Case ${selectedFailureExplanationCase.caseIndex + 1}`
      : selectedFailureExplanationCase
        ? `Tick ${selectedFailureExplanationCase.tick}`
        : null;

  const goToPrevFail = () => {
    if (failTicksSorted.length === 0) return;
    const idx = currentFailIndex > 0 ? currentFailIndex - 1 : failTicksSorted.length - 1;
    selectFailureAtTick(failTicksSorted[idx], selectedFailureCase?.signal ?? firstFailure?.signal);
  };

  const goToNextFail = () => {
    if (failTicksSorted.length === 0) return;
    const idx = currentFailIndex < failTicksSorted.length - 1 ? currentFailIndex + 1 : 0;
    selectFailureAtTick(failTicksSorted[idx], selectedFailureCase?.signal ?? firstFailure?.signal);
  };

  // Phase A: Step-through all ticks (distinct from fail-only navigator)
  const stepIndex = selectedTick !== null ? allWaveformTicks.indexOf(selectedTick) : -1;
  const totalSteps = allWaveformTicks.length;
  const canStepThroughCases = Boolean(lastRun) && totalSteps > 1;
  const selectedCaseTickLabel =
    selectedTick !== null
      ? stepIndex >= 0
        ? `Case ${stepIndex + 1} \u00b7 t${selectedTick}`
        : `t${selectedTick}`
      : null;
  const selectedCasePositionLabel =
    selectedTick !== null && stepIndex >= 0
      ? `Case ${stepIndex + 1} / ${totalSteps} \u00b7 t${selectedTick}`
      : `${totalSteps} case${totalSteps === 1 ? '' : 's'}`;
  const selectedScopeCaseLabel =
    selectedTick !== null && stepIndex >= 0
      ? `Case ${stepIndex + 1} / ${totalSteps}`
      : `${totalSteps} case${totalSteps === 1 ? '' : 's'}`;

  const goToPrevStep = useCallback(() => {
    if (allWaveformTicks.length === 0) return;
    const idx = stepIndex > 0 ? stepIndex - 1 : allWaveformTicks.length - 1;
    setSelectedTick(allWaveformTicks[idx]);
  }, [allWaveformTicks, stepIndex]);

  const goToNextStep = useCallback(() => {
    if (allWaveformTicks.length === 0) return;
    const idx = stepIndex < allWaveformTicks.length - 1 ? stepIndex + 1 : 0;
    setSelectedTick(allWaveformTicks[idx]);
  }, [allWaveformTicks, stepIndex]);

  const stepSnapshotRows = useMemo((): VerifyTickSignalIndexEntry[] => {
    if (!isStepMode || selectedTick === null) return [];
    return tickIndex.rowsByTick[String(selectedTick)] ?? [];
  }, [isStepMode, selectedTick, tickIndex.rowsByTick]);

  const handleDebugInDesign = useCallback(() => {
    if (selectedTick === null || !onDebugTickSelected) return;
    syncSelectedSignalForHandoff();
    onDebugTickSelected(
      selectedTick,
      buildDebugSignalsAtTick(selectedTick) ?? {},
      selectedDebugContext && selectedDebugContext.tick === selectedTick ? selectedDebugContext : null
    );
  }, [buildDebugSignalsAtTick, onDebugTickSelected, selectedDebugContext, selectedTick, syncSelectedSignalForHandoff]);
  const focusMismatchLanes = () => {
    setShowAllSignals(false);
    setShowMismatchOnlySignals(true);
    if (selectedFailureCase?.signal) handleSignalSelect(selectedFailureCase.signal);
  };
  const clearMismatchLaneFilter = () => {
    setShowMismatchOnlySignals(false);
  };
  const setCursorFromSelected = (cursor: 'A' | 'B') => {
    if (selectedTick === null) return;
    if (cursor === 'A') setCursorA(selectedTick);
    else setCursorB(selectedTick);
  };
  const jumpToCursor = (cursor: 'A' | 'B') => {
    const target = cursor === 'A' ? cursorA : cursorB;
    if (target === null) return;
    setSelectedTick(target);
  };
  const clearCursors = () => {
    setCursorA(null);
    setCursorB(null);
  };
  const cursorDeltaTicks =
    cursorA !== null && cursorB !== null ? Math.abs(cursorB - cursorA) : null;

  // Phase 8.1: Zoomed tick window
  const focusedFailureTick = selectedFailureCase?.tick ?? firstFailureTick ?? null;
  const zoomedTicks = useMemo(() => {
    if (tickZoom === 'all' || allWaveformTicks.length === 0) return allWaveformTicks;
    if (tickZoom === 'fail') {
      return buildFailWindowTicks(allWaveformTicks, focusedFailureTick);
    }
    return buildSelectedWindowTicks(
      allWaveformTicks,
      tickWindowCenter ?? selectedTick ?? allWaveformTicks[0] ?? 0
    );
  }, [allWaveformTicks, focusedFailureTick, tickZoom, tickWindowCenter, selectedTick]);
  const runVectorCount = lastRun?.report.vectors?.length ?? effectiveNextRunVectors.length;
  const waveformWindowLabel = useMemo(
    () => formatTickWindowLabel(allWaveformTicks, zoomedTicks, tickZoom),
    [allWaveformTicks, tickZoom, zoomedTicks]
  );
  const waveformWindowReason = useMemo(
    () =>
      formatTickWindowReason({
        allTicks: allWaveformTicks,
        shownTicks: zoomedTicks,
        tickZoom,
        focusedFailureTick,
        selectedTick,
      }),
    [allWaveformTicks, focusedFailureTick, selectedTick, tickZoom, zoomedTicks]
  );
  const fitWaveformView = useCallback(() => {
    const container = waveformScrollRef.current;
    if (!container) return;
    setTickWidth(fitWaveformTickWidth(container.clientWidth, Math.max(zoomedTicks.length, 1)));
  }, [zoomedTicks.length]);
  const toggleLaneGroup = useCallback((group: SignalLaneGroup) => {
    setCollapsedGroups((previous) => ({ ...previous, [group]: !previous[group] }));
  }, []);
  const handleWaveformWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = waveformScrollRef.current;
    if (!container) return;
    if (event.shiftKey) {
      event.preventDefault();
      setTickWidth((previous) => clampTickWidth(previous + (event.deltaY > 0 ? -4 : 4)));
      return;
    }
    if (Math.abs(event.deltaY) > 0 || Math.abs(event.deltaX) > 0) {
      event.preventDefault();
      container.scrollLeft += Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    }
  }, []);
  useEffect(() => {
    const container = waveformScrollRef.current;
    if (!container) return;
    container.scrollTop = 0;
    container.scrollLeft = 0;
  }, [lastRunWorkbenchKey, displaySignalTimeline.length]);
  useEffect(() => {
    const container = waveformScrollRef.current;
    if (!container || selectedTick === null || zoomedTicks.length === 0) return;
    const selectedIndex = zoomedTicks.indexOf(selectedTick);
    if (selectedIndex < 0) return;
    const labelWidth = 140;
    const centerX = labelWidth + selectedIndex * tickWidth + tickWidth / 2;
    const targetLeft = Math.max(0, centerX - container.clientWidth / 2);
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
      return;
    }
    container.scrollLeft = targetLeft;
  }, [selectedTick, tickWidth, zoomedTicks]);
  const handleSignalHover = useCallback(
    (signal: string | null) => {
      setHoverBoardSignal(resolveLaneBoardSignal(signal));
    },
    [resolveLaneBoardSignal, setHoverBoardSignal]
  );
  const drawerTabs = useMemo<VerifyDrawerTab[]>(() => {
    // 3-tab model: Inspect | (Checks) | Details
    // Assertions only appears in verification mode (assertions active). Vectors/Truth/K-Map are
    // consolidated into Details so the drawer stays navigable at a glance.
    return nextRunUsesAssertions
      ? ['why', 'mismatches', 'details']
      : ['why', 'details'];
  }, [nextRunUsesAssertions]);
  useEffect(() => {
    if (!drawerTabs.includes(verifyTab)) {
      setVerifyTab(drawerTabs[0] ?? 'mismatches');
    }
  }, [drawerTabs, verifyTab]);

  // ─── Why inspector: signal explanation ───────────────────────────────────
  const normalizedCircuitGraph = useMemo<ExplainerCircuitGraph | undefined>(() => {
    if (!circuitGraph) return undefined;
    return {
      nodes: circuitGraph.nodes,
      connections: circuitGraph.connections.map((conn) => {
        const fromObj = typeof conn.from === 'string'
          ? { nodeId: conn.from, portName: conn.fromPin ?? conn.fromPort ?? 'out' }
          : { nodeId: conn.from.nodeId, portName: conn.from.portName ?? conn.from.port ?? conn.fromPin ?? conn.fromPort ?? 'out' };
        const toObj = typeof conn.to === 'string'
          ? { nodeId: conn.to, portName: conn.toPin ?? conn.toPort ?? 'in' }
          : { nodeId: conn.to.nodeId, portName: conn.to.portName ?? conn.to.port ?? conn.toPin ?? conn.toPort ?? 'in' };
        return { from: fromObj, to: toObj };
      }),
    };
  }, [circuitGraph]);

  const explainerSignalMappings = useMemo<ExplainerSignalMapping[]>(() => {
    return (mappedSignals ?? []).map((sig) => ({
      signalName: sig.label ?? sig.id,
      nodeId: sig.nodeId ?? sig.id,
      direction: sig.direction,
      pin: sig.pin,
    }));
  }, [mappedSignals]);

  const signalExplanation = useMemo(() => {
    if (selectedSignal === null || selectedTick === null || !lastRun) return null;
    const signalRoles = lastRun.report.signalRoles ?? {};
    return explainSignal({
      selectedSignal,
      tick: selectedTick,
      waveform: lastRun.waveform,
      signalRoles,
      signalMappings: explainerSignalMappings,
      circuitGraph: normalizedCircuitGraph,
      circuitKind: lastRun.meta?.circuitKind,
      clockSignalName: lastRun.meta?.clockSignalName,
    });
  }, [selectedSignal, selectedTick, lastRun, explainerSignalMappings, normalizedCircuitGraph]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        goToNextFail();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        goToPrevFail();
      } else if (event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        goToNextFail();
      } else if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        goToPrevFail();
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        fitWaveformView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitWaveformView, goToNextFail, goToPrevFail]);
  useEffect(() => {
    if (zoomedTicks.length === 0) return;
    if (tickWidth === DEFAULT_VERIFY_TICK_WIDTH || layoutMode === 'compact') {
      fitWaveformView();
    }
  }, [fitWaveformView, layoutMode, tickWidth, zoomedTicks.length]);
  useEffect(() => () => setHoverBoardSignal(null), [setHoverBoardSignal]);
  const runContextRows = useMemo(
    () =>
      lastRun
        ? [
            {
              label: 'Scenario',
              value: `${lastRun.scenarioName} (${runVectorCount} case${runVectorCount === 1 ? '' : 's'})`,
            },
            {
              label: 'Protocol',
              value: formatVerifyProtocol(lastRun),
            },
            {
              label: 'Sampling',
              value: formatVerifySampling(lastRun),
            },
            {
              label: 'Tick 0',
              value: formatVerifyTickZero(lastRun),
            },
            {
              label: 'Ticks shown',
              value: waveformWindowLabel,
            },
            {
              label: 'Why these ticks',
              value: waveformWindowReason,
            },
          ]
        : [],
    [lastRun, runVectorCount, waveformWindowLabel, waveformWindowReason]
  );

  useEffect(() => {
    if (!lastRun) return;
    if (!isRunStale && lastRun.status === 'fail' && firstFailureTick !== undefined) {
      setTickZoom('fail');
      setTickWindowCenter(firstFailureTick);
      return;
    }
    setTickZoom('all');
    setTickWindowCenter(null);
  }, [firstFailureTick, lastRunWorkbenchKey, lastRun?.status]);

  const isStarterScenario =
    scenarioAuthority === 'starter' || (projectKind === 'example' && Boolean(sourceExampleId));
  const hasStaleAuthoredReference = isRunStale && totalExpectedCaseCount > 0;
  const currentScenarioStimulusHash = computeVectorStimulusHash(authoredVectors);
  const lastRunReportVectors = lastRun?.report.vectors ?? [];
  const lastRunScenarioStimulusHash =
    lastRun === undefined
      ? null
      : lastRunReportVectors.length === authoredVectors.length
          ? computeVectorStimulusHash(lastRunReportVectors)
          : typeof lastRun.scenarioStimulusHash === 'string' && lastRun.scenarioStimulusHash.trim().length > 0
            ? lastRun.scenarioStimulusHash.trim()
          : null;
  const currentVectorReferenceSignature = useMemo(
    () => buildVectorReferenceSignature([...authoredVectors, ...customVectors]),
    [authoredVectors, customVectors]
  );
  const lastRunVectorReferenceSignature = useMemo(() => {
    if (!lastRun) return null;
    const lastRunVectors = lastRun.report.vectors ?? [];
    const currentVectorCount = authoredVectors.length + customVectors.length;
    if (lastRunVectors.length !== currentVectorCount) return null;
    return buildVectorReferenceSignature(lastRunVectors);
  }, [authoredVectors.length, customVectors.length, lastRun]);

  // Scenario-stale detection: same scenario, vectors edited since last run.
  // Condition: activeScenario hash differs from what was hashed at run time.
  const isScenarioStale =
    lastRun !== undefined &&
    activeScenario !== undefined &&
    activeScenario !== null &&
    lastRun.scenarioId === activeScenario.id &&
    typeof lastRunScenarioStimulusHash === 'string' &&
    typeof currentScenarioStimulusHash === 'string' &&
    lastRunScenarioStimulusHash !== currentScenarioStimulusHash;

  // Wrong-scenario detection: waveform belongs to a different scenario than the active one.
  const isWrongScenario =
    lastRun !== undefined &&
    activeScenario !== undefined &&
    activeScenario !== null &&
    lastRun.scenarioId !== activeScenario.id;
  const isTestbenchStale =
    lastRun !== undefined &&
    (isScenarioStale ||
      (lastRunVectorReferenceSignature !== null &&
        currentVectorReferenceSignature !== lastRunVectorReferenceSignature)) &&
    !isWrongScenario;

  // "Switch back" CTA: only if the scenario that produced the run still exists in the library.
  // Constraint: never show a broken switch-back button for a deleted scenario.
  const lastRunScenarioName =
    lastRun && isWrongScenario && scenarios
      ? (scenarios.find((s) => s.id === lastRun.scenarioId)?.name ?? null)
      : null;
  const lastRunScenarioId =
    lastRun && isWrongScenario && scenarios
      ? (scenarios.find((s) => s.id === lastRun.scenarioId)?.id ?? null)
      : null;

  // Derived display-state machine: replaces the ambiguous IDLE label
  // hasNoTrace fires only when the runtime ran with actual expectation rows
  // AND still produced no waveform data (broken circuit / no I/O mapping).
  // Does NOT fire for runs with empty expectations (rows=[]) — that is a user
  // authoring state (vectors added but no expected values set), not a broken circuit.
  const hasNoTrace = lastRun !== undefined && runRows.length > 0 && signalTimeline.length === 0;
  const lastRunKind = getRuntimeVerifyRunKind(lastRun);
  const isTraceOnly =
    lastRun !== undefined &&
    lastRunKind === 'trace' &&
    !hasNoTrace;
  /*
        ? 'Simulation complete — some outputs not yet mapped to board pins'
        : 'Simulation complete — all outputs match expectations'
      : displayStatus === 'FAIL'
        ? hasNoTrace
          ? 'Simulation complete — empty waveform recorded'
          : 'Simulation complete — some outputs differ from expectations'
        : displayStatus === 'STALE'
          ? `Circuit updated — results below are from build ${lastRun?.deterministicHash?.slice(0, 8) ?? 'previous'}`
          : displayStatus === 'RUNNING'
            ? 'Running simulation…'
            : displayStatus === 'TRACE'
              ? 'Simulation complete — waveform recorded, no expectations set'
              : displayStatus === 'BLOCKED'
                ? 'Add test vectors to run the simulation'
                : 'Ready — vectors loaded, click Run to see the waveform';

  */
  const vectorSourceLabel =
    totalVectorCount === 0
      ? 'No test vectors saved yet'
      : hasStaleAuthoredReference
        ? `Stale ${isStarterScenario ? 'starter' : 'authored'} test vectors (${totalVectorCount} vector${totalVectorCount === 1 ? '' : 's'}) — circuit has changed since these were written`
      : totalExpectedCaseCount === 0
        ? 'Stimulus only — no saved checks yet'
        : !nextRunUsesAssertions
          ? `Saved checks available (${totalVectorCount} vector${totalVectorCount === 1 ? '' : 's'}), current run mode is observation`
        : authoredVectors.length > 0 && customVectorCount > 0
          ? `Saved checks armed from project + custom cases (${totalVectorCount} total)`
          : customVectorCount > 0
            ? `Saved checks armed from custom cases (${customVectorCount})`
            : `Saved checks armed from project cases (${authoredVectors.length})`;
  const verifyScenarioName =
    totalExpectedCaseCount === 0
      ? 'Stimulus Trace'
      : authoredVectors.length > 0 && customVectorCount > 0
        ? 'Project + Custom Vectors'
        : customVectorCount > 0
          ? 'Custom Vectors'
          : 'Project Vectors';
  const verifyReferenceNote =
    totalVectorCount === 0
      ? 'Author vectors to define the input stimulus for this run.'
      : hasStaleAuthoredReference
        ? nextRunUsesAssertions
          ? 'Older saved checks are still loaded for the next checked run.'
          : 'Older saved checks are available, but the next run defaults to live observation.'
      : totalExpectedCaseCount === 0
        ? 'Blank output cells stay observational until you save checks.'
        : !nextRunUsesAssertions
          ? 'Saved checks are available, but this run stays in observation mode.'
          : 'Only cells with saved checks are evaluated during a checked run.';
  const buildAllVectors = useCallback(
    (): TestVector[] =>
      [...authoredVectors, ...customVectors].map((vector) => ({
        id: vector.id,
        tick: vector.tick,
        inputs: { ...(vector.inputs ?? {}) },
        expected: { ...(vector.expected ?? {}) },
      })),
    [authoredVectors, customVectors]
  );

  const runVerificationWithMode = useCallback(
    (useAssertionsForNextRun: boolean) => {
      setRunState('running');
      const allVectors = buildAllVectors();
      const rows = useAssertionsForNextRun
        ? allVectors.flatMap((vector) =>
            Object.entries(vector.expected).map(([signal, expected]) => ({
              tick: vector.tick,
              signal,
              expected: String(expected),
              actual: '0',
            }))
          )
        : [];
      onRunVerification?.({
        scenarioId: activeScenario?.id ?? `verify-${normalizeFieldId(verifyScenarioName)}-${deterministicHash.slice(0, 8)}`,
        scenarioName: activeScenario?.name ?? verifyScenarioName,
        runKind: useAssertionsForNextRun ? 'verify' : 'trace',
        scenarioVersion: activeScenario?.version,
        scenarioContentHash: activeScenario ? computeScenarioContentHash(activeScenario) : undefined,
        scenarioStimulusHash: computeVectorStimulusHash(allVectors),
        deterministicHash,
        assertionMode: useAssertionsForNextRun,
        vectors: allVectors,
        clockPolicy: effectiveClockPolicy,
        rows,
      });
    },
    [
      activeScenario,
      buildAllVectors,
      deterministicHash,
      effectiveClockPolicy,
      onRunVerification,
      verifyScenarioName,
    ]
  );

  const handleRunWithPreflight = useCallback(
    (useAssertionsForNextRun: boolean = nextRunUsesAssertions) => {
      if (someVectorsOrphaned && useAssertionsForNextRun) {
        setOrphanPreflight(true);
        return;
      }
      runVerificationWithMode(useAssertionsForNextRun);
    },
    [nextRunUsesAssertions, runVerificationWithMode, someVectorsOrphaned]
  );

  const runVerification = useCallback(() => {
    handleRunWithPreflight(nextRunUsesAssertions);
  }, [nextRunUsesAssertions, handleRunWithPreflight]);

  const handleSetObserveMode = useCallback(() => {
    runModeTouchedByStudentRef.current = true;
    setNextRunUsesAssertions(false);
  }, []);

  const handleSetCompareMode = useCallback(() => {
    runModeTouchedByStudentRef.current = true;
    setNextRunUsesAssertions(true);
  }, []);

  const handleKeepOlderReference = useCallback(() => {
    setNextRunUsesAssertions(true);
    handleRunWithPreflight(true);
  }, [handleRunWithPreflight]);

  const handleResetToStimulusOnly = useCallback(() => {
    const resetProjectVectors = authoredVectors.map((vector) => ({
      ...vector,
      expected: {},
    }));
    const resetCustomVectors = customVectors.map((vector) => ({
      ...vector,
      expected: {},
    }));
    onVectorsChange?.(resetProjectVectors);
    onCustomVectorsChange?.(resetCustomVectors);
    setNextRunUsesAssertions(false);
    setOracleApplied(false);
  }, [authoredVectors, customVectors, onCustomVectorsChange, onVectorsChange]);
  const canResetToStimulusOnly =
    hasStaleAuthoredReference &&
    (onVectorsChange !== undefined || onCustomVectorsChange !== undefined);

  const clearResults = () => {
    onClearVerification?.();
    setRunState('idle');
    setOracleApplied(false);
  };

  const handleAddVector = () => {
    const tick = Number.isFinite(draftTick) ? Math.max(0, Math.floor(draftTick)) : authoredVectors.length;
    const nextVector: VerifyAuthorVector = {
      id: `vec-${String(authoredVectors.length + 1).padStart(2, '0')}`,
      tick,
      inputs: editableInputFields.reduce<Record<string, 0 | 1>>((acc, field) => {
        acc[field.id] = draftInputs[field.id] === '1' ? 1 : 0;
        return acc;
      }, {}),
      expected: buildExpectedRecord(outputFields, draftExpected),
    };
    const nextVectors = [...authoredVectors, nextVector].sort((left, right) => left.tick - right.tick);
    onVectorsChange?.(nextVectors);
    // Carry-forward: advance tick and preserve inputs + expected from the just-added vector
    setDraftTick(nextVector.tick + 1);
    setDraftInputs(
      editableInputFields.reduce<Record<string, '0' | '1'>>((acc, field) => {
        acc[field.id] = nextVector.inputs[field.id] === 1 ? '1' : '0';
        return acc;
      }, {})
    );
    setDraftExpected(expectedRecordToDraftState(nextVector.expected, outputFields));
    setOracleApplied(false);
  };

  // ─── Hold × N ────────────────────────────────────────────────────────────
  // Appends N copies of the current draft state at consecutive ticks.
  // After insertion, draft advances to the tick after the last held row.
  const handleHoldN = useCallback(
    (n: number) => {
      const clampedN = Math.max(1, Math.min(64, n));
      const startTick = Number.isFinite(draftTick) ? Math.max(0, Math.floor(draftTick)) : authoredVectors.length;
      const newRows: VerifyAuthorVector[] = Array.from({ length: clampedN }, (_, i) => ({
        id: `vec-h${String(Date.now() + i).slice(-6)}`,
        tick: startTick + i,
        inputs: editableInputFields.reduce<Record<string, 0 | 1>>((acc, f) => {
          acc[f.id] = draftInputs[f.id] === '1' ? 1 : 0;
          return acc;
        }, {}),
        expected: buildExpectedRecord(outputFields, draftExpected),
      }));
      const nextVectors = [...authoredVectors, ...newRows].sort((a, b) => a.tick - b.tick);
      onVectorsChange?.(nextVectors);
      // Advance draft to next tick after the inserted block; preserve values
      setDraftTick(startTick + clampedN);
      setOracleApplied(false);
    },
    [authoredVectors, draftTick, draftInputs, draftExpected, editableInputFields, outputFields, onVectorsChange]
  );

  // ─── Pulse ───────────────────────────────────────────────────────────────
  // Inserts two rows: selected signal HIGH at draftTick, LOW at draftTick+1.
  // All other signals carry forward from current draft values.
  const handlePulse = useCallback(
    (signalId: string) => {
      const startTick = Number.isFinite(draftTick) ? Math.max(0, Math.floor(draftTick)) : authoredVectors.length;
      const baseInputs = editableInputFields.reduce<Record<string, 0 | 1>>((acc, f) => {
        acc[f.id] = draftInputs[f.id] === '1' ? 1 : 0;
        return acc;
      }, {});
      const baseExpected = buildExpectedRecord(outputFields, draftExpected);
      const rowHigh: VerifyAuthorVector = {
        id: `vec-p${String(Date.now()).slice(-6)}h`,
        tick: startTick,
        inputs: { ...baseInputs, [signalId]: 1 },
        expected: { ...baseExpected },
      };
      const rowLow: VerifyAuthorVector = {
        id: `vec-p${String(Date.now() + 1).slice(-6)}l`,
        tick: startTick + 1,
        inputs: { ...baseInputs, [signalId]: 0 },
        expected: { ...baseExpected },
      };
      const nextVectors = [...authoredVectors, rowHigh, rowLow].sort((a, b) => a.tick - b.tick);
      onVectorsChange?.(nextVectors);
      setDraftTick(startTick + 2);
      setOracleApplied(false);
    },
    [authoredVectors, draftTick, draftInputs, draftExpected, editableInputFields, outputFields, onVectorsChange]
  );

  const appendClockPattern = useCallback(
    (pattern: StimulusClockPattern) => {
      const clkKey = clockSignalNames[0];
      if (!clkKey) return;

      const sortedVectors = [...authoredVectors].sort((left, right) => left.tick - right.tick);
      const lastVector = sortedVectors.at(-1);
      const startTick = lastVector ? lastVector.tick + 1 : 0;
      const baseInputs = editableInputFields.reduce<Record<string, 0 | 1>>((acc, field) => {
        const lastValue = lastVector?.inputs?.[field.id];
        acc[field.id] = lastValue === 1 ? 1 : 0;
        return acc;
      }, {});
      const lastClockValue = normalizeBit(lastVector?.inputs?.[clkKey] ?? 0);
      const appendedValues: Array<0 | 1> =
        pattern === 'pulse'
          ? [0, 1, 0]
          : pattern === 'hold-low'
            ? Array.from({ length: clockPatternCount }, () => 0 as const)
            : pattern === 'hold-high'
              ? Array.from({ length: clockPatternCount }, () => 1 as const)
              : Array.from({ length: clockPatternCount }, (_, index) =>
                  (
                    lastVector
                      ? ((lastClockValue + index + 1) % 2 === 1 ? 1 : 0)
                      : index % 2 === 0
                        ? 0
                        : 1
                  ) as 0 | 1
                );

      const nextVectors = [
        ...sortedVectors,
        ...appendedValues.map((value, index) => ({
          id: `vec-clk-${String(startTick + index).padStart(2, '0')}`,
          tick: startTick + index,
          inputs: { ...baseInputs, [clkKey]: value },
          expected: {},
        })),
      ];
      onVectorsChange?.(nextVectors);
      setOracleApplied(false);
    },
    [authoredVectors, clockPatternCount, clockSignalNames, editableInputFields, onVectorsChange]
  );
  const clockLaneField = useMemo(() => {
    if (autoExternalClockMode) return null;
    const candidateNames =
      effectiveTimingGuidance.kind === 'latch-control'
        ? [effectiveTimingGuidance.signalName ?? '']
        : clockSignalNames;

    return (
      stimulusPanelInputFields.find((field) =>
        candidateNames.some(
          (candidate) =>
            normalizeFieldId(candidate) === normalizeFieldId(field.id) ||
            normalizeFieldId(candidate) === normalizeFieldId(field.label)
        )
      ) ?? null
    );
  }, [autoExternalClockMode, clockSignalNames, effectiveTimingGuidance, stimulusPanelInputFields]);
  const clockLaneConfig = useMemo(
    () =>
      clockLaneField
        ? {
            fieldId: clockLaneField.id,
            badge:
              effectiveTimingGuidance.kind === 'latch-control'
                ? 'Latch control'
                : boardClockBinding
                  ? 'Board clock'
                  : 'Clock',
            detail:
              effectiveTimingGuidance.kind === 'latch-control'
                ? 'Toggle transparency directly in this lane.'
                : boardClockBinding
                  ? `${boardClockBinding.alias} • ${boardClockBinding.packagePin}`
                  : 'Add a rising edge directly in this lane.',
            count: clockPatternCount,
            onCountChange: setClockPatternCount,
            onApplyPattern: appendClockPattern,
          }
        : undefined,
    [
      appendClockPattern,
      boardClockBinding,
      clockLaneField,
      clockPatternCount,
      effectiveTimingGuidance.kind,
    ]
  );

  const handleGenerateBasicVectors = () => {
    if (onGenerateBasicVectors) {
      onGenerateBasicVectors();
      setOracleApplied(false);
      return;
    }
    if (editableInputFields.length === 0) {
      onVectorsChange?.([{ id: 'vec-01', tick: 0, inputs: {}, expected: {} }]);
      setDraftTick(1);
      setOracleApplied(false);
      return;
    }
    const templateFields = editableInputFields;
    // tick 0: all inputs 0
    // tick 1..N: one-hot — only field[i] = 1
    // tick N+1: all inputs 1
    const allZero = templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
      acc[field.id] = 0;
      return acc;
    }, {});
    const allOne = templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
      acc[field.id] = 1;
      return acc;
    }, {});
    const vectors: VerifyAuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: allZero, expected: {} },
      ...templateFields.map((hotField, hotIndex) => ({
        id: `vec-${String(hotIndex + 2).padStart(2, '0')}`,
        tick: hotIndex + 1,
        inputs: templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
          acc[field.id] = field.id === hotField.id ? 1 : 0;
          return acc;
        }, {}),
        expected: {} as Record<string, 0 | 1>,
      })),
      { id: `vec-${String(templateFields.length + 2).padStart(2, '0')}`, tick: templateFields.length + 1, inputs: allOne, expected: {} },
    ];
    onVectorsChange?.(vectors);
    setDraftTick(templateFields.length + 2);
    setOracleApplied(false);
  };
  const isFirstRunState = status === 'idle' && runState !== 'complete';
  const handleAutoGenerateVectors = useCallback(() => {
    const n = editableInputFields.length;
    if (n === 0 || n > 6) return;
    const total = 1 << n;
    const newVectors: VerifyAuthorVector[] = [];
    for (let combo = 0; combo < total; combo++) {
      const inputs: Record<string, 0 | 1> = {};
      editableInputFields.forEach((field, i) => {
        inputs[field.id] = ((combo >> (n - 1 - i)) & 1) as 0 | 1;
      });
      const comboKey = editableInputFields.map((f) => inputs[f.id]).join('');
      const alreadyExists = authoredVectors.some(
        (v) => editableInputFields.map((f) => (v.inputs[f.id] ?? 0)).join('') === comboKey
      );
      if (!alreadyExists) {
        const nextIndex = authoredVectors.length + newVectors.length + 1;
        newVectors.push({
          id: `vec-${String(nextIndex).padStart(2, '0')}`,
          tick: authoredVectors.length + newVectors.length,
          inputs,
          expected: {},
        });
      }
    }
    if (newVectors.length > 0) {
      const nextVectors = [...authoredVectors, ...newVectors].sort(
        (left, right) => left.tick - right.tick
      );
      onVectorsChange?.(nextVectors);
      setDraftTick(nextVectors[nextVectors.length - 1].tick + 1);
      setOracleApplied(false);
    }
  }, [editableInputFields, authoredVectors, onVectorsChange]);

  const handleGenerateSweepVectors = () => {
    if (editableInputFields.length === 0) {
      onVectorsChange?.([{ id: 'vec-01', tick: 0, inputs: {}, expected: {} }]);
      setDraftTick(1);
      setOracleApplied(false);
      return;
    }
    const templateFields = editableInputFields;
    const hold = Math.max(1, Math.min(64, Math.floor(sweepHoldTicks || 1)));
    const seed = parseSeed(sweepSeed);
    const vectors: VerifyAuthorVector[] = [];
    let nextTick = 0;
    const pushTick = (inputs: Record<string, 0 | 1>) => {
      for (let index = 0; index < hold; index += 1) {
        vectors.push({
          id: `vec-${String(vectors.length + 1).padStart(2, '0')}`,
          tick: nextTick,
          inputs: { ...inputs },
          expected: {},
        });
        nextTick += 1;
      }
    };
    const zeroInputs = templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
      acc[field.id] = 0;
      return acc;
    }, {});

    if (sweepPreset === 'binary-count') {
      const swFields = templateFields
        .filter((field) => /^sw\d+$/i.test(field.id))
        .sort((left, right) => {
          const leftN = Number.parseInt(left.id.replace(/[^0-9]/g, ''), 10);
          const rightN = Number.parseInt(right.id.replace(/[^0-9]/g, ''), 10);
          return leftN - rightN;
        });
      const countFields = (swFields.length > 0 ? swFields : templateFields).slice(0, Math.min(4, templateFields.length));
      const width = countFields.length;
      const total = Math.max(1, 1 << width);
      for (let count = 0; count < total; count += 1) {
        const value = (count + seed) % total;
        const inputs = { ...zeroInputs };
        for (let bit = 0; bit < width; bit += 1) {
          inputs[countFields[bit].id] = ((value >> bit) & 1) === 1 ? 1 : 0;
        }
        pushTick(inputs);
      }
    } else if (sweepPreset === 'toggle-sw0') {
      const target =
        templateFields.find((field) => normalizeFieldId(field.id) === 'sw0') ??
        templateFields[0];
      const phase = seed % 2;
      for (let step = 0; step < 16; step += 1) {
        const inputs = { ...zeroInputs };
        inputs[target.id] = ((step + phase) % 2) === 0 ? 0 : 1;
        pushTick(inputs);
      }
    } else {
      const start = templateFields.length > 0 ? seed % templateFields.length : 0;
      pushTick({ ...zeroInputs });
      for (let hot = 0; hot < templateFields.length; hot += 1) {
        const inputs = { ...zeroInputs };
        const field = templateFields[(hot + start) % templateFields.length];
        inputs[field.id] = 1;
        pushTick(inputs);
      }
    }

    onVectorsChange?.(vectors);
    setDraftTick(vectors.length);
    setOracleApplied(false);
  };

  const commitVectorCollections = useCallback(
    (result: CaptureApplicationResult): boolean => {
      if (!result.changed) return false;
      onVectorsChange?.(result.projectVectors);
      onCustomVectorsChange?.(result.customVectors);
      if (result.capturedAnyExpected) {
        setNextRunUsesAssertions(true);
      }
      setOracleApplied(result.capturedAnyExpected);
      return true;
    },
    [onCustomVectorsChange, onVectorsChange]
  );

  const applyScopedCapture = useCallback(
    (scope: CaptureScope): boolean => {
      if ((lastRun?.waveform?.length ?? 0) === 0 || !captureContext) return false;
      const result = applyCaptureScopeToVectorSets({
        projectVectors: authoredVectors,
        customVectors,
        context: captureContext,
        scope,
      });
      const changed = commitVectorCollections(result);
      if (changed && scope.rerunCompare) {
        setPendingAssertionRun(true);
      }
      return changed;
    },
    [authoredVectors, captureContext, commitVectorCollections, customVectors, lastRun?.waveform?.length]
  );

  const applyExpectedCellValue = useCallback(
    (input: {
      tick: number;
      signal: string;
      vectorId?: string;
      nextValue: 0 | 1 | null;
      rerunCompare?: boolean;
    }): boolean => {
      const result = updateExpectedCellInVectorSets({
        projectVectors: authoredVectors,
        customVectors,
        tick: input.tick,
        signal: input.signal,
        vectorId: input.vectorId,
        nextValue: input.nextValue,
      });
      const changed = commitVectorCollections(result);
      if (changed && input.rerunCompare) {
        setPendingAssertionRun(true);
      }
      return changed;
    },
    [authoredVectors, commitVectorCollections, customVectors]
  );

  const applyObservedFailures = useCallback(
    (failures: VerifyFailureExplanationCase[]): boolean => {
      let nextProjectVectors = authoredVectors;
      let nextCustomVectors = customVectors;
      let changed = false;

      for (const failure of failures) {
        if (!isRepairableObservedFailure(failure)) continue;
        const result = updateExpectedCellInVectorSets({
          projectVectors: nextProjectVectors,
          customVectors: nextCustomVectors,
          tick: failure.tick,
          signal: failure.signal,
          vectorId: failure.vectorId,
          nextValue: failure.actual === '1' ? 1 : 0,
        });
        nextProjectVectors = result.projectVectors;
        nextCustomVectors = result.customVectors;
        changed = changed || result.changed;
      }

      if (!changed) return false;
      onVectorsChange?.(nextProjectVectors);
      onCustomVectorsChange?.(nextCustomVectors);
      setNextRunUsesAssertions(true);
      setOracleApplied(false);
      return true;
    },
    [authoredVectors, customVectors, onCustomVectorsChange, onVectorsChange]
  );

  const queueScopedCapture = useCallback(
    (scope: CaptureScope) => {
      if ((lastRun?.waveform?.length ?? 0) === 0) return;
      setPendingCaptureScope({
        ...scope,
        awaitNextRunKey: lastRun === undefined ? null : lastRunWorkbenchKey,
      });
      runVerificationWithMode(false);
    },
    [lastRun, lastRunWorkbenchKey, runVerificationWithMode]
  );

  const buildDefaultCaptureScope = useCallback(
    (rerunCompare = false): CaptureScope => ({
      kind: totalExpectedCaseCount > 0 ? 'all-asserted' : 'all-visible-outputs',
      rerunCompare,
    }),
    [totalExpectedCaseCount]
  );

  const handleSetOracleExpected = useCallback(() => {
    applyScopedCapture(buildDefaultCaptureScope(false));
  }, [applyScopedCapture, buildDefaultCaptureScope]);

  const handleStaleRecapture = useCallback(() => {
    if (!isRunStale) return;
    queueScopedCapture(buildDefaultCaptureScope(true));
  }, [buildDefaultCaptureScope, isRunStale, queueScopedCapture]);

  const handleFailureAcceptObserved = useCallback(
    (failure: VerifyFailureExplanationCase) => {
      applyObservedFailures([failure]);
    },
    [applyObservedFailures]
  );

  const handleFailureAcceptObservedRow = useCallback(() => {
    applyObservedFailures(selectedFailureRowRepairTargets);
  }, [applyObservedFailures, selectedFailureRowRepairTargets]);

  const handleFailureAcceptObservedAll = useCallback(() => {
    applyObservedFailures(allFailedRepairTargets);
  }, [allFailedRepairTargets, applyObservedFailures]
  );

  const handleFailureCaptureRow = useCallback(
    (failure: VerifyFailureExplanationCase) => {
      applyScopedCapture({
        kind: 'row',
        tick: failure.tick,
        vectorId: failure.vectorId,
      });
    },
    [applyScopedCapture]
  );

  const handleFailureCaptureSignal = useCallback(
    (failure: VerifyFailureExplanationCase) => {
      applyScopedCapture({
        kind: 'signal',
        signal: failure.signal,
      });
    },
    [applyScopedCapture]
  );

  const handleFailureSetExpectedBit = useCallback(
    (failure: VerifyFailureExplanationCase, nextValue: 0 | 1) => {
      applyExpectedCellValue({
        tick: failure.tick,
        signal: failure.signal,
        vectorId: failure.vectorId,
        nextValue,
      });
    },
    [applyExpectedCellValue]
  );

  const handleFailureClearExpected = useCallback(
    (failure: VerifyFailureExplanationCase) => {
      applyExpectedCellValue({
        tick: failure.tick,
        signal: failure.signal,
        vectorId: failure.vectorId,
        nextValue: null,
      });
    },
    [applyExpectedCellValue]
  );

  useEffect(() => {
    if (!pendingCaptureScope || !lastRun) return;
    if (
      pendingCaptureScope.awaitNextRunKey &&
      lastRunWorkbenchKey === pendingCaptureScope.awaitNextRunKey
    ) {
      return;
    }
    setPendingCaptureScope(null);
    applyScopedCapture({
      kind: pendingCaptureScope.kind,
      tick: pendingCaptureScope.tick,
      signal: pendingCaptureScope.signal,
      vectorId: pendingCaptureScope.vectorId,
      rerunCompare: pendingCaptureScope.rerunCompare,
    });
  }, [applyScopedCapture, lastRun, lastRunWorkbenchKey, pendingCaptureScope]);

  useEffect(() => {
    if (!pendingAssertionRun) return;
    setPendingAssertionRun(false);
    handleRunWithPreflight(true);
  }, [handleRunWithPreflight, pendingAssertionRun]);

  const canSetOracle =
    (lastRun?.waveform?.length ?? 0) > 0 &&
    ((authoredVectors.length > 0 && onVectorsChange !== undefined) ||
      (customVectors.length > 0 && onCustomVectorsChange !== undefined));
  // ── PRE-RUN SIGNAL INVENTORY ────────────────────────────────────────────────
  // Computed from the next-run vector authority (project + custom) plus live signal metadata.
  // Must NOT be derived from run results (waveform, report, status).
  // This is the contract surface that VerifySurface exposes before any run happens.
  const signalInventory = useMemo((): VerifyPreRunInventory | undefined => {
    const vectors = effectiveNextRunVectors;
    if (vectors.length === 0) return undefined;

    const roles = normalizeSignalRoles(liveSignalRoles ?? {});
    const inputLaneLabels = new Map<string, string>();
    const outputLaneLabels = new Map<string, string>();
    const assertedOutputs = new Set<string>();
    let totalAssertionCount = 0;

    const preferredLabelForField = (
      fields: Array<{ id: string; label?: string }>,
      key: string
    ): string | undefined => {
      const normalizedKey = normalizeFieldId(key);
      return fields.find((field) => normalizeFieldId(field.id) === normalizedKey)?.label?.trim();
    };

    const registerLane = (
      laneMap: Map<string, string>,
      key: string,
      preferredLabel?: string | null
    ) => {
      const normalizedKey = normalizeFieldId(key ?? '');
      if (!normalizedKey || laneMap.has(normalizedKey)) return;
      laneMap.set(normalizedKey, preferredLabel?.trim() || key.trim() || normalizedKey);
    };

    for (const vector of vectors) {
      for (const key of Object.keys(vector.inputs ?? {})) {
        registerLane(inputLaneLabels, key, preferredLabelForField(inputFields, key));
      }
      for (const [key, value] of Object.entries(vector.expected ?? {})) {
        const normalizedKey = normalizeFieldId(key);
        registerLane(outputLaneLabels, key, preferredLabelForField(outputFields, key));
        if (normalizedKey && value !== null && value !== undefined) {
          assertedOutputs.add(normalizedKey);
          totalAssertionCount++;
        }
      }
    }

    for (const field of inputFields) {
      registerLane(inputLaneLabels, field.id, field.label ?? field.id);
    }
    for (const field of outputFields) {
      registerLane(outputLaneLabels, field.id, field.label ?? field.id);
    }

    for (const [key, role] of Object.entries(roles)) {
      if (role === 'output' && !outputLaneLabels.has(key) && !inputLaneLabels.has(key)) {
        registerLane(outputLaneLabels, key, preferredLabelForField(outputFields, key));
      }
    }

    const lanes: VerifySignalLane[] = [];
    for (const [normalizedKey, label] of Array.from(inputLaneLabels.entries()).sort((left, right) =>
      compareText(left[1].toLowerCase(), right[1].toLowerCase())
    )) {
      const role = roles[normalizedKey];
      if (role === 'clock' || role === 'reset') continue;
      lanes.push({ name: label, direction: 'input', isAsserted: false });
    }
    for (const [normalizedKey, label] of Array.from(outputLaneLabels.entries()).sort((left, right) =>
      compareText(left[1].toLowerCase(), right[1].toLowerCase())
    )) {
      lanes.push({ name: label, direction: 'output', isAsserted: assertedOutputs.has(normalizedKey) });
    }

    const contract = activeScheduleContract;
    const isClocked =
      contract != null
        ? contract.reason === 'circuit-sequential' || contract.reason === 'hdl-sequential'
        : Object.values(roles).some((role) => role === 'clock');

    const resolvedClockSignalName = (() => {
      if (contract?.clockSignalName) {
        const normalizedKey = normalizeFieldId(contract.clockSignalName);
        return inputLaneLabels.get(normalizedKey) ?? contract.clockSignalName;
      }
      const clockEntry = Object.entries(roles).find(([, role]) => role === 'clock');
      if (!clockEntry) return undefined;
      return inputLaneLabels.get(clockEntry[0]) ?? clockEntry[0];
    })();

    return {
      lanes,
      tickCount: vectors.length,
      assertedOutputCount: assertedOutputs.size,
      totalAssertionCount,
      clockPolicy: isClocked ? 'clocked' : 'combinational',
      clockSignalName: isClocked ? resolvedClockSignalName : undefined,
    };
  }, [activeScheduleContract, effectiveNextRunVectors, inputFields, liveSignalRoles, outputFields]);
  // ────────────────────────────────────────────────────────────────────────────

  const verifySession = useMemo(
    () =>
      buildVerifySessionViewModel({
        totalVectorCount,
        totalExpectedCaseCount,
        runState,
        lastRun,
        nextRunUsesAssertions,
        isRunStale,
        isTraceOnly,
        hasResults,
        canSetOracle,
        failingRowCount: failingRows.length,
        signalInventory,
      }),
    [
      nextRunUsesAssertions,
      canSetOracle,
      failingRows.length,
      hasResults,
      isRunStale,
      isTraceOnly,
      lastRun,
      runState,
      signalInventory,
      totalExpectedCaseCount,
      totalVectorCount,
    ]
  );
  const sessionStatus = verifySession.status;
  const nextRunIsCompare = verifySession.mode === 'assertion';
  const sessionShowsAssertionMatch = sessionStatus === 'assertions-match';
  const sessionSignalsAssertionFailure = sessionStatus === 'assertions-differ';
  const sessionShowsCompareEvidence =
    sessionShowsAssertionMatch || sessionSignalsAssertionFailure;
  const showSecondaryAssertionGrid =
    sessionShowsCompareEvidence &&
    Boolean(lastRun) &&
    outputFields.length > 0 &&
    zoomedTicks.length > 0;
  const sessionShowsTraceEvidence =
    sessionStatus === 'stimulus-only' || sessionStatus === 'assertions-incomplete';
  const isDraftSession = sessionStatus === 'draft';
  const verifyWorkflowPhase = lastRun ? 'post-run' : 'pre-run';
  const stimulusPanelCollapsed = Boolean(lastRun) && !scenarioWorkbenchExpanded;
  const verifyWorkspaceMode =
    verifyWorkflowPhase === 'pre-run'
      ? 'stimulus-focus'
      : layoutMode === 'compact'
        ? 'stimulus-focus'
        : stimulusPanelCollapsed
          ? 'waveform-focus'
          : 'split';
  const draftPresentationStatus = totalVectorCount > 0 ? 'READY' : 'NOT STARTED';
  const readyDraftCanRun = isDraftSession && draftPresentationStatus === 'READY';
  const sessionStatusBadgeLabel = isDraftSession
    ? draftPresentationStatus
    : verifySession.statusBadge;
  const sessionStatusTone: 'ok' | 'warn' | 'error' | 'idle' =
    sessionSignalsAssertionFailure
      ? 'error'
      : sessionShowsAssertionMatch
        ? lastRun?.qualification === 'incomplete-mapping' ? 'warn' : 'ok'
        : isDraftSession && draftPresentationStatus === 'NOT STARTED'
          ? 'warn'
          : verifySession.tone;
  const hasSessionFailureEvidence =
    sessionSignalsAssertionFailure && failingRows.length > 0;
  // Keep failure analysis secondary so the editor + waveform remain the primary
  // desktop workbench. Detailed failure review lives in the lower analysis drawer.
  const showInlineFailureWorkbenchPanels = false;
  const canInspectFirstMismatch = hasSessionFailureEvidence && !isRunStale;
  const postRunToolbarMode =
    hasSessionFailureEvidence || canInspectFirstMismatch ? 'visible' : 'advanced';
  const captureIsPrimary =
    verifySession.recommendedNextAction === 'capture' && canSetOracle && !canInspectFirstMismatch;
  const primaryActionKind: 'run' | 'capture' | 'inspect' = canInspectFirstMismatch
    ? 'inspect'
    : captureIsPrimary
      ? 'capture'
      : 'run';
  const runActionTone = primaryActionKind === 'run' ? 'primary' : 'secondary';
  const captureActionTone = primaryActionKind === 'capture' ? 'primary' : 'secondary';
  // ── B-12 Slice 3: canonical result zone ──────────────────────────────────────
  const emptyStateRunLabel = verifySession.runLabel;
  const referenceModeLabel: string = hasStaleAuthoredReference
    ? `Stale saved checks loaded (${totalVectorCount} vector${totalVectorCount === 1 ? '' : 's'})`
    : totalExpectedCaseCount === 0
      ? 'Observation run only — no saved checks'
      : !nextRunIsCompare
        ? `Saved checks available (${totalVectorCount} vector${totalVectorCount === 1 ? '' : 's'}), next run stays in observation mode`
        : authoredVectors.length > 0 && customVectorCount > 0
          ? `Saved checks armed (${totalVectorCount} project + custom)`
          : customVectorCount > 0
            ? `Saved checks armed (${customVectorCount} custom)`
            : `Saved checks armed (${authoredVectors.length} project)`;
  const sessionModeBadge: string = nextRunIsCompare ? 'Checks armed' : 'Observe';
  const compactCommandRunLabel =
    totalExpectedCaseCount > 0
      ? lastRun
        ? nextRunIsCompare
          ? 'Update Compare'
          : 'Update Observe'
        : nextRunIsCompare
          ? 'Run Compare'
          : 'Run Observe'
      : verifySession.runLabel;
  const sessionTitle: string = !lastRun
    ? 'Ready to run'
    : isTraceOnly ? 'Outputs observed — stimulus captured'
    : sessionStatus === 'assertions-match' ? 'Checks aligned'
    : sessionStatus === 'assertions-differ' ? 'Checks need review'
    : sessionStatus === 'stale'
      ? hasStaleAuthoredReference || !nextRunIsCompare
        ? 'Observe current circuit'
        : 'Compare current circuit'
    : sessionStatusBadgeLabel;
  const commandBarEvidenceLabel =
    lastRun && sessionShowsCompareEvidence
      ? failingRows.length > 0
        ? `${failingRows.length} mismatch${failingRows.length === 1 ? '' : 'es'}${typeof firstFailureTick === 'number' ? ` · t${firstFailureTick}` : ''}`
        : `${runRows.length}/${runRows.length} match`
      : lastRun && sessionShowsTraceEvidence
        ? `${runVectorCount} observed row${runVectorCount === 1 ? '' : 's'}`
        : undefined;
  const commandBarCoverageLabel =
    lastRun && runRows.length > 0 && inputCoverage
      ? `${inputCoverage.pct}% coverage`
      : undefined;
  const labSequencerSteps = useMemo(() => {
    const explicitSteps = buildLabSequencerStepsFromScenarioSteps(activeScenario?.steps);
    if (explicitSteps.length > 0) return explicitSteps;
    return buildLabSequencerSteps(authoredVectors, signalRoleLookup);
  }, [activeScenario?.steps, authoredVectors, signalRoleLookup]);
  const editableScenarioSteps = useMemo(() => {
    if (activeScenario?.steps && activeScenario.steps.length > 0) {
      return [...activeScenario.steps].sort((left, right) => left.order - right.order);
    }
    return deriveScenarioStepsFromVectors(authoredVectors);
  }, [activeScenario?.steps, authoredVectors]);
  const selectedTickSignalSample = useMemo(() => {
    if (selectedTick == null) return null;
    const sample: Record<string, string> = {};
    for (const signal of signalTimeline) {
      const atTick = signal.values.find((entry) => entry.tick === selectedTick);
      if (atTick) {
        sample[signal.signal] = atTick.value;
      }
    }
    return Object.keys(sample).length > 0 ? sample : null;
  }, [selectedTick, signalTimeline]);
  const stateObservationSummary = useMemo(
    () =>
      summarizeStateObservation(
        selectedTickSignalSample,
        signalTimeline.map((entry) => entry.signal)
      ),
    [selectedTickSignalSample, signalTimeline]
  );
  const sequencerModeLabel =
    activeScheduleContract?.timingMode === 'manual_event_driven_lab'
      ? 'Manual-event lab mode'
      : isSequentialRun
        ? 'Sequential stimulus'
        : 'Combinational stimulus mode';
  const stateObservationLabel =
    selectedTick == null
      ? 'Select a tick to inspect register/state-bank behavior in this sequence.'
      : `${stateObservationSummary.registerSignalCount} register signal(s), ${stateObservationSummary.stateBankSignalCount} state-bank signal(s), ${stateObservationSummary.totalObservedSignals} observed signal(s) at t${selectedTick}.`;
  const selectedStateObservationDetails = useMemo(() => {
    if (!selectedTickSignalSample) return [];
    const rows: Array<{ signal: string; value: string; category: 'register' | 'state_bank' }> = [];
    for (const [signal, value] of Object.entries(selectedTickSignalSample)) {
      const normalized = signal.toLowerCase();
      if (normalized.startsWith('reg_') || normalized.includes('register')) {
        rows.push({ signal, value, category: 'register' });
        continue;
      }
      if (normalized.startsWith('state_bank') || normalized.includes('statebank')) {
        rows.push({ signal, value, category: 'state_bank' });
      }
    }
    return rows.sort((left, right) => left.signal.localeCompare(right.signal));
  }, [selectedTickSignalSample]);
  // ─────────────────────────────────────────────────────────────────────────────
  const shortenHash = (value: string | null | undefined): string => {
    if (!value || value.trim().length === 0) return '—';
    return value.length > 12 ? value.slice(0, 12) : value;
  };
  const runProofFacts = useMemo(
    () =>
      lastRun
        ? [
            {
              label: 'Verified build',
              value: shortenHash(lastRun.deterministicHash),
              fullValue: lastRun.deterministicHash,
            },
            ...(isRunStale
              ? [
                  {
                    label: 'Current build',
                    value: shortenHash(deterministicHash),
                    fullValue: deterministicHash,
                  },
                ]
              : []),
            {
              label: 'Report hash',
              value: shortenHash(lastRun.reportHash ?? '—'),
              fullValue: lastRun.reportHash ?? '—',
            },
            {
              label: 'Scenario',
              value: lastRun.scenarioName,
              fullValue: lastRun.scenarioName,
            },
            {
              label: 'Reference',
              value: verifyScenarioName,
              fullValue: verifyScenarioName,
            },
            {
              label: 'Vectors',
              value: `${runVectorCount} case${runVectorCount === 1 ? '' : 's'}`,
              fullValue: `${runVectorCount} case${runVectorCount === 1 ? '' : 's'}`,
            },
            {
              label: 'Trace',
              value: `${waveformTicks.length} tick${waveformTicks.length === 1 ? '' : 's'} · ${signalTimeline.length} signal${signalTimeline.length === 1 ? '' : 's'}`,
              fullValue: `${waveformTicks.length} tick${waveformTicks.length === 1 ? '' : 's'} · ${signalTimeline.length} signal${signalTimeline.length === 1 ? '' : 's'}`,
            },
            {
              label: 'Sampling',
              value: formatVerifySampling(lastRun),
              fullValue: formatVerifySampling(lastRun),
            },
          ]
        : [],
    [
      deterministicHash,
      isRunStale,
      lastRun,
      runVectorCount,
      signalTimeline.length,
      verifyScenarioName,
      waveformTicks.length,
    ]
  );
  const runProofTitle =
    sessionShowsAssertionMatch
      ? lastRun?.qualification === 'incomplete-mapping'
        ? 'Checks passed — finish pin mapping'
        : `Checks passed · ${runRows.length} case${runRows.length === 1 ? '' : 's'}`
      : sessionSignalsAssertionFailure
        ? `Checks failed · ${failingRows.length}/${runRows.length} case${runRows.length === 1 ? '' : 's'}`
      : sessionStatus === 'stale'
          ? 'Stale results on this page'
            : sessionShowsTraceEvidence
            ? 'Simulation only (no checks)'
            : verifySession.title;
  const runProofSummary =
    sessionShowsAssertionMatch
      ? lastRun?.qualification === 'incomplete-mapping'
        ? `${unmappedOutputLabels.length > 0 ? `${unmappedOutputLabels.slice(0, 3).join(', ')}${unmappedOutputLabels.length > 3 ? ` +${unmappedOutputLabels.length - 3} more` : ''} ${unmappedOutputLabels.length === 1 ? 'is' : 'are'} not connected to board pins.` : 'Some outputs are not connected to board pins.'} Open Project, then the Map Pins stage, and finish pin names there — Export and Hardware read that same table.`
        : 'Every saved check matched the observed outputs.'
      : sessionSignalsAssertionFailure
        ? 'Use the chart below: red ticks mark the problem times. Then fix your circuit or the saved check at that point.'
      : sessionStatus === 'stale'
          ? hasStaleAuthoredReference
            ? 'The visible waveform belongs to an older build. Verify has switched back to stimulus tracing so you can inspect the live circuit before re-authoring or intentionally reusing the older reference.'
            : 'The visible waveform belongs to the previously verified build hash. Re-run Verify so the evidence matches the current circuit again.'
      : sessionShowsTraceEvidence
            ? 'This run recorded live waveform behavior only. Save observed outputs as assertions or reveal the assertions editor when you want explicit verification.'
            : verifySession.summary;
  const verifyLayoutPolicy = useMemo(
    () => ({
      /** Keep shell rails secondary so the stimulus/waveform pair owns the page. */
      leftDockMode: isNoCircuitTaskFirst ? ('hidden' as const) : ('collapsed' as const),
      /** Saved cases and mismatch detail now live in the lower details tray. */
      rightDockMode: ('hidden' as const),
      consoleMode: isNoCircuitTaskFirst
        ? ('hidden' as const)
        : sessionSignalsAssertionFailure
          ? ('auto' as const)
          : ('hidden' as const),
    }),
    [isNoCircuitTaskFirst, sessionSignalsAssertionFailure]
  );

  useEffect(() => {
    if (sessionShowsAssertionMatch && failingRows.length === 0 && verifyTab === 'mismatches') {
      setVerifyTab('details');
    }
  }, [failingRows.length, sessionShowsAssertionMatch, verifyTab]);

  const primaryStatus = useMemo<VerifyPrimaryStatusAreaProps | null>(() => {
    if (isNoCircuitTaskFirst) {
      return null;
    }

    if (hasStaleAuthoredReference) {
      const actions: VerifyPrimaryStatusAreaProps['actions'] = [
        {
          label: 'Rerun Compare with saved checks',
          onClick: handleKeepOlderReference,
          tone: 'primary',
          testId: 'ide-verify-stale-keep-reference',
        },
      ];
      if (canResetToStimulusOnly) {
        actions.push({
          label: 'Clear checks - observe only',
          onClick: handleResetToStimulusOnly,
          tone: 'secondary',
          testId: 'ide-verify-stale-reset-stimulus',
        });
      }
      actions.push({
        label: 'Re-capture from current circuit',
        onClick: handleStaleRecapture,
        tone: 'secondary',
        testId: 'ide-verify-stale-recapture-reauthor',
      });
      return {
        tone: 'warn',
        title: 'Circuit or checks changed - rerun Compare',
        message:
          'The circuit, stimulus, or expected-output checks changed since this reference was authored. Rerun Compare with the saved expected values, or recapture if the expected values should change.',
        actions,
      };
    }

    if (isRunStale) {
      return {
        tone: 'info',
        title: 'Design changed - rerun Compare',
        message: 'The circuit changed since this run. Rerun Compare before trusting these results.',
        actions: [{ label: 'Run Compare', onClick: runVerification, tone: 'primary', testId: 'ide-verify-primary-status-run-current' }],
      };
    }

    if (isWrongScenario) {
      return {
        tone: 'info',
        title: 'Results belong to another scenario',
        message: `Active scenario is ${activeScenario?.name ?? 'different'}. Re-run for the active scenario to refresh this workspace.`,
        actions: [
          ...(lastRunScenarioId && onSwitchScenario
            ? [{ label: `Switch to ${lastRunScenarioName ?? 'run scenario'}`, onClick: () => onSwitchScenario(lastRunScenarioId), tone: 'secondary' as const, testId: 'ide-verify-primary-status-switch-scenario' }]
            : []),
          { label: 'Re-run active scenario', onClick: runVerification, tone: 'primary', testId: 'ide-verify-primary-status-rerun-active' },
        ],
      };
    }

    if (isTestbenchStale && !isRunStale) {
      return {
        tone: 'warn',
        title: 'Checks changed - rerun before trusting PASS',
        message: 'Stimulus or expected-output checks changed since the last run. The old PASS/FAIL result is stale until Compare runs again.',
        actions: [{ label: 'Rerun Compare now', onClick: runVerification, tone: 'primary', testId: 'ide-verify-primary-status-rerun' }],
      };
    }

    if (
      !mappingComplete &&
      !(lastRun?.qualification === 'incomplete-mapping' && sessionStatus === 'assertions-match')
    ) {
      const actions: VerifyPrimaryStatusAreaProps['actions'] = [
        {
          label: 'Open Project — Map Pins',
          onClick: onOpenProjectVectors,
          tone: 'primary',
          testId: 'ide-verify-primary-open-project-mappins',
        },
      ];
      if (onGoToHardware) {
        actions.push({
          label: 'View on Hardware (same mapping)',
          onClick: onGoToHardware,
          tone: 'secondary',
          testId: 'ide-verify-primary-open-hardware',
        });
      }
      return {
        tone: 'warn',
        title: 'Board pins are not finished on Project',
        message:
          'Simulation and checks can still run, but unmapped outputs will not line up with a trustworthy export or board test until you assign them on Project → Map Pins.',
        actions,
      };
    }

    return null;
  }, [
    activeScenario?.name,
    canResetToStimulusOnly,
    handleKeepOlderReference,
    handleResetToStimulusOnly,
    handleStaleRecapture,
    hasStaleAuthoredReference,
    isNoCircuitTaskFirst,
    isRunStale,
    isTestbenchStale,
    isWrongScenario,
    lastRun?.qualification,
    lastRunScenarioId,
    lastRunScenarioName,
    mappingComplete,
    onGoToHardware,
    onOpenProjectVectors,
    onSwitchScenario,
    runVerification,
    sessionStatus,
  ]);

  const analysisDrawerHint = useMemo(() => {
    if (!hasSessionFailureEvidence || !selectedFailureCase) return undefined;
    return `${selectedFailureDisplayLabel ?? selectedFailureCase.signal} t${selectedFailureCase.tick}`;
  }, [
    hasSessionFailureEvidence,
    selectedFailureCase,
    selectedFailureDisplayLabel,
  ]);
  const compactPrimaryStatusAction =
    primaryStatus?.title === 'Board pins are not finished on Project'
      ? primaryStatus.actions?.[0]
      : undefined;
  const verifySessionMetricsRow = Boolean(lastRun) ? ('inline' as const) : ('hidden' as const);
  const testbenchRunSummary = useMemo<React.ReactNode>(() => {
    const drivenInputs = editableInputFields
      .map((field) => field.label ?? field.id)
      .filter((label) => label.trim().length > 0);
    const checkedOutputs = outputFields
      .filter((field) =>
        totalExpectedCaseCount > 0
          ? authoredVectors.some((vector) => vector.expected?.[field.id] !== undefined)
          : false
      )
      .map((field) => field.label ?? field.id);
    const uniqueTicks = Array.from(new Set(effectiveNextRunVectors.map((vector) => vector.tick)));
    const effectiveTickCount =
      uniqueTicks.length > 0
        ? uniqueTicks.length
        : autoClockModeActive && effectiveClockPolicy
          ? effectiveClockPolicy.runCycles
          : 0;
    const tickLabel = effectiveTickCount === 1 ? '1 tick' : `${effectiveTickCount} ticks`;
    const effectiveCaseCount =
      totalVectorCount > 0
        ? totalVectorCount
        : autoClockModeActive && effectiveClockPolicy
          ? effectiveClockPolicy.runCycles
          : 0;
    const caseLabel = effectiveCaseCount === 1 ? '1 case' : `${effectiveCaseCount} cases`;
    const clockLabel = isSequentialRun
      ? autoClockModeActive && effectiveClockPolicy
        ? `${effectiveClockPolicy.runCycles} auto cycle${effectiveClockPolicy.runCycles === 1 ? '' : 's'}`
        : clockActivitySummary.risingCount > 0
        ? `${clockActivitySummary.risingCount} rising edge${clockActivitySummary.risingCount === 1 ? '' : 's'}`
        : 'no rising edge yet'
      : 'not required';
    const compareLabel =
      nextRunUsesAssertions && totalExpectedCaseCount > 0
        ? 'compare checks on'
        : 'observe only';

    return (
      <div className="ide-verify-testbench-summary" data-testid="ide-verify-testbench-summary">
        <div className="ide-verify-testbench-summary-grid ide-verify-testbench-summary-grid--compact">
          <span className="ide-verify-testbench-summary-chip" data-testid="ide-verify-testbench-summary-inputs">
            Inputs: {drivenInputs.length}
          </span>
          <span className="ide-verify-testbench-summary-chip" data-testid="ide-verify-testbench-summary-outputs">
            Checks: {checkedOutputs.length}
          </span>
          <span className="ide-verify-testbench-summary-chip" data-testid="ide-verify-testbench-summary-cases">
            {caseLabel}
          </span>
          <span className="ide-verify-testbench-summary-chip" data-testid="ide-verify-testbench-summary-clock">
            {tickLabel}
          </span>
          <span className="ide-verify-testbench-summary-chip" data-testid="ide-verify-testbench-summary-compare">
            {compareLabel}
          </span>
          <span className="ide-verify-testbench-summary-chip is-muted">{clockLabel}</span>
        </div>
      </div>
    );
  }, [
    autoClockModeActive,
    authoredVectors,
    clockActivitySummary.risingCount,
    editableInputFields,
    effectiveClockPolicy,
    effectiveNextRunVectors,
    isSequentialRun,
    nextRunUsesAssertions,
    outputFields,
    totalExpectedCaseCount,
    totalVectorCount,
  ]);
  const stimulusAssist = useMemo<React.ReactNode>(() => {
    if (verifyMode !== 'sequential') return null;

    const isWarn = nextRunNeedsClockActivity;
    const panelTestId =
      effectiveTimingGuidance.kind === 'latch-control'
        ? 'ide-verify-sequential-helper'
        : isWarn
          ? 'ide-verify-needs-clock'
          : 'ide-verify-sequential-helper';
    const missingTimingInstruction =
      effectiveTimingGuidance.kind === 'latch-control'
        ? 'Use the highlighted control lane before expecting output changes.'
        : autoClockModeActive
          ? 'Clock runs automatically during Verify.'
          : 'Use the highlighted clock lane to add a rising edge.';
    const lanePrompt =
      effectiveTimingGuidance.kind === 'latch-control'
        ? 'Control lane is in the main grid.'
        : autoClockModeActive
          ? 'Board clock is generated automatically and is not edited in the grid.'
          : 'Clock lane is part of the main grid.';
    const clockSummaryText =
      autoClockModeActive && effectiveClockPolicy
        ? `Auto ${effectiveClockPolicy.sourceType === 'board-clock' ? 'board clock' : 'clock'}: ${effectiveClockPolicy.runCycles} cycle${effectiveClockPolicy.runCycles === 1 ? '' : 's'}, ${effectiveClockPolicy.activeEdge} edge, ${effectiveClockPolicy.resetBehavior === 'auto-sequence' ? 'reset sequence applied' : effectiveClockPolicy.resetBehavior === 'custom' ? 'custom reset' : 'no reset detected'}.`
        : clockActivitySummary.summary;
    const manualClockWarning =
      effectiveClockPolicy?.overrideMode === 'manual-pulses' ||
      effectiveClockPolicy?.overrideMode === 'custom-pattern'
        ? effectiveClockPolicy.manualWarning
        : null;
    const clockPolicyCopy =
      effectiveClockPolicy?.sourceType === 'explicit-clock-component'
        ? 'Sim Clock components are import-only in this release. Replace the component with the CLK100MHZ board resource before trusting auto Verify or Export.'
        : effectiveClockPolicy?.sourceType === 'board-clock'
          ? 'Auto mode generates the board clock. Manual/custom modes expose an editable clock lane.'
          : 'Auto mode generates clock cycles. Manual/custom modes expose an editable clock lane.';
    const autoModeLabel =
      effectiveClockPolicy?.sourceType === 'board-clock' ? 'Auto board clock' : 'Auto clock';

    return (
      <div
        className={`ide-verify-stimulus-assist${isWarn ? ' is-warn' : ''}`}
        data-testid={panelTestId}
      >
        <div className="ide-verify-stimulus-assist-copy">
          <strong className="ide-verify-stimulus-assist-title">Clock / timing</strong>
          {boardClockBinding ? (
            <span className="ide-verify-stimulus-assist-meta" data-testid="ide-verify-board-clock-source">
              {boardClockBinding.alias} • {boardClockBinding.packagePin} • auto board clock source
            </span>
          ) : clockSignalNames[0] ? (
            <span className="ide-verify-stimulus-assist-meta" data-testid="ide-verify-clock-signal-name">
              {clockSignalNames[0]}
            </span>
          ) : null}
          {isWarn ? (
            <span className="ide-verify-stimulus-assist-message">
              {sequentialGuidanceCopy.introTitle}. {sequentialGuidanceCopy.missingActivity} {missingTimingInstruction}
            </span>
          ) : isFirstRunState ? (
            <span className="ide-verify-stimulus-assist-message">
              {sequentialGuidanceCopy.introStep} {lanePrompt}
            </span>
          ) : (
            <span className="ide-verify-stimulus-assist-message">
              {lanePrompt}
            </span>
          )}
          <span className="ide-verify-stimulus-assist-summary" data-testid="ide-verify-clock-pattern-summary">
            {clockSummaryText}
          </span>
          {effectiveClockPolicy ? (
            <div className="ide-verify-clock-policy-panel" data-testid="ide-verify-clock-policy-panel">
              <span className="ide-verify-clock-policy-line" data-testid="ide-verify-clock-detected">
                Detected clock: {effectiveClockPolicy.signalLabel}
                {effectiveClockPolicy.boardAlias ? ` · ${effectiveClockPolicy.boardAlias}` : ''}
                {effectiveClockPolicy.packagePin ? ` · ${effectiveClockPolicy.packagePin}` : ''}
                {effectiveClockPolicy.frequencyMHz ? ` · ${effectiveClockPolicy.frequencyMHz} MHz` : ''}
              </span>
              <span className="ide-verify-clock-policy-line" data-testid="ide-verify-clock-mode-summary">
                Mode: {effectiveClockPolicy.overrideMode === 'auto'
                  ? effectiveClockPolicy.sourceType === 'board-clock'
                    ? 'Auto board clock'
                    : 'Auto clock'
                  : effectiveClockPolicy.overrideMode === 'manual-pulses'
                    ? 'Manual pulses'
                    : 'Custom pattern'}
              </span>
              <span className="ide-verify-clock-policy-line" data-testid="ide-verify-clock-reset-summary">
                Reset: {effectiveClockPolicy.resetBehavior === 'auto-sequence'
                  ? 'reset sequence applied'
                  : effectiveClockPolicy.resetBehavior === 'custom'
                    ? 'custom reset'
                    : 'no reset detected'}
              </span>
              <div className="ide-verify-clock-policy-controls" data-testid="ide-verify-clock-policy-controls">
                <span className="ide-verify-clock-policy-copy" data-testid="ide-verify-clock-policy-copy">
                  {clockPolicyCopy}
                </span>
                <div className="ide-verify-clock-policy-mode-buttons">
                  <button
                    type="button"
                    className={`ide-verify-clock-policy-btn${clockOverrideMode === 'auto' ? ' is-active' : ''}`}
                    onClick={() => setClockOverrideMode('auto')}
                    data-testid="ide-verify-clock-mode-auto"
                  >
                    {autoModeLabel}
                  </button>
                  <button
                    type="button"
                    className={`ide-verify-clock-policy-btn${clockOverrideMode === 'manual-pulses' ? ' is-active' : ''}`}
                    onClick={() => setClockOverrideMode('manual-pulses')}
                    data-testid="ide-verify-clock-mode-manual"
                  >
                    Manual pulses
                  </button>
                  <button
                    type="button"
                    className={`ide-verify-clock-policy-btn${clockOverrideMode === 'custom-pattern' ? ' is-active' : ''}`}
                    onClick={() => setClockOverrideMode('custom-pattern')}
                    data-testid="ide-verify-clock-mode-custom"
                  >
                    Custom pattern
                  </button>
                </div>
                <label className="ide-verify-clock-policy-cycles" data-testid="ide-verify-clock-run-cycles">
                  Run length
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={clockRunCycles}
                    onChange={(event) =>
                      setClockRunCycles(Math.max(1, Number(event.target.value || '1')))
                    }
                    data-testid="ide-verify-clock-run-cycles-input"
                  />
                  <span>cycles</span>
                </label>
                {manualClockWarning ? (
                  <span className="ide-verify-clock-policy-warning" data-testid="ide-verify-clock-manual-warning">
                    {manualClockWarning}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {clockActivitySummary.preview.length > 0 ? (
            <span className="ide-verify-clock-preview" data-testid="ide-verify-clock-pattern-preview">
              {clockActivitySummary.preview.join('  ')}
            </span>
          ) : null}
        </div>
      </div>
    );
  }, [
    autoClockModeActive,
    boardClockBinding,
    clockOverrideMode,
    clockRunCycles,
    clockSignalNames,
    clockActivitySummary,
    effectiveClockPolicy,
    effectiveTimingGuidance.kind,
    isFirstRunState,
    nextRunNeedsClockActivity,
    sequentialGuidanceCopy.introStep,
    sequentialGuidanceCopy.introTitle,
    sequentialGuidanceCopy.missingActivity,
    verifyMode,
  ]);

  const scenarioBuilderModeSummary = useMemo(() => {
    if (!isSequentialRun || !effectiveClockPolicy) {
      return 'Combinational no clock';
    }
    if (effectiveClockPolicy.overrideMode === 'auto') {
      return effectiveClockPolicy.sourceType === 'board-clock' ? 'Auto board clock' : 'Auto clock';
    }
    return effectiveClockPolicy.overrideMode === 'manual-pulses' ? 'Manual pulses' : 'Custom pattern';
  }, [effectiveClockPolicy, isSequentialRun]);

  const scenarioBuilderModeHint = useMemo(() => {
    if (!isSequentialRun || !effectiveClockPolicy) {
      return 'Combinational checks use data inputs only; no clock edits are required.';
    }
    if (effectiveClockPolicy.overrideMode === 'auto') {
      if (effectiveClockPolicy.sourceType === 'board-clock' && boardClockBinding) {
        return `${boardClockBinding.alias} runs automatically during Verify and stays out of the editable stimulus rows.`;
      }
      return 'Clock cycles are generated automatically during Verify and do not require manual painting.';
    }
    if (effectiveClockPolicy.overrideMode === 'manual-pulses') {
      return 'Manual pulses mode exposes the clock lane for explicit debug pulses and hand-edited edges.';
    }
    return 'Custom pattern mode uses the clock lane so you can paint the exact timing sequence.';
  }, [boardClockBinding, effectiveClockPolicy, isSequentialRun]);

  const selectedRepairDiagnosis = useMemo(() => {
    if (!selectedFailureExplanationCase) return null;
    return diagnoseVerifyFailure({
      status: lastRun?.status ?? status,
      staleReason: isRunStale ? (isTestbenchStale ? 'testbench' : 'design') : null,
      runRowsCount: runRows.length,
      outputLabels: outputSignalOrder,
      preflightIssues: verifyPreflightIssues,
      failure: {
        signalLabel:
          selectedFailureDisplayLabel ??
          selectedFailureExplanationCase.signalLabel ??
          selectedFailureExplanationCase.signal,
        signal: selectedFailureExplanationCase.signal,
        expected: selectedFailureExplanationCase.expected,
        observed: selectedFailureExplanationCase.actual,
        inputSnapshot: selectedFailureInputs ?? undefined,
      },
    });
  }, [
    isRunStale,
    isTestbenchStale,
    lastRun?.status,
    outputSignalOrder,
    runRows.length,
    selectedFailureDisplayLabel,
    selectedFailureExplanationCase,
    selectedFailureInputs,
    status,
    verifyPreflightIssues,
  ]);
  const expectedRepairIsPrimary = selectedRepairDiagnosis?.primaryLane === 'expected';
  const designRepairIsPrimary = selectedRepairDiagnosis?.primaryLane === 'design';
  const rerunRepairIsPrimary = selectedRepairDiagnosis?.primaryLane === 'rerun';

  const structuralRecoveryDiagnosis = useMemo(() => {
    if (!lastRun || lastRun.status !== 'fail' || failingRows.length > 0) return null;
    const diagnosis = diagnoseVerifyFailure({
      status: lastRun.status,
      runRowsCount: runRows.length,
      outputLabels: outputSignalOrder,
      preflightIssues: verifyPreflightIssues,
    });
    return diagnosis.category === 'disconnected-output' ? diagnosis : null;
  }, [failingRows.length, lastRun, outputSignalOrder, runRows.length, verifyPreflightIssues]);

  const structuralRecoveryPanel = structuralRecoveryDiagnosis ? (
    <section
      className="ide-verify-repair-panel ide-verify-repair-panel--structural"
      data-testid="ide-verify-structural-recovery-panel"
      data-category={structuralRecoveryDiagnosis.category}
    >
      <header className="ide-verify-repair-panel__header">
        <div className="ide-verify-repair-panel__copy">
          <span className="ide-verify-repair-panel__eyebrow">Compare could not check an output</span>
          <strong>{structuralRecoveryDiagnosis.message}</strong>
          <p data-testid="ide-verify-structural-recovery-next-action">
            {structuralRecoveryDiagnosis.recommendedAction}
          </p>
        </div>
        <IdeStatusPill tone="error">Design repair</IdeStatusPill>
      </header>
      <div className="ide-verify-repair-panel__facts">
        <div className="ide-verify-repair-panel__fact">
          <span>Likely issue</span>
          <strong>Output not sampled</strong>
        </div>
        <div className="ide-verify-repair-panel__fact">
          <span>Signal</span>
          <strong>{outputSignalOrder[0] ?? 'output'}</strong>
        </div>
        <div className="ide-verify-repair-panel__fact">
          <span>Expected rows</span>
          <strong>{totalExpectedCaseCount}</strong>
        </div>
        <div className="ide-verify-repair-panel__fact">
          <span>Generated checks</span>
          <strong>{runRows.length}</strong>
        </div>
      </div>
      <div className="ide-verify-repair-panel__actions">
        <div className="ide-verify-repair-panel__action-path" data-testid="ide-verify-structural-design-path">
          <span className="ide-verify-repair-panel__path-label">Design repair</span>
          <div className="ide-verify-repair-panel__path-actions">
            {(onGoToDesign || onGoToDesignWithInputs || onDebugTickSelected) ? (
              <IdeButton
                tone="primary"
                onClick={handleGoToDesignFromVerify}
                testId="ide-verify-structural-open-design"
                title="Open Design and connect a driver to the missing output."
              >
                Open Design
              </IdeButton>
            ) : null}
            <IdeButton
              tone="secondary"
              onClick={() => handleRunWithPreflight(true)}
              disabled={runState === 'running'}
              testId="ide-verify-structural-rerun"
              title="Rerun Compare after reconnecting the output."
            >
              Rerun Compare
            </IdeButton>
          </div>
        </div>
      </div>
    </section>
  ) : null;

  const repairPanel = hasSessionFailureEvidence && selectedFailureExplanationCase ? (
    <section
      className="ide-verify-repair-panel"
      data-testid="ide-verify-repair-panel"
      data-stale={isRunStale || isTestbenchStale ? 'true' : 'false'}
      data-category={selectedRepairDiagnosis?.category ?? 'unknown'}
    >
      <header className="ide-verify-repair-panel__header">
        <div className="ide-verify-repair-panel__copy">
          <span
            className="ide-verify-repair-panel__eyebrow"
            data-testid="ide-verify-repair-title"
          >
            Compare failed
          </span>
          <strong>{selectedRepairDiagnosis?.message ?? 'Fix expected value or inspect design.'}</strong>
          <p data-testid="ide-verify-repair-next-action">
            {selectedRepairDiagnosis?.recommendedAction ??
              'If the expected value is correct, this may be a circuit issue. Check the gate or wire driving the failed output, then rerun Compare.'}
          </p>
        </div>
        <IdeStatusPill tone="error" data-testid="ide-verify-repair-status">
          Needs repair
        </IdeStatusPill>
      </header>

      <div className="ide-verify-repair-panel__facts">
        <button
          type="button"
          className="ide-verify-repair-panel__fact ide-verify-repair-panel__fact-button"
          onClick={handleJumpToFirstFailure}
          data-testid="ide-verify-results-summary-open-fail"
        >
          <span>Failed case</span>
          <strong data-testid="ide-verify-repair-case">
            {selectedFailureRepairCaseLabel ?? 'Selected case'}
          </strong>
          <code>t{selectedFailureExplanationCase.tick}</code>
        </button>
        <div className="ide-verify-repair-panel__fact">
          <span>Failed signal</span>
          <strong data-testid="ide-verify-repair-signal">
            {selectedFailureDisplayLabel ?? selectedFailureExplanationCase.signal}
          </strong>
        </div>
        <div className="ide-verify-repair-panel__fact">
          <span>Expected</span>
          <strong data-testid="ide-verify-repair-expected">
            {selectedFailureExplanationCase.expected}
          </strong>
        </div>
        <div className="ide-verify-repair-panel__fact">
          <span>Observed</span>
          <strong data-testid="ide-verify-repair-observed">
            {selectedFailureExplanationCase.actual}
          </strong>
        </div>
      </div>

      <div className="ide-verify-repair-panel__inputs" data-testid="ide-verify-repair-inputs">
        <span>Input vector</span>
        {selectedFailureInputs && selectedFailureInputs.length > 0 ? (
          <div className="ide-verify-repair-panel__chips">
            {selectedFailureInputs.map((entry, index) => (
              <code key={`${entry.label || 'input'}-${index}`}>
                {entry.label}={entry.value}
              </code>
            ))}
          </div>
        ) : (
          <code>no input snapshot available</code>
        )}
        <div className="ide-verify-repair-panel__scope" data-testid="ide-verify-repair-scope-summary">
          <span>Repair scope</span>
          <strong>
            {selectedFailureRowRepairTargets.length} failed output{selectedFailureRowRepairTargets.length === 1 ? '' : 's'} in this row,
            {' '}{allFailedRepairTargets.length} failed output{allFailedRepairTargets.length === 1 ? '' : 's'} total.
          </strong>
          <p>Use observed only when the circuit behavior is correct and the expected answer is the mistake.</p>
        </div>
      </div>

      <div className="ide-verify-repair-panel__actions">
        <div className="ide-verify-repair-panel__action-path" data-testid="ide-verify-repair-testbench-path">
          <span className="ide-verify-repair-panel__path-label">Expected/testbench repair</span>
          <div className="ide-verify-repair-panel__path-actions">
            <IdeButton
              tone="secondary"
              onClick={handleEditExpectedOutputs}
              testId="ide-verify-repair-edit-expected"
              title="Edit the expected outputs in the testbench."
            >
              Edit
            </IdeButton>
            <IdeButton
              tone={expectedRepairIsPrimary ? 'primary' : 'secondary'}
              onClick={() => handleFailureAcceptObserved(selectedFailureExplanationCase)}
              disabled={
                selectedFailureExplanationCase.actual !== '0' &&
                selectedFailureExplanationCase.actual !== '1'
              }
              testId="ide-verify-repair-use-observed"
              title="Use the observed value for this failed expected-output cell."
            >
              Use observed cell
            </IdeButton>
            <IdeButton
              tone="secondary"
              onClick={handleFailureAcceptObservedRow}
              disabled={selectedFailureRowRepairTargets.length <= 1}
              testId="ide-verify-repair-use-observed-row"
              title="Use observed values for all failed outputs in the selected row."
            >
              Use observed row
            </IdeButton>
            <IdeButton
              tone="secondary"
              onClick={handleFailureAcceptObservedAll}
              disabled={allFailedRepairTargets.length <= 1}
              testId="ide-verify-repair-use-observed-all"
              title="Use observed values for all failed outputs in this run."
            >
              Use all observed
            </IdeButton>
          </div>
        </div>
        <div className="ide-verify-repair-panel__action-path" data-testid="ide-verify-repair-design-path">
          <span className="ide-verify-repair-panel__path-label">Design repair</span>
          <div className="ide-verify-repair-panel__path-actions">
            {(onGoToDesign || onGoToDesignWithInputs || onDebugTickSelected) ? (
              <IdeButton
                tone={designRepairIsPrimary ? 'primary' : 'secondary'}
                onClick={() => handleInspectFailureInDesign(selectedFailureExplanationCase)}
                testId="ide-verify-repair-open-design"
                title="Inspect this failed output in Design."
              >
                Inspect Design
              </IdeButton>
            ) : null}
            <IdeButton
              tone={rerunRepairIsPrimary ? 'primary' : 'secondary'}
              onClick={() => handleRunWithPreflight(true)}
              disabled={runState === 'running'}
              testId="ide-verify-repair-rerun"
              title="Rerun Compare with the current checks."
            >
              Rerun
            </IdeButton>
          </div>
        </div>
      </div>
    </section>
  ) : null;

  return (
    <IdeSurfaceLayout
      mode="verify"
      layoutIntent="workbench"
      consoleHasBlocking={sessionSignalsAssertionFailure}
      consoleHasEntries={false}
      leftDockMode={verifyLayoutPolicy.leftDockMode}
      rightDockMode={verifyLayoutPolicy.rightDockMode}
      rightDockCanCollapse={false}
      consoleMode={verifyLayoutPolicy.consoleMode}
      shellDensity="immersive"
      surfaceFrame="edge-to-edge"
      productSpine={{
        statusLabel: isNoCircuitTaskFirst ? 'No circuit' : sessionStatusBadgeLabel,
        statusTone: isNoCircuitTaskFirst ? 'warn' : sessionStatusTone,
        detail: isNoCircuitTaskFirst
          ? 'Open Design, load a starter, or import a project before authoring test cases.'
          : verifySession.summary,
        primaryLabel: isNoCircuitTaskFirst ? 'Open Design' : verifySession.runLabel,
        onPrimary: isNoCircuitTaskFirst ? onGoToDesign : runVerification,
        primaryDisabled: !isNoCircuitTaskFirst && runState === 'running',
        recoveryLabel: hasSessionFailureEvidence ? 'Inspect Design' : onGoToDesign ? 'Open Design' : undefined,
        onRecovery: hasSessionFailureEvidence ? handleGoToDesignFromVerify : onGoToDesign,
        doneLabel: sessionShowsAssertionMatch
          ? 'Compare PASS is current for the saved checks.'
          : 'Current expected outputs are authored and compared against observed outputs.',
        blockedLabel: isNoCircuitTaskFirst
          ? 'No circuit boundary is available to verify.'
          : sessionSignalsAssertionFailure
            ? `${failingRows.length} failing output check${failingRows.length === 1 ? '' : 's'} need repair.`
            : sessionStatus === 'stale'
              ? 'Evidence is stale after project or testbench changes.'
              : totalVectorCount === 0
                ? 'No stimulus cases authored yet.'
                : 'No blocking Verify failure selected.',
      }}
      dock={
        <section
          className="ide-verify-left-dock"
          data-testid="ide-verify-left-dock"
          data-collapsed={signalsRailCollapsed ? 'true' : 'false'}
        >
          <header
            className="ide-verify-signal-rail-header"
            data-testid="ide-verify-signal-rail-header"
          >
            <div className="ide-verify-signal-rail-toprow">
              <div className="ide-verify-signal-rail-title">
                <h3>Signals</h3>
                <span className="ide-verify-signal-rail-count" data-testid="ide-verify-signal-filter-state">
                  {showMismatchOnlySignals
                    ? `${visibleSignalCount} flagged`
                    : showAllSignals
                      ? `${signalTimeline.length} visible`
                      : `${visibleSignalCount} relevant`}
                </span>
              </div>
              <div className="ide-verify-signal-rail-actions">
                <button
                  type="button"
                  className="ide-verify-signal-rail-action-btn ide-verify-signal-rail-toggle"
                  onClick={() => setSignalsRailCollapsed((previous) => !previous)}
                  data-testid="ide-verify-signal-rail-toggle"
                  aria-expanded={signalsRailCollapsed ? 'false' : 'true'}
                >
                  {signalsRailCollapsed ? 'Expand' : 'Collapse'}
                </button>
                {(signalTimeline.length > relevantSignalTimeline.length || hiddenSignals.length > 0) ? (
                  <button
                    type="button"
                    className="ide-verify-signal-rail-action-btn"
                    onClick={() => {
                      setShowMismatchOnlySignals(false);
                      setShowAllSignals((previous) => !previous);
                    }}
                    data-testid="ide-verify-show-all-signals"
                  >
                    {showAllSignals ? 'Relevant' : 'All'}
                  </button>
                ) : null}
              </div>
            </div>
            <p className="ide-verify-signal-rail-focus" data-testid="ide-verify-signal-rail-summary">
              {selectedSignal ? (
                <>
                  <code>{selectedSignal}</code> active
                </>
              ) : hasSessionFailureEvidence ? (
                'Showing failing lanes first.'
              ) : (
                'Legend and lane filter.'
              )}
            </p>
          </header>
          <div className="ide-signal-list" data-testid="ide-verify-signal-list">
            {displaySignalTimeline.length === 0 ? (
              lastRun ? (
                <p className="ide-copy">No signal data in the last run — check circuit mapping.</p>
              ) : null
            ) : (
              (['Inputs', 'Outputs', 'Internal'] as const).map((group) => (
                <section key={group} className="ide-verify-signal-group" data-testid={`ide-verify-group-${toTestId(group)}`}>
                  <header className="ide-design-subheader ide-verify-signal-group-header">
                    <button
                      type="button"
                      className="ide-verify-group-toggle"
                      onClick={() => toggleLaneGroup(group)}
                      data-testid={`ide-verify-group-toggle-${toTestId(group)}`}
                    >
                      {effectiveCollapsedGroups[group] ? '▸' : '▾'} {group}
                    </button>
                    <span className="ide-copy">{groupedVisibleSignals[group].length}</span>
                  </header>
                  {!effectiveCollapsedGroups[group] && (
                    <div className="ide-verify-group-body">
                      {groupedVisibleSignals[group].length === 0 ? (
                        <p className="ide-copy">No {group.toLowerCase()} lanes.</p>
                      ) : (
                        groupedVisibleSignals[group].map((signalRow) => (
                          <div
                            key={signalRow.signal}
                            className="ide-verify-signal-entry"
                            onMouseEnter={() => handleSignalHover(signalRow.signal)}
                            onMouseLeave={() => handleSignalHover(null)}
                          >
                            <button
                              className={`ide-signal-row ${selectedSignal === signalRow.signal ? 'is-active' : ''}`}
                              type="button"
                              onClick={() => handleSignalSelect(signalRow.signal)}
                              data-testid={`ide-verify-signal-${toTestId(signalRow.signal)}`}
                            >
                              {signalRow.signal}
                            </button>
                            {hasSessionFailureEvidence &&
                            failingRows.some((row) => row.signal === signalRow.signal) ? (
                              <span className="ide-verify-signal-entry-badge">Mismatch</span>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        </section>
      }
      inspector={null}
      console={
        <section className="ide-verify-console" data-testid="ide-verify-console">
          <header className="ide-design-diagnostics-drawer-header">
            <h3>Activity</h3>
            <IdeStatusPill tone={sessionStatusTone} data-testid="ide-verify-console-status">
              {sessionStatusBadgeLabel}
            </IdeStatusPill>
          </header>
          <div className="ide-design-diagnostics-list">
            {hasResults ? (
              <>
                <article className="ide-design-diagnostic-row">
                  <div className="ide-design-diagnostic-row-header">
                    <code>VERIFY</code>
                    <span>
                      Scenario <strong>{lastRun?.scenarioName ?? 'n/a'}</strong> completed at{' '}
                      <code>{lastRun?.generatedAtIso ?? 'n/a'}</code>.
                    </span>
                  </div>
                </article>
                <article className="ide-design-diagnostic-row">
                  <div className="ide-design-diagnostic-row-header">
                    <code>HASH</code>
                    <span data-testid="ide-verify-console-hash">
                      report=<code>{lastRun?.reportHash ?? '—'}</code>
                    </span>
                  </div>
                </article>
                {hasSessionFailureEvidence && firstFailure ? (
                  <article className="ide-design-diagnostic-row is-error">
                    <div className="ide-design-diagnostic-row-header">
                      <code>FIRST_FAIL</code>
                      <span>
                        tick <code>{firstFailure.tick}</code> signal <code>{firstFailure.signal}</code>
                      </span>
                    </div>
                  </article>
                ) : null}
              </>
            ) : (
              <p className="ide-copy">Run the current stimulus to populate deterministic activity output.</p>
            )}
          </div>
        </section>
      }
    >
      <IdePanel
        className="ide-verify-panel"
        testId="ide-verify-panel"
      >
        <VerifyHeaderRegion>
        {verifyMode !== 'blocked' ? (
          <VerifyContextHeader
            projectName={projectName?.trim() ? projectName.trim() : 'Untitled project'}
            board={board?.trim() ? board.trim() : 'Basys3'}
            stateLabel={
              runState === 'running'
                ? 'Running'
                : verifyMode === 'blocked'
                  ? 'Blocked'
                  : isNoCircuitTaskFirst
                    ? 'No circuit'
                  : isRunStale
                    ? 'Stale'
                    : sessionShowsAssertionMatch
                      ? 'Pass'
                      : sessionSignalsAssertionFailure
                        ? 'Fail'
                        : sessionShowsTraceEvidence
                          ? 'Observation only'
                          : isDraftSession && totalVectorCount === 0
                            ? 'Not started'
                            : 'Not run'
            }
            stateTone={
              runState === 'running'
                ? 'running'
                : isRunStale
                  ? 'stale'
                  : isNoCircuitTaskFirst
                    ? 'attention'
                  : sessionShowsAssertionMatch
                    ? 'pass'
                    : sessionSignalsAssertionFailure
                      ? 'fail'
                      : sessionShowsTraceEvidence
                        ? 'idle'
                        : isDraftSession && totalVectorCount === 0
                          ? 'attention'
                          : 'idle'
            }
            modeLabel={nextRunIsCompare ? 'Compare checks' : 'Observe only'}
            nextActionHint={
              runState === 'running'
                ? 'Verifying the current circuit…'
                : verifyMode === 'blocked'
                  ? 'Blocked — fix Design or Map Pins first.'
                  : isNoCircuitTaskFirst
                    ? 'Open Design, load a course starter, or recover/import HDL before running Verify.'
                  : sessionSignalsAssertionFailure
                    ? 'Open the first failing check, then update Design or expected outputs.'
                    : sessionShowsAssertionMatch
                      ? 'Trusted comparison evidence. Continue to Map Pins or Export when ready.'
                      : isRunStale
                        ? 'This result is stale because the design changed. Re-run Verify.'
                        : isDraftSession && totalVectorCount === 0
                          ? 'Add stimulus rows or seed a starter set, then Run Verify.'
                          : 'Press Run to record observed outputs for the current stimulus.'
            }
            scenarioName={
              activeScenario?.name?.trim()
                ? activeScenario.name.trim()
                : lastRun?.scenarioName ?? null
            }
          />
        ) : null}
        <div className="ide-surface-command-stack ide-verify-chrome-stack">
        {/* ── Unified chrome: authority callout + procedure row share one card (hidden in blocked mode) ── */}
        {verifyMode !== 'blocked' && !isNoCircuitTaskFirst && (
        <VerifyCommandBar
          leadingPanel={
            primaryStatus && !compactPrimaryStatusAction ? (
              <VerifyPrimaryStatusArea
                {...primaryStatus}
                density="embedded"
                footnote={
                  hasStaleAuthoredReference
                    ? 'Default next run will use stimulus-only tracing until you choose an action above.'
                    : undefined
                }
                footnoteTestId={hasStaleAuthoredReference ? 'ide-verify-stale-reference-mode' : undefined}
              />
            ) : undefined
          }
          isCompareMode={nextRunIsCompare}
          onSetObserve={handleSetObserveMode}
          onSetCompare={handleSetCompareMode}
          compareAvailable={totalExpectedCaseCount > 0}
          onRun={() => handleRunWithPreflight()}
          runLabel={compactCommandRunLabel}
          runDisabled={runState === 'running'}
          runPulsing={readyDraftCanRun}
          onGenerate={handleGenerateBasicVectors}
          generateLabel={isSequentialRun ? 'Generate starter stimulus' : 'Seed stimulus'}
          showGenerate={isFirstRunState || totalVectorCount === 0}
          onSaveAsExpected={canSetOracle ? handleSetOracleExpected : undefined}
          showSaveAsExpected={Boolean(canSetOracle && !isFirstRunState)}
          statusLabel={sessionStatusBadgeLabel}
          statusTone={sessionStatusTone}
          sessionStatusBadge={sessionStatusBadgeLabel}
          sessionModeLabel={undefined}
          sessionTitle={undefined}
          referenceModeLabel={sessionSignalsAssertionFailure ? undefined : referenceModeLabel}
          primaryStatusTitle={compactPrimaryStatusAction ? primaryStatus?.title : undefined}
          primaryStatusMessage={compactPrimaryStatusAction ? primaryStatus?.message : undefined}
          compactStatusActionLabel={compactPrimaryStatusAction ? 'Project → Map Pins' : undefined}
          compactStatusActionTone={compactPrimaryStatusAction?.tone === 'primary' ? 'secondary' : compactPrimaryStatusAction?.tone}
          compactStatusActionTestId={compactPrimaryStatusAction?.testId}
          onCompactStatusAction={compactPrimaryStatusAction?.onClick}
          isSequential={isSequentialRun}
          evidenceLabel={commandBarEvidenceLabel}
          evidenceTone={
            lastRun && sessionShowsCompareEvidence
              ? (failingRows.length === 0 ? 'pass' : 'fail')
              : lastRun && sessionShowsTraceEvidence
                ? 'idle'
                : undefined
          }
          coverageLabel={sessionSignalsAssertionFailure ? undefined : commandBarCoverageLabel}
          sessionMetricsRow={verifySessionMetricsRow}
          showAnalysisToggle={Boolean(lastRun)}
          analysisOpen={drawerOpen}
          analysisHint={analysisDrawerHint}
          onToggleAnalysis={() => setDrawerOpen((prev) => !prev)}
          showEditCases={hasSessionFailureEvidence}
          onEditCases={handleEditExpectedOutputs}
          showGoToDesign={Boolean(lastRun) && (Boolean(onGoToDesign) || Boolean(onGoToDesignWithInputs))}
          onGoToDesign={handleGoToDesignFromVerify}
          goToDesignTick={selectedTick}
          experimentScenarioName={activeScenario?.name ?? lastRun?.scenarioName ?? verifyScenarioName}
          experimentCaseLabel={lastRun && !sessionSignalsAssertionFailure ? (selectedTick != null ? `Case t${selectedTick}` : 'No case selected') : null}
          experimentTimingHint={lastRun && !sessionSignalsAssertionFailure && isSequentialRun ? sequencerModeLabel : null}
        />
        )}
        </div>
        </VerifyHeaderRegion>

        {guidedLabTask ? (
          <section className="ide-guided-lab-card" data-testid="ide-verify-guided-full-adder-truth-table">
            <div>
              <p className="ide-surface-block-label">Active lab</p>
              <h3>{guidedLabTask.shortTitle} truth table</h3>
              <p>
                Create the eight A/B/Cin cases with saved Sum and Cout expectations. This replaces only
                the authored Verify case list after confirmation.
              </p>
              <div className="ide-guided-lab-checklist">
                <span className={`ide-guided-lab-check ${guidedLabDesignChecklist?.readyForVerify ? 'is-complete' : 'is-missing'}`}>
                  <strong>{guidedLabDesignChecklist?.readyForVerify ? 'OK' : 'TODO'}</strong>
                  Design checklist
                </span>
                <span className={`ide-guided-lab-check ${totalVectorCount >= 8 ? 'is-complete' : 'is-missing'}`}>
                  <strong>{totalVectorCount >= 8 ? 'OK' : 'TODO'}</strong>
                  {totalVectorCount} Verify case{totalVectorCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <div className="ide-guided-lab-actions">
              {onGoToDesign ? (
                <IdeButton tone="secondary" onClick={onGoToDesign} testId="ide-verify-guided-full-adder-open-design">
                  Open Design
                </IdeButton>
              ) : null}
              <IdeButton
                tone="primary"
                onClick={onCreateGuidedLabTruthTable}
                disabled={!guidedLabDesignChecklist?.readyForVerify || !onCreateGuidedLabTruthTable}
                testId="ide-verify-create-full-adder-truth-table"
              >
                Create Full Adder truth table
              </IdeButton>
            </div>
          </section>
        ) : null}

        <VerifyResultRegion>
        {/* ── Result / failure context panels ────────────────────────────── */}
        {drawerOpen && hasSessionFailureEvidence && failureDiagnosis.length > 0 && (
          <div className="ide-verify-fail-diagnosis" data-testid="ide-verify-fail-diagnosis">
            <span className="ide-verify-fail-diagnosis-header" data-testid="ide-verify-fail-diagnosis-header">What to fix first</span>
            {failureDiagnosis.map((item) => (
              <div key={item.signal} className="ide-verify-fail-diagnosis-row" data-testid="ide-verify-fail-diagnosis-row">
                <span className="ide-verify-fail-diagnosis-label">{item.label}</span>
                <span className="ide-verify-fail-diagnosis-action">{item.action}</span>
              </div>
            ))}
          </div>
        )}

        {drawerOpen && hasSessionFailureEvidence && verifyHint && (
          <IdeCallout tone="info" title="Something to investigate" testId="ide-verify-hint-callout" className="ide-callout--hint">
            {verifyHint}
          </IdeCallout>
        )}

        {drawerOpen && hasSessionFailureEvidence && isStarterScenario && (
          <IdeCallout tone="warn" testId="ide-verify-auto-vector-fail-note">
            <span>
              <strong>Ran with starter vectors.</strong>{' '}
              {isSequentialRun
                ? 'Starter vectors may not drive your clock correctly. Author a scenario with explicit clock transitions to test your design.'
                : 'Author your own scenario with specific saved checks when you want explicit output verification.'}
            </span>
          </IdeCallout>
        )}

        {drawerOpen && hasSessionFailureEvidence && mappingComplete !== false && onGoToExport && (
          <div className="ide-verify-export-available-note" data-testid="ide-verify-export-available">
            <span className="ide-verify-export-available-label">
              Your exported HDL is still available.{' '}
              {isStarterScenario
                ? 'Export remains advisory until you author a real comparison scenario.'
                : 'Export reflects your current circuit — verify trust is separate from HDL availability.'}
            </span>
            <IdeButton tone="ghost" onClick={onGoToExport} testId="ide-verify-go-to-export">
              Go to Export →
            </IdeButton>
          </div>
        )}

        {!isFirstRunState && lastRun && sessionShowsAssertionMatch && (
          <section
            className={`ide-verify-run-proof ide-verify-run-proof--pass ide-verify-pass-hero${
              lastRun.qualification === 'incomplete-mapping' ? ' ide-verify-pass-hero--incomplete' : ''
            }`}
            data-testid="ide-verify-pass-hero"
          >
            <div className="ide-verify-run-proof-main">
              <div className="ide-verify-run-proof-copy">
                <span className="ide-verify-run-proof-eyebrow">Latest run</span>
                <strong
                  className="ide-verify-run-proof-title"
                  data-testid={sessionShowsAssertionMatch ? 'ide-verify-pass-hero-title' : undefined}
                >
                  {runProofTitle}
                </strong>
                <p
                  className="ide-verify-run-proof-summary"
                  data-testid={sessionShowsAssertionMatch ? 'ide-verify-pass-hero-meta' : undefined}
                >
                  {runProofSummary}
                </p>
                <p className="ide-verify-run-proof-authority" data-testid="ide-verify-authority-note">
                  <strong>What this means:</strong>{' '}
                  {isRunStale
                    ? `The waveform and checks here belong to an older build (${shortenHash(lastRun.deterministicHash)}) than your current circuit (${shortenHash(deterministicHash)}). Re-run Verify when you are ready.`
                    : lastRun.qualification === 'incomplete-mapping'
                      ? 'Pass or fail reflects this Verify run: your saved test vectors were compared to the simulation. Change the design in Design, or finish board pins on Project — then return here to re-check.'
                      : 'Your saved checks matched this run. Change the circuit or board pins if you need different behavior, then re-run Verify when you are ready.'}
                </p>
              </div>
              <div className="ide-verify-run-proof-actions">
                {sessionShowsAssertionMatch && (
                  <>
                    {lastRun.qualification === 'incomplete-mapping' ? (
                      <>
                        <span data-testid="ide-verify-cta-continue">
                          <IdeButton
                            tone="primary"
                            onClick={onOpenProjectVectors}
                            testId="ide-verify-pass-hero-open-project-mappins"
                          >
                            Open Project — Map Pins
                          </IdeButton>
                        </span>
                        {onGoToHardware ? (
                          <IdeButton
                            tone="secondary"
                            onClick={onGoToHardware}
                            testId="ide-verify-pass-hero-hardware"
                          >
                            View on Hardware
                          </IdeButton>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {onGoToHardware ? (
                          <span data-testid="ide-verify-cta-continue">
                            <IdeButton tone="primary" onClick={onGoToHardware} testId="ide-verify-pass-hero-hardware">
                              Continue to Hardware
                            </IdeButton>
                          </span>
                        ) : null}
                        {onGoToExport ? (
                          <IdeButton tone="secondary" onClick={onGoToExport} testId="ide-verify-pass-hero-export">
                            Open Export
                          </IdeButton>
                        ) : null}
                      </>
                    )}
                    {(onGoToDesign || onGoToDesignWithInputs || onDebugTickSelected) && (
                      <IdeButton tone="secondary" onClick={handleGoToDesignFromVerify} testId="ide-verify-pass-hero-design">
                        Back to Design
                      </IdeButton>
                    )}
                  </>
                )}
                {hasSessionFailureEvidence && (
                  <>
                    <IdeButton tone="primary" onClick={handleJumpToFirstFailure} testId="ide-verify-run-proof-inspect">
                      Inspect first mismatch
                    </IdeButton>
                  <IdeButton tone="secondary" onClick={handleEditExpectedOutputs} testId="ide-verify-run-proof-edit-vectors">
                      Open checks
                    </IdeButton>
                    {(onGoToDesign || onGoToDesignWithInputs || onDebugTickSelected) && (
                      <IdeButton tone="ghost" onClick={handleGoToDesignFromVerify} testId="ide-verify-run-proof-design">
                        Open in Design
                      </IdeButton>
                    )}
                  </>
                )}
                {sessionShowsTraceEvidence && canSetOracle && (
                  <IdeButton tone="primary" onClick={handleSetOracleExpected} testId="ide-verify-run-proof-oracle">
                    Save observed outputs
                  </IdeButton>
                )}
              </div>
            </div>
            <details className="ide-verify-run-proof-facts" data-testid="ide-verify-run-proof-facts">
              <summary className="ide-verify-run-proof-facts-summary">Build hashes and scenario (optional detail)</summary>
              <dl className="ide-verify-run-proof-grid">
                {runProofFacts.map((fact) => (
                  <div key={fact.label} className="ide-verify-run-proof-item">
                    <dt>{fact.label}</dt>
                    <dd title={fact.fullValue}>
                      {fact.label.includes('build') || fact.label.includes('hash') ? <code>{fact.value}</code> : fact.value}
                    </dd>
                  </div>
                ))}
                {lastRun.qualification === 'incomplete-mapping' && unmappedOutputLabels.length > 0 && (
                  <div className="ide-verify-run-proof-item ide-verify-run-proof-item--warning">
                    <dt>Unmapped outputs</dt>
                    <dd data-testid="ide-verify-incomplete-output-names">
                      {unmappedOutputLabels.slice(0, 3).join(', ')}
                      {unmappedOutputLabels.length > 3 ? ` +${unmappedOutputLabels.length - 3} more` : ''}
                    </dd>
                  </div>
                )}
                {oracleApplied && (
                  <div className="ide-verify-run-proof-item ide-verify-run-proof-item--accent">
                    <dt>Expected outputs</dt>
                    <dd data-testid="ide-verify-oracle-badge">Locked from observed run</dd>
                  </div>
                )}
              </dl>
            </details>
          </section>
        )}

        {sessionSignalsAssertionFailure && oracleApplied && (
          <IdeCallout tone="info" testId="ide-verify-oracle-applied-note">
            Expected values updated — re-run to confirm.
          </IdeCallout>
        )}

        {previewingVectorId && (
          <div className="ide-verify-preview-banner" data-testid="ide-verify-preview-banner">
            <span>Previewing vector —</span>
            <a
              className="ide-verify-preview-link"
              onClick={() => { onGoToDesign?.(); }}
            >
              Switch to Design view
            </a>
            <span>to see gate states</span>
            <button
              className="ide-verify-preview-clear"
              onClick={() => setPreviewingVectorId(null)}
              title="Clear preview"
            >
              ✕
            </button>
          </div>
        )}
        </VerifyResultRegion>

        <VerifyWorkspaceRegion
          data-hierarchy-surface="verify"
          data-hierarchy-role="context"
        >
        {isNoCircuitTaskFirst && (
          <section
            className="ide-verify-no-circuit-task"
            data-testid="ide-verify-no-circuit-task"
            aria-label="Verify needs a circuit before it can run"
          >
            <div className="ide-verify-no-circuit-copy">
              <span className="ide-surface-block-label">Verify starts after Design has a circuit</span>
              <h2 className="ide-verify-no-circuit-title">Nothing to verify yet</h2>
              <p className="ide-verify-no-circuit-summary">
                Build a circuit in Design, load a course starter from Project, or recover/import HDL before running observed or saved checks.
              </p>
            </div>
            <div className="ide-verify-no-circuit-actions">
              {onGoToDesign && (
                <IdeButton
                  tone="primary"
                  onClick={onGoToDesign}
                  testId="ide-verify-no-circuit-open-design"
                >
                  Open Design
                </IdeButton>
              )}
              <IdeButton
                tone="secondary"
                onClick={onOpenProjectVectors}
                testId="ide-verify-no-circuit-load-starter"
              >
                Load starter
              </IdeButton>
              {onGoToImport && (
                <IdeButton
                  tone="secondary"
                  onClick={onGoToImport}
                  testId="ide-verify-no-circuit-import-recover"
                >
                  Import / Recover
                </IdeButton>
              )}
            </div>
            <ol className="ide-verify-no-circuit-steps">
              <li>Add inputs, outputs, and logic in Design.</li>
              <li>Return to Verify to observe outputs or compare saved checks.</li>
              <li>Continue through the RedByte workflow after the circuit behavior is known.</li>
            </ol>
          </section>
        )}
        <div
          className="ide-verify-lab-frame"
          data-testid="ide-verify-lab-frame"
          data-no-circuit-hidden={isNoCircuitTaskFirst ? 'true' : undefined}
        >
        <div
          className="ide-verify-lab-grid"
          data-testid="ide-verify-lab-grid"
          data-stimulus-layout={stimulusPanelCollapsed ? 'collapsed' : 'expanded'}
          data-verify-workflow-phase={verifyWorkflowPhase}
          data-workspace-mode={verifyWorkspaceMode}
        >
        <VerifyStimulusRegion data-panel-state={stimulusPanelCollapsed ? 'collapsed' : 'expanded'}>

        {/* ── BLOCKED mode entry surface ─────────────────────────────────── */}
        {verifyMode === 'blocked' && (
          <div className="ide-verify-entry-blocked" data-testid="ide-verify-entry-blocked">
            <h4 className="ide-verify-entry-blocked-title">Cannot verify this circuit</h4>
            <p className="ide-verify-entry-blocked-reason">
              This circuit contains components that cannot be simulated yet.
              Remove the unsupported component to run verification.
            </p>
            {onGoToDesign && (
              <IdeButton
                tone="primary"
                onClick={onGoToDesign}
                testId="ide-verify-blocked-fix-path"
              >
                Fix in Design
              </IdeButton>
            )}
          </div>
        )}

        {/* ── First-run hero panel — only when no vectors yet; once canvas is populated, step aside ── */}
        

        {/* TRACE callout moved to bottom workbench area — canonical position after results zone */}

        {/* Zone label, IO summary, prerun lanes retired — canvas is self-explanatory */}

        {/* Schema-change banner — neutral info when circuit interface changes */}
        {showSchemaChangeBanner && (
          <div className="ide-verify-schema-change-banner" data-testid="ide-verify-schema-change-banner" role="status">
            <span className="ide-verify-schema-change-msg">
              Circuit interface updated — inputs or outputs changed.
              {someVectorsOrphaned
                ? ' Some vectors reference old signals and will be skipped.'
                : ' Review your vectors to confirm they match the new design.'}
            </span>
            <IdeButton
              tone="primary"
              onClick={() => { setShowSchemaChangeBanner(false); handleGenerateBasicVectors(); }}
            >
              Regenerate vectors
            </IdeButton>
            <button
              type="button"
              className="ide-verify-schema-dismiss-btn"
              onClick={() => setShowSchemaChangeBanner(false)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scenario library strip — rendered whenever scenario library props are provided */}
        {scenarios && scenarios.length > 0 && (!isFirstRunState || scenarios.length > 1) && (
          <ScenarioLibraryHeader
            scenarios={scenarios}
            activeScenarioId={activeScenarioId ?? null}
            onSwitch={(id) => onSwitchScenario?.(id)}
            onCreate={() => onCreateScenario?.()}
            onDuplicate={() => onDuplicateScenario?.()}
            onRename={(name) => onRenameScenario?.(name)}
            onDelete={(id) => onDeleteScenario?.(id)}
          />
        )}
        {activeScheduleContract?.timingMode === 'manual_event_driven_lab' && (
          <VerifyLabSequencerPanel
            modeLabel={sequencerModeLabel}
            scenarioName={activeScenario?.name ?? lastRun?.scenarioName ?? verifyScenarioName}
            stepCount={labSequencerSteps.length}
            selectedTick={selectedTick}
            steps={labSequencerSteps}
            editableSteps={editableScenarioSteps}
            stateObservationLabel={stateObservationLabel}
            stateDetails={selectedStateObservationDetails}
            onSelectStepTick={(tick) => {
              setSelectedTick(tick);
              setIsStepMode(true);
            }}
            onQuickAddStep={(kind) => {
              if (!onAppendScenarioStep) return;
              const defaultInput = inputFields[0]?.id;
              const defaultOutput = outputFields[0]?.id;
              if (kind === 'set_bus') {
                onAppendScenarioStep({
                  kind,
                  targetRef: defaultInput,
                  value: defaultInput ? { [defaultInput]: 1 } : undefined,
                  label: 'Quick set bus/slice',
                });
                return;
              }
              if (kind === 'pulse_step') {
                const pulseTarget =
                  Object.entries(signalRoleLookup).find(([, role]) => role === 'clock')?.[0] ?? defaultInput;
                onAppendScenarioStep({
                  kind,
                  targetRef: pulseTarget,
                  value: 1,
                  label: 'Quick pulse step',
                });
                return;
              }
              if (kind === 'apply_reset') {
                const resetTarget =
                  Object.entries(signalRoleLookup).find(([, role]) => role === 'reset')?.[0] ?? defaultInput;
                onAppendScenarioStep({
                  kind,
                  targetRef: resetTarget,
                  value: 1,
                  label: 'Quick apply reset',
                });
                return;
              }
              onAppendScenarioStep({
                kind,
                targetRef: defaultOutput,
                expectedValue: 1,
                label: 'Quick assert output/state',
              });
            }}
            onUpdateStep={(stepId, patch) => {
              onUpdateScenarioStep?.(stepId, patch);
            }}
            onMoveStep={(stepId, direction) => {
              onMoveScenarioStep?.(stepId, direction);
            }}
            onDeleteStep={(stepId) => {
              onDeleteScenarioStep?.(stepId);
            }}
          />
        )}

        {unsupportedFeedbackDiagnostic && (
          <div
            className="ide-verify-unsupported-feedback-banner"
            data-testid="ide-verify-unsupported-feedback-banner"
          >
            <IdeCallout
              tone="error"
              title={unsupportedFeedbackDiagnostic.title}
              testId="ide-verify-unsupported-feedback"
            >
              <p className="ide-copy" style={{ margin: 0 }}>
                {unsupportedFeedbackDiagnostic.message}
              </p>
              <p className="ide-copy" style={{ margin: '8px 0 0 0' }}>
                This is not one of RedByte&apos;s supported stateful topologies. You can still trace
                the current wiring, but compare and export will stay blocked until you replace it
                with a supported latch or flip-flop primitive, or the exact 4-NAND D-latch
                topology.
              </p>
              {onGoToDesign && (
                <div className="ide-inline-actions" style={{ marginTop: 8 }}>
                  <IdeButton
                    tone="secondary"
                    onClick={onGoToDesign}
                    testId="ide-verify-unsupported-feedback-design"
                  >
                    Open Design
                  </IdeButton>
                </div>
              )}
            </IdeCallout>
          </div>
        )}

        <ScenarioBuilderPanel
          isFirstRun={isFirstRunState}
          isSequential={isSequentialRun}
          authoringModeSummary={scenarioBuilderModeSummary}
          authoringModeHint={scenarioBuilderModeHint}
          inputFields={stimulusPanelInputFields}
          outputFields={outputFields}
          authoredVectors={authoredVectors}
          totalVectorCount={totalVectorCount}
          hasAssertedExpectedCells={totalExpectedCaseCount > 0}
          selectedTick={selectedTick}
          onSelectedTickChange={handleStimulusSelectedTickChange}
          onVectorsChange={onVectorsChange}
          draftTick={draftTick}
          draftInputs={draftInputs}
          draftExpected={draftExpected}
          onDraftTickChange={setDraftTick}
          onDraftInputChange={handleDraftInputChange}
          onDraftExpectedChange={handleDraftExpectedChange}
          onAddVector={handleAddVector}
          onGenerateBasics={handleGenerateBasicVectors}
          onOpenProjectVectors={onOpenProjectVectors}
          onAutoGenerate={handleAutoGenerateVectors}
          sweepPreset={sweepPreset}
          sweepSeed={sweepSeed}
          sweepHoldTicks={sweepHoldTicks}
          onSweepPresetChange={setSweepPreset}
          onSweepSeedChange={setSweepSeed}
          onSweepHoldTicksChange={setSweepHoldTicks}
          onGenerateSweep={handleGenerateSweepVectors}
          holdN={holdN}
          onHoldNChange={setHoldN}
          onHoldN={handleHoldN}
          pulseSignal={pulseSignal}
          onPulseSignalChange={setPulseSignal}
          onPulse={handlePulse}
          vectorsAreAutoGenerated={vectorsAreAutoGenerated}
          autoVectorBannerDismissed={autoVectorBannerDismissed}
          onDismissAutoVectorBanner={handleDismissAutoVectorBanner}
          isUsingFallbackSignals={
            !(mappedSignals?.some((s) => s.direction === 'in')) &&
            !(mappedInputs && mappedInputs.length > 0)
          }
          onGoToHardware={onGoToHardware}
          detailsRef={scenarioBuilderDetailsRef}
          initialExpanded={Boolean(lastRun)}
          workbenchExpanded={scenarioWorkbenchExpanded}
          onWorkbenchExpandedChange={setScenarioWorkbenchExpanded}
          allowWorkbenchCollapse={false}
          clockLane={clockLaneConfig}
          stimulusAssist={stimulusAssist}
          runSummary={testbenchRunSummary}
        />
        </VerifyStimulusRegion>

        <VerifyWaveformRegion>
          {isDraftSession ? (
            <VerifyWaveformPlaceholder
              inputNames={stimulusPanelInputFields.map((f) => f.label ?? f.id)}
              outputNames={outputFields.map((f) => f.label ?? f.id)}
              clockName={effectiveClockPolicy?.signalLabel ?? clockSignalNames[0]}
              isSequential={isSequentialRun}
              hasVectors={totalVectorCount > 0}
              runLabel={emptyStateRunLabel}
              onRun={totalVectorCount > 0 || autoClockModeActive ? () => handleRunWithPreflight() : undefined}
              runDisabled={runState === 'running'}
              onSeed={
                totalVectorCount === 0 && (isFirstRunState || totalVectorCount === 0)
                  ? handleGenerateBasicVectors
                  : undefined
              }
              seedLabel={isSequentialRun ? 'Generate starter stimulus' : 'Seed stimulus'}
            />
          ) : <div
            className="ide-verify-workbench ide-verify-workbench-v2"
            data-testid="ide-verify-workbench"
            data-zone="results"
            data-trace-ticks={waveformTicks.length}
            data-trace-signals={signalTimeline.length}
            data-layout-mode={layoutMode}
            data-failure-layout={showInlineFailureWorkbenchPanels ? '1' : '0'}
          >
            <VerifyThreePanel
              testId="ide-verify-three-panel"
              leftPanel={showInlineFailureWorkbenchPanels ? (
                <VerifyVectorListPanel
                  rows={studentFailureRows.map((row) => ({
                    key: row.key,
                    tick: row.tick,
                    signal: row.rawSignal,
                    signalLabel: row.signalLabel,
                    expected: row.expected,
                    actual: row.actual,
                    vectorId: row.vectorId,
                    caseIndex: row.caseIndex,
                  }))}
                  selectedKey={selectedFailureKey}
                  onSelectFailureKey={handleThreePanelFailureSelect}
                  onSelectNextFailure={goToNextFail}
                  onSelectPreviousFailure={goToPrevFail}
                />
              ) : null}
              centerPanel={(
            <div className="ide-verify-console-frame">
            <div className="ide-verify-instrument-deck">
            {/* ── Results summary — at-a-glance "what happened on the last run" ── */}
            {lastRun && !(hasSessionFailureEvidence && selectedFailureExplanationCase) ? (
              <VerifyResultsSummary
                kind={
                  isRunStale
                    ? 'stale'
                    : sessionShowsAssertionMatch
                      ? 'pass'
                      : sessionSignalsAssertionFailure
                        ? 'fail'
                        : sessionShowsTraceEvidence
                          ? 'observe-done'
                          : 'not-run'
                }
                headline={
                  isRunStale
                    ? 'This result is stale because the design changed.'
                    : sessionShowsAssertionMatch
                      ? lastRun.qualification === 'incomplete-mapping'
                        ? 'Checks aligned (mapping incomplete).'
                        : 'All checks aligned with the observed run.'
                      : sessionSignalsAssertionFailure
                        ? structuralRecoveryDiagnosis
                          ? 'Compare could not check an output.'
                          : failingRows.length === 1
                            ? '1 check failed in the last run.'
                            : `${failingRows.length} checks failed in the last run.`
                        : sessionShowsTraceEvidence
                          ? 'Observed outputs recorded - no expected checks compared.'
                          : 'Run recorded.'
                }
                subline={
                  lastRun.scenarioName
                    ? `Scenario: ${lastRun.scenarioName}`
                    : undefined
                }
                metrics={(() => {
                  const list: VerifyResultsMetric[] = [];
                  if (sessionShowsCompareEvidence) {
                    list.push({
                      id: 'passed',
                      label: 'Passed',
                      value: String(Math.max(0, totalExpectedCaseCount - failingRows.length)),
                      tone: 'ok',
                    });
                    list.push({
                      id: 'failed',
                      label: 'Failed',
                      value: String(failingRows.length),
                      tone: failingRows.length > 0 ? 'blocked' : 'neutral',
                    });
                  }
                  if (typeof commandBarCoverageLabel === 'string' && commandBarCoverageLabel.trim().length > 0) {
                    list.push({
                      id: 'coverage',
                      label: 'Coverage',
                      value: commandBarCoverageLabel.trim(),
                      tone: 'neutral',
                    });
                  }
                  return list;
                })()}
                primaryActionLabel={
                  isRunStale
                    ? 'Re-run Verify'
                    : sessionSignalsAssertionFailure
                      ? structuralRecoveryDiagnosis
                        ? 'Open Design'
                        : 'Open first failing check'
                      : undefined
                }
                onPrimaryAction={
                  isRunStale
                    ? () => handleRunWithPreflight()
                    : sessionSignalsAssertionFailure
                      ? structuralRecoveryDiagnosis
                        ? handleGoToDesignFromVerify
                        : handleJumpToFirstFailure
                      : undefined
                }
                primaryActionTestId={
                  isRunStale
                    ? 'ide-verify-results-summary-rerun'
                    : sessionSignalsAssertionFailure
                      ? structuralRecoveryDiagnosis
                        ? 'ide-verify-results-summary-open-design'
                        : 'ide-verify-results-summary-open-fail'
                      : undefined
                }
              />
            ) : null}
            {structuralRecoveryPanel}
            {repairPanel}
            <section className="ide-verify-oscilloscope-stage" data-testid="ide-verify-workspace-waveform" data-state={sessionShowsAssertionMatch ? 'pass' : sessionSignalsAssertionFailure ? 'fail' : 'idle'}>
              {/* ── Oscilloscope instrument header ── */}
              <div className="ide-verify-scope-header" data-testid="ide-verify-scope-header">
                <div className="ide-verify-scope-copy">
                  <span
                    className="ide-verify-scope-label"
                    data-testid="ide-verify-scope-label"
                    title={
                      isSequentialRun
                        ? 'Observed output viewport. One tick is one sampled clock step. Teal traces are steady evidence, red marks failing assertions, and blue marks the selected tick.'
                        : 'Observed output viewport. One tick is one simulation step. Teal traces are steady evidence, red marks failing assertions, and blue marks the selected tick.'
                    }
                  >
                    Waveform truth
                  </span>
                </div>
                <div className="ide-verify-scope-header-right">
                  {selectedScopeCaseLabel ? (
                    <span className="ide-verify-scope-case-chip" data-testid="ide-verify-scope-case">
                      {selectedScopeCaseLabel}
                    </span>
                  ) : null}
                  {selectedCaseTickLabel ? (
                    <code className="ide-verify-scope-tick">{selectedCaseTickLabel}</code>
                  ) : null}
                  {selectedSignal ? (
                    <span className="ide-verify-scope-signal-chip" data-testid="ide-verify-scope-signal">
                      {selectedSignal}
                    </span>
                  ) : null}
                  {isSequentialRun && (
                    <span className="ide-verify-scope-seq-badge" data-testid="ide-verify-seq-badge">
                      Sequential
                    </span>
                  )}
                </div>
              </div>
              <div className="ide-verify-waveform-bar" data-testid="ide-verify-waveform-bar">
                {canStepThroughCases ? (
                  <div className="ide-verify-step-controls" data-testid="ide-verify-step-controls">
                    <IdeButton
                      tone={isStepMode ? 'secondary' : 'ghost'}
                      onClick={() => setIsStepMode((previous) => !previous)}
                      testId="ide-verify-step-mode-toggle"
                      title={
                        activeScheduleContract?.timingMode === 'manual_event_driven_lab'
                          ? 'Lab-style timing: walk one test case at a time and inspect the signal snapshot below the waveform.'
                          : 'Walk one test case at a time (same tick navigation as the scrubber).'
                      }
                    >
                      {isStepMode ? 'Step cases on' : 'Step cases'}
                    </IdeButton>
                    {isStepMode ? (
                      <div className="ide-verify-step-bar" data-testid="ide-verify-step-bar">
                        <IdeButton tone="secondary" onClick={goToPrevStep} disabled={totalSteps <= 1} testId="ide-verify-step-prev">
                          ← Prev
                        </IdeButton>
                        <span className="ide-verify-step-position" data-testid="ide-verify-step-position">
                          {selectedCasePositionLabel}
                        </span>
                        <IdeButton tone="secondary" onClick={goToNextStep} disabled={totalSteps <= 1} testId="ide-verify-step-next">
                          Next →
                        </IdeButton>
                        {onDebugTickSelected && selectedTick !== null ? (
                          <IdeButton tone="ghost" onClick={handleDebugInDesign} testId="ide-verify-step-debug-design">
                            Show in Design
                          </IdeButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {/* Left: Fail navigator */}
                <div className="ide-verify-wfbar-group ide-verify-wfbar-left" data-testid="ide-verify-fail-nav">
                  {hasSessionFailureEvidence && failTicksSorted.length > 0 ? (
                    <>
                      <IdeButton tone="secondary" onClick={handleJumpToFirstFailure} testId="ide-verify-fail-nav-first">
                        First mismatch
                      </IdeButton>
                      {selectedFailureCase && (
                        <span className="ide-verify-fail-nav-summary" data-testid="ide-verify-fail-nav-summary">
                          <code>{selectedFailureDisplayLabel ?? selectedFailureCase.signal}</code>
                          <span className="ide-verify-fail-nav-summary__tick">t{selectedFailureCase.tick}</span>
                          <span className="ide-verify-fail-nav-summary__values ide-copy">
                            expected <code>{selectedFailureCase.expected}</code> · got <code>{selectedFailureCase.actual}</code>
                          </span>
                        </span>
                      )}
                      {selectedFailurePositionLabel && (
                        <span className="ide-verify-fail-nav-position ide-copy">
                          {selectedFailurePositionLabel}
                        </span>
                      )}
                      <span
                        className="ide-verify-fail-nav-waveform-hint ide-copy"
                        data-testid="ide-verify-fail-nav-waveform-hint"
                      >
                        Same names appear as lanes in the chart under this bar.
                      </span>
                    </>
                  ) : (
                    <span className="ide-copy ide-verify-wfbar-meta" data-testid="ide-verify-run-state">
                      {signalTimeline.length} signals · {allWaveformTicks.length} ticks · {runState.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="ide-verify-waveform-transport" data-testid="ide-verify-waveform-transport">
                {/* Center: Zoom + Row density */}
                <div className="ide-verify-wfbar-group ide-verify-wfbar-center">
                  <span className="ide-verify-zoom-label ide-copy">Tick range</span>
                  {(['all', 'fail', 'window'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`ide-verify-zoom-btn ${tickZoom === mode ? 'is-active' : ''}`}
                      onClick={() => {
                        setTickZoom(mode);
                        if (mode === 'window') setTickWindowCenter(selectedTick);
                      }}
                      data-testid={`ide-verify-zoom-${mode}`}
                    >
                      {mode === 'all' ? 'All ticks' : mode === 'fail' ? 'Fail window' : 'Selected'}
                    </button>
                  ))}
                </div>

                {/* Right: Tick scrubber + advanced tools */}
                <div className="ide-verify-wfbar-group ide-verify-wfbar-right">
                  {allWaveformTicks.length > 0 && selectedTick !== null ? (
                    <label className="ide-verify-scrubber-field" data-testid="ide-verify-tick-nav">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(allWaveformTicks.length - 1, 0)}
                        step={1}
                        value={Math.max(stepIndex, 0)}
                        onChange={(event) => {
                          const nextIndex = Number(event.target.value);
                          const nextTick = allWaveformTicks[nextIndex];
                          if (typeof nextTick === 'number') {
                            setSelectedTick(nextTick);
                          }
                        }}
                        data-testid="ide-verify-tick-scrubber"
                      />
                      <code data-testid="ide-verify-selected-tick" style={{ minWidth: 24 }}>
                        {selectedCaseTickLabel ?? `t${selectedTick}`}
                      </code>
                    </label>
                  ) : null}
                  {allWaveformTicks.length > 0 && (
                    <IdeButton
                      tone="ghost"
                      onClick={() => setWaveformToolsOpen((previous) => !previous)}
                      testId="ide-verify-waveform-tools-toggle"
                    >
                      {waveformToolsOpen ? 'Hide tools' : 'Waveform tools'}
                    </IdeButton>
                  )}
                </div>
                </div>
              </div>
              {waveformToolsOpen && (
                <div className="ide-verify-waveform-tools-panel" data-testid="ide-verify-waveform-tools-panel">
                  <div className="ide-verify-waveform-tools-section">
                    <span className="ide-verify-waveform-tools-label ide-copy">View</span>
                    <button
                      type="button"
                      className="ide-verify-zoom-btn"
                      onClick={() => setTickWidth((prev) => clampTickWidth(prev - 8))}
                      data-testid="ide-verify-zoom-out"
                      title="Zoom out (narrower ticks)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="ide-verify-zoom-btn"
                      onClick={() => setTickWidth((prev) => clampTickWidth(prev + 8))}
                      data-testid="ide-verify-zoom-in"
                      title="Zoom in (wider ticks)"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="ide-verify-zoom-btn"
                      onClick={fitWaveformView}
                      data-testid="ide-verify-zoom-fit"
                      title="Fit all ticks in view"
                    >
                      Fit
                    </button>
                    <span className="ide-verify-waveform-tools-label ide-copy">Rows</span>
                    {(['small', 'normal', 'large'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`ide-verify-zoom-btn ${waveformDensity === d ? 'is-active' : ''}`}
                        onClick={() => setWaveformDensity(d)}
                        data-testid={`ide-verify-density-${d}`}
                      >
                        {d === 'small' ? 'S' : d === 'normal' ? 'M' : 'L'}
                      </button>
                    ))}
                  </div>
                  {selectedTick !== null && (
                    <div className="ide-verify-waveform-tools-section ide-verify-waveform-tools-section--markers">
                      <span className="ide-verify-waveform-tools-label ide-copy">Markers</span>
                      <span className="ide-verify-waveform-tools-readouts">
                        {cursorA !== null && (
                          <code className="ide-verify-scope-cursor" data-testid="ide-verify-cursor-a-value">A t{cursorA}</code>
                        )}
                        {cursorB !== null && (
                          <code className="ide-verify-scope-cursor" data-testid="ide-verify-cursor-b-value">B t{cursorB}</code>
                        )}
                        {cursorDeltaTicks !== null && (
                          <code className="ide-verify-scope-cursor" data-testid="ide-verify-cursor-delta">
                            Delta {cursorDeltaTicks} ticks
                          </code>
                        )}
                      </span>
                      <div className="ide-verify-cursor-controls" data-testid="ide-verify-cursor-controls">
                        <button
                          type="button"
                          className="ide-verify-zoom-btn"
                          onClick={() => setCursorFromSelected('A')}
                          data-testid="ide-verify-set-cursor-a"
                        >
                          Set A
                        </button>
                        <button
                          type="button"
                          className="ide-verify-zoom-btn"
                          onClick={() => setCursorFromSelected('B')}
                          data-testid="ide-verify-set-cursor-b"
                        >
                          Set B
                        </button>
                        <button
                          type="button"
                          className="ide-verify-zoom-btn"
                          onClick={() => jumpToCursor('A')}
                          disabled={cursorA === null}
                          data-testid="ide-verify-jump-cursor-a"
                        >
                          Jump A
                        </button>
                        <button
                          type="button"
                          className="ide-verify-zoom-btn"
                          onClick={() => jumpToCursor('B')}
                          disabled={cursorB === null}
                          data-testid="ide-verify-jump-cursor-b"
                        >
                          Jump B
                        </button>
                        <button
                          type="button"
                          className="ide-verify-zoom-btn"
                          onClick={clearCursors}
                          data-testid="ide-verify-clear-cursors"
                        >
                          Clear AB
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No-trace diagnostic — shown when run produced no waveform data */}
              {verifyPreflightDiagnostics.length > 0 && (
                <IdeCallout tone="error" title="Cannot verify current expectations" testId="ide-verify-preflight-guard">
                  <p className="ide-copy">
                    Fix these structural issues before treating this as a logic mismatch.
                  </p>
                  <ul className="ide-list">
                    {verifyPreflightDiagnostics.slice(0, 4).map((diagnostic, index) => (
                      <li key={`${diagnostic.code}-${diagnostic.location?.signal ?? diagnostic.id}-${diagnostic.location?.vectorId ?? index}`}>
                        <strong>{diagnostic.code}:</strong> {diagnostic.message}
                      </li>
                    ))}
                  </ul>
                  {onGoToDesign && (
                    <div className="ide-inline-actions">
                      <IdeButton
                        tone="secondary"
                        onClick={onGoToDesign}
                        testId="ide-verify-preflight-open-design"
                      >
                        Open in Design
                      </IdeButton>
                    </div>
                  )}
                </IdeCallout>
              )}
              {hasNoTrace && (
                <IdeCallout tone="error" title="No trace generated" testId="ide-verify-no-trace-guard">
                  <p className="ide-copy">The run completed but produced no waveform data.</p>
                  <ul className="ide-list">
                    <li>Circuit has no outputs mapped to IO signals — check I/O mapping in Map Pins</li>
                    <li>{sequentialGuidanceCopy.noTraceHint}</li>
                    <li>Circuit has unconnected gates — verify all nodes are wired</li>
                  </ul>
                  <div className="ide-inline-actions">
                    <IdeButton
                      tone="primary"
                      onClick={() => openFailureInDesign({ signal: '', tick: 0, expected: '', actual: '' })}
                      disabled={!onFixPath}
                      testId="ide-verify-no-trace-fix"
                    >
                      Open in Design
                    </IdeButton>
                  </div>
                </IdeCallout>
              )}

              <div
                className="ide-waveform-outer ide-verify-waveform-frame"
                data-testid="ide-verify-waveform-preview"
                data-verify-trace-only={isTraceOnly ? '1' : '0'}
              >
                <div
                  className="ide-verify-waveform-scroll"
                  ref={waveformScrollRef}
                  onWheel={handleWaveformWheel}
                  data-layout-mode={layoutMode}
                  data-testid="ide-verify-waveform-scroll"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                    if (allWaveformTicks.length === 0) return;
                    e.preventDefault();
                    setSelectedTick((prev) => {
                      const idx = prev !== null ? allWaveformTicks.indexOf(prev) : -1;
                      if (e.key === 'ArrowRight') {
                        return allWaveformTicks[Math.min(allWaveformTicks.length - 1, idx + 1)] ?? allWaveformTicks[0];
                      }
                      return allWaveformTicks[Math.max(0, idx - 1)] ?? allWaveformTicks[0];
                    });
                  }}
                >
                <WaveformViewer
                  signals={displaySignalTimeline}
                  ticks={zoomedTicks}
                  failTicks={sessionShowsCompareEvidence ? new Set(failingRows.map((row) => row.tick)) : new Set<number>()}
                  failingSignalKeys={sessionShowsCompareEvidence ? failingSignalKeys : new Set<string>()}
                  selectedTick={selectedTick}
                  cursorA={cursorA}
                  cursorB={cursorB}
                  pinnedSignals={pinnedSignals}
                  onSelectTick={setSelectedTick}
                  onSelectSignal={handleSignalSelect}
                  rowHeight={ROW_H_MAP[waveformDensity]}
                  tickWidth={tickWidth}
                  signalMeta={signalMetaMap}
                  isSequential={isSequentialRun}
                  clockSignals={clockSignals}
                  signalGroups={laneGroupBySignal}
                  onHoverSignal={handleSignalHover}
                  selectedSignal={selectedSignal}
                  emptyMessage={
                    lastRun
                      ? 'No waveform data in this run — check I/O mapping in Map Pins'
                      : 'Run the current stimulus to observe outputs'
                  }
                  ghostSignals={
                    !lastRun && mappedSignals?.length
                      ? mappedSignals.map(s => ({
                          signal: s.id,
                          label: s.label ?? s.id,
                          direction: s.direction ?? 'internal',
                        }))
                      : undefined
                  }
                />
                </div>
                {/* Signal Snapshot — shown in step mode, shows all I/O at selected tick */}
                {isStepMode && stepSnapshotRows.length > 0 && (
                  <section className="ide-verify-snapshot-panel" data-testid="ide-verify-snapshot-panel">
                    <header className="ide-design-subheader">
                      <h4>Signal Snapshot — t{selectedTick}</h4>
                    </header>
                    <div className="ide-verify-snapshot-grid" data-testid="ide-verify-snapshot-grid">
                      {stepSnapshotRows.map((entry) => (
                        <div
                          key={entry.signal}
                          className={`ide-verify-snapshot-row ide-verify-snapshot-row--${entry.status}`}
                          data-testid={`ide-verify-snapshot-${entry.signal.replace(/[^a-z0-9]/gi, '-')}`}
                        >
                          <code className="ide-verify-snapshot-signal">{entry.signal}</code>
                          <span className="ide-verify-snapshot-actual">{entry.actual}</span>
                          <span className="ide-verify-snapshot-expected">/ exp {entry.expected}</span>
                          <IdeStatusPill tone={entry.status === 'pass' ? 'ok' : 'error'}>
                            {entry.status.toUpperCase()}
                          </IdeStatusPill>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {/* Tick Readout Strip — compact value bar, visible when a tick is selected (non-step mode) */}
                {selectedTick !== null && lastRun && !isStepMode && displaySignalTimeline.length > 0 && (
                  <TickReadoutStrip
                    tick={selectedTick}
                    signals={displaySignalTimeline}
                    signalGroups={laneGroupBySignal}
                  />
                )}
              </div>
            </section>

            </div>{/* /ide-verify-instrument-deck */}
            </div>
              )}
              rightPanel={showInlineFailureWorkbenchPanels ? (
                <VerifyFailureExplanationPanel
                  failure={selectedFailureExplanationCase}
                  classification={selectedFailureClassification}
                  reasonCode={selectedFailureEvidence?.actualReason ?? null}
                  peers={studentSelectedFailurePeers.map((row) => ({
                    tick: row.tick,
                    signal: row.rawSignal,
                    signalLabel: row.signalLabel,
                    expected: row.expected,
                    actual: row.actual,
                    vectorId: row.vectorId,
                    caseIndex: row.caseIndex,
                  }))}
                  inputSnapshot={selectedFailureInputs}
                  patternSummary={selectedFailurePattern?.summary ?? null}
                  patternNextInspect={selectedFailurePattern?.nextInspect ?? null}
                  onSelectPeer={(peer) => applyFailureSelection(peer)}
                  onJumpToFix={(failure) => reviewFailureInVerify(failure)}
                  onOpenInDesign={(failure) => openFailureInDesign(failure)}
                  onAcceptObserved={handleFailureAcceptObserved}
                  onCaptureRow={handleFailureCaptureRow}
                  onCaptureSignal={handleFailureCaptureSignal}
                  onSetExpectedBit={handleFailureSetExpectedBit}
                  onClearExpected={handleFailureClearExpected}
                  onRerunCompare={() => handleRunWithPreflight(true)}
                />
              ) : null}
            />

            {Boolean(lastRun) && drawerOpen && <div className="ide-verify-supporting-strip is-open" data-zone="inspector" data-testid="ide-verify-region-inspector">
            <div className="ide-verify-drawer-body">
            <nav className="ide-verify-analysis-tab-nav" data-testid="ide-verify-analysis-tab-nav">
              <div className="ide-verify-drawer-toolbar" data-testid="ide-verify-tab-bar">
                {hasSessionFailureEvidence && (
                  <span className="ide-verify-drawer-badge">{failingRows.length} fail</span>
                )}
                {analysisDrawerHint && (
                  <span className="ide-verify-drawer-open-hint">
                    {analysisDrawerHint}
                  </span>
                )}
              </div>
              {drawerTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`ide-verify-analysis-tab${verifyTab === tab ? ' is-active' : ''}`}
                  onClick={() => setVerifyTab(tab)}
                >
                  {tab === 'why' ? 'Inspect'
                    : tab === 'mismatches' ? 'Checks'
                    : 'Vectors'}
                </button>
              ))}
            </nav>
            <div className="ide-verify-tab-panel">
              {verifyTab === 'why' && (
                <WhyInspectorPanel explanation={signalExplanation} />
              )}
              {verifyTab === 'mismatches' && (
                <section className="ide-verify-mismatch-panel" data-testid="ide-verify-mismatch-table">
                  {/* Mismatch guidance — top-level orientation before the detail */}
                  {hasSessionFailureEvidence && (
                    <div className="ide-verify-mismatch-guidance" data-testid="ide-verify-mismatch-guidance">
                      <span>Outputs don't match the expected values. If the expected values are wrong, update them below. If the circuit is wrong, fix it in Design.</span>
                      <div className="ide-inline-actions">
                        <IdeButton tone="secondary" onClick={handleEditExpectedOutputs} testId="ide-verify-mismatch-edit-vectors">
                          Open checks
                        </IdeButton>
                        {(onGoToDesign || onGoToDesignWithInputs || onDebugTickSelected) && (
                          <IdeButton tone="ghost" onClick={handleGoToDesignFromVerify} testId="ide-verify-mismatch-goto-design">
                            Open in Design
                          </IdeButton>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Fail summary — compact selected-failure header */}
                  {hasSessionFailureEvidence && (
                    <div className="ide-verify-fail-summary" data-testid="ide-verify-fail-summary-inline">
                      <span className="ide-verify-fail-summary__status">Outputs differ</span>
                      <span className="ide-verify-fail-summary__count">
                        {failingRows.length} of {runRows.length} vectors failing
                      </span>
                      {selectedFailureCase && (
                        <span className="ide-verify-fail-summary__first">
                          Selected: <code>{selectedFailureLabel ?? selectedFailureCase.signal}</code> at t{selectedFailureCase.tick}
                          {' '}expected <code>{selectedFailureCase.expected}</code> observed <code>{selectedFailureCase.actual}</code>
                        </span>
                      )}
                      {selectedFailureCase && onFixPath && (
                        <IdeButton
                          tone="secondary"
                          onClick={() => openFailureInDesign(selectedFailureCase)}
                          testId="ide-verify-jump-to-failure-card"
                        >
                          Open in Design
                        </IdeButton>
                      )}
                    </div>
                  )}
                  {/* Failure explainer — assertion mode only */}
                  {hasSessionFailureEvidence && selectedFailureCase && (
                    <div className="ide-verify-failure-explainer" data-testid="ide-verify-failure-explainer-inline">
                      <header className="ide-verify-failure-explainer__header">
                        <strong>Failure explainer</strong>
                      </header>
                      <div className="ide-verify-failure-explainer__grid">
                        <div>
                          <span>Selected mismatch tick</span>
                          <code data-testid="ide-verify-explainer-first-tick">t{selectedFailureCase.tick}</code>
                        </div>
                        <div>
                          <span>Signal</span>
                          <code data-testid="ide-verify-explainer-signal">{selectedFailureLabel ?? selectedFailureCase.signal}</code>
                        </div>
                        <div>
                          <span>Expected</span>
                          <code data-testid="ide-verify-explainer-expected">{selectedFailureCase.expected}</code>
                        </div>
                        <div>
                          <span>Observed</span>
                          <code data-testid="ide-verify-explainer-observed">{selectedFailureCase.actual}</code>
                        </div>
                      </div>
                      <div className="ide-verify-failure-explainer__inputs" data-testid="ide-verify-explainer-inputs">
                        <span>Inputs at tick</span>
                        {selectedFailureInputs && selectedFailureInputs.length > 0 ? (
                          <div className="ide-verify-failure-explainer__chips">
                            {selectedFailureInputs.map((entry, index) => (
                              <code key={`${entry.label || 'input'}-${index}`}>{entry.label}={entry.value}</code>
                            ))}
                          </div>
                        ) : (
                          <code>no input snapshot available</code>
                        )}
                      </div>
                      {selectedFailureEvidence && (
                        <details
                          className="ide-verify-failure-explainer__inputs ide-verify-technical-details"
                          data-testid="ide-verify-explainer-technical-details"
                        >
                          <summary>Technical details</summary>
                          <div className="ide-verify-failure-explainer__chips" style={{ marginTop: '0.75rem' }}>
                            <div className="ide-kv-row" data-testid="ide-verify-mismatch-case-id">
                              <span>Vector case</span>
                              <code>{selectedFailureEvidence?.vectorId ?? 'unknown'}</code>
                            </div>
                            <div className="ide-kv-row" data-testid="ide-verify-mismatch-sampled-key">
                              <span>Sampled signal key</span>
                              <code>{selectedFailureEvidence?.actualSourceKey ?? 'missing'}</code>
                            </div>
                            <div className="ide-kv-row" data-testid="ide-verify-mismatch-expected-key">
                              <span>Expected signal key</span>
                              <code>{selectedFailureEvidence?.expectedSourceKey ?? 'missing'}</code>
                            </div>
                            <div className="ide-kv-row" data-testid="ide-verify-mismatch-reason">
                              <span>Reason</span>
                              <code>
                                {selectedFailureEvidence?.actualReason === 'missing-output-sample'
                                  ? 'No sampled output matched this expected signal.'
                                  : selectedFailureEvidence?.actualReason === 'missing-output-node'
                                    ? 'The expected output row is not connected to a concrete design node.'
                                    : 'Compared saved checks against sampled outputs directly.'}
                              </code>
                            </div>
                          </div>
                        </details>
                      )}
                      {selectedFailurePattern && (
                        <div
                          className="ide-verify-failure-explainer__inputs"
                          data-testid="ide-verify-explainer-pattern"
                        >
                          <span>Likely bug shape</span>
                          <div className="ide-verify-failure-explainer__chips">
                            <span data-testid="ide-verify-explainer-pattern-summary">
                              {selectedFailurePattern.summary}
                            </span>
                          </div>
                          <div className="ide-verify-failure-explainer__chips">
                            <span data-testid="ide-verify-explainer-pattern-next">
                              Next inspect: {selectedFailurePattern.nextInspect}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="ide-verify-failure-explainer__inputs" data-testid="ide-verify-explainer-related">
                        <span>Also wrong at t{selectedFailureCase.tick}</span>
                        {selectedFailurePeers.length > 0 ? (
                          <div className="ide-verify-failure-explainer__chips">
                            {selectedFailurePeers.map((row) => (
                              <button
                                key={`peer-${row.tick}-${row.signal}`}
                                type="button"
                                className="ide-verify-mismatch-fix-btn"
                                onClick={() => applyFailureSelection(row)}
                                data-testid={`ide-verify-related-failure-${toTestId(`${row.signal}-${row.tick}`)}`}
                              >
                                <code>{getFailureSignalLabel(row)}</code> {row.expected}{' -> '}{row.actual}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <code>no other failing outputs at this tick</code>
                        )}
                      </div>
                      <div className="ide-inline-actions">
                        <IdeButton
                          tone="primary"
                          onClick={() => applyFailureSelection(selectedFailureCase)}
                          testId="ide-verify-explainer-jump"
                        >
                          Jump to tick
                        </IdeButton>
                        <IdeButton
                          tone="secondary"
                          onClick={focusMismatchLanes}
                          testId="ide-verify-explainer-show-mismatches"
                        >
                          Show only mismatches
                        </IdeButton>
                        {showMismatchOnlySignals && (
                          <IdeButton
                            tone="ghost"
                            onClick={clearMismatchLaneFilter}
                            testId="ide-verify-explainer-show-all-lanes"
                          >
                            Show all lanes
                          </IdeButton>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Mismatch table */}
                  {failingRows.length === 0 ? (
                    sessionShowsCompareEvidence ? (
                      <IdeCallout tone="success" title="All outputs matched">
                        Every observed output matched the saved expected values.
                      </IdeCallout>
                    ) : (
                      <IdeCallout tone="info" title="Run complete">
                        Enable assertions when you want observed outputs verified against expected values.
                      </IdeCallout>
                    )
                  ) : (
                    <table className="ide-verify-mismatch-list" data-testid="ide-verify-mismatch-list">
                      <thead>
                        <tr>
                          <th>Tick</th>
                          <th>Signal</th>
                          <th>Expected</th>
                          <th>Observed</th>
                          {onFixPath && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {failingRows.map((row) => (
                          <tr
                            key={`${row.tick}-${row.signal}`}
                            className={`ide-verify-mismatch-row ${
                              selectedFailureKey ===
                              buildFailureCaseKey(row.tick, row.signal, row.vectorId, row.caseIndex)
                                ? 'is-selected'
                                : ''
                            }`}
                            onClick={() => applyFailureSelection(row)}
                            onMouseEnter={() => handleSignalHover(row.signal)}
                            onMouseLeave={() => handleSignalHover(null)}
                            data-testid={`ide-verify-mismatch-row-${toTestId(`${row.signal}-${row.tick}`)}`}
                          >
                            <td className="ide-verify-mismatch-tick">
                              <button
                                type="button"
                                className="ide-verify-mismatch-tick-btn"
                                onClick={() => applyFailureSelection(row)}
                              >
                                t{row.tick}
                              </button>
                            </td>
                            <td><code className="ide-verify-mismatch-signal">{getFailureSignalLabel(row)}</code></td>
                            <td><code className="ide-verify-mismatch-expected">{row.expected}</code></td>
                            <td><code className="ide-verify-mismatch-actual--fail">{row.actual}</code></td>
                          {onFixPath && (
                              <td>
                                <button
                                  type="button"
                                  className="ide-verify-mismatch-fix-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    reviewFailureInVerify(row);
                                  }}
                                  title={`Review ${getFailureSignalLabel(row)} in Verify`}
                                >
                                  Review
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {verifyTab === 'details' && (
                <>
                  <section className="ide-verify-run-context" data-testid="ide-verify-details-summary">
                    <div className="ide-verify-run-context__header">
                      <span className="ide-verify-run-context__title">Cases and saved checks</span>
                    </div>
                    <dl className="ide-verify-run-context__grid">
                      <div className="ide-verify-run-context__item">
                        <dt>Case source</dt>
                        <dd>{vectorSourceLabel}</dd>
                      </div>
                      <div className="ide-verify-run-context__item">
                        <dt>Run note</dt>
                        <dd>{verifyReferenceNote}</dd>
                      </div>
                    </dl>
                  </section>
                  <VerifyFailureExplanationPanel
                    failure={selectedFailureExplanationCase}
                    classification={selectedFailureClassification}
                    reasonCode={selectedFailureEvidence?.actualReason ?? null}
                    peers={studentSelectedFailurePeers.map((row) => ({
                      tick: row.tick,
                      signal: row.rawSignal,
                      signalLabel: row.signalLabel,
                      expected: row.expected,
                      actual: row.actual,
                      vectorId: row.vectorId,
                      caseIndex: row.caseIndex,
                    }))}
                    inputSnapshot={selectedFailureInputs}
                    patternSummary={selectedFailurePattern?.summary ?? null}
                    patternNextInspect={selectedFailurePattern?.nextInspect ?? null}
                    onSelectPeer={(peer) => applyFailureSelection(peer)}
                    onJumpToFix={(failure) => reviewFailureInVerify(failure)}
                    onOpenInDesign={(failure) => openFailureInDesign(failure)}
                    onAcceptObserved={handleFailureAcceptObserved}
                    onCaptureRow={handleFailureCaptureRow}
                    onCaptureSignal={handleFailureCaptureSignal}
                    onSetExpectedBit={handleFailureSetExpectedBit}
                    onClearExpected={handleFailureClearExpected}
                    onRerunCompare={() => handleRunWithPreflight(true)}
                  />
                  {/* Run context — scenario, protocol, sampling, tick range */}
                  {runContextRows.length > 0 && (
                    <section className="ide-verify-run-context" data-testid="ide-verify-run-context">
                      <div className="ide-verify-run-context__header">
                        <span className="ide-verify-run-context__title">Run context</span>
                        {lastRun?.status === 'fail' && allWaveformTicks.length > zoomedTicks.length && (
                          <button
                            type="button"
                            className="ide-verify-run-context__toggle"
                            onClick={() => setTickZoom((previous) => (previous === 'all' ? 'fail' : 'all'))}
                            data-testid="ide-verify-tick-window-toggle"
                          >
                            {tickZoom === 'all' ? 'View fail window' : 'View all ticks'}
                          </button>
                        )}
                      </div>
                      <dl className="ide-verify-run-context__grid">
                        {runContextRows.map((row, index) => (
                          <div
                            key={`${row.label || 'context'}-${index}`}
                            className="ide-verify-run-context__item"
                            data-testid={`ide-verify-run-context-${toTestId(row.label)}`}
                          >
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                  <section data-testid="ide-verify-signal-table">
                    <IdeDataTable
                      columns={['Signal', `Tick ${selectedTick ?? '-'}`, 'Expected', 'Observed']}
                      rows={selectedTickRows.map((row) => [
                        row.signal,
                        String(row.tick),
                        row.expected,
                        row.actual,
                      ])}
                    />
                  </section>

                  {sessionSignalsAssertionFailure && (
                    <section data-testid="ide-verify-diff-table">
                      <IdeCallout tone="error" title="Failure Diff">
                        <ul className="ide-list">
                          {failingRows.map((row) => (
                            <li key={`${row.tick}-${row.signal}`}>
                              Tick <code>{row.tick}</code> signal <code>{row.signal}</code> expected{' '}
                              <code>{row.expected}</code> but observed <code>{row.actual}</code>.
                            </li>
                          ))}
                        </ul>
                        <div className="ide-inline-actions">
                          <IdeButton
                            tone="secondary"
                            onClick={() => {
                              if (!selectedFailureCase) return;
                              onFixPath?.(selectedFailureCase);
                            }}
                            disabled={!selectedFailureCase || !onFixPath}
                            testId="ide-verify-fix-path-primary"
                          >
                            Fix path in Design
                          </IdeButton>
                        </div>
                      </IdeCallout>
                    </section>
                  )}

                  <div className="ide-verify-hash-block">
                    <span>Hash</span>
                    <code data-testid="ide-verify-hash">{lastRun?.deterministicHash ?? deterministicHash}</code>
                    <span>Report</span>
                    <code data-testid="ide-verify-report-hash">{lastRun?.reportHash ?? '—'}</code>
                    <span>Schedule</span>
                    <code data-testid="ide-verify-schedule">{lastRun?.schedule ?? '—'}</code>
                  </div>

                  {/* Vectors — per-tick input/output data consolidated from former Vectors tab */}
                  {showSecondaryAssertionGrid && (
                    <section
                      className="ide-verify-secondary-evidence-panel"
                      data-testid="ide-verify-secondary-evidence-panel"
                    >
                      <header className="ide-verify-secondary-evidence-panel__header">
                        <div className="ide-verify-secondary-evidence-panel__copy">
                          <span className="ide-verify-secondary-evidence-panel__eyebrow">
                            Secondary evidence
                          </span>
                          <strong>Observed vs asserted grid</strong>
                          <p>Read-only comparison aligned to the active waveform tick window.</p>
                        </div>
                        {selectedFailureCase && (
                          <span className="ide-verify-secondary-evidence-panel__focus">
                            Focus {selectedFailureDisplayLabel ?? selectedFailureCase.signal} at t
                            {selectedFailureCase.tick}
                          </span>
                        )}
                      </header>
                      <AssertionCanvas
                        outputFields={outputFields}
                        ticks={zoomedTicks}
                        tickWidth={tickWidth}
                        getCellValue={getAssertionCellValue}
                        selectedTick={selectedTick}
                        selectedSignal={selectedSignal}
                        assertionMode={sessionShowsCompareEvidence}
                        className="ide-verify-secondary-evidence-canvas"
                        readOnly={true}
                      />
                    </section>
                  )}
                  <IdeDataTable
                    columns={[
                      'Tick',
                      ...inputFields.map((field) => field.label),
                      ...outputFields.map((field) => `${field.label} (exp)`),
                      ...(onPreviewVector ? ['Preview'] : []),
                      'Dup',
                      ...(onDeleteVector ? ['Delete'] : []),
                    ]}
                    rows={inspectorVectorRows}
                    testId="ide-verify-vectors-table"
                  />
                  {selectedFailure && selectedFailure.vectorId && (
                    <div
                      className="ide-verify-fix-expectation-strip"
                      data-testid="ide-verify-fix-expectation-strip"
                    >
                      <span className="ide-verify-fix-expectation-label">
                        t{selectedFailure.tick} · <code>{selectedFailure.signal}</code>
                        {' '}expected <code>{selectedFailure.expected}</code>
                        {', '}observed <code>{selectedFailure.actual}</code>
                      </span>
                      <button
                        type="button"
                        className="ide-verify-fix-expectation-btn"
                        onClick={() =>
                          handleFixExpectation(
                            selectedFailure.vectorId!,
                            selectedFailure.signal,
                            selectedFailure.actual as '0' | '1'
                          )
                        }
                        data-testid="ide-verify-fix-expectation-btn"
                        title={`Set expected ${getFailureSignalLabel(selectedFailure)} = ${selectedFailure.actual} for this authored row`}
                      >
                        Accept observed {selectedFailure.actual}
                      </button>
                    </div>
                  )}
                  <IdeDataTable
                    columns={['Tick', 'Signal', 'Expected', 'Observed', 'Status']}
                    rows={resultRows}
                    testId="ide-verify-results-table"
                  />

                  {/* Truth table + K-Map — consolidated with mode toggle (formerly separate tabs) */}
                  <TruthTablePane
                    mode={truthTableMode}
                    rows={truthRows}
                    isSequential={isSequentialRun}
                    selectedTick={selectedTick}
                    onSelectTick={setSelectedTick}
                    onModeChange={setTruthTableMode}
                    emptyReason={truthTableEmptyReason}
                    combosRows={comboRows}
                    combosInputs={inputFields.map((field) => field.label)}
                    combosOutputs={outputSignalOrder}
                    combosUnavailableReason={combosUnavailableReason ?? undefined}
                    kmaps={kmapRows}
                    kmapUnavailableReason={kmapUnavailableReason ?? undefined}
                    traceInputsByTick={traceInputsByTick}
                    onFixPath={(row) => reviewFailureInVerify(row)}
                    onSelectFailureCase={(failure) => applyFailureSelection(failure)}
                    showModeToggle={true}
                    displaySection="truth"
                  />
                  {/* K-Map — combinational only; rendered as a separate section below truth table */}
                  {!isSequentialRun && (
                    <TruthTablePane
                      mode={truthTableMode}
                      rows={truthRows}
                      isSequential={false}
                      selectedTick={selectedTick}
                      onSelectTick={setSelectedTick}
                      onModeChange={setTruthTableMode}
                      emptyReason={truthTableEmptyReason}
                      combosRows={comboRows}
                      combosInputs={inputFields.map((field) => field.label)}
                      combosOutputs={outputSignalOrder}
                      combosUnavailableReason={combosUnavailableReason ?? undefined}
                      kmaps={kmapRows}
                      kmapUnavailableReason={kmapUnavailableReason ?? undefined}
                      traceInputsByTick={traceInputsByTick}
                      onFixPath={(row) => reviewFailureInVerify(row)}
                      onSelectFailureCase={(failure) => applyFailureSelection(failure)}
                      showModeToggle={false}
                      displaySection="kmap"
                    />
                  )}
                </>
              )}
            </div>
            </div>
            </div>}
          </div>}
        </VerifyWaveformRegion>
        </div>
        </div>
        </VerifyWorkspaceRegion>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

function buildVectorReferenceSignature(
  vectors: ReadonlyArray<{
    tick?: number;
    inputs?: Record<string, unknown>;
    expected?: Record<string, unknown>;
  }>
): string {
  return JSON.stringify(
    vectors.map((vector, index) => ({
      tick: Number.isFinite(Number(vector.tick))
        ? Math.max(0, Math.floor(Number(vector.tick)))
        : index,
      inputs: normalizeReferenceRecord(vector.inputs ?? {}),
      expected: normalizeReferenceRecord(vector.expected ?? {}),
    }))
  );
}

function normalizeReferenceRecord(record: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(record)
    .map(([key, value]) => [normalizeFieldId(key), String(value)] as [string, string])
    .sort(([left], [right]) => left.localeCompare(right));
}

function normalizeVectors(
  vectors: VerifySurfaceProps['vectors'],
  inputFields: VerifyVectorDraftInput[],
  outputFields: VerifyVectorDraftInput[],
  inputAliases: Map<string, string>,
  outputAliases: Map<string, string>
): VerifyAuthorVector[] {
  if (!vectors || vectors.length === 0) return [];
  const validOutputIds = new Set(outputFields.map((f) => f.id));
  return vectors
    .map((vector, index) => ({
      id: `vec-${String(index + 1).padStart(2, '0')}`,
      tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
      inputs: Object.fromEntries(
        Object.entries(vector.inputs ?? {}).map(([key, value]) => [
          inputAliases.get(normalizeFieldId(key)) ??
            normalizeFieldId(key),
          normalizeBit(value),
        ] as [string, 0 | 1])
      ),
      expected: Object.fromEntries(
        Object.entries(vector.expected ?? {})
          .map(([key, value]) => [
            outputAliases.get(normalizeFieldId(key)) ??
              normalizeFieldId(key),
            normalizeBit(value),
          ] as [string, 0 | 1])
          .filter(([key]) => validOutputIds.size === 0 || validOutputIds.has(key))
      ),
    }))
    .sort((left, right) => left.tick - right.tick);
}

function normalizeVerifyFields(
  seed: Array<{ id: string; label?: string; pin?: string }>
): VerifyVectorDraftInput[] {
  const normalized = seed
    .map((entry) => ({
      id: normalizeFieldId(entry.id),
      label: (entry.label ?? entry.id).trim() || entry.id,
      pin: entry.pin,
    }))
    .filter((entry) => entry.id.length > 0);

  const deduped = new Map<string, VerifyVectorDraftInput>();
  for (const entry of normalized) {
    if (!deduped.has(entry.id)) deduped.set(entry.id, entry);
  }
  return Array.from(deduped.values());
}

function buildVerifyFieldAliasMap(
  fields: VerifyVectorDraftInput[],
  seed: Array<{ id: string; label?: string; pin?: string; nodeId?: string }>
): Map<string, string> {
  const aliases = new Map<string, string>();
  const validIds = new Set(fields.map((field) => field.id));

  const register = (canonicalId: string, ...candidates: Array<string | undefined>) => {
    for (const candidate of candidates) {
      const normalized = normalizeFieldId(candidate ?? '');
      if (!normalized || aliases.has(normalized)) continue;
      aliases.set(normalized, canonicalId);
    }
  };

  for (const field of fields) {
    register(field.id, field.id, field.label);
  }

  for (const entry of seed) {
    const canonicalId = normalizeFieldId(entry.id);
    if (!validIds.has(canonicalId)) continue;
    register(
      canonicalId,
      entry.id,
      entry.label,
      entry.nodeId,
      entry.nodeId ? `${entry.nodeId}.in` : '',
      entry.nodeId ? `${entry.nodeId}.out` : '',
      entry.nodeId ? `${entry.nodeId}_in` : '',
      entry.nodeId ? `${entry.nodeId}_out` : '',
      entry.nodeId ? `${entry.nodeId}:in` : '',
      entry.nodeId ? `${entry.nodeId}:out` : ''
    );
  }

  return aliases;
}

function nextVectorTick(vectors: VerifySurfaceProps['vectors']): number {
  if (!vectors || vectors.length === 0) return 0;
  return Math.max(...vectors.map((vector) => vector.tick)) + 1;
}

function createDraftInputs(inputFields: VerifyVectorDraftInput[]): Record<string, '0' | '1'> {
  return inputFields.reduce<Record<string, '0' | '1'>>((acc, field) => {
    acc[field.id] = '0';
    return acc;
  }, {});
}

function createDraftExpected(
  outputFields: VerifyVectorDraftInput[]
): Record<string, VerifyExpectedDraftValue> {
  return outputFields.reduce<Record<string, VerifyExpectedDraftValue>>((acc, field) => {
    acc[field.id] = '';
    return acc;
  }, {});
}

function withInputFieldDefaults(
  current: Record<string, '0' | '1'>,
  inputFields: VerifyVectorDraftInput[]
): Record<string, '0' | '1'> {
  const next: Record<string, '0' | '1'> = {};
  for (const field of inputFields) {
    next[field.id] = current[field.id] === '1' ? '1' : '0';
  }
  return next;
}

function withExpectedFieldDefaults(
  current: Record<string, VerifyExpectedDraftValue>,
  outputFields: VerifyVectorDraftInput[]
): Record<string, VerifyExpectedDraftValue> {
  const next: Record<string, VerifyExpectedDraftValue> = {};
  for (const field of outputFields) {
    const currentValue = current[field.id];
    next[field.id] = currentValue === '1' ? '1' : currentValue === '0' ? '0' : '';
  }
  return next;
}

function buildExpectedRecord(
  outputFields: VerifyVectorDraftInput[],
  draftExpected: Record<string, VerifyExpectedDraftValue>
): Record<string, 0 | 1> {
  return outputFields.reduce<Record<string, 0 | 1>>((acc, field) => {
    const value = draftExpected[field.id];
    if (value === '0' || value === '1') {
      acc[field.id] = value === '1' ? 1 : 0;
    }
    return acc;
  }, {});
}

function expectedRecordToDraftState(
  expected: Record<string, 0 | 1>,
  outputFields: VerifyVectorDraftInput[]
): Record<string, VerifyExpectedDraftValue> {
  return outputFields.reduce<Record<string, VerifyExpectedDraftValue>>((acc, field) => {
    acc[field.id] =
      expected[field.id] === 1 ? '1' : expected[field.id] === 0 ? '0' : '';
    return acc;
  }, {});
}

function buildCanonicalWaveformSignalAliases(input: {
  lastRun?: RuntimeVerifyRun;
  inputFields: VerifyVectorDraftInput[];
  outputFields: VerifyVectorDraftInput[];
  mappedSignals?: VerifyMappedSignal[];
}): Map<string, string> {
  const aliases = new Map<string, string>();
  const canonicalByNormalized = new Map<string, string>();
  const registerCanonical = (canonical: string | null | undefined, ...candidates: Array<string | null | undefined>) => {
    const canonicalName = typeof canonical === 'string' ? canonical.trim() : '';
    if (!canonicalName) return;
    for (const candidate of [canonicalName, ...candidates]) {
      const normalized = normalizeFieldId(normalizeSignalKey(candidate ?? ''));
      if (!normalized || canonicalByNormalized.has(normalized)) continue;
      canonicalByNormalized.set(normalized, canonicalName);
    }
  };
  const registerAlias = (canonical: string | null | undefined, ...candidates: Array<string | null | undefined>) => {
    const canonicalName = typeof canonical === 'string' ? canonical.trim() : '';
    if (!canonicalName) return;
    registerCanonical(canonicalName);
    for (const candidate of candidates) {
      const normalized = normalizeFieldId(normalizeSignalKey(candidate ?? ''));
      if (!normalized || aliases.has(normalized)) continue;
      aliases.set(normalized, canonicalName);
    }
  };
  const resolveCanonical = (...candidates: Array<string | null | undefined>) => {
    for (const candidate of candidates) {
      const normalized = normalizeFieldId(normalizeSignalKey(candidate ?? ''));
      if (!normalized) continue;
      const canonical = canonicalByNormalized.get(normalized);
      if (canonical) return canonical;
    }
    return null;
  };

  for (const field of [...input.inputFields, ...input.outputFields]) {
    registerCanonical(field.id, field.label);
  }
  for (const signal of input.mappedSignals ?? []) {
    registerCanonical(signal.id, signal.label);
  }

  for (const row of input.lastRun?.evidence?.ioRows ?? []) {
    const canonical =
      resolveCanonical(row.id, row.label) ??
      row.id.trim() ??
      row.label.trim();
    registerAlias(
      canonical,
      row.id,
      row.label,
      row.nodeId,
      row.nodeId ? `${row.nodeId}.in` : '',
      row.nodeId ? `${row.nodeId}.out` : '',
      row.nodeId ? `${row.nodeId}_in` : '',
      row.nodeId ? `${row.nodeId}_out` : '',
      row.nodeId ? `${row.nodeId}:in` : '',
      row.nodeId ? `${row.nodeId}:out` : ''
    );
  }

  for (const entry of input.lastRun?.evidence?.normalizationMap ?? []) {
    const canonical = resolveCanonical(entry.rawKey, entry.normalizedKey) ?? entry.rawKey;
    registerAlias(canonical, entry.rawKey, entry.normalizedKey, entry.matchedSignal);
  }

  return aliases;
}

function buildCaptureContext(input: {
  lastRun?: RuntimeVerifyRun;
  inputFields: VerifyVectorDraftInput[];
  outputFields: VerifyVectorDraftInput[];
  mappedSignals?: VerifyMappedSignal[];
  visibleSignals: string[];
}): VerifyCaptureContext | null {
  const { lastRun, inputFields, outputFields, mappedSignals = [], visibleSignals } = input;
  if (!lastRun?.waveform || lastRun.waveform.length === 0) return null;

  const waveformByTick = new Map<number, Record<string, string>>();
  for (const sample of lastRun.waveform) {
    const previous = waveformByTick.get(sample.tick) ?? {};
    waveformByTick.set(sample.tick, { ...previous, ...sample.signals });
  }

  const inputSignalKeys = new Set(inputFields.map((field) => normalizeFieldId(field.id)));
  for (const signal of mappedSignals) {
    if (signal.direction !== 'in') continue;
    inputSignalKeys.add(normalizeFieldId(signal.id));
    if (signal.label) inputSignalKeys.add(normalizeFieldId(signal.label));
  }

  const outputSignalKeys = new Set(
    [
      ...outputFields.flatMap((field) => [field.id, field.label]),
      ...mappedSignals
        .filter((signal) => signal.direction === 'out')
        .flatMap((signal) => [signal.id, signal.label ?? '']),
    ]
      .map(normalizeFieldId)
      .filter(Boolean)
  );

  const mappedNonInputKeys = new Set(
    mappedSignals
      .flatMap((signal) => [signal.id, signal.label ?? ''])
      .map(normalizeFieldId)
      .filter((key) => key.length > 0 && !inputSignalKeys.has(key))
  );

  const visibleOutputKeys = new Set(
    visibleSignals
      .map(normalizeFieldId)
      .filter((key) => key.length > 0 && (outputSignalKeys.size === 0 || outputSignalKeys.has(key)))
  );

  const canonicalOutputKeyByWaveSignal = new Map<string, string>();
  for (const row of lastRun.evidence?.ioRows ?? []) {
    if (row.direction !== 'out') continue;
    const canonicalCandidates = [row.id, row.label]
      .map(normalizeFieldId)
      .filter(Boolean);
    const canonicalOutputKey =
      canonicalCandidates.find((candidate) => outputSignalKeys.has(candidate)) ??
      canonicalCandidates[0];
    if (!canonicalOutputKey) continue;
    for (const candidate of [
      row.id,
      row.label,
      row.nodeId,
      row.nodeId ? `${row.nodeId}.in` : '',
      row.nodeId ? `${row.nodeId}_in` : '',
    ]) {
      if (!candidate) continue;
      const normalizedCandidate = normalizeFieldId(candidate);
      if (!normalizedCandidate) continue;
      canonicalOutputKeyByWaveSignal.set(normalizedCandidate, canonicalOutputKey);
    }
  }
  for (const entry of lastRun.evidence?.normalizationMap ?? []) {
    if (entry.role !== 'output') continue;
    const canonicalOutputKey = normalizeFieldId(entry.rawKey);
    const matchedSignalKey = normalizeFieldId(entry.matchedSignal ?? '');
    if (!canonicalOutputKey) continue;
    canonicalOutputKeyByWaveSignal.set(canonicalOutputKey, canonicalOutputKey);
    if (matchedSignalKey) {
      canonicalOutputKeyByWaveSignal.set(matchedSignalKey, canonicalOutputKey);
    }
  }

  return {
    waveformByTick,
    inputSignalKeys,
    outputSignalKeys,
    mappedNonInputKeys,
    visibleOutputKeys,
    canonicalOutputKeyByWaveSignal,
  };
}

function buildOwnedVectors(
  projectVectors: VerifyAuthorVector[],
  customVectors: CustomTestVector[]
): OwnedVerifyVector[] {
  return [
    ...projectVectors.map((vector) => ({ ...vector, owner: 'project' as const })),
    ...customVectors.map((vector) => ({ ...vector, owner: 'custom' as const })),
  ].sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    return compareText(left.id, right.id);
  });
}

function matchesCapturedVectorScope(vector: VerifyAuthorVector, scope: CaptureScope): boolean {
  if (scope.vectorId && vector.id !== scope.vectorId) return false;
  if (scope.tick !== undefined && vector.tick !== scope.tick) return false;
  return true;
}

function isVisibleCapturedOutput(
  canonicalOutputKey: string,
  context: VerifyCaptureContext
): boolean {
  if (context.visibleOutputKeys.size > 0) {
    return context.visibleOutputKeys.has(canonicalOutputKey);
  }
  if (context.outputSignalKeys.size > 0) {
    return context.outputSignalKeys.has(canonicalOutputKey);
  }
  if (context.mappedNonInputKeys.size > 0) {
    return context.mappedNonInputKeys.has(canonicalOutputKey);
  }
  return true;
}

function shouldCaptureExpectedSignal(input: {
  scope: CaptureScope;
  vector: VerifyAuthorVector;
  canonicalOutputKey: string;
  existingExpectedKeys: Set<string>;
  context: VerifyCaptureContext;
}): boolean {
  const { scope, vector, canonicalOutputKey, existingExpectedKeys, context } = input;
  switch (scope.kind) {
    case 'cell':
      return (
        matchesCapturedVectorScope(vector, scope) &&
        normalizeFieldId(scope.signal ?? '') === canonicalOutputKey
      );
    case 'row':
      return matchesCapturedVectorScope(vector, scope) && isVisibleCapturedOutput(canonicalOutputKey, context);
    case 'signal':
      return normalizeFieldId(scope.signal ?? '') === canonicalOutputKey;
    case 'all-asserted':
      return existingExpectedKeys.has(canonicalOutputKey);
    case 'all-visible-outputs':
      return isVisibleCapturedOutput(canonicalOutputKey, context);
    default:
      return false;
  }
}

function applyCaptureScopeToVectorSets(input: {
  projectVectors: VerifyAuthorVector[];
  customVectors: CustomTestVector[];
  context: VerifyCaptureContext;
  scope: CaptureScope;
}): CaptureApplicationResult {
  const ownedVectors = buildOwnedVectors(input.projectVectors, input.customVectors);
  let changed = false;
  let capturedAnyExpected = false;

  const updatedOwnedVectors = ownedVectors.map((vector) => {
    const tickSignals = input.context.waveformByTick.get(vector.tick);
    if (!tickSignals) return vector;

    const expectedKeyByNormalized = new Map<string, string>();
    for (const key of Object.keys(vector.expected ?? {})) {
      const normalized = normalizeFieldId(key);
      if (!normalized || expectedKeyByNormalized.has(normalized)) continue;
      expectedKeyByNormalized.set(normalized, key);
    }

    if (input.scope.kind === 'all-asserted' && expectedKeyByNormalized.size === 0) {
      return vector;
    }

    const nextExpected = { ...vector.expected };
    let vectorChanged = false;
    for (const [signal, rawValue] of Object.entries(tickSignals)) {
      if (rawValue !== '0' && rawValue !== '1') continue;
      const normalizedSignal = normalizeFieldId(signal);
      const canonicalOutputKey =
        input.context.canonicalOutputKeyByWaveSignal.get(normalizedSignal) ?? normalizedSignal;
      if (
        input.context.inputSignalKeys.has(normalizedSignal) ||
        input.context.inputSignalKeys.has(canonicalOutputKey)
      ) {
        continue;
      }
      if (
        input.context.outputSignalKeys.size > 0 &&
        !input.context.outputSignalKeys.has(canonicalOutputKey)
      ) {
        continue;
      }
      if (
        input.context.outputSignalKeys.size === 0 &&
        input.context.mappedNonInputKeys.size > 0 &&
        !input.context.mappedNonInputKeys.has(canonicalOutputKey)
      ) {
        continue;
      }
      if (
        !shouldCaptureExpectedSignal({
          scope: input.scope,
          vector,
          canonicalOutputKey,
          existingExpectedKeys: new Set(expectedKeyByNormalized.keys()),
          context: input.context,
        })
      ) {
        continue;
      }
      const targetKey = expectedKeyByNormalized.get(canonicalOutputKey) ?? canonicalOutputKey;
      const nextValue: 0 | 1 = rawValue === '1' ? 1 : 0;
      if (nextExpected[targetKey] !== nextValue) {
        nextExpected[targetKey] = nextValue;
        vectorChanged = true;
      }
      capturedAnyExpected = true;
    }

    if (!vectorChanged) return vector;
    changed = true;
    return { ...vector, expected: nextExpected };
  });

  return {
    projectVectors: updatedOwnedVectors
      .filter((vector) => vector.owner === 'project')
      .map(({ owner: _owner, ...vector }) => vector),
    customVectors: updatedOwnedVectors
      .filter((vector) => vector.owner === 'custom')
      .map(({ owner: _owner, ...vector }) => vector),
    changed,
    capturedAnyExpected,
  };
}

function updateExpectedCellInVectorSets(input: {
  projectVectors: VerifyAuthorVector[];
  customVectors: CustomTestVector[];
  tick: number;
  signal: string;
  vectorId?: string;
  nextValue: 0 | 1 | null;
}): CaptureApplicationResult {
  const normalizedSignal = normalizeFieldId(input.signal);
  let changed = false;
  let capturedAnyExpected = false;

  const updatedOwnedVectors = buildOwnedVectors(input.projectVectors, input.customVectors).map((vector) => {
    if (input.vectorId && vector.id !== input.vectorId) return vector;
    if (!input.vectorId && vector.tick !== input.tick) return vector;
    const expectedKeyByNormalized = new Map<string, string>();
    for (const key of Object.keys(vector.expected ?? {})) {
      const normalized = normalizeFieldId(key);
      if (!normalized || expectedKeyByNormalized.has(normalized)) continue;
      expectedKeyByNormalized.set(normalized, key);
    }
    const targetKey = expectedKeyByNormalized.get(normalizedSignal) ?? normalizedSignal;
    const nextExpected = { ...vector.expected };
    if (input.nextValue === null) {
      if (!(targetKey in nextExpected)) return vector;
      delete nextExpected[targetKey];
    } else if (nextExpected[targetKey] === input.nextValue) {
      return vector;
    } else {
      nextExpected[targetKey] = input.nextValue;
      capturedAnyExpected = true;
    }
    changed = true;
    return { ...vector, expected: nextExpected };
  });

  return {
    projectVectors: updatedOwnedVectors
      .filter((vector) => vector.owner === 'project')
      .map(({ owner: _owner, ...vector }) => vector),
    customVectors: updatedOwnedVectors
      .filter((vector) => vector.owner === 'custom')
      .map(({ owner: _owner, ...vector }) => vector),
    changed,
    capturedAnyExpected,
  };
}

function buildVectorCollectionSignature(
  projectVectors: VerifyAuthorVector[],
  customVectors: CustomTestVector[]
): string {
  return JSON.stringify(
    buildOwnedVectors(projectVectors, customVectors).map((vector) => ({
      owner: vector.owner,
      id: vector.id,
      tick: vector.tick,
      inputs: vector.inputs,
      expected: vector.expected,
    }))
  );
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function normalizeFieldId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

interface ClockActivitySummary {
  hasTransition: boolean;
  hasRisingEdge: boolean;
  risingCount: number;
  fallingCount: number;
  sampleCount: number;
  summary: string;
  preview: string[];
}

function buildClockActivitySummary(
  vectors: Array<Pick<VerifyAuthorVector, 'tick' | 'inputs'>>,
  clockSignalNames: string[]
): ClockActivitySummary {
  const clockKeys = new Set(clockSignalNames.map((name) => normalizeFieldId(name)));
  if (clockKeys.size === 0) {
    return {
      hasTransition: false,
      hasRisingEdge: false,
      risingCount: 0,
      fallingCount: 0,
      sampleCount: 0,
      summary: 'No clock signal detected for this testbench yet.',
      preview: [],
    };
  }

  const samples = vectors
    .map((vector) => {
      const entry = Object.entries(vector.inputs ?? {}).find(([key]) =>
        clockKeys.has(normalizeFieldId(key))
      );
      if (!entry) return null;
      return {
        tick: vector.tick,
        value: normalizeBit(entry[1]),
      };
    })
    .filter((sample): sample is { tick: number; value: 0 | 1 } => sample != null)
    .sort((left, right) => left.tick - right.tick);

  if (samples.length === 0) {
    return {
      hasTransition: false,
      hasRisingEdge: false,
      risingCount: 0,
      fallingCount: 0,
      sampleCount: 0,
      summary: 'No clock row is present in the next-run stimulus.',
      preview: [],
    };
  }

  let hasTransition = false;
  let hasRisingEdge = false;
  let risingCount = 0;
  let fallingCount = 0;
  const preview: string[] = [];

  samples.forEach((sample, index) => {
    const previous = index > 0 ? samples[index - 1] : null;
    let edgeLabel = '';
    if (previous && previous.value !== sample.value) {
      hasTransition = true;
      if (previous.value === 0 && sample.value === 1) {
        hasRisingEdge = true;
        risingCount += 1;
        edgeLabel = ' rising';
      } else {
        fallingCount += 1;
        edgeLabel = ' falling';
      }
    }
    preview.push(`t${sample.tick}=${sample.value}${edgeLabel}`);
  });

  const previewWindow = preview.slice(0, 8);
  const extraCount = preview.length - previewWindow.length;
  if (extraCount > 0) {
    previewWindow.push(`+${extraCount} more`);
  }

  const edgeSummary =
    risingCount > 0
      ? `${risingCount} rising edge${risingCount === 1 ? '' : 's'}`
      : hasTransition
        ? `${fallingCount} falling edge${fallingCount === 1 ? '' : 's'}, no rising edge`
        : 'no edges';

  return {
    hasTransition,
    hasRisingEdge,
    risingCount,
    fallingCount,
    sampleCount: samples.length,
    summary: `Clock row for next run: ${samples.length} tick${samples.length === 1 ? '' : 's'}, ${edgeSummary}.`,
    preview: previewWindow,
  };
}

function toTestId(value: string): string {
  return normalizeFieldId(value);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function parseSeed(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed);
}

function grayCodes(bitCount: number): string[] {
  if (bitCount <= 0) return [''];
  const size = 1 << bitCount;
  const codes: string[] = [];
  for (let index = 0; index < size; index += 1) {
    const gray = index ^ (index >> 1);
    codes.push(gray.toString(2).padStart(bitCount, '0'));
  }
  return codes;
}

function buildFailWindowTicks(ticks: number[], failureTick: number | null): number[] {
  if (ticks.length <= 7) return ticks;
  if (failureTick === null) return ticks.slice(0, 7);
  const failureIndex = ticks.indexOf(failureTick);
  if (failureIndex < 0) return ticks.slice(0, 7);
  const start = Math.max(0, Math.min(failureIndex - 2, ticks.length - 7));
  return ticks.slice(start, start + 7);
}

function buildSelectedWindowTicks(ticks: number[], centerTick: number): number[] {
  if (ticks.length <= 7) return ticks;
  const centerIndex = ticks.indexOf(centerTick);
  if (centerIndex < 0) return ticks.slice(0, 7);
  const start = Math.max(0, Math.min(centerIndex - 3, ticks.length - 7));
  return ticks.slice(start, start + 7);
}

function formatTickSpan(ticks: number[]): string {
  if (ticks.length === 0) return 'no ticks';
  if (ticks.length === 1) return `t${ticks[0]}`;
  return `t${ticks[0]}-t${ticks[ticks.length - 1]}`;
}

function formatTickWindowLabel(
  allTicks: number[],
  shownTicks: number[],
  tickZoom: 'all' | 'fail' | 'window'
): string {
  if (allTicks.length === 0) return 'No ticks shown';
  if (shownTicks.length === 0) return 'No ticks shown';
  if (shownTicks.length === allTicks.length || tickZoom === 'all') {
    return `Showing all ${allTicks.length} tick${allTicks.length === 1 ? '' : 's'}`;
  }
  if (tickZoom === 'fail') {
    return `Showing ${formatTickSpan(shownTicks)} (fail window)`;
  }
  return `Showing ${formatTickSpan(shownTicks)} (selected window)`;
}

function formatTickWindowReason(input: {
  allTicks: number[];
  shownTicks: number[];
  tickZoom: 'all' | 'fail' | 'window';
  focusedFailureTick: number | null;
  selectedTick: number | null;
}): string {
  const { allTicks, shownTicks, tickZoom, focusedFailureTick, selectedTick } = input;
  if (allTicks.length === 0 || shownTicks.length === 0) return 'Run the current stimulus to inspect a tick range.';
  if (shownTicks.length === allTicks.length || tickZoom === 'all') {
    return 'Showing the full verification run.';
  }
  if (tickZoom === 'fail' && focusedFailureTick !== null) {
    return `Mismatch focus at t${focusedFailureTick}; showing ${shownTicks.length} ticks for context.`;
  }
  if (selectedTick !== null) {
    return `Centered on selected tick t${selectedTick}.`;
  }
  return `Showing ${shownTicks.length} ticks for local context.`;
}

function resolveVerifyLayoutMode(width?: number): VerifyLayoutMode {
  const nextWidth =
    typeof width === 'number'
      ? width
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 1440;
  if (nextWidth >= 1280) return 'wide';
  if (nextWidth >= 960) return 'standard';
  return 'compact';
}

function clampTickWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VERIFY_TICK_WIDTH;
  return Math.max(MIN_VERIFY_TICK_WIDTH, Math.min(MAX_VERIFY_TICK_WIDTH, Math.round(value)));
}

function fitWaveformTickWidth(containerWidth: number, tickCount: number): number {
  if (!Number.isFinite(containerWidth) || tickCount <= 0) return DEFAULT_VERIFY_TICK_WIDTH;
  const available = Math.max(320, containerWidth - VERIFY_WAVEFORM_LABEL_ALLOWANCE);
  return clampTickWidth(available / tickCount);
}

function formatVerifyProtocol(run: RuntimeVerifyRun): string {
  return formatTimingProtocolLabel(deriveTimingGuidanceFromRun(run));
}

function formatVerifySampling(run: RuntimeVerifyRun): string {
  if (run.meta.samplePoint === 'post-rising-edge') return 'Outputs sampled post-rising-edge';
  if (run.meta.samplePoint === 'steady-state') return 'Outputs sampled at steady state';
  return 'Sampling semantics unavailable';
}

function formatVerifyTickZero(run: RuntimeVerifyRun): string {
  return formatTimingTickZero(
    deriveTimingGuidanceFromRun(run),
    run.meta.tick0Meaning
  );
}

interface TraceInputDescriptor {
  key: string;
  label: string;
  role?: 'clock' | 'reset' | 'input' | 'output';
}

function normalizeSignalRoles(
  roles: Record<string, 'clock' | 'reset' | 'input' | 'output'>
): Record<string, 'clock' | 'reset' | 'input' | 'output'> {
  const normalized: Record<string, 'clock' | 'reset' | 'input' | 'output'> = {};
  for (const [key, role] of Object.entries(roles)) {
    normalized[normalizeFieldId(key)] = role;
  }
  return normalized;
}

function buildTraceInputDescriptors(
  inputFields: VerifyVectorDraftInput[],
  inputsAtTick: Record<number, Record<string, 0 | 1>>,
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>
): TraceInputDescriptor[] {
  const descriptors = new Map<string, TraceInputDescriptor>();
  for (const field of inputFields) {
    const key = normalizeFieldId(field.id);
    if (!key) continue;
    descriptors.set(key, {
      key,
      label: field.label,
      role: signalRoles[key],
    });
  }
  for (const snapshot of Object.values(inputsAtTick)) {
    for (const rawKey of Object.keys(snapshot)) {
      const key = normalizeFieldId(rawKey);
      if (!key || descriptors.has(key)) continue;
      descriptors.set(key, {
        key,
        label: rawKey,
        role: signalRoles[key],
      });
    }
  }
  return Array.from(descriptors.values()).sort(compareTraceInputDescriptors);
}

function buildTraceInputsByTick(
  inputsAtTick: Record<number, Record<string, 0 | 1>>,
  descriptors: TraceInputDescriptor[]
): Record<number, TruthTableTraceInput[]> {
  const byTick: Record<number, TruthTableTraceInput[]> = {};
  for (const [tickKey, snapshot] of Object.entries(inputsAtTick)) {
    const tick = Number.parseInt(tickKey, 10);
    if (!Number.isFinite(tick)) continue;
    const normalizedSnapshot = new Map<string, string>();
    for (const [rawKey, value] of Object.entries(snapshot)) {
      normalizedSnapshot.set(normalizeFieldId(rawKey), String(value));
    }
    byTick[tick] = descriptors
      .map((descriptor) => ({
        label: descriptor.label,
        value: normalizedSnapshot.get(descriptor.key) ?? '-',
      }))
      .filter((entry) => entry.value !== '-');
  }
  return byTick;
}

function compareTraceInputDescriptors(left: TraceInputDescriptor, right: TraceInputDescriptor): number {
  const leftKey = buildTraceInputSortKey(left);
  const rightKey = buildTraceInputSortKey(right);
  if (leftKey.group !== rightKey.group) return leftKey.group - rightKey.group;
  if (leftKey.index !== rightKey.index) return leftKey.index - rightKey.index;
  return compareText(leftKey.name, rightKey.name);
}

function buildTraceInputSortKey(input: TraceInputDescriptor): { group: number; index: number; name: string } {
  const name = normalizeFieldId(input.label || input.key);
  if (input.role === 'clock') return { group: 0, index: 0, name };
  if (input.role === 'reset') return { group: 1, index: 0, name };
  const switchMatch = /^(sw|switch)(\d+)$/i.exec(name);
  if (switchMatch) return { group: 2, index: Number.parseInt(switchMatch[2], 10), name };
  const buttonMatch = /^(btn|button)(\d+)$/i.exec(name);
  if (buttonMatch) return { group: 3, index: Number.parseInt(buttonMatch[2], 10), name };
  const buttonNameMatch = /^(btn|button)([a-z]+)$/i.exec(name);
  if (buttonNameMatch) {
    return { group: 3, index: buttonNameMatch[2].charCodeAt(0), name };
  }
  return { group: 4, index: 0, name };
}
