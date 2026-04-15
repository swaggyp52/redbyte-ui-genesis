import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BASYS3_ANODE_PINS,
  BASYS3_BUTTON_PINS,
  BASYS3_CLOCK_PIN,
  BASYS3_DP_PIN,
  BASYS3_LED_PINS,
  BASYS3_SEGMENT_PINS,
  BASYS3_SWITCH_PINS,
  resolveBasys3PackagePin,
} from '../../../fpga/boards/basys3/basys3Pins';
import {
  type ProjectHealth,
  type ProjectHealthIssue,
  type ProjectHealthMode,
  type ProjectPrimaryCta,
  type ProjectVerifyState,
} from '../projectHealth';
import type { IdeDiagnosticRouteRequest } from '../diagnostics';
import {
  deriveProjectWorkflowAuthority,
  type ProjectWorkflowAuthority,
} from '../projectWorkflowAuthority';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfaceCommandStrip, SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { RuntimeSimState } from '../projectRuntime';
import { useIoBus } from '../ioBus';
import { useBoardSignal } from '../BoardSignalContext';
import { getStudentFacingIoLabel } from '../ioLabels';
import { LAB_STARTERS } from '../labStarters';
import { getProjectKindDisplayName, type ProjectKind, type ScenarioAuthority } from '../projectIdentity';
import {
  EXPORT_STAGE_LABEL,
  MAP_PINS_STAGE_LABEL,
  PROGRAM_STAGE_LABEL,
  STUDENT_WORKFLOW_SUMMARY,
  VERIFY_STAGE_LABEL,
} from '../workflowStages';

export interface ProjectMappingRow {
  id: string;
  nodeId?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
  port: string;
}

export interface ProjectSurfaceProps {
  projectName: string;
  description: string;
  determinismHash: string;
  topModuleName: string;
  lastSavedAt: string;
  simRunning: boolean;
  readiness: {
    hasCircuit: boolean;
    hasIoMapping: boolean;
    hasVectors: boolean;
    verifyPass: boolean;
    verifyQualification?: 'incomplete-mapping';
    missingRequiredCount: number;
  };
  health: ProjectHealth;
  workflowAuthority?: ProjectWorkflowAuthority;
  mappingRows: ProjectMappingRow[];
  examples: Array<{
    id: string;
    name: string;
    summary: string;
    expectedBehavior: string;
    tags: string[];
    course: string;
    lab: string;
    concept: string;
  }>;
  projectKind?: ProjectKind;
  sourceExampleId?: string | null;
  scenarioAuthority?: ScenarioAuthority;
  activeExampleId: string | null;
  onOpenExample: (exampleId: string) => void;
  primaryCtaLabel: string;
  primaryCta: ProjectPrimaryCta;
  onPrimaryCta: () => void;
  onUpdateMappingPin: (rowId: string, pin: string) => void;
  onAutoSuggestMapping: () => void;
  onOpenDesign: () => void;
  onOpenVerify: () => void;
  onOpenExport: () => void;
  onOpenHardware: () => void;
  onOpenImport: () => void;
  onStartBlankProject?: () => void;
  recentProjects?: Array<{
    projectId: string;
    projectName: string;
    savedAtIso: string;
    projectHash: string;
  }>;
  onOpenSavedProjects?: () => void;
  onOpenRecentProject?: (projectId: string) => void;
  diagnosticRouteRequest?: IdeDiagnosticRouteRequest | null;
  runtimeSim?: RuntimeSimState;
  onGoToHardware?: () => void;
  onSaveNow?: () => void;
  onRestoreLastSave?: () => void;
  onResetProject?: () => void;
  studentName?: string;
  onStudentNameChange?: (name: string) => void;
  hasVerifyRun?: boolean;
  fpgaConfig?: { part: string; top: string; board: string };
  importFidelity?: 'full' | 'reconstructed' | 'partial' | null;
  onFpgaConfigChange?: (config: { part?: string; top?: string }) => void;
}

const PROJECT_EMPTY_SIM: RuntimeSimState = {
  tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
  inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
};

const PROJECT_INPUT_ALIAS_OPTIONS = [
  'CLK100MHZ',
  ...Array.from({ length: 16 }, (_, index) => `SW${index}`),
  'BTNC',
  'BTNU',
  'BTND',
  'BTNL',
  'BTNR',
];

const PROJECT_OUTPUT_ALIAS_OPTIONS = [
  ...Array.from({ length: 16 }, (_, index) => `LD${index}`),
  ...Array.from({ length: 16 }, (_, index) => `LED${index}`),
  ...Array.from({ length: 7 }, (_, index) => `SEG${index}`),
  'DP',
  ...Array.from({ length: 4 }, (_, index) => `AN${index}`),
];

