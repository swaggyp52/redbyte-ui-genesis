/**
 * AssertionCanvas — read-only assertion/expected output overlay aligned with waveform timeline.
 *
 * Row-per-signal × column-per-tick grid showing expected values from verification run.
 * Layout constants mirror WaveformViewer: LABEL_W=140, TICK_W=48, ROW_H=34.
 *
 * - Rendered when assertionMode is enabled.
 * - Shows expected vs actual comparison for output signals only.
 * - Read-only in v1; future slices will enable click-to-toggle editing.
 * - Mismatch highlighting only active when assertionMode ON.
 * - Undefined/no-assertion cells render as neutral (not alarming).
 *
 * Data contract: VerifyReportVector[], keyed by (tick, signal).
 * Selection sync: selectedTick + selectedSignal highlight matching cell.
 * Mismatch info: supplied as Map<string, Mismatch[]> for fast lookup.
 *
 * Immutable: read-only operations only; edits deferred to Slice 7+.
 */

import React from 'react';
import type { VerifyVectorDraftInput } from '../surfaces/ScenarioBuilderPanel';

// ── Layout constants (mirror WaveformViewer + StimulusCanvas) ────────────────
const LABEL_W = 140;
const TICK_W = 48;
const ROW_H = 34;
const GROUP_H = 20;
const ADD_COL_W = 36; // Reserve space for alignment with StimulusCanvas

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssertionCellValue {
  expected: 0 | 1 | null; // null = no assertion/not set
  actual: 0 | 1 | string; // string for X/Z or other undefined states
  isMismatch: boolean;
}

