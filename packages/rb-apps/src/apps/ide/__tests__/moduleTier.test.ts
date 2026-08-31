import { describe, expect, it } from 'vitest';
import { classifyModuleTier, moduleTierLabel, moduleTierRank } from '../moduleTier';

describe('classifyModuleTier', () => {
  it('classifies a native visual module as editable and simulatable', () => {
    const result = classifyModuleTier({ isNativeVisual: true, hasBackingSource: false });
    expect(result.tier).toBe('native-visual-editable');
    expect(result).toMatchObject({ editable: true, simulatable: true });
  });

  it('classifies a referenced-but-unbacked module as missing', () => {
    expect(classifyModuleTier({ isNativeVisual: false, hasBackingSource: false }).tier).toBe('missing');
    // hasBackingSource true but no language is still missing
    expect(classifyModuleTier({ isNativeVisual: false, hasBackingSource: true }).tier).toBe('missing');
  });

  it('classifies a fully-reconstructed HDL source as structural-read-only (no in-place editing today)', () => {
    const result = classifyModuleTier({
      isNativeVisual: false,
      hasBackingSource: true,
      backingLanguage: 'vhdl',
      reconstruction: 'full',
    });
    expect(result.tier).toBe('structural-read-only');
    expect(result.editable).toBe(false);
    expect(result.simulatable).toBe(true);
  });

  it('classifies a ports-only reconstruction as structural-read-only, not simulatable', () => {
    const result = classifyModuleTier({
      isNativeVisual: false,
      hasBackingSource: true,
      backingLanguage: 'verilog',
      reconstruction: 'ports-only',
    });
    expect(result.tier).toBe('structural-read-only');
    expect(result.simulatable).toBe(false);
  });

  it('classifies an unreconstructable or opaque source as opaque-preserved', () => {
    expect(
      classifyModuleTier({ isNativeVisual: false, hasBackingSource: true, backingLanguage: 'vhdl', reconstruction: 'empty' }).tier
    ).toBe('opaque-preserved');
    expect(
      classifyModuleTier({ isNativeVisual: false, hasBackingSource: true, backingLanguage: 'systemverilog', reconstruction: 'none' }).tier
    ).toBe('opaque-preserved');
    // A read-only language (xdc) is never a reconstructable module
    expect(
      classifyModuleTier({ isNativeVisual: false, hasBackingSource: true, backingLanguage: 'xdc', reconstruction: 'full' }).tier
    ).toBe('opaque-preserved');
  });
});

describe('tier ordering and labels', () => {
  it('ranks native highest and missing lowest', () => {
    expect(moduleTierRank('native-visual-editable')).toBeLessThan(moduleTierRank('structural-read-only'));
    expect(moduleTierRank('opaque-preserved')).toBeLessThan(moduleTierRank('missing'));
  });
  it('provides human labels', () => {
    expect(moduleTierLabel('structural-read-only')).toBe('Structural (read-only)');
    expect(moduleTierLabel('missing')).toBe('Missing');
  });
});
