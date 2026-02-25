import React, { useMemo } from 'react';

export type TruthTableRow = {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  isFail: boolean;
};

export type TruthTableMode = 'ticks' | 'combos';

export interface TruthTablePaneProps {
  mode: TruthTableMode;
  rows: TruthTableRow[];
  selectedTick?: number | null;
  onSelectTick?: (tick: number) => void;
  onModeChange?: (mode: TruthTableMode) => void;
  /** Called when user clicks "Fix in Design" on a row */
  onFixPath?: (row: TruthTableRow) => void;
}

/**
 * TruthTablePane — right instrument in the Verify instrument deck.
 *
 * "ticks" mode: rows = ticks × signals, columns = Signal / Exp / Act / Fix
 *   — always available; default in FAIL state
 *
 * "combos" mode: combinational input enumeration
 *   — not yet implemented; shows a deterministic unavailable message
 *
 * Click any row to drive the waveform cursor (onSelectTick).
 * "Fix in Design" fires onFixPath per row.
 */
export const TruthTablePane: React.FC<TruthTablePaneProps> = ({
  mode,
  rows,
  selectedTick,
  onSelectTick,
  onModeChange,
  onFixPath,
}) => {
  /** Group rows by tick for grouped tick-cell rendering */
  const grouped = useMemo(() => {
    const map = new Map<number, TruthTableRow[]>();
    for (const row of rows) {
      const bucket = map.get(row.tick) ?? [];
      bucket.push(row);
      map.set(row.tick, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [rows]);

  const isEmpty = rows.length === 0;
  const hasFixAction = Boolean(onFixPath);

  return (
    <section
      className="ide-truth-table-pane"
      data-testid="ide-verify-truth-table"
      aria-label="Truth table"
    >
      {/* ── Header ── */}
      <div className="ide-truth-table-header">
        <span className="ide-truth-table-title">TRUTH TABLE</span>
        <div className="ide-truth-table-mode-toggle" data-testid="ide-truth-table-mode-toggle">
          <button
            type="button"
            className={`ide-truth-table-mode-btn ${mode === 'ticks' ? 'is-active' : ''}`}
            onClick={() => onModeChange?.('ticks')}
            data-testid="ide-truth-table-mode-ticks"
          >
            Ticks
          </button>
          <button
            type="button"
            className={`ide-truth-table-mode-btn ${mode === 'combos' ? 'is-active' : ''}`}
            onClick={() => onModeChange?.('combos')}
            data-testid="ide-truth-table-mode-combos"
          >
            Combos
          </button>
        </div>
      </div>
      {mode === 'ticks' && (
        <p className="ide-truth-table-clock-note">
          For clocked circuits, Exp is evaluated after the rising edge of each tick.
        </p>
      )}

      {/* ── Body ── */}
      <div className="ide-truth-table-body">
        {mode === 'combos' ? (
          <div className="ide-truth-table-unavailable" data-testid="ide-truth-table-combos-na">
            <span className="ide-truth-table-unavailable-icon" aria-hidden="true">⊘</span>
            <p className="ide-truth-table-unavailable-msg">
              Combinational enumeration not available for sequential circuits.
            </p>
            <p className="ide-truth-table-unavailable-sub">
              Switch to Ticks mode to inspect expected vs&nbsp;actual per tick.
            </p>
          </div>
        ) : isEmpty ? (
          <div className="ide-truth-table-empty" data-testid="ide-truth-table-empty">
            <p className="ide-truth-table-empty-msg">No data yet — run verification to populate.</p>
          </div>
        ) : (
          <div className="ide-truth-table-scroll">
            <table className="ide-truth-table" data-testid="ide-truth-table-table">
              <thead className="ide-truth-table-thead">
                <tr>
                  <th className="ide-truth-table-th ide-truth-table-th-tick">Tick</th>
                  <th className="ide-truth-table-th">Signal</th>
                  <th className="ide-truth-table-th">Exp</th>
                  <th className="ide-truth-table-th">Act</th>
                  {hasFixAction && (
                    <th className="ide-truth-table-th ide-truth-table-th-fix" />
                  )}
                </tr>
              </thead>
              <tbody>
                {grouped.map(([tick, tickRows]) => {
                  const isTickSelected = selectedTick === tick;
                  return tickRows.map((row, rowIndex) => (
                    <tr
                      key={`${tick}-${row.signal}`}
                      className={[
                        'ide-truth-table-tr',
                        row.isFail ? 'is-fail' : '',
                        isTickSelected ? 'is-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      data-testid={`ide-truth-table-row-${tick}-${row.signal}`}
                      onClick={() => onSelectTick?.(tick)}
                    >
                      {/* Tick cell — spans all rows in this tick group */}
                      {rowIndex === 0 ? (
                        <td
                          className="ide-truth-table-td ide-truth-table-td-tick"
                          rowSpan={tickRows.length}
                          data-testid={`ide-truth-table-tick-${tick}`}
                        >
                          <button
                            type="button"
                            className={`ide-truth-table-tick-btn ${isTickSelected ? 'is-active' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectTick?.(tick);
                            }}
                          >
                            t{tick}
                          </button>
                        </td>
                      ) : null}

                      <td className="ide-truth-table-td">
                        <code className="ide-truth-table-signal">{row.signal}</code>
                      </td>

                      <td className="ide-truth-table-td ide-truth-table-td-value">
                        {row.expected}
                      </td>

                      <td className="ide-truth-table-td ide-truth-table-td-value">
                        {row.isFail ? (
                          <span className="ide-truth-table-actual-pill">{row.actual}</span>
                        ) : (
                          row.actual
                        )}
                      </td>

                      {hasFixAction && (
                        <td
                          className="ide-truth-table-td ide-truth-table-td-fix"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.isFail && (
                            <button
                              type="button"
                              className="ide-truth-table-fix-btn"
                              onClick={() => onFixPath?.(row)}
                              data-testid={`ide-truth-table-fix-${tick}-${row.signal}`}
                            >
                              Fix →
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
