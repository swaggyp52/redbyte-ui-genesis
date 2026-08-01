import { compareCodepoint } from '../../../export/codepointSort';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';

export const BASYS3_CLOCK_PIN = 'W5';
export const BASYS3_DP_PIN = 'V7';
export const BASYS3_BOARD_PROFILE_SCHEMA_VERSION = 1 as const;
export const BASYS3_BOARD_PROFILE_ID = 'digilent.basys3';
export const BASYS3_BOARD_PROFILE_VERSION = '1.0.0';
export const BASYS3_DEFAULT_IO_STANDARD = 'LVCMOS33' as const;

export interface Basys3BoardProfileProvenance {
  readonly id:
    | 'digilent-basys3-resource-center'
    | 'digilent-basys3-reference-manual'
    | 'digilent-basys3-master-xdc'
    | 'digilent-basys3-schematic';
  readonly title: string;
  readonly documentId?: string;
  readonly revision: string;
  readonly publishedOn?: string;
  readonly retrievedOn: '2026-08-01';
  readonly url: string;
  readonly governs: readonly string[];
}

export const BASYS3_BOARD_PROFILE_PROVENANCE: readonly Basys3BoardProfileProvenance[] =
  Object.freeze([
    Object.freeze({
      id: 'digilent-basys3-resource-center',
      title: 'Digilent Basys 3 Resource Center',
      revision: 'Living product resource center',
      retrievedOn: '2026-08-01',
      url: 'https://digilent.com/reference/programmable-logic/basys-3/start',
      governs: Object.freeze([
        'canonical product resource index',
        'official manual and schematic routing',
        'FPGA part reference',
      ]),
    }),
    Object.freeze({
      id: 'digilent-basys3-reference-manual',
      title: 'Digilent Basys 3 FPGA Board Reference Manual',
      documentId: 'DOC#502-183',
      revision: 'Rev C',
      publishedOn: '2019-07-10',
      retrievedOn: '2026-08-01',
      url: 'https://digilent.com/reference/_media/reference/programmable-logic/basys-3/basys3_rm.pdf',
      governs: Object.freeze([
        'board identity',
        'FPGA part',
        'physical resource inventory',
        '100 MHz oscillator identity',
      ]),
    }),
    Object.freeze({
      id: 'digilent-basys3-master-xdc',
      title: 'Digilent Basys-3-Master.xdc',
      revision: 'Rev B',
      retrievedOn: '2026-08-01',
      url: 'https://github.com/Digilent/digilent-xdc/blob/master/Basys-3-Master.xdc',
      governs: Object.freeze([
        'resource aliases',
        'package pins',
        'LVCMOS33 defaults',
        'primary clock constraint reference',
      ]),
    }),
    Object.freeze({
      id: 'digilent-basys3-schematic',
      title: 'Digilent Basys 3 Public Schematic',
      documentId: 'DOC#500-183',
      revision: 'Rev D.1',
      publishedOn: '2021-02-05',
      retrievedOn: '2026-08-01',
      url: 'https://digilent.com/reference/_media/reference/programmable-logic/basys-3/basys-3-sch-public-rev-d.pdf',
      governs: Object.freeze([
        'physical resource cross-check',
        'resource grouping',
        'differential relationship reference',
      ]),
    }),
  ]);

export const BASYS3_SWITCH_PINS = [
  'V17', 'V16', 'W16', 'W17', 'W15', 'V15', 'W14', 'W13',
  'V2', 'T3', 'T2', 'R3', 'W2', 'U1', 'T1', 'R2',
] as const;

export const BASYS3_LED_PINS = [
  'U16', 'E19', 'U19', 'V19', 'W18', 'U15', 'U14', 'V14',
  'V13', 'V3', 'W3', 'U3', 'P3', 'N3', 'P1', 'L1',
] as const;

