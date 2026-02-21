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

  it('parses Vivado -dict PACKAGE_PIN format', () => {
    const xdc = `
      set_property -dict { PACKAGE_PIN W5 IOSTANDARD LVCMOS33 } [get_ports clk]
      set_property -dict { PACKAGE_PIN U18 IOSTANDARD LVCMOS33 } [get_ports {btn[0]}]
      set_property -dict { PACKAGE_PIN W7 IOSTANDARD LVCMOS33 } [get_ports {seg[0]}]
      set_property -dict { PACKAGE_PIN V7 IOSTANDARD LVCMOS33 } [get_ports dp]
      set_property -dict { PACKAGE_PIN U2 IOSTANDARD LVCMOS33 } [get_ports {an[0]}]
    `;

    const result = parseXdcPins(xdc);
    expect(result.pinMap).toEqual({
      clk: 'W5',
      'btn[0]': 'U18',
      'seg[0]': 'W7',
      dp: 'V7',
      'an[0]': 'U2',
    });
    expect(result.warnings).toContain('IOSTANDARD ignored (v1 does not configure voltage standards)');
  });

  it('accepts full preset-style 7-seg/button pins without unsupported-pin warnings', () => {
    const xdc = `
      set_property -dict { PACKAGE_PIN T18 IOSTANDARD LVCMOS33 } [get_ports {btn[1]}]
      set_property -dict { PACKAGE_PIN W19 IOSTANDARD LVCMOS33 } [get_ports {btn[2]}]
      set_property -dict { PACKAGE_PIN T17 IOSTANDARD LVCMOS33 } [get_ports {btn[3]}]
      set_property -dict { PACKAGE_PIN U17 IOSTANDARD LVCMOS33 } [get_ports {btn[4]}]
      set_property -dict { PACKAGE_PIN W6 IOSTANDARD LVCMOS33 } [get_ports {seg[1]}]
      set_property -dict { PACKAGE_PIN U8 IOSTANDARD LVCMOS33 } [get_ports {seg[2]}]
      set_property -dict { PACKAGE_PIN V8 IOSTANDARD LVCMOS33 } [get_ports {seg[3]}]
      set_property -dict { PACKAGE_PIN U5 IOSTANDARD LVCMOS33 } [get_ports {seg[4]}]
      set_property -dict { PACKAGE_PIN V5 IOSTANDARD LVCMOS33 } [get_ports {seg[5]}]
      set_property -dict { PACKAGE_PIN U7 IOSTANDARD LVCMOS33 } [get_ports {seg[6]}]
      set_property -dict { PACKAGE_PIN U4 IOSTANDARD LVCMOS33 } [get_ports {an[1]}]
      set_property -dict { PACKAGE_PIN V4 IOSTANDARD LVCMOS33 } [get_ports {an[2]}]
      set_property -dict { PACKAGE_PIN W4 IOSTANDARD LVCMOS33 } [get_ports {an[3]}]
    `;

    const result = parseXdcPins(xdc);
    expect(Object.keys(result.pinMap).length).toBe(13);
    expect(result.warnings.some((warning) => warning.includes('Unsupported pin'))).toBe(false);
  });
});

describe('parseXdcPins — pin confidence', () => {
  it('sets confidence=strong for a known Basys3 package pin (V17)', () => {
    const result = parseXdcPins('set_property PACKAGE_PIN V17 [get_ports {sw0}]');
    expect(result.pinEntries['sw0']?.confidence).toBe('strong');
    expect(result.pinEntries['sw0']?.packagePin).toBe('V17');
  });

  it('sets confidence=weak for an unknown package pin', () => {
    const result = parseXdcPins('set_property PACKAGE_PIN ZZZZ [get_ports {sw0}]');
    expect(result.pinEntries['sw0']?.confidence).toBe('weak');
    expect(result.pinEntries['sw0']?.packagePin).toBe('ZZZZ');
  });

  it('returns pinEntries for all successfully parsed ports', () => {
    const result = parseXdcPins(`
set_property PACKAGE_PIN V17 [get_ports {sw0}]
set_property PACKAGE_PIN V16 [get_ports {sw1}]
set_property PACKAGE_PIN U16 [get_ports {ld0}]
    `);
    expect(Object.keys(result.pinEntries)).toHaveLength(3);
    expect(result.pinEntries['sw0']?.confidence).toBe('strong');
    expect(result.pinEntries['sw1']?.confidence).toBe('strong');
    expect(result.pinEntries['ld0']?.confidence).toBe('strong');
  });

  it('does not add entries for unparsed lines (comments, empty)', () => {
    const result = parseXdcPins('# just a comment\n\n');
    expect(Object.keys(result.pinEntries)).toHaveLength(0);
  });
});
