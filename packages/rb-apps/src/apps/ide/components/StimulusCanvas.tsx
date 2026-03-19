/**
 * StimulusCanvas — horizontal timeline grid for scenario authoring.
 *
 * Row-per-signal × column-per-tick grid with click-to-toggle cells.
 * Layout constants mirror WaveformViewer: LABEL_W=140, TICK_W=48.
 *
 * - Input lanes: fully editable (click any cell to toggle 0↔1).
 * - Output lanes: read-only display of stored expected values (v1).
 *   Enable Assertions flow is Slice 6+.
 * - Clock/sequential rows: editable like any other input row.
 * - "+" column: adds a new tick at max+1.
 * - Hover tick header → reveals "×" delete affordance.
 *
 * Data contract: same VerifyAuthorVector[] as the rest of the Verify engine.
 * Immutable: all mutations return new arrays, never in-place edits.
 */

import React, { useCallback, useState } from 'react';
import type { VerifyAuthorVector, VerifyVectorDraftInput } from '../surfaces/ScenarioBuilderPanel';

// ── Layout constants (mirror WaveformViewer) ─────────────────────────────────
const LABEL_W = 140;
const TICK_W = 48;
const ROW_H = 34;
const GROUP_H = 20;
const ADD_COL_W = 36;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StimulusCanvasProps {
  inputFields: VerifyVectorDraftInput[];
  outputFields: VerifyVectorDraftInput[];
  authoredVectors: VerifyAuthorVector[];
  onVectorsChange: (vectors: VerifyAuthorVector[]) => void;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function makeId(): string {
  return `sc_${Math.random().toString(36).slice(2, 9)}`;
}

/** Sorted deduplicated tick list from vectors. */
function uniqueSortedTicks(vectors: VerifyAuthorVector[]): number[] {
  return [...new Set(vectors.map((v) => v.tick))].sort((a, b) => a - b);
}

/** Get stored input cell value for (tick, fieldId). Default 0. */
function getInputValue(
  vectors: VerifyAuthorVector[],
  tick: number,
  fieldId: string,
): 0 | 1 {
  return vectors.find((v) => v.tick === tick)?.inputs[fieldId] ?? 0;
}

/** Get stored expected cell value for (tick, fieldId). null = not set. */
function getExpectedValue(
  vectors: VerifyAuthorVector[],
  tick: number,
  fieldId: string,
): 0 | 1 | null {
  const vec = vectors.find((v) => v.tick === tick);
  if (!vec) return null;
  const val = vec.expected[fieldId];
  return val != null ? val : null;
}

/**
 * Toggle input cell at (tick, fieldId).
 * If no vector exists at tick, materialises one with all inputs at 0.
 */
function toggleInputCell(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
  tick: number,
  fieldId: string,
): VerifyAuthorVector[] {
  const current = getInputValue(vectors, tick, fieldId);
  const next: 0 | 1 = current === 0 ? 1 : 0;
  const existing = vectors.find((v) => v.tick === tick);
  if (existing) {
    return vectors.map((v) =>
      v.tick === tick ? { ...v, inputs: { ...v.inputs, [fieldId]: next } } : v,
    );
  }
  // Materialise new vector at this tick
  const inputs: Record<string, 0 | 1> = {};
  for (const f of inputFields) inputs[f.id] = 0;
  inputs[fieldId] = next;
  return [...vectors, { id: makeId(), tick, inputs, expected: {} }].sort(
    (a, b) => a.tick - b.tick,
  );
}

/** Append a new tick column after the current maximum tick. */
function appendTick(
  vectors: VerifyAuthorVector[],
  inputFields: VerifyVectorDraftInput[],
): VerifyAuthorVector[] {
  const maxTick =
    vectors.length > 0 ? Math.max(...vectors.map((v) => v.tick)) : -1;
  const inputs: Record<string, 0 | 1> = {};
  for (const f of inputFields) inputs[f.id] = 0;
  return [
    ...vectors,
    { id: makeId(), tick: maxTick + 1, inputs, expected: {} },
  ];
}

/** Remove all vectors at the given tick. */
function removeTick(
  vectors: VerifyAuthorVector[],
  tick: number,
): VerifyAuthorVector[] {
  return vectors.filter((v) => v.tick !== tick);
}

// ── Component ─────────────────────────────────────────────────────────────────

export const StimulusCanvas: React.FC<StimulusCanvasProps> = ({
  inputFields,
  outputFields,
  authoredVectors,
  onVectorsChange,
}) => {
  const [hoveredTick, setHoveredTick] = useState<number | null>(null);
  const ticks = uniqueSortedTicks(authoredVectors);
  const hasOutputs = outputFields.length > 0;
  const totalW = LABEL_W + ticks.length * TICK_W + ADD_COL_W;

  const handleCellClick = useCallback(
    (tick: number, fieldId: string) => {
      onVectorsChange(toggleInputCell(authoredVectors, inputFields, tick, fieldId));
    },
    [authoredVectors, inputFields, onVectorsChange],
  );

  const handleAddTick = useCallback(() => {
    onVectorsChange(appendTick(authoredVectors, inputFields));
  }, [authoredVectors, inputFields, onVectorsChange]);

  const handleDeleteTick = useCallback(
    (tick: number) => {
      onVectorsChange(removeTick(authoredVectors, tick));
    },
    [authoredVectors, onVectorsChange],
  );

  if (inputFields.length === 0) {
    return (
      <p
        className="ide-stimulus-empty"
        data-testid="ide-stimulus-empty"
        style={{ color: 'var(--rb-text-secondary)', fontSize: '0.82em', margin: '8px 0', fontStyle: 'italic' }}
      >
        No IO mapping — add inputs in the Hardware surface first.
      </p>
    );
  }

  return (
    <div
      className="ide-stimulus-canvas"
      data-testid="ide-stimulus-canvas"
      style={{ overflowX: 'auto', userSelect: 'none' }}
    >
      <div style={{ minWidth: totalW, position: 'relative' }}>

        {/* ── Tick header row ─────────────────────────────────────────── */}
        <div
          className="ide-stimulus-row ide-stimulus-row--header"
          style={{ display: 'flex', height: GROUP_H + 8, alignItems: 'center' }}
        >
          <div style={{ width: LABEL_W, flexShrink: 0 }} />
          {ticks.map((tick) => (
            <div
              key={tick}
              style={{
                width: TICK_W,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                fontSize: '0.72em',
                color: 'var(--rb-text-secondary)',
                fontFamily: 'var(--rb-font-mono, monospace)',
                cursor: 'default',
              }}
              onMouseEnter={() => setHoveredTick(tick)}
              onMouseLeave={() => setHoveredTick(null)}
            >
              t{tick}
              {hoveredTick === tick && (
                <button
                  onClick={() => handleDeleteTick(tick)}
                  title={`Remove tick t${tick}`}
                  data-testid={`ide-stimulus-delete-tick-${tick}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 3,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--rb-text-secondary)',
                    fontSize: '1em',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <div
            style={{
              width: ADD_COL_W,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={handleAddTick}
              title="Add tick column"
              data-testid="ide-stimulus-add-tick"
              style={{
                background: 'none',
                border: '1px dashed var(--rb-border)',
                borderRadius: 3,
                cursor: 'pointer',
                color: 'var(--rb-text-secondary)',
                fontSize: '0.82em',
                width: 22,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* ── Stimulus group header ────────────────────────────────────── */}
        <div
          className="ide-stimulus-group-header"
          style={{ display: 'flex', height: GROUP_H, alignItems: 'center', background: 'var(--rb-surface-2, transparent)' }}
        >
          <div
            style={{
              width: LABEL_W,
              flexShrink: 0,
              paddingLeft: 8,
              fontSize: '0.68em',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--rb-text-secondary)',
              fontFamily: 'var(--rb-font-sans, sans-serif)',
            }}
          >
            Stimulus
          </div>
          {ticks.map((tick) => (
            <div
              key={tick}
              style={{ width: TICK_W, flexShrink: 0, height: '100%', borderLeft: '1px solid var(--rb-border)' }}
            />
          ))}
          <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
        </div>

        {/* ── Input signal rows ────────────────────────────────────────── */}
        {inputFields.map((field, idx) => (
          <div
            key={field.id}
            className={`ide-stimulus-row${idx % 2 === 1 ? ' ide-stimulus-row--stripe' : ''}`}
            style={{ display: 'flex', height: ROW_H, alignItems: 'center' }}
          >
            <div
              className="ide-stimulus-label-cell"
              title={field.pin ? `Pin: ${field.pin}` : field.label}
              style={{
                width: LABEL_W,
                flexShrink: 0,
                paddingLeft: 8,
                paddingRight: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '0.8em',
                color: 'var(--rb-text-primary)',
                fontFamily: 'var(--rb-font-mono, monospace)',
              }}
            >
              {field.label}
              {field.pin && (
                <code style={{ marginLeft: 4, fontSize: '0.82em', color: 'var(--rb-text-secondary)' }}>
                  {field.pin}
                </code>
              )}
            </div>
            {ticks.length === 0 && idx === 0 ? (
              <div
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  fontSize: '0.75em',
                  color: 'var(--rb-text-secondary)',
                  fontStyle: 'italic',
                }}
              >
                Press + to add a tick →
              </div>
            ) : (
              ticks.map((tick) => {
                const val = getInputValue(authoredVectors, tick, field.id);
                return (
                  <button
                    key={tick}
                    onClick={() => handleCellClick(tick, field.id)}
                    data-testid={`ide-stimulus-cell-${field.id}-t${tick}`}
                    title={`${field.label} at t${tick}: ${val} — click to toggle`}
                    style={{
                      width: TICK_W,
                      flexShrink: 0,
                      height: ROW_H,
                      border: 'none',
                      borderLeft: '1px solid var(--rb-border)',
                      cursor: 'pointer',
                      background: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    <div
                      className={`ide-stimulus-cell${val === 1 ? ' ide-stimulus-cell--hi' : ' ide-stimulus-cell--lo'}`}
                      style={{
                        width: TICK_W - 8,
                        height: ROW_H - 10,
                        borderRadius: 3,
                        background: val === 1 ? 'var(--rb-accent)' : 'transparent',
                        border: val === 0 ? '1px solid var(--rb-border)' : 'none',
                        transition: 'background 0.1s ease',
                      }}
                    />
                  </button>
                );
              })
            )}
            <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
          </div>
        ))}

        {/* ── Asserted group header + output rows (read-only, v1) ───────── */}
        {hasOutputs && (
          <>
            <div
              className="ide-stimulus-group-header ide-stimulus-group-header--asserted"
              style={{
                display: 'flex',
                height: GROUP_H,
                alignItems: 'center',
                background: 'var(--rb-surface-2, transparent)',
                opacity: 0.6,
              }}
            >
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  paddingLeft: 8,
                  fontSize: '0.68em',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--rb-text-secondary)',
                  fontFamily: 'var(--rb-font-sans, sans-serif)',
                }}
              >
                Asserted
              </div>
              {ticks.map((tick) => (
                <div
                  key={tick}
                  style={{ width: TICK_W, flexShrink: 0, height: '100%', borderLeft: '1px solid var(--rb-border)' }}
                />
              ))}
              <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
            </div>

            {outputFields.map((field) => (
              <div
                key={field.id}
                className="ide-stimulus-row ide-stimulus-row--output"
                style={{ display: 'flex', height: ROW_H, alignItems: 'center', opacity: 0.45 }}
              >
                <div
                  style={{
                    width: LABEL_W,
                    flexShrink: 0,
                    paddingLeft: 8,
                    paddingRight: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '0.8em',
                    color: 'var(--rb-text-secondary)',
                    fontStyle: 'italic',
                    fontFamily: 'var(--rb-font-mono, monospace)',
                  }}
                >
                  {field.label}
                </div>
                {ticks.map((tick) => {
                  const exp = getExpectedValue(authoredVectors, tick, field.id);
                  return (
                    <div
                      key={tick}
                      title={`${field.label} at t${tick}: ${exp != null ? exp : 'not set'} — enable Assertions to author expected values`}
                      style={{
                        width: TICK_W,
                        flexShrink: 0,
                        height: ROW_H,
                        borderLeft: '1px solid var(--rb-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {exp != null ? (
                        <div
                          style={{
                            width: TICK_W - 8,
                            height: ROW_H - 10,
                            borderRadius: 3,
                            background: exp === 1 ? 'var(--rb-accent)' : 'transparent',
                            border: exp === 0 ? '1px solid var(--rb-border)' : 'none',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '0.72em', color: 'var(--rb-text-secondary)' }}>—</span>
                      )}
                    </div>
                  );
                })}
                <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
