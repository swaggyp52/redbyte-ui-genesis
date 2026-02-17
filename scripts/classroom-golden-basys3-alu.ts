import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeterministicZip, sha256Hex } from '../packages/rb-apps/src/export/deterministicZip';
import { decodeRBProject, encodeRBProject, type RBProject } from '../packages/rb-apps/src/export/projectFormat';
import { exportBasys3Bundle } from '../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';

interface IoMappingEntry {
  id: string;
  nodeId: string;
  port: string;
  pin?: string;
  label?: string;
}

interface IoMapping {
  inputs: IoMappingEntry[];
  outputs: IoMappingEntry[];
}

interface GoldenFixture extends RBProject {
  classroom?: {
    board?: 'basys3';
    ioMapping?: IoMapping;
  };
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const fixturePath = join(repoRoot, 'packages/rb-apps/src/fixtures/classroom/golden-basys3-alu.rbproj');
const goldenShaPath = join(repoRoot, 'packages/rb-apps/src/__tests__/__goldens__/golden-basys3-alu.zip.sha256');
const outPath = join(repoRoot, 'out/classroom/golden-basys3-alu.zip');

function parseExpectedSha(text: string): string {
  const match = text.match(/sha256=([0-9a-f]{64})/i);
  if (!match) {
    throw new Error('Missing sha256=<hex> in golden SHA file');
  }
  return String(match[1]).toLowerCase();
}

function fail(message: string): never {
  console.error(`[classroom:golden-basys3-alu] FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  const fixtureRaw = readFileSync(fixturePath, 'utf8');
  const decoded = decodeRBProject(fixtureRaw) as GoldenFixture;
  const normalized = decodeRBProject(encodeRBProject(decoded)) as GoldenFixture;

  const ioMapping = normalized.classroom?.ioMapping;
  if (!ioMapping) {
    fail('Fixture missing classroom.ioMapping');
  }

  const bundle = exportBasys3Bundle(normalized.circuit, ioMapping);
  if (!bundle.valid) {
    fail(`Basys3 bundle invalid: ${bundle.warnings.join('; ')}`);
  }

  const zipBytes = await buildDeterministicZip([
    { name: 'README.txt', text: bundle.readme },
    { name: 'top.vhd', text: bundle.topVhd },
    { name: 'top.xdc', text: bundle.topXdc },
  ]);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.from(zipBytes));

  const sha = sha256Hex(zipBytes);
  const expectedSha = parseExpectedSha(readFileSync(goldenShaPath, 'utf8'));
  const pass = sha === expectedSha;

  console.log(`[classroom:golden-basys3-alu] artifact: ${outPath}`);
  console.log(`[classroom:golden-basys3-alu] sha256:   ${sha}`);
  console.log(`[classroom:golden-basys3-alu] expected: ${expectedSha}`);
  console.log(`[classroom:golden-basys3-alu] result:   ${pass ? 'PASS' : 'FAIL'}`);

  if (!pass) {
    process.exit(1);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
