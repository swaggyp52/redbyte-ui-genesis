// @vitest-environment jsdom

import { act } from '@testing-library/react';
import { materializeIoMappingFromHardwareMappingV2 } from '@redbyte/rb-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectRuntime } from '../projectRuntime';

describe('projectRuntime from-scratch mapping', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.getState().startBlankProject();
  });

  it('maps a visible boundary row after palette placement and rename', () => {
    act(() => {
      useProjectRuntime.getState().addDesignNode('INPUT', { x: 120, y: 120 });
    });

    let state = useProjectRuntime.getState();
    const inputNode = state.circuit.nodes.find((node) => node.type === 'INPUT');
    expect(inputNode?.id).toBeTruthy();

    act(() => {
      const current = useProjectRuntime.getState();
      useProjectRuntime.getState().applyCircuitMutation({
        nodes: current.circuit.nodes.map((node) =>
          node.id === inputNode?.id ? { ...node, label: 'A' } : node
        ),
        connections: structuredClone(current.circuit.connections),
      });
    });

    state = useProjectRuntime.getState();
    const row = state.projectIoRows.find((candidate) => candidate.label === 'A');
    expect(row?.id).toBe('a');
    expect(
      state.hardwareMappingV2.entries.some((entry) => entry.kind === 'scalar' && entry.id === 'a')
    ).toBe(true);

    act(() => {
      useProjectRuntime.getState().setMappingPin('a', 'SW0');
    });

    state = useProjectRuntime.getState();
    expect(state.projectIoRows.find((candidate) => candidate.id === 'a')?.pin).toBe('SW0');
    const materialized = materializeIoMappingFromHardwareMappingV2(state.hardwareMappingV2);
    expect(materialized.inputs.some((entry) => entry.id === 'a' && entry.pin === 'SW0')).toBe(true);
  });
});
