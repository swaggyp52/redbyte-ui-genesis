// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// XDC Import unit tests

import { describe, it, expect } from 'vitest';
import { parseXdcPins } from '../xdcImport';

describe('xdcImport', () => {
  it('parses basic SW0/LD0 mapping', () => {
    const xdc = `
      set_property PACKAGE_PIN V17 [get_ports {SW0}]
      set_property PACKAGE_PIN U16 [get_ports {LD0}]
    `;
    const result = parseXdcPins(xdc);
    expect(result.pinMap).toEqual({ SW0: 'V17', LD0: 'U16' });
    expect(result.warnings).toHaveLength(0);
  });

  it('handles braces and spacing variants', () => {
    const xdc = `
      set_property PACKAGE_PIN V17 [get_ports SW0]
      set_property PACKAGE_PIN U16 [get_ports { LD0 }]
      set_property PACKAGE_PIN V16 [get_ports{SW1}]
    `;
    const result = parseXdcPins(xdc);
    expect(result.pinMap).toEqual({ SW0: 'V17', LD0: 'U16', SW1: 'V16' });
    expect(result.warnings).toHaveLength(0);
  });

  it('warns for unsupported directives and pins', () => {
    const xdc = `
      set_property PACKAGE_PIN V17 [get_ports SW0]
      set_property PACKAGE_PIN INVALID_PIN [get_ports SW2]
      set_property IOSTANDARD LVCMOS33 [get_ports SW0]
      set_property PULLUP TRUE [get_ports SW0]
    `;
    const result = parseXdcPins(xdc);
    expect(result.pinMap).toEqual({ SW0: 'V17', SW2: 'INVALID_PIN' });
    expect(result.warnings).toContain("Unsupported pin 'INVALID_PIN'");
    expect(result.warnings.some(w => w.includes('IOSTANDARD'))).toBe(true);
    expect(result.warnings.some(w => w.includes('Pull-ups/downs'))).toBe(true);
  });
});
