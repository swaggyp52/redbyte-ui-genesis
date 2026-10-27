import { describe, expect, it } from 'vitest';
import {
  COMPONENT_SUPPORT_REGISTRY,
  NodeRegistry,
  getBlockedVerificationNodeTypes,
  getBoundaryInputNodeTypes,
  getComponentSupport,
  getVerificationSequentialNodeTypes,
  getVhdlLogicNodeTypes,
  getVhdlStatefulNodeTypes,
  isNodeTypeSupportedFor,
  resolveImportedComponentType,
} from '../index';

describe('component support registry', () => {
  it('has one entry per component type', () => {
    const types = COMPONENT_SUPPORT_REGISTRY.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('drives Verify sequential support and blocked support from the same matrix', () => {
    expect(getVerificationSequentialNodeTypes()).toEqual(
      expect.arrayContaining(['DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'RSLatch']),
    );
    expect(getBlockedVerificationNodeTypes()).toEqual(expect.arrayContaining(['Counter4Bit', 'Delay']));
    for (const type of getBlockedVerificationNodeTypes()) {
      expect(getVerificationSequentialNodeTypes()).not.toContain(type);
    }
  });

  it('drives VHDL logic and boundary support without guessing in exporters', () => {
    expect(getVhdlLogicNodeTypes()).toEqual(expect.arrayContaining(['AND', 'NOR', 'XNOR', 'FullAdder', 'DLatch', 'JKFlipFlop']));
    expect(getVhdlStatefulNodeTypes()).toEqual(expect.arrayContaining(['DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'DLatch', 'TFlipFlop', 'JKFlipFlop']));
    expect(getVhdlStatefulNodeTypes()).not.toContain('RSLatch');
    expect(getBoundaryInputNodeTypes()).toEqual(expect.arrayContaining(['INPUT', 'Switch', 'Clock']));
  });

  it('keeps unsupported student stubs out of authoring and export', () => {
    expect(isNodeTypeSupportedFor('Counter4Bit', 'authoring')).toBe(false);
    expect(isNodeTypeSupportedFor('Counter4Bit', 'verification')).toBe(false);
    expect(isNodeTypeSupportedFor('Counter4Bit', 'vhdlExport')).toBe(false);
    expect(getComponentSupport('Counter4Bit')?.note).toContain('stub');
  });

  it('refuses MUX4 like the Counter4Bit stub: the engine has no MUX4 behaviour', () => {
    expect(NodeRegistry.has('MUX4')).toBe(false);
    const mux4 = getComponentSupport('MUX4');
    expect(mux4?.category).toBe('unsupported');
    expect(mux4?.vhdlKind).toBe('none');
    expect(Object.entries(mux4?.capabilities ?? {}).filter(([, supported]) => supported)).toEqual([]);
    expect(mux4?.note).toMatch(/not simulated, verified or exported/);
    expect(getVhdlLogicNodeTypes()).not.toContain('MUX4');
    expect(resolveImportedComponentType('mux4')).toBeNull();
  });

  it('blocks Verify for every non-boundary part it does not simulate or verify, and for no boundary part', () => {
    expect(getBlockedVerificationNodeTypes()).toEqual(['MUX4', 'Counter4Bit', 'Delay']);
    for (const boundary of ['INPUT', 'OUTPUT', 'Switch', 'Button', 'Clock', 'CLOCK', 'Lamp', 'Wire']) {
      expect(getBlockedVerificationNodeTypes()).not.toContain(boundary);
    }
  });

  it('resolves import aliases through the support matrix', () => {
    expect(resolveImportedComponentType('AND2')).toBe('AND');
    expect(resolveImportedComponentType('and3')).toBe('AND3');
    expect(resolveImportedComponentType('FDCE')).toBe('Register1');
    expect(resolveImportedComponentType('full_adder')).toBe('FullAdder');
    expect(resolveImportedComponentType('counter4bit')).toBeNull();
  });

  it('registers every simulatable component that is not a composite-only or boundary artifact', () => {
    expect(NodeRegistry.get('NOR')?.evaluate({ a: 0, b: 0 }).outputs.out).toBe(1);
    expect(NodeRegistry.get('XNOR')?.evaluate({ a: 1, b: 1 }).outputs.out).toBe(1);
    expect(NodeRegistry.get('XNOR')?.evaluate({ a: 1, b: 0 }).outputs.out).toBe(0);
  });
});
