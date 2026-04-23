import { describe, expect, it } from 'vitest';

import {
  formatBasys3XdcBinding,
  getBasys3BoardResource,
  listBasys3BoardResources,
  resolveBasys3PackagePin,
} from './basys3Pins';

describe('basys3Pins board planner truth', () => {
  it('models the official 100 MHz board clock on W5', () => {
    const clock = getBasys3BoardResource('CLK100MHZ');
    expect(clock?.packagePin).toBe('W5');
    expect(clock?.frequencyMHz).toBe(100);
    expect(clock?.group).toBe('System clock');
    expect(resolveBasys3PackagePin('CLK100MHZ')).toBe('W5');
  });

  it('includes planner-visible switches, buttons, leds, and seven-segment resources', () => {
    const plannerResources = listBasys3BoardResources({ plannerOnly: true });
    expect(plannerResources.filter((resource) => resource.category === 'switch')).toHaveLength(16);
    expect(plannerResources.filter((resource) => resource.category === 'led')).toHaveLength(16);
    expect(plannerResources.filter((resource) => resource.category === 'button')).toHaveLength(5);
    expect(plannerResources.filter((resource) => resource.category === 'seven_seg')).toHaveLength(12);
  });

  it('keeps official catalog-only resources available for board reference', () => {
    const ja0 = getBasys3BoardResource('JA0');
    const vgaSync = getBasys3BoardResource('HSYNC');
    expect(ja0?.packagePin).toBe('J1');
    expect(ja0?.supportedInPlanner).toBe(false);
    expect(vgaSync?.packagePin).toBe('P19');
    expect(vgaSync?.category).toBe('vga');
  });

  it('formats a clock xdc preview with create_clock truth', () => {
    const clock = getBasys3BoardResource('CLK100MHZ');
    expect(clock).toBeTruthy();
    const xdc = formatBasys3XdcBinding(clock!, 'clk');
    expect(xdc).toContain('PACKAGE_PIN W5');
    expect(xdc).toContain('IOSTANDARD LVCMOS33');
    expect(xdc).toContain('create_clock -period 10.000');
  });
});
