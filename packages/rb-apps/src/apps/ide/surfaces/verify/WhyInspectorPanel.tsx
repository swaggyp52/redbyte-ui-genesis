// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import React from 'react';
import type { SignalExplanation } from './signalExplainer';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhyInspectorPanelProps {
  readonly explanation: SignalExplanation | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  input: 'Input',
  combinational: 'Combinational',
  sequential: 'Sequential',
  unchanged: 'Unchanged',
  partial: 'Partial',
};

function kindBadgeClass(kind: string): string {
  switch (kind) {
    case 'sequential': return 'ide-why-badge--sequential';
    case 'combinational': return 'ide-why-badge--combinational';
    case 'input': return 'ide-why-badge--input';
    case 'partial': return 'ide-why-badge--partial';
    default: return 'ide-why-badge--unchanged';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const WhyInspectorPanel: React.FC<WhyInspectorPanelProps> = ({ explanation }) => {
  if (!explanation) {
    return (
      <section
        className="ide-why-panel ide-why-panel--empty"
        data-testid="ide-why-panel-empty"
      >
        <p className="ide-why-empty-message">
          Click a row or tick in the chart below, or pick a signal from the list on the left, to see a step-by-step reason for that value.
        </p>
      </section>
    );
  }

  const {
    selectedSignal,
    tick,
    currentValue,
    previousValue,
    changed,
    explanationKind,
    summary,
    steps,
    relevantClockEdge,
    relevantPriorState,
  } = explanation;

  return (
    <section
      className="ide-why-panel"
      data-testid="ide-why-panel"
    >
      {/* Header */}
      <div className="ide-why-header" data-testid="ide-why-header">
        <span className="ide-why-signal-name">
          <code>{selectedSignal}</code>
        </span>
        <span className="ide-why-tick">tick {tick}</span>
        <span className={`ide-why-badge ${kindBadgeClass(explanationKind)}`}>
          {KIND_LABELS[explanationKind] ?? explanationKind}
        </span>
      </div>

      {/* Value display */}
      <div className="ide-why-value-row" data-testid="ide-why-value">
        <span className="ide-why-value-current">
          <code className="ide-why-value-code">{currentValue}</code>
        </span>
        {changed && previousValue !== null && (
          <span className="ide-why-value-change">
            changed from <code>{previousValue}</code>
          </span>
        )}
        {!changed && (
          <span className="ide-why-value-held">unchanged</span>
        )}
      </div>

      {/* Summary */}
      <p className="ide-why-summary" data-testid="ide-why-summary">
        {summary}
      </p>

      {/* Clock edge info for sequential */}
      {relevantClockEdge && (
        <div className="ide-why-clock-edge" data-testid="ide-why-clock-edge">
          <span className="ide-why-clock-icon">⏱</span>
          <span>
            {relevantClockEdge.edgeDirection} edge on{' '}
            <code>{relevantClockEdge.clockSignal}</code> at tick{' '}
            {relevantClockEdge.edgeTick}
          </span>
        </div>
      )}

      {/* Prior state for sequential */}
      {relevantPriorState && (
        <div className="ide-why-prior-state" data-testid="ide-why-prior-state">
          <span>Prior state: <code>{relevantPriorState.signal}</code> was{' '}
            <code>{relevantPriorState.value}</code> at tick {relevantPriorState.tick}
          </span>
        </div>
      )}

      {/* Causal chain */}
      <ol className="ide-why-steps" data-testid="ide-why-steps">
        {steps.map((step, index) => (
          <li key={index} className="ide-why-step">
            {step.description}
          </li>
        ))}
      </ol>
    </section>
  );
};
