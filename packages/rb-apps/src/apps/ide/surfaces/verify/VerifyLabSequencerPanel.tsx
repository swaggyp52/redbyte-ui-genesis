import React from 'react';
import { IdeButton } from '../../components/IdePrimitives';
import type { LabSequencerStep } from '../../verifyLabSequencer';
import type { VerifyScenarioStepKind } from '../../verifyScenarioSteps';
import type { VerifyScenarioStep } from '../../verifyScenarioSteps';

interface VerifyLabSequencerPanelProps {
  modeLabel: string;
  scenarioName: string;
  stepCount: number;
  selectedTick: number | null;
  steps: LabSequencerStep[];
  stateObservationLabel: string;
  onSelectStepTick: (tick: number) => void;
  onQuickAddStep?: (kind: VerifyScenarioStepKind) => void;
  stateDetails?: Array<{ signal: string; value: string; category: 'register' | 'state_bank' }>;
  editableSteps: VerifyScenarioStep[];
  onUpdateStep?: (
    stepId: string,
    patch: Partial<Omit<VerifyScenarioStep, 'id' | 'order' | 'origin'>>
  ) => void;
  onMoveStep?: (stepId: string, direction: 'up' | 'down') => void;
  onDeleteStep?: (stepId: string) => void;
}

export const VerifyLabSequencerPanel: React.FC<VerifyLabSequencerPanelProps> = ({
  modeLabel,
  scenarioName,
  stepCount,
  selectedTick,
  steps,
  stateObservationLabel,
  onSelectStepTick,
  onQuickAddStep,
  stateDetails = [],
  editableSteps,
  onUpdateStep,
  onMoveStep,
  onDeleteStep,
}) => {
  return (
    <section className="ide-verify-lab-sequencer" data-testid="ide-verify-lab-sequencer">
      <header className="ide-verify-lab-sequencer-header">
        <div>
          <h3>Lab sequencer</h3>
          <p className="ide-copy" data-testid="ide-verify-lab-sequencer-mode">
            {modeLabel}
          </p>
        </div>
        <div className="ide-verify-lab-sequencer-meta">
          <span className="ide-verify-lab-chip" data-testid="ide-verify-lab-scenario-name">
            {scenarioName}
          </span>
          <span className="ide-verify-lab-chip" data-testid="ide-verify-lab-step-count">
            {stepCount} step{stepCount === 1 ? '' : 's'}
          </span>
          <span
            className={`ide-verify-lab-chip ide-verify-lab-chip--selected-tick${selectedTick == null ? '' : ' is-selected'}`}
            data-testid="ide-verify-lab-selected-tick"
          >
            {selectedTick == null ? 'No tick selected' : `t${selectedTick}`}
          </span>
        </div>
      </header>
      <div className="ide-verify-lab-authoring-strip" data-testid="ide-verify-lab-authoring-strip">
        <IdeButton
          tone="ghost"
          onClick={() => onQuickAddStep?.('set_bus')}
          testId="ide-verify-lab-action-set-bus"
        >
          Set bus/slice
        </IdeButton>
        <IdeButton
          tone="ghost"
          onClick={() => onQuickAddStep?.('apply_reset')}
          testId="ide-verify-lab-action-reset"
        >
          Apply reset
        </IdeButton>
        <IdeButton
          tone="ghost"
          onClick={() => onQuickAddStep?.('pulse_step')}
          testId="ide-verify-lab-action-pulse"
        >
          Pulse step
        </IdeButton>
        <IdeButton
          tone="ghost"
          onClick={() => onQuickAddStep?.('assert_scalar')}
          testId="ide-verify-lab-action-assert"
        >
          Assert output/state
        </IdeButton>
      </div>
      <div className="ide-verify-lab-sequencer-body">
        <div className="ide-verify-lab-step-editor" data-testid="ide-verify-lab-step-editor">
          <strong>Step editor</strong>
          {editableSteps.map((step, index) => (
            <div key={step.id} className="ide-verify-lab-step-editor-row">
              <select
                data-testid={`ide-verify-lab-step-kind-${step.id}`}
                aria-label={`Step kind ${index + 1}`}
                value={step.kind}
                onChange={(event) =>
                  onUpdateStep?.(step.id, { kind: event.target.value as VerifyScenarioStepKind })
                }
              >
                {STEP_KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                data-testid={`ide-verify-lab-step-target-${step.id}`}
                value={step.targetRef ?? ''}
                placeholder="target"
                onChange={(event) => onUpdateStep?.(step.id, { targetRef: event.target.value })}
              />
              <input
                data-testid={`ide-verify-lab-step-value-${step.id}`}
                value={formatStepBitField(step.value)}
                placeholder="value"
                onChange={(event) =>
                  onUpdateStep?.(step.id, { value: parseStepBitField(event.target.value) })
                }
              />
              <input
                data-testid={`ide-verify-lab-step-expected-${step.id}`}
                value={formatStepBitField(step.expectedValue)}
                placeholder="expected"
                onChange={(event) =>
                  onUpdateStep?.(step.id, { expectedValue: parseStepBitField(event.target.value) })
                }
              />
              <input
                data-testid={`ide-verify-lab-step-label-${step.id}`}
                value={step.label ?? ''}
                placeholder="label"
                onChange={(event) => onUpdateStep?.(step.id, { label: event.target.value })}
              />
              <input
                data-testid={`ide-verify-lab-step-duration-${step.id}`}
                value={String(step.durationTicks ?? 1)}
                placeholder="duration"
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  onUpdateStep?.(step.id, {
                    durationTicks: Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1,
                  });
                }}
              />
              <select
                data-testid={`ide-verify-lab-step-pulse-${step.id}`}
                aria-label={`Step pulse ${index + 1}`}
                value={step.pulseBehavior ?? ''}
                onChange={(event) =>
                  onUpdateStep?.(step.id, {
                    pulseBehavior:
                      event.target.value === ''
                        ? undefined
                        : (event.target.value as VerifyScenarioStep['pulseBehavior']),
                  })
                }
              >
                <option value="">pulse n/a</option>
                <option value="rising">rising</option>
                <option value="falling">falling</option>
                <option value="high">high</option>
                <option value="low">low</option>
              </select>
              <div className="ide-verify-lab-step-editor-actions">
                <IdeButton
                  tone="ghost"
                  onClick={() => onMoveStep?.(step.id, 'up')}
                  testId={`ide-verify-lab-step-up-${step.id}`}
                >
                  ↑
                </IdeButton>
                <IdeButton
                  tone="ghost"
                  onClick={() => onMoveStep?.(step.id, 'down')}
                  testId={`ide-verify-lab-step-down-${step.id}`}
                >
                  ↓
                </IdeButton>
                <IdeButton
                  tone="ghost"
                  onClick={() => onDeleteStep?.(step.id)}
                  testId={`ide-verify-lab-step-delete-${step.id}`}
                >
                  Delete
                </IdeButton>
              </div>
              <span className="ide-status-mono" data-testid={`ide-verify-lab-step-order-${step.id}`}>
                #{index + 1}
              </span>
            </div>
          ))}
        </div>
        <ol className="ide-verify-lab-step-list" data-testid="ide-verify-lab-step-list">
          {steps.length === 0 ? (
            <li className="ide-copy">No explicit lab steps yet. Add vectors in the workbench below.</li>
          ) : (
            steps.map((step) => (
              <li
                key={step.id}
                className={`ide-verify-lab-step-item${selectedTick === step.tick ? ' is-selected' : ''}`}
                data-testid={`ide-verify-lab-step-item-${step.id}`}
              >
                <div>
                  <span className={`ide-verify-lab-step-kind ide-verify-lab-step-kind--${step.kind}`}>
                    {step.kind.replaceAll('_', ' ')}
                  </span>
                  <div className="ide-verify-lab-step-title">{step.title}</div>
                  <div className="ide-copy">{step.detail}</div>
                </div>
                <IdeButton
                  tone="ghost"
                  onClick={() => onSelectStepTick(step.tick)}
                  testId={`ide-verify-lab-step-${step.id}`}
                >
                  {selectedTick === step.tick ? `Selected t${step.tick}` : `Open t${step.tick}`}
                </IdeButton>
              </li>
            ))
          )}
        </ol>
        <div className="ide-verify-lab-state-summary" data-testid="ide-verify-lab-state-summary">
          <strong>State observation</strong>
          <p className="ide-copy">{stateObservationLabel}</p>
          {stateDetails.length > 0 ? (
            <ul className="ide-verify-lab-state-detail-list" data-testid="ide-verify-lab-state-detail-list">
              {stateDetails.map((entry) => (
                <li key={`${entry.category}:${entry.signal}`} className="ide-verify-lab-state-card">
                  <span className="ide-verify-lab-state-kind">{entry.category.replaceAll('_', ' ')}</span>
                  <strong>{entry.signal}</strong>
                  <span className="ide-status-mono">{entry.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ide-copy" data-testid="ide-verify-lab-state-detail-empty">
              No register/state-bank samples at this tick yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

const STEP_KIND_OPTIONS: VerifyScenarioStepKind[] = [
  'set_input',
  'set_bit',
  'set_slice',
  'set_bus',
  'apply_reset',
  'pulse_step',
  'observe',
  'assert_scalar',
  'assert_bus',
  'inspect_register',
  'inspect_state_bank',
];

function formatStepBitField(
  value: VerifyScenarioStep['value'] | VerifyScenarioStep['expectedValue']
): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function parseStepBitField(
  raw: string
): VerifyScenarioStep['value'] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed === '0' || trimmed === '1') return Number(trimmed) as 0 | 1;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, number>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const result: Record<string, 0 | 1> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = Number(value) === 1 ? 1 : 0;
    }
    return result;
  } catch {
    return undefined;
  }
}
