import { compareCodepoint } from '../../../export/codepointSort';

export const BASYS3_CLOCK_PIN = 'W5';
export const BASYS3_DP_PIN = 'V7';

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
