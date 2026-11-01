import { describe, expect, it } from 'vitest';
import { getComponentSupport, type CompositeNodeDef } from '@redbyte/rb-logic-core';
import {
  BUILTIN_COMPONENT_DEFINITIONS,
  COMPONENT_DEFINITION_REGISTRY,
  COMPONENT_DEFINITION_SCHEMA_VERSION,
  createComponentDefinitionRegistry,
  createCustomComponentDefinition,
} from '../componentDefinitions';

const EXPECTED_CURRENT_PALETTE_TYPES = [
  'AND',
  'OR',
  'XOR',
  'NOT',
  'NAND',
  'NOR',
  'XNOR',
  'AND3',
  'OR3',
  'NAND3',
  'NOR3',
  'XOR3',
  'Register1',
  'RegisterBus',
  'StateBank',
  'DFlipFlop',
  'INPUT',
  'OUTPUT',
  'Ground',
  'RSLatch',
  'DLatch',
  'JKFlipFlop',
  'TFlipFlop',
  'FullAdder',
];

describe('ComponentDefinition registry foundation', () => {
  it('preserves the current student palette runtime IDs without adding board resources', () => {
    expect(COMPONENT_DEFINITION_REGISTRY.schemaVersion).toBe(
      COMPONENT_DEFINITION_SCHEMA_VERSION,
    );
    expect(BUILTIN_COMPONENT_DEFINITIONS.map((definition) => definition.runtimeType)).toEqual(
      EXPECTED_CURRENT_PALETTE_TYPES,
    );
    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('SW0')).toBeUndefined();
    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('CLK100MHZ')).toBeUndefined();
    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('Counter4Bit')).toBeUndefined();
  });

  it('projects support truth unless the active product boundary is narrower', () => {
    for (const definition of BUILTIN_COMPONENT_DEFINITIONS) {
      const support = getComponentSupport(definition.runtimeType);
      expect(support, definition.runtimeType).toBeDefined();
      const boundaryLimited =
        definition.runtimeType === 'RegisterBus' || definition.runtimeType === 'StateBank';
      expect(definition.simulationCapability.supported, definition.runtimeType).toBe(
        boundaryLimited ? false : support?.capabilities.simulation,
      );
      expect(definition.exportCapability.supported, definition.runtimeType).toBe(
        boundaryLimited ? false : support?.capabilities.vhdlExport,
      );
      expect(definition.designPalette.authoringCapability.supported, definition.runtimeType).toBe(
        support?.capabilities.authoring,
      );
      expect(definition.designPalette.classroomCapability.supported, definition.runtimeType).toBe(
        support?.capabilities.classroom,
      );
    }

    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('AND')).toMatchObject({
      id: 'AND',
      compatibilityTier: 1,
      hdlOwnership: 'redbyte-generated',
    });
    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('RSLatch')).toMatchObject({
      compatibilityTier: 4,
      exportCapability: { supported: false },
      hdlOwnership: 'none',
    });
  });

  it.each(['RegisterBus', 'StateBank'] as const)(
    'keeps %s Design-visible without claiming Simulate/Verify or export support',
    (runtimeType) => {
      expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType(runtimeType)).toMatchObject({
        runtimeType,
        designPalette: {
          badge: 'Boundary limited',
          authoringCapability: { supported: true, source: 'component-support-registry' },
          classroomCapability: { supported: true, source: 'component-support-registry' },
        },
        simulationCapability: {
          supported: false,
          source: 'active-product-boundary',
          note: expect.stringContaining('does not certify RegisterBus or StateBank'),
        },
        exportCapability: {
          supported: false,
          source: 'active-product-boundary',
          note: expect.stringContaining('does not certify RegisterBus or StateBank'),
        },
        hdlOwnership: 'none',
        compatibilityTier: 4,
        compatibilityNote: expect.stringContaining('Simulate/Verify or VHDL export'),
      });
    },
  );

  it('owns Design palette presentation without collapsing semantic categories', () => {
    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('XNOR')).toMatchObject({
      category: 'comparison',
      displayName: 'XNOR Gate',
      description: 'Equality gate that goes high when inputs match.',
      designPalette: {
        section: 'logic',
        authoringCapability: { supported: true, source: 'component-support-registry' },
        classroomCapability: { supported: true, source: 'component-support-registry' },
      },
    });
    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('Register1')?.designPalette).toMatchObject({
      section: 'sequential',
      sequentialTier: 'registers',
      badge: 'Native',
    });
    expect(COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('TFlipFlop')?.designPalette).toMatchObject({
      section: 'reusable',
      badge: 'Legacy',
    });
  });

  it('uses canonical chip metadata for ports and current defaults for register parameters', () => {
    const andGate = COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('AND');
    expect(andGate?.ports).toEqual([
      expect.objectContaining({ id: 'a', direction: 'input', signalType: 'logic' }),
      expect.objectContaining({ id: 'b', direction: 'input', signalType: 'logic' }),
      expect.objectContaining({ id: 'out', direction: 'output', signalType: 'logic' }),
    ]);

    const busRegister = COMPONENT_DEFINITION_REGISTRY.getByRuntimeType('RegisterBus');
    expect(busRegister?.ports.find((port) => port.id === 'D')?.width).toEqual({
      kind: 'parameter',
      parameterId: 'width',
      defaultBits: 8,
    });
    expect(busRegister?.parameters.find((parameter) => parameter.id === 'width')).toMatchObject({
      defaultValue: 8,
      minimum: 1,
      maximum: 32,
    });
    expect(busRegister?.parameters.find((parameter) => parameter.id === 'clockPolarity')).toMatchObject({
      defaultValue: 'rising_edge',
    });
  });

  it('adapts actual project composites conservatively without claiming general HDL export', () => {
    const custom: CompositeNodeDef = {
      name: 'ParityBlock',
      description: 'Student parity block',
      subcircuit: {
        nodes: [{ id: 'xor', type: 'XOR' }],
        connections: [],
      },
      inputMapping: { A: 'xor.a', B: 'xor.b' },
      outputMapping: { P: 'xor.out' },
    };

    const definition = createCustomComponentDefinition(custom);
    expect(definition).toMatchObject({
      id: 'custom:ParityBlock',
      runtimeType: 'ParityBlock',
      category: 'custom-components',
      designPalette: {
        section: 'reusable',
        badge: 'Custom',
        authoringCapability: { supported: true, source: 'project-composite' },
        classroomCapability: { supported: true, source: 'project-composite' },
      },
      simulationCapability: { supported: true, source: 'project-composite' },
      exportCapability: { supported: false, source: 'project-composite' },
      compatibilityTier: 4,
    });
    expect(definition.ports.map((port) => `${port.direction}:${port.id}`)).toEqual([
      'input:A',
      'input:B',
      'output:P',
    ]);

    const registry = createComponentDefinitionRegistry([custom]);
    expect(registry.getById('custom:ParityBlock')).toMatchObject({
      runtimeType: 'ParityBlock',
      category: 'custom-components',
    });
    expect(registry.getByRuntimeType('ParityBlock')?.displayName).toBe('ParityBlock');
  });
});
