import { normalize, type Decimal } from './decimal.js';

/**
 * Constrained phrase parser. It extracts a possible quantity and unit and the
 * remaining food text. It never claims to know nutrition from the sentence.
 */
export type PhraseUnit = 'count' | 'serving' | 'g' | 'oz' | 'ml' | 'floz';

export interface ParsedPhrase {
  original: string;
  /** Present only when the text started with a recognizable quantity. */
  quantity?: { amount: Decimal; unit: PhraseUnit };
  /** The food text to search for, trimmed. */
  query: string;
}

const WORD_NUMBERS: Record<string, Decimal> = {
  a: '1',
  an: '1',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  half: '0.5',
  quarter: '0.25',
};

const UNICODE_FRACTIONS: Record<string, Decimal> = { '½': '0.5', '¼': '0.25', '¾': '0.75', '⅓': '0.333333', '⅔': '0.666667' };

const UNIT_WORDS: Record<string, PhraseUnit> = {
  serving: 'serving',
  servings: 'serving',
  srv: 'serving',
  g: 'g',
  gram: 'g',
  grams: 'g',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  floz: 'floz',
};

function parseNumberToken(token: string): Decimal | undefined {
  const lower = token.toLowerCase();
  if (WORD_NUMBERS[lower]) return WORD_NUMBERS[lower];
  if (UNICODE_FRACTIONS[token]) return UNICODE_FRACTIONS[token];
  const fraction = /^(\d+)\/(\d+)$/.exec(token);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (den === 0) return undefined;
    const value = num / den;
    return normalize(Number.isInteger(value * 1000000) ? value : Number(value.toFixed(6)));
  }
  const mixed = /^(\d+)([½¼¾])$/.exec(token);
  if (mixed) {
    const whole = Number(mixed[1]);
    const frac = Number(UNICODE_FRACTIONS[mixed[2] ?? ''] ?? 0);
    return normalize(whole + frac);
  }
  if (/^\d+(?:\.\d+)?$/.test(token)) return normalize(token);
  if (/^\.\d+$/.test(token)) return normalize(`0${token}`);
  return undefined;
}

export function parsePhrase(input: string): ParsedPhrase {
  const original = input;
  const text = input.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return { original, query: '' };

  // Split off a leading number glued to a unit: "150g chicken" -> "150 g chicken"
  const spaced = text.replace(/^(\d+(?:\.\d+)?)(g|oz|ml)\b/i, '$1 $2');
  const tokens = spaced.split(' ');
  const first = tokens[0] ?? '';
  const amount = parseNumberToken(first);
  if (amount === undefined) return { original, query: text };

  let index = 1;
  let unit: PhraseUnit = 'count';
  const second = (tokens[1] ?? '').toLowerCase();
  const third = (tokens[2] ?? '').toLowerCase();

  if (second === 'fl' && (third === 'oz' || third === 'ounce' || third === 'ounces')) {
    unit = 'floz';
    index = 3;
  } else if (second === 'fluid' && (third === 'oz' || third === 'ounce' || third === 'ounces')) {
    unit = 'floz';
    index = 3;
  } else if (UNIT_WORDS[second]) {
    unit = UNIT_WORDS[second] as PhraseUnit;
    index = 2;
  }

  // Skip an "of" after a unit: "2 servings of oats"
  if ((tokens[index] ?? '').toLowerCase() === 'of') index += 1;

  const query = tokens.slice(index).join(' ').trim();
  if (query.length === 0) {
    // "2" alone or "half" alone is not a food; treat whole text as query.
    return { original, query: text };
  }
  return { original, quantity: { amount, unit }, query };
}
