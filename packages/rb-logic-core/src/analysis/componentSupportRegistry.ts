import type { IRPrimitiveType } from '../ir/circuitIR';

export type ComponentCapability =
  | 'authoring'
  | 'simulation'
  | 'verification'
  | 'vhdlExport'
  | 'importReconstruction'
  | 'classroom';

export type ComponentCategory = 'logic' | 'sequential' | 'io' | 'source' | 'utility' | 'unsupported';

export type VhdlSupportKind = 'logic' | 'boundary' | 'none';

export type ComponentNodeType =
  | Exclude<IRPrimitiveType, 'UNKNOWN'>
  | 'RSLatch'
  | 'Wire'
  | 'Button'
  | 'CLOCK';

export interface ComponentSupportEntry {
  type: ComponentNodeType;
  label: string;
  category: ComponentCategory;
  capabilities: Readonly<Record<ComponentCapability, boolean>>;
  isSequential?: boolean;
  clockPort?: string;
  resetPort?: string;
  vhdlKind?: VhdlSupportKind;
  importAliases?: readonly string[];
  note?: string;
}

const allCapabilities = (
  overrides: Partial<Record<ComponentCapability, boolean>> = {},
): Readonly<Record<ComponentCapability, boolean>> => ({
  authoring: true,
  simulation: true,
  verification: true,
  vhdlExport: true,
  importReconstruction: true,
  classroom: true,
  ...overrides,
});

const noImport = { importReconstruction: false } as const;
const noAuthoring = { authoring: false, classroom: false } as const;
const boundaryOnly = { importReconstruction: false } as const;

