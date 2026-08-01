import {
  getComponentSupport,
  type ComponentCapability,
  type ComponentSupportEntry,
  type CompositeNodeDef,
} from '@redbyte/rb-logic-core';
import { defaultNodeConfig } from './defaultNodeConfig';
import { getDesignChipMetadata } from './designChipMetadata';

export const COMPONENT_DEFINITION_SCHEMA_VERSION = 1 as const;

export type ComponentDefinitionCategory =
  | 'io'
  | 'logic'
  | 'routing'
  | 'arithmetic'
  | 'multiplexing'
  | 'comparison'
  | 'sequential'
  | 'clock-reset'
  | 'memory'
  | 'custom-components'
  | 'code-modules';

export type ComponentSignalType = 'logic' | 'logic-vector';

export type ComponentPortWidth =
  | { kind: 'fixed'; bits: number }
  | { kind: 'parameter'; parameterId: string; defaultBits: number };

export interface ComponentPortDefinition {
  id: string;
  displayName: string;
  direction: 'input' | 'output';
  width: ComponentPortWidth;
  signalType: ComponentSignalType;
  optional: boolean;
}

export interface ComponentParameterDefinition {
  id: string;
  displayName: string;
  kind: 'integer' | 'boolean' | 'enum';
  defaultValue: number | boolean | string;
  options?: readonly string[];
  minimum?: number;
  maximum?: number;
}

export interface ComponentCapabilityDefinition {
  supported: boolean;
  source:
    | 'component-support-registry'
    | 'active-product-boundary'
    | 'project-composite';
  note?: string;
}

export type ComponentDesignPaletteSection = 'io' | 'logic' | 'sequential' | 'reusable';

export interface ComponentDesignPalettePresentation {
  /** Student-facing Design library section. This is separate from the semantic category. */
  section: ComponentDesignPaletteSection;
  sequentialTier?: 'registers' | 'timing' | 'legacy';
  badge?: string;
  authoringCapability: ComponentCapabilityDefinition;
  classroomCapability: ComponentCapabilityDefinition;
}

export type ComponentHdlOwnership =
  | 'redbyte-generated'
  | 'project-composite'
  | 'none';

export type ComponentCompatibilityTier = 1 | 2 | 3 | 4;

export interface ComponentDefinition {
  schemaVersion: typeof COMPONENT_DEFINITION_SCHEMA_VERSION;
  /** Stable presentation ID. Built-ins intentionally retain their serialized node type. */
  id: string;
  /** Existing runtime/serialization node type. This facade never rewrites it. */
  runtimeType: string;
  displayName: string;
  category: ComponentDefinitionCategory;
  description: string;
  symbol: string;
  searchTerms: readonly string[];
  designPalette: ComponentDesignPalettePresentation;
  ports: readonly ComponentPortDefinition[];
  parameters: readonly ComponentParameterDefinition[];
  simulationCapability: ComponentCapabilityDefinition;
  exportCapability: ComponentCapabilityDefinition;
  hdlOwnership: ComponentHdlOwnership;
  compatibilityTier: ComponentCompatibilityTier;
  compatibilityNote: string;
  documentationReference: string;
  deprecationState: 'active' | 'legacy' | 'deprecated';
}

interface BuiltinPresentationEntry {
  runtimeType: string;
  displayName: string;
  category: ComponentDefinitionCategory;
  description: string;
  symbol: string;
  searchTerms: readonly string[];
  designPalette: Omit<
    ComponentDesignPalettePresentation,
    'authoringCapability' | 'classroomCapability'
  >;
  deprecationState?: ComponentDefinition['deprecationState'];
}

const LOGIC_DOC_REFERENCE =
  'docs/manuals/RedByte_Product_Manual.md#appendix-a-logic-primitive-reference';

/**
 * Current student-visible Design palette truth, layered over runtime behavior.
 * DesignSurface projects its built-in cards from these definitions without
 * changing node IDs, serialization, simulation, verification, or export semantics.
 */
