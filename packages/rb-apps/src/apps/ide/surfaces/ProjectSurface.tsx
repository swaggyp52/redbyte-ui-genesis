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
import type { ProjectHealth, ProjectHealthIssue, ProjectHealthMode, ProjectPrimaryCta } from '../projectHealth';
import type { IdeDiagnosticRouteRequest } from '../diagnostics';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { RuntimeSimState } from '../projectRuntime';
import { useIoBus } from '../ioBus';
import { useBoardSignal } from '../BoardSignalContext';
import { getStudentFacingIoLabel } from '../ioLabels';
import { LAB_STARTERS } from '../labStarters';

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

/**
 * Synthesizes the complete list of export trust blockers, including:
 * - All existing health.blockingIssues
 * - RBP1005 when verify passes but has incomplete mapping
 */
function buildExportTrustBlockers(
  health: ProjectHealth,
  verifyPassIncomplete: boolean
): ProjectHealthIssue[] {
  const issues = [...health.blockingIssues];
  
  if (verifyPassIncomplete) {
    const hasRbp1005 = issues.some((issue) => issue.code === 'RBP1005');
    if (!hasRbp1005) {
      issues.push({
        code: 'RBP1005',
        message: 'Verify passed, but some output pins remain unmapped — hardware results may not match.',
        fixPath: { mode: 'project', actionLabel: 'Map Missing Pins' },
      });
    }
  }
  
  return issues;
}

