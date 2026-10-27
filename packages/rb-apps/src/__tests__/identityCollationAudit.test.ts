import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * RB-DEBT-016: modules that compute an identity, a hash, an evaluation order or a persisted
 * order must compare text by codepoint (export/codepointSort.ts compareCodepoint in rb-apps,
 * ir/simulationModel.ts compareText in rb-logic-core). Collation varies with the browser's
 * locale and ICU version, so one design would otherwise carry several identities.
 */
const ROOT = path.resolve(__dirname, '../../../..');
const IDENTITY_MODULES = [
  'packages/rb-logic-core/src/CircuitEngine.ts',
  'packages/rb-logic-core/src/bus.ts',
  'packages/rb-logic-core/src/ir/elaborator.ts',
  'packages/rb-logic-core/src/ir/simulationModel.ts',
  'packages/rb-apps/src/apps/ide/projectHierarchy.ts',
  'packages/rb-apps/src/apps/ide/runDeterminism.ts',
  'packages/rb-apps/src/apps/ide/verifyProjectHash.ts',
  'packages/rb-apps/src/apps/ide/verifyReplayHash.ts',
  'packages/rb-apps/src/apps/ide/verifyScenario.ts',
  'packages/rb-apps/src/circuit/semanticCircuit.ts',
  'packages/rb-apps/src/export/projectFormat.ts',
  'packages/rb-apps/src/recording/runRecordUtils.ts',
  'packages/rb-apps/src/utils/digest.ts',
  'packages/rb-apps/src/utils/stableSerialize.ts',
];
const LOCALE_SENSITIVE = /\.localeCompare\s*\(|\bIntl\s*\.\s*Collator\b|\.toLocale(?:Lower|Upper)Case\s*\(|\.toLocaleString\s*\(/;

function localeSensitiveLines(source: string): string[] {
  return source.split(/\r?\n/).flatMap((line, index) => (LOCALE_SENSITIVE.test(line) ? [`${index + 1}: ${line.trim()}`] : []));
}

describe('identity modules never use locale-sensitive collation (RB-DEBT-016)', () => {
  it('detects every locale-sensitive form it forbids', () => {
    expect(localeSensitiveLines([
      'ids.sort((a, b) => a.localeCompare(b));',
      'const collator = new Intl.Collator();',
      "key.toLocaleLowerCase('tr');",
      'count.toLocaleString();',
      'ids.sort(compareCodepoint);',
    ].join('\n'))).toHaveLength(4);
  });

  it.each(IDENTITY_MODULES.map(file => [file] as const))('%s compares text by codepoint only', file => {
    const absolute = path.join(ROOT, file);
    expect(existsSync(absolute), `${file} is missing, so it went unaudited`).toBe(true);
    expect(localeSensitiveLines(readFileSync(absolute, 'utf8'))).toEqual([]);
  });
});
