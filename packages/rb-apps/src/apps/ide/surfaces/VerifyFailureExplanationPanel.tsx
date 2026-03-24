import React from 'react';
import { IdeButton } from '../components/IdePrimitives';
import type { VerifyFailureClassification } from './verify-failure-classifier';

export interface VerifyFailureExplanationCase {
  tick: number;
  signal: string;
  signalLabel?: string;
  expected: string;
  actual: string;
  vectorId?: string;
  caseIndex?: number;
}

export interface VerifyFailureExplanationPanelProps {
  failure: VerifyFailureExplanationCase | null;
  classification: VerifyFailureClassification | null;
  reasonCode?: string | null;
  peers?: VerifyFailureExplanationCase[];
  inputSnapshot?: Array<{ label: string; value: string }> | null;
  patternSummary?: string | null;
  patternNextInspect?: string | null;
  onSelectPeer?: (peer: VerifyFailureExplanationCase) => void;
  onJumpToFix?: (failure: VerifyFailureExplanationCase) => void;
  onOpenInDesign?: (failure: VerifyFailureExplanationCase) => void;
}

function displayObservedValue(value: string): string {
  return value === '-' ? 'no sampled value' : value;
}

function displaySignalLabel(failure: VerifyFailureExplanationCase): string {
  return failure.signalLabel?.trim() || failure.signal;
}

function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withFailureContext(message: string, failure: VerifyFailureExplanationCase): string {
  const normalized = message.trim();
  const signalLabel = displaySignalLabel(failure);
  const signalPattern = new RegExp(`\\b${escapeForRegex(signalLabel)}\\b`, 'i');
  const tickPattern = new RegExp(`\\bt${failure.tick}\\b`, 'i');
  const hasSignal = signalPattern.test(normalized);
  const hasTick = tickPattern.test(normalized);

  if (hasSignal && hasTick) {
    return normalized;
  }

  if (hasSignal) {
    return `At t${failure.tick}, ${normalized}`;
  }

  if (hasTick) {
    return `For ${signalLabel}, ${normalized}`;
  }

  return `For ${signalLabel} at t${failure.tick}, ${normalized}`;
}

function buildLikelyReasonText(input: {
  failure: VerifyFailureExplanationCase;
  classification: VerifyFailureClassification | null;
  reasonCode: string | null;
}): string {
  const { failure, classification, reasonCode } = input;
  const signalLabel = displaySignalLabel(failure);
  const observed = displayObservedValue(failure.actual);

  if (reasonCode === 'missing-output-node') {
    return `${signalLabel} has no mapped output node at t${failure.tick}, so Verify cannot sample a real circuit value.`;
  }

  if (reasonCode === 'missing-output-sample') {
    return `${signalLabel} has no sampled value at t${failure.tick}. This usually means the output is floating or undriven.`;
  }

  if (classification?.reason === 'undefined-output') {
    return `${signalLabel} is undefined (X) at t${failure.tick}: expected ${failure.expected}, observed ${observed}.`;
  }

  if (classification?.reason === 'floating-output') {
    return `${signalLabel} is floating at t${failure.tick}: expected ${failure.expected}, observed ${observed}.`;
  }

  if (classification?.reason === 'timing-mismatch') {
    return `${signalLabel} mismatched at t${failure.tick}: expected ${failure.expected}, observed ${observed}. Clock or sample timing likely differs.`;
  }

  if (classification?.message) {
    return `${signalLabel} mismatched at t${failure.tick}: ${classification.message}.`;
  }

  return `${signalLabel} mismatched at t${failure.tick}: expected ${failure.expected}, observed ${observed}.`;
}

function buildNextStepText(input: {
  failure: VerifyFailureExplanationCase;
  classification: VerifyFailureClassification | null;
  reasonCode: string | null;
  patternNextInspect: string | null;
}): string {
  const { failure, classification, reasonCode, patternNextInspect } = input;
  const signalLabel = displaySignalLabel(failure);

  if (reasonCode === 'missing-output-node') {
    return `In Build or Mapping, connect ${signalLabel} to a real output node, then rerun Verify.`;
  }

  if (reasonCode === 'missing-output-sample' || classification?.reason === 'floating-output') {
    return `In Build, trace the wire feeding ${signalLabel} and confirm a gate output actively drives it at t${failure.tick}.`;
  }

  if (classification?.reason === 'undefined-output') {
    return `Inspect upstream inputs to ${signalLabel} for unknown or floating states, then rerun Verify at t${failure.tick}.`;
  }

  if (classification?.reason === 'timing-mismatch') {
    return withFailureContext(
      patternNextInspect ??
        `Inspect clock, reset, and enable alignment around t${failure.tick}, then compare expected vs sampled edge timing.`,
      failure
    );
  }

  return withFailureContext(
    patternNextInspect ??
      `In Build, trace the gate path driving ${signalLabel} at t${failure.tick} under the shown input snapshot.`,
    failure
  );
}

