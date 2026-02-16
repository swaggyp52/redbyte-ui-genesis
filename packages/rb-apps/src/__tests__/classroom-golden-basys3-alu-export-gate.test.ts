import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IoMapping } from '@redbyte/rb-utils';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import { buildDeterministicZip, sha256Hex } from '../export/deterministicZip';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';

interface GoldenFixture extends RBProject {
  classroom?: {
    board?: 'basys3';
    ioMapping?: IoMapping;
  };
}

const FIXTURE_PATH = join(
  process.cwd(),
  'packages/rb-apps/src/fixtures/classroom/golden-basys3-alu.rbproj'
);
const GOLDEN_SHA_PATH = join(
  process.cwd(),
  'packages/rb-apps/src/__tests__/__goldens__/golden-basys3-alu.zip.sha256'
);
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN_BASYS3_ALU_ZIP_SHA === '1';

function parseExpectedSha(text: string): string {
  const match = text.match(/sha256=([0-9a-f]{64})/i);
  expect(match).not.toBeNull();
  return String(match?.[1] ?? '').toLowerCase();
}

describe('RC E1 classroom golden Basys3 ALU export gate', () => {
  it('loads ALU fixture via project codec and produces deterministic bundle zip hash', async () => {
    const fixtureRaw = readFileSync(FIXTURE_PATH, 'utf8');

    const decoded = decodeRBProject(fixtureRaw) as GoldenFixture;
    const normalized = decodeRBProject(encodeRBProject(decoded)) as GoldenFixture;
    const ioMapping = normalized.classroom?.ioMapping;

    expect(normalized.name).toBe('golden-basys3-alu');
    expect(ioMapping).toBeDefined();
    expect(ioMapping?.inputs).toHaveLength(6);
    expect(ioMapping?.outputs).toHaveLength(1);

    const bundle = exportBasys3Bundle(normalized.circuit, ioMapping as IoMapping);
    expect(bundle.valid).toBe(true);
    expect(bundle.warnings).toEqual([]);

    expect(bundle.topV).toContain('module top');
    expect(bundle.topV).toContain('endmodule');
    expect(bundle.topV).not.toContain('Timestamp:');
    expect(bundle.topV).not.toContain('Math.random');

    expect(bundle.topXdc).toContain('PACKAGE_PIN V2');
    expect(bundle.topXdc).toContain('PACKAGE_PIN V15');
    expect(bundle.topXdc).toContain('PACKAGE_PIN W15');
    expect(bundle.topXdc).toContain('PACKAGE_PIN W17');
    expect(bundle.topXdc).toContain('PACKAGE_PIN W16');
    expect(bundle.topXdc).toContain('PACKAGE_PIN V16');
    expect(bundle.topXdc).toContain('PACKAGE_PIN E19');

    const zipBytes1 = await buildDeterministicZip([
      { name: 'README.txt', text: bundle.readme },
      { name: 'top.v', text: bundle.topV },
      { name: 'top.xdc', text: bundle.topXdc },
    ]);

    const zipBytes2 = await buildDeterministicZip([
      { name: 'top.xdc', text: bundle.topXdc },
      { name: 'top.v', text: bundle.topV },
      { name: 'README.txt', text: bundle.readme },
    ]);

    const hash1 = sha256Hex(zipBytes1);
    const hash2 = sha256Hex(zipBytes2);
    expect(hash2).toBe(hash1);

    if (UPDATE_GOLDEN) {
      const nextGolden = [
        'fixture=packages/rb-apps/src/fixtures/classroom/golden-basys3-alu.rbproj',
        'zip.entries=README.txt,top.v,top.xdc',
        'zip.order=lexicographic',
        'zip.timestamp=2026-01-01T00:00:00.000Z',
        `sha256=${hash1}`,
        '',
      ].join('\n');
      writeFileSync(GOLDEN_SHA_PATH, nextGolden, 'utf8');
    }

    const golden = readFileSync(GOLDEN_SHA_PATH, 'utf8');
    const expectedSha = parseExpectedSha(golden);
    expect(hash1).toBe(expectedSha);
  });
});
