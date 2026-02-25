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

  return (
    <IdeSurfaceLayout
      mode="project"
      consoleHasBlocking={false}
      consoleHasEntries={false}
      inspector={null}
      hideRightDock
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-project-start-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Start Here</h3>
            <IdeStatusPill tone={activeExampleId ? 'ok' : 'idle'}>
              {activeExampleId ? 'EXAMPLE' : 'CUSTOM'}
            </IdeStatusPill>
          </header>

          {/* Readiness checklist — hero of left dock */}
          <IdeDataTable
            columns={['Check', 'State', 'Action']}
            rows={readinessRows}
            testId="ide-project-readiness-checklist"
          />

          {/* Examples compact list — full cards are in the main workspace */}
          {examples.length > 0 && (
            <div style={{ marginTop: 'var(--ide-space-2)' }}>
              <p style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)', margin: '0 0 var(--ide-space-1) 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Examples
              </p>
              <div className="ide-signal-list" data-testid="ide-project-example-groups">
                {examples.map((example) => (
                  <button
                    key={example.id}
                    type="button"
                    className={`ide-signal-row ${activeExampleId === example.id ? 'is-active' : ''}`}
                    onClick={() => onOpenExample(example.id)}
                    data-testid={`ide-project-open-example-${example.id}`}
                  >
                    <span>{example.name}</span>
                    <span
                      className="ide-project-example-meta"
                      data-testid={`ide-project-example-meta-${example.id}`}
                    >
                      {example.concept}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ide-inline-actions">
            {unmappedRequiredCount > 0 ? (
              <IdeButton
                tone="primary"
                onClick={onAutoSuggestMapping}
                testId="ide-project-cta-automap"
              >
                Auto-suggest Basys3
              </IdeButton>
            ) : (
              <IdeButton
                tone="primary"
                onClick={onOpenVerify}
                testId="ide-project-cta-continue"
              >
                Continue to Verify →
              </IdeButton>
            )}
            <IdeButton tone="secondary" onClick={onOpenImport}>
              Import HDL/XDC
            </IdeButton>
          </div>

          {/* Student identity + submission export */}
          {(onExportSubmission || onStudentNameChange) && (
            <section
              style={{ marginTop: 'var(--ide-space-3)', borderTop: '1px solid var(--ide-border, rgba(255,255,255,0.08))', paddingTop: 'var(--ide-space-2)' }}
              data-testid="ide-submission-section"
            >
              <p style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)', margin: '0 0 var(--ide-space-1) 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Submission
              </p>
              {onStudentNameChange && (
                <div style={{ marginBottom: 'var(--ide-space-2)' }}>
                  <label
                    htmlFor="ide-student-name-input"
                    style={{ display: 'block', fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)', marginBottom: 4 }}
                  >
                    Student name (optional)
                  </label>
                  <input
                    id="ide-student-name-input"
                    type="text"
                    className="ide-export-pin-input"
                    value={studentName}
                    onChange={(e) => onStudentNameChange(e.target.value)}
                    placeholder="Your name"
                    data-testid="ide-student-name-input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {onExportSubmission && (
                <div>
                  {!hasVerifyRun && (
                    <IdeCallout tone="info" title="No verify run yet" testId="ide-submission-no-verify-hint">
                      Run verification first for full evidence — export still works but grade will show lastStatus: none
                    </IdeCallout>
                  )}
                  <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-1)' }}>
                    <IdeButton
                      tone="secondary"
                      onClick={onExportSubmission}
                      testId="ide-export-submission-btn"
                    >
                      {submissionExportPending ? 'Exporting…' : 'Export Submission ZIP'}
                    </IdeButton>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Session controls */}
          <section
            style={{ marginTop: 'var(--ide-space-3)', borderTop: '1px solid var(--ide-border, rgba(255,255,255,0.08))', paddingTop: 'var(--ide-space-2)' }}
            data-testid="ide-session-controls"
          >
            {lastSavedAt && (
              <p
                className="ide-copy"
                data-testid="ide-session-last-saved"
                style={{ marginBottom: 'var(--ide-space-2)', color: 'var(--ide-text-subtle)' }}
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
        description="Map circuit ports to Basys3 pins to enable export."
        testId="ide-project-panel"
      >
        {/* ── Hero Onboarding Panel ── */}
        <section className="ide-project-hero" data-testid="ide-project-hero">
          <p className="ide-project-hero-status" data-testid="ide-project-hero-status">
            {heroStatusMessage}
          </p>

          <div className="ide-project-launchpad" data-testid="ide-project-launchpad">
            {/* Card 1: Design */}
            <div
              className={`ide-launchpad-card ${designCardDone ? 'ide-launchpad-card--done' : 'ide-launchpad-card--active'}`}
              data-testid="ide-launchpad-design"
            >
              <span className="ide-launchpad-card__label" aria-hidden="true">{designCardDone ? '✓' : '1'}</span>
              <span className="ide-launchpad-card__title">Design</span>
              <span className="ide-launchpad-card__sub">Build your circuit</span>
              <span className="ide-launchpad-card__badge">{designPinStatus}</span>
              <IdeButton
                tone={designCardDone ? 'ghost' : 'primary'}
                onClick={onOpenDesign}
                testId="ide-launchpad-design-cta"
              >
                {designCardDone ? 'Revisit' : designInProgress ? 'Continue Design →' : 'Start Design →'}
              </IdeButton>
            </div>

            {/* Card 2: Verify */}
            <div
              className={`ide-launchpad-card ${verifyCardDone ? 'ide-launchpad-card--done' : verifyCardLocked ? 'ide-launchpad-card--locked' : 'ide-launchpad-card--active'}`}
              data-testid="ide-launchpad-verify"
            >
              <span className="ide-launchpad-card__label" aria-hidden="true">{verifyCardDone ? '✓' : '2'}</span>
              <span className="ide-launchpad-card__title">Verify</span>
              <span className="ide-launchpad-card__sub">Run test vectors</span>
              {!verifyCardLocked && (
                <IdeButton
                  tone={verifyCardDone ? 'ghost' : 'primary'}
                  onClick={onOpenVerify}
                  testId="ide-launchpad-verify-cta"
                >
                  {verifyCardDone ? 'Revisit' : 'Start Verify →'}
                </IdeButton>
              )}
            </div>

            {/* Card 3: Hardware */}
            <div
              className={`ide-launchpad-card ${hardwareCardDone ? 'ide-launchpad-card--done' : hardwareCardLocked ? 'ide-launchpad-card--locked' : 'ide-launchpad-card--active'}`}
              data-testid="ide-launchpad-hardware"
            >
              <span className="ide-launchpad-card__label" aria-hidden="true">{hardwareCardDone ? '✓' : '3'}</span>
              <span className="ide-launchpad-card__title">Hardware</span>
              <span className="ide-launchpad-card__sub">Flash the board</span>
              {!hardwareCardLocked && (
                <IdeButton
                  tone={hardwareCardDone ? 'ghost' : 'primary'}
                  onClick={onOpenHardware}
                  testId="ide-launchpad-hardware-cta"
                >
                  {hardwareCardDone ? 'Revisit' : 'Start Hardware →'}
                </IdeButton>
              )}
            </div>
          </div>

          {health.blockingIssues.length > 0 && health.blockingIssues[0] && (
            <IdeCallout tone="warn" title="Next blocker" testId="ide-project-hero-blocker">
              {health.blockingIssues[0].message}
            </IdeCallout>
          )}
        </section>

        {/* ── Quick-start example cards ── */}
        {examples.length > 0 && (
          <div className="ide-project-quickstart" data-testid="ide-project-quickstart">
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
                >
                  <span className="ide-project-example-btn-name">{ex.name}</span>
                  <span className="ide-project-example-btn-concept">{ex.concept}</span>
                  {ex.expectedBehavior && (
                    <>
                      <span className="ide-project-example-btn-learn-label">You'll learn</span>
                      <span className="ide-project-example-btn-summary">{ex.expectedBehavior}</span>
                    </>
                  )}
                  <div className="ide-project-example-btn-actions">
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
          </div>
        )}

        {/* ── Mapping section — collapsed by default ── */}
        <section className="ide-export-section" data-testid="ide-project-panel-mapping">
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