export const BASYS3_BUTTON_PINS = ['U18', 'T18', 'W19', 'T17', 'U17'] as const;
export const BASYS3_SEGMENT_PINS = ['W7', 'W6', 'U8', 'V8', 'U5', 'V5', 'U7'] as const;
export const BASYS3_ANODE_PINS = ['U2', 'U4', 'V4', 'W4'] as const;
export const BASYS3_SEGMENT_ALIASES = ['CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG'] as const;

export type Basys3BoardResourceCategory =
  | 'clock'
  | 'switch'
  | 'button'
  | 'led'
  | 'seven_seg'
  | 'pmod'
  | 'xadc'
  | 'vga'
  | 'uart'
  | 'ps2'
  | 'qspi';

export type Basys3BoardResourceDirection = 'in' | 'out' | 'inout' | 'system';
export type Basys3AssignableSignalDirection = 'in' | 'out';
export type Basys3CompatibleSignalCategory =
  | 'clock'
  | 'reset'
  | 'control'
  | 'data'
  | 'top-level-input'
  | 'top-level-output';

export interface Basys3SignalCompatibilityCandidate {
  readonly direction: Basys3AssignableSignalDirection;
  readonly timingRole?: HardwareTimingRole;
  readonly boardResourceType?: HardwareBoardResourceType;
}

export interface Basys3BoardVisualCoordinate {
  readonly coordinateSpace: 'basys3-board-620x260-v1';
  readonly x: number;
  readonly y: number;
}

export interface Basys3DifferentialRelationship {
  readonly pairedResourceId: string;
  readonly polarity: 'positive' | 'negative';
}

export interface Basys3BoardResource {
  id: string;
  alias: string;
  label: string;
  packagePin: string;
  category: Basys3BoardResourceCategory;
  group: string;
  direction: Basys3BoardResourceDirection;
  xdcPort: string;
  ioStandard: typeof BASYS3_DEFAULT_IO_STANDARD;
  supportedInPlanner: boolean;
  /** Null means the current official-source projection does not model a differential mate. */
  differentialRelationship: Basys3DifferentialRelationship | null;
  /** Null means the current board visual does not yet place this catalog resource. */
  visualCoordinate: Basys3BoardVisualCoordinate | null;
  compatibleSignalCategories: readonly Basys3CompatibleSignalCategory[];
  documentationReferences: readonly Basys3BoardProfileProvenance['id'][];
  frequencyMHz?: number;
  activeLow?: boolean;
  note?: string;
}

type Basys3BoardResourceInput = Omit<
  Basys3BoardResource,
  | 'ioStandard'
  | 'differentialRelationship'
  | 'visualCoordinate'
  | 'compatibleSignalCategories'
  | 'documentationReferences'
> & {
  ioStandard?: Basys3BoardResource['ioStandard'];
  differentialRelationship?: Basys3DifferentialRelationship | null;
  visualCoordinate?: Basys3BoardVisualCoordinate | null;
  compatibleSignalCategories?: readonly Basys3CompatibleSignalCategory[];
  documentationReferences?: readonly Basys3BoardProfileProvenance['id'][];
};

function resource(input: Basys3BoardResourceInput): Basys3BoardResource {
  return {
    ...input,
    ioStandard: input.ioStandard ?? BASYS3_DEFAULT_IO_STANDARD,
    differentialRelationship: input.differentialRelationship ?? null,
    visualCoordinate: input.visualCoordinate ?? deriveCurrentBoardVisualCoordinate(input.alias),
    compatibleSignalCategories:
      input.compatibleSignalCategories ?? deriveCompatibleSignalCategories(input),
    documentationReferences: input.documentationReferences ?? [
      'digilent-basys3-resource-center',
      'digilent-basys3-reference-manual',
      'digilent-basys3-master-xdc',
      'digilent-basys3-schematic',
    ],
  };
}

