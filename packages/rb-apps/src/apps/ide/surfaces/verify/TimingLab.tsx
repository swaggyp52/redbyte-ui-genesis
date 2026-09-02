import React, { useMemo, useState } from 'react';
import type {
  VerifyAuthorVector,
  VerifyVectorDraftInput,
} from '../ScenarioBuilderPanel';
import type { StimulusCaseEvidenceState } from '../../components/StimulusCanvas';

// Timing Lab — the sequential simulation instrument. Events are rows in time:
// one row per stimulus event (t), one column per driven input and per
// checked output, a status column, and a dense editor strip for the selected
// event. The table is the timeline; the strip is where an event is authored.

type TimingLens = 'scenario' | 'checks';

export interface TimingLabProps {
  readonly scenarioName: string;
  readonly vectors: readonly VerifyAuthorVector[];
  readonly inputFields: readonly VerifyVectorDraftInput[];
  readonly outputFields: readonly VerifyVectorDraftInput[];
  readonly selectedTick: number | null;
  readonly lens: TimingLens;
  readonly onSelectTick: (tick: number) => void;
  readonly onVectorsChange?: (vectors: VerifyAuthorVector[]) => void;
  readonly caseEvidenceByTick?: Readonly<Record<number, StimulusCaseEvidenceState>>;
  readonly observedValuesByTick?: Readonly<Record<number, Readonly<Record<string, string>>>>;
  /** Clock-like inputs render with a clock glyph and sit first in the timeline. */
  readonly clockFieldIds?: readonly string[];
}

