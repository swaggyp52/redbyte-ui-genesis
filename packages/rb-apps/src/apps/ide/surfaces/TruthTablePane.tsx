import React, { useMemo } from 'react';

export type TruthTableRow = {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  isFail: boolean;
};

export type TruthTableMode = 'ticks' | 'combos';

export type TruthTableComboRow = {
  tick: number;
  inputBits: string;
  outputs: Array<{
    signal: string;
    value: string;
    isFail: boolean;
  }>;
};

export type TruthTableKMapCell = {
  bits: string;
  value: string;
  isFail: boolean;
};

export type TruthTableKMapRow = {
  rowCode: string;
  cells: TruthTableKMapCell[];
};

export type TruthTableKMap = {
  outputSignal: string;
  rowCodes: string[];
  colCodes: string[];
  rows: TruthTableKMapRow[];
};

export interface TruthTablePaneProps {
  mode: TruthTableMode;
  rows: TruthTableRow[];
  isSequential?: boolean;
  selectedTick?: number | null;
  onSelectTick?: (tick: number) => void;
  onModeChange?: (mode: TruthTableMode) => void;
  emptyReason?: string;
  combosRows?: TruthTableComboRow[];
  combosInputs?: string[];
  combosOutputs?: string[];
  combosUnavailableReason?: string;
  kmaps?: TruthTableKMap[];
  kmapUnavailableReason?: string;
  onFixPath?: (row: TruthTableRow) => void;
}