function deriveCurrentBoardVisualCoordinate(alias: string): Basys3BoardVisualCoordinate | null {
  const indexed = /^(SW|LD)(\d+)$/i.exec(alias);
  if (indexed) {
    const index = Number.parseInt(indexed[2], 10);
    if (index >= 0 && index < 16) {
      return {
        coordinateSpace: 'basys3-board-620x260-v1',
        x: 48 + (15 - index) * 36,
        y: indexed[1].toUpperCase() === 'SW' ? 199 : 40,
      };
    }
  }
  const buttonCoordinates: Readonly<Record<string, readonly [number, number]>> = {
    BTNC: [155, 135],
    BTNU: [155, 108],
    BTND: [155, 162],
    BTNL: [128, 135],
    BTNR: [182, 135],
  };
  const button = buttonCoordinates[alias.toUpperCase()];
  return button
    ? { coordinateSpace: 'basys3-board-620x260-v1', x: button[0], y: button[1] }
    : null;
}

function deriveCompatibleSignalCategories(
  input: Pick<Basys3BoardResource, 'category' | 'direction'>
): readonly Basys3CompatibleSignalCategory[] {
  const boundary = input.direction === 'out'
    ? 'top-level-output'
    : input.direction === 'in'
      ? 'top-level-input'
      : null;
  const semantic: Basys3CompatibleSignalCategory[] =
    input.category === 'clock'
      ? ['clock', 'control']
      : input.category === 'button'
        ? ['control', 'reset', 'data']
        : input.category === 'switch'
          ? ['control', 'reset', 'data']
          : ['data'];
  if (boundary) semantic.push(boundary);
  else if (input.direction === 'inout') semantic.push('top-level-input', 'top-level-output');
  return semantic;
}

const BASYS3_SWITCH_RESOURCES = BASYS3_SWITCH_PINS.map((packagePin, index) =>
  resource({
    id: `switch-${index}`,
    alias: `SW${index}`,
    label: `Slide switch SW${index}`,
    packagePin,
    category: 'switch',
    group: 'Slide switches',
    direction: 'in',
    xdcPort: `sw[${index}]`,
    supportedInPlanner: true,
  })
);

const BASYS3_LED_RESOURCES = BASYS3_LED_PINS.map((packagePin, index) =>
  resource({
    id: `led-${index}`,
    alias: `LD${index}`,
    label: `LED LD${index}`,
    packagePin,
    category: 'led',
    group: 'LEDs',
    direction: 'out',
    xdcPort: `led[${index}]`,
    supportedInPlanner: true,
  })
);

const BASYS3_BUTTON_ALIASES = ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'] as const;
const BASYS3_BUTTON_LABELS = ['Center pushbutton', 'Up pushbutton', 'Left pushbutton', 'Right pushbutton', 'Down pushbutton'] as const;
const BASYS3_BUTTON_PORTS = ['btnC', 'btnU', 'btnL', 'btnR', 'btnD'] as const;
const BASYS3_BUTTON_RESOURCES = BASYS3_BUTTON_PINS.map((packagePin, index) =>
  resource({
    id: `button-${BASYS3_BUTTON_ALIASES[index].toLowerCase()}`,
    alias: BASYS3_BUTTON_ALIASES[index],
    label: `${BASYS3_BUTTON_LABELS[index]} ${BASYS3_BUTTON_ALIASES[index]}`,
    packagePin,
    category: 'button',
    group: 'Pushbuttons',
    direction: 'in',
    xdcPort: BASYS3_BUTTON_PORTS[index],
    supportedInPlanner: true,
  })
);

const BASYS3_SEGMENT_RESOURCES = BASYS3_SEGMENT_PINS.map((packagePin, index) =>
  resource({
    id: `seven-seg-${BASYS3_SEGMENT_ALIASES[index].toLowerCase()}`,
    alias: BASYS3_SEGMENT_ALIASES[index],
    label: `7-segment cathode ${BASYS3_SEGMENT_ALIASES[index]}`,
    packagePin,
    category: 'seven_seg',
    group: 'Seven-segment display',
    direction: 'out',
    xdcPort: `seg[${index}]`,
    supportedInPlanner: true,
    activeLow: true,
  })
);

