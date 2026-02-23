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
import type { ProjectHealth, ProjectHealthMode, ProjectPrimaryCta } from '../projectHealth';
import type { IdeDiagnosticRouteRequest } from '../diagnostics';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeInspectorSection,
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
}

const PROJECT_EMPTY_SIM: RuntimeSimState = {
  tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
  inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
};

const HERO_STEPS: Array<{ key: string; label: string; mode: ProjectHealthMode }> = [
  { key: 'import',   label: 'Import',   mode: 'import'   },
  { key: 'design',   label: 'Design',   mode: 'design'   },
  { key: 'verify',   label: 'Verify',   mode: 'verify'   },
  { key: 'export',   label: 'Export',   mode: 'export'   },
  { key: 'hardware', label: 'Hardware', mode: 'hardware' },
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
  diagnosticRouteRequest,
  runtimeSim,
  onGoToHardware,
  onSaveNow,
  onRestoreLastSave,
  onResetProject,
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

  const handleNavigateToMode = useCallback(
    (mode: ProjectHealthMode) => {
      switch (mode) {
        case 'design':
          onOpenDesign();
          break;
        case 'verify':
          onOpenVerify();
          break;
        case 'export':
          onOpenExport();
          break;
        case 'hardware':
          onOpenHardware();
          break;
        case 'import':
          onOpenImport();
          break;
        case 'project':
        default:
          break;
      }
    },
    [onOpenDesign, onOpenVerify, onOpenExport, onOpenHardware, onOpenImport]
  );

  const verifyPass = health.lastVerify?.status === 'pass' && !health.dirtySinceVerify;
  const exportReady =
    readiness.hasCircuit &&
    readiness.hasIoMapping &&
    readiness.hasVectors &&
    verifyPass &&
    health.lastExport?.status !== 'blocked';
  const hardwareReady = exportReady && !health.dirtySinceExport;

  const heroStepIndex = useMemo(() => {
    if (!readiness.hasCircuit) return 0;
    if (!readiness.hasIoMapping) return 1;
    if (!readiness.hasVectors || !verifyPass) return 2;
    if (!exportReady) return 3;
    return 4;
  }, [readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors, verifyPass, exportReady]);

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
          id: 'mapping',
          label: 'Mapping complete',
          ready: readiness.hasIoMapping,
          actionLabel: readiness.hasIoMapping ? 'Review mapping' : 'Map now',
          onAction: readiness.hasIoMapping ? onOpenDesign : onAutoSuggestMapping,
        },
        {
          id: 'sim',
          label: 'Sim running',
          ready: simRunning,
          actionLabel: simRunning ? 'View Design' : 'Run sim',
          onAction: onOpenDesign,
        },
        {
          id: 'verify',
          label: 'Verify has PASS',
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
      onOpenVerify,
      readiness.hasIoMapping,
      simRunning,
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

  const lastVerifyStatusTone =
    health.lastVerify?.status === 'pass'
      ? 'ok'
      : health.lastVerify?.status === 'fail'
        ? 'error'
        : 'idle';
  const lastExportStatusTone =
    health.lastExport?.status === 'ok'
      ? 'ok'
      : health.lastExport?.status === 'blocked'
        ? 'error'
        : 'idle';

  return (
    <IdeSurfaceLayout
      mode="project"
      consoleHasBlocking={false}
      consoleHasEntries={false}
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-project-start-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Start Here</h3>
            <IdeStatusPill tone={activeExampleId ? 'ok' : 'idle'}>
              {activeExampleId ? 'EXAMPLE' : 'CUSTOM'}
            </IdeStatusPill>
          </header>

          {/* Readiness checklist — hero of left dock */}
          {health.blockingIssues.length > 0 && health.blockingIssues[0] && (
            <IdeCallout tone="warn" title="Next blocker" testId="ide-project-primary-blocker">
              {health.blockingIssues[0].message}
            </IdeCallout>
          )}
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
      inspector={
        <>
          <IdeInspectorSection title="Mapping Guide" defaultOpen={false}>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Unmapped required</span>
                <span data-testid="ide-project-unmapped-count">{unmappedRequiredCount}</span>
              </div>
              <div className="ide-kv-row">
                <span>Mapped required</span>
                <span>
                  {mappedRequiredCount}/{requiredCount}
                </span>
              </div>
            </div>
            <div className="ide-inline-actions">
              <IdeButton tone="secondary" onClick={onAutoSuggestMapping}>
                Auto-suggest Basys3
              </IdeButton>
              {onGoToHardware && (
                <IdeButton tone="secondary" onClick={onGoToHardware} testId="ide-project-go-hardware">
                  View on Board
                </IdeButton>
              )}
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Project" defaultOpen={false}>
            <div className="ide-kv-list" data-testid="ide-project-panel-identity">
              <div className="ide-kv-row">
                <span>Name</span>
                <span>{projectName}</span>
              </div>
              <div className="ide-kv-row">
                <span>Description</span>
                <span>{description || 'No description'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Board</span>
                <span data-testid="ide-project-board">Basys3</span>
              </div>
              <div className="ide-kv-row">
                <span>Top module</span>
                <code data-testid="ide-project-top-module">{topModuleName}</code>
              </div>
              <div className="ide-kv-row">
                <span>Hash</span>
                <code data-testid="ide-project-hash-short">{determinismHash.slice(0, 12)}</code>
              </div>
              <div className="ide-kv-row">
                <span>Saved</span>
                <span>{formatSavedAt(lastSavedAt)}</span>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Activity" defaultOpen={false}>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Last Verify</span>
                <IdeStatusPill tone={lastVerifyStatusTone} testId="ide-project-last-verify-status">
                  {health.lastVerify?.status?.toUpperCase() ?? 'NEVER'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Verify Hash</span>
                <span className="ide-status-mono" data-testid="ide-project-last-verify-hash">
                  {health.lastVerify?.hash?.slice(0, 16) ?? '—'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Last Export</span>
                <IdeStatusPill tone={lastExportStatusTone} testId="ide-project-last-export-status">
                  {health.lastExport?.status?.toUpperCase() ?? 'NEVER'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Export Hash</span>
                <span className="ide-status-mono" data-testid="ide-project-last-export-hash">
                  {health.lastExport?.hash?.slice(0, 16) ?? '—'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Dirty since verify</span>
                <IdeStatusPill
                  tone={health.dirtySinceVerify ? 'warn' : 'ok'}
                  testId="ide-project-dirty-since-verify"
                >
                  {health.dirtySinceVerify ? 'DIRTY' : 'CLEAN'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Dirty since export</span>
                <IdeStatusPill
                  tone={health.dirtySinceExport ? 'warn' : 'ok'}
                  testId="ide-project-dirty-since-export"
                >
                  {health.dirtySinceExport ? 'DIRTY' : 'CLEAN'}
                </IdeStatusPill>
              </div>
            </div>
          </IdeInspectorSection>
        </>
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

          <nav className="ide-project-hero-stepper" aria-label="Workflow steps" data-testid="ide-project-hero-stepper">
            {HERO_STEPS.map((step, index) => {
              const isActive = index === heroStepIndex;
              const isPast   = index < heroStepIndex;
              const stateClass = isActive ? 'is-active' : isPast ? 'is-past' : 'is-future';
              return (
                <React.Fragment key={step.key}>
                  {index > 0 && (
                    <span
                      className={`ide-project-hero-step-trace ${isPast || isActive ? 'is-lit' : ''}`}
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    className={`ide-project-hero-step ${stateClass}`}
                    onClick={() => handleNavigateToMode(step.mode)}
                    aria-current={isActive ? 'step' : undefined}
                    data-testid={`ide-project-hero-step-${step.key}`}
                  >
                    <span className="ide-project-hero-step-badge" aria-hidden="true">
                      {isPast ? '✓' : index + 1}
                    </span>
                    <span className="ide-project-hero-step-label">{step.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          <div className="ide-project-hero-actions">
            <span data-testid="ide-primary-cta">
              <IdeButton tone="primary" onClick={onPrimaryCta} testId="ide-project-continue-cta" className="is-large">
                {primaryCtaLabel} →
              </IdeButton>
            </span>
            <IdeButton tone="secondary" onClick={onOpenImport} testId="ide-project-hero-import">
              Import HDL/XDC
            </IdeButton>
            {unmappedRequiredCount > 0 && (
              <IdeButton tone="secondary" onClick={onAutoSuggestMapping} testId="ide-project-hero-automap">
                Auto-suggest Basys3
              </IdeButton>
            )}
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

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
