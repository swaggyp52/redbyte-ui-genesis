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
  onAcceptObserved?: (failure: VerifyFailureExplanationCase) => void;
  onCaptureRow?: (failure: VerifyFailureExplanationCase) => void;
  onCaptureSignal?: (failure: VerifyFailureExplanationCase) => void;
  onSetExpectedBit?: (failure: VerifyFailureExplanationCase, nextValue: 0 | 1) => void;
  onClearExpected?: (failure: VerifyFailureExplanationCase) => void;
  onRerunCompare?: () => void;
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
  onAcceptObserved,
  onCaptureRow,
  onCaptureSignal,
  onSetExpectedBit,
  onClearExpected,
  onRerunCompare,
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
        <h3>Compare details</h3>
        <span className="ide-copy">{failure ? `t${failure.tick}` : 'No selection'}</span>
      </header>

      <div
        className="ide-verify-failure-explainer-scroll"
        data-testid="ide-verify-failure-explainer"
      >
        {!failure ? (
          <p className="ide-copy">Select a differing row to inspect expected vs observed output.</p>
        ) : (
          <div className="ide-kv-list">
            <p className="ide-verify-right-summary-text" data-testid="ide-verify-right-summary">
              At t{failure.tick}, {displaySignalLabel(failure)} expected {failure.expected} but observed {displayObservedValue(failure.actual)}
            </p>
            {onAcceptObserved || onCaptureRow || onCaptureSignal || onSetExpectedBit || onClearExpected || onRerunCompare ? (
              <div className="ide-inline-actions" data-testid="ide-verify-right-capture-actions">
                {onAcceptObserved ? (
                  <IdeButton
                    tone="primary"
                    onClick={() => onAcceptObserved(failure)}
                    disabled={failure.actual !== '0' && failure.actual !== '1'}
                    testId="ide-verify-right-accept-observed"
                  >
                    Accept observed
                  </IdeButton>
                ) : null}
                {onCaptureRow ? (
                  <IdeButton
                    tone="secondary"
                    onClick={() => onCaptureRow(failure)}
                    testId="ide-verify-right-capture-row"
                  >
                    Capture row
                  </IdeButton>
                ) : null}
                {onCaptureSignal ? (
                  <IdeButton
                    tone="secondary"
                    onClick={() => onCaptureSignal(failure)}
                    testId="ide-verify-right-capture-signal"
                  >
                    Capture signal
                  </IdeButton>
                ) : null}
                {onClearExpected ? (
                  <IdeButton
                    tone="ghost"
                    onClick={() => onClearExpected(failure)}
                    testId="ide-verify-right-clear-assertion"
                  >
                    Clear assertion
                  </IdeButton>
                ) : null}
              </div>
            ) : null}
            {onSetExpectedBit || onJumpToFix || onOpenInDesign || onRerunCompare ? (
              <div className="ide-inline-actions">
                {onSetExpectedBit ? (
                  <>
                    <IdeButton
                      tone="ghost"
                      onClick={() => onSetExpectedBit(failure, 0)}
                      testId="ide-verify-right-set-expected-0"
                    >
                      Expect 0
                    </IdeButton>
                    <IdeButton
                      tone="ghost"
                      onClick={() => onSetExpectedBit(failure, 1)}
                      testId="ide-verify-right-set-expected-1"
                    >
                      Expect 1
                    </IdeButton>
                  </>
                ) : null}
                {onJumpToFix ? (
                  <IdeButton
                    tone="secondary"
                    onClick={() => onJumpToFix(failure)}
                    testId="ide-verify-right-fix-action"
                  >
                    Review in vectors
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
                {onRerunCompare ? (
                  <IdeButton
                    tone="primary"
                    onClick={onRerunCompare}
                    testId="ide-verify-right-rerun-compare"
                  >
                    Re-run compare
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
              <section
                className="ide-kv-row ide-kv-row--full ide-verify-right-detail-group"
                data-testid="ide-verify-failure-input-snapshot"
              >
                <h4>Inputs at t{failure.tick}</h4>
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
              </section>
            ) : null}

            {peers.length > 0 ? (
              <section className="ide-kv-row ide-verify-right-detail-group" data-testid="ide-verify-right-peer-list">
                <h4>Also differing at t{failure.tick}</h4>
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
              </section>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};
