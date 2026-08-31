// @vitest-environment jsdom

import { act } from '@testing-library/react';
import { busRangeLabel } from '@redbyte/rb-logic-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectRuntime } from '../projectRuntime';

describe('projectRuntime.createDesignBus', () => {
  beforeEach(() => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
    });
  });

  it('creates a declared bus with member nodes and IO rows', () => {
    let outcome: { ok: boolean } = { ok: false };
    act(() => {
      outcome = useProjectRuntime
        .getState()
        .createDesignBus({ name: 'A', direction: 'input', width: 4 });
    });
    expect(outcome.ok).toBe(true);

    const state = useProjectRuntime.getState();
    expect(state.circuit.buses).toHaveLength(1);
    expect(busRangeLabel(state.circuit.buses![0])).toBe('A[3:0]');
    // Four labeled INPUT member nodes.
    const members = state.circuit.nodes.filter((node) => node.type === 'INPUT');
    expect(members.map((node) => node.label).sort()).toEqual(['A[0]', 'A[1]', 'A[2]', 'A[3]']);
    // Each member has a project IO row so Board/Simulate see the bits.
    const busRows = state.projectIoRows.filter((row) => (row.label ?? '').startsWith('A['));
    expect(busRows).toHaveLength(4);
    expect(busRows.every((row) => row.direction === 'in')).toBe(true);
  });

  it('is undoable as one design edit', () => {
    act(() => {
      useProjectRuntime.getState().createDesignBus({ name: 'A', direction: 'input', width: 4 });
    });
    expect(useProjectRuntime.getState().circuit.buses).toHaveLength(1);
    act(() => {
      useProjectRuntime.getState().undoProjectEdit();
    });
    const state = useProjectRuntime.getState();
    expect(state.circuit.buses ?? []).toHaveLength(0);
    expect(state.circuit.nodes.filter((node) => node.type === 'INPUT')).toHaveLength(0);
  });

  it('rejects a duplicate bus name without mutating state', () => {
    act(() => {
      useProjectRuntime.getState().createDesignBus({ name: 'A', direction: 'input', width: 4 });
    });
    let outcome: { ok: boolean; error?: string } = { ok: true };
    act(() => {
      outcome = useProjectRuntime
        .getState()
        .createDesignBus({ name: 'A', direction: 'input', width: 2 });
    });
    expect(outcome.ok).toBe(false);
    expect(useProjectRuntime.getState().circuit.buses).toHaveLength(1);
  });

  it('rejects an invalid identifier name', () => {
    let outcome: { ok: boolean } = { ok: true };
    act(() => {
      outcome = useProjectRuntime
        .getState()
        .createDesignBus({ name: '2bad', direction: 'output', width: 4 });
    });
    expect(outcome.ok).toBe(false);
    expect(useProjectRuntime.getState().circuit.buses ?? []).toHaveLength(0);
  });
});
