import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VerifyAuthorVector, VerifyVectorDraftInput } from '../surfaces/ScenarioBuilderPanel';

const LABEL_W = 148;
const TICK_W = 64;
const ROW_H = 36;
const GROUP_H = 22;
const ADD_COL_W = 40;

type LaneKind = 'input' | 'expected';
type PaintSession = { kind: LaneKind; value: 0 | 1 | null };
type LaneOption = { key: string; kind: LaneKind; fieldId: string; label: string };

export interface StimulusCanvasProps {
  inputFields: VerifyVectorDraftInput[];
  outputFields: VerifyVectorDraftInput[];
  authoredVectors: VerifyAuthorVector[];
  onVectorsChange: (vectors: VerifyAuthorVector[]) => void;
}

function makeId(): string {
  return `sc_${Math.random().toString(36).slice(2, 9)}`;
}

function sortVectors(vectors: VerifyAuthorVector[]): VerifyAuthorVector[] {
  return [...vectors].sort((a, b) => a.tick - b.tick);
}

function uniqueSortedTicks(vectors: VerifyAuthorVector[]): number[] {
  return [...new Set(vectors.map((vector) => vector.tick))].sort((a, b) => a - b);
}

function emptyInputs(inputFields: VerifyVectorDraftInput[]): Record<string, 0 | 1> {
  const next: Record<string, 0 | 1> = {};
  for (const field of inputFields) next[field.id] = 0;
  return next;
}

function ensureTick(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number
): VerifyAuthorVector[] {
  if (vectors.some((vector) => vector.tick === tick)) return vectors;
  return sortVectors([
    ...vectors,
    { id: makeId(), tick, inputs: emptyInputs(inputFields), expected: {} },
  ]);
}

function ensureTicks(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  ticks: number[]
): VerifyAuthorVector[] {
  return ticks.reduce((current, tick) => ensureTick(current, inputFields, tick), vectors);
}

function getInputValue(vectors: VerifyAuthorVector[], tick: number, fieldId: string): 0 | 1 {
  return vectors.find((vector) => vector.tick === tick)?.inputs[fieldId] ?? 0;
}

function getExpectedValue(
  vectors: VerifyAuthorVector[],
  tick: number,
  fieldId: string
): 0 | 1 | null {
  const value = vectors.find((vector) => vector.tick === tick)?.expected[fieldId];
  return value == null ? null : value;
}

function setInputValue(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number,
  fieldId: string,
  value: 0 | 1
): VerifyAuthorVector[] {
  return ensureTick(vectors, inputFields, tick).map((vector) =>
    vector.tick === tick ? { ...vector, inputs: { ...vector.inputs, [fieldId]: value } } : vector
  );
}

function setExpectedValue(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number,
  fieldId: string,
  value: 0 | 1 | null
): VerifyAuthorVector[] {
  return ensureTick(vectors, inputFields, tick).map((vector) => {
    if (vector.tick !== tick) return vector;
    const expected = { ...vector.expected };
    if (value == null) delete expected[fieldId];
    else expected[fieldId] = value;
    return { ...vector, expected };
  });
}

function appendTick(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[]
): VerifyAuthorVector[] {
  const ticks = uniqueSortedTicks(vectors);
  return ensureTick(vectors, inputFields, ticks.length > 0 ? ticks[ticks.length - 1] + 1 : 0);
}

function removeTick(vectors: VerifyAuthorVector[], tick: number): VerifyAuthorVector[] {
  return vectors.filter((vector) => vector.tick !== tick);
}

function duplicateTick(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number
): VerifyAuthorVector[] {
  const source = vectors.find((vector) => vector.tick === tick);
  if (!source) return vectors;
  const shifted = vectors.map((vector) => (vector.tick > tick ? { ...vector, tick: vector.tick + 1 } : vector));
  return sortVectors([
    ...shifted,
    { ...source, id: makeId(), tick: tick + 1, inputs: { ...source.inputs }, expected: { ...source.expected } },
  ]);
}

function buildOperationTicks(vectors: VerifyAuthorVector[], minimumCount: number): number[] {
  const ticks = uniqueSortedTicks(vectors);
  if (ticks.length > 0) return ticks;
  return Array.from({ length: Math.max(1, minimumCount) }, (_, index) => index);
}

