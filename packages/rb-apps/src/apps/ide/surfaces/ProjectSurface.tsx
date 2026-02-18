import React from 'react';
import {
  IdeButton,
  IdeCallout,
  IdeCard,
  IdeDataTable,
  IdeEmptyState,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface ProjectSurfaceProps {
  projectName: string;
  description: string;
  determinismHash: string;
  readiness: {
    ioSignals: Array<{ id: string; direction: 'in' | 'out'; mapped: boolean }>;
    vectors: Array<{ id: string; tick: number }>;
    lastVerify: { pass: boolean; failedCount: number } | null;
  };
  onOpenDesign: () => void;
  onOpenImport: () => void;
}

export const ProjectSurface: React.FC<ProjectSurfaceProps> = ({
  projectName,
  description,
  determinismHash,
  readiness,
  onOpenDesign,
  onOpenImport,
}) => {
  const ioTotal = readiness.ioSignals.length;
  const ioMapped = readiness.ioSignals.filter((signal) => signal.mapped).length;
  const vectorCount = readiness.vectors.length;

  const ioCoverage = ioTotal > 0 ? Math.round((ioMapped / ioTotal) * 100) : 0;
  const hasVectors = vectorCount > 0;
  const verifyFailed = readiness.lastVerify ? !readiness.lastVerify.pass : false;

  const blockers: string[] = [];
  if (ioCoverage < 100) {
    blockers.push(`Map remaining IO signals (${ioMapped}/${ioTotal} mapped).`);
  }
  if (!hasVectors) {
    blockers.push('Add at least one test vector for deterministic verification.');
  }
  if (verifyFailed) {
    blockers.push(`Resolve ${readiness.lastVerify?.failedCount ?? 0} verification failures.`);
  }

  const projectReady = blockers.length === 0;

  const artifactRows = [
    ['rb-project.json', 'Project schema snapshot', 'Ready'],
    ['top.vhd', 'Generated from current graph', projectReady ? 'Ready' : 'Pending'],
    ['top.xdc', 'Basys3 constraints', ioCoverage === 100 ? 'Ready' : 'Blocked'],
    [
      'verify-report.json',
      'Deterministic verification report',
      hasVectors && !verifyFailed ? 'Ready' : 'Pending',
    ],
  ];

  return (
    <div className="ide-content-grid" data-testid="ide-mode-project" data-ide-mode-marker="project">
      <main className="ide-main-area" data-testid="ide-mode-body">
        <IdePanel
          title="Project Overview"
          description="Manage project identity, readiness, and handoff artifacts."
          actions={
            <>
              <IdeButton tone="primary" onClick={onOpenDesign}>
                Open Design Mode
              </IdeButton>
              <IdeButton tone="ghost" onClick={onOpenImport}>
                Import HDL
              </IdeButton>
            </>
          }
          right={
            projectReady ? (
              <IdeStatusPill tone="ok">Project Ready</IdeStatusPill>
            ) : (
              <IdeStatusPill tone="warn">Needs Work</IdeStatusPill>
            )
          }
          testId="ide-project-panel"
        >
          <div className="ide-card-grid">
            <IdeCard title="Project Name" subtitle="Identity">
              <p className="ide-copy ide-copy-strong">{projectName}</p>
              <p className="ide-copy">{description}</p>
            </IdeCard>
            <IdeCard title="Board Target" subtitle="Scope lock">
              <p className="ide-copy ide-copy-strong">Basys3 (locked)</p>
              <p className="ide-copy">Multi-board UI is intentionally disabled in Phase 1.</p>
            </IdeCard>
            <IdeCard title="Determinism Hash" subtitle="Current project state">
              <p className="ide-hash">{determinismHash}</p>
            </IdeCard>
            <IdeCard title="Last Verification" subtitle="Credibility checkpoint">
              <p className="ide-copy ide-copy-strong">{hasVectors ? 'Ready to run' : 'No vectors yet'}</p>
              <p className="ide-copy">Verification status updates after deterministic run.</p>
            </IdeCard>
          </div>

          {!projectReady && (
            <IdeCallout tone="warn" title="Readiness blockers">
              <ul className="ide-list">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </IdeCallout>
          )}

          <section className="ide-project-readiness">
            <div className="ide-metric">
              <div className="ide-metric-header">
                <span>IO Mapping</span>
                <span>
                  {ioMapped}/{ioTotal}
                </span>
              </div>
              <div className="ide-progress-track" role="progressbar" aria-valuenow={ioCoverage} aria-valuemin={0} aria-valuemax={100}>
                <div className="ide-progress-fill" style={{ width: `${ioCoverage}%` }} />
              </div>
            </div>

            <div className="ide-metric">
              <div className="ide-metric-header">
                <span>Vectors</span>
                <span>{vectorCount}</span>
              </div>
              <p className="ide-copy ide-copy-top-gap">
                {hasVectors ? 'Vector set detected and ready for Verify.' : 'No vectors defined yet.'}
              </p>
            </div>

            <div className="ide-metric">
              <div className="ide-metric-header">
                <span>Last Verify</span>
                <span>
                  {readiness.lastVerify
                    ? readiness.lastVerify.pass
                      ? 'PASS'
                      : 'FAIL'
                    : 'Not Run'}
                </span>
              </div>
              <p className="ide-copy ide-copy-top-gap">
                {readiness.lastVerify
                  ? readiness.lastVerify.pass
                    ? 'Latest verification run passed deterministically.'
                    : `${readiness.lastVerify.failedCount} failures require fixes before export.`
                  : 'Run Verify to establish deterministic readiness.'}
              </p>
            </div>
          </section>

          {!hasVectors && (
            <IdeEmptyState
              title="No test vectors yet"
              body="Create vectors in Project mode before running Verify. This keeps export credibility deterministic."
              primaryAction={<IdeButton tone="secondary">Add Vectors</IdeButton>}
              secondaryAction={<IdeButton tone="ghost">View Vector Format</IdeButton>}
              testId="ide-project-empty-vectors"
            />
          )}

          <IdeDataTable columns={['Artifact', 'Purpose', 'Status']} rows={artifactRows} testId="ide-project-artifact-table" />
        </IdePanel>
      </main>

      <aside className="ide-inspector" data-testid="ide-inspector">
        <IdeInspectorSection title="Project Settings">
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Name</span>
              <span>{projectName}</span>
            </div>
            <div className="ide-kv-row">
              <span>Board</span>
              <span>Basys3</span>
            </div>
            <div className="ide-kv-row">
              <span>IO Coverage</span>
              <span>{ioCoverage}%</span>
            </div>
          </div>
        </IdeInspectorSection>

        <IdeInspectorSection title="Risk Checks">
          {ioCoverage < 100 ? (
            <IdeCallout tone="error" title="Incomplete IO map">
              Complete all pin mappings before export.
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="IO mapping complete">
              Constraints are ready for Basys3 export checks.
            </IdeCallout>
          )}
          {!hasVectors && (
            <IdeCallout tone="warn" title="Verification gap">
              Add vectors to build trust in exported artifacts.
            </IdeCallout>
          )}
        </IdeInspectorSection>
      </aside>
    </div>
  );
};