const BASYS3_ANODE_RESOURCES = BASYS3_ANODE_PINS.map((packagePin, index) =>
  resource({
    id: `seven-seg-an${index}`,
    alias: `AN${index}`,
    label: `7-segment digit enable AN${index}`,
    packagePin,
    category: 'seven_seg',
    group: 'Seven-segment display',
    direction: 'out',
    xdcPort: `an[${index}]`,
    supportedInPlanner: true,
    activeLow: true,
  })
);

function indexedCatalogResources(
  prefix: string,
  category: Basys3BoardResourceCategory,
  group: string,
  pins: readonly string[],
  direction: Basys3BoardResourceDirection,
  xdcPrefix = prefix
): Basys3BoardResource[] {
  return pins.map((packagePin, index) =>
    resource({
      id: `${prefix.toLowerCase()}-${index}`,
      alias: `${prefix}${index}`,
      label: `${group} ${prefix}${index}`,
      packagePin,
      category,
      group,
      direction,
      xdcPort: `${xdcPrefix}[${index}]`,
      supportedInPlanner: false,
      note: 'Official Basys3 XDC resource; catalog reference only in the current classroom planner.',
    })
  );
}

export const BASYS3_BOARD_RESOURCES: readonly Basys3BoardResource[] = [
  resource({
    id: 'clock-clk100mhz',
    alias: 'CLK100MHZ',
    label: '100 MHz oscillator CLK100MHZ',
    packagePin: BASYS3_CLOCK_PIN,
    category: 'clock',
    group: 'System clock',
    direction: 'in',
    xdcPort: 'clk',
    supportedInPlanner: true,
    frequencyMHz: 100,
    note: 'Official Basys3 master XDC clock resource with 10 ns clock period.',
  }),
  ...BASYS3_SWITCH_RESOURCES,
  ...BASYS3_LED_RESOURCES,
  ...BASYS3_BUTTON_RESOURCES,
  ...BASYS3_SEGMENT_RESOURCES,
  resource({
    id: 'seven-seg-dp',
    alias: 'DP',
    label: '7-segment decimal point DP',
    packagePin: BASYS3_DP_PIN,
    category: 'seven_seg',
    group: 'Seven-segment display',
    direction: 'out',
    xdcPort: 'dp',
    supportedInPlanner: true,
    activeLow: true,
  }),
  ...BASYS3_ANODE_RESOURCES,
  ...indexedCatalogResources('JA', 'pmod', 'Pmod JA', ['J1', 'L2', 'J2', 'G2', 'H1', 'K2', 'H2', 'G3'], 'inout'),
  ...indexedCatalogResources('JB', 'pmod', 'Pmod JB', ['A14', 'A16', 'B15', 'B16', 'A15', 'A17', 'C15', 'C16'], 'inout'),
  ...indexedCatalogResources('JC', 'pmod', 'Pmod JC', ['K17', 'M18', 'N17', 'P18', 'L17', 'M19', 'P17', 'R18'], 'inout'),
  ...indexedCatalogResources('JXADC', 'xadc', 'XADC Pmod', ['J3', 'L3', 'M2', 'N2', 'K3', 'M3', 'M1', 'N1'], 'inout'),
  ...indexedCatalogResources('VGARED', 'vga', 'VGA red', ['G19', 'H19', 'J19', 'N19'], 'out', 'vgaRed'),
  ...indexedCatalogResources('VGABLUE', 'vga', 'VGA blue', ['N18', 'L18', 'K18', 'J18'], 'out', 'vgaBlue'),
  ...indexedCatalogResources('VGAGREEN', 'vga', 'VGA green', ['J17', 'H17', 'G17', 'D17'], 'out', 'vgaGreen'),
  resource({
    id: 'vga-hsync',
    alias: 'HSYNC',
    label: 'VGA horizontal sync',
    packagePin: 'P19',
    category: 'vga',
    group: 'VGA connector',
    direction: 'out',
    xdcPort: 'Hsync',
    supportedInPlanner: false,
    note: 'Official Basys3 XDC resource; catalog reference only in the current classroom planner.',
  }),
  resource({
    id: 'vga-vsync',
    alias: 'VSYNC',
    label: 'VGA vertical sync',
    packagePin: 'R19',
    category: 'vga',
    group: 'VGA connector',
    direction: 'out',
    xdcPort: 'Vsync',
    supportedInPlanner: false,
    note: 'Official Basys3 XDC resource; catalog reference only in the current classroom planner.',
  }),
  resource({
    id: 'uart-rsrx',
    alias: 'RSRX',
    label: 'USB-UART receive RsRx',
    packagePin: 'B18',
    category: 'uart',
    group: 'USB-UART',
    direction: 'in',
    xdcPort: 'RsRx',
    supportedInPlanner: false,
    note: 'Official Basys3 XDC resource; catalog reference only in the current classroom planner.',
  }),
  resource({
    id: 'uart-rstx',
    alias: 'RSTX',
    label: 'USB-UART transmit RsTx',
    packagePin: 'A18',
    category: 'uart',
    group: 'USB-UART',
    direction: 'out',
    xdcPort: 'RsTx',
    supportedInPlanner: false,
    note: 'Official Basys3 XDC resource; catalog reference only in the current classroom planner.',
  }),
  resource({
    id: 'ps2-clk',
    alias: 'PS2CLK',
    label: 'PS/2 clock',
    packagePin: 'C17',
    category: 'ps2',
    group: 'USB HID / PS/2',
    direction: 'inout',
    xdcPort: 'PS2Clk',
    supportedInPlanner: false,
    note: 'Official Basys3 XDC resource with pull-up; catalog reference only in the current classroom planner.',
  }),
  resource({
    id: 'ps2-data',
    alias: 'PS2DATA',
    label: 'PS/2 data',
    packagePin: 'B17',
    category: 'ps2',
    group: 'USB HID / PS/2',
    direction: 'inout',
    xdcPort: 'PS2Data',
    supportedInPlanner: false,
    note: 'Official Basys3 XDC resource with pull-up; catalog reference only in the current classroom planner.',
  }),
  ...indexedCatalogResources('QSPIDB', 'qspi', 'Quad SPI flash data', ['D18', 'D19', 'G18', 'F18'], 'inout', 'QspiDB'),
  resource({
    id: 'qspi-csn',
    alias: 'QSPICSN',
    label: 'Quad SPI flash chip select',
    packagePin: 'K19',
    category: 'qspi',
    group: 'Quad SPI flash',
    direction: 'out',
    xdcPort: 'QspiCSn',
    supportedInPlanner: false,
    note: 'Official Basys3 XDC resource; catalog reference only in the current classroom planner.',
  }),
] as const;