export const VerifyFailureExplanationPanel: React.FC<VerifyFailureExplanationPanelProps> = ({
  failure,
  classification,
  reasonCode = null,
  peers = [],
  inputSnapshot,
  patternSummary,
  patternNextInspect = null,
  onSelectPeer,
  onJumpToFix,
  onOpenInDesign,
}) => {
  const likelyReasonText = failure
    ? buildLikelyReasonText({
        failure,
        classification,
        reasonCode,
      })
    : '';

  const nextStepText = failure
    ? buildNextStepText({
        failure,
        classification,
        reasonCode,
        patternNextInspect,
      })
    : '';

  return (
    <section
      className="ide-verify-failure-explanation-panel"
      data-testid="ide-verify-failure-explanation-panel"
    >
      <header className="ide-design-subheader ide-verify-three-panel-header">
        <h3>Failure details</h3>
        <span className="ide-copy">{failure ? `t${failure.tick}` : 'No selection'}</span>
      </header>

      <div
        className="ide-verify-failure-explainer-scroll"
        data-testid="ide-verify-failure-explainer"
      >
        {!failure ? (
          <p className="ide-copy">Select a failing row to inspect expected vs actual output.</p>
        ) : (
          <div className="ide-kv-list">
            <p className="ide-verify-right-summary-text" data-testid="ide-verify-right-summary">
              At t{failure.tick}, {displaySignalLabel(failure)} expected {failure.expected} but observed {displayObservedValue(failure.actual)}
            </p>
            {onJumpToFix || onOpenInDesign ? (
              <div className="ide-inline-actions">
                {onJumpToFix ? (
                  <IdeButton
                    tone="primary"
                    onClick={() => onJumpToFix(failure)}
                    testId="ide-verify-right-fix-action"
                  >
                    Review expected value
                  </IdeButton>
                ) : null}
                {onOpenInDesign ? (
                  <IdeButton
                    tone="secondary"
                    onClick={() => onOpenInDesign(failure)}
                    testId="ide-verify-right-open-design"
                  >
                    Open in Design
                  </IdeButton>
                ) : null}
              </div>
            ) : null}
            <div className="ide-kv-row">
              <span>Signal</span>
              <code data-testid="ide-verify-right-signal-key">{displaySignalLabel(failure)}</code>
            </div>
            <div className="ide-kv-row">
              <span>Expected</span>
              <code data-testid="ide-verify-right-expected">{failure.expected}</code>
            </div>
            <div className="ide-kv-row">
              <span>Observed</span>
              <code data-testid="ide-verify-right-actual">{failure.actual}</code>
            </div>
            <div className="ide-kv-row">
              <span>Tick</span>
              <code data-testid="ide-verify-right-tick">t{failure.tick}</code>
            </div>
            <div className="ide-kv-row">
              <span>Likely reason</span>
              <span data-testid="ide-verify-right-likely-reason">
                {likelyReasonText}
              </span>
            </div>
            <div className="ide-kv-row">
              <span>Next step</span>
              <span data-testid="ide-verify-right-next-step">
                {nextStepText}
              </span>
            </div>

            {patternSummary ? (
              <div className="ide-kv-row">
                <span>Pattern</span>
                <span>{patternSummary}</span>
              </div>
            ) : null}

            {inputSnapshot && inputSnapshot.length > 0 ? (
              <details
                className="ide-kv-row ide-kv-row--full ide-verify-right-detail-group"
                data-testid="ide-verify-failure-input-snapshot"
              >
                <summary>Inputs at t{failure.tick}</summary>
                <table
                  className="ide-verify-failure-input-table"
                  data-testid="ide-verify-failure-input-table"
                >
                  <thead>
                    <tr>
                      <th>Signal</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputSnapshot.map((entry) => (
                      <tr key={`${entry.label}-${entry.value}`}>
                        <td><code>{entry.label}</code></td>
                        <td><code>{entry.value}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : null}

            {peers.length > 0 ? (
              <details className="ide-kv-row ide-verify-right-detail-group" data-testid="ide-verify-right-peer-list">
                <summary>Also failing at t{failure.tick}</summary>
                <div className="ide-inline-actions">
                  {peers.map((peer) => (
                    <button
                      key={`${peer.tick}-${peer.signal}`}
                      type="button"
                      className="ide-verify-mismatch-fix-btn"
                      onClick={() => onSelectPeer?.(peer)}
                    >
                      <code>{peer.signalLabel ?? peer.signal}</code> t{peer.tick}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};
