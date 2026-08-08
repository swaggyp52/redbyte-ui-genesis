import React, { useMemo, useState } from 'react';
import type {
  VerifyAuthorVector,
  VerifyVectorDraftInput,
} from '../ScenarioBuilderPanel';
import type { StimulusCaseEvidenceState } from '../../components/StimulusCanvas';

type ComposerLens = 'scenario' | 'checks';

export interface ScenarioComposerWorkbenchProps {
  readonly scenarioName: string;
  readonly vectors: readonly VerifyAuthorVector[];
  readonly inputFields: readonly VerifyVectorDraftInput[];
  readonly outputFields: readonly VerifyVectorDraftInput[];
  readonly selectedTick: number | null;
  readonly lens: ComposerLens;
  readonly onSelectTick: (tick: number) => void;
  readonly onVectorsChange?: (vectors: VerifyAuthorVector[]) => void;
  readonly caseEvidenceByTick?: Readonly<Record<number, StimulusCaseEvidenceState>>;
  readonly observedValuesByTick?: Readonly<Record<number, Readonly<Record<string, string>>>>;
}

function nextEventId(vectors: readonly VerifyAuthorVector[]): string {
  const occupied = new Set(vectors.map((vector) => vector.id));
  let index = vectors.length + 1;
  while (occupied.has(`event-${String(index).padStart(2, '0')}`)) index += 1;
  return `event-${String(index).padStart(2, '0')}`;
}

function statusLabel(state: StimulusCaseEvidenceState | undefined): string {
  if (state === 'pass') return 'Pass';
  if (state === 'fail') return 'Fail';
  if (state === 'stale') return 'Stale';
  if (state === 'observed') return 'Observed';
  return 'Not evaluated';
}

function previousVector(
  vectors: readonly VerifyAuthorVector[],
  selected: VerifyAuthorVector
): VerifyAuthorVector | null {
  const index = vectors.findIndex((vector) => vector.id === selected.id);
  return index > 0 ? vectors[index - 1] ?? null : null;
}

