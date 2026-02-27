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
import type { ProjectHealth, ProjectPrimaryCta } from '../projectHealth';
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
  diagnosticRouteRequest?: IdeDiagnosticRouteRequest | null;
  runtimeSim?: RuntimeSimState;
  onGoToHardware?: () => void;
  onSaveNow?: () => void;
  onRestoreLastSave?: () => void;
  onResetProject?: () => void;
  // PR15: student identity + submission export
  studentName?: string;
  onStudentNameChange?: (name: string) => void;
  hasVerifyRun?: boolean;
  onExportSubmission?: () => void;
  submissionExportPending?: boolean;
  submissionPreview?: {
    lastStatus: 'pass' | 'fail' | 'none';
    passes: number;
    fails: number;
    overallGateVerdict: 'pass' | 'warn' | 'block' | 'ungraded';
    assignmentId: string | null;
    labCode: string | null;
  } | null;
}

const PROJECT_EMPTY_SIM: RuntimeSimState = {
  tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
  inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
};

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
  primaryCtaLabel: _primaryCtaLabel,
  primaryCta: _primaryCta,
  onPrimaryCta: _onPrimaryCta,
  onUpdateMappingPin,
  onAutoSuggestMapping,
  onOpenDesign,
  onOpenVerify,
  onOpenExport,
  onOpenHardware,
  onOpenImport,
  diagnosticRouteRequest,
  runtimeSim,
  onGoToHardware,
  onSaveNow,
  onRestoreLastSave,
  onResetProject,
  studentName = '',
  onStudentNameChange,
  hasVerifyRun = false,
  onExportSubmission,
  submissionExportPending = false,
  submissionPreview = null,
}) => {
  const [highlightedMappingKey, setHighlightedMappingKey] = useState<string | null>(null);
  const [mappingExpanded, setMappingExpanded] = useState(false);
  const mappingInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const highlightResetTimer = useRef<number | null>(null);
  const { activeBoardSignal } = useBoardSignal();

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

  const verifyPass = health.lastVerify?.status === 'pass' && !health.dirtySinceVerify;
  const exportReady =
    readiness.hasCircuit &&
    readiness.hasIoMapping &&
    readiness.hasVectors &&
    verifyPass &&
    health.lastExport?.status !== 'blocked';
  const hardwareReady = exportReady && !health.dirtySinceExport;

  const heroStatusMessage = useMemo((): string => {
    if (!readiness.hasCircuit) return 'No circuit loaded — start with an example or import HDL';
    if (unmappedRequiredCount > 0)
      return `Circuit loaded — ${unmappedRequiredCount} pin${unmappedRequiredCount !== 1 ? 's' : ''} unmapped`;
    if (!readiness.hasIoMapping) return 'Circuit loaded — map pins or open Design';
    if (!readiness.hasVectors) return 'Mapping complete — add test vectors in Verify';
    if (!verifyPass) return 'Vectors defined — run Verify to confirm correctness';
    if (!exportReady) return 'Verify passed — ready to export bitstream';
    if (!hardwareReady) return 'Export ready — build bitstream and flash hardware';
    return 'All stages complete — bring up on hardware';
  }, [
    readiness.hasCircuit,
    readiness.hasIoMapping,
    readiness.hasVectors,
    unmappedRequiredCount,
    verifyPass,
    exportReady,
    hardwareReady,
  ]);

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
          ready: verifyPass,
          actionLabel: verifyPass ? 'Review verify' : 'Run Verify',
          onAction: onOpenVerify,
        },
        {
          id: 'export',
          label: 'Export ready',
          ready: exportReady,
          actionLabel: exportReady ? 'Open Export' : 'Fix export',
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
        <IdeStatusPill key={`${item.id}-status`} tone={item.ready ? 'ok' : 'warn'}>
          {item.ready ? 'READY' : 'BLOCKED'}
        </IdeStatusPill>,
        <IdeButton
          key={`${item.id}-action`}
          tone={item.ready ? 'ghost' : 'secondary'}
          onClick={item.onAction}
          testId={`ide-project-readiness-action-${item.id}`}
        >
          {item.actionLabel}
        </IdeButton>,
      ]),
    [
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
      verifyPass,
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
        const swM2 = /^SW(\d+)$/i.exec(row.label);
        const ldM2 = /^LD(\d+)$/i.exec(row.label);
        const rowSigType = swM2 ? 'sw' : ldM2 ? 'ld' : null;
        const rowSigIdx = swM2 ? parseInt(swM2[1], 10) : ldM2 ? parseInt(ldM2[1], 10) : -1;
        const isActiveRow =
          !!activeBoardSignal &&
          !!rowSigType &&
          activeBoardSignal.type === rowSigType &&
          activeBoardSignal.index === rowSigIdx;
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
              {row.port || row.label || row.id}
            </code>
          </span>
        );
        return [
          portCell,
          <span key={`${row.id}-alias`} data-testid={`ide-project-alias-${mappingKey}`}>
            {mappingView.aliasDisplay}
          </span>,
          <input
            key={`${row.id}-pin`}
            ref={(node) => {
              mappingInputRefs.current[mappingKey] = node;
            }}
            className={`ide-export-pin-input ${
              highlightedMappingKey === mappingKey ? 'is-highlighted' : ''
            }`}
            value={row.pin}
            onChange={(event) => onUpdateMappingPin(row.id, event.target.value.toUpperCase().trim())}
            placeholder={suggestBasys3Pin(row, index)}
            aria-label={`pin-${row.id}`}
            data-testid={`ide-project-map-input-${mappingKey}`}
          />,
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
    [activeBoardSignal, highlightedMappingKey, ioBus, onGoToHardware, onUpdateMappingPin, sortedMappingRows]
  );

  const designCardDone = readiness.hasCircuit && readiness.hasIoMapping;
  const designInProgress = readiness.hasCircuit && !designCardDone;
  const verifyCardDone = readiness.verifyPass;
  const verifyCardLocked = !designCardDone;
  const hardwareCardDone = hardwareReady;
  const hardwareCardLocked = !verifyCardDone;
  const designPinStatus = readiness.hasIoMapping
    ? `${mappedRequiredCount}/${requiredCount} pins mapped`
    : unmappedRequiredCount > 0
      ? `${unmappedRequiredCount} pin${unmappedRequiredCount !== 1 ? 's' : ''} unmapped`
      : readiness.hasCircuit
        ? 'No pins required'
        : 'No circuit loaded';
  const submissionPreviewRows = useMemo(() => {
    if (!submissionPreview) return [];
    return [
      [
        'Last verify status',
        submissionRunStatusPill(submissionPreview.lastStatus),
      ],
      ['Verify passes', String(submissionPreview.passes)],
      ['Verify fails', String(submissionPreview.fails)],
      [
        'Gate verdict',
        submissionVerdictPill(submissionPreview.overallGateVerdict),
      ],
      ['Assignment ID', submissionPreview.assignmentId ?? '—'],
      ['Lab code', submissionPreview.labCode ?? '—'],
    ];
  }, [submissionPreview]);

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
            <IdeButton tone="ghost" onClick={onOpenDesign} testId="ide-project-dock-nav-design">Design</IdeButton>
            <IdeButton tone="ghost" onClick={onOpenVerify} testId="ide-project-dock-nav-verify">Verify</IdeButton>
            <IdeButton tone="ghost" onClick={onOpenExport} testId="ide-project-dock-nav-export">Export</IdeButton>
            <IdeButton tone="ghost" onClick={onOpenHardware} testId="ide-project-dock-nav-hardware">Hardware</IdeButton>
          </div>

          {/* Student identity + submission export */}
          {(onExportSubmission || onStudentNameChange) && (
            <section className="ide-surface-dock-section" data-testid="ide-submission-section">
              <p className="ide-surface-block-label">
                Submission
              </p>
              {onStudentNameChange && (
                <div className="ide-surface-field-stack">
                  <label htmlFor="ide-student-name-input" className="ide-surface-field-label">
                    Your name
                  </label>
                  <input
                    id="ide-student-name-input"
                    type="text"
                    className="ide-export-pin-input"
                    value={studentName}
                    onChange={(e) => onStudentNameChange(e.target.value)}
                    placeholder="First Last"
                    data-testid="ide-student-name-input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {onStudentNameChange && studentName.trim().length === 0 && (
                <IdeCallout tone="warn" title="Name required" testId="ide-submission-student-name-warning">
                  Your submission will only have a device ID without a name. Add your name before exporting.
                </IdeCallout>
              )}
              {onExportSubmission && (
                <div>
                  {!hasVerifyRun && (
                    <IdeCallout tone="info" title="Run Verify first" testId="ide-submission-no-verify-hint">
                      Verify your circuit before exporting for a complete submission.
                    </IdeCallout>
                  )}
                  {submissionPreviewRows.length > 0 && (
                    <div className="ide-surface-block-stack" data-testid="ide-submission-preview">
                      <IdeDataTable
                        columns={['Submission field', 'Current value']}
                        rows={submissionPreviewRows}
                        testId="ide-submission-preview-table"
                      />
                    </div>
                  )}
                  <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-1)' }}>
                    <IdeButton
                      tone="primary"
                      onClick={onExportSubmission}
                      testId="ide-export-submission-btn"
                    >
                      {submissionExportPending ? 'Exporting…' : 'Export Submission'}
                    </IdeButton>
                  </div>
                </div>
              )}
            </section>
          )}

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
        {/* ── Hero Onboarding Panel ── */}
        <SurfacePanel className="ide-project-hero" testId="ide-project-hero">
          <p className="ide-project-hero-status" data-testid="ide-project-hero-status">
            {heroStatusMessage}
          </p>

          <div data-testid="ide-project-panel-readiness">
          <div className="ide-project-launchpad" data-testid="ide-project-launchpad">
            {/* Card 1: Design */}
            <div
              className={`ide-launchpad-card ${designCardDone ? 'ide-launchpad-card--done' : 'ide-launchpad-card--active'}`}
              data-testid="ide-launchpad-design"
            >
              <span className="ide-launchpad-card__label" aria-hidden="true">{designCardDone ? <code>DONE</code> : <code>STEP 1</code>}</span>
              <span className="ide-launchpad-card__title">Design</span>
              <span className="ide-launchpad-card__sub">Build your circuit</span>
              <span className="ide-launchpad-card__badge">{designPinStatus}</span>
              <div data-testid="ide-project-cta-design">
                <IdeButton
                  tone={designCardDone ? 'ghost' : 'primary'}
                  onClick={onOpenDesign}
                  testId="ide-launchpad-design-cta"
                >
                  {designCardDone ? 'Revisit' : designInProgress ? 'Continue Design →' : 'Start Design →'}
                </IdeButton>
              </div>
            </div>

            {/* Card 2: Verify */}
            <div
              className={`ide-launchpad-card ${verifyCardDone ? 'ide-launchpad-card--done' : verifyCardLocked ? 'ide-launchpad-card--locked' : 'ide-launchpad-card--active'}`}
              data-testid="ide-launchpad-verify"
            >
              <span className="ide-launchpad-card__label" aria-hidden="true">{verifyCardDone ? <code>DONE</code> : <code>STEP 2</code>}</span>
              <span className="ide-launchpad-card__title">Verify</span>
              <span className="ide-launchpad-card__sub">Run test vectors</span>
              {!verifyCardLocked && verifyCardDone && (
                <IdeButton
                  tone="ghost"
                  onClick={onOpenVerify}
                  testId="ide-launchpad-verify-cta"
                >
                  Revisit
                </IdeButton>
              )}
              {!verifyCardLocked && !verifyCardDone && (
                <span data-testid="ide-project-continue-cta">
                  <IdeButton
                    tone="primary"
                    onClick={onOpenVerify}
                    testId="ide-launchpad-verify-cta"
                  >
                    Continue to Verify →
                  </IdeButton>
                </span>
              )}
            </div>

            {/* Card 3: Hardware */}
            <div
              className={`ide-launchpad-card ${hardwareCardDone ? 'ide-launchpad-card--done' : hardwareCardLocked ? 'ide-launchpad-card--locked' : 'ide-launchpad-card--active'}`}
              data-testid="ide-launchpad-hardware"
            >
              <span className="ide-launchpad-card__label" aria-hidden="true">{hardwareCardDone ? <code>DONE</code> : <code>STEP 3</code>}</span>
              <span className="ide-launchpad-card__title">Hardware</span>
              <span className="ide-launchpad-card__sub">Flash the board</span>
              {!hardwareCardLocked && (
                <div data-testid="ide-project-cta-hardware">
                  <IdeButton
                    tone={hardwareCardDone ? 'ghost' : 'primary'}
                    onClick={onOpenHardware}
                    testId="ide-launchpad-hardware-cta"
                  >
                    {hardwareCardDone ? 'Revisit' : 'Start Hardware →'}
                  </IdeButton>
                </div>
              )}
            </div>
          </div>
          </div>{/* end ide-project-panel-readiness */}

          {/* Fallback continue CTA: shown when verify card is locked or already done */}
          {(verifyCardLocked || verifyCardDone) && (
            <span data-testid="ide-project-continue-cta">
              <IdeButton
                tone="secondary"
                onClick={onOpenVerify}
                testId="ide-project-cta-continue"
              >
                Continue to Verify →
              </IdeButton>
            </span>
          )}
          {/* Gate sentinel — text content only, not displayed */}
          <span style={{ display: 'none' }} data-testid="ide-project-continue-target">Verify</span>

          {health.blockingIssues.length > 0 && health.blockingIssues[0] && (
            <IdeCallout tone="warn" title="Next blocker" testId="ide-project-hero-blocker">
              {health.blockingIssues[0].message}
            </IdeCallout>
          )}
        </SurfacePanel>

        {/* ── Quick-start example cards ── */}
        {examples.length > 0 && (
          <details
            className="ide-project-examples-disclosure"
            open={!readiness.hasCircuit}
            data-testid="ide-project-examples-disclosure"
          >
            <summary className="ide-project-examples-disclosure-summary">
              {readiness.hasCircuit ? 'Explore examples' : 'Start with an example'}
            </summary>
            <SurfacePanel className="ide-project-quickstart" testId="ide-project-quickstart">
              <p className="ide-project-quickstart-title">
                {readiness.hasCircuit ? 'Explore Examples' : 'Launch an Example'}
              </p>
              <p className="ide-project-quickstart-sub">
                {readiness.hasCircuit
                  ? 'Load a showcase kit to explore circuit concepts end-to-end.'
                  : 'Load a pre-built example to see the full workflow from Design → Verify → Export.'}
              </p>
              <div className="ide-project-example-card-row">
                {examples.slice(0, 3).map((ex) => (
                  <div
                    key={ex.id}
                    className={`ide-project-example-btn ${activeExampleId === ex.id ? 'is-active' : ''}`}
                    data-testid={`ide-project-example-${ex.id}`}
                    data-example-id={ex.id}
                  >
                    <span data-testid="ide-project-example-card" data-example-id={ex.id} />
                    <span className="ide-project-example-btn-name">{ex.name}</span>
                    <span className="ide-project-example-btn-concept">{ex.concept}</span>
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
                ))}
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

        {/* ── Mapping section — collapsed by default ── */}
        <section className="ide-export-section" data-testid="ide-project-panel-mapping">
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
            </div>
          )}
        </section>
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

function formatSavedAt(value: string): string {
  if (!value) return 'not saved';
  return value.replace('T', ' ').replace('.000Z', 'Z');
}

function toMappingKey(value: string): string {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function submissionRunStatusPill(status: 'pass' | 'fail' | 'none'): React.ReactNode {
  const tone = status === 'pass' ? 'ok' : status === 'fail' ? 'error' : 'idle';
  return <IdeStatusPill tone={tone}>{status.toUpperCase()}</IdeStatusPill>;
}

function submissionVerdictPill(
  verdict: 'pass' | 'warn' | 'block' | 'ungraded'
): React.ReactNode {
  const tone = verdict === 'pass'
    ? 'ok'
    : verdict === 'warn'
      ? 'warn'
      : verdict === 'block'
        ? 'error'
        : 'idle';
  return <IdeStatusPill tone={tone}>{verdict.toUpperCase()}</IdeStatusPill>;
}
