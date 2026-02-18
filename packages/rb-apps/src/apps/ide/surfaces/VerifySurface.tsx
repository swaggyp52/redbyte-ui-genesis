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
  const runPassed = false;

  const rows = hasVectors
    ? [
        ['12', 'sum[0]', '1', '1', 'PASS'],
        ['12', 'carry', '0', '1', 'FAIL'],
        ['13', 'sum[1]', '1', '1', 'PASS'],
      ]
    : [];

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
              <h3>{runPassed ? 'PASS - deterministic agreement' : 'FAIL - mismatch detected'}</h3>
            </div>
            <div className="ide-verify-hash-block">
              <span>Hash</span>
              <code>{deterministicHash}</code>
            </div>
          </div>

          {!hasVectors && (
            <IdeCallout tone="warn" title="No test vectors yet">
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
              <IdeDataTable
                columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
                rows={rows}
                testId="ide-verify-results-table"
              />
              {!runPassed && (
                <IdeCallout tone="error" title="Failure diff">
                  Tick 12 signal <code>carry</code> expected <code>0</code> but observed <code>1</code>.
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