export const ScenarioComposerWorkbench: React.FC<ScenarioComposerWorkbenchProps> = ({
  scenarioName,
  vectors,
  inputFields,
  outputFields,
  selectedTick,
  lens,
  onSelectTick,
  onVectorsChange,
  caseEvidenceByTick,
  observedValuesByTick,
}) => {
  const orderedVectors = useMemo(
    () => [...vectors].sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id)),
    [vectors]
  );
  const selectedVector =
    orderedVectors.find((vector) => vector.tick === selectedTick) ?? orderedVectors[0] ?? null;
  const [timeError, setTimeError] = useState<string | null>(null);
  const editable = Boolean(onVectorsChange);

  const commitVector = (id: string, patch: Partial<VerifyAuthorVector>) => {
    if (!onVectorsChange) return;
    onVectorsChange(
      orderedVectors
        .map((vector) => (vector.id === id ? { ...vector, ...patch } : vector))
        .sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id))
    );
  };

  const addEvent = () => {
    if (!onVectorsChange) return;
    const last = orderedVectors.at(-1);
    const tick = last ? last.tick + 1 : 0;
    const inputs = Object.fromEntries(
      inputFields.map((field) => [field.id, last?.inputs[field.id] === 1 ? 1 : 0])
    ) as Record<string, 0 | 1>;
    const next = { id: nextEventId(orderedVectors), tick, inputs, expected: {} };
    onVectorsChange([...orderedVectors, next]);
    onSelectTick(tick);
    setTimeError(null);
  };

  const duplicateEvent = () => {
    if (!onVectorsChange || !selectedVector) return;
    const tick = (orderedVectors.at(-1)?.tick ?? -1) + 1;
    const next = {
      ...selectedVector,
      id: nextEventId(orderedVectors),
      tick,
      inputs: { ...selectedVector.inputs },
      expected: { ...selectedVector.expected },
    };
    onVectorsChange([...orderedVectors, next]);
    onSelectTick(tick);
  };

  const deleteEvent = () => {
    if (!onVectorsChange || !selectedVector || orderedVectors.length <= 1) return;
    const next = orderedVectors.filter((vector) => vector.id !== selectedVector.id);
    onVectorsChange(next);
    onSelectTick(next[Math.max(0, orderedVectors.indexOf(selectedVector) - 1)]?.tick ?? next[0]?.tick ?? 0);
  };

  const updateTick = (nextTick: number) => {
    if (!selectedVector) return;
    const normalizedTick = Math.max(0, Math.floor(nextTick));
    if (orderedVectors.some((vector) => vector.id !== selectedVector.id && vector.tick === normalizedTick)) {
      setTimeError(`t${normalizedTick} already contains an event.`);
      return;
    }
    commitVector(selectedVector.id, { tick: normalizedTick });
    onSelectTick(normalizedTick);
    setTimeError(null);
  };

  const updateInput = (fieldId: string, value: 0 | 1) => {
    if (!selectedVector) return;
    commitVector(selectedVector.id, { inputs: { ...selectedVector.inputs, [fieldId]: value } });
  };

  const cycleCheck = (fieldId: string) => {
    if (!selectedVector) return;
    const current = selectedVector.expected[fieldId];
    const expected = { ...selectedVector.expected };
    if (current == null) expected[fieldId] = 0;
    else if (current === 0) expected[fieldId] = 1;
    else delete expected[fieldId];
    commitVector(selectedVector.id, { expected });
  };

  const previous = selectedVector ? previousVector(orderedVectors, selectedVector) : null;
  const changedInputs = selectedVector
    ? inputFields.filter(
        (field) => (selectedVector.inputs[field.id] ?? 0) !== (previous?.inputs[field.id] ?? 0)
      )
    : [];
  const eventState = selectedVector ? caseEvidenceByTick?.[selectedVector.tick] : undefined;

  return (
    <section
      className="ide-scenario-composer"
      data-testid="ide-scenario-composer"
      data-lens={lens}
      onKeyDown={(event) => {
        if (event.key === 'Delete' && event.target === event.currentTarget) deleteEvent();
      }}
      tabIndex={0}
    >
      <header className="ide-scenario-composer__header">
        <div>
          <span>Scenario timeline</span>
          <h3>{scenarioName}</h3>
          <p>Place stimulus events in time, then add only the output checks your lab requires.</p>
        </div>
        <button type="button" onClick={addEvent} disabled={!editable} data-testid="ide-scenario-composer-add-event">
          + Add event
        </button>
      </header>

      <div className="ide-scenario-event-rail" role="list" aria-label="Scenario events">
        {orderedVectors.map((vector, index) => {
          const evidence = caseEvidenceByTick?.[vector.tick];
          const checkCount = Object.keys(vector.expected ?? {}).length;
          return (
            <button
              key={vector.id}
              type="button"
              role="listitem"
              className={vector.id === selectedVector?.id ? 'is-selected' : ''}
              data-state={evidence ?? 'not-run'}
              data-testid={`ide-scenario-event-${vector.id}`}
              onClick={() => onSelectTick(vector.tick)}
            >
              <span>Event {index + 1}</span>
              <strong>t{vector.tick}</strong>
              <small>{checkCount > 0 ? `${checkCount} check${checkCount === 1 ? '' : 's'}` : 'No checks'}</small>
            </button>
          );
        })}
      </div>

      {selectedVector ? (
        <div className="ide-scenario-event-editor" data-testid="ide-scenario-event-editor">
          <div className="ide-scenario-event-editor__identity">
            <label>
              <span>Event time</span>
              <span className="ide-scenario-time-field">
                <b>t</b>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={selectedVector.tick}
                  disabled={!editable}
                  onChange={(event) => updateTick(Number(event.target.value))}
                  data-testid="ide-scenario-event-time"
                />
              </span>
            </label>
            <div>
              <span>Event status</span>
              <strong data-state={eventState ?? 'not-run'}>{statusLabel(eventState)}</strong>
            </div>
            <div>
              <span>Changed here</span>
              <strong>{changedInputs.length > 0 ? changedInputs.map((field) => field.label).join(', ') : 'No input changes'}</strong>
            </div>
          </div>
          {timeError ? <p className="ide-scenario-time-error" role="alert">{timeError}</p> : null}

          {lens === 'scenario' ? (
            <section className="ide-scenario-signal-editor" aria-label="Input stimulus">
              <header><span>Drive inputs</span><small>Changes are applied together at t{selectedVector.tick}.</small></header>
              <div>
                {inputFields.map((field) => {
                  const value = selectedVector.inputs[field.id] === 1 ? 1 : 0;
                  return (
                    <button
                      key={field.id}
                      type="button"
                      className={value ? 'is-high' : 'is-low'}
                      aria-pressed={value === 1}
                      disabled={!editable}
                      onClick={() => updateInput(field.id, value === 1 ? 0 : 1)}
                      data-testid={`ide-scenario-input-${field.id}`}
                    >
                      <span>{field.label}</span><strong>{value}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="ide-scenario-stimulus-snapshot" data-testid="ide-scenario-stimulus-snapshot">
              <span>Stimulus at t{selectedVector.tick}</span>
              <div>{inputFields.map((field) => <code key={field.id}>{field.label}={selectedVector.inputs[field.id] === 1 ? 1 : 0}</code>)}</div>
            </div>
          )}

          {lens === 'checks' ? (
            <section className="ide-scenario-signal-editor ide-scenario-signal-editor--checks" aria-label="Expected output checks">
              <header><span>Expected outputs</span><small>Unset outputs are observed but not graded.</small></header>
              <div>
                {outputFields.map((field) => {
                  const expected = selectedVector.expected[field.id];
                  const observed = observedValuesByTick?.[selectedVector.tick]?.[field.id];
                  return (
                    <button
                      key={field.id}
                      type="button"
                      className={expected == null ? 'is-unset' : expected === 1 ? 'is-high' : 'is-low'}
                      disabled={!editable}
                      onClick={() => cycleCheck(field.id)}
                      data-testid={`ide-scenario-check-${field.id}`}
                    >
                      <span>{field.label}</span>
                      <strong>{expected == null ? 'Unset' : expected}</strong>
                      <small>{observed == null ? 'Not observed' : `Observed ${observed}`}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <footer>
            <button type="button" onClick={duplicateEvent} disabled={!editable} data-testid="ide-scenario-duplicate-event">Duplicate event</button>
            <button type="button" className="is-danger" onClick={deleteEvent} disabled={!editable || orderedVectors.length <= 1} data-testid="ide-scenario-delete-event">Delete event</button>
          </footer>
        </div>
      ) : (
        <div className="ide-scenario-composer__empty">
          <strong>No events yet</strong>
          <p>Add the first event to define the circuit inputs at t0.</p>
          <button type="button" onClick={addEvent} disabled={!editable}>Add first event</button>
        </div>
      )}
    </section>
  );
};

export interface ScenarioTestbenchPreviewProps {
  readonly scenarioName: string;
  readonly source?: string;
}

export const ScenarioTestbenchPreview: React.FC<ScenarioTestbenchPreviewProps> = ({
  scenarioName,
  source,
}) => {
  const lines = (source?.trim() || '-- Add scenario events to generate testbench.vhd.').split('\n');
  return (
    <section className="ide-scenario-testbench-preview" data-testid="ide-scenario-testbench-preview">
      <header>
        <div><span>Generated simulation source</span><h3>testbench.vhd</h3></div>
        <div><strong>{scenarioName}</strong><small>Same source packaged by Build & Export</small></div>
      </header>
      <div className="ide-scenario-testbench-code" role="region" aria-label="Generated VHDL testbench">
        {lines.map((line, index) => (
          <div key={index}><span>{index + 1}</span><code>{line || ' '}</code></div>
        ))}
      </div>
    </section>
  );
};
