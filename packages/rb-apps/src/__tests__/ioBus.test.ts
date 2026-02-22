import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIoBus } from '../apps/ide/ioBus';
import type { RuntimeSimState } from '../apps/ide/sim/simTypes';

const baseSim: RuntimeSimState = {
  tick: 0,
  running: false,
  speedHz: 1,
  irHash: '',
  traceHash: '',
  inputs:  { 'n-sw0': 1, 'n-sw1': 0 },
  signals: { 'n-ld0': 1, 'n-ld1': 0 },
  trace: [],
  selectedSignalKey: null,
  probes: [],
};

const baseIoRows = [
  { nodeId: 'n-sw0', label: 'SW0', direction: 'in'  as const },
  { nodeId: 'n-sw1', label: 'SW1', direction: 'in'  as const },
  { nodeId: 'n-ld0', label: 'LD0', direction: 'out' as const },
  { nodeId: 'n-ld1', label: 'LD1', direction: 'out' as const },
];

describe('useIoBus', () => {
  it('reads sw and ld values from sim state', () => {
    const { result } = renderHook(() =>
      useIoBus({ ioRows: baseIoRows, runtimeSim: baseSim, setInput: vi.fn() })
    );
    expect(result.current.state.sw[0]).toBe(1);
    expect(result.current.state.sw[1]).toBe(0);
    expect(result.current.state.ld[0]).toBe(1);
    expect(result.current.state.ld[1]).toBe(0);
  });

  it('arrays are always length 16/5 even with empty ioRows', () => {
    const { result } = renderHook(() =>
      useIoBus({ ioRows: [], runtimeSim: baseSim, setInput: vi.fn() })
    );
    expect(result.current.state.sw.length).toBe(16);
    expect(result.current.state.ld.length).toBe(16);
    expect(result.current.state.btn.length).toBe(5);
    expect(result.current.state.sw.every((v) => v === 0)).toBe(true);
  });

  it('toggleSwitch calls setInput with the flipped value', () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useIoBus({ ioRows: baseIoRows, runtimeSim: baseSim, setInput })
    );
    act(() => { result.current.actions.toggleSwitch(0); });
    expect(setInput).toHaveBeenCalledWith('n-sw0', 0);
    act(() => { result.current.actions.toggleSwitch(1); });
    expect(setInput).toHaveBeenCalledWith('n-sw1', 1);
  });

  it('actions are no-ops when no mapping exists', () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useIoBus({ ioRows: [], runtimeSim: baseSim, setInput })
    );
    act(() => { result.current.actions.toggleSwitch(0); });
    act(() => { result.current.actions.setSwitch(0, 1); });
    act(() => { result.current.actions.setButton(0, 1); });
    expect(setInput).not.toHaveBeenCalled();
  });

  it('label matching is case-insensitive', () => {
    const rows = [
      { nodeId: 'n-sw3', label: 'sw3', direction: 'in' as const },
      { nodeId: 'n-ld5', label: 'ld5', direction: 'out' as const },
    ];
    const sim: RuntimeSimState = { ...baseSim, inputs: { 'n-sw3': 1 }, signals: { 'n-ld5': 1 } };
    const { result } = renderHook(() =>
      useIoBus({ ioRows: rows, runtimeSim: sim, setInput: vi.fn() })
    );
    expect(result.current.state.sw[3]).toBe(1);
    expect(result.current.state.ld[5]).toBe(1);
  });
});
