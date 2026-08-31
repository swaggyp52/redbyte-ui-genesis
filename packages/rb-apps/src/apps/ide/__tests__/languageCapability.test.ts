import { describe, expect, it } from 'vitest';
import {
  capabilityFor,
  capabilityForFile,
  isReconstructable,
  LANGUAGE_CAPABILITIES,
  neverExecuted,
  summarizeModelCapabilities,
  tierRank,
} from '../languageCapability';
import { addSourceFile, createEmptyProjectSourceModel } from '../projectSourceModel';

describe('capabilityFor', () => {
  it('declares structural-subset for the HDL languages', () => {
    for (const lang of ['vhdl', 'verilog', 'systemverilog'] as const) {
      const cap = capabilityFor(lang);
      expect(cap.tier).toBe('structural-subset');
      expect(cap.status).toBe('available');
      expect(cap.simulatable).toBe(true);
    }
  });

  it('treats XDC as read-only and available', () => {
    expect(capabilityFor('xdc')).toMatchObject({ tier: 'read-only', status: 'available', simulatable: false });
  });

  it('treats VCD as a planned read-only tier', () => {
    expect(capabilityFor('vcd')).toMatchObject({ tier: 'read-only', status: 'planned' });
  });

  it('falls back to unknown for an unrecognized language', () => {
    // @ts-expect-error exercising the runtime fallback
    expect(capabilityFor('cobol').language).toBe('unknown');
  });
});

describe('execution invariant', () => {
  it('never executes any source language — Tcl explicitly', () => {
    expect(neverExecuted('tcl')).toBe(true);
    expect(capabilityFor('tcl')).toMatchObject({ executes: false, tier: 'opaque-preserved' });
    for (const cap of LANGUAGE_CAPABILITIES) expect(cap.executes).toBe(false);
  });
});

describe('reconstructability', () => {
  it('is true only for available structural HDL', () => {
    expect(isReconstructable('vhdl')).toBe(true);
    expect(isReconstructable('verilog')).toBe(true);
    expect(isReconstructable('systemverilog')).toBe(true);
    expect(isReconstructable('xdc')).toBe(false);
    expect(isReconstructable('tcl')).toBe(false);
    expect(isReconstructable('vcd')).toBe(false);
    expect(isReconstructable('unknown')).toBe(false);
  });
});

describe('matrix ordering', () => {
  it('is ordered from most to least capable', () => {
    const ranks = LANGUAGE_CAPABILITIES.map((c) => tierRank(c.tier));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(LANGUAGE_CAPABILITIES).toHaveLength(7);
  });
});

describe('summarizeModelCapabilities', () => {
  it('counts files by what RedByte can do with them', () => {
    let model = createEmptyProjectSourceModel();
    model = addSourceFile(model, { path: 'rtl/top.vhd', text: '' }); // reconstructable
    model = addSourceFile(model, { path: 'rtl/helper.v', text: '' }); // reconstructable
    model = addSourceFile(model, { path: 'top.xdc', text: '' }); // read-only
    model = addSourceFile(model, { path: 'build.tcl', text: '' }); // opaque (never executed)
    model = addSourceFile(model, { path: 'wave.vcd', text: '' }); // opaque (planned read-only)
    expect(summarizeModelCapabilities(model)).toEqual({ total: 5, reconstructable: 2, readOnly: 1, opaque: 2 });
  });

  it('maps a file to its language capability', () => {
    expect(capabilityForFile({ language: 'vhdl' }).displayName).toBe('VHDL');
  });
});