export const TruthTablePane: React.FC<TruthTablePaneProps> = ({
  mode,
  rows,
  isSequential = false,
  selectedTick,
  onSelectTick,
  onModeChange,
  emptyReason,
  combosRows = [],
  combosInputs = [],
  combosOutputs = [],
  combosUnavailableReason,
  kmaps = [],
  kmapUnavailableReason,
  onFixPath,
}) => {
  const grouped = useMemo(() => {
    const map = new Map<number, TruthTableRow[]>();
    for (const row of rows) {
      const bucket = map.get(row.tick) ?? [];
      bucket.push(row);
      map.set(row.tick, bucket);
    }
    return Array.from(map.entries()).sort(([left], [right]) => left - right);
  }, [rows]);

  const effectiveMode: TruthTableMode = isSequential ? 'ticks' : mode;
  const isEmpty = rows.length === 0;
  const hasFixAction = Boolean(onFixPath);
  const title = isSequential ? 'TRACE TABLE (TICK LOG)' : 'TRUTH TABLE';
  const note =
    effectiveMode === 'ticks'
      ? isSequential
        ? 'Trace table shows inputs and outputs over time. Outputs are sampled after the rising edge for each case.'
        : 'Truth table rows show expected and observed outputs for each evaluated case.'
      : 'Combos groups repeated input patterns so you can inspect steady-state output behavior.';

  return (
    <section
      className="ide-truth-table-pane"
      data-testid="ide-verify-truth-table"
      aria-label={isSequential ? 'Trace table' : 'Truth table'}
    >
      <div className="ide-truth-table-header">
        <span className="ide-truth-table-title" data-testid="ide-verify-truth-table-title">
          {title}
        </span>
        <div className="ide-truth-table-mode-toggle" data-testid="ide-truth-table-mode-toggle">
          <button
            type="button"
            className={`ide-truth-table-mode-btn ${effectiveMode === 'ticks' ? 'is-active' : ''}`}
            onClick={() => onModeChange?.('ticks')}
            data-testid="ide-truth-table-mode-ticks"
          >
            {isSequential ? 'Trace' : 'Ticks'}
          </button>
          {!isSequential && (
            <button
              type="button"
              className={`ide-truth-table-mode-btn ${effectiveMode === 'combos' ? 'is-active' : ''}`}
              onClick={() => onModeChange?.('combos')}
              data-testid="ide-truth-table-mode-combos"
            >
              Combos
            </button>
          )}
        </div>
      </div>
      <p className="ide-truth-table-clock-note">{note}</p>

      <div className="ide-truth-table-body">
        {effectiveMode === 'combos' ? (
          combosRows.length > 0 ? (
            <div className="ide-truth-table-combos-scroll" data-testid="ide-truth-table-combos-scroll">
              <table className="ide-truth-table" data-testid="ide-truth-table-combos-table">
                <thead className="ide-truth-table-thead">
                  <tr>
                    <th className="ide-truth-table-th ide-truth-table-th-tick">Tick</th>
                    <th className="ide-truth-table-th">Inputs</th>
                    {combosOutputs.map((signal) => (
                      <th key={signal} className="ide-truth-table-th">
                        {signal}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {combosRows.map((row) => (
                    <tr
                      key={`${row.tick}-${row.inputBits}`}
                      className={`ide-truth-table-tr ${selectedTick === row.tick ? 'is-selected' : ''}`}
                      onClick={() => onSelectTick?.(row.tick)}
                    >
                      <td className="ide-truth-table-td ide-truth-table-td-tick">
                        <button
                          type="button"
                          className={`ide-truth-table-tick-btn ${selectedTick === row.tick ? 'is-active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectTick?.(row.tick);
                          }}
                        >
                          t{row.tick}
                        </button>
                      </td>
                      <td className="ide-truth-table-td ide-truth-table-combo-input">
                        <code>{formatComboBits(row.inputBits, combosInputs)}</code>
                      </td>
                      {combosOutputs.map((signal) => {
                        const output = row.outputs.find((entry) => entry.signal === signal);
                        return (
                          <td key={`${row.tick}-${signal}`} className="ide-truth-table-td ide-truth-table-td-value">
                            {output?.isFail ? (
                              <span className="ide-truth-table-actual-pill">{output.value}</span>
                            ) : (
                              output?.value ?? '-'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {kmaps.length > 0 && (
                <div className="ide-truth-table-kmap-stack" data-testid="ide-truth-table-kmap-stack">
                  {kmaps.map((kmap) => (
                    <section key={kmap.outputSignal} className="ide-truth-table-kmap">
                      <header className="ide-truth-table-kmap-header">
                        <span>K-map</span>
                        <code>{kmap.outputSignal}</code>
                      </header>
                      <table className="ide-truth-table" data-testid={`ide-truth-table-kmap-${toTestId(kmap.outputSignal)}`}>
                        <thead className="ide-truth-table-thead">
                          <tr>
                            <th className="ide-truth-table-th">Row</th>
                            {kmap.colCodes.map((colCode) => (
                              <th key={colCode} className="ide-truth-table-th">
                                {colCode || '-'}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kmap.rows.map((row) => (
                            <tr key={row.rowCode} className="ide-truth-table-tr">
                              <td className="ide-truth-table-td">
                                <code>{row.rowCode || '-'}</code>
                              </td>
                              {row.cells.map((cell) => (
                                <td key={cell.bits} className="ide-truth-table-td ide-truth-table-td-value">
                                  {cell.isFail ? (
                                    <span className="ide-truth-table-actual-pill">{cell.value}</span>
                                  ) : (
                                    cell.value
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="ide-truth-table-unavailable" data-testid="ide-truth-table-combos-na">
              <span className="ide-truth-table-unavailable-icon" aria-hidden="true">
                x
              </span>
              <p className="ide-truth-table-unavailable-msg">
                {combosUnavailableReason ?? 'No combinational combos are available for this run.'}
              </p>
              {kmapUnavailableReason && (
                <p className="ide-truth-table-unavailable-sub">{kmapUnavailableReason}</p>
              )}
            </div>
          )
        ) : isEmpty ? (
          <div className="ide-truth-table-empty" data-testid="ide-truth-table-empty">
            <p className="ide-truth-table-empty-msg">
              {emptyReason ?? 'Run verification to populate this table.'}
            </p>
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
                  {hasFixAction && <th className="ide-truth-table-th ide-truth-table-th-fix" />}
                </tr>
              </thead>
              <tbody>
                {grouped.map(([tick, tickRows]) =>
                  tickRows.map((row, rowIndex) => {
                    const isTickSelected = selectedTick === tick;
                    return (
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
                        <td className="ide-truth-table-td ide-truth-table-td-value">{row.expected}</td>
                        <td className="ide-truth-table-td ide-truth-table-td-value">
                          {row.isFail ? <span className="ide-truth-table-actual-pill">{row.actual}</span> : row.actual}
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
                                {'Fix ->'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

function formatComboBits(inputBits: string, labels: string[]): string {
  if (labels.length === 0) return inputBits || '-';
  return labels
    .map((label, index) => `${label}=${inputBits[index] ?? '-'}`)
    .join(' ');
}

function toTestId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}