export interface AssertionCanvasProps {
  /** Output signals to render. */
  outputFields: VerifyVectorDraftInput[];
  /** Tick numbers to render as columns. */
  ticks: number[];
  /** Get cell value for (tick, signal). */
  getCellValue: (tick: number, signal: string) => AssertionCellValue;
  /** Currently selected tick (for highlight). */
  selectedTick: number | null;
  /** Currently selected signal (for highlight). */
  selectedSignal: string | null;
  /** When true, mismatch styling is active. */
  assertionMode?: boolean;
  /** Fired when user clicks a cell (for future v2 editing). */
  onCellClick?: (tick: number, signal: string) => void;
  /** CSS class for the outer container. */
  className?: string;
  /** Read-only toggle (always true in v1). */
  readOnly?: boolean;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Determine CSS class + title for cell based on expected/actual state.
 * Returns { className, title } for rendering.
 */
function analyzeCell(value: AssertionCellValue, assertionMode: boolean, fieldLabel: string, tick: number) {
  const baseClass = 'ide-assertion-cell';

  // If no assertion, render neutral
  if (value.expected === null) {
    return {
      className: `${baseClass} ide-assertion-cell--undefined`,
      title: `${fieldLabel} at t${tick}: no assertion specified`,
      isPass: false,
      isFail: false,
    };
  }

  if (!assertionMode) {
    // When assertions OFF, show stored expected value but no mismatch styling
    return {
      className: `${baseClass} ide-assertion-cell--neutral`,
      title: `${fieldLabel} at t${tick}: asserted ${value.expected}`,
      isPass: false,
      isFail: false,
    };
  }

  // Assertions ON: apply mismatch coloring
  if (value.isMismatch) {
    return {
      className: `${baseClass} ide-assertion-cell--fail`,
      title: `${fieldLabel} at t${tick}: asserted ${value.expected}, observed ${value.actual}`,
      isPass: false,
      isFail: true,
    };
  }

  // Match
  return {
    className: `${baseClass} ide-assertion-cell--pass`,
    title: `${fieldLabel} at t${tick}: asserted ${value.expected}, observed ${value.actual}`,
    isPass: true,
    isFail: false,
  };
}

/**
 * Render visual indicator for a cell: mismatch "✗", pass "✓", or value square.
 */
function renderCellContent(value: AssertionCellValue, isSelected: boolean, assertionMode: boolean) {
  // If no assertion, show dash
  if (value.expected === null) {
    return <span style={{ fontSize: '0.72em', color: 'var(--rb-text-tertiary)' }}>—</span>;
  }

  // Render value square (similar to StimulusCanvas cell)
  if (!assertionMode || !value.isMismatch) {
    return (
      <div
        style={{
          width: TICK_W - 8,
          height: ROW_H - 10,
          borderRadius: 3,
          background: value.expected === 1 ? 'var(--rb-accent)' : 'transparent',
          border: value.expected === 0 ? '1px solid var(--rb-border)' : 'none',
          transition: 'outline 0.15s ease',
          outline: isSelected ? '2px solid var(--rb-focus)' : 'none',
        }}
      />
    );
  }

  // Mismatch: show visual indicator
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: TICK_W - 8,
        height: ROW_H - 10,
        borderRadius: 3,
        background: 'var(--rb-error-light, rgba(220, 50, 50, 0.1))',
        border: '1px solid var(--rb-error, #dc3232)',
        fontSize: '0.7em',
        color: 'var(--rb-error)',
        fontWeight: 600,
      }}
    >
      ✗
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export const AssertionCanvas: React.FC<AssertionCanvasProps> = ({
  outputFields,
  ticks,
  getCellValue,
  selectedTick,
  selectedSignal,
  assertionMode = false,
  onCellClick,
  className = '',
  readOnly = true,
}) => {
  if (outputFields.length === 0 || ticks.length === 0) {
    return null;
  }

  const totalW = LABEL_W + ticks.length * TICK_W + ADD_COL_W;

  return (
    <div
      className={`ide-assertion-canvas ${className}`.trim()}
      data-testid="ide-assertion-canvas"
      style={{ overflowX: 'auto', userSelect: 'none', marginTop: 12 }}
    >
      <div style={{ minWidth: totalW, position: 'relative' }}>
        {/* ── Tick header row ──────────────────────────────────────────────── */}
        <div
          className="ide-assertion-row ide-assertion-row--header"
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
                fontSize: '0.72em',
                color: 'var(--rb-text-tertiary)',
                fontFamily: 'var(--rb-font-mono, monospace)',
                cursor: 'default',
              }}
            >
              t{tick}
            </div>
          ))}
          <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
        </div>

        {/* ── Observed group header ────────────────────────────────────────── */}
        <div
          className="ide-assertion-group-header ide-assertion-group-header--observed"
          style={{
            display: 'flex',
            height: GROUP_H,
            alignItems: 'center',
            background: 'var(--rb-surface-2, transparent)',
            opacity: 0.7,
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
            Observed
          </div>
          {ticks.map((tick) => (
            <div
              key={tick}
              style={{ width: TICK_W, flexShrink: 0, height: '100%', borderLeft: '1px solid var(--rb-border)' }}
            />
          ))}
          <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
        </div>

        {/* ── Output signal rows (observed values) ─────────────────────────── */}
        {outputFields.map((field, idx) => (
          <div
            key={field.id}
            className={`ide-assertion-row ide-assertion-row--signal${idx % 2 === 1 ? ' ide-assertion-row--stripe' : ''}`}
            style={{ display: 'flex', height: ROW_H, alignItems: 'center' }}
          >
            <div
              className="ide-assertion-label-cell"
              title={field.pin ? `${field.label} — Pin: ${field.pin}` : field.label}
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
                fontFamily: 'var(--rb-font-mono, monospace)',
              }}
            >
              {field.label}
              {field.pin && (
                <code style={{ marginLeft: 4, fontSize: '0.82em', color: 'var(--rb-text-tertiary)' }}>
                  {field.pin}
                </code>
              )}
            </div>
            {ticks.map((tick) => {
              const cellValue = getCellValue(tick, field.id);
              const isSelected = selectedTick === tick && selectedSignal === field.id;
              const cellAnalysis = analyzeCell(cellValue, assertionMode, field.label, tick);

              return (
                <button
                  key={tick}
                  onClick={() => !readOnly && onCellClick?.(tick, field.id)}
                  data-testid={`ide-assertion-cell-${field.id}-t${tick}`}
                  disabled={readOnly}
                  title={cellAnalysis.title}
                  style={{
                    width: TICK_W,
                    flexShrink: 0,
                    height: ROW_H,
                    border: 'none',
                    borderLeft: '1px solid var(--rb-border)',
                    cursor: readOnly ? 'default' : 'pointer',
                    background: isSelected ? 'var(--rb-surface-3, rgba(0, 0, 0, 0.04))' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.1s ease',
                  }}
                >
                  <div
                    className={cellAnalysis.className}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {renderCellContent(cellValue, isSelected, assertionMode)}
                  </div>
                </button>
              );
            })}
            <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
          </div>
        ))}

        {/* ── Asserted group header + expected rows ──────────────────────── */}
        <div
          className="ide-assertion-group-header ide-assertion-group-header--asserted"
          style={{
            display: 'flex',
            height: GROUP_H,
            alignItems: 'center',
            background: 'var(--rb-surface-2, transparent)',
            opacity: assertionMode ? 0.85 : 0.5,
            transition: 'opacity 0.2s ease',
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

        {/* ── Expected (asserted) value rows ───────────────────────────────── */}
        {outputFields.map((field, idx) => (
          <div
            key={`expected-${field.id}`}
            className={`ide-assertion-row ide-assertion-row--expected${idx % 2 === 1 ? ' ide-assertion-row--stripe' : ''}`}
            style={{
              display: 'flex',
              height: ROW_H,
              alignItems: 'center',
              opacity: assertionMode ? 0.9 : 0.45,
              transition: 'opacity 0.2s ease',
            }}
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
                color: 'var(--rb-text-tertiary)',
                fontStyle: 'italic',
                fontFamily: 'var(--rb-font-mono, monospace)',
              }}
            >
              exp
            </div>
            {ticks.map((tick) => {
              const cellValue = getCellValue(tick, field.id);
              const isSelected = selectedTick === tick && selectedSignal === field.id;

              return (
                <div
                  key={tick}
                  data-testid={`ide-assertion-expected-${field.id}-t${tick}`}
                  title={cellValue.expected != null ? `Expected: ${cellValue.expected}` : 'No assertion'}
                  style={{
                    width: TICK_W,
                    flexShrink: 0,
                    height: ROW_H,
                    borderLeft: '1px solid var(--rb-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? 'var(--rb-surface-3, rgba(0, 0, 0, 0.04))' : 'none',
                  }}
                >
                  {cellValue.expected != null ? (
                    <div
                      style={{
                        width: TICK_W - 8,
                        height: ROW_H - 10,
                        borderRadius: 3,
                        background: cellValue.expected === 1 ? 'var(--rb-accent)' : 'transparent',
                        border: cellValue.expected === 0 ? '1px solid var(--rb-border)' : 'none',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.72em', color: 'var(--rb-text-tertiary)' }}>—</span>
                  )}
                </div>
              );
            })}
            <div style={{ width: ADD_COL_W, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
};
