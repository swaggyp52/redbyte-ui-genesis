// Copyright (c) 2025 Connor Angiel - RedByte
// Export surface primitives: readiness hero, Vivado instructions, advanced details.
// Presentational only. Wiring lives in ExportSurface.tsx.

import React from 'react';
import {
  IdeButton,
  IdeCallout,
  IdeStatusPill,
  IdeSpinner,
} from '../../components/IdePrimitives';

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type ExportTrustCondition = 'trusted' | 'advisory' | 'blocked';
export type ExportHandoffTone = 'ok' | 'warn' | 'error';
export type ExportVerifyProvenance = 'not-run' | 'stale' | 'trace' | 'pass' | 'fail';
export type ExportBuildProvenance = 'not-built' | 'previous' | 'current';
export type ExportStepState = 'idle' | 'running' | 'done' | 'warn' | 'error' | 'skipped';

export interface ExportRebuildStep {
  readonly id: string;
  readonly label: string;
  readonly state: ExportStepState;
  readonly detail?: string;
}

export interface ExportAgreementRow {
  readonly id: string;
  readonly label: string;
  readonly tone: string;
  readonly detail: string;
}

export interface ExportHandoffArtifactCue {
  readonly path: string;
  readonly note: string;
  readonly status: string;
}

export interface ExportDeterministicCheck {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  readonly tooltip: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ExportSummaryStat — reusable label/value cell for the design summary grid
// ─────────────────────────────────────────────────────────────────────────────

export const ExportSummaryStat: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
}> = ({ label, value, mono = false }) => (
  <div className="ide-export-summary-stat">
    <span className="ide-export-summary-stat-label">{label}</span>
    <span className={`ide-export-summary-stat-value${mono ? ' is-mono' : ''}`}>{value}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ExportReadinessHero
// The dominant first section of the Export surface. Shows ONE of four
// readiness states (trusted / advisory / blocked / draft) via the trust
// banner, and bundles the summary card, checks dock, design summary stats,
// and collapsible package handoff into a single cohesive hero.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportReadinessHeroProps {
  // ── Layout ───────────────────────────────────────────────────────────────────
  readonly sectionRef?: React.Ref<HTMLElement>;
  readonly layoutMode?: string;

  // ── Summary card ─────────────────────────────────────────────────────────────
  readonly dominantActionTitle: string;
  readonly dominantActionDetail: string;
  readonly firstBlocker?: {
    readonly code: string;
    readonly title: string;
    readonly fix?: string;
    readonly ownerText: string;
    readonly isHardwareIssue: boolean;
    readonly isDesignIssue: boolean;
  };

  // ── Checks dock ──────────────────────────────────────────────────────────────
  readonly handoffTone: ExportHandoffTone;
  readonly handoffStatusLabel: string;
  readonly nextActionTitle: string;
  readonly nextActionDetail: string;
  readonly verifyProvenance: ExportVerifyProvenance;
  readonly buildProvenance: ExportBuildProvenance;
  readonly determinismHashShort: string;

  // ── Action buttons ────────────────────────────────────────────────────────────
  readonly isRebuilding: boolean;
  readonly primaryHandoffDisabled: boolean;
  readonly primaryCtaLabel: string;
  readonly showPrimaryDownloadSpinner: boolean;
  readonly showSecondaryProjectDownload: boolean;
  readonly projectDownloadLabel: string;
  readonly kitDownloadLabel: string;
  /** True when download buttons should be disabled (= !downloadReady || isRebuilding). */
  readonly downloadDisabled: boolean;
  readonly rebuildSteps: readonly ExportRebuildStep[];

  // ── Design summary stats ──────────────────────────────────────────────────────
  readonly topModule: string;
  readonly mappedPinsLabel: string;
  readonly artifactsLabel: string;

  // ── Package handoff (collapsed section) ───────────────────────────────────────
  readonly packageStatusTone: ExportHandoffTone;
  readonly packageStatusLabel: string;
  readonly packageHeadline: string;
  readonly packageSubline: string;
  readonly boardTarget: string;
  readonly timingPlain: string;
  readonly mappingPlain: string;
  readonly verifyPlain: string;
  readonly artifactsPlain: string;
  readonly artifactPreviewItems: readonly ExportHandoffArtifactCue[];
  readonly selectedArtifactPath: string;

  // ── Trust banner (4-state readiness) ──────────────────────────────────────────
  readonly trustCondition: ExportTrustCondition;
  readonly trustReason?: string;
  readonly trustConsequence: string;
  readonly isDraftExport: boolean;
  readonly trustPrimaryCtaIsVerify: boolean;
  readonly trustPrimaryCtaIsHardware: boolean;

  // ── Readiness strip (blocked state only) ──────────────────────────────────────
  readonly designReady: boolean;
  readonly unmappedRequiredCount: number;

  // ── Artifact agreement (collapsed table) ──────────────────────────────────────
  readonly artifactAgreementRows: readonly ExportAgreementRow[];

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  readonly onGoToHardware?: () => void;
  readonly onGoToProject?: () => void;
  readonly onGoToDesign?: () => void;
  readonly onOpenVerify?: () => void;
  readonly onPreviewArtifact: (artifactPath: string) => void;
  readonly onPrimaryHandoff: () => void;
  readonly onDownloadProject: () => void;
  readonly onDownloadKit: () => void;
}

