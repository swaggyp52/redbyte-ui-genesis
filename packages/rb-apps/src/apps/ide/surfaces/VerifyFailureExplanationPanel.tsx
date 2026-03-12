import React from 'react';
import type { VerifyFailureClassification } from './verify-failure-classifier';

export interface VerifyFailureExplanationCase {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  vectorId?: string;
  caseIndex?: number;
}

export interface VerifyFailureExplanationPanelProps {
  failure: VerifyFailureExplanationCase | null;
  classification: VerifyFailureClassification | null;
  peers?: VerifyFailureExplanationCase[];
  inputSnapshot?: Array<{ label: string; value: string }> | null;
  patternSummary?: string | null;
  onSelectPeer?: (peer: VerifyFailureExplanationCase) => void;
}

export const VerifyFailureExplanationPanel: React.FC<VerifyFailureExplanationPanelProps> = ({
  failure,
  classification,
  peers = [],
  inputSnapshot,
  patternSummary,
  onSelectPeer,
}) => {
  return (
    <section className="ide-verify-failure-explanation-panel" data-testid="ide-verify-failure-explanation-panel">
      <header className="ide-design-subheader ide-verify-three-panel-header">
        <h3>Failure Explanation</h3>
        <span className="ide-copy">{failure ? `t${failure.tick}` : 'No selection'}</span>
      </header>

      <div
        className="ide-verify-failure-explainer-scroll"
        data-testid="ide-verify-failure-explainer"
      >
        {!failure ? (
          <p className="ide-copy">Select a failing vector row to inspect expected vs actual output.</p>
        ) : (
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Signal key</span>
              <code data-testid="ide-verify-right-signal-key">{failure.signal}</code>
            </div>
            <div className="ide-kv-row">
              <span>Expected value</span>
              <code data-testid="ide-verify-right-expected">{failure.expected}</code>
            </div>
            <div className="ide-kv-row">
              <span>Actual value</span>
              <code data-testid="ide-verify-right-actual">{failure.actual}</code>
            </div>
            <div className="ide-kv-row">
              <span>Tick</span>
              <code data-testid="ide-verify-right-tick">t{failure.tick}</code>
            </div>
            <div className="ide-kv-row">
              <span>Likely reason</span>
              <span data-testid="ide-verify-right-likely-reason">
                {classification?.message ?? 'Output driver mismatch - check expected vs actual signals'}
              </span>
            </div>

            {patternSummary ? (
              <div className="ide-kv-row">
                <span>Pattern</span>
                <span>{patternSummary}</span>
              </div>
            ) : null}

            {inputSnapshot && inputSnapshot.length > 0 ? (
              <div className="ide-kv-row">
                <span>Inputs at tick</span>
                <div className="ide-inline-actions">
                  {inputSnapshot.slice(0, 8).map((entry) => (
                    <code key={`${entry.label}-${entry.value}`}>{entry.label}={entry.value}</code>
                  ))}
                </div>
              </div>
            ) : null}

            {peers.length > 0 ? (
              <div className="ide-kv-row" data-testid="ide-verify-right-peer-list">
                <span>Also failing</span>
                <div className="ide-inline-actions">
                  {peers.map((peer) => (
                    <button
                      key={`${peer.tick}-${peer.signal}`}
                      type="button"
                      className="ide-verify-mismatch-fix-btn"
                      onClick={() => onSelectPeer?.(peer)}
                    >
                      <code>{peer.signal}</code> t{peer.tick}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};