const BUILTIN_PRESENTATION_ENTRIES: readonly BuiltinPresentationEntry[] = [
  {
    runtimeType: 'AND',
    displayName: 'AND Gate',
    category: 'logic',
    description: '2-input gate that goes high only when both inputs are high.',
    symbol: 'AND',
    searchTerms: ['gate', 'logic', 'combinational'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'OR',
    displayName: 'OR Gate',
    category: 'logic',
    description: '2-input gate that goes high when either input is high.',
    symbol: 'OR',
    searchTerms: ['gate', 'logic', 'combinational'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'XOR',
    displayName: 'XOR Gate',
    category: 'logic',
    description: 'Exclusive OR for difference and parity checks.',
    symbol: 'XOR',
    searchTerms: ['gate', 'logic', 'exclusive or', 'parity'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'NOT',
    displayName: 'NOT Gate',
    category: 'logic',
    description: 'Single-input inverter for complementing a signal.',
    symbol: 'NOT',
    searchTerms: ['gate', 'logic', 'inverter', 'invert'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'NAND',
    displayName: 'NAND Gate',
    category: 'logic',
    description: 'Universal gate that outputs low only when both inputs are high.',
    symbol: 'NAND',
    searchTerms: ['gate', 'logic', 'universal'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'NOR',
    displayName: 'NOR Gate',
    category: 'logic',
    description: 'Universal gate that outputs high only when both inputs are low.',
    symbol: 'NOR',
    searchTerms: ['gate', 'logic', 'universal'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'XNOR',
    displayName: 'XNOR Gate',
    category: 'comparison',
    description: 'Equality gate that goes high when inputs match.',
    symbol: 'XNOR',
    searchTerms: ['gate', 'logic', 'equality', 'equivalence'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'AND3',
    displayName: 'AND3 Gate',
    category: 'logic',
    description: '3-input AND: high only when all three inputs are high.',
    symbol: 'AND3',
    searchTerms: ['gate', 'logic', 'three input', '3 input'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'OR3',
    displayName: 'OR3 Gate',
    category: 'logic',
    description: '3-input OR: high when any input is high.',
    symbol: 'OR3',
    searchTerms: ['gate', 'logic', 'three input', '3 input'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'NAND3',
    displayName: 'NAND3 Gate',
    category: 'logic',
    description: '3-input NAND: low only when all three inputs are high.',
    symbol: 'NAND3',
    searchTerms: ['gate', 'logic', 'three input', '3 input', 'universal'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'NOR3',
    displayName: 'NOR3 Gate',
    category: 'logic',
    description: '3-input NOR: high only when all three inputs are low.',
    symbol: 'NOR3',
    searchTerms: ['gate', 'logic', 'three input', '3 input', 'universal'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'XOR3',
    displayName: 'XOR3 Gate',
    category: 'logic',
    description: '3-input XOR: high when an odd number of inputs are high.',
    symbol: 'XOR3',
    searchTerms: ['gate', 'logic', 'three input', '3 input', 'parity'],
    designPalette: { section: 'logic' },
  },
  {
    runtimeType: 'Register1',
    displayName: 'Register (1-bit)',
    category: 'sequential',
    description: 'Preferred 1-bit register: width, CE, reset kind, and polarities are first-class.',
    symbol: 'REG1',
    searchTerms: ['register', 'dff', 'state', 'memory', 'fdce', 'sequential', 'flip flop'],
    designPalette: { section: 'sequential', sequentialTier: 'registers', badge: 'Native' },
  },
  {
    runtimeType: 'RegisterBus',
    displayName: 'Register (Bus)',
    category: 'sequential',
    description: 'Packed multi-bit register available for Design inspection; the active product boundary does not certify Simulate/Verify or VHDL export.',
    symbol: 'REGB',
    searchTerms: ['register', 'bus', 'state', 'bank', 'vector', 'slice', 'tap', 'bit'],
    designPalette: { section: 'sequential', sequentialTier: 'registers', badge: 'Boundary limited' },
  },
  {
    runtimeType: 'StateBank',
    displayName: 'State Bank',
    category: 'sequential',
    description: 'Grouped state for Design inspection; the active product boundary does not certify Simulate/Verify or VHDL export.',
    symbol: 'BANK',
    searchTerms: ['state', 'bank', 'register bank', 'fsm', 'sequential'],
    designPalette: { section: 'sequential', sequentialTier: 'registers', badge: 'Boundary limited' },
  },
  {
    runtimeType: 'DFlipFlop',
    displayName: 'DFF',
    category: 'sequential',
    description: 'Classic single-bit D flip-flop — prefer Register (1-bit) for new native projects.',
    symbol: 'DFF',
    searchTerms: ['flip flop', 'flipflop', 'register', 'state', 'memory'],
    designPalette: { section: 'sequential', sequentialTier: 'legacy', badge: 'Legacy' },
    deprecationState: 'legacy',
  },
  {
    runtimeType: 'INPUT',
    displayName: 'Input Pin',
    category: 'io',
    description: 'Generic named input — give it any signal name. To start from a specific Basys3 switch, button, or clock, use Board Resources instead.',
    symbol: 'IN',
    searchTerms: ['input', 'pin', 'source', 'io', 'i/o'],
    designPalette: { section: 'io' },
  },
  {
    runtimeType: 'OUTPUT',
    displayName: 'Output Pin',
    category: 'io',
    description: 'Generic named output — give it any signal name. To start from a specific Basys3 LED or display segment, use Board Resources instead.',
    symbol: 'OUT',
    searchTerms: ['output', 'pin', 'sink', 'probe', 'io', 'i/o'],
    designPalette: { section: 'io' },
  },
  {
    runtimeType: 'Ground',
    displayName: 'Ground',
    category: 'clock-reset',
    description: 'Constant logic 0 source for reset and clear wiring.',
    symbol: '0',
    searchTerms: ['ground', 'constant', 'zero', 'low', 'clear'],
    designPalette: { section: 'io' },
  },
  {
    runtimeType: 'RSLatch',
    displayName: 'RS Latch',
    category: 'sequential',
    description: 'Bistable latch with set/reset. Vivado warns on inferred latches — use Register (1-bit) for FPGA designs. Latches are valid for simulation and theory work.',
    symbol: 'RS',
    searchTerms: ['latch', 'memory', 'state', 'bistable'],
    designPalette: { section: 'reusable', badge: '⚠ Latch' },
  },
  {
    runtimeType: 'DLatch',
    displayName: 'D Latch',
    category: 'sequential',
    description: 'Level-sensitive latch with enable. Vivado warns on inferred latches — use Register (1-bit) for FPGA designs. Latches are valid for simulation and theory work.',
    symbol: 'DL',
    searchTerms: ['latch', 'memory', 'state', 'gated', 'level'],
    designPalette: { section: 'reusable', badge: '⚠ Latch' },
  },
  {
    runtimeType: 'JKFlipFlop',
    displayName: 'JK Flip-Flop',
    category: 'sequential',
    description: 'Toggle-capable sequential primitive with J and K inputs.',
    symbol: 'JK',
    searchTerms: ['flip flop', 'flipflop', 'toggle', 'state'],
    designPalette: { section: 'reusable' },
  },
  {
    runtimeType: 'TFlipFlop',
    displayName: 'T Flip-flop',
    category: 'sequential',
    description: 'Legacy toggle primitive — prefer Register (1-bit) with feedback for new builds.',
    symbol: 'TFF',
    searchTerms: ['flip flop', 'flipflop', 'toggle', 'state', 'tff'],
    designPalette: { section: 'reusable', badge: 'Legacy' },
    deprecationState: 'legacy',
  },
  {
    runtimeType: 'FullAdder',
    displayName: 'Full Adder',
    category: 'arithmetic',
    description: 'Built-in arithmetic block for sum and carry logic.',
    symbol: 'ADD',
    searchTerms: ['adder', 'arithmetic', 'sum', 'carry'],
    designPalette: { section: 'reusable' },
  },
];

const REGISTER_PARAMETER_DEFINITIONS: readonly ComponentParameterDefinition[] = [
  {
    id: 'width',
    displayName: 'Width',
    kind: 'integer',
    defaultValue: 1,
    minimum: 1,
    maximum: 32,
  },
  {
    id: 'hasEnable',
    displayName: 'Clock enable',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    id: 'resetKind',
    displayName: 'Reset mode',
    kind: 'enum',
    defaultValue: 'none',
    options: ['none', 'async_clear', 'async_preset', 'sync_reset', 'sync_set'],
  },
  {
    id: 'resetPolarity',
    displayName: 'Reset polarity',
    kind: 'enum',
    defaultValue: 'active_high',
    options: ['active_high', 'active_low'],
  },
  {
    id: 'enablePolarity',
    displayName: 'Enable polarity',
    kind: 'enum',
    defaultValue: 'active_high',
    options: ['active_high', 'active_low'],
  },
  {
    id: 'clockPolarity',
    displayName: 'Clock edge',
    kind: 'enum',
    defaultValue: 'rising_edge',
    options: ['rising_edge', 'falling_edge'],
  },
];

function withRegisterDefaults(runtimeType: string): readonly ComponentParameterDefinition[] {
  if (!['Register1', 'RegisterBus', 'StateBank'].includes(runtimeType)) return [];
  const defaults = defaultNodeConfig(runtimeType);
  return REGISTER_PARAMETER_DEFINITIONS.map((parameter) => ({
    ...parameter,
    defaultValue: (defaults[parameter.id] as number | boolean | string | undefined) ?? parameter.defaultValue,
  }));
}

function resolvePortWidth(runtimeType: string, portId: string): ComponentPortWidth {
  if (
    (runtimeType === 'RegisterBus' || runtimeType === 'StateBank') &&
    ['D', 'Q', 'Q_inv'].includes(portId)
  ) {
    return { kind: 'parameter', parameterId: 'width', defaultBits: 8 };
  }
  return { kind: 'fixed', bits: 1 };
}

function isOptionalPort(runtimeType: string, portId: string): boolean {
  return ['Register1', 'RegisterBus', 'StateBank'].includes(runtimeType) &&
    (portId === 'EN' || portId === 'RST');
}

function buildPorts(runtimeType: string): readonly ComponentPortDefinition[] {
  const metadata = getDesignChipMetadata(runtimeType);
  if (!metadata) {
    throw new Error(`Component definition is missing chip metadata for "${runtimeType}".`);
  }
  return [
    ...metadata.inputs.map((port) => {
      const width = resolvePortWidth(runtimeType, port.id);
      return {
        id: port.id,
        displayName: port.name,
        direction: 'input' as const,
        width,
        signalType: width.kind === 'fixed' ? ('logic' as const) : ('logic-vector' as const),
        optional: isOptionalPort(runtimeType, port.id),
      };
    }),
    ...metadata.outputs.map((port) => {
      const width = resolvePortWidth(runtimeType, port.id);
      return {
        id: port.id,
        displayName: port.name,
        direction: 'output' as const,
        width,
        signalType: width.kind === 'fixed' ? ('logic' as const) : ('logic-vector' as const),
        optional: false,
      };
    }),
  ];
}

const ACTIVE_PRODUCT_BOUNDARY_LIMITED_COMPONENTS = new Set(['RegisterBus', 'StateBank']);
const ACTIVE_PRODUCT_BOUNDARY_NOTE =
  'The active product boundary does not certify RegisterBus or StateBank for Simulate/Verify or VHDL export. Use Register1 or flatten the state into supported scalar registers.';

function isBlockedByActiveProductBoundary(
  runtimeType: string,
  capabilityName: ComponentCapability,
): boolean {
  return ACTIVE_PRODUCT_BOUNDARY_LIMITED_COMPONENTS.has(runtimeType) &&
    (capabilityName === 'simulation' ||
      capabilityName === 'verification' ||
      capabilityName === 'vhdlExport');
}

function capability(
  support: ComponentSupportEntry,
  name: ComponentCapability,
): ComponentCapabilityDefinition {
  if (isBlockedByActiveProductBoundary(support.type, name)) {
    return {
      supported: false,
      source: 'active-product-boundary',
      note: ACTIVE_PRODUCT_BOUNDARY_NOTE,
    };
  }
  return {
    supported: support.capabilities[name],
    source: 'component-support-registry',
    ...(support.note ? { note: support.note } : {}),
  };
}

function resolveCompatibilityTier(support: ComponentSupportEntry): ComponentCompatibilityTier {
  return capability(support, 'authoring').supported &&
    capability(support, 'simulation').supported &&
    capability(support, 'verification').supported &&
    capability(support, 'vhdlExport').supported
    ? 1
    : 4;
}

function buildBuiltinDefinition(entry: BuiltinPresentationEntry): ComponentDefinition {
  const support = getComponentSupport(entry.runtimeType);
  if (!support) {
    throw new Error(`Component definition is missing support metadata for "${entry.runtimeType}".`);
  }
  const tier = resolveCompatibilityTier(support);
  const simulationCapability = capability(support, 'simulation');
  const exportCapability = capability(support, 'vhdlExport');
  return {
    schemaVersion: COMPONENT_DEFINITION_SCHEMA_VERSION,
    id: entry.runtimeType,
    runtimeType: entry.runtimeType,
    displayName: entry.displayName,
    category: entry.category,
    description: entry.description,
    symbol: entry.symbol,
    searchTerms: [...entry.searchTerms],
    designPalette: {
      ...entry.designPalette,
      authoringCapability: capability(support, 'authoring'),
      classroomCapability: capability(support, 'classroom'),
    },
    ports: buildPorts(entry.runtimeType),
    parameters: withRegisterDefaults(entry.runtimeType),
    simulationCapability,
    exportCapability,
    hdlOwnership: exportCapability.supported ? 'redbyte-generated' : 'none',
    compatibilityTier: tier,
    compatibilityNote:
      ACTIVE_PRODUCT_BOUNDARY_LIMITED_COMPONENTS.has(entry.runtimeType)
        ? ACTIVE_PRODUCT_BOUNDARY_NOTE
        : tier === 1
          ? 'Current support metadata marks authoring, simulation, verification, and VHDL export as supported.'
          : support.note ?? 'One or more native-visual capabilities are not currently supported.',
    documentationReference: LOGIC_DOC_REFERENCE,
    deprecationState: entry.deprecationState ?? 'active',
  };
}

export const BUILTIN_COMPONENT_DEFINITIONS: readonly ComponentDefinition[] =
  BUILTIN_PRESENTATION_ENTRIES.map(buildBuiltinDefinition);

function customComponentId(runtimeType: string): string {
  // CompositeNodeDef has no persisted opaque ID today. This deterministic
  // name key is the compatibility bridge; rename-stable custom IDs remain a
  // future project-schema change rather than something this facade invents.
  return `custom:${encodeURIComponent(runtimeType)}`;
}

export function createCustomComponentDefinition(definition: CompositeNodeDef): ComponentDefinition {
  const ports: ComponentPortDefinition[] = [
    ...Object.keys(definition.inputMapping).map((portId) => ({
      id: portId,
      displayName: portId,
      direction: 'input' as const,
      width: { kind: 'fixed' as const, bits: 1 },
      signalType: 'logic' as const,
      optional: false,
    })),
    ...Object.keys(definition.outputMapping).map((portId) => ({
      id: portId,
      displayName: portId,
      direction: 'output' as const,
      width: { kind: 'fixed' as const, bits: 1 },
      signalType: 'logic' as const,
      optional: false,
    })),
  ];

  return {
    schemaVersion: COMPONENT_DEFINITION_SCHEMA_VERSION,
    id: customComponentId(definition.name),
    runtimeType: definition.name,
    displayName: definition.name,
    category: 'custom-components',
    description: definition.description?.trim() || 'Project-defined visual composite component.',
    symbol: 'CUSTOM',
    searchTerms: ['custom', 'component', definition.name],
    designPalette: {
      section: 'reusable',
      badge: 'Custom',
      authoringCapability: {
        supported: true,
        source: 'project-composite',
      },
      classroomCapability: {
        supported: true,
        source: 'project-composite',
      },
    },
    ports,
    parameters: [],
    simulationCapability: {
      supported: true,
      source: 'project-composite',
      note: 'Current project composites register their existing subcircuit behavior at runtime.',
    },
    exportCapability: {
      supported: false,
      source: 'project-composite',
      note: 'Arbitrary project composites do not have a general standalone HDL export contract.',
    },
    hdlOwnership: 'project-composite',
    compatibilityTier: 4,
    compatibilityNote:
      'Visually authored project composite with current runtime support; general HDL export is not claimed.',
    documentationReference:
      'docs/product/RED_BYTE_V3_COMPATIBILITY_MATRIX.md#ownership-tiers',
    deprecationState: 'active',
  };
}

export interface ComponentDefinitionRegistry {
  schemaVersion: typeof COMPONENT_DEFINITION_SCHEMA_VERSION;
  definitions: readonly ComponentDefinition[];
  getById(id: string): ComponentDefinition | undefined;
  getByRuntimeType(runtimeType: string): ComponentDefinition | undefined;
}

export function createComponentDefinitionRegistry(
  customComponents: readonly CompositeNodeDef[] = [],
): ComponentDefinitionRegistry {
  const definitions = [
    ...BUILTIN_COMPONENT_DEFINITIONS,
    ...customComponents.map(createCustomComponentDefinition),
  ];
  const byId = new Map(definitions.map((definition) => [definition.id, definition] as const));
  const byRuntimeType = new Map(
    definitions.map((definition) => [definition.runtimeType, definition] as const),
  );
  return {
    schemaVersion: COMPONENT_DEFINITION_SCHEMA_VERSION,
    definitions,
    getById: (id) => byId.get(id),
    getByRuntimeType: (runtimeType) => byRuntimeType.get(runtimeType),
  };
}

export const COMPONENT_DEFINITION_REGISTRY = createComponentDefinitionRegistry();
