import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import { stableStringify } from '../export/stableStringify';

const FIXTURE_PATH = join(__dirname, 'fixtures', 'rbproject-roundtrip.fixture.json');
const GOLDEN_PATH = join(process.cwd(), 'scripts', 'rbproj-roundtrip-gate.golden.sha256');
const UPDATE_GOLDEN = process.env.UPDATE_RBPROJ_GOLDEN === '1';

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function loadFixture(): RBProject {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  return JSON.parse(raw) as RBProject;
}

function normalizeForGate(project: RBProject): unknown {
  // Gate normalization rules:
  // - Exclude runtime/build metadata that is allowed to vary without meaningfully changing the persisted project.
  // - Exclude `updatedAt` because current exports can legitimately bump it without changing the circuit/layout.
  // - Keep circuit + layout + probes/etc as the persistence-critical payload.
  const { meta, updatedAt: _updatedAt, ...rest } = project;
  const metaSafe = meta
    ? { ...meta, appVersion: undefined, gitCommit: undefined }
    : undefined;

  return {
    ...rest,
    meta: metaSafe,
  };
}

function simulateDelayTrace(project: RBProject): Array<0 | 1> {
  const engine = new CircuitEngine(project.circuit);
  const inputPattern: Array<0 | 1> = [0, 1, 0, 1, 1];

  const trace: Array<0 | 1> = [];
  for (const a of inputPattern) {
    engine.setNodeState('a', { isOn: a });
    engine.tick();
    const out = engine.getNodeState('out')?.isOn ? 1 : 0;
    trace.push(out as 0 | 1);
  }

  return trace;
}

describe('RBProject roundtrip gate (canonical rb-project.json)', () => {
  it('encode → decode → encode is idempotent (codec determinism)', () => {
    const fixture = loadFixture();
    const encoded1 = encodeRBProject(fixture);
    const decoded = decodeRBProject(encoded1);
    const encoded2 = encodeRBProject(decoded);
    expect(encoded2).toBe(encoded1);
  });

  it('behavior is stable across roundtrip for a minimal sequential circuit', () => {
    const fixture = loadFixture();
    const encoded = encodeRBProject(fixture);
    const roundtripped = decodeRBProject(encoded);

    const trace1 = simulateDelayTrace(fixture);
    const trace2 = simulateDelayTrace(roundtripped);

    // Delay(1) should output the previous tick's input
    expect(trace1).toEqual([0, 0, 1, 0, 1]);
    expect(trace2).toEqual(trace1);
  });

  it('normalized project hash matches golden (format drift gate)', () => {
    const fixture = loadFixture();
    const encoded = encodeRBProject(fixture);
    const decoded = decodeRBProject(encoded);

    const normalizedText = stableStringify(normalizeForGate(decoded));
    const hash = sha256Hex(normalizedText);

    if (UPDATE_GOLDEN) {
      const out = [
        'fixture=packages/rb-apps/src/__tests__/fixtures/rbproject-roundtrip.fixture.json',
        'normalize=exclude(updatedAt,meta.appVersion,meta.gitCommit)',
        `sha256=${hash}`,
        '',
      ].join('\n');
      writeFileSync(GOLDEN_PATH, out, 'utf8');
    }

    const goldenText = readFileSync(GOLDEN_PATH, 'utf8');
    const match = goldenText.match(/sha256=([0-9a-f]{64})/i);
    expect(match).not.toBeNull();
    const expected = String(match?.[1] ?? '').toLowerCase();
    expect(hash).toBe(expected);
  });
});