export const ProjectSurface: React.FC<ProjectSurfaceProps> = ({
  projectName,
  description,
  determinismHash,
  topModuleName,
  lastSavedAt,
  simRunning,
  readiness,
  health,
  workflowAuthority,
  mappingRows,
  examples,
  projectKind = 'blank',
  scenarioAuthority = 'none',
  activeExampleId,
  onOpenExample,
  primaryCtaLabel,
  primaryCta,
  onPrimaryCta,
  onUpdateMappingPin,
  onAutoSuggestMapping,
  onOpenDesign,
  onOpenVerify,
  onOpenExport,
  onOpenHardware,
  onOpenImport,
  onStartBlankProject,
  recentProjects = [],
  onOpenSavedProjects,
  onOpenRecentProject,
  diagnosticRouteRequest,
  runtimeSim,
  onGoToHardware,
  onSaveNow,
  onRestoreLastSave,
  onResetProject,
  studentName = '',
  onStudentNameChange,
  hasVerifyRun = false,
  fpgaConfig,
  importFidelity,
  onFpgaConfigChange,
}) => {
  const [highlightedMappingKey, setHighlightedMappingKey] = useState<string | null>(null);
  const [mappingExpanded, setMappingExpanded] = useState(false);
  const mappingInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mappingSectionRef = useRef<HTMLElement | null>(null);
  const examplesSectionRef = useRef<HTMLDetailsElement | null>(null);
  const highlightResetTimer = useRef<number | null>(null);
  const { activeBoardSignal, hoverBoardSignal } = useBoardSignal();
  const effectiveBoardSignal = hoverBoardSignal ?? activeBoardSignal;

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(highlightResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!diagnosticRouteRequest) return;
    if (diagnosticRouteRequest.mode !== 'project') return;

    const mappingKey = toMappingKey(
      diagnosticRouteRequest.mappingKey ?? diagnosticRouteRequest.portName ?? ''
    );
    if (!mappingKey) return;

    const input = mappingInputRefs.current[mappingKey];
    if (!input) return;

    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
    setHighlightedMappingKey(mappingKey);

    if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(highlightResetTimer.current);
    }
    if (typeof window !== 'undefined') {
      highlightResetTimer.current = window.setTimeout(() => {
        setHighlightedMappingKey(null);
      }, 1200);
    }
  }, [diagnosticRouteRequest]);

  const sortedMappingRows = useMemo(() => {
    const rows = mappingRows.map((row, index) => ({ ...row, sortIndex: index }));
    rows.sort((left, right) => {
      const leftMissing = left.pin.trim().length === 0 ? 0 : 1;
      const rightMissing = right.pin.trim().length === 0 ? 0 : 1;
      if (leftMissing !== rightMissing) return leftMissing - rightMissing;
      const leftRequired = left.required ? 0 : 1;
      const rightRequired = right.required ? 0 : 1;
      if (leftRequired !== rightRequired) return leftRequired - rightRequired;
      const labelOrder = compareText(left.label, right.label);
      if (labelOrder !== 0) return labelOrder;
      return left.sortIndex - right.sortIndex;
    });
    return rows;
  }, [mappingRows]);

  const unmappedRequiredCount = useMemo(
    () => sortedMappingRows.filter((row) => row.required && row.pin.trim().length === 0).length,
    [sortedMappingRows]
  );
  const mappedRequiredCount = useMemo(
    () => sortedMappingRows.filter((row) => row.required && row.pin.trim().length > 0).length,
    [sortedMappingRows]
  );
  const requiredCount = useMemo(
    () => sortedMappingRows.filter((row) => row.required).length,
    [sortedMappingRows]
  );
  const resolvedWorkflowAuthority = useMemo(
    () =>
      workflowAuthority ??
      deriveProjectWorkflowAuthority({
        projectHealthCore: health,
        readiness: {
          hasCircuit: readiness.hasCircuit,
          hasIoMapping: readiness.hasIoMapping,
          hasVectors: readiness.hasVectors,
          verifyQualification: readiness.verifyQualification,
        },
        verifyLastRun: health.lastVerify,
      }),
    [health, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors, readiness.verifyQualification, workflowAuthority]
  );
  const projectVerifyState = resolvedWorkflowAuthority.verifyState;
  const compareCurrent = resolvedWorkflowAuthority.compareCurrent;
  const comparePassIncomplete = resolvedWorkflowAuthority.comparePassIncomplete;
  const compareMatches = resolvedWorkflowAuthority.compareMatches;
  const compareDiffers = resolvedWorkflowAuthority.compareDiffers;
  const compareTraceOnly = resolvedWorkflowAuthority.compareTraceOnly;
  const activePrimaryCta = workflowAuthority?.primaryCta ?? primaryCta;
  const activePrimaryCtaLabel = workflowAuthority?.primaryCta.label ?? primaryCtaLabel;
  const blockingIssues = useMemo(() => health.blockingIssues, [health.blockingIssues]);
  const topBlockingIssues = useMemo(() => blockingIssues.slice(0, 3), [blockingIssues]);
  const activeExample = useMemo(
    () => examples.find((example) => example.id === activeExampleId) ?? null,
    [activeExampleId, examples]
  );
  const starterExample = projectKind === 'example' ? activeExample : null;
  const projectContextLabel = useMemo(() => {
    if (projectKind === 'blank' && readiness.hasCircuit) {
      return 'Fresh Project';
    }
    return getProjectKindDisplayName(projectKind);
  }, [projectKind, readiness.hasCircuit]);
  const showStarterGallery = examples.length > 0 && (projectKind === 'home' || projectKind === 'example');
  const missingRequiredRows = useMemo(
    () =>
      sortedMappingRows.filter((row) => row.required && row.pin.trim().length === 0).slice(0, 4),
    [sortedMappingRows]
  );

  const inputCount = useMemo(() => mappingRows.filter((r) => r.direction === 'in').length, [mappingRows]);
  const outputCount = useMemo(() => mappingRows.filter((r) => r.direction === 'out').length, [mappingRows]);
  const savedAgoLabel = useMemo(() => {
    if (!lastSavedAt) return null;
    try {
      const ts = new Date(lastSavedAt).getTime();
      if (isNaN(ts)) return null;
      const mins = Math.floor((Date.now() - ts) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins} min ago`;
      return `${Math.floor(mins / 60)}h ago`;
    } catch { return null; }
  }, [lastSavedAt]);
  const exportAvailable = resolvedWorkflowAuthority.exportAvailable;
  const exportPackageCurrent = resolvedWorkflowAuthority.exportPackageCurrent;
  const hardwareReady = resolvedWorkflowAuthority.hardwareReady;
  const hardBlockingIssue = blockingIssues.find((issue) =>
    issue.code === 'RBP1000' ||
    issue.code === 'RBP1001' ||
    issue.code === 'RBP1003' ||
    issue.code === 'RBP1005' ||
    issue.code === 'RBP2001'
  ) ?? null;

  const heroStatusMessage = useMemo((): string => {
    if (!readiness.hasCircuit) return 'No circuit loaded yet - build fresh, load an example, or import HDL.';
    if (unmappedRequiredCount > 0)
      return `Circuit loaded - ${unmappedRequiredCount} required pin${unmappedRequiredCount !== 1 ? 's are' : ' is'} unmapped.`;
    if (!readiness.hasIoMapping) return 'Circuit loaded - map pins before hardware use.';
    if (!readiness.hasVectors)
      return 'Mapping complete - export files are available now. Add vectors when you want to compare observed outputs.';
    if (projectVerifyState === 'stale')
      return 'Authored compare results are stale for the current circuit. Open Verify to trace the live design, refresh assertions, or intentionally keep the older reference.';
    if (comparePassIncomplete)
      return 'Assertions matched, but some outputs are still unmapped. Finish mapping before relying on hardware behavior.';
    if (compareTraceOnly)
      return 'Observation trace is current, but expected-output comparison has not run yet.';
    if (compareDiffers)
      return projectVerifyState === 'verify-error'
        ? 'Latest verify run hit a verification error. Export is still available, but inspect Verify before relying on the result.'
        : 'Assertions differ from observed outputs. Export is still available, but review the first difference before relying on the result.';
    if (!compareCurrent) return 'Compare results are not current yet. Export files are still available.';
    if (!exportPackageCurrent) return 'Compare results are current - open Export to build or refresh the submission package.';
    return 'All stages complete - bring up on hardware.';
  }, [
    compareCurrent,
    compareDiffers,
    comparePassIncomplete,
    compareTraceOnly,
    exportPackageCurrent,
    projectVerifyState,
    readiness.hasCircuit,
    readiness.hasIoMapping,
    readiness.hasVectors,
    unmappedRequiredCount,
  ]);

  const projectSummary = useMemo(() => {
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 0) return trimmedDescription;
    if (starterExample?.summary) return starterExample.summary;
    if (!readiness.hasCircuit) return 'Start from Project Home, then build fresh, load an example, or import HDL.';
    if (projectKind === 'blank') {
      return 'This circuit started from a blank canvas. Continue authoring, then map pins and verify before export.';
    }
    if (projectKind === 'custom') {
      return 'This is your authored circuit. Continue mapping, verify the current behavior, and refresh export when ready.';
    }
    if (projectKind === 'import') {
      return 'Imported circuit loaded. Review pins, verify the live behavior, and refresh export before hardware handoff.';
    }
    if (projectKind === 'saved') {
      return 'Saved circuit restored. Pick up at the next required stage before exporting or programming hardware.';
    }
    return `Top module ${topModuleName || 'top'} is loaded and ready for setup.`;
  }, [description, projectKind, readiness.hasCircuit, starterExample?.summary, topModuleName]);

  const verifySummary = useMemo(
    () => getVerifySummary(health, projectVerifyState, compareMatches, comparePassIncomplete),
    [compareMatches, comparePassIncomplete, health, projectVerifyState]
  );
  const exportSummary = useMemo(
    () => getExportSummary(health, exportAvailable, exportPackageCurrent, hardwareReady),
    [exportAvailable, exportPackageCurrent, hardwareReady, health]
  );
  const heroStatusTone = hardBlockingIssue ? 'warn' : hardwareReady ? 'ok' : exportAvailable ? 'warn' : 'idle';
  const heroStatusLabel = hardBlockingIssue
    ? 'Action needed'
    : hardwareReady
      ? 'Hardware ready'
      : exportAvailable
        ? compareDiffers
          ? 'Review compare'
          : compareCurrent
            ? 'Export available'
          : 'Available export'
        : 'In progress';
  const heroAssistAction = useMemo(() => {
    if (!readiness.hasCircuit) {
      return {
        label: 'Import HDL',
        onClick: onOpenImport,
      };
    }
    if (showStarterGallery) {
      return {
        label: 'Explore examples',
        onClick: () => examplesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      };
    }
    return {
      label: 'Open Design',
      onClick: onOpenDesign,
    };
  }, [onOpenDesign, onOpenImport, readiness.hasCircuit, showStarterGallery]);
  const nextStepTone = useMemo<'info' | 'warn' | 'success'>(() => {
    if (hardBlockingIssue || unmappedRequiredCount > 0) return 'warn';
    if (hardwareReady) return 'success';
    return exportAvailable || compareCurrent ? 'info' : 'warn';
  }, [compareCurrent, exportAvailable, hardBlockingIssue, hardwareReady, unmappedRequiredCount]);
  const nextStepReason = useMemo(() => {
    if (!readiness.hasCircuit) {
      return 'Pick a starter, import HDL, or open Design to begin the circuit workflow.';
    }
    if (unmappedRequiredCount > 0 || activePrimaryCta.mode === 'project') {
      return unmappedRequiredCount > 0
        ? `Assign the ${unmappedRequiredCount} remaining required pin${unmappedRequiredCount !== 1 ? 's' : ''} so Verify, Export, and Hardware describe the real board state.`
        : 'Review the Basys3 mapping before relying on downstream workflow stages.';
    }
    switch (activePrimaryCta.mode) {
      case 'design':
        return 'Return to Design to resolve circuit issues before you rely on Verify, Export, or Hardware.';
      case 'verify':
        if (projectVerifyState === 'stale') {
          return 'The circuit changed after the last authored comparison. Refresh Verify so Project, Export, and Hardware all reflect the current design.';
        }
        if (compareTraceOnly) {
          return 'Observed trace is current, but expected outputs still need to run before you treat Verify as trusted evidence.';
        }
        if (compareDiffers) {
          return 'The latest comparison differs from observed outputs. Inspect the mismatch before you rely on export or hardware behavior.';
        }
        return readiness.hasVectors
          ? 'Run Verify for the current circuit so the workflow has fresh comparison evidence.'
          : 'Add or rerun verification vectors so the current circuit has trusted comparison evidence.';
      case 'export':
        return exportPackageCurrent
          ? 'Export artifacts already match the current mapped design. Review them or move forward to hardware handoff.'
          : 'Build or refresh the current export bundle before moving to hardware.';
      case 'hardware':
        return 'Mapping, compare evidence, and export artifacts are current. Continue to hardware handoff from here.';
      case 'import':
        return 'Bring in HDL or a Vivado ZIP, then continue through Design, Verify, Export, and Hardware from one project record.';
      default:
        return heroStatusMessage;
    }
  }, [
    activePrimaryCta.mode,
    compareDiffers,
    compareTraceOnly,
    exportPackageCurrent,
    heroStatusMessage,
    projectVerifyState,
    readiness.hasCircuit,
    readiness.hasVectors,
    unmappedRequiredCount,
  ]);
  const sourceSummary = useMemo(() => {
    if (starterExample) {
      return `${projectContextLabel} - ${starterExample.name}`;
    }
    return projectContextLabel;
  }, [projectContextLabel, starterExample]);
  const currentFocusProjectLabel = useMemo(() => {
    if (starterExample) {
      return `Example Project - ${starterExample.name}`;
    }
    return sourceSummary;
  }, [sourceSummary, starterExample]);
  const importFidelitySummary = useMemo(() => {
    if (importFidelity === 'full') return 'Full restore';
    if (importFidelity === 'reconstructed') return 'Reconstructed';
    if (importFidelity === 'partial') return 'Partial';
    if (projectKind === 'import') return 'Not reported yet';
    return null;
  }, [importFidelity, projectKind]);
  const handleProjectModeAction = useCallback(
    (mode: ProjectHealthMode) => {
      switch (mode) {
        case 'design':
          onOpenDesign();
          return;
        case 'verify':
          onOpenVerify();
          return;
        case 'export':
          onOpenExport();
          return;
        case 'hardware':
          onOpenHardware();
          return;
        case 'import':
          onOpenImport();
          return;
        case 'project':
          setMappingExpanded(true);
          mappingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        default:
          return;
      }
    },
    [onOpenDesign, onOpenExport, onOpenHardware, onOpenImport, onOpenVerify]
  );


  const ioBusIoRows = useMemo(
    () =>
      mappingRows
        .filter((r): r is ProjectMappingRow & { nodeId: string } => Boolean(r.nodeId))
        .map((r) => ({ nodeId: r.nodeId, label: r.label, direction: r.direction })),
    [mappingRows]
  );
  const ioBus = useIoBus({
    ioRows: ioBusIoRows,
    runtimeSim: runtimeSim ?? PROJECT_EMPTY_SIM,
    setInput: () => {},
  });

  const mappingRowsUi = useMemo(
    () =>
      sortedMappingRows.map((row, index) => {
        const mappingView = toMappingView(row, index);
        const mappingKey = toMappingKey(row.label || row.id);
        const displayLabel = getStudentFacingIoLabel(row);
        const quickPins = getProjectQuickPickPins(row, index);
        const swM2 = /^SW(\d+)$/i.exec(row.label);
        const ldM2 = /^LD(\d+)$/i.exec(row.label);
        const rowSigType = swM2 ? 'sw' : ldM2 ? 'ld' : null;
        const rowSigIdx = swM2 ? parseInt(swM2[1], 10) : ldM2 ? parseInt(ldM2[1], 10) : -1;
        const isActiveRow =
          !!effectiveBoardSignal &&
          !!rowSigType &&
          effectiveBoardSignal.type === rowSigType &&
          effectiveBoardSignal.index === rowSigIdx;
        const portCell = (
          <span
            key={`${row.id}-port`}
            data-testid={`ide-project-port-${mappingKey}`}
            style={isActiveRow ? {
              background: 'color-mix(in srgb, var(--rb-signal) 12%, transparent)',
              borderRadius: 'var(--ide-radius-s)',
              padding: '1px 4px',
              cursor: onGoToHardware ? 'pointer' : undefined,
            } : undefined}
            onClick={isActiveRow && onGoToHardware ? () => onGoToHardware() : undefined}
          >
            <code style={{ fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>
              {displayLabel}
            </code>
          </span>
        );
        const pinCell = (
          <div className="ide-project-pin-field" data-testid={`ide-project-pin-field-${mappingKey}`}>
            <input
              ref={(node) => {
                mappingInputRefs.current[mappingKey] = node;
              }}
              className={`ide-export-pin-input ${
                highlightedMappingKey === mappingKey ? 'is-highlighted' : ''
              }`}
              value={row.pin}
              list={row.direction === 'in' ? 'ide-project-input-pin-options' : 'ide-project-output-pin-options'}
              onChange={(event) => onUpdateMappingPin(row.id, event.target.value.toUpperCase().trim())}
              placeholder={suggestBasys3Pin(row, index)}
              aria-label={`pin-${row.id}`}
              data-testid={`ide-project-map-input-${mappingKey}`}
            />
            {quickPins.length > 0 && (
              <div className="ide-project-pin-quick-picks">
                {quickPins.map((pin) => {
                  const isActive =
                    resolveBasys3PackagePin(row.pin) === resolveBasys3PackagePin(pin) &&
                    row.pin.trim().length > 0;
                  return (
                    <button
                      key={`${row.id}-${pin}`}
                      type="button"
                      className={`ide-project-pin-quick-pick${isActive ? ' is-active' : ''}`}
                      onClick={() => onUpdateMappingPin(row.id, pin)}
                      data-testid={`ide-project-map-quick-${mappingKey}-${toMappingKey(pin)}`}
                    >
                      {pin}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
        return [
          portCell,
          <span key={`${row.id}-alias`} data-testid={`ide-project-alias-${mappingKey}`}>
            {mappingView.aliasDisplay}
          </span>,
          pinCell,
          row.direction.toUpperCase(),
          <span key={`${row.id}-status`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IdeStatusPill tone={mappingView.statusTone}>
              {mappingView.statusLabel}
            </IdeStatusPill>
            {row.nodeId && (() => {
              const swM = /^SW(\d+)$/i.exec(row.label);
              const ldM = /^LD(\d+)$/i.exec(row.label);
              if (swM) {
                const bit = ioBus.state.sw[parseInt(swM[1], 10)] ?? 0;
                return (
                  <span
                    data-testid={`ide-project-live-dot-${row.id}`}
                    style={{ fontSize: 10, color: bit ? 'var(--rb-signal)' : 'var(--ide-text-subtle, #4a5568)' }}
                    title={`Live: ${bit ? 'HIGH' : 'LOW'}`}
                  >*</span>
                );
              }
              if (ldM) {
                const bit = ioBus.state.ld[parseInt(ldM[1], 10)] ?? 0;
                return (
                  <span
                    data-testid={`ide-project-live-dot-${row.id}`}
                    style={{ fontSize: 10, color: bit ? 'var(--rb-signal)' : 'var(--ide-text-subtle, #4a5568)' }}
                    title={`Live: ${bit ? 'HIGH' : 'LOW'}`}
                  >*</span>
                );
              }
              return null;
            })()}
          </span>,
        ];
      }),
    [effectiveBoardSignal, highlightedMappingKey, ioBus, onGoToHardware, onUpdateMappingPin, sortedMappingRows]
  );

  const stageCompletion = resolvedWorkflowAuthority.stageCompletion;
  const designCardDone = stageCompletion.design;
  const workflowTruthRows = useMemo(
    () => [
      {
        label: 'Design',
        tone: (designCardDone ? 'ok' : 'warn') as const,
        status: designCardDone ? 'CURRENT' : 'NEEDS CIRCUIT',
        copy: designCardDone
          ? 'Circuit structure is loaded in this project record.'
          : 'Start in Design before Verify, Map Pins, or Export can be trusted.',
      },
      {
        label: 'Verify',
        tone: (compareMatches ? 'ok' : 'warn') as const,
        status: compareMatches
          ? 'CHECKS CURRENT'
          : comparePassIncomplete
            ? 'REVIEW MAPPING'
            : compareDiffers
              ? 'CHECKS DIFFER'
              : compareTraceOnly
                ? 'OBSERVATION ONLY'
                : compareCurrent
                  ? 'TRACE CURRENT'
                  : 'NOT RUN',
        copy: verifySummary,
      },
      {
        label: MAP_PINS_STAGE_LABEL,
        tone: (readiness.hasIoMapping ? 'ok' : 'warn') as const,
        status: readiness.hasIoMapping ? 'READY' : 'BLOCKED',
        copy: readiness.hasIoMapping
          ? `${mappedRequiredCount}/${requiredCount} required pins assigned.`
          : `${unmappedRequiredCount} required pin${unmappedRequiredCount !== 1 ? 's are' : ' is'} still missing.`,
      },
      {
        label: EXPORT_STAGE_LABEL,
        tone: (exportPackageCurrent ? 'ok' : 'warn') as const,
        status: exportPackageCurrent ? 'CURRENT PACKAGE' : exportAvailable ? 'AVAILABLE' : 'BLOCKED',
        copy: exportSummary,
      },
    ],
    [
      compareCurrent,
      compareDiffers,
      compareMatches,
      comparePassIncomplete,
      compareTraceOnly,
      designCardDone,
      exportAvailable,
      exportPackageCurrent,
      exportSummary,
      mappedRequiredCount,
      readiness.hasIoMapping,
      requiredCount,
      unmappedRequiredCount,
      verifySummary,
    ]
  );
  const dockStageItems = useMemo(
    () => [
      {
        id: 'design',
        step: '01',
        label: 'Design',
        meta: stageCompletion.design ? 'Complete' : 'Start here',
        state: stageCompletion.design ? 'done' : activePrimaryCta.mode === 'design' ? 'active' : 'idle',
        onClick: onOpenDesign,
        testId: 'ide-project-dock-nav-design',
      },
      {
        id: 'verify',
        step: '02',
        label: 'Verify',
        meta: compareMatches
          ? 'Assertions match'
          : comparePassIncomplete
            ? 'Match review'
            : compareDiffers
              ? 'Assertions differ'
              : compareCurrent
                ? 'Simulation current'
                : activePrimaryCta.mode === 'verify'
                  ? 'Run now'
                  : 'Waiting',
        state: stageCompletion.verify ? 'done' : activePrimaryCta.mode === 'verify' ? 'active' : 'idle',
        onClick: onOpenVerify,
        testId: 'ide-project-dock-nav-verify',
      },
      {
        id: 'hardware',
        step: '03',
        label: MAP_PINS_STAGE_LABEL,
        meta: stageCompletion.hardware
          ? hardwareReady ? 'Ready to program' : 'Pins mapped'
          : activePrimaryCta.mode === 'hardware' ? 'Map now' : 'Needs pins',
        state: stageCompletion.hardware ? 'done' : activePrimaryCta.mode === 'hardware' ? 'active' : 'idle',
        onClick: onOpenHardware,
        testId: 'ide-project-dock-nav-hardware',
      },
      {
        id: 'export',
        step: '04',
        label: EXPORT_STAGE_LABEL,
        meta: stageCompletion.export ? 'Current' : exportAvailable ? 'Open now' : activePrimaryCta.mode === 'export' ? 'Next up' : 'Waiting',
        state: stageCompletion.export ? 'done' : exportAvailable && activePrimaryCta.mode === 'export' ? 'active' : 'idle',
        onClick: onOpenExport,
        testId: 'ide-project-dock-nav-export',
      },
    ],
    [
      stageCompletion,
      exportAvailable,
      hardwareReady,
      onOpenDesign,
      onOpenHardware,
      onOpenExport,
      onOpenVerify,
      activePrimaryCta.mode,
      compareCurrent,
      compareDiffers,
      compareMatches,
      comparePassIncomplete,
    ]
  );
  return (
    <IdeSurfaceLayout
      mode="project"
      consoleHasBlocking={false}
      consoleHasEntries={false}
      consoleMode="hidden"
      inspector={null}
      hideRightDock
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-project-start-dock">
          {/* Quick surface navigation */}
          <div className="ide-project-dock-nav" data-testid="ide-project-dock-nav">
            <p className="ide-surface-block-label">Jump to stage</p>
            <div className="ide-project-dock-stage-grid">
              {dockStageItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ide-project-dock-stage is-${item.state}`}
                  onClick={item.onClick}
                  data-testid={item.testId}
                >
                  <span className="ide-project-dock-stage-step">{item.step}</span>
                  <span className="ide-project-dock-stage-label">{item.label}</span>
                  <span className="ide-project-dock-stage-meta">{item.meta}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      }
      console={
        <section className="ide-workbench-console-content" data-testid="ide-project-console">
          <header className="ide-workbench-console-header">
            <h3>Project Console</h3>
            <span className="ide-workbench-console-mode">Project</span>
          </header>
          {blockingIssues.length > 0 ? (
            <IdeCallout tone="warn" title="Blocking issues">
              {blockingIssues[0]?.message}
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="Ready">
              No blockers. Continue through {STUDENT_WORKFLOW_SUMMARY}.
            </IdeCallout>
          )}
        </section>
      }
    >
      {/* Workspace: Hero - Examples - Mapping */}
      <IdePanel
        testId="ide-project-panel"
      >
        <div className="ide-project-identity-strip" data-testid="ide-project-identity-strip">
          <span className="ide-project-identity-name">{projectName}</span>
          {studentName && (
            <span className="ide-project-identity-student">{studentName}</span>
          )}
        </div>
        {/* Sprint 10: 3-state layout - landing / loaded / submit */}
        {!readiness.hasCircuit ? (
          /* STATE A: No circuit - clean 3-option landing */
          <div className="ide-project-landing" data-testid="ide-project-landing">
            <div className="ide-project-landing-header">
              <h2 className="ide-project-landing-title">
                {projectKind === 'home' ? 'Project Home' : 'Start your lab'}
              </h2>
              <p className="ide-project-landing-sub">
                Pick a starting point to begin the full {STUDENT_WORKFLOW_SUMMARY} workflow.
              </p>
            </div>
            {(recentProjects.length > 0 || onOpenSavedProjects) && (
              <div className="ide-project-recent-panel" data-testid="ide-project-recent-panel">
                <div className="ide-project-recent-head">
                  <div>
                    <p className="ide-project-recent-title">Continue recent work</p>
                    <p className="ide-project-recent-sub">
                      Reopen a saved project or browse the full local project list.
                    </p>
                  </div>
                  {onOpenSavedProjects && (
                    <IdeButton
                      tone="secondary"
                      onClick={onOpenSavedProjects}
                      testId="ide-project-open-existing"
                    >
                        Open existing project...
                    </IdeButton>
                  )}
                </div>
                {recentProjects.length > 0 && (
                  <div className="ide-project-recent-list">
                    {recentProjects.map((project) => (
                      <button
                        key={project.projectId}
                        type="button"
                        className="ide-project-recent-card"
                        onClick={() => onOpenRecentProject?.(project.projectId)}
                        data-testid={`ide-project-recent-${project.projectId}`}
                      >
                        <span className="ide-project-recent-card-title">{project.projectName}</span>
                        <span className="ide-project-recent-card-meta">
                          Saved {formatSavedAt(project.savedAtIso)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="ide-project-landing-options">
              {examples.slice(0, 3).map((ex) => {
                const preview = getExamplePreview(ex.id);
                return (
                  <button
                    key={ex.id}
                    type="button"
                    className="ide-project-landing-option"
                    onClick={() => { onOpenExample(ex.id); onOpenDesign(); }}
                    data-testid={`ide-project-landing-example-${ex.id}`}
                  >
                    <span className="ide-project-landing-option-eyebrow">{preview.eyebrow}</span>
                    <span className="ide-project-landing-option-title">{ex.name}</span>
                    <span className="ide-project-landing-option-sub">{ex.concept}</span>
                    {ex.expectedBehavior && (
                      <span className="ide-project-landing-option-learn">{ex.expectedBehavior}</span>
                    )}
                    <span className="ide-project-landing-option-cta">Load &amp; Design -&gt;</span>
                  </button>
                );
              })}
              <button
                type="button"
                className="ide-project-landing-option ide-project-landing-option--fresh"
                onClick={onStartBlankProject ?? onOpenDesign}
                data-testid="ide-project-landing-fresh"
              >
                <span className="ide-project-landing-option-eyebrow">Empty canvas</span>
                <span className="ide-project-landing-option-title">Build Fresh</span>
                <span className="ide-project-landing-option-sub">Start with gates and wires from scratch</span>
                <span className="ide-project-landing-option-cta">Open blank Design -&gt;</span>
              </button>
            </div>
            <p className="ide-copy" style={{ margin: 0, fontSize: 11 }}>
              Need to reuse prior HDL?{' '}
              <button
                type="button"
                className="ide-project-quickstart-import-link"
                onClick={onOpenImport}
                data-testid="ide-project-quickstart-import-link"
              >
                import HDL / Vivado ZIP
              </button>
              .
            </p>

            {/* Lab Starters Gallery */}
            <details
              className="ide-project-lab-gallery-disclosure"
              open
              data-testid="ide-project-lab-gallery-disclosure"
            >
              <summary className="ide-project-lab-gallery-summary">All lab starters (8 labs)</summary>
              <div className="ide-project-lab-gallery" data-testid="ide-project-lab-gallery">
                {LAB_STARTERS.map((starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    className="ide-project-lab-card"
                    onClick={() => { onOpenExample(starter.example.id); onOpenDesign(); }}
                    data-testid={`ide-project-lab-card-${starter.id}`}
                  >
                    <span className="ide-project-lab-card-number">Lab {starter.labNumber}</span>
                    <span className="ide-project-lab-card-title">{starter.title.replace(/^Lab \d+\s+[-\u2013\u2014]\s+/u, '')}</span>
                    <span className="ide-project-lab-card-desc">{starter.description}</span>
                    <div className="ide-project-lab-card-meta">
                      <span className={`ide-project-lab-card-badge ide-project-lab-card-badge--${starter.difficulty}`}>
                        {starter.difficulty}
                      </span>
                      <span className="ide-project-lab-card-time">{starter.estimatedMinutes} min</span>
                    </div>
                    <span className="ide-project-lab-card-cta">Start -&gt;</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        ) : (
          <>
        <div className="ide-surface-command-stack">
          <SurfaceCommandStrip
            className="ide-project-command-strip"
            testId="ide-project-command-strip"
            label="Project"
            title={`Current focus: Continue to ${activePrimaryCtaLabel}`}
            description={(
              <span data-testid="ide-project-command-strip-next-step">
                <span className="ide-surface-command-inline-label">Next step</span>{' '}
                <span data-testid="ide-project-command-strip-next-step-copy">{nextStepReason}</span>
              </span>
            )}
            meta={(
              <>
                <IdeStatusPill tone={heroStatusTone}>{heroStatusLabel.toUpperCase()}</IdeStatusPill>
                <span
                  className="ide-surface-command-meta-note"
                  data-testid="ide-project-hero-status"
                >
                  {heroStatusMessage}
                </span>
                <span className="ide-surface-command-chip">Basys3</span>
                <span className="ide-surface-command-chip">{projectContextLabel}</span>
                <span className="ide-surface-command-chip">{inputCount} in / {outputCount} out</span>
                {compareMatches && (
                  <span className="ide-surface-command-chip is-ok">Checks current</span>
                )}
                {savedAgoLabel && (
                  <span className="ide-surface-command-meta-note">Saved {savedAgoLabel}</span>
                )}
              </>
            )}
            actions={(
              <>
                <span data-testid="ide-project-command-strip-continue-cta">
                  <span data-testid="ide-project-continue-cta">
                    <IdeButton
                    tone="primary"
                    onClick={onPrimaryCta}
                    testId="ide-project-command-strip-primary-cta"
                  >
                      Continue to {activePrimaryCtaLabel}{' ->'}
                  </IdeButton>
                  </span>
                </span>
                <IdeButton
                  tone="secondary"
                  onClick={heroAssistAction.onClick}
                  testId="ide-project-command-strip-secondary-cta"
                >
                  {heroAssistAction.label}
                </IdeButton>
              </>
            )}
          />
        </div>
        <SurfacePanel className="ide-project-current-focus ide-surface-primary-region" testId="ide-project-current-focus">
          <div className="ide-project-current-focus-shell" data-testid="ide-project-showcase">
            <div className="ide-project-current-focus-headline">
              <span className="ide-project-current-focus-eyebrow">
                {starterExample?.lab ?? starterExample?.course ?? 'Workflow home'}
              </span>
              <p className="ide-project-current-focus-kicker">Continue to {activePrimaryCtaLabel}</p>
              <h2 className="ide-project-current-focus-title">
                {starterExample?.name ?? projectName}
              </h2>
                <p className="ide-project-current-focus-summary">{projectSummary}</p>
                {starterExample?.expectedBehavior && (
                  <p className="ide-project-current-focus-goal">{starterExample.expectedBehavior}</p>
                )}
            </div>
              <div className="ide-project-current-focus-chip-row">
                <span className="ide-project-context-tag">Basys3</span>
                <span className="ide-project-context-tag">{projectContextLabel}</span>
                <span className="ide-project-context-tag">{inputCount} in / {outputCount} out</span>
                {starterExample?.concept && (
                  <span className="ide-project-context-tag">{starterExample.concept}</span>
                )}
              </div>
              <IdeCallout
                tone={nextStepTone}
                title="Why this is next"
                testId="ide-project-next-step"
                className="ide-project-current-focus-callout"
              >
                <p data-testid="ide-project-next-step-copy" style={{ margin: 0 }}>
                  {nextStepReason}
                </p>
                <div className="ide-project-current-focus-support" data-testid="ide-project-current-focus-support">
                  <strong>{heroStatusLabel}.</strong> {heroStatusMessage}
                </div>
              </IdeCallout>
              <div className="ide-project-current-focus-facts" data-testid="ide-project-current-focus-facts">
                <div className="ide-project-current-focus-fact">
                  <span className="ide-project-current-focus-fact-label">Project</span>
                  <span className="ide-project-current-focus-fact-value">{currentFocusProjectLabel}</span>
                </div>
                <div className="ide-project-current-focus-fact">
                  <span className="ide-project-current-focus-fact-label">Top module</span>
                  <span className="ide-project-current-focus-fact-value">{topModuleName || 'top'}</span>
                </div>
                <div className="ide-project-current-focus-fact">
                  <span className="ide-project-current-focus-fact-label">Project note</span>
                  <span className="ide-project-current-focus-fact-value">
                    {starterExample?.expectedBehavior || projectSummary}
                  </span>
                </div>
                <div className="ide-project-current-focus-fact">
                  <span className="ide-project-current-focus-fact-label">Last saved</span>
                  <span className="ide-project-current-focus-fact-value">
                    {lastSavedAt ? formatSavedAt(lastSavedAt) : 'No local snapshot yet'}
                  </span>
                </div>
                {importFidelitySummary ? (
                  <div className="ide-project-current-focus-fact">
                    <span className="ide-project-current-focus-fact-label">Import fidelity</span>
                    <span className="ide-project-current-focus-fact-value" data-testid="ide-project-reference-fidelity">
                      {importFidelitySummary}
                    </span>
                  </div>
                ) : null}
                <div className="ide-project-current-focus-fact">
                  <details className="ide-project-hash-details">
                    <summary className="ide-project-current-focus-fact-label" style={{ cursor: 'pointer', userSelect: 'none' }}>Circuit hash</summary>
                    <code className="ide-project-current-focus-fact-value ide-project-hash-code" data-testid="ide-project-reference-determinism">
                      {determinismHash.slice(0, 12)}
                    </code>
                  </details>
                </div>
              </div>
              {(onSaveNow || onOpenSavedProjects || onRestoreLastSave || onResetProject) && (
                <div className="ide-project-current-focus-actions" data-testid="ide-project-current-focus-actions">
                  {savedAgoLabel ? (
                    <p
                      className="ide-copy"
                      data-testid="ide-session-last-saved"
                      style={{ color: 'var(--ide-text-soft)', margin: 0, fontSize: 12 }}
                    >
                      Last saved {savedAgoLabel}
                    </p>
                  ) : null}
                  <div className="ide-inline-actions" data-testid="ide-session-controls">
                    {onSaveNow && (
                      <IdeButton tone="secondary" onClick={onSaveNow} testId="ide-session-save-now">
                        Save now
                      </IdeButton>
                    )}
                    {onOpenSavedProjects && (
                      <IdeButton tone="ghost" onClick={onOpenSavedProjects} testId="ide-session-open-existing">
                        Open existing
                      </IdeButton>
                    )}
                    {onRestoreLastSave && (
                      <IdeButton tone="ghost" onClick={onRestoreLastSave} testId="ide-session-restore">
                        Restore last save
                      </IdeButton>
                    )}
                    {onResetProject && (
                      <IdeButton tone="danger" onClick={onResetProject} testId="ide-session-reset">
                        Reset project
                      </IdeButton>
                    )}
                  </div>
                </div>
              )}
            </div>

          {/* Gate sentinel - text content only, not displayed */}
          <span style={{ display: 'none' }} data-testid="ide-project-continue-target">{activePrimaryCtaLabel}</span>

          {topBlockingIssues.length > 0 && (
            <IdeCallout 
              tone="warn" 
              title={`${topBlockingIssues.length} blocker${topBlockingIssues.length > 1 ? 's' : ''} to resolve`} 
              testId="ide-project-hero-blocker"
            >
              <div data-testid="ide-project-blockers-list" className="ide-project-blocker-list">
                {topBlockingIssues.map((issue, idx) => (
                  <div key={issue.code} data-testid={`ide-project-blocker-${idx}`} className="ide-project-blocker-item">
                    <span className="ide-project-blocker-msg">{issue.message}</span>
                    {issue.fixPath && (
                      <IdeButton
                        tone="primary"
                        onClick={() => handleProjectModeAction(issue.fixPath!.mode)}
                        testId={`ide-project-blocker-${idx}-action`}
                      >
                        {issue.fixPath.actionLabel} →
                      </IdeButton>
                    )}
                  </div>
                ))}
              </div>
              {blockingIssues.length > 3 && (
                <p style={{ margin: '0.75rem 0 0 0', fontSize: 12, opacity: 0.8 }}>
                  {'...and '}{blockingIssues.length - 3} more
                </p>
              )}
            </IdeCallout>
          )}
        </SurfacePanel>

        {showStarterGallery && (
          <details
            ref={examplesSectionRef}
            className="ide-project-examples-disclosure"
            data-testid="ide-project-examples-disclosure"
          >
            <summary className="ide-project-examples-disclosure-summary">
              Try another starter
            </summary>
            <SurfacePanel className="ide-project-quickstart" testId="ide-project-quickstart">
              <p className="ide-project-quickstart-title">
                Starter Projects
              </p>
              <p className="ide-project-quickstart-sub">
                Swap into a different starter to compare mappings, verify flows, and hardware outcomes.
              </p>
              <div className="ide-project-example-card-row">
                {examples.slice(0, 3).map((ex) => {
                  const preview = getExamplePreview(ex.id);
                  return (
                    <div
                      key={ex.id}
                      className={`ide-project-example-btn ${activeExampleId === ex.id ? 'is-active' : ''}`}
                      data-testid={`ide-project-example-${ex.id}`}
                      data-example-id={ex.id}
                    >
                      <span data-testid="ide-project-example-card" data-example-id={ex.id} />
                      <div className="ide-project-example-visual" aria-hidden="true" data-example-id={ex.id}>
                        <div className="ide-project-example-visual-head">
                          <span className="ide-project-example-visual-badge">
                            {preview.eyebrow}
                          </span>
                          <span className="ide-project-example-visual-pill">
                            {preview.pill}
                          </span>
                        </div>
                        <div className="ide-project-example-visual-grid">
                          {preview.rows.map((row) => (
                            <div key={`${ex.id}-${row.left}-${row.right}`} className="ide-project-example-visual-row">
                              <span className="ide-project-example-visual-node is-input">{row.left}</span>
                              <span className="ide-project-example-visual-link" />
                              <span className="ide-project-example-visual-node is-output">{row.right}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="ide-project-example-btn-name">{ex.name}</span>
                      <span className="ide-project-example-btn-concept">{ex.concept}</span>
                      <div className="ide-project-example-meta-row">
                        <span>{ex.course || 'Starter'}</span>
                        <span>{ex.lab || preview.pill}</span>
                      </div>
                      {ex.expectedBehavior && (
                        <>
                          <span className="ide-project-example-btn-learn-label">You'll learn</span>
                          <span className="ide-project-example-btn-summary">{ex.expectedBehavior}</span>
                        </>
                      )}
                      <div
                        className="ide-project-example-btn-actions"
                        data-testid="ide-project-example-load"
                        data-example-id={ex.id}
                      >
                        <button
                          type="button"
                          className="ide-button ide-button-primary"
                          style={{ fontSize: 11, padding: '4px 12px', minHeight: 26 }}
                          onClick={() => { onOpenExample(ex.id); onOpenDesign(); }}
                          data-testid={`ide-project-load-start-${ex.id}`}
                        >
                          Load &amp; Design -&gt;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="ide-copy" style={{ margin: 0, fontSize: 11 }}>
                Or{' '}
                <button type="button" className="ide-project-quickstart-import-link" onClick={onOpenImport}>
                  import HDL / Vivado ZIP
                </button>{' '}
                from an existing project.
              </p>
            </SurfacePanel>
          </details>
        )}
          </>
        )}

        {readiness.hasCircuit && (
        <section
          ref={mappingSectionRef}
          className="ide-export-section"
          data-testid="ide-project-panel-mapping"
        >
          {/* Identity details - KV rows moved here; test IDs preserved */}
          <details className="ide-project-identity-details" data-testid="ide-project-panel-identity">
            <summary>Project details</summary>
            <div className="ide-kv-list" style={{ marginTop: 'var(--rb-space-2)' }}>
              <div className="ide-kv-row">
                <span>Determinism hash</span>
                <code data-testid="ide-project-hash-short">{determinismHash.slice(0, 12)}</code>
              </div>
              <div className="ide-kv-row">
                <span>Last verify</span>
                <span data-testid="ide-project-last-verify-status">
                  {compareTraceOnly
                    ? 'TRACE'
                    : (health.lastVerify?.status ?? 'none').toUpperCase()}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Verify hash</span>
                <code data-testid="ide-project-last-verify-hash">
                  {health.lastVerify?.hash?.slice(0, 12) ?? '-'}
                </code>
              </div>
              <div className="ide-kv-row">
                <span>Dirty since verify</span>
                <span data-testid="ide-project-dirty-since-verify">
                  {health.dirtySinceVerify ? 'DIRTY' : 'CLEAN'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Dirty since export</span>
                <span data-testid="ide-project-dirty-since-export">
                  {health.dirtySinceExport ? 'DIRTY' : 'CLEAN'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Unmapped required</span>
                <span data-testid="ide-project-unmapped-count">{unmappedRequiredCount} unmapped</span>
              </div>
            </div>
          </details>

          {/* FPGA Configuration - collapsed by default */}
          <details className="ide-project-identity-details" data-testid="ide-project-fpga-config">
            <summary>FPGA configuration</summary>
            <div className="ide-kv-list" style={{ marginTop: 'var(--rb-space-2)' }}>
              <div className="ide-kv-row">
                <span>Board</span>
                <span>{fpgaConfig?.board ?? 'Basys3'}</span>
              </div>
              <div className="ide-kv-row">
                <label htmlFor="ide-fpga-top-input">Top module</label>
                <input
                  id="ide-fpga-top-input"
                  type="text"
                  className="ide-input-inline"
                  value={fpgaConfig?.top ?? topModuleName ?? 'top'}
                  data-testid="ide-project-fpga-top"
                  onChange={(event) => onFpgaConfigChange?.({ top: event.currentTarget.value })}
                />
              </div>
              <div className="ide-kv-row">
                <label htmlFor="ide-fpga-part-input">Part number</label>
                <input
                  id="ide-fpga-part-input"
                  type="text"
                  className="ide-input-inline"
                  value={fpgaConfig?.part ?? 'xc7a35tcpg236-1'}
                  data-testid="ide-project-fpga-part"
                  onChange={(event) => onFpgaConfigChange?.({ part: event.currentTarget.value })}
                />
              </div>
              {importFidelity && (
                <div className="ide-kv-row">
                  <span>Import fidelity</span>
                  <span
                    data-testid="ide-project-import-fidelity"
                    className={`ide-chip ${importFidelity === 'full' ? 'ide-chip-ok' : importFidelity === 'reconstructed' ? 'ide-chip-warn' : 'ide-chip-err'}`}
                  >
                    {importFidelity === 'full' ? 'Full restore' : importFidelity === 'reconstructed' ? 'Reconstructed' : 'Partial'}
                  </span>
                </div>
              )}
            </div>
          </details>

          <div
            className={`ide-project-mapping-summary${unmappedRequiredCount > 0 ? ' has-error' : ''}`}
            data-testid="ide-project-mapping-summary-strip"
          >
            <span className="ide-project-mapping-summary-stat" data-testid="ide-project-mapping-stat">
              {unmappedRequiredCount > 0
                ? `${unmappedRequiredCount} port${unmappedRequiredCount !== 1 ? 's' : ''} unmapped`
                : `${mappedRequiredCount}/${requiredCount} required mapped`}
            </span>
            {unmappedRequiredCount > 0 && (
              <span className="ide-chip ide-chip-warn" data-testid="ide-project-mapping-warn-chip">
                {unmappedRequiredCount} unmapped
              </span>
            )}
            {missingRequiredRows.length > 0 && (
              <div
                className="ide-project-mapping-preview"
                data-testid="ide-project-mapping-missing-list"
              >
                {missingRequiredRows.map((row) => (
                  <span key={row.id} className="ide-project-mapping-preview-chip">
                    {getStudentFacingIoLabel(row)}
                  </span>
                ))}
                {unmappedRequiredCount > missingRequiredRows.length && (
                  <span className="ide-project-mapping-preview-more">
                    +{unmappedRequiredCount - missingRequiredRows.length} more
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              className={`ide-project-mapping-expand-btn${unmappedRequiredCount > 0 ? ' is-error' : ''}`}
              onClick={() => setMappingExpanded((previous) => !previous)}
              data-testid="ide-project-mapping-expand-btn"
              aria-expanded={mappingExpanded}
            >
              {mappingExpanded
                ? 'Close Mapping'
                : unmappedRequiredCount > 0 ? 'Fix Mapping' : 'Open Mapping'}
              <span className="ide-project-mapping-expand-arrow" aria-hidden="true">
                {mappingExpanded ? '^' : 'v'}
              </span>
            </button>
          </div>

          {mappingExpanded && (
            <div className="ide-project-mapping-table-wrap" data-testid="ide-project-mapping-table-wrap">
              <div className="ide-project-mapping-quick-hint" data-testid="ide-project-mapping-quick-hint">
                Use Basys3 aliases directly: inputs <code>CLK100MHZ</code>, <code>SW0-SW15</code>,{' '}
                <code>BTNC-BTNR</code>; outputs <code>LD0-LD15</code>, <code>SEG0-SEG6</code>,{' '}
                <code>DP</code>, <code>AN0-AN3</code>.
              </div>
              <div
                className={`ide-project-mapping-status ${unmappedRequiredCount > 0 ? 'is-error' : 'is-complete'}`}
                data-testid="ide-project-mapping-banner"
              >
                <span className="ide-project-mapping-status-dot" />
                <span>
                  {unmappedRequiredCount > 0
                    ? `${unmappedRequiredCount} port${unmappedRequiredCount !== 1 ? 's' : ''} unmapped`
                    : `${mappedRequiredCount} / ${requiredCount} required mapped`}
                </span>
              </div>
              <IdeDataTable
                columns={['Port', 'Alias (Basys3)', 'Pin', 'Dir', 'Status']}
                rows={mappingRowsUi}
                testId="ide-project-mapping-table"
              />
              <datalist id="ide-project-input-pin-options">
                {PROJECT_INPUT_ALIAS_OPTIONS.map((pin) => (
                  <option key={pin} value={pin} />
                ))}
              </datalist>
              <datalist id="ide-project-output-pin-options">
                {PROJECT_OUTPUT_ALIAS_OPTIONS.map((pin) => (
                  <option key={pin} value={pin} />
                ))}
              </datalist>
            </div>
          )}
        </section>
        )}
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

interface MappingView {
  aliasDisplay: string;
  statusTone: 'ok' | 'warn' | 'error';
  statusLabel: string;
}

function toMappingView(
  row: Pick<ProjectMappingRow, 'pin' | 'direction'>,
  index: number
): MappingView {
  const normalizedPin = row.pin.trim().toUpperCase();
  if (normalizedPin.length === 0) {
    return {
      aliasDisplay: '-',
      statusTone: 'warn',
      statusLabel: 'Missing',
    };
  }

  const resolvedPin = resolveBasys3PackagePin(normalizedPin);
  if (!resolvedPin) {
    return {
      aliasDisplay: normalizedPin,
      statusTone: 'error',
      statusLabel: 'Invalid',
    };
  }

  const alias =
    normalizedPin === resolvedPin
      ? inferAliasFromPackagePin(resolvedPin, row.direction, index)
      : normalizedPin;

  return {
    aliasDisplay: `${alias} -> ${resolvedPin}`,
    statusTone: 'ok',
    statusLabel: 'Mapped',
  };
}

function inferAliasFromPackagePin(
  packagePin: string,
  direction: 'in' | 'out',
  fallbackIndex: number
): string {
  if (packagePin === BASYS3_CLOCK_PIN) return 'CLK100MHZ';
  if (packagePin === BASYS3_DP_PIN) return 'DP';

  const switchIndex = BASYS3_SWITCH_PINS.indexOf(packagePin as (typeof BASYS3_SWITCH_PINS)[number]);
  if (switchIndex >= 0) return `SW${switchIndex}`;

  const buttonIndex = BASYS3_BUTTON_PINS.indexOf(packagePin as (typeof BASYS3_BUTTON_PINS)[number]);
  if (buttonIndex >= 0) {
    const buttonAliases = ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'];
    return buttonAliases[buttonIndex] ?? `BTN${buttonIndex}`;
  }

  const ledIndex = BASYS3_LED_PINS.indexOf(packagePin as (typeof BASYS3_LED_PINS)[number]);
  if (ledIndex >= 0) return `LD${ledIndex}`;

  const segIndex = BASYS3_SEGMENT_PINS.indexOf(packagePin as (typeof BASYS3_SEGMENT_PINS)[number]);
  if (segIndex >= 0) return `SEG${segIndex}`;

  const anodeIndex = BASYS3_ANODE_PINS.indexOf(packagePin as (typeof BASYS3_ANODE_PINS)[number]);
  if (anodeIndex >= 0) return `AN${anodeIndex}`;

  return direction === 'in' ? `SW${Math.min(fallbackIndex, 15)}` : `LD${Math.min(fallbackIndex, 15)}`;
}

function suggestBasys3Pin(signal: { id: string; direction: 'in' | 'out' }, index: number): string {
  if (signal.direction === 'in') {
    if (signal.id.toLowerCase() === 'clk') return 'CLK100MHZ';
    return `SW${Math.min(index, 15)}`;
  }
  return `LD${Math.min(index, 15)}`;
}

function getProjectQuickPickPins(
  row: Pick<ProjectMappingRow, 'label' | 'port' | 'direction'>,
  index: number
): string[] {
  const raw = getStudentFacingIoLabel(row).trim().toUpperCase();
  const suggestions = new Set<string>();
  const exactMatch = /^(CLK100MHZ|CLK|SW\d{1,2}|LD\d{1,2}|LED\d{1,2}|BTN[CUDLR]|\bDP\b|SEG\d|AN\d)$/i.exec(raw);
  if (exactMatch) {
    suggestions.add(raw === 'CLK' ? 'CLK100MHZ' : raw);
  }

  if (row.direction === 'in') {
    if (!exactMatch && /RESET|RST/.test(raw)) suggestions.add('BTNC');
    suggestions.add(suggestBasys3Pin({ id: raw || `IN${index}`, direction: row.direction }, index));
    if (!suggestions.has('CLK100MHZ')) suggestions.add('CLK100MHZ');
    suggestions.add('SW0');
    suggestions.add('BTNC');
  } else {
    suggestions.add(suggestBasys3Pin({ id: raw || `OUT${index}`, direction: row.direction }, index));
    suggestions.add('SEG0');
    suggestions.add('AN0');
    suggestions.add('DP');
  }

  return Array.from(suggestions)
    .filter((pin) => resolveBasys3PackagePin(pin) !== null)
    .slice(0, 4);
}

function formatSavedAt(value: string): string {
  if (!value) return 'not saved';
  return value.replace('T', ' ').replace('.000Z', 'Z');
}

function getExamplePreview(exampleId: string): {
  eyebrow: string;
  pill: string;
  rows: Array<{ left: string; right: string }>;
} {
  switch (exampleId) {
    case 'signal-tour':
      return {
        eyebrow: 'Switch map',
        pill: '1:1 flow',
        rows: [
          { left: 'SW0', right: 'LD0' },
          { left: 'SW1', right: 'LD1' },
          { left: 'SW2', right: 'LD2' },
        ],
      };
    case 'logic-gates':
      return {
        eyebrow: 'Truth table',
        pill: '3 outputs',
        rows: [
          { left: 'A,B', right: 'AND' },
          { left: 'A,B', right: 'OR' },
          { left: 'A!=B', right: 'XOR' },
        ],
      };
    case 'two-bit-counter':
      return {
        eyebrow: 'Clocked',
        pill: 'Sequential',
        rows: [
          { left: 'CLK', right: 'Q0' },
          { left: 'Q0', right: 'Q1' },
          { left: 'RST', right: 'CLR' },
        ],
      };
    default:
      return {
        eyebrow: 'Starter',
        pill: 'Preview',
        rows: [
          { left: 'IN0', right: 'OUT0' },
          { left: 'IN1', right: 'OUT1' },
          { left: 'IN2', right: 'OUT2' },
        ],
      };
  }
}

function getVerifySummary(
  health: ProjectHealth,
  projectVerifyState: ProjectVerifyState,
  compareMatches: boolean,
  comparePassIncomplete: boolean
): string {
  if (!health.lastVerify) return 'No comparison run yet - open Verify to define test vectors and compare observed outputs.';
  if (compareMatches) return 'Latest comparison run matches the current design.';
  if (comparePassIncomplete) {
    return 'Assertions matched the live design, but some required outputs still need board mapping review.';
  }
  if (projectVerifyState === 'stale') {
    return 'The last authored comparison belongs to an older design state. Open Verify to trace the current circuit, reset to stimulus-only, or intentionally rerun against the older reference.';
  }
  if (projectVerifyState === 'trace') {
    return 'A trace-only run is current. Expected-output comparison still needs to run before you rely on Verify.';
  }
  if (projectVerifyState === 'verify-error') {
    return 'Latest verify run hit a verification error before a clean comparison result was produced.';
  }
  if (health.lastVerify.status === 'fail') {
    return 'Assertions differ from observed outputs - open Verify to inspect the first difference.';
  }
  if (health.dirtySinceVerify) return 'Design changed since the last comparison run - rerun Verify before relying on the result.';
  return 'Compare results still need attention before you rely on them.';
}

function getExportSummary(
  health: ProjectHealth,
  exportAvailable: boolean,
  exportPackageCurrent: boolean,
  hardwareReady: boolean
): string {
  if (!health.lastExport) {
    if (!exportAvailable) return 'Export stays blocked until mapping is complete.';
    return exportPackageCurrent
      ? 'Ready for the first export build.'
      : 'Export can be opened now for file review or download.';
  }
  if (health.lastExport.status === 'blocked') {
    return 'Latest export attempt was blocked. Open Export diagnostics before hardware.';
  }
  if (hardwareReady) return 'Latest export bundle is current and ready for hardware.';
  if (health.dirtySinceExport) {
    return exportPackageCurrent
      ? 'A previous export exists, but the project changed since then.'
      : 'A previous export exists, and Export can still be reopened while compare results catch up.';
  }
  return exportPackageCurrent
    ? 'Export can be opened for artifact review or rebuild.'
    : 'Export is available for artifact review or download.';
}

function toMappingKey(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
