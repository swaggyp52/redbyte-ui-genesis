// Copyright (c) 2025 Connor Angiel - RedByte
// Hardware surface primitives: mapping header and 3-step mapping guide.
// Presentational only. Wiring lives in HardwareSurface.tsx.

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// HardwareMappingHeader
// Slim strip at the top of Map Pins that answers: which board, how many
// required signals are mapped, what is the state, and what to do next.
// ─────────────────────────────────────────────────────────────────────────────

export type HardwareMappingState = 'design-first' | 'incomplete' | 'complete' | 'conflict';

export interface HardwareMappingHeaderProps {
  readonly board: string;
  readonly mappedCount: number;
  readonly requiredCount: number;
  readonly state: HardwareMappingState;
  /** One-line next-action hint shown on the right. */
  readonly nextActionHint?: string;
}

const STATE_LABEL: Record<HardwareMappingState, string> = {
  'design-first': 'Design first',
  incomplete: 'Incomplete',
  complete: 'Complete',
  conflict: 'Conflict',
};

const STATE_TONE_CLASS: Record<HardwareMappingState, string> = {
  'design-first': 'is-idle',
  incomplete: 'is-warn',
  complete: 'is-ok',
  conflict: 'is-error',
};

export const HardwareMappingHeader: React.FC<HardwareMappingHeaderProps> = ({
  board,
  mappedCount,
  requiredCount,
  state,
  nextActionHint,
}) => {
  const countLabel =
    state === 'design-first'
      ? 'No signals yet'
      : state === 'complete'
        ? `All ${requiredCount} required mapped`
        : `${mappedCount} / ${requiredCount} required mapped`;

  return (
    <header
      className="ide-hw-mapping-header"
      data-testid="ide-hw-mapping-header"
    >
      <div className="ide-hw-mapping-header-identity">
        <span className="ide-hw-mapping-header-board" data-testid="ide-hw-mapping-header-board">
          {board}
        </span>
        <span className="ide-hw-mapping-header-sep" aria-hidden="true">/</span>
        <span className="ide-hw-mapping-header-count" data-testid="ide-hw-mapping-header-count">
          {countLabel}
        </span>
      </div>
      <div className="ide-hw-mapping-header-meta">
        <span
          className={`ide-hw-mapping-header-state ${STATE_TONE_CLASS[state]}`}
          data-testid="ide-hw-mapping-header-state"
          data-state={state}
        >
          <span className="ide-hw-mapping-header-state-dot" aria-hidden="true" />
          {STATE_LABEL[state]}
        </span>
        {nextActionHint ? (
          <span
            className="ide-hw-mapping-header-hint"
            data-testid="ide-hw-mapping-header-hint"
          >
            {nextActionHint}
          </span>
        ) : null}
      </div>
    </header>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HardwareMappingGuide
// A real 3-step visual guide that replaces the basic loop card.
// Steps:
//   1. Select project signal
//   2. Choose board control
//   3. Confirm binding
//
// Each step shows its completion state and current value.
// Active step is visually prominent.
// ─────────────────────────────────────────────────────────────────────────────

export type MappingGuideStep = 1 | 2 | 3;

export interface HardwareMappingGuideProps {
  /** Active step: 1 = no signal selected, 2 = signal selected, 3 = board control chosen. */
  readonly activeStep: MappingGuideStep;
  /** Current selected signal label (shown in step 1 slot when selected). */
  readonly signalLabel?: string | null;
  /** Current board control label (shown in step 2 slot when chosen). */
  readonly boardControlLabel?: string | null;
  /** Current package pin (shown in step 3 slot when confirmed). */
  readonly packagePin?: string | null;
}

interface StepConfig {
  num: MappingGuideStep;
  label: string;
  helper: string;
  valuePlaceholder: string;
}

const STEPS: readonly StepConfig[] = [
  {
    num: 1,
    label: 'Select project signal',
    helper: 'Click a row in the signal list below.',
    valuePlaceholder: 'Select a signal row',
  },
  {
    num: 2,
    label: 'Choose board control',
    helper: 'Click a valid control on the Basys3 board diagram.',
    valuePlaceholder: '—',
  },
  {
    num: 3,
    label: 'Confirm binding',
    helper: 'Package pin is set. Binding is saved automatically.',
    valuePlaceholder: '—',
  },
];

export const HardwareMappingGuide: React.FC<HardwareMappingGuideProps> = ({
  activeStep,
  signalLabel,
  boardControlLabel,
  packagePin,
}) => {
  const stepValues: Record<MappingGuideStep, string | null | undefined> = {
    1: signalLabel,
    2: boardControlLabel,
    3: packagePin,
  };

  return (
    <div className="ide-hw-mapping-guide" data-testid="ide-hw-mapping-guide">
      {STEPS.map((step) => {
        const isDone = step.num < activeStep;
        const isActive = step.num === activeStep;
        const value = stepValues[step.num];
        const displayValue = value?.trim() ? value.trim() : null;

        return (
          <div
            key={step.num}
            className={`ide-hw-guide-step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
            data-testid={`ide-hw-guide-step-${step.num}`}
            data-active={isActive ? 'true' : 'false'}
            data-done={isDone ? 'true' : 'false'}
          >
            <div className="ide-hw-guide-step-num" aria-hidden="true">
              {isDone ? '✓' : step.num}
            </div>
            <div className="ide-hw-guide-step-body">
              <span className="ide-hw-guide-step-label">{step.label}</span>
              {isActive ? (
                <span className="ide-hw-guide-step-helper">{step.helper}</span>
              ) : null}
              <span
                className={`ide-hw-guide-step-value${displayValue ? ' has-value' : ''}`}
                data-testid={`ide-hw-guide-step-value-${step.num}`}
              >
                {displayValue ?? step.valuePlaceholder}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
