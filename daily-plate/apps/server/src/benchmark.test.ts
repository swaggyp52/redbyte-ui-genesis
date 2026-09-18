import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const casesFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/benchmark/catalog-cases.json');

describe('catalog benchmark case set', () => {
  const doc = JSON.parse(fs.readFileSync(casesFile, 'utf8')) as { version: number; cases: Array<Record<string, unknown>> };
  it('is the fixed 80-case set with the agreed category sizes and no expected nutrition', () => {
    expect(doc.cases).toHaveLength(80);
    const counts: Record<string, number> = {};
    for (const c of doc.cases) counts[c.category as string] = (counts[c.category as string] ?? 0) + 1;
    expect(counts).toEqual({ basic: 15, cooked: 15, packaged: 20, beverage: 15, restaurant: 10, ambiguous: 5 });
    expect(new Set(doc.cases.map((c) => c.id)).size).toBe(80);
    for (const c of doc.cases) {
      expect(typeof c.query).toBe('string');
      expect(typeof c.intendedIdentity).toBe('string');
      expect(c).not.toHaveProperty('expectedNutrients');
    }
    expect(doc.cases.some((c) => /octoberfest/i.test(c.query as string))).toBe(true);
  });
});
