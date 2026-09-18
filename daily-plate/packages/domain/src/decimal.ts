/**
 * Exact decimal arithmetic on canonical decimal strings.
 *
 * Nutrient amounts and quantities are stored and exchanged as decimal strings
 * such as "22.5". Arithmetic is done on BigInt-scaled integers so 1.5 x 15
 * is exactly 22.5, never 22.499999. Rounding happens only where the caller
 * asks for it (normally the display boundary).
 */

export type Decimal = string;

export type Rounding = 'half-up' | 'down';

interface Scaled {
  n: bigint;
  scale: number;
}

const DECIMAL_RE = /^([+-])?(\d+)(?:\.(\d+))?$/;

export function isDecimal(value: unknown): value is Decimal {
  return typeof value === 'string' && DECIMAL_RE.test(value.trim());
}

function parse(value: Decimal | number): Scaled {
  const text = typeof value === 'number' ? numberToText(value) : value.trim();
  const m = DECIMAL_RE.exec(text);
  if (!m) throw new Error(`Invalid decimal: ${String(value)}`);
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2] ?? '0';
  const fracPart = m[3] ?? '';
  const n = BigInt(intPart + fracPart) * sign;
  return { n, scale: fracPart.length };
}

function numberToText(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Invalid decimal number: ${value}`);
  // Use a fixed representation to avoid exponent notation for typical inputs.
  const text = value.toString();
  if (/e/i.test(text)) {
    return value.toFixed(12);
  }
  return text;
}

function rescale(v: Scaled, scale: number): bigint {
  if (scale === v.scale) return v.n;
  if (scale > v.scale) return v.n * 10n ** BigInt(scale - v.scale);
  throw new Error('rescale would lose precision');
}

function format(n: bigint, scale: number): Decimal {
  const negative = n < 0n;
  let digits = (negative ? -n : n).toString();
  if (scale > 0) {
    digits = digits.padStart(scale + 1, '0');
    const intPart = digits.slice(0, digits.length - scale);
    let frac = digits.slice(digits.length - scale).replace(/0+$/, '');
    digits = frac.length > 0 ? `${intPart}.${frac}` : intPart;
  }
  if (digits === '0') return '0';
  return negative ? `-${digits}` : digits;
}

function divideScaled(n: bigint, divisor: bigint, rounding: Rounding): bigint {
  if (divisor === 0n) throw new Error('Division by zero');
  const negative = (n < 0n) !== (divisor < 0n);
  const an = n < 0n ? -n : n;
  const ad = divisor < 0n ? -divisor : divisor;
  let q = an / ad;
  const r = an % ad;
  if (rounding === 'half-up' && r * 2n >= ad) q += 1n;
  return negative ? -q : q;
}

export function normalize(value: Decimal | number): Decimal {
  const v = parse(value);
  return format(v.n, v.scale);
}

export function add(a: Decimal | number, b: Decimal | number): Decimal {
  const x = parse(a);
  const y = parse(b);
  const scale = Math.max(x.scale, y.scale);
  return format(rescale(x, scale) + rescale(y, scale), scale);
}

export function sub(a: Decimal | number, b: Decimal | number): Decimal {
  const x = parse(a);
  const y = parse(b);
  const scale = Math.max(x.scale, y.scale);
  return format(rescale(x, scale) - rescale(y, scale), scale);
}

export function mul(a: Decimal | number, b: Decimal | number): Decimal {
  const x = parse(a);
  const y = parse(b);
  return format(x.n * y.n, x.scale + y.scale);
}

/**
 * Divide with a bounded internal precision. Default 6 decimal places is far
 * beyond any displayed gram precision; callers round at the display boundary.
 */
export function div(a: Decimal | number, b: Decimal | number, places = 6, rounding: Rounding = 'half-up'): Decimal {
  const x = parse(a);
  const y = parse(b);
  if (y.n === 0n) throw new Error('Division by zero');
  const targetScale = Math.max(places, x.scale);
  const numerator = rescale(x, targetScale + y.scale);
  const q = divideScaled(numerator, y.n, rounding);
  return format(q, targetScale);
}

export function round(a: Decimal | number, places: number, rounding: Rounding = 'half-up'): Decimal {
  const x = parse(a);
  if (x.scale <= places) return format(x.n, x.scale);
  const divisor = 10n ** BigInt(x.scale - places);
  return format(divideScaled(x.n, divisor, rounding), places);
}

export function cmp(a: Decimal | number, b: Decimal | number): -1 | 0 | 1 {
  const x = parse(a);
  const y = parse(b);
  const scale = Math.max(x.scale, y.scale);
  const l = rescale(x, scale);
  const r = rescale(y, scale);
  return l < r ? -1 : l > r ? 1 : 0;
}

export const lt = (a: Decimal | number, b: Decimal | number): boolean => cmp(a, b) < 0;
export const lte = (a: Decimal | number, b: Decimal | number): boolean => cmp(a, b) <= 0;
export const gt = (a: Decimal | number, b: Decimal | number): boolean => cmp(a, b) > 0;
export const gte = (a: Decimal | number, b: Decimal | number): boolean => cmp(a, b) >= 0;
export const eq = (a: Decimal | number, b: Decimal | number): boolean => cmp(a, b) === 0;
export const isZero = (a: Decimal | number): boolean => parse(a).n === 0n;
export const isNegative = (a: Decimal | number): boolean => parse(a).n < 0n;

export function abs(a: Decimal | number): Decimal {
  const x = parse(a);
  return format(x.n < 0n ? -x.n : x.n, x.scale);
}

export function max(a: Decimal | number, b: Decimal | number): Decimal {
  return gte(a, b) ? normalize(a) : normalize(b);
}

export function sum(values: Array<Decimal | number>): Decimal {
  return values.reduce<Decimal>((acc, v) => add(acc, v), '0');
}

/** Converts to a JS number for display-only purposes (never for storage). */
export function toNumber(a: Decimal | number): number {
  return Number(normalize(a));
}

/**
 * Display formatting: rounds to `places` and trims trailing zeros.
 * "22.5" -> "22.5"; "22.50" -> "22.5"; "7.4999" (1 place) -> "7.5".
 */
export function formatDisplay(a: Decimal | number, places = 1): string {
  return round(a, places);
}
