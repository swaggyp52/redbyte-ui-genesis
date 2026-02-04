import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { exportEvidenceCapsule } from '../exportService';

const FIXTURE_PATH =
  'packages/rb-lab-engine/src/services/__tests__/fixtures/rbx-evidence-determinism.fixture.project.json';
const GOLDEN_PATH = 'scripts/rbx-evidence-determinism-gate.golden.sha256';
const UPDATE_GOLDEN_ENV = 'UPDATE_RBX_EVIDENCE_GOLDEN';

function stableStringify(value: unknown): string {
  const sortKeys = (input: any): any => {
    if (input === null || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(sortKeys);
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      sorted[key] = sortKeys(input[key]);
    }
    return sorted;
  };

  return JSON.stringify(sortKeys(value), null, 2);
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

async function extractTextFiles(blob: Blob) {
  const zip = await JSZip.loadAsync(blob);
  const get = async (path: string) => {
    const file = zip.file(path);
    if (!file) throw new Error(`Missing ${path} in exported capsule`);
    return file.async('string');
  };
  const manifestJson = await get('manifest.json');
  const capsuleJson = await get('capsule.json');
  const projectJson = await get('project.json');
  const actionsJson = await get('actions.log.json');
  const readme = await get('README.md');

  return { manifestJson, capsuleJson, projectJson, actionsJson, readme };
}

function readGoldenSha(): string | null {
  try {
    const content = readFileSync(GOLDEN_PATH, 'utf8');
    const match = content.match(/^sha256=([a-f0-9]{64})$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function writeGoldenSha(sha: string) {
  const payload = [
    `fixture=${FIXTURE_PATH}`,
    'inputs=manifest.json,capsule.json,project.json,actions.log.json,README.md',
    `sha256=${sha}`,
    '',
  ].join('\n');
  writeFileSync(GOLDEN_PATH, payload, 'utf8');
}

describe('RBX Evidence Determinism Gate', () => {
  it('exports deterministic manifest/capsule/readme contents', async () => {
    const project = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

    const blob1 = await exportEvidenceCapsule(project);
    const blob2 = await exportEvidenceCapsule(project);

    const a = await extractTextFiles(blob1);
    const b = await extractTextFiles(blob2);

    expect(a.manifestJson).toBe(b.manifestJson);
    expect(a.capsuleJson).toBe(b.capsuleJson);
    expect(a.projectJson).toBe(b.projectJson);
    expect(a.actionsJson).toBe(b.actionsJson);
    expect(a.readme).toBe(b.readme);

    const normalized = [
      stableStringify(JSON.parse(a.manifestJson)),
      stableStringify(JSON.parse(a.capsuleJson)),
      stableStringify(JSON.parse(a.projectJson)),
      stableStringify(JSON.parse(a.actionsJson)),
      a.readme.trimEnd(),
    ].join('\n');

    const sha = sha256Hex(normalized);

    if (process.env[UPDATE_GOLDEN_ENV] === '1') {
      writeGoldenSha(sha);
      return;
    }

    const goldenSha = readGoldenSha();
    if (!goldenSha) {
      throw new Error(
        `Missing or invalid golden at ${GOLDEN_PATH}. Set ${UPDATE_GOLDEN_ENV}=1 to regenerate.`
      );
    }

    expect(sha).toBe(goldenSha);
  });
});