export const StimulusCanvas: React.FC<StimulusCanvasProps> = ({
  inputFields,
  outputFields,
  authoredVectors,
  onVectorsChange,
}) => {
  const latestVectorsRef = useRef(authoredVectors);
  const [hoveredTick, setHoveredTick] = useState<number | null>(null);
  const [selectedTick, setSelectedTick] = useState(0);
  const [selectedLaneKey, setSelectedLaneKey] = useState('');
  const [paintSession, setPaintSession] = useState<PaintSession | null>(null);

  useEffect(() => {
    latestVectorsRef.current = authoredVectors;
  }, [authoredVectors]);

  useEffect(() => {
    const stopPainting = () => setPaintSession(null);
    window.addEventListener('pointerup', stopPainting);
    return () => window.removeEventListener('pointerup', stopPainting);
  }, []);

  const ticks = useMemo(() => uniqueSortedTicks(authoredVectors), [authoredVectors]);
  const totalW = LABEL_W + ticks.length * TICK_W + ADD_COL_W;
  const laneOptions = useMemo<LaneOption[]>(
    () => [
      ...inputFields.map((field) => ({ key: `input:${field.id}`, kind: 'input' as const, fieldId: field.id, label: field.label })),
      ...outputFields.map((field) => ({ key: `expected:${field.id}`, kind: 'expected' as const, fieldId: field.id, label: field.label })),
    ],
    [inputFields, outputFields]
  );
  const selectedLane = laneOptions.find((option) => option.key === selectedLaneKey) ?? laneOptions[0] ?? null;

  useEffect(() => {
    setSelectedTick((previous) => (ticks.length === 0 ? 0 : ticks.includes(previous) ? previous : ticks[0]));
  }, [ticks]);

  useEffect(() => {
    setSelectedLaneKey((previous) =>
      previous && laneOptions.some((option) => option.key === previous) ? previous : laneOptions[0]?.key ?? ''
    );
  }, [laneOptions]);

  const commitVectors = useCallback(
    (recipe: (vectors: VerifyAuthorVector[]) => VerifyAuthorVector[]) => {
      const nextVectors = recipe(latestVectorsRef.current);
      latestVectorsRef.current = nextVectors;
      onVectorsChange(nextVectors);
    },
    [onVectorsChange]
  );

  const handleRowFill = useCallback((value: 0 | 1) => {
    if (!selectedLane) return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 1);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      for (const tick of targetTicks) {
        next =
          selectedLane.kind === 'input'
            ? setInputValue(next, inputFields, tick, selectedLane.fieldId, value)
            : setExpectedValue(next, inputFields, tick, selectedLane.fieldId, value);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleRowToggle = useCallback(() => {
    if (!selectedLane || selectedLane.kind !== 'input') return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 1);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      for (const tick of targetTicks) {
        const value: 0 | 1 = getInputValue(next, tick, selectedLane.fieldId) === 0 ? 1 : 0;
        next = setInputValue(next, inputFields, tick, selectedLane.fieldId, value);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleExpectedClear = useCallback(() => {
    if (!selectedLane || selectedLane.kind !== 'expected') return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 1);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      for (const tick of targetTicks) {
        next = setExpectedValue(next, inputFields, tick, selectedLane.fieldId, null);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleInputPattern = useCallback((resolver: (index: number) => 0 | 1) => {
    if (!selectedLane || selectedLane.kind !== 'input') return;
    const targetTicks = buildOperationTicks(latestVectorsRef.current, 4);
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      targetTicks.forEach((tick, index) => {
        next = setInputValue(next, inputFields, tick, selectedLane.fieldId, resolver(index));
      });
      return next;
    });
  }, [commitVectors, inputFields, selectedLane]);

  const handleBinaryCount = useCallback(() => {
    const targetTicks = buildOperationTicks(
      latestVectorsRef.current,
      Math.min(8, Math.max(4, 1 << Math.min(inputFields.length, 3)))
    );
    commitVectors((vectors) => {
      let next = ensureTicks(vectors, inputFields, targetTicks);
      targetTicks.forEach((tick, tickIndex) => {
        inputFields.forEach((field, fieldIndex) => {
          const shift = inputFields.length - fieldIndex - 1;
          const value: 0 | 1 = ((tickIndex >> shift) & 1) === 1 ? 1 : 0;
          next = setInputValue(next, inputFields, tick, field.id, value);
        });
      });
      return next;
    });
  }, [commitVectors, inputFields]);

  const handleColumnChange = useCallback((mode: 'fill0' | 'fill1' | 'toggle') => {
    commitVectors((vectors) => {
      let next = ensureTick(vectors, inputFields, selectedTick);
      for (const field of inputFields) {
        const value =
          mode === 'fill0'
            ? 0
            : mode === 'fill1'
              ? 1
              : getInputValue(next, selectedTick, field.id) === 0
                ? 1
                : 0;
        next = setInputValue(next, inputFields, selectedTick, field.id, value);
      }
      return next;
    });
  }, [commitVectors, inputFields, selectedTick]);

  const handleInputPointerDown = useCallback((tick: number, fieldId: string) => {
    const value: 0 | 1 = getInputValue(latestVectorsRef.current, tick, fieldId) === 0 ? 1 : 0;
    setSelectedTick(tick);
    setSelectedLaneKey(`input:${fieldId}`);
    commitVectors((vectors) => setInputValue(vectors, inputFields, tick, fieldId, value));
    setPaintSession({ kind: 'input', value });
  }, [commitVectors, inputFields]);

  const handleExpectedPointerDown = useCallback((tick: number, fieldId: string) => {
    const current = getExpectedValue(latestVectorsRef.current, tick, fieldId);
    const value: 0 | 1 | null = current == null ? 0 : current === 0 ? 1 : null;
    setSelectedTick(tick);
    setSelectedLaneKey(`expected:${fieldId}`);
    commitVectors((vectors) => setExpectedValue(vectors, inputFields, tick, fieldId, value));
    setPaintSession({ kind: 'expected', value });
  }, [commitVectors, inputFields]);

  if (inputFields.length === 0) {
    return <p className="ide-stimulus-empty" data-testid="ide-stimulus-empty">No IO mapping - add inputs in the Hardware surface first.</p>;
  }

  return (
    <div className="ide-stimulus-canvas" data-testid="ide-stimulus-canvas" style={{ overflowX: 'auto', userSelect: 'none' }}>
      <div className="ide-stimulus-toolbar" data-testid="ide-stimulus-toolbar">
        <div className="ide-stimulus-toolbar-group">
          <span className="ide-stimulus-toolbar-label">Row tools</span>
          <select className="ide-stimulus-target-select" value={selectedLane?.key ?? ''} onChange={(event) => setSelectedLaneKey(event.target.value)} data-testid="ide-stimulus-row-target">
            {laneOptions.map((option) => <option key={option.key} value={option.key}>{option.kind === 'input' ? 'Stimulus' : 'Expected'}: {option.label}</option>)}
          </select>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleRowFill(0)} data-testid="ide-stimulus-row-fill-0">Fill 0</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleRowFill(1)} data-testid="ide-stimulus-row-fill-1">Fill 1</button>
          {selectedLane?.kind === 'input' ? (
            <>
              <button type="button" className="ide-stimulus-mini-btn" onClick={handleRowToggle} data-testid="ide-stimulus-row-toggle">Toggle</button>
              <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleInputPattern((index) => index % 2 === 0 ? 0 : 1)} data-testid="ide-stimulus-pattern-alternating">Alternating</button>
              <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleInputPattern((index) => index % 2 === 0 ? 0 : 1)} data-testid="ide-stimulus-pattern-clock">Clock pattern</button>
            </>
          ) : (
            <button type="button" className="ide-stimulus-mini-btn" onClick={handleExpectedClear} data-testid="ide-stimulus-row-clear">Clear</button>
          )}
        </div>
        <div className="ide-stimulus-toolbar-group">
          <span className="ide-stimulus-toolbar-label">Tick tools</span>
          <select className="ide-stimulus-target-select" value={String(selectedTick)} onChange={(event) => setSelectedTick(Number(event.target.value || '0'))} data-testid="ide-stimulus-tick-target">
            {(ticks.length > 0 ? ticks : [0]).map((tick) => <option key={tick} value={tick}>t{tick}</option>)}
          </select>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleColumnChange('fill0')} data-testid="ide-stimulus-column-fill-0">Fill 0</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleColumnChange('fill1')} data-testid="ide-stimulus-column-fill-1">Fill 1</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => handleColumnChange('toggle')} data-testid="ide-stimulus-column-toggle">Toggle</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => { commitVectors((vectors) => duplicateTick(vectors, inputFields, selectedTick)); setSelectedTick((value) => value + 1); }} data-testid="ide-stimulus-duplicate-tick">Duplicate</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => commitVectors((vectors) => removeTick(vectors, selectedTick))} disabled={ticks.length === 0} data-testid="ide-stimulus-delete-selected-tick">Delete</button>
        </div>
        <div className="ide-stimulus-toolbar-group">
          <span className="ide-stimulus-toolbar-label">Patterns</span>
          <button type="button" className="ide-stimulus-mini-btn" onClick={handleBinaryCount} data-testid="ide-stimulus-pattern-binary">Binary count</button>
          <button type="button" className="ide-stimulus-mini-btn" onClick={() => commitVectors((vectors) => appendTick(vectors, inputFields))} data-testid="ide-stimulus-add-tick">Add tick</button>
          <span className="ide-stimulus-toolbar-note">Drag across cells to paint</span>
        </div>
      </div>
      <div style={{ minWidth: totalW, position: 'relative' }}>
        <div className="ide-stimulus-row ide-stimulus-row--header" style={{ display: 'flex', height: GROUP_H + 8, alignItems: 'center' }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }} />
          {ticks.map((tick) => (
            <div key={tick} className={`ide-stimulus-tick-header${selectedTick === tick ? ' is-selected' : ''}`} style={{ width: TICK_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', fontSize: '0.72em', fontFamily: 'var(--rb-font-mono, monospace)', cursor: 'pointer' }} onMouseEnter={() => setHoveredTick(tick)} onMouseLeave={() => setHoveredTick(null)} onClick={() => setSelectedTick(tick)}>
              t{tick}
              {hoveredTick === tick ? (
                <div className="ide-stimulus-tick-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); commitVectors((vectors) => duplicateTick(vectors, inputFields, tick)); setSelectedTick(tick + 1); }} data-testid={`ide-stimulus-duplicate-tick-${tick}`}>+</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); commitVectors((vectors) => removeTick(vectors, tick)); }} data-testid={`ide-stimulus-delete-tick-${tick}`}>x</button>
                </div>
              ) : null}
            </div>
          ))}
          <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
        </div>
        <div className="ide-stimulus-group-header" style={{ display: 'flex', height: GROUP_H, alignItems: 'center' }}>
          <div style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, fontSize: '0.68em', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rb-text-secondary)', fontFamily: 'var(--rb-font-sans, sans-serif)' }}>Stimulus</div>
          {ticks.map((tick) => <div key={tick} style={{ width: TICK_W, flexShrink: 0, height: '100%', borderLeft: '1px solid var(--rb-border)' }} />)}
          <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
        </div>
        {inputFields.map((field, index) => (
          <div key={field.id} className={`ide-stimulus-row${index % 2 === 1 ? ' ide-stimulus-row--stripe' : ''}`} style={{ display: 'flex', height: ROW_H, alignItems: 'center' }}>
            <button type="button" className={`ide-stimulus-label-cell${selectedLane?.key === `input:${field.id}` ? ' is-selected' : ''}`} onClick={() => setSelectedLaneKey(`input:${field.id}`)} data-testid={`ide-stimulus-row-select-${field.id}`} style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, paddingRight: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8em', color: 'var(--rb-text-primary)', fontFamily: 'var(--rb-font-mono, monospace)', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
              {field.label}{field.pin ? <code style={{ marginLeft: 4, fontSize: '0.82em', color: 'var(--rb-text-secondary)' }}>{field.pin}</code> : null}
            </button>
            {ticks.length === 0 && index === 0 ? (
              <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: '0.75em', color: 'var(--rb-text-secondary)', fontStyle: 'italic' }}>Add a tick or use a pattern to start authoring.</div>
            ) : ticks.map((tick) => {
              const value = getInputValue(authoredVectors, tick, field.id);
              return (
                <button key={tick} type="button" onPointerDown={() => handleInputPointerDown(tick, field.id)} onPointerEnter={(event) => {
                  if (!paintSession || paintSession.kind !== 'input' || (event.buttons & 1) === 0) return;
                  setSelectedTick(tick);
                  setSelectedLaneKey(`input:${field.id}`);
                  commitVectors((vectors) => setInputValue(vectors, inputFields, tick, field.id, paintSession.value as 0 | 1));
                }} data-testid={`ide-stimulus-cell-${field.id}-t${tick}`} title={`${field.label} at t${tick}: ${value} - drag to paint`} style={{ width: TICK_W, flexShrink: 0, height: ROW_H, border: 'none', borderLeft: '1px solid var(--rb-border)', cursor: 'pointer', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <div className={`ide-stimulus-cell${value === 1 ? ' ide-stimulus-cell--hi' : ' ide-stimulus-cell--lo'}`} style={{ width: TICK_W - 8, height: ROW_H - 10, borderRadius: 3, background: value === 1 ? 'var(--rb-accent)' : 'transparent', border: value === 0 ? '1px solid var(--rb-border)' : 'none' }} />
                </button>
              );
            })}
            <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
          </div>
        ))}
        {outputFields.length > 0 ? (
          <>
            <div className="ide-stimulus-group-header ide-stimulus-group-header--asserted" style={{ display: 'flex', height: GROUP_H, alignItems: 'center', background: 'var(--rb-surface-2, transparent)' }}>
              <div style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, fontSize: '0.68em', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rb-text-secondary)', fontFamily: 'var(--rb-font-sans, sans-serif)' }}>Expected outputs</div>
              {ticks.map((tick) => <div key={tick} style={{ width: TICK_W, flexShrink: 0, height: '100%', borderLeft: '1px solid var(--rb-border)' }} />)}
              <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
            </div>
            {outputFields.map((field) => (
              <div key={field.id} className="ide-stimulus-row ide-stimulus-row--output" style={{ display: 'flex', height: ROW_H, alignItems: 'center' }}>
                <button type="button" className={`ide-stimulus-label-cell ide-stimulus-label-cell--expected${selectedLane?.key === `expected:${field.id}` ? ' is-selected' : ''}`} onClick={() => setSelectedLaneKey(`expected:${field.id}`)} data-testid={`ide-stimulus-row-select-${field.id}`} style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, paddingRight: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8em', color: 'var(--rb-text-secondary)', fontStyle: 'italic', fontFamily: 'var(--rb-font-mono, monospace)', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}>{field.label}</button>
                {ticks.map((tick) => {
                  const value = getExpectedValue(authoredVectors, tick, field.id);
                  return (
                    <button key={tick} type="button" onPointerDown={() => handleExpectedPointerDown(tick, field.id)} onPointerEnter={(event) => {
                      if (!paintSession || paintSession.kind !== 'expected' || (event.buttons & 1) === 0) return;
                      setSelectedTick(tick);
                      setSelectedLaneKey(`expected:${field.id}`);
                      commitVectors((vectors) => setExpectedValue(vectors, inputFields, tick, field.id, paintSession.value));
                    }} data-testid={`ide-stimulus-expected-${field.id}-t${tick}`} title={`${field.label} at t${tick}: ${value != null ? value : 'not set'} - drag to paint`} style={{ width: TICK_W, flexShrink: 0, height: ROW_H, borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: '1px solid var(--rb-border)', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                      {value != null ? <div style={{ width: TICK_W - 8, height: ROW_H - 10, borderRadius: 3, background: value === 1 ? 'var(--rb-accent)' : 'transparent', border: value === 0 ? '1px solid var(--rb-border)' : 'none' }} /> : <span style={{ fontSize: '0.72em', color: 'var(--rb-text-secondary)' }}>-</span>}
                    </button>
                  );
                })}
                <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
};
