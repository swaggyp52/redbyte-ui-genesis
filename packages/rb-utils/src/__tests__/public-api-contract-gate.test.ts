import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const INDEX_TS_PATH = resolve(ROOT, 'index.ts');
const INDEX_JS_PATH = resolve(ROOT, 'index.js');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('rb-utils public API contract gate', () => {
  it('exports hardwareMappingV2 from both TypeScript and JavaScript barrels', () => {
    const tsSource = read(INDEX_TS_PATH);
    const jsSource = read(INDEX_JS_PATH);

    expect(tsSource).toContain("export * from './hardwareMappingV2';");
    expect(jsSource).toContain("export * from './hardwareMappingV2';");
  });
});
