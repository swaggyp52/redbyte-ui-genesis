// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { PinPlannerTable } from '../PinPlannerTable';
import type { PinPlannerRow } from '../pinPlannerProjection';

function plannerRow(overrides: Partial<PinPlannerRow> & { rowId: string }): PinPlannerRow {
  return {
    logical: overrides.rowId.toUpperCase(),
    direction: 'in',
    required: true,
    port: null,
    resource: null,
    resourceLabel: null,
    packagePin: null,
    ioStandard: null,
    clockCapable: null,
    status: 'unassigned',
    ...overrides,
  };
}

const ROWS: PinPlannerRow[] = [
  plannerRow({
    rowId: 'a0',
    logical: 'A0',
    resource: 'SW0',
    packagePin: 'V17',
    ioStandard: 'LVCMOS33',
    clockCapable: false,
    status: 'assigned',
    port: 'sw0',
  }),
  plannerRow({
    rowId: 'sum0',
    logical: 'SUM0',
    direction: 'out',
    resource: 'LD0',
    packagePin: 'U16',
    ioStandard: 'LVCMOS33',
    clockCapable: false,
    status: 'conflict',
  }),
  plannerRow({ rowId: 'en', logical: 'EN' }),
];

function renderTable(overrides: Partial<React.ComponentProps<typeof PinPlannerTable>> = {}) {
  return render(<PinPlannerTable rows={ROWS} {...overrides} />);
}

function visibleLogicals(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll('[data-testid^="rb-pin-planner-row-logical-"]')
  ).map((cell) => cell.textContent ?? '');
}

describe('PinPlannerTable', () => {
  it('renders projection facts and em-dashes for unavailable metadata', () => {
    const { getByTestId } = renderTable();
    expect(getByTestId('rb-pin-planner-row-resource-a0').textContent).toContain('SW0');
    expect(getByTestId('rb-pin-planner-row-pin-a0').textContent).toBe('V17');
    expect(getByTestId('rb-pin-planner-row-port-a0').textContent).toBe('sw0');
    expect(getByTestId('rb-pin-planner-row-status-sum0').textContent).toBe('Conflict');
    // Null metadata renders as absent, never fabricated.
    expect(getByTestId('rb-pin-planner-row-resource-en').textContent).toBe('—');
    expect(getByTestId('rb-pin-planner-row-pin-en').textContent).toBe('—');
    expect(getByTestId('rb-pin-planner-row-port-en').textContent).toBe('—');
  });

  it('filters rows by search text across signal, resource, and pin', () => {
    const { container, getByTestId } = renderTable();
    fireEvent.change(getByTestId('rb-pin-planner-search'), { target: { value: 'u16' } });
    expect(visibleLogicals(container)).toEqual(['SUM0']);
    fireEvent.change(getByTestId('rb-pin-planner-search'), { target: { value: 'zzz' } });
    expect(getByTestId('rb-pin-planner-empty')).toBeTruthy();
  });

  it('sorts by a column on header click and reverses on second click', () => {
    const { container, getByTestId } = renderTable();
    fireEvent.click(getByTestId('rb-pin-planner-sort-logical'));
    expect(visibleLogicals(container)).toEqual(['A0', 'EN', 'SUM0']);
    fireEvent.click(getByTestId('rb-pin-planner-sort-logical'));
    expect(visibleLogicals(container)).toEqual(['SUM0', 'EN', 'A0']);
  });

  it('sorts null package pins last', () => {
    const { container, getByTestId } = renderTable();
    fireEvent.click(getByTestId('rb-pin-planner-sort-packagePin'));
    expect(visibleLogicals(container)).toEqual(['SUM0', 'A0', 'EN']);
  });

  it('ranks conflicts first when sorting by status', () => {
    const { container, getByTestId } = renderTable();
    fireEvent.click(getByTestId('rb-pin-planner-sort-status'));
    expect(visibleLogicals(container)[0]).toBe('SUM0');
  });

  it('selects a row on click', () => {
    const onSelectRow = vi.fn();
    const { getByTestId } = renderTable({ onSelectRow });
    fireEvent.click(getByTestId('rb-pin-planner-row-sum0'));
    expect(onSelectRow).toHaveBeenCalledWith(expect.objectContaining({ rowId: 'sum0' }));
  });

  it('supports keyboard row navigation and Enter selection', () => {
    const onSelectRow = vi.fn();
    const { getByTestId } = renderTable({ onSelectRow });
    const firstRow = getByTestId('rb-pin-planner-row-a0');
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(getByTestId('rb-pin-planner-row-sum0'));
    fireEvent.keyDown(getByTestId('rb-pin-planner-row-sum0'), { key: 'Enter' });
    expect(onSelectRow).toHaveBeenCalledWith(expect.objectContaining({ rowId: 'sum0' }));
    fireEvent.keyDown(getByTestId('rb-pin-planner-row-sum0'), { key: 'End' });
    expect(document.activeElement).toBe(getByTestId('rb-pin-planner-row-en'));
    fireEvent.keyDown(getByTestId('rb-pin-planner-row-en'), { key: 'Home' });
    expect(document.activeElement).toBe(getByTestId('rb-pin-planner-row-a0'));
  });

  it('marks the selected row', () => {
    const { getByTestId } = renderTable({ selectedRowId: 'a0' });
    const row = getByTestId('rb-pin-planner-row-a0');
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.className).toContain('is-selected');
    const table = getByTestId('rb-pin-planner-table');
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
  });
});