export const COMPONENT_SUPPORT_REGISTRY = [
  {
    type: 'AND',
    label: 'AND gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['and', 'and2', 'and_gate', 'and2_gate', 'lut2_and'],
  },
  {
    type: 'OR',
    label: 'OR gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['or', 'or2', 'or_gate', 'or2_gate'],
  },
  {
    type: 'NOT',
    label: 'NOT gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['not', 'inv', 'inverter', 'not_gate', 'inv_gate'],
  },
  {
    type: 'NAND',
    label: 'NAND gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['nand', 'nand2', 'nand_gate'],
  },
  {
    type: 'NOR',
    label: 'NOR gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['nor', 'nor2', 'nor_gate'],
  },
  {
    type: 'XOR',
    label: 'XOR gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['xor', 'xor2', 'xor_gate'],
  },
  {
    type: 'XNOR',
    label: 'XNOR gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['xnor', 'xnor2', 'xnor_gate', 'xnor2_gate'],
  },
  {
    type: 'AND3',
    label: 'AND3 gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['and3', 'lut3_and'],
  },
  {
    type: 'OR3',
    label: 'OR3 gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['or3'],
  },
  {
    type: 'NAND3',
    label: 'NAND3 gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['nand3'],
  },
  {
    type: 'NOR3',
    label: 'NOR3 gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['nor3'],
  },
  {
    type: 'XOR3',
    label: 'XOR3 gate',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['xor3'],
  },
  {
    type: 'FullAdder',
    label: 'Full adder',
    category: 'logic',
    capabilities: allCapabilities(),
    vhdlKind: 'logic',
    importAliases: ['full_adder', 'fulladder', 'fa', 'full_add'],
  },
  {
    type: 'MUX4',
    label: '4:1 multiplexer',
    category: 'logic',
    capabilities: allCapabilities({ authoring: false, classroom: false, importReconstruction: false }),
    vhdlKind: 'logic',
    importAliases: ['mux4', 'mux_4', 'mux4_1'],
  },
  {
    type: 'DFlipFlop',
    label: 'D flip-flop',
    category: 'sequential',
    capabilities: allCapabilities(),
    isSequential: true,
    clockPort: 'CLK',
    resetPort: 'RST',
    vhdlKind: 'logic',
    importAliases: ['dff', 'd_ff', 'dflipflop', 'd_flip_flop'],
    note: 'clocked_macro v2 - rising-edge D flip-flop',
  },
  {
    type: 'Register1',
    label: '1-bit register',
    category: 'sequential',
    capabilities: allCapabilities(),
    isSequential: true,
    clockPort: 'CLK',
    resetPort: 'RST',
    vhdlKind: 'logic',
    importAliases: ['fdre', 'fdce', 'register1', 'register', 'reg'],
    note: 'native scalar register (D, CLK, optional EN/RST)',
  },
  {
    type: 'RegisterBus',
    label: 'bus register',
    category: 'sequential',
    capabilities: allCapabilities(),
    isSequential: true,
    clockPort: 'CLK',
    resetPort: 'RST',
    vhdlKind: 'logic',
    importAliases: ['registerbus'],
    note: 'native bus register (width-configurable)',
  },
  {
    type: 'StateBank',
    label: 'state bank',
    category: 'sequential',
    capabilities: allCapabilities(),
    isSequential: true,
    clockPort: 'CLK',
    resetPort: 'RST',
    vhdlKind: 'logic',
    importAliases: ['register_bank', 'statebank'],
    note: 'native grouped register/state-bank abstraction',
  },
  {
    type: 'DLatch',
    label: 'D latch',
    category: 'sequential',
    capabilities: allCapabilities({ importReconstruction: false }),
    isSequential: true,
    clockPort: 'EN',
    vhdlKind: 'logic',
    importAliases: ['dlatch', 'd_latch'],
    note: 'level-sensitive D latch; transparent when EN=1, holds when EN=0',
  },
  {
    type: 'TFlipFlop',
    label: 'T flip-flop',
    category: 'sequential',
    capabilities: allCapabilities({ importReconstruction: false }),
    isSequential: true,
    clockPort: 'CLK',
    resetPort: 'CLR',
    vhdlKind: 'logic',
    importAliases: ['tff', 't_flip_flop', 'tflipflop'],
    note: 'clocked_macro v2 - rising-edge T flip-flop with active-high clear',
  },
  {
    type: 'JKFlipFlop',
    label: 'JK flip-flop',
    category: 'sequential',
    capabilities: allCapabilities({ importReconstruction: false }),
    isSequential: true,
    clockPort: 'CLK',
    resetPort: 'CLR',
    vhdlKind: 'logic',
    importAliases: ['jkff', 'jk_flip_flop', 'jkflipflop'],
    note: 'clocked_macro v2 - rising-edge JK flip-flop with active-high clear',
  },
  {
    type: 'RSLatch',
    label: 'RS latch',
    category: 'sequential',
    capabilities: allCapabilities({ vhdlExport: false, importReconstruction: false }),
    isSequential: true,
    vhdlKind: 'none',
    importAliases: ['rslatch', 'rs_latch', 'srlatch', 'sr_latch'],
    note: 'asynchronous SR latch; simulation/theory only in the current export subset',
  },
  {
    type: 'Counter4Bit',
    label: '4-bit counter',
    category: 'unsupported',
    capabilities: allCapabilities({
      authoring: false,
      simulation: false,
      verification: false,
      vhdlExport: false,
      importReconstruction: false,
      classroom: false,
    }),
    isSequential: true,
    clockPort: 'CLK',
    resetPort: 'RST',
    vhdlKind: 'none',
    note: 'stub composite; not safe for student authoring, verification, or export',
  },
  {
    type: 'Delay',
    label: 'delay',
    category: 'unsupported',
    capabilities: allCapabilities({
      authoring: false,
      verification: false,
      vhdlExport: false,
      importReconstruction: false,
      classroom: false,
    }),
    isSequential: true,
    vhdlKind: 'none',
    note: 'simulation utility; not part of the student FPGA support subset',
  },
  {
    type: 'INPUT',
    label: 'Input',
    category: 'io',
    capabilities: allCapabilities(boundaryOnly),
    vhdlKind: 'boundary',
  },
  {
    type: 'OUTPUT',
    label: 'Output',
    category: 'io',
    capabilities: allCapabilities(boundaryOnly),
    vhdlKind: 'boundary',
  },
  {
    type: 'Switch',
    label: 'Switch',
    category: 'io',
    capabilities: allCapabilities({ authoring: false, importReconstruction: false }),
    vhdlKind: 'boundary',
  },
  {
    type: 'Button',
    label: 'Button',
    category: 'io',
    capabilities: allCapabilities({ ...noAuthoring, simulation: false, verification: false, importReconstruction: false }),
    vhdlKind: 'boundary',
  },
  {
    type: 'Clock',
    label: 'Clock',
    category: 'io',
    capabilities: allCapabilities({ authoring: false, importReconstruction: false }),
    vhdlKind: 'boundary',
    note: 'legacy/sim clock node; students use the CLK100MHZ board resource',
  },
  {
    type: 'CLOCK',
    label: 'Clock',
    category: 'io',
    capabilities: allCapabilities({ ...noAuthoring, simulation: false, verification: false, importReconstruction: false }),
    vhdlKind: 'boundary',
    note: 'legacy uppercase clock alias',
  },
  {
    type: 'Lamp',
    label: 'Lamp',
    category: 'io',
    capabilities: allCapabilities({ authoring: false, importReconstruction: false }),
    vhdlKind: 'boundary',
  },
  {
    type: 'PowerSource',
    label: 'Power source',
    category: 'source',
    capabilities: allCapabilities({ authoring: false, importReconstruction: false }),
    vhdlKind: 'logic',
  },
  {
    type: 'Ground',
    label: 'Ground',
    category: 'source',
    capabilities: allCapabilities(noImport),
    vhdlKind: 'logic',
  },
  {
    type: 'Wire',
    label: 'Wire',
    category: 'utility',
    capabilities: allCapabilities({ authoring: false, vhdlExport: false, importReconstruction: false }),
    vhdlKind: 'boundary',
  },
] as const satisfies readonly ComponentSupportEntry[];

