import React from 'react';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface VerifySurfaceProps {
  deterministicHash: string;
  hasVectors: boolean;
  onOpenProjectVectors: () => void;
}

export const VerifySurface: React.FC<VerifySurfaceProps> = ({
  deterministicHash,
  hasVectors,
  onOpenProjectVectors,
}) => {
  const runRows = hasVectors
    ? [
        ['12', 'sum[0]', '1', '1', 'PASS'],
        ['12', 'carry', '0', '1', 'FAIL'],
        ['13', 'sum[1]', '1', '1', 'PASS'],
      ]
    : [];
  const failingRows = runRows.filter((row) => row[4] === 'FAIL');
  const runPassed = hasVectors && failingRows.length === 0;

  return (
    <div className="ide-content-grid" data-testid="ide-mode-verify" data-ide-mode-marker="verify">
      <main className="ide-main-area" data-testid="ide-mode-body">
        <IdePanel
          title="Verification"
          description="Deterministic vector execution and failure diagnostics."
          actions={
            <>
              <IdeButton tone="primary">Run Verification</IdeButton>
              <IdeButton tone="ghost" onClick={onOpenProjectVectors}>
                Open Vectors
              </IdeButton>
            </>
          }
          right={
            runPassed ? (
              <IdeStatusPill tone="ok">PASS</IdeStatusPill>
            ) : (
              <IdeStatusPill tone={hasVectors ? 'error' : 'warn'}>{hasVectors ? 'FAIL' : 'No Vectors'}</IdeStatusPill>
            )
          }
          testId="ide-verify-panel"
        >
          <div className={`ide-verify-banner ${runPassed ? 'is-pass' : 'is-fail'}`} data-testid="ide-verify-banner">
            <div>
              <p className="ide-verify-label">Verification Result</p>
              <h3>
                {hasVectors
                  ? runPassed
                    ? 'PASS - deterministic agreement'
                    : 'FAIL - mismatch detected'
                  : 'BLOCKED - add vectors first'}
              </h3>
            </div>
            <div className="ide-verify-hash-block">
              <span>Hash</span>
              <code data-testid="ide-verify-hash">{deterministicHash}</code>
            </div>
          </div>

          {!hasVectors && (
            <IdeCallout tone="warn" title="Verification is blocked">
              Add vectors in Project mode to run deterministic verification.
              <div className="ide-inline-actions">
                <IdeButton tone="secondary" onClick={onOpenProjectVectors}>
                  Add vectors
                </IdeButton>
              </div>
            </IdeCallout>
          )}

          {hasVectors && (
            <>
              <div className="ide-verify-summary-grid">
                <div className="ide-metric">
                  <div className="ide-metric-header">
                    <span>Total Checks</span>
                    <span>{runRows.length}</span>
                  </div>
                  <p className="ide-copy ide-copy-top-gap">Each row is deterministic by tick + signal.</p>
                </div>
                <div className="ide-metric">
                  <div className="ide-metric-header">
                    <span>Failures</span>
                    <span>{failingRows.length}</span>
                  </div>
                  <p className="ide-copy ide-copy-top-gap">
                    {failingRows.length === 0
                      ? 'No failures in latest run.'
                      : 'Resolve failure rows before export.'}
                  </p>
                </div>
              </div>

              <IdeDataTable
                columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
                rows={runRows}
                testId="ide-verify-results-table"
              />
              {!runPassed && failingRows.length > 0 && (
                <IdeCallout tone="error" title="Failure diff">
                  {failingRows.map((row) => (
                    <div key={`${row[0]}-${row[1]}`}>
                      Tick <code>{row[0]}</code> signal <code>{row[1]}</code> expected{' '}
                      <code>{row[2]}</code> but observed <code>{row[3]}</code>.
                    </div>
                  ))}
                </IdeCallout>
              )}
            </>
          )}
        </IdePanel>
      </main>

      <aside className="ide-inspector" data-testid="ide-inspector">
        <IdeInspectorSection title="Signal Picker">
          <div className="ide-signal-list">
            <button className="ide-signal-row" type="button">
              sum[0]
            </button>
            <button className="ide-signal-row" type="button">
              sum[1]
            </button>
            <button className="ide-signal-row" type="button">
              carry
            </button>
          </div>
        </IdeInspectorSection>

        <IdeInspectorSection title="Waveform Preview">
          <div className="ide-waveform-stub" data-testid="ide-verify-waveform-stub">
            <span />
            <span />
            <span />
            <span />
          </div>
        </IdeInspectorSection>
      </aside>
    </div>
  );
};
