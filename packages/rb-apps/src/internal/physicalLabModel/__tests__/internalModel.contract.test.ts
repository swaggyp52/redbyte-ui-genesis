import { afterEach, describe, expect, it, vi } from 'vitest';
import { FpgaSimEngine } from '../fpga-sim/engine';
import { decodeLabTemplate } from '../decodeLabTemplate';
import type { LabTemplate } from '../labTemplate';
import { repairTimeline } from '../validators';
import type { LabTimeline } from '../types';

const template: LabTemplate = {
  template_version: 'virtual-lab.v1', lab_id: 'fixture', lab_version: '1', name: 'Fixture',
  required_parts: [{ type: 'fpga-basys3', min: 1 }], required_nets: [],
  behavior_checks: [{ id: 'level', type: 'digital_level', pin: { part: 'fpga-basys3', pins: ['SW0'] }, value: 1 }],
};

describe('actual internal physical model boundary', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('does not create sockets, polling timers, or physical writes on import and respects replay mutation guards', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const socket = vi.fn(() => { throw new Error('Unexpected physical connection'); });
    const fetcher = vi.fn(() => { throw new Error('Unexpected physical request'); });
    vi.stubGlobal('WebSocket', socket);
    vi.stubGlobal('fetch', fetcher);
    const { useLabStore } = await import('../store');
    expect(socket).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(useLabStore.getState().getTransportStatus()).toEqual({ type: 'sim', connected: true });
    useLabStore.getState().addNode({ id: 'fpga', type: 'fpga-basys3', properties: {}, pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } } });
    useLabStore.getState().setUserPinState('fpga', 'SW0', 1);
    const event = useLabStore.getState().timeline.events.at(-1);
    expect(event?.type).toBe('SIM_PIN_DIFF');
    if (!event || event.type !== 'SIM_PIN_DIFF') throw new Error('Expected genuine user pin event');
    expect(event.pinDiffs).toEqual({ 'fpga:SW0': 1 });
    expect(event.source).toBe('user');
    useLabStore.getState().setPlaybackMode('replay');
    const before = JSON.stringify(useLabStore.getState().timeline);
    const pinBefore = useLabStore.getState().simulation.pinStates['fpga:SW0'];
    useLabStore.getState().setUserPinState('fpga', 'SW0', 0);
    useLabStore.getState().loadFpgaPreset('fpga', 'blink');
    expect(useLabStore.getState().simulation.pinStates['fpga:SW0']).toBe(pinBefore);
    expect(JSON.stringify(useLabStore.getState().timeline)).toBe(before);
    await useLabStore.getState().activeTransport.disconnect();
    expect(socket).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves the actual numeric passthrough and rising-edge counter behavior without binary assertions', () => {
    const engine = new FpgaSimEngine();
    expect(engine.tick({ SW0: 2.5, SW1: 0 }).LED0).toBe(2.5);
    engine.setPreset('counter');
    engine.tick({ BTN0: 0 }); engine.tick({ BTN0: 1 }); engine.tick({ BTN0: 1 });
    expect(engine.getState().internal.count).toBe(1);
    engine.tick({ BTN0: 0 }); engine.tick({ BTN0: 1 });
    expect(engine.getState().internal.count).toBe(2);
    expect(engine.getState().outputs.LED1).toBe(1);
  });

  it('decodes the real template shape without mutations and rejects malformed behavior payloads', () => {
    const before = JSON.stringify(template);
    expect(decodeLabTemplate(template)).toBe(template);
    expect(JSON.stringify(template)).toBe(before);
    expect(() => decodeLabTemplate({ ...template, behavior_checks: [{ id: 'bad', type: 'digital_level', pin: { part: 'fpga-basys3', pins: ['SW0'] }, value: 'high' }] })).toThrow('Invalid physical lab template structure.');
    expect(() => decodeLabTemplate({ ...template, required_parts: undefined })).toThrow('Invalid physical lab template structure.');
  });

  it('repairs timeline sequence/ticks without changing discriminated payloads or the source', () => {
    const timeline: LabTimeline = { snapshots: [], events: [
      { type: 'SIM_PIN_DIFF', tick: 8, seq: 0, source: 'engine', pinDiffs: { 'fpga:SW0': 1 } },
      { type: 'SERIAL_OUTPUT', tick: 3, seq: 0, source: 'engine', text: 'held' },
    ] };
    const before = JSON.stringify(timeline);
    const repaired = repairTimeline(timeline);
    expect(repaired.repaired.events).toEqual([
      { type: 'SIM_PIN_DIFF', tick: 8, seq: 0, source: 'engine', pinDiffs: { 'fpga:SW0': 1 } },
      { type: 'SERIAL_OUTPUT', tick: 8, seq: 1, source: 'engine', text: 'held' },
    ]);
    expect(JSON.stringify(timeline)).toBe(before);
  });
});
