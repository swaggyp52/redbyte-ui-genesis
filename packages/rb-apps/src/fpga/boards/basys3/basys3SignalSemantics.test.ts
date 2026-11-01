import { describe, expect, it } from 'vitest';
import { resolveBasys3SignalBinding } from './basys3SignalSemantics';

describe('basys3SignalSemantics', () => {
  it('recognizes a project signal bound to W5 as the Basys3 board clock', () => {
    const binding = resolveBasys3SignalBinding({
      id: 'phase_driver',
      label: 'Phase Driver',
      pin: 'W5',
      direction: 'in',
    });

    expect(binding?.alias).toBe('CLK100MHZ');
    expect(binding?.packagePin).toBe('W5');
    expect(binding?.role).toBe('clock');
  });

  it('preserves reset semantics when a button-backed signal is marked as reset', () => {
    const binding = resolveBasys3SignalBinding({
      id: 'rst',
      label: 'RST',
      pin: 'BTNC',
      direction: 'in',
      timingRole: 'reset',
    });

    expect(binding?.alias).toBe('BTNC');
    expect(binding?.role).toBe('reset');
  });

  it('does not invent the W5 oscillator for an unassigned manual switch clock', () => {
    const binding = resolveBasys3SignalBinding({
      id: 'enter',
      label: 'ENTER',
      pin: '',
      direction: 'in',
      timingRole: 'clock',
      boardResourceType: 'switch',
    });

    expect(binding).toBeNull();
  });

  it('retains the metadata fallback for an explicit dedicated clock row', () => {
    const binding = resolveBasys3SignalBinding({
      id: 'clk',
      label: 'System clock',
      pin: '',
      direction: 'in',
      timingRole: 'clock',
      boardResourceType: 'clock_pin',
    });

    expect(binding).toMatchObject({
      alias: 'CLK100MHZ',
      packagePin: 'W5',
      role: 'clock',
    });
  });
});
