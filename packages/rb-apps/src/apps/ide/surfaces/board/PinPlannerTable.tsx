import React, { useMemo, useRef, useState } from 'react';
import { IdeCallout } from '../../components/IdePrimitives';
import { compareCodepoint } from '../../../../export/codepointSort';
import type { PinPlannerRow, PinPlannerStatus } from './pinPlannerProjection';

/**
 * Pin planner table — a read/select instrument over `buildPinPlannerRows`.
 * It owns only view state (search text, sort, keyboard focus). All mapping
 * facts come from the projection; all mutation stays with the caller via
 * `onSelectRow` (the existing selected-mapping editor applies changes).
 *
 * Reuses the hardware workspace table classes (`ide-hw-v3__*`) — no new CSS.
 */

export type PinPlannerSortKey =
  | 'logical'
  | 'direction'
  | 'port'
  | 'resource'
  | 'packagePin'
  | 'status';

export interface PinPlannerTableProps {
  rows: readonly PinPlannerRow[];
  selectedRowId?: string | null;
  onSelectRow?: (row: PinPlannerRow) => void;
  testId?: string;
}

const STATUS_LABELS: Readonly<Record<PinPlannerStatus, string>> = {
  conflict: 'Conflict',
  'needs-review': 'Needs review',
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  optional: 'Optional',
};

/** Sort rank keeps attention-first ordering stable for the status column. */
const STATUS_SORT_RANK: Readonly<Record<PinPlannerStatus, number>> = {
  conflict: 0,
  'needs-review': 1,
  unassigned: 2,
  assigned: 3,
  optional: 4,
};

const COLUMNS: ReadonlyArray<{ key: PinPlannerSortKey; label: string }> = [
  { key: 'logical', label: 'Logical signal' },
  { key: 'direction', label: 'Direction' },
  { key: 'port', label: 'Artifact port' },
  { key: 'resource', label: 'Board resource' },
  { key: 'packagePin', label: 'Package pin' },
  { key: 'status', label: 'Status' },
];

const UNAVAILABLE = '—';

function cellText(value: string | null): string {
  return value ?? UNAVAILABLE;
}

function compareNullableStrings(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1; // nulls last
  if (right === null) return -1;
  return compareCodepoint(left, right);
}

function compareRows(
  left: PinPlannerRow,
  right: PinPlannerRow,
  key: PinPlannerSortKey
): number {
  switch (key) {
    case 'logical':
      return compareCodepoint(left.logical, right.logical);
    case 'direction':
      return compareCodepoint(left.direction, right.direction);
    case 'port':
      return compareNullableStrings(left.port, right.port);
    case 'resource':
      return compareNullableStrings(left.resource, right.resource);
    case 'packagePin':
      return compareNullableStrings(left.packagePin, right.packagePin);
    case 'status':
      return STATUS_SORT_RANK[left.status] - STATUS_SORT_RANK[right.status];
  }
}

function rowMatchesQuery(row: PinPlannerRow, query: string): boolean {
  const haystack = [
    row.logical,
    row.direction,
    row.port ?? '',
    row.resource ?? '',
    row.resourceLabel ?? '',
    row.packagePin ?? '',
    STATUS_LABELS[row.status],
  ]
    .join(' ')
    .toUpperCase();
  return haystack.includes(query.toUpperCase());
}

export const PinPlannerTable: React.FC<PinPlannerTableProps> = ({
  rows,
  selectedRowId = null,
  onSelectRow,
  testId = 'rb-pin-planner',
}) => {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<PinPlannerSortKey | null>(null);
  const [sortAscending, setSortAscending] = useState(true);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const visibleRows = useMemo(() => {
    const trimmed = query.trim();
    const filtered = trimmed
      ? rows.filter((row) => rowMatchesQuery(row, trimmed))
      : [...rows];
    if (!sortKey) return filtered;
    // Stable sort: equal rows keep projection (authority) order.
    return filtered
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const compared = compareRows(left.row, right.row, sortKey);
        const oriented = sortAscending ? compared : -compared;
        return oriented !== 0 ? oriented : left.index - right.index;
      })
      .map((entry) => entry.row);
  }, [query, rows, sortAscending, sortKey]);

  const handleHeaderClick = (key: PinPlannerSortKey): void => {
    if (sortKey === key) {
      setSortAscending((previous) => !previous);
      return;
    }
    setSortKey(key);
    setSortAscending(true);
  };

  const focusRow = (index: number): void => {
    const clamped = Math.max(0, Math.min(index, visibleRows.length - 1));
    rowRefs.current[clamped]?.focus();
  };

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    index: number
  ): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusRow(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusRow(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusRow(0);
        break;
      case 'End':
        event.preventDefault();
        focusRow(visibleRows.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelectRow?.(visibleRows[index]);
        break;
      default:
        break;
    }
  };

  return (
    <div data-testid={testId}>
      <label className="ide-hw-v3__field" htmlFor={`${testId}-search`}>
        Search signals
        <input
          id={`${testId}-search`}
          className="ide-text-input"
          type="search"
          value={query}
          placeholder="Filter by signal, resource, pin, or status"
          onChange={(event) => setQuery(event.target.value)}
          data-testid={`${testId}-search`}
        />
      </label>
      {visibleRows.length === 0 ? (
        <IdeCallout
          tone="info"
          title={rows.length === 0 ? 'Nothing to plan yet' : 'No matching signals'}
          testId={`${testId}-empty`}
        >
          {rows.length === 0
            ? 'Add inputs and outputs in Design, then return here to plan board pins.'
            : 'Clear or adjust the search filter to see the full signal list.'}
        </IdeCallout>
      ) : (
        <div className="ide-hw-v3__table-scroll">
          <table
            className="ide-hw-v3__table"
            data-testid={`${testId}-table`}
            aria-label="Pin planner signal table"
          >
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sortKey === column.key
                        ? sortAscending
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="ide-hw-v3__row-action"
                      onClick={() => handleHeaderClick(column.key)}
                      data-testid={`${testId}-sort-${column.key}`}
                    >
                      {column.label}
                      {sortKey === column.key ? (sortAscending ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr
                  key={row.rowId}
                  ref={(element) => {
                    rowRefs.current[index] = element;
                  }}
                  tabIndex={0}
                  className={
                    'ide-hw-v3__mapping-row ' +
                    (selectedRowId === row.rowId ? 'is-selected ' : '') +
                    (row.status === 'conflict' ? 'is-conflict ' : '') +
                    (row.status === 'unassigned' ? 'is-missing' : '')
                  }
                  aria-selected={selectedRowId === row.rowId}
                  data-testid={`${testId}-row-${row.rowId}`}
                  onClick={() => onSelectRow?.(row)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                >
                  <th scope="row" data-testid={`${testId}-row-logical-${row.rowId}`}>
                    {row.logical}
                  </th>
                  <td>{row.direction === 'in' ? 'Input' : 'Output'}</td>
                  <td data-testid={`${testId}-row-port-${row.rowId}`}>{cellText(row.port)}</td>
                  <td data-testid={`${testId}-row-resource-${row.rowId}`}>
                    {cellText(row.resource)}
                    {row.clockCapable === true ? ' · clock-capable' : ''}
                  </td>
                  <td data-testid={`${testId}-row-pin-${row.rowId}`}>{cellText(row.packagePin)}</td>
                  <td data-testid={`${testId}-row-status-${row.rowId}`}>
                    <span className="ide-hw-v3__status">{STATUS_LABELS[row.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