export interface Basys3BoardResourceGroup {
  readonly id: string;
  readonly label: string;
  readonly resourceIds: readonly string[];
}

export interface Basys3BoardProfile {
  readonly schemaVersion: typeof BASYS3_BOARD_PROFILE_SCHEMA_VERSION;
  readonly id: typeof BASYS3_BOARD_PROFILE_ID;
  readonly version: typeof BASYS3_BOARD_PROFILE_VERSION;
  readonly boardId: 'basys3';
  readonly boardName: 'Digilent Basys 3';
  readonly fpgaPart: 'xc7a35tcpg236-1';
  readonly defaultIoStandard: typeof BASYS3_DEFAULT_IO_STANDARD;
  readonly resources: readonly Basys3BoardResource[];
  readonly resourceGroups: readonly Basys3BoardResourceGroup[];
  readonly provenance: readonly Basys3BoardProfileProvenance[];
  readonly proofBoundary: string;
}

export const BASYS3_BOARD_RESOURCE_GROUPS: readonly Basys3BoardResourceGroup[] =
  buildResourceGroups(BASYS3_BOARD_RESOURCES);

/**
 * Versioned board facts for UI projection and generated-constraint planning.
 * This metadata is official-source reference truth, not Vivado execution or
 * physical-board evidence.
 */
