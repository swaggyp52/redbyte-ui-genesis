import React, { useMemo } from 'react';

export interface VerifyVectorListFailureRow {
  key: string;
  tick: number;
  signal: string;
  signalLabel?: string;
  expected: string;
  actual: string;
  vectorId?: string;
  caseIndex?: number;
}

export interface VerifyVectorListPanelProps {
  rows: VerifyVectorListFailureRow[];
  selectedKey: string | null;
  onSelectFailureKey: (failureKey: string) => void;
  onSelectNextFailure?: () => void;
  onSelectPreviousFailure?: () => void;
}

function toTestId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const VerifyVectorListPanel: React.FC<VerifyVectorListPanelProps> = ({
  rows,
  selectedKey,
  onSelectFailureKey,
  onSelectNextFailure,
  onSelectPreviousFailure,
}) => {
  const selectedIndex = useMemo(
    () => rows.findIndex((row) => row.key === selectedKey),
    [rows, selectedKey]
  );

  const selectByOffset = (offset: number): void => {
    if (rows.length === 0) return;
    const fallbackIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (fallbackIndex + offset + rows.length) % rows.length;
    onSelectFailureKey(rows[nextIndex].key);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'J') {
      event.preventDefault();
      if (onSelectNextFailure) {
        onSelectNextFailure();
      } else {
        selectByOffset(1);
      }
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'k' || event.key === 'K') {
      event.preventDefault();
      if (onSelectPreviousFailure) {
        onSelectPreviousFailure();
      } else {
        selectByOffset(-1);
      }
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && selectedIndex >= 0) {
      event.preventDefault();
      onSelectFailureKey(rows[selectedIndex].key);
    }
  };

  return (
    <section className="ide-verify-vector-list-panel" data-testid="ide-verify-vector-list-panel">
      <header className="ide-design-subheader ide-verify-three-panel-header">
        <h3>Failing checks</h3>
        <span className="ide-copy" data-testid="ide-verify-vector-list-count">
          {rows.length}
        </span>
      </header>
      <p className="ide-copy ide-verify-vector-list-help">
        Arrow keys or J/K move between failing rows.
      </p>
      <div
        className="ide-verify-vector-list-scroll"
        data-testid="ide-verify-vector-list-scroll"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {rows.length === 0 ? (
          <p className="ide-copy">No failing checks in this run.</p>
        ) : (
          rows.map((row) => {
            const isSelected = row.key === selectedKey;
            return (
              <button
                key={row.key}
                type="button"
                className={`ide-verify-vector-row${isSelected ? ' is-selected' : ''}`}
                onClick={() => onSelectFailureKey(row.key)}
                data-testid={`ide-verify-vector-row-${toTestId(row.key)}`}
                aria-current={isSelected ? 'true' : undefined}
              >
                <span className="ide-verify-vector-row-primary">
                  <code>{row.signalLabel ?? row.signal}</code>
                  <strong>t{row.tick}</strong>
                </span>
                <span className="ide-verify-vector-row-secondary">
                  expected <code>{row.expected}</code> -&gt; observed <code>{row.actual}</code>
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};