const SUPPORT_BY_TYPE = new Map<ComponentNodeType, ComponentSupportEntry>(
  COMPONENT_SUPPORT_REGISTRY.map((entry) => [entry.type, entry]),
);

const IMPORT_ALIAS_MAP = new Map<string, ComponentNodeType>();

for (const entry of COMPONENT_SUPPORT_REGISTRY) {
  if (!entry.capabilities.importReconstruction) continue;
  IMPORT_ALIAS_MAP.set(entry.type.toLowerCase(), entry.type);
  for (const alias of entry.importAliases ?? []) {
    IMPORT_ALIAS_MAP.set(alias.toLowerCase(), entry.type);
  }
}

export function getComponentSupport(type: string): ComponentSupportEntry | undefined {
  return SUPPORT_BY_TYPE.get(type as ComponentNodeType);
}

export function isNodeTypeSupportedFor(type: string, capability: ComponentCapability): boolean {
  return getComponentSupport(type)?.capabilities[capability] === true;
}

export function getSupportedNodeTypesFor(capability: ComponentCapability): ComponentNodeType[] {
  return COMPONENT_SUPPORT_REGISTRY
    .filter((entry) => entry.capabilities[capability])
    .map((entry) => entry.type);
}

export function getVhdlLogicNodeTypes(): ComponentNodeType[] {
  return COMPONENT_SUPPORT_REGISTRY
    .filter((entry) => entry.capabilities.vhdlExport && entry.vhdlKind === 'logic')
    .map((entry) => entry.type);
}

export function getBoundaryInputNodeTypes(): ComponentNodeType[] {
  return COMPONENT_SUPPORT_REGISTRY
    .filter((entry) => entry.vhdlKind === 'boundary' && ['io', 'utility'].includes(entry.category))
    .filter((entry) => entry.type === 'INPUT' || entry.type === 'Switch' || entry.type === 'Button' || entry.type === 'Clock' || entry.type === 'CLOCK')
    .map((entry) => entry.type);
}

export function getBoundaryOutputNodeTypes(): ComponentNodeType[] {
  return COMPONENT_SUPPORT_REGISTRY
    .filter((entry) => entry.vhdlKind === 'boundary')
    .filter((entry) => entry.type === 'OUTPUT' || entry.type === 'Lamp')
    .map((entry) => entry.type);
}

export function getVhdlStatefulNodeTypes(): ComponentNodeType[] {
  return COMPONENT_SUPPORT_REGISTRY
    .filter((entry) => entry.isSequential === true && entry.capabilities.vhdlExport)
    .map((entry) => entry.type);
}

export function getVerificationSequentialNodeTypes(): ComponentNodeType[] {
  return COMPONENT_SUPPORT_REGISTRY
    .filter((entry) => entry.isSequential === true && entry.capabilities.verification)
    .map((entry) => entry.type);
}

export function getBlockedVerificationNodeTypes(): ComponentNodeType[] {
  return COMPONENT_SUPPORT_REGISTRY
    .filter((entry) => entry.isSequential === true && !entry.capabilities.verification)
    .map((entry) => entry.type);
}

export function resolveImportedComponentType(raw: string): ComponentNodeType | null {
  return IMPORT_ALIAS_MAP.get(raw.toLowerCase()) ?? null;
}