export const BASYS3_BOARD_PROFILE: Basys3BoardProfile = Object.freeze({
  schemaVersion: BASYS3_BOARD_PROFILE_SCHEMA_VERSION,
  id: BASYS3_BOARD_PROFILE_ID,
  version: BASYS3_BOARD_PROFILE_VERSION,
  boardId: 'basys3',
  boardName: 'Digilent Basys 3',
  fpgaPart: 'xc7a35tcpg236-1',
  defaultIoStandard: BASYS3_DEFAULT_IO_STANDARD,
  resources: BASYS3_BOARD_RESOURCES,
  resourceGroups: BASYS3_BOARD_RESOURCE_GROUPS,
  provenance: BASYS3_BOARD_PROFILE_PROVENANCE,
  proofBoundary:
    'Reference metadata and Browser-E0 assignment support only; no Vivado execution or physical-board behavior is proven.',
});

const BASYS3_RESOURCE_BY_ALIAS = new Map<string, Basys3BoardResource>(
  BASYS3_BOARD_RESOURCES.map((entry) => [entry.alias.toUpperCase(), entry])
);
const BASYS3_RESOURCE_BY_PACKAGE_PIN = new Map<string, Basys3BoardResource>();
for (const entry of BASYS3_BOARD_RESOURCES) {
  if (!BASYS3_RESOURCE_BY_PACKAGE_PIN.has(entry.packagePin)) {
    BASYS3_RESOURCE_BY_PACKAGE_PIN.set(entry.packagePin, entry);
  }
}

function indexAliasMap(prefix: string, pins: readonly string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < pins.length; i += 1) {
    map[`${prefix}${i}`] = pins[i];
  }
  return map;
}

const BASYS3_ALIAS_TO_PACKAGE_PIN: Record<string, string> = {
  CLK: BASYS3_CLOCK_PIN,
  CLK100MHZ: BASYS3_CLOCK_PIN,
  DP: BASYS3_DP_PIN,
  BTNC: BASYS3_BUTTON_PINS[0],
  BTNU: BASYS3_BUTTON_PINS[1],
  BTNL: BASYS3_BUTTON_PINS[2],
  BTNR: BASYS3_BUTTON_PINS[3],
  BTND: BASYS3_BUTTON_PINS[4],
  ...indexAliasMap('SW', BASYS3_SWITCH_PINS),
  ...indexAliasMap('LD', BASYS3_LED_PINS),
  ...indexAliasMap('LED', BASYS3_LED_PINS),
  ...indexAliasMap('BTN', BASYS3_BUTTON_PINS),
  ...indexAliasMap('SEG', BASYS3_SEGMENT_PINS),
  ...Object.fromEntries(BASYS3_SEGMENT_ALIASES.map((alias, index) => [alias, BASYS3_SEGMENT_PINS[index]])),
  ...indexAliasMap('AN', BASYS3_ANODE_PINS),
};

const BASYS3_PACKAGE_PIN_TO_PRIMARY_ALIAS: Record<string, string> = (() => {
  const preferredAliases = [
    'CLK100MHZ',
    ...Array.from({ length: BASYS3_SWITCH_PINS.length }, (_, index) => `SW${index}`),
    ...Array.from({ length: BASYS3_LED_PINS.length }, (_, index) => `LD${index}`),
    'BTNC',
    'BTNU',
    'BTNL',
    'BTNR',
    'BTND',
    ...BASYS3_SEGMENT_ALIASES,
    'DP',
    ...Array.from({ length: BASYS3_ANODE_PINS.length }, (_, index) => `AN${index}`),
  ];
  const map: Record<string, string> = {};
  for (const alias of preferredAliases) {
    const packagePin = BASYS3_ALIAS_TO_PACKAGE_PIN[alias];
    if (packagePin && !map[packagePin]) {
      map[packagePin] = alias;
    }
  }
  return map;
})();

export const BASYS3_INPUT_PACKAGE_PINS = new Set<string>([
  ...BASYS3_SWITCH_PINS,
  ...BASYS3_BUTTON_PINS,
  BASYS3_CLOCK_PIN,
]);

export const BASYS3_OUTPUT_PACKAGE_PINS = new Set<string>([
  ...BASYS3_LED_PINS,
  ...BASYS3_SEGMENT_PINS,
  ...BASYS3_ANODE_PINS,
  BASYS3_DP_PIN,
]);

