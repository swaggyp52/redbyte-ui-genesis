import { describe, expect, it } from 'vitest';
import {
  allParametersResolved,
  normalizeBindings,
  normalizeParameters,
  parameterKindFromTypeName,
  resolveParameters,
  validateBindings,
  type ModuleParameter,
} from '../moduleParameters';

describe('parameterKindFromTypeName', () => {
  it('maps VHDL generic types, defaulting to unknown', () => {
    expect(parameterKindFromTypeName('integer')).toBe('integer');
    expect(parameterKindFromTypeName('NATURAL')).toBe('natural');
    expect(parameterKindFromTypeName('std_logic')).toBe('std_logic');
    expect(parameterKindFromTypeName('time')).toBe('unknown');
  });
});

describe('normalizeParameters', () => {
  it('dedups by name, sorts, and keeps declared defaults', () => {
    const params = normalizeParameters([
      { name: 'WIDTH', kind: 'integer', defaultValue: '8' },
      { name: 'DEPTH', kind: 'natural' },
      { name: 'WIDTH', kind: 'integer', defaultValue: '16' }, // duplicate ignored
      { name: '', kind: 'integer' }, // dropped
      { name: 'MODE', kind: 'bogus' }, // kind → unknown
    ]);
    expect(params.map((p) => p.name)).toEqual(['DEPTH', 'MODE', 'WIDTH']);
    expect(params.find((p) => p.name === 'WIDTH')?.defaultValue).toBe('8');
    expect(params.find((p) => p.name === 'MODE')?.kind).toBe('unknown');
    expect(params.find((p) => p.name === 'DEPTH')?.defaultValue).toBeUndefined();
  });
});

describe('resolveParameters', () => {
  const params: ModuleParameter[] = [
    { name: 'WIDTH', kind: 'integer', defaultValue: '8' },
    { name: 'DEPTH', kind: 'natural' },
  ];

  it('prefers a binding, falls back to default, else unset', () => {
    const resolved = resolveParameters(params, normalizeBindings([{ name: 'WIDTH', value: '32' }]));
    const byName = Object.fromEntries(resolved.map((r) => [r.name, r]));
    expect(byName.WIDTH).toMatchObject({ value: '32', source: 'binding' });
    expect(byName.DEPTH).toMatchObject({ value: undefined, source: 'unset' });

    const withDefault = resolveParameters(params, []);
    expect(withDefault.find((r) => r.name === 'WIDTH')).toMatchObject({ value: '8', source: 'default' });
  });

  it('reports full resolution only when nothing is unset', () => {
    expect(allParametersResolved(resolveParameters(params, []))).toBe(false);
    expect(
      allParametersResolved(resolveParameters(params, normalizeBindings([{ name: 'DEPTH', value: '4' }])))
    ).toBe(true);
  });
});

describe('validateBindings', () => {
  it('flags a binding for an undeclared parameter', () => {
    const params: ModuleParameter[] = [{ name: 'WIDTH', kind: 'integer' }];
    expect(validateBindings(params, [{ name: 'WIDTH', value: '8' }]).ok).toBe(true);
    const bad = validateBindings(params, [{ name: 'HEIGHT', value: '2' }]);
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toContain('HEIGHT');
  });
});