export const ProjectSurface: React.FC<ProjectSurfaceProps> = ({
  projectName,
  description,
  determinismHash,
  topModuleName,
  lastSavedAt,
  simRunning,
  readiness,
  health,
  mappingRows,
  examples,
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

  const verifyPassCurrent = health.lastVerify?.status === 'pass' && !health.dirtySinceVerify;
  const verifyPassIncomplete =
    verifyPassCurrent && readiness.verifyQualification === 'incomplete-mapping';
  const verifyTrusted = verifyPassCurrent && !verifyPassIncomplete;
  const verifyPass = readiness.verifyPass; // Keep for backward compatibility in display
  const blockingIssues = useMemo(
    () => buildExportTrustBlockers(health, verifyPassIncomplete),
    [health, verifyPassIncomplete]
  );
  const topBlockingIssues = useMemo(() => blockingIssues.slice(0, 3), [blockingIssues]);
  const blockingIssue = topBlockingIssues[0] ?? null;
  const activeExample = useMemo(
    () => examples.find((example) => example.id === activeExampleId) ?? null,
    [activeExampleId, examples]
  );
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
  const exportAvailable =
    readiness.hasCircuit &&
    readiness.hasIoMapping &&
    health.lastExport?.status !== 'blocked';
  const exportReady =
    readiness.hasCircuit &&
    readiness.hasIoMapping &&
    readiness.hasVectors &&
    verifyTrusted &&
    health.lastExport?.status !== 'blocked';
  const hardwareReady = exportReady && !health.dirtySinceExport;
  const hardBlockingIssue = blockingIssues.find((issue) =>
    issue.code === 'RBP1000' ||
    issue.code === 'RBP1001' ||
    issue.code === 'RBP1003' ||
    issue.code === 'RBP1005' ||
    issue.code === 'RBP2001'
  ) ?? null;

  const heroStatusMessage = useMemo((): string => {
    if (!readiness.hasCircuit) return 'No circuit loaded — start with an example or import HDL.';
    if (unmappedRequiredCount > 0)
      return `Circuit loaded — ${unmappedRequiredCount} required pin${unmappedRequiredCount !== 1 ? 's are' : ' is'} unmapped.`;
    if (!readiness.hasIoMapping) return 'Circuit loaded — map pins before hardware trust is possible.';
    if (!readiness.hasVectors)
      return 'Mapping complete — Export is AVAILABLE for review, but not TRUSTED until Verify evidence is current.';
    if (verifyPassIncomplete)
      return 'Verify passed, but some outputs are still unmapped. Export is AVAILABLE, not TRUSTED.';
    if (!verifyTrusted) return 'Verify is not trusted yet. Export files are AVAILABLE for review only.';
    if (!exportReady) return 'Verify is trusted — open Export to build the hardware handoff bundle.';
    if (!hardwareReady) return 'Export trusted — build bitstream and flash hardware.';
    return 'All stages complete — bring up on hardware.';
  }, [
    readiness.hasCircuit,
    readiness.hasIoMapping,
    readiness.hasVectors,
    unmappedRequiredCount,
    verifyPassIncomplete,
    verifyTrusted,
    exportReady,
    hardwareReady,
  ]);

  const projectSummary = useMemo(() => {
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 0) return trimmedDescription;
    if (activeExample?.summary) return activeExample.summary;
    if (!readiness.hasCircuit) return 'Start from an example or import HDL to begin the project flow.';
    return `Top module ${topModuleName || 'top'} is loaded and ready for setup.`;
  }, [activeExample?.summary, description, readiness.hasCircuit, topModuleName]);

  const verifySummary = useMemo(
    () => getVerifySummary(health, verifyTrusted),
    [health, verifyTrusted]
  );
  const exportSummary = useMemo(
    () => getExportSummary(health, exportAvailable, exportReady, hardwareReady),
    [exportAvailable, exportReady, hardwareReady, health]
  );
  const showcaseInputSignals = useMemo(
    () => getShowcaseSignals(sortedMappingRows, 'in'),
    [sortedMappingRows]
  );
  const showcaseOutputSignals = useMemo(
    () => getShowcaseSignals(sortedMappingRows, 'out'),
    [sortedMappingRows]
  );
  const showcaseRows = useMemo(() => {
    const rowCount = Math.max(showcaseInputSignals.length, showcaseOutputSignals.length, 3);
    return Array.from({ length: rowCount }, (_, index) => ({
      input: showcaseInputSignals[index] ?? `IN${index}`,
      output: showcaseOutputSignals[index] ?? `OUT${index}`,
    }));
  }, [showcaseInputSignals, showcaseOutputSignals]);
  const heroStatusTone = hardBlockingIssue ? 'warn' : hardwareReady ? 'ok' : exportAvailable ? 'warn' : 'idle';
  const heroStatusLabel = hardBlockingIssue
    ? 'Action needed'
    : hardwareReady
      ? 'Hardware ready'
      : exportAvailable
        ? verifyTrusted
          ? 'Trusted export'
          : 'Available export'
        : 'In progress';
  const heroAssistAction = useMemo(() => {
    if (!readiness.hasCircuit) {
      return {
        label: 'Import HDL',
        onClick: onOpenImport,
      };
    }
    if (examples.length > 0) {
      return {
        label: 'Explore examples',
        onClick: () => examplesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      };
    }
    return {
      label: 'Open Design',
      onClick: onOpenDesign,
    };
  }, [examples.length, onOpenDesign, onOpenImport, readiness.hasCircuit]);
  const heroChecklistItems = useMemo(
    () => [
      {
        label: 'Pins mapped',
        value: readiness.hasIoMapping
          ? `${mappedRequiredCount}/${requiredCount || mappedRequiredCount} assigned`
          : `${unmappedRequiredCount} remaining`,
        tone: readiness.hasIoMapping ? 'ok' : 'warn',
      },
      {
        label: 'Verify',
        value: verifyTrusted
          ? 'Trusted pass'
          : verifyPassIncomplete
            ? 'PASS (INCOMPLETE)'
            : blockingIssue?.code === 'RBP1004'
              ? 'Run again after changes'
              : 'Still needed',
        tone: verifyTrusted ? 'ok' : 'warn',
      },
      {
        label: 'Export',
        value: hardwareReady
          ? 'Board handoff ready'
          : exportReady
            ? 'Trusted handoff ready'
            : exportAvailable
              ? 'Available (not trusted yet)'
              : 'Map pins first',
        tone: hardwareReady || exportReady ? 'ok' : exportAvailable ? 'warn' : 'idle',
      },
    ],
    [
      blockingIssue?.code,
      exportAvailable,
      exportReady,
      hardwareReady,
      mappedRequiredCount,
      readiness.hasIoMapping,
      requiredCount,
      unmappedRequiredCount,
      verifyPassIncomplete,
      verifyTrusted,
    ]
  );

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

  const readinessRows = useMemo(
    () =>
      [
        {
          id: 'circuit',
          label: 'Circuit loaded',
          ready: readiness.hasCircuit,
          actionLabel: readiness.hasCircuit ? 'Open Design' : 'Import HDL',
          onAction: readiness.hasCircuit ? onOpenDesign : onOpenImport,
        },
        {
          id: 'mapping',
          label: 'Mapping complete',
          ready: readiness.hasIoMapping,
          actionLabel: readiness.hasIoMapping ? 'Review mapping' : 'Map now',
          onAction: readiness.hasIoMapping ? onOpenDesign : onAutoSuggestMapping,
        },
        {
          id: 'verify',
          label: 'Verify passed',
          ready: verifyTrusted,
          actionLabel: verifyTrusted ? 'Review verify' : 'Run Verify',
          onAction: onOpenVerify,
        },
        {
          id: 'export',
          label: 'Export available',
          ready: exportAvailable,
          actionLabel: 'Open Export',
          onAction: onOpenExport,
        },
        {
          id: 'hardware',
          label: 'Hardware bring-up ready',
          ready: hardwareReady,
          actionLabel: hardwareReady ? 'Open Hardware' : 'Prep hardware',
          onAction: onOpenHardware,
        },
      ].map((item) => [
        item.label,
        <IdeStatusPill
          key={`${item.id}-status`}
          tone={item.id === 'export'
            ? exportReady
              ? 'ok'
              : 'warn'
            : item.id === 'verify'
              ? verifyTrusted
                ? 'ok'
                : 'warn'
              : item.ready
                ? 'ok'
                : 'warn'}
        >
          {item.id === 'export'
            ? exportReady
              ? 'TRUSTED'
              : item.ready
                ? 'AVAILABLE'
                : 'BLOCKED'
            : item.id === 'verify'
              ? verifyTrusted
                ? 'TRUSTED'
                : verifyPassIncomplete
                  ? 'PASS (INCOMPLETE)'
                  : 'NEEDS RUN'
              : item.ready
                ? 'READY'
                : 'BLOCKED'}
        </IdeStatusPill>,
        <IdeButton
          key={`${item.id}-action`}
          tone={item.id === 'export' || item.ready ? 'ghost' : 'secondary'}
          onClick={item.onAction}
          testId={`ide-project-readiness-action-${item.id}`}
        >
          {item.actionLabel}
        </IdeButton>,
      ]),
    [
      exportAvailable,
      exportReady,
      hardwareReady,
      onAutoSuggestMapping,
      onOpenDesign,
      onOpenExport,
      onOpenHardware,
      onOpenImport,
      onOpenVerify,
      readiness.hasCircuit,
      readiness.hasIoMapping,
      verifyPassIncomplete,
      verifyTrusted,
    ]
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
                  >●</span>
                );
              }
              if (ldM) {
                const bit = ioBus.state.ld[parseInt(ldM[1], 10)] ?? 0;
                return (
                  <span
                    data-testid={`ide-project-live-dot-${row.id}`}
                    style={{ fontSize: 10, color: bit ? 'var(--rb-signal)' : 'var(--ide-text-subtle, #4a5568)' }}
                    title={`Live: ${bit ? 'HIGH' : 'LOW'}`}
                  >●</span>
                );
              }
              return null;
            })()}
          </span>,
        ];
      }),
    [effectiveBoardSignal, highlightedMappingKey, ioBus, onGoToHardware, onUpdateMappingPin, sortedMappingRows]
  );

  const designCardDone = readiness.hasCircuit && readiness.hasIoMapping;
  const completedMilestoneCount = [
    designCardDone,
    verifyTrusted,
    exportReady,
    hardwareReady,
  ].filter(Boolean).length;
  const dockStageItems = useMemo(
    () => [
      {
        id: 'design',
        step: '1',
        label: 'Design',
        meta: designCardDone ? 'Mapped' : readiness.hasCircuit ? 'In progress' : 'Start here',
        state: designCardDone ? 'done' : primaryCta.mode === 'design' ? 'active' : 'idle',
        onClick: onOpenDesign,
        testId: 'ide-project-dock-nav-design',
      },
      {
        id: 'verify',
        step: '2',
        label: 'Verify',
        meta: verifyTrusted
          ? 'Trusted'
          : verifyPassIncomplete
            ? 'Pass incomplete'
            : primaryCta.mode === 'verify'
              ? 'Run now'
              : 'Waiting',
        state: verifyTrusted ? 'done' : primaryCta.mode === 'verify' ? 'active' : 'idle',
        onClick: onOpenVerify,
        testId: 'ide-project-dock-nav-verify',
      },
      {
        id: 'export',
        step: '3',
        label: 'Export',
        meta: exportReady ? 'Trusted' : exportAvailable ? 'Open now' : primaryCta.mode === 'export' ? 'Next up' : 'Map pins',
        state: exportReady ? 'done' : exportAvailable && primaryCta.mode === 'export' ? 'active' : 'idle',
        onClick: onOpenExport,
        testId: 'ide-project-dock-nav-export',
      },
      {
        id: 'hardware',
        step: '4',
        label: 'Hardware',
        meta: hardwareReady ? 'Board ready' : primaryCta.mode === 'hardware' ? 'Go live' : 'Later',
        state: hardwareReady ? 'done' : primaryCta.mode === 'hardware' ? 'active' : 'idle',
        onClick: onOpenHardware,
        testId: 'ide-project-dock-nav-hardware',
      },
    ],
    [
      designCardDone,
      exportAvailable,
      exportReady,
      hardwareReady,
      onOpenDesign,
      onOpenExport,
      onOpenHardware,
      onOpenVerify,
      primaryCta.mode,
      readiness.hasCircuit,
      verifyPassIncomplete,
      verifyTrusted,
    ]
  );
  return (
    <IdeSurfaceLayout
      mode="project"
      consoleHasBlocking={false}
      consoleHasEntries={false}
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


          {/* Session controls */}
          <section className="ide-surface-dock-section" data-testid="ide-session-controls">
            {lastSavedAt && (
              <p
                className="ide-copy"
                data-testid="ide-session-last-saved"
                style={{ color: 'var(--ide-text-subtle)' }}
              >
                {lastSavedAt}
              </p>
            )}
            <div className="ide-inline-actions">
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
            </div>
            <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-1)' }}>
              {onResetProject && (
                <IdeButton tone="danger" onClick={onResetProject} testId="ide-session-reset">
                  Reset project
                </IdeButton>
              )}
            </div>
          </section>
        </section>
      }
      console={
        <section className="ide-workbench-console-content" data-testid="ide-project-console">
          <header className="ide-workbench-console-header">
            <h3>Project Console</h3>
            <span className="ide-workbench-console-mode">Project</span>
          </header>
          {health.blockingIssues.length > 0 ? (
            <IdeCallout tone="warn" title="Blocking issues">
              {health.blockingIssues[0]?.message}
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="Ready">
              No blockers. Continue through Verify, Export, then Hardware.
            </IdeCallout>
          )}
        </section>
      }
    >
      {/* Workspace: Hero → Examples → Mapping */}
      <IdePanel
        testId="ide-project-panel"
      >
        <div className="ide-project-identity-strip" data-testid="ide-project-identity-strip">
          <span className="ide-project-identity-name">{projectName}</span>
          {studentName && (
            <span className="ide-project-identity-student">{studentName}</span>
          )}
          <IdeStatusPill tone={verifyPass ? 'ok' : 'idle'}>
            {verifyPass ? 'VERIFIED' : 'UNVERIFIED'}
          </IdeStatusPill>
        </div>
        {/* ── Sprint 10: 3-state layout — landing / loaded / submit ── */}
        {!readiness.hasCircuit ? (
          /* STATE A: No circuit — clean 3-option landing */
          <div className="ide-project-landing" data-testid="ide-project-landing">
            <div className="ide-project-landing-header">
              <h2 className="ide-project-landing-title">Start your lab</h2>
              <p className="ide-project-landing-sub">
                Pick a starting point to begin the full Design → Verify → Export flow.
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
                      Open existing project…
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
                    <span className="ide-project-landing-option-cta">Load &amp; Design →</span>
                  </button>
                );
              })}
              <button
                type="button"
                className="ide-project-landing-option ide-project-landing-option--fresh"
                onClick={onOpenDesign}
                data-testid="ide-project-landing-fresh"
              >
                <span className="ide-project-landing-option-eyebrow">Empty canvas</span>
                <span className="ide-project-landing-option-title">Build Fresh</span>
                <span className="ide-project-landing-option-sub">Start with gates and wires from scratch</span>
                <span className="ide-project-landing-option-cta">Open Design →</span>
              </button>
              <button
                type="button"
                className="ide-project-landing-option ide-project-landing-option--import"
                onClick={onOpenImport}
                data-testid="ide-project-landing-import"
              >
                <span className="ide-project-landing-option-eyebrow">Vivado / HDL</span>
                <span className="ide-project-landing-option-title">Import Project</span>
                <span className="ide-project-landing-option-sub">Bring in an existing VHDL or Vivado ZIP</span>
                <span className="ide-project-landing-option-cta">Open Import →</span>
              </button>
            </div>

            {/* ── Lab Starters Gallery ── */}
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
                    onClick={() => { onOpenExample(starter.id); onOpenDesign(); }}
                    data-testid={`ide-project-lab-card-${starter.id}`}
                  >
                    <span className="ide-project-lab-card-number">Lab {starter.labNumber}</span>
                    <span className="ide-project-lab-card-title">{starter.title.replace(/Lab \d+ — /, '')}</span>
                    <span className="ide-project-lab-card-desc">{starter.description}</span>
                    <div className="ide-project-lab-card-meta">
                      <span className={`ide-project-lab-card-badge ide-project-lab-card-badge--${starter.difficulty}`}>
                        {starter.difficulty}
                      </span>
                      <span className="ide-project-lab-card-time">{starter.estimatedMinutes} min</span>
                    </div>
                    <span className="ide-project-lab-card-cta">Start →</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        ) : (
          /* STATE B/C — circuit loaded */
          <>
            {/* Quick-stats strip */}
            {(inputCount > 0 || outputCount > 0 || savedAgoLabel) && (
              <div className="ide-project-quick-stats" data-testid="ide-project-quick-stats">
                {inputCount > 0 && (
                  <span>{inputCount} input{inputCount !== 1 ? 's' : ''}</span>
                )}
                {outputCount > 0 && (
                  <><span className="ide-qstat-sep" aria-hidden="true">·</span>
                  <span>{outputCount} output{outputCount !== 1 ? 's' : ''}</span></>
                )}
                {verifyPass && (
                  <><span className="ide-qstat-sep" aria-hidden="true">·</span>
                  <span className="ide-qstat-ok">✓ Verified</span></>
                )}
                {savedAgoLabel && (
                  <><span className="ide-qstat-sep" aria-hidden="true">·</span>
                  <span>Saved {savedAgoLabel}</span></>
                )}
              </div>
            )}
        {/* ── Hero Onboarding Panel ── */}
        <SurfacePanel className="ide-project-hero" testId="ide-project-hero">
          <div className="ide-project-showcase" data-testid="ide-project-showcase">
            <div className="ide-project-showcase-copy">
              <div className="ide-project-showcase-headline">
                <span className="ide-project-showcase-eyebrow">RedByte classroom flow</span>
                <h2 className="ide-project-showcase-title">
                  Build it, prove it, and light it up on the board.
                </h2>
                <p className="ide-project-showcase-body">{projectSummary}</p>
              </div>
              <div className="ide-project-showcase-status-row">
                <IdeStatusPill tone={heroStatusTone}>{heroStatusLabel.toUpperCase()}</IdeStatusPill>
                <span className="ide-project-showcase-status-copy" data-testid="ide-project-hero-status">
                  {heroStatusMessage}
                </span>
              </div>
              <div className="ide-project-showcase-chip-row">
                <span className="ide-project-context-tag">Basys3</span>
                <span className="ide-project-context-tag">{inputCount} in / {outputCount} out</span>
                <span className="ide-project-context-tag">{completedMilestoneCount}/4 milestones</span>
                {activeExample?.concept && (
                  <span className="ide-project-context-tag">{activeExample.concept}</span>
                )}
              </div>
              <div className="ide-project-showcase-actions">
                <span data-testid="ide-project-continue-cta">
                  <IdeButton
                    tone="primary"
                    onClick={onPrimaryCta}
                    testId="ide-project-showcase-primary-cta"
                  >
                    Continue to {primaryCtaLabel} →
                  </IdeButton>
                </span>
                <IdeButton
                  tone="secondary"
                  onClick={heroAssistAction.onClick}
                  testId="ide-project-showcase-secondary-cta"
                >
                  {heroAssistAction.label}
                </IdeButton>
              </div>
              <div className="ide-project-showcase-checklist">
                {heroChecklistItems.map((item) => (
                  <div
                    key={item.label}
                    className={`ide-project-showcase-checkpoint is-${item.tone}`}
                  >
                    <span className="ide-project-showcase-checkpoint-dot" aria-hidden="true" />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ide-project-showcase-visual">
              <div className="ide-project-board-preview" data-testid="ide-project-board-preview">
                <div className="ide-project-board-preview-header">
                  <span>Signal preview</span>
                  <span>{mappedRequiredCount}/{requiredCount || mappingRows.length || showcaseRows.length} mapped</span>
                </div>
                <div className="ide-project-board-traces">
                  {showcaseRows.map((row, index) => {
                    const rowMapped =
                      index < showcaseInputSignals.length &&
                      index < showcaseOutputSignals.length &&
                      readiness.hasIoMapping;
                    const rowVerified = rowMapped && verifyPass;
                    return (
                      <div
                        key={`${row.input}-${row.output}-${index}`}
                        className={`ide-project-board-trace-row${
                          rowVerified ? ' is-verified' : rowMapped ? ' is-mapped' : ''
                        }`}
                      >
                        <span className="ide-project-board-trace-node is-input">{row.input}</span>
                        <span className="ide-project-board-trace-line" aria-hidden="true" />
                        <span className="ide-project-board-trace-node is-output">{row.output}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="ide-project-board-preview-note">
                  {activeExample?.expectedBehavior || 'Map the pins, run Verify, then export to hardware.'}
                </p>
              </div>
            </div>
          </div>

          {/* Gate sentinel — text content only, not displayed */}
          <span style={{ display: 'none' }} data-testid="ide-project-continue-target">{primaryCtaLabel}</span>

          {topBlockingIssues.length > 0 && (
            <IdeCallout 
              tone="warn" 
              title={`${topBlockingIssues.length} blocker${topBlockingIssues.length > 1 ? 's' : ''}`} 
              testId="ide-project-hero-blocker"
            >
              <ol data-testid="ide-project-blockers-list" style={{ margin: '0 0 0 1.25rem', paddingLeft: 0 }}>
                {topBlockingIssues.map((issue, idx) => (
                  <li key={issue.code} data-testid={`ide-project-blocker-${idx}`}>
                    {issue.message}
                  </li>
                ))}
              </ol>
              {blockingIssues.length > 3 && (
                <p style={{ margin: '0.75rem 0 0 0', fontSize: 'var(--font-size-sm)', opacity: 0.8 }}>
                  …and {blockingIssues.length - 3} more
                </p>
              )}
            </IdeCallout>
          )}
        </SurfacePanel>

        {/* Project overview + examples */}
        <div className="ide-project-flightdeck" data-testid="ide-project-flightdeck">
          <SurfacePanel className="ide-project-spotlight" testId="ide-project-context">
            <div className="ide-project-spotlight-header">
              <span className="ide-project-spotlight-eyebrow">Project context</span>
              <IdeStatusPill tone={simRunning ? 'ok' : 'idle'}>
                {simRunning ? 'SIM RUNNING' : 'SIM IDLE'}
              </IdeStatusPill>
            </div>
            <div className="ide-project-spotlight-copy">
              <h3 className="ide-project-spotlight-title">
                {activeExample?.name ?? projectName}
              </h3>
              <p className="ide-project-spotlight-body">{projectSummary}</p>
            </div>
            <div className="ide-project-context-tags">
              <span className="ide-project-context-tag">Basys3</span>
              <span className="ide-project-context-tag">
                {inputCount} in / {outputCount} out
              </span>
              {activeExample?.concept && (
                <span className="ide-project-context-tag">{activeExample.concept}</span>
              )}
              {activeExample?.lab && (
                <span className="ide-project-context-tag">{activeExample.lab}</span>
              )}
            </div>
            <dl className="ide-project-glance-list">
              <div>
                <dt>Top module</dt>
                <dd>{topModuleName || 'top'}</dd>
              </div>
              <div>
                <dt>Expected behavior</dt>
                <dd>
                  {activeExample?.expectedBehavior || 'Use Verify to define the expected outputs.'}
                </dd>
              </div>
              <div>
                <dt>Last saved</dt>
                <dd>{lastSavedAt ? formatSavedAt(lastSavedAt) : 'No local snapshot yet'}</dd>
              </div>
            </dl>
          </SurfacePanel>

          <SurfacePanel className="ide-project-spotlight" testId="ide-project-readiness-summary">
            <div className="ide-project-spotlight-header">
              <span className="ide-project-spotlight-eyebrow">Readiness</span>
              <IdeStatusPill tone={hardwareReady ? 'ok' : hardBlockingIssue ? 'warn' : exportAvailable ? 'warn' : 'idle'}>
                {hardwareReady ? 'BOARD READY' : hardBlockingIssue ? 'ACTION NEEDED' : exportAvailable ? 'EXPORT AVAILABLE' : 'IN PROGRESS'}
              </IdeStatusPill>
            </div>
            <div className="ide-project-readiness-list">
              <div className="ide-project-readiness-item">
                <div className="ide-project-readiness-item-head">
                  <span>Mapping</span>
                  <IdeStatusPill tone={readiness.hasIoMapping ? 'ok' : 'warn'}>
                    {readiness.hasIoMapping ? 'READY' : 'BLOCKED'}
                  </IdeStatusPill>
                </div>
                <p>
                  {readiness.hasIoMapping
                    ? `${mappedRequiredCount}/${requiredCount} required pins assigned.`
                    : `${unmappedRequiredCount} required pin${unmappedRequiredCount !== 1 ? 's are' : ' is'} still missing.`}
                </p>
              </div>
              <div className="ide-project-readiness-item">
                <div className="ide-project-readiness-item-head">
                  <span>Verify</span>
                  <IdeStatusPill tone={verifyTrusted ? 'ok' : 'warn'}>
                    {verifyTrusted ? 'TRUSTED' : verifyPassIncomplete ? 'PASS (INCOMPLETE)' : 'NEEDS RUN'}
                  </IdeStatusPill>
                </div>
                <p>{verifySummary}</p>
              </div>
              <div className="ide-project-readiness-item">
                <div className="ide-project-readiness-item-head">
                  <span>Export</span>
                  <IdeStatusPill tone={exportReady ? 'ok' : exportAvailable ? 'warn' : 'warn'}>
                    {exportReady ? 'TRUSTED' : exportAvailable ? 'AVAILABLE' : 'BLOCKED'}
                  </IdeStatusPill>
                </div>
                <p>{exportSummary}</p>
                <p 
                  className="ide-project-export-explanation"
                  data-testid="ide-project-export-explanation"
                  style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.5rem', opacity: 0.85, fontStyle: 'italic' }}
                >
                  {exportReady
                    ? 'TRUSTED — Verify passed and matches current design. Safe for hardware handoff.'
                    : exportAvailable
                      ? 'AVAILABLE — Export files can be reviewed, but Verify has not confirmed correctness. Not a trusted handoff.'
                      : 'Export is blocked until circuit and mapping are complete.'}
                </p>
              </div>
            </div>
            {unmappedRequiredCount > 0 && (
              <div className="ide-project-spotlight-actions">
                <IdeButton
                  tone="secondary"
                  onClick={() => handleProjectModeAction('project')}
                  testId="ide-project-open-mapping-inline"
                >
                  Review missing pins
                </IdeButton>
                <IdeButton
                  tone="ghost"
                  onClick={onAutoSuggestMapping}
                  testId="ide-project-auto-map-inline"
                >
                  Auto-suggest pins
                </IdeButton>
              </div>
            )}
          </SurfacePanel>
        </div>

        {examples.length > 0 && (
          <details
            ref={examplesSectionRef}
            className="ide-project-examples-disclosure"
            open
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
                          Load &amp; Design →
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
          {/* Identity details — KV rows moved here; test IDs preserved */}
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
                  {(health.lastVerify?.status ?? 'none').toUpperCase()}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Verify hash</span>
                <code data-testid="ide-project-last-verify-hash">
                  {health.lastVerify?.hash?.slice(0, 12) ?? '—'}
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

          {/* FPGA Configuration — collapsed by default */}
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

          <IdeCallout tone="info" title="Lab-day proven export subset" testId="ide-project-supported-scope-callout">
            RedByte is frozen today for Basys3 + Vivado Project Mode using IO, gates, <code>FullAdder</code>,{' '}
            <code>MUX4</code>, and <code>DFlipFlop</code>. Hierarchy, bus-heavy builds, and behavioral HDL still need
            shipped starters or manual validation.
          </IdeCallout>

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
                {mappingExpanded ? '▲' : '▼'}
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

function getShowcaseSignals(
  rows: Array<Pick<ProjectMappingRow, 'label' | 'port' | 'direction'>>,
  direction: 'in' | 'out'
): string[] {
  const filtered = rows
    .filter((row) => row.direction === direction)
    .slice(0, 4)
    .map((row) => getStudentFacingIoLabel(row))
    .filter((value): value is string => value.trim().length > 0);

  if (filtered.length > 0) return filtered;

  return direction === 'in'
    ? ['SW0', 'SW1', 'SW2', 'SW3']
    : ['LD0', 'LD1', 'LD2', 'LD3'];
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

function getVerifySummary(health: ProjectHealth, verifyPass: boolean): string {
  if (!health.lastVerify) return 'No verify run has been recorded yet.';
  if (verifyPass) return 'Latest verify run passed and still matches the current design.';
  if (health.lastVerify.status === 'fail') return 'Latest verify run failed. Review mismatches and rerun.';
  if (health.dirtySinceVerify) return 'Verify previously passed, but the design changed afterward.';
  return 'Verify still needs attention before export.';
}

function getExportSummary(
  health: ProjectHealth,
  exportAvailable: boolean,
  exportReady: boolean,
  hardwareReady: boolean
): string {
  if (!health.lastExport) {
    if (!exportAvailable) return 'Export stays blocked until mapping is complete.';
    return exportReady
      ? 'Ready for the first export build.'
      : 'Export can be opened now for file review. Verify is still recommended before trusting the handoff.';
  }
  if (health.lastExport.status === 'blocked') {
    return 'Latest export attempt was blocked. Open Export diagnostics before hardware.';
  }
  if (hardwareReady) return 'Latest export bundle is current and ready for hardware.';
  if (health.dirtySinceExport) {
    return exportReady
      ? 'A previous export exists, but the project changed since then.'
      : 'A previous export exists, and Export can still be reopened while Verify catches up.';
  }
  return exportReady
    ? 'Export can be opened for artifact review or rebuild.'
    : 'Export is available for artifact review, but Verify is still advisory.';
}

function toMappingKey(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