export const BASYS3_ALLOWED_PACKAGE_PINS = new Set<string>([
  ...BASYS3_INPUT_PACKAGE_PINS,
  ...BASYS3_OUTPUT_PACKAGE_PINS,
]);

export function normalizeBasys3PinAlias(pin: string): string {
  return pin.trim().toUpperCase();
}

export function resolveBasys3PackagePin(pin: string): string | null {
  const normalized = normalizeBasys3PinAlias(pin);
  if (normalized.length === 0) return null;
  const fromAlias = BASYS3_ALIAS_TO_PACKAGE_PIN[normalized];
  if (fromAlias) return fromAlias;
  if (BASYS3_ALLOWED_PACKAGE_PINS.has(normalized)) return normalized;
  return null;
}

export function resolveBasys3BoardAlias(pin: string): string | null {
  const normalized = normalizeBasys3PinAlias(pin);
  if (normalized.length === 0) return null;
  if (BASYS3_ALIAS_TO_PACKAGE_PIN[normalized]) return normalized;
  const packagePin = resolveBasys3PackagePin(normalized);
  if (!packagePin) return null;
  return BASYS3_PACKAGE_PIN_TO_PRIMARY_ALIAS[packagePin] ?? null;
}

export function isBasys3InputCapablePin(pin: string): boolean {
  const packagePin = resolveBasys3PackagePin(pin);
  return Boolean(packagePin && BASYS3_INPUT_PACKAGE_PINS.has(packagePin));
}

export function isBasys3OutputCapablePin(pin: string): boolean {
  const packagePin = resolveBasys3PackagePin(pin);
  return Boolean(packagePin && BASYS3_OUTPUT_PACKAGE_PINS.has(packagePin));
}

export function isBasys3KnownPin(pin: string): boolean {
  return resolveBasys3PackagePin(pin) !== null;
}

export function listKnownBasys3AliasesForDirection(direction: 'input' | 'output'): string {
  const aliases = Object.entries(BASYS3_ALIAS_TO_PACKAGE_PIN)
    .filter(([, packagePin]) =>
      direction === 'input'
        ? BASYS3_INPUT_PACKAGE_PINS.has(packagePin)
        : BASYS3_OUTPUT_PACKAGE_PINS.has(packagePin)
    )
    .map(([alias]) => alias)
    .sort((left, right) => compareCodepoint(left, right));
  return aliases.join(', ');
}

export function getBasys3BoardResource(pinOrAlias: string | undefined): Basys3BoardResource | null {
  const normalized = normalizeBasys3PinAlias(pinOrAlias ?? '');
  if (!normalized) return null;
  const byAlias = BASYS3_RESOURCE_BY_ALIAS.get(normalized);
  if (byAlias) return byAlias;
  const packagePin = resolveBasys3PackagePin(normalized) ?? normalized;
  return BASYS3_RESOURCE_BY_PACKAGE_PIN.get(packagePin) ?? null;
}

export interface Basys3BoardResourceSelector {
  plannerOnly?: boolean;
  category?: Basys3BoardResourceCategory;
  signalDirection?: Basys3AssignableSignalDirection;
}

export function isBasys3ResourceAssignableToDirection(
  resourceEntry: Basys3BoardResource,
  signalDirection: Basys3AssignableSignalDirection
): boolean {
  if (resourceEntry.direction === 'inout') return true;
  return resourceEntry.direction === signalDirection;
}

