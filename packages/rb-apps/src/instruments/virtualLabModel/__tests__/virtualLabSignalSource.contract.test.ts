// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVirtualLabSignalSource } from '../../virtualLabSignalSource';
import type { LabGraph, LabTimeline } from '../types';

const freeze = (value: unknown): void => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
};

const fixture = (): { graph: LabGraph; timeline: LabTimeline } => ({
  graph: {
    nodes: [
      { id: 'nano-1', type: 'arduino-nano', properties: {}, pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } } },
      { id: 'led-1', type: 'led-5mm', properties: {}, pose: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } } },
    ],
    wires: [{ id: 'w1', sourceNodeId: 'nano-1', sourcePinId: 'D13', targetNodeId: 'led-1', targetPinId: 'anode', color: 'green' }],
    net: {},
  },
  timeline: {
    events: [
      { type: 'SIM_PIN_DIFF', tick: 5, seq: 2, source: 'engine', pinDiffs: { 'nano-1:D13': 2.5 } },
      { type: 'SIM_PIN_DIFF', tick: 1, seq: 0, source: 'engine', pinDiffs: { 'nano-1:D13': 5 } },
      { type: 'SIM_PIN_DIFF', tick: 3, seq: 1, source: 'engine', pinDiffs: { 'nano-1:D13': 0 } },
    ], snapshots: [],
  },
});

describe('retained virtual-lab instrument boundary', () => {
  it('samples numeric signals, slices historical transitions, exposes real metadata, and preserves source inputs', () => {
    const { graph, timeline } = fixture();
    const pinStates: Record<string, number> = { 'nano-1:D13': 2.5 };
    const serial = ['hello'];
    const before = JSON.stringify({ graph, timeline, pinStates, serial });
    [graph, timeline, pinStates, serial].forEach(freeze);
    const onLocatePins = vi.fn();
    const onClearSerial = vi.fn();
    const { result, rerender } = renderHook(({ states }) => useVirtualLabSignalSource({
      graph, timeline, pinStates: states, serial, onLocatePins, onClearSerial,
    }), { initialProps: { states: pinStates } });
    const source = result.current.signalSource;
    const net = source.resolveSignal('net:net_2518fcb5');
    const pin = source.resolveSignal('pin:nano-1:D13');
    if (!net || !pin) throw new Error('Fixture signals must resolve');
    expect(source.listSignals()).toContainEqual(net);
    expect(pin.label).toBe('arduino-nano:D13');
    expect(source.sample(net, 999)).toBe(2.5);
    expect(source.sample(pin, 999)).toBe(2.5);
    expect(source.getHistory(net, 2, 5, 1)).toEqual([{ tick: 2, value: 5 }, { tick: 3, value: 0 }, { tick: 5, value: 2.5 }]);
    expect(source.getHistory(pin, 2, 5, 1)).toEqual(source.getHistory(net, 2, 5, 1));
    expect(source.getHistory(net, 2, 5, 3)).toEqual([{ tick: 2, value: 5 }, { tick: 5, value: 2.5 }]);
    expect(source.getMetadata?.(net)).toEqual({ members: 2, pins: [{ nodeId: 'led-1', pinId: 'anode' }, { nodeId: 'nano-1', pinId: 'D13' }] });
    source.locate?.(net);
    expect(onLocatePins).toHaveBeenLastCalledWith([{ nodeId: 'led-1', pinId: 'anode' }, { nodeId: 'nano-1', pinId: 'D13' }]);
    source.locate?.(pin);
    expect(onLocatePins).toHaveBeenLastCalledWith([{ nodeId: 'nano-1', pinId: 'D13' }]);
    expect(source.getSerialLog?.()).toBe(serial);
    source.clearSerialLog?.();
    expect(onClearSerial).toHaveBeenCalledTimes(1);
    expect(source.resolveSignal('net:missing')).toBeNull();
    expect(source.resolveSignal('invalid-prefix')).toBeNull();
    rerender({ states: { 'nano-1:D13': 0 } });
    expect(result.current.signalSource.sample(net, 999)).toBe(0);
    expect(JSON.stringify({ graph, timeline, pinStates, serial })).toBe(before);
  });
});