export const ExportReadinessHero: React.FC<ExportReadinessHeroProps> = ({
  sectionRef,
  layoutMode,
  dominantActionTitle,
  dominantActionDetail,
  firstBlocker,
  handoffTone,
  handoffStatusLabel,
  nextActionTitle,
  nextActionDetail,
  verifyProvenance,
  buildProvenance,
  determinismHashShort,
  isRebuilding,
  primaryHandoffDisabled,
  primaryCtaLabel,
  showPrimaryDownloadSpinner,
  showSecondaryProjectDownload,
  projectDownloadLabel,
  kitDownloadLabel,
  downloadDisabled,
  rebuildSteps,
  topModule,
  mappedPinsLabel,
  artifactsLabel,
  packageStatusTone,
  packageStatusLabel,
  packageHeadline,
  packageSubline,
  boardTarget,
  timingPlain,
  mappingPlain,
  verifyPlain,
  artifactsPlain,
  artifactPreviewItems,
  selectedArtifactPath,
  trustCondition,
  trustReason,
  trustConsequence,
  isDraftExport,
  trustPrimaryCtaIsVerify,
  trustPrimaryCtaIsHardware,
  designReady,
  unmappedRequiredCount,
  artifactAgreementRows,
  onGoToHardware,
  onGoToProject,
  onGoToDesign,
  onOpenVerify,
  onPreviewArtifact,
  onPrimaryHandoff,
  onDownloadProject,
  onDownloadKit,
}) => (
  <section
    ref={sectionRef}
    className="ide-export-summary-hero"
    data-layout-mode={layoutMode}
    data-testid="ide-export-readiness-hero"
    data-hierarchy-surface="export"
    data-hierarchy-role="primary"
    data-hierarchy-focal="e0-handoff"
  >
    <div className="ide-export-handoff-station" data-testid="ide-export-handoff-station">
      <div className="ide-export-summary-hero-main">

      {/* Summary card — dominant title and optional first blocker */}
      <div className="ide-export-summary-copy" data-testid="ide-export-summary-card">
        <div className="ide-export-summary-eyebrow">
          <span>Export handoff station</span>
        </div>
        <h3>{dominantActionTitle}</h3>
        <p>{dominantActionDetail}</p>
        {firstBlocker && (
          <div className="ide-export-first-blocker" data-testid="ide-export-first-blocker">
            <span className="ide-export-blocker-code">{firstBlocker.code}</span>
            <strong className="ide-export-blocker-title">{firstBlocker.title}</strong>
            {firstBlocker.fix && (
              <span className="ide-export-blocker-fix">{firstBlocker.fix}</span>
            )}
            <p className="ide-export-blocker-owner" data-testid="ide-export-first-blocker-owner">
              <strong>Fix on:</strong> {firstBlocker.ownerText}
            </p>
            {firstBlocker.isHardwareIssue && onGoToHardware && (
              <IdeButton tone="ghost" onClick={onGoToHardware} testId="ide-export-blocker-goto-hardware">
                Fix in Map Pins
              </IdeButton>
            )}
            {firstBlocker.isDesignIssue && onGoToDesign && (
              <IdeButton tone="ghost" onClick={onGoToDesign} testId="ide-export-blocker-goto-design">
                Fix in Design
              </IdeButton>
            )}
          </div>
        )}
        <div className="ide-export-handoff-summary" data-testid="ide-export-handoff-summary">
          <div className="ide-export-handoff-summary-row" data-testid="ide-export-handoff-summary-design">
            <span className="ide-export-handoff-summary-label">Design</span>
            <span className="ide-export-handoff-summary-value">{topModule}</span>
            <span className="ide-export-handoff-summary-detail">Top module in this package</span>
          </div>
          <div className="ide-export-handoff-summary-row" data-testid="ide-export-handoff-summary-board">
            <span className="ide-export-handoff-summary-label">Board</span>
            <span className="ide-export-handoff-summary-value">{boardTarget}</span>
            <span className="ide-export-handoff-summary-detail">Target FPGA board for Vivado build</span>
          </div>
          <div className="ide-export-handoff-summary-row" data-testid="ide-export-handoff-summary-mapping">
            <span className="ide-export-handoff-summary-label">Pin mapping</span>
            <span className="ide-export-handoff-summary-value">{mappingPlain}</span>
            <span className="ide-export-handoff-summary-detail">Board controls bound to package pins</span>
          </div>
          <div className="ide-export-handoff-summary-row" data-testid="ide-export-handoff-summary-verify">
            <span className="ide-export-handoff-summary-label">Verification</span>
            <span className="ide-export-handoff-summary-value">{verifyPlain}</span>
            <span className="ide-export-handoff-summary-detail">Most recent scenario evidence status</span>
          </div>
          <div className="ide-export-handoff-summary-row" data-testid="ide-export-handoff-summary-artifacts">
            <span className="ide-export-handoff-summary-label">Artifacts</span>
            <span className="ide-export-handoff-summary-value">{artifactsPlain}</span>
            <span className="ide-export-handoff-summary-detail">Generated files align for handoff</span>
          </div>
          <div className="ide-export-handoff-summary-row" data-testid="ide-export-handoff-summary-state">
            <span className="ide-export-handoff-summary-label">Export state</span>
            <span className="ide-export-handoff-summary-value">{handoffStatusLabel}</span>
            <span className="ide-export-handoff-summary-detail">
              {trustCondition === 'trusted'
                ? 'Trusted package available for Vivado handoff'
                : isDraftExport
                  ? 'Draft package available; trusted evidence still pending'
                  : 'Resolve blockers before treating package as handoff-ready'}
            </span>
          </div>
        </div>
        {artifactPreviewItems.length > 0 && (
          <section
            className="ide-export-handoff-artifact-strip"
            data-testid="ide-export-handoff-artifact-strip"
            aria-label="Generated files in this Export handoff"
          >
            <div className="ide-export-handoff-artifact-strip-head">
              <span>Generated files</span>
              <span>{artifactPreviewItems.length} visible</span>
            </div>
            <div className="ide-export-handoff-artifact-list">
              {artifactPreviewItems.map((artifact) => {
                const isSelected = selectedArtifactPath === artifact.path;
                return (
                  <button
                    key={artifact.path}
                    type="button"
                    className={`ide-export-handoff-artifact-chip ide-export-handoff-artifact-chip--${artifact.status} ${
                      isSelected ? 'is-active' : ''
                    }`}
                    data-testid={`ide-export-handoff-artifact-${artifact.path
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')}`}
                    title={artifact.note}
                    aria-label={`Preview ${artifact.path}`}
                    aria-pressed={isSelected}
                    onClick={() => onPreviewArtifact(artifact.path)}
                  >
                    <span className="ide-export-handoff-artifact-name">{artifact.path}</span>
                    <span className="ide-export-handoff-artifact-state">{artifact.status}</span>
                    <span className="ide-export-handoff-artifact-action">Preview</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Checks dock — status pill, provenance rows, action buttons */}
      <section
        className="ide-export-sidecard ide-export-buildCard ide-export-action-card"
        data-testid="ide-export-checks-dock"
      >
        <div className="ide-export-buildCardTop">
          <div className="ide-export-action-card-copy">
            <span className="ide-export-buildTitle">Next action</span>
            <p className="ide-copy ide-copy--flush">{nextActionTitle}</p>
          </div>
          <IdeStatusPill tone={handoffTone}>{handoffStatusLabel}</IdeStatusPill>
        </div>

        {/* Action buttons */}
        <div className="ide-inline-actions ide-export-action-buttons">
          <span data-testid="ide-export-primary-handoff-cta">
            <span data-testid="ide-primary-cta">
              <IdeButton
                tone="primary"
                onClick={onPrimaryHandoff}
                disabled={primaryHandoffDisabled}
                testId="ide-export-rebuild-btn"
                hierarchySurface="export"
                hierarchyRole="next"
              >
                {showPrimaryDownloadSpinner ? (
                  <><IdeSpinner size="sm" testId="ide-export-rebuild-spinner" /> Building...</>
                ) : (
                  primaryCtaLabel
                )}
              </IdeButton>
            </span>
          </span>
          {showSecondaryProjectDownload && (
            <IdeButton
              tone="secondary"
              onClick={onDownloadProject}
              disabled={downloadDisabled}
              testId="ide-export-dock-download"
            >
              {projectDownloadLabel}
            </IdeButton>
          )}
        </div>
        <p className="ide-copy ide-copy--flush ide-export-action-card-detail">
          {nextActionDetail}
        </p>

        {/* Provenance rows */}
        <div className="ide-kv-list ide-export-action-card-provenance">
          <div className="ide-kv-row ide-export-provenance-row" data-testid="ide-export-provenance-design">
            <span>Design</span>
            <span className="ide-status-mono" title={`Current circuit: ${determinismHashShort}`}>
              {determinismHashShort}
            </span>
          </div>
          <div className="ide-kv-row ide-export-provenance-row" data-testid="ide-export-provenance-verify">
            <span>Verification</span>
            <span>
              {verifyProvenance === 'not-run' && (
                <span className="ide-export-provenance-none">Not run</span>
              )}
              {verifyProvenance === 'stale' && (
                <span className="ide-export-provenance-stale" title="Circuit changed since the last checked run">
                  Previous build
                </span>
              )}
              {verifyProvenance === 'trace' && (
                <span className="ide-export-provenance-none">Trace only</span>
              )}
              {verifyProvenance === 'pass' && (
                <span className="ide-export-provenance-pass">Checks match</span>
              )}
              {verifyProvenance === 'fail' && (
                <span className="ide-export-provenance-fail">Checks differ</span>
              )}
            </span>
          </div>
          <div className="ide-kv-row ide-export-provenance-row" data-testid="ide-export-provenance-build">
            <span>Build</span>
            <span>
              {buildProvenance === 'not-built' && (
                <span className="ide-export-provenance-none">Not built</span>
              )}
              {buildProvenance === 'previous' && (
                <span className="ide-export-provenance-stale" title="Build is from a previous circuit version">
                  Previous
                </span>
              )}
              {buildProvenance === 'current' && (
                <span className="ide-export-provenance-pass">Current</span>
              )}
            </span>
          </div>
        </div>

        {/* Kit download (Other outputs) */}
        <details className="ide-export-other-outputs ide-mt-1" data-testid="ide-export-other-outputs">
          <summary className="ide-summary-toggle">Other outputs</summary>
          <div className="ide-inline-actions ide-mt-1">
            <IdeButton
              tone="secondary"
              onClick={onDownloadKit}
              disabled={downloadDisabled}
              testId="ide-export-download-kit-btn"
            >
              {kitDownloadLabel}
            </IdeButton>
          </div>
        </details>

        {/* Build pipeline steps */}
        <details
          className="ide-export-pipeline-details ide-mt-1"
          data-testid="ide-export-pipeline-details"
          data-hierarchy-surface="export"
          data-hierarchy-role="advanced"
        >
          <summary>Build details</summary>
          <ol className="ide-export-buildSteps" data-testid="ide-export-rebuild-steps">
            {rebuildSteps.map((s) => (
              <li
                key={s.id}
                className={`ide-export-step ide-export-step--${s.state}`}
                data-testid={`ide-export-rebuild-step-${s.id}`}
              >
                <span className="ide-export-stepMark">
                  {s.state === 'done' ? '[OK]'
                    : s.state === 'running' ? '[..]'
                    : s.state === 'error' ? '[X]'
                    : s.state === 'skipped' ? '[-]'
                    : '[ ]'}
                </span>
                <span className="ide-export-stepLabel">{s.label}</span>
                {s.detail && <span className="ide-export-stepDetail">{s.detail}</span>}
              </li>
            ))}
          </ol>
          <div className="ide-inline-actions ide-mt-2">
            {onGoToHardware && (
              <IdeButton tone="secondary" onClick={onGoToHardware} testId="ide-export-go-hardware">
                Back to Map Pins
              </IdeButton>
            )}
            {onGoToProject && (
              <IdeButton tone="secondary" onClick={onGoToProject} testId="ide-export-go-project">
                Go to Project
              </IdeButton>
            )}
          </div>
        </details>
      </section>
      </div>

    {/* Design summary — 4-stat grid */}
    <div className="ide-export-summary-grid" data-testid="ide-export-design-summary">
      <ExportSummaryStat label="Board" value="Basys3" />
      <ExportSummaryStat label="Top Module" value={topModule} mono />
      <ExportSummaryStat label="Mapped Pins" value={mappedPinsLabel} />
      <ExportSummaryStat label="Artifacts" value={artifactsLabel} />
    </div>

    {/* Package handoff (collapsed) */}
    <div className="ide-export-summary-support">
      <details className="ide-export-handoff-advanced" open>
        <summary className="ide-summary-toggle">Handoff details</summary>
        <section
          className="ide-export-package-handoff"
          data-testid="ide-export-package-handoff"
          aria-label="Package handoff summary"
        >
          <header className="ide-export-section-header ide-export-package-handoff-header">
            <div>
              <h3>Current handoff</h3>
              <p className="ide-export-section-subcopy">
                One owner for state, fix direction, board target, timing, mapping, verify evidence, and file agreement.
              </p>
            </div>
          </header>

          <div className="ide-export-handoff-status" data-testid="ide-export-package-handoff-status">
            <IdeStatusPill tone={packageStatusTone}>{packageStatusLabel}</IdeStatusPill>
            <div>
              <p className="ide-copy ide-copy--flush ide-export-handoff-headline">
                {packageHeadline}
              </p>
              <p className="ide-copy ide-copy--flush ide-export-handoff-subline">
                {packageSubline}
              </p>
            </div>
          </div>

          {/* Trust banner — 4 readiness states */}
          <div
            className="ide-export-trust-banner ide-export-trust-banner--inline"
            data-testid="ide-export-trust-banner"
          >
            {trustCondition === 'trusted' ? (
              <div className="ide-export-trust-row ide-export-trust-row--trusted">
                <IdeStatusPill tone="ok">READY</IdeStatusPill>
                <span className="ide-export-trust-message" data-testid="ide-export-trust-consequence">
                  {trustConsequence}
                </span>
              </div>
            ) : trustCondition === 'advisory' ? (
              <div className="ide-export-trust-row ide-export-trust-row--available">
                <div className="ide-export-trust-header">
                  <IdeStatusPill tone="warn">NEEDS REVIEW</IdeStatusPill>
                  {isDraftExport && (
                    <IdeStatusPill tone="warn" testId="ide-export-trust-draft-pill">
                      DRAFT AVAILABLE
                    </IdeStatusPill>
                  )}
                </div>
                <div className="ide-export-trust-body">
                  <p className="ide-export-trust-reason" data-testid="ide-export-trust-reason">
                    {trustReason}
                  </p>
                  <p className="ide-export-trust-consequence" data-testid="ide-export-trust-consequence">
                    {trustConsequence}
                  </p>
                  {trustPrimaryCtaIsVerify && onOpenVerify && (
                    <IdeButton tone="ghost" onClick={onOpenVerify} testId="ide-export-trust-go-verify">
                      Open Verify
                    </IdeButton>
                  )}
                </div>
              </div>
            ) : (
              <div className="ide-export-trust-row ide-export-trust-row--blocked">
                <div className="ide-export-trust-header">
                  <IdeStatusPill tone="error">BLOCKED</IdeStatusPill>
                  {isDraftExport && (
                    <IdeStatusPill tone="warn" testId="ide-export-trust-draft-pill">
                      DRAFT AVAILABLE
                    </IdeStatusPill>
                  )}
                  <div className="ide-export-readiness-strip" data-testid="ide-export-readiness-strip">
                    <span
                      className={`ide-export-readiness-axis ${designReady ? 'ide-export-readiness-axis--ok' : 'ide-export-readiness-axis--fail'}`}
                      data-testid="ide-export-readiness-design"
                    >
                      {designReady ? 'Design valid' : 'Design incomplete'}
                    </span>
                    {unmappedRequiredCount > 0 && (
                      <span
                        className="ide-export-readiness-axis ide-export-readiness-axis--fail"
                        data-testid="ide-export-readiness-mapping"
                      >
                        {unmappedRequiredCount} pin{unmappedRequiredCount !== 1 ? 's' : ''} unmapped
                      </span>
                    )}
                  </div>
                </div>
                <div className="ide-export-trust-body">
                  <p className="ide-export-trust-consequence" data-testid="ide-export-trust-consequence">
                    {trustConsequence}
                  </p>
                  {trustPrimaryCtaIsHardware && onGoToHardware && (
                    <IdeButton tone="ghost" onClick={onGoToHardware} testId="ide-export-trust-go-hardware">
                      Open Map Pins
                    </IdeButton>
                  )}
                </div>
              </div>
            )}
            {isDraftExport && (
              <p className="ide-copy ide-copy--flush ide-export-trust-draft-note" data-testid="ide-export-trust-draft-note">
                Draft only - run Verify before relying on this handoff.
              </p>
            )}
          </div>

          {/* Handoff facts */}
          <dl className="ide-export-handoff-facts" data-testid="ide-export-handoff-facts">
            <div>
              <dt>Board target</dt>
              <dd data-testid="ide-export-handoff-board">{boardTarget}</dd>
            </div>
            <div>
              <dt>Timing mode</dt>
              <dd data-testid="ide-export-handoff-timing">{timingPlain}</dd>
            </div>
            <div>
              <dt>Mapping completeness</dt>
              <dd data-testid="ide-export-handoff-mapping">{mappingPlain}</dd>
            </div>
            <div>
              <dt>Verify / scenario</dt>
              <dd data-testid="ide-export-handoff-verify">{verifyPlain}</dd>
            </div>
            <div>
              <dt>Cross-artifact agreement</dt>
              <dd data-testid="ide-export-handoff-artifacts">{artifactsPlain}</dd>
            </div>
          </dl>

          {/* Artifact agreement (collapsed table) */}
          <details className="ide-export-agreement-details" data-testid="ide-export-agreement-details">
            <summary className="ide-summary-toggle">Artifact agreement</summary>
            <p className="ide-export-section-subcopy ide-export-agreement-intro">
              Top RTL, testbench, XDC, README, and Vivado import script should tell the same story
              on entity names, ports, widths, and bindings.
            </p>
            <table className="ide-export-agreement-table" data-testid="ide-export-artifact-agreement">
              <tbody>
                {artifactAgreementRows.map((row) => (
                  <tr key={row.id} data-testid={`ide-export-agreement-row-${row.id}`}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <span
                        className={`ide-export-agreement-tone ide-export-agreement-tone--${row.tone}`}
                        data-testid={`ide-export-agreement-tone-${row.id}`}
                      >
                        {row.detail}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      </details>
    </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// ExportVivadoInstructions
// The "Open in Vivado" section in the right column. Shows the 3-step quick
// checklist plus a collapsed advanced checklist with board/part/tool details.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportVivadoInstructionsProps {
  readonly projectSlug: string;
  readonly vivadoPart: string;
  readonly vivadoCommand: string;
  readonly topModule: string;
  readonly downloadReady: boolean;
  readonly isDraftExport: boolean;
  readonly hasVerifyEvidenceWarning: boolean;
  readonly partNumberCopied: boolean;
  readonly onCopyPartNumber: () => void;
}

export const ExportVivadoInstructions: React.FC<ExportVivadoInstructionsProps> = ({
  projectSlug,
  vivadoPart,
  vivadoCommand,
  topModule,
  downloadReady,
  isDraftExport,
  hasVerifyEvidenceWarning,
  partNumberCopied,
  onCopyPartNumber,
}) => (
  <section className="ide-export-section" data-testid="ide-export-vivado-ready">
    <header className="ide-export-section-header">
      <div>
        <h3>Open in Vivado</h3>
        <p className="ide-export-section-subcopy">
          Use this only after the handoff summary above is honest for your current design
          (mapping, gates, Verify).
        </p>
        {downloadReady && (
          <p
            className="ide-export-section-subcopy"
            data-testid="ide-export-vivado-zip-contents"
            style={{ marginTop: 'var(--ide-space-2)' }}
          >
            The project ZIP includes <code>top.vhd</code> (your generated top),{' '}
            <code>top.xdc</code> (Basys3 pin constraints),{' '}
            <code>{projectSlug}.xpr</code> (Vivado project),{' '}
            <code>vivado_import.tcl</code>, and a README with bring-up notes.
            &quot;Ready for Vivado&quot; in RedByte means those files line up with your mapped
            ports and the export build completed without hard blockers — you still run synthesis,
            implementation, and bitstream on your computer in Vivado.
          </p>
        )}
      </div>
    </header>

    <div className="ide-export-next-steps" data-testid="ide-export-vivado-steps">
      {isDraftExport && (
        <IdeCallout tone="warn" testId="ide-export-vivado-draft-warning" className="ide-mb-2">
          Draft package only - run Verify compare before relying on this handoff.
        </IdeCallout>
      )}

      {/* Numbered Vivado handoff checklist */}
      <ol className="ide-export-checklist" data-testid="ide-export-vivado-checklist">
        <li>Download the current package from this page.</li>
        <li>Unzip to a short local path (for example <code>C:\\rb\\{projectSlug}</code>).</li>
        <li>Open Vivado and choose <strong>File {'->'} Open Project</strong>.</li>
        <li>Select <code>{projectSlug}.xpr</code> from the extracted folder, or run <code>vivado_import.tcl</code>.</li>
        <li>Run Synthesis and fix any reported synthesis blockers.</li>
        <li>Run Implementation and review timing/messages.</li>
        <li>Generate Bitstream after implementation succeeds.</li>
        <li>Open Hardware Manager and program the connected Basys3 board.</li>
      </ol>

      {/* Advanced / full checklist (collapsed) */}
      <details className="ide-export-advanced-steps">
        <summary>Advanced / full checklist</summary>
        <div
          className="ide-kv-list"
          style={{ marginTop: 'var(--ide-space-2)', marginBottom: 'var(--ide-space-2)' }}
        >
          <div className="ide-kv-row">
            <span>Board</span>
            <span><code>Basys3</code></span>
          </div>
          <div className="ide-kv-row">
            <span>Part</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--ide-space-1)' }}>
              <code data-testid="ide-export-part-number">{vivadoPart}</code>
              <IdeButton tone="ghost" onClick={onCopyPartNumber}>
                {partNumberCopied ? 'Copied!' : 'Copy'}
              </IdeButton>
            </span>
          </div>
          <div className="ide-kv-row">
            <span>Top Module</span>
            <span><code data-testid="ide-export-top-module">{topModule}</code></span>
          </div>
          <div className="ide-kv-row">
            <span>Tool</span>
            <span><code>Vivado 2024.2+</code></span>
          </div>
        </div>
        <p
          className="ide-copy"
          style={{
            fontSize: 'var(--rb-font-size-1)',
            color: 'var(--ide-text-soft)',
            marginTop: 'var(--ide-space-2)',
            marginBottom: 0,
          }}
        >
          Unzip the download and keep the <code>{projectSlug}</code> folder intact before opening
          the project.
        </p>
        <p
          className="ide-copy"
          style={{
            fontSize: 'var(--rb-font-size-1)',
            color: 'var(--ide-text-soft)',
            marginTop: 'var(--ide-space-1)',
            marginBottom: 0,
          }}
        >
          Batch fallback: run <code>{vivadoCommand}</code> from the extracted folder.
        </p>
      </details>

      {downloadReady ? (
        <div data-testid="ide-export-readme-preview" className="ide-mt-1">
          <p
            className="ide-copy"
            style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-muted)', margin: 0 }}
            data-testid="ide-export-vivado-command"
          >
            Batch import command: <code>{vivadoCommand}</code>
          </p>
        </div>
      ) : (
        <p className="ide-copy ide-export-vivado-blocked-hint">
          Resolve the handoff blockers above before importing to Vivado.
        </p>
      )}

      {hasVerifyEvidenceWarning && downloadReady && (
        <IdeCallout tone="warn" testId="ide-export-vivado-unverified-callout" className="ide-mt-1">
          Run Verify before relying on this handoff. Without a comparison run, the testbench
          vectors have no confirmed match against live outputs.
        </IdeCallout>
      )}

      {isDraftExport && (
        <IdeCallout tone="warn" testId="ide-export-draft-callout" className="ide-mt-1">
          This download is a draft Vivado package. Buildable files can still be useful for
          debugging, but RedByte will not call the handoff trusted until Verify passes and this
          package is current.
        </IdeCallout>
      )}
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// ExportAdvancedDetails
// Collapsed section in the right column containing the determinism check rows
// and a debug report copy action. Students don't need this in normal use.
// ─────────────────────────────────────────────────────────────────────────────

export type ExportDebugCopyState = 'idle' | 'copied' | 'error';

export interface ExportAdvancedDetailsProps {
  readonly deterministicChecks: readonly ExportDeterministicCheck[];
  readonly debugReportCopyState: ExportDebugCopyState;
  readonly onCopyDebugReport: () => void;
}

export const ExportAdvancedDetails: React.FC<ExportAdvancedDetailsProps> = ({
  deterministicChecks,
  debugReportCopyState,
  onCopyDebugReport,
}) => (
  <details className="ide-export-advanced-details ide-mt-2" data-testid="ide-export-advanced-details">
    <summary className="ide-summary-toggle">Advanced proof metadata</summary>

    {/* Determinism checks */}
    <section
      className="ide-export-determinismChecks ide-export-aside-panel"
      data-testid="ide-export-determinism-checks"
    >
      <div className="ide-export-determinismHeader">DETERMINISM</div>
      <div className="ide-export-determinismLegend">OK satisfied | CHECK required</div>
      {deterministicChecks.map((check) => (
        <div
          key={check.id}
          className={`ide-export-determinismRow ${check.pass ? 'is-pass' : 'is-fail'}`}
          data-testid={`ide-export-determinism-${check.id}`}
          title={check.tooltip}
        >
          <span className="ide-export-determinismIcon">{check.pass ? 'OK' : 'CHECK'}</span>
          <span className="ide-export-determinismLabel">{check.label}</span>
        </div>
      ))}
    </section>

    {/* Debug report */}
    <details className="ide-export-evidence-details ide-mt-2" data-testid="ide-export-evidence-details">
      <summary>Build/debug context</summary>
      <div className="ide-export-capsuleSlab ide-mt-1">
        <div className="ide-inline-actions">
          <IdeButton tone="ghost" onClick={onCopyDebugReport} testId="ide-export-copy-debug-report">
            Copy debug report
          </IdeButton>
        </div>
        <p
          className="ide-copy"
          style={{ fontSize: 10, marginTop: 0 }}
          data-testid="ide-export-copy-state"
        >
          {debugReportCopyState === 'copied'
            ? 'Copied.'
            : debugReportCopyState === 'error'
              ? 'Clipboard error.'
              : 'Export hash and mapping snapshot for debugging.'}
        </p>
      </div>
    </details>
  </details>
);