export function listBasys3BoardResources(
  options?: Basys3BoardResourceSelector
): Basys3BoardResource[] {
  return BASYS3_BOARD_RESOURCES.filter((entry) => {
    if (options?.plannerOnly && !entry.supportedInPlanner) return false;
    if (options?.category && entry.category !== options.category) return false;
    if (
      options?.signalDirection &&
      !isBasys3ResourceAssignableToDirection(entry, options.signalDirection)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Current inline-assignment choices. Catalog-only resources remain available
 * to board reference views, but are excluded from mutation controls unless a
 * caller explicitly opts out of `plannerOnly`.
 */
export function listBasys3AssignableResources(
  signalDirection: Basys3AssignableSignalDirection,
  options: Omit<Basys3BoardResourceSelector, 'signalDirection'> = {}
): Basys3BoardResource[] {
  return listBasys3BoardResources({
    ...options,
    plannerOnly: options.plannerOnly ?? true,
    signalDirection,
  });
}

export function isBasys3ResourceCompatibleWithSignal(
  resourceEntry: Basys3BoardResource,
  signal: Basys3SignalCompatibilityCandidate
): boolean {
  if (!isBasys3ResourceAssignableToDirection(resourceEntry, signal.direction)) return false;

  const requiredCategories: Basys3CompatibleSignalCategory[] = [
    signal.direction === 'in' ? 'top-level-input' : 'top-level-output',
  ];
  if (signal.direction === 'out') requiredCategories.push('data');
  else if (signal.timingRole === 'reset') {
    requiredCategories.push('reset');
  } else if (
    signal.timingRole === 'clock' &&
    (signal.boardResourceType === 'switch' || signal.boardResourceType === 'button')
  ) {
    // A course lab may deliberately use a switch or button as a manual step
    // source. Keep that explicit physical choice controllable instead of
    // silently requiring the dedicated oscillator.
    requiredCategories.push('data');
  } else if (signal.timingRole === 'clock' || signal.boardResourceType === 'clock_pin') {
    requiredCategories.push('clock');
  } else {
    // Ordinary/manual-step/enable inputs need a controllable data resource;
    // this intentionally excludes the dedicated oscillator.
    requiredCategories.push('data');
  }
  if (!requiredCategories.every((category) =>
    resourceEntry.compatibleSignalCategories.includes(category)
  )) {
    return false;
  }

  const requiredResourceCategory: Basys3BoardResourceCategory | null =
    signal.boardResourceType === 'clock_pin'
      ? 'clock'
      : signal.boardResourceType === 'switch'
        ? 'switch'
        : signal.boardResourceType === 'button'
          ? 'button'
          : signal.boardResourceType === 'led'
            ? 'led'
            : signal.boardResourceType === 'seven_seg'
              ? 'seven_seg'
              : null;
  return !requiredResourceCategory || resourceEntry.category === requiredResourceCategory;
}

export function listBasys3CompatibleResources(
  signal: Basys3SignalCompatibilityCandidate,
  options: Omit<Basys3BoardResourceSelector, 'signalDirection'> = {}
): Basys3BoardResource[] {
  return listBasys3AssignableResources(signal.direction, options).filter((resourceEntry) =>
    isBasys3ResourceCompatibleWithSignal(resourceEntry, signal)
  );
}

export function formatBasys3XdcBinding(resourceEntry: Basys3BoardResource, portRef = resourceEntry.xdcPort): string {
  const lines = [
    `set_property PACKAGE_PIN ${resourceEntry.packagePin} [get_ports {${portRef}}]`,
    `set_property IOSTANDARD ${resourceEntry.ioStandard} [get_ports {${portRef}}]`,
  ];
  if (resourceEntry.category === 'clock') {
    lines.push(`create_clock -period 10.000 -name sys_clk -waveform {0.000 5.000} [get_ports {${portRef}}]`);
  }
  return lines.join('\n');
}

function buildResourceGroups(
  resources: readonly Basys3BoardResource[]
): readonly Basys3BoardResourceGroup[] {
  const resourcesByGroup = new Map<string, string[]>();
  for (const resourceEntry of resources) {
    const resourceIds = resourcesByGroup.get(resourceEntry.group) ?? [];
    resourceIds.push(resourceEntry.id);
    resourcesByGroup.set(resourceEntry.group, resourceIds);
  }
  return Object.freeze(
    [...resourcesByGroup.entries()].map(([label, resourceIds]) =>
      Object.freeze({
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        label,
        resourceIds: Object.freeze(resourceIds),
      })
    )
  );
}