function nextEventId(vectors: readonly VerifyAuthorVector[]): string {
  const occupied = new Set(vectors.map((vector) => vector.id));
  let index = vectors.length + 1;
  while (occupied.has(`event-${String(index).padStart(2, '0')}`)) index += 1;
  return `event-${String(index).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  pass: 'pass',
  fail: 'fail',
  stale: 'stale',
  observed: 'observed',
};

function statusLabel(state: StimulusCaseEvidenceState | undefined): string {
  return state ? STATUS_LABEL[state] ?? '—' : '—';
}

function previousVector(
  vectors: readonly VerifyAuthorVector[],
  selected: VerifyAuthorVector
): VerifyAuthorVector | null {
  const index = vectors.findIndex((vector) => vector.id === selected.id);
  return index > 0 ? vectors[index - 1] ?? null : null;
}

export const TimingLab: React.FC<TimingLabProps> = ({
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
  clockFieldIds,
}) => {
  const orderedVectors = useMemo(
    () => [...vectors].sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id)),
    [vectors]
  );
  const orderedInputs = useMemo(() => {
    if (!clockFieldIds || clockFieldIds.length === 0) return inputFields;
    const clocks = new Set(clockFieldIds);
    return [...inputFields].sort((a, b) => Number(clocks.has(b.id)) - Number(clocks.has(a.id)));
  }, [inputFields, clockFieldIds]);
  const clockSet = useMemo(() => new Set(clockFieldIds ?? []), [clockFieldIds]);
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
  const checkTotal = orderedVectors.reduce((n, v) => n + Object.keys(v.expected ?? {}).length, 0);

  return (
    <section
      className="rb-timing"
      data-testid="ide-scenario-composer"
      data-lens={lens}
      onKeyDown={(event) => {
        if (event.key === 'Delete' && event.target === event.currentTarget) deleteEvent();
      }}
      tabIndex={0}
      aria-label={`Timing Lab — ${scenarioName}`}
    >
      <header className="rb-timing-bar" data-testid="ide-timing-lab-bar">
        <span className="rb-timing-title">Events</span>
        <span className="rb-timing-count" data-testid="ide-timing-lab-count">
          {orderedVectors.length} event{orderedVectors.length === 1 ? '' : 's'} · {checkTotal} check{checkTotal === 1 ? '' : 's'}
        </span>
        <span className="rb-timing-spacer" />
        <button
          type="button"
          className="wb-btn wb-btn--ghost"
          onClick={addEvent}
          disabled={!editable}
          data-testid="ide-scenario-composer-add-event"
          title="Add an event one tick after the last one, carrying the current stimulus forward"
        >
          + Add event
        </button>
        <button
          type="button"
          className="wb-btn wb-btn--ghost"
          onClick={duplicateEvent}
          disabled={!editable || !selectedVector}
          data-testid="ide-scenario-duplicate-event"
        >
          Duplicate
        </button>
        <button
          type="button"
          className="wb-btn wb-btn--ghost rb-timing-danger"
          onClick={deleteEvent}
          disabled={!editable || orderedVectors.length <= 1}
          data-testid="ide-scenario-delete-event"
        >
          Delete
        </button>
      </header>

      <div className="rb-timing-scroll">
        <table className="rb-timing-table" data-testid="ide-timing-lab-table" role="list" aria-label="Scenario events">
          <thead>
            <tr className="rb-timing-grouphead">
              <th className="rb-timing-num" scope="col" rowSpan={2}>#</th>
              <th className="rb-timing-time" scope="col" rowSpan={2}>t</th>
              <th className="rb-timing-in-group" scope="colgroup" colSpan={orderedInputs.length}>Inputs</th>
              {outputFields.map((field) => (
                <th key={field.id} className="rb-timing-out" scope="colgroup" colSpan={2}>
                  {field.label}
                </th>
              ))}
              <th className="rb-timing-status" scope="col" rowSpan={2}>Status</th>
            </tr>
            <tr className="rb-timing-colhead">
              {orderedInputs.map((field) => (
                <th key={field.id} className={`rb-timing-in${clockSet.has(field.id) ? ' is-clock' : ''}`} scope="col" title={clockSet.has(field.id) ? `${field.label} (clock)` : field.label}>
                  {field.label}
                </th>
              ))}
              {outputFields.map((field) => (
                <React.Fragment key={field.id}>
                  <th className="rb-timing-exp" scope="col">exp</th>
                  <th className="rb-timing-obs" scope="col">obs</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedVectors.length === 0 ? (
              <tr>
                <td className="rb-timing-empty" colSpan={3 + orderedInputs.length + outputFields.length * 2}>
                  No events yet — add the first event to define the inputs at t0.
                </td>
              </tr>
            ) : (
              orderedVectors.map((vector, index) => {
                const evidence = caseEvidenceByTick?.[vector.tick];
                const isSelected = vector.id === selectedVector?.id;
                const prev = index > 0 ? orderedVectors[index - 1] : null;
                return (
                  <tr
                    key={vector.id}
                    role="listitem"
                    className={`rb-timing-row${isSelected ? ' is-selected' : ''} is-${evidence ?? 'not-run'}`}
                    data-state={evidence ?? 'not-run'}
                    data-testid={`ide-scenario-event-${vector.id}`}
                    aria-selected={isSelected}
                    onClick={() => onSelectTick(vector.tick)}
                  >
                    <td className="rb-timing-num">{index + 1}</td>
                    <td className="rb-timing-time"><code>t{vector.tick}</code></td>
                    {orderedInputs.map((field) => {
                      const value = vector.inputs[field.id] === 1 ? 1 : 0;
                      const changed = prev ? (prev.inputs[field.id] === 1 ? 1 : 0) !== value : false;
                      return (
                        <td key={field.id} className={`rb-timing-in${changed ? ' is-changed' : ''}${clockSet.has(field.id) ? ' is-clock' : ''}`}>
                          <code>{value}</code>
                        </td>
                      );
                    })}
                    {outputFields.map((field) => {
                      const expected = vector.expected?.[field.id];
                      const observed = observedValuesByTick?.[vector.tick]?.[field.id];
                      const mismatch = expected != null && observed != null && String(expected) !== String(observed);
                      return (
                        <React.Fragment key={field.id}>
                          <td className="rb-timing-exp"><code>{expected == null ? '·' : expected}</code></td>
                          <td className={`rb-timing-obs${mismatch ? ' is-fail' : ''}`}><code>{observed ?? '·'}</code></td>
                        </React.Fragment>
                      );
                    })}
                    <td className="rb-timing-status"><span className={`rb-timing-verdict is-${evidence ?? 'not-run'}`}>{statusLabel(evidence)}</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedVector ? (
        <div className="rb-timing-editor" data-testid="ide-scenario-event-editor">
          <label className="rb-timing-field">
            <span>Event time</span>
            <span className="rb-timing-time-input">
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
          <div className="rb-timing-field">
            <span>Status</span>
            <strong className={`rb-timing-verdict is-${eventState ?? 'not-run'}`} data-state={eventState ?? 'not-run'}>{statusLabel(eventState)}</strong>
          </div>
          <div className="rb-timing-field rb-timing-field--wide">
            <span>Changed here</span>
            <strong>{changedInputs.length > 0 ? changedInputs.map((field) => field.label).join(', ') : 'No input changes'}</strong>
          </div>
          {timeError ? <p className="rb-timing-error" role="alert">{timeError}</p> : null}

          {lens === 'scenario' ? (
            <div className="rb-timing-group" aria-label="Input stimulus">
              <span className="rb-timing-group-label">Drive inputs at t{selectedVector.tick}</span>
              <div className="rb-timing-toggles">
                {orderedInputs.map((field) => {
                  const value = selectedVector.inputs[field.id] === 1 ? 1 : 0;
                  return (
                    <button
                      key={field.id}
                      type="button"
                      className={`rb-timing-toggle${value ? ' is-high' : ' is-low'}${clockSet.has(field.id) ? ' is-clock' : ''}`}
                      aria-pressed={value === 1}
                      disabled={!editable}
                      onClick={() => updateInput(field.id, value === 1 ? 0 : 1)}
                      data-testid={`ide-scenario-input-${field.id}`}
                      title={`${field.label} — click to drive ${value === 1 ? 0 : 1}`}
                    >
                      <span>{field.label}</span>
                      <strong>{value}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rb-timing-group" data-testid="ide-scenario-stimulus-snapshot">
              <span className="rb-timing-group-label">Stimulus at t{selectedVector.tick}</span>
              <div className="rb-timing-snapshot">
                {orderedInputs.map((field) => (
                  <code key={field.id}>{field.label}={selectedVector.inputs[field.id] === 1 ? 1 : 0}</code>
                ))}
              </div>
            </div>
          )}

          {lens === 'checks' ? (
            <div className="rb-timing-group" aria-label="Expected output checks">
              <span className="rb-timing-group-label">Expected outputs — unset outputs are observed, not graded</span>
              <div className="rb-timing-toggles">
                {outputFields.map((field) => {
                  const expected = selectedVector.expected[field.id];
                  const observed = observedValuesByTick?.[selectedVector.tick]?.[field.id];
                  return (
                    <button
                      key={field.id}
                      type="button"
                      className={`rb-timing-toggle${expected == null ? ' is-unset' : expected === 1 ? ' is-high' : ' is-low'}`}
                      disabled={!editable}
                      onClick={() => cycleCheck(field.id)}
                      data-testid={`ide-scenario-check-${field.id}`}
                      title={`${field.label} — click to cycle 0 / 1 / unset`}
                    >
                      <span>{field.label}</span>
                      <strong>{expected == null ? '·' : expected}</strong>
                      <small>{observed == null ? 'not observed' : `obs ${observed}`}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
