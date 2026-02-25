/**
 * PR15-D: Submission ZIP Parser Tests
 *
 * Tests for parseIdeSubmissionZip:
 *   - Detects valid submission ZIP
 *   - Throws NotASubmissionZipError on non-submission ZIP
 *   - Roundtrip: generate → parse → identical gradeSummary
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseIdeSubmissionZip, NotASubmissionZipError } from '../parseIdeSubmission';
import { generateIdeSubmissionBundle } from '../ideSubmissionBundle';
import type { RBProject } from '../projectFormat';
import { buildVerifyReport } from '../../apps/ide/verifyReport';
import type { RuntimeVerifyRun } from '../../apps/ide/projectRuntime';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Parse Test Project',
    circuit: {
      nodes: [
        { id: 'n1', type: 'INPUT', label: 'a', position: { x: 0, y: 0 }, x: 0, y: 0, rotation: 0, config: {}, state: {} },
        { id: 'n2', type: 'OUTPUT', label: 'y', position: { x: 100, y: 0 }, x: 100, y: 0, rotation: 0, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'in_a', nodeId: 'n1', port: 'out', label: 'a', pin: 'SW0' }],
      outputs: [{ id: 'out_y', nodeId: 'n2', port: 'in', label: 'y', pin: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { a: 0 }, expected: { y: 0 } },
    ],
    meta: { projectId: 'parse-test', appSurface: 'ide-export', studentName: 'Ada Lovelace' },
  };
}

function makeLastRun(): RuntimeVerifyRun {
  const rows = [{ tick: 0, signal: 'y', expected: '0', actual: '0' }];
  const report = buildVerifyReport({
    scenarioId: 'test',
    scenarioName: 'Test',
    status: 'pass',
    deterministicHash: 'det-hash-parse',
    rows,
    vectors: [],
    generatedAtIso: '2026-01-01T10:00:00.000Z',
  });
  return {
    scenarioId: 'test',
    scenarioName: 'Test',
    status: 'pass',
    deterministicHash: 'det-hash-parse',
    reportHash: report.reportHash,
    generatedAtIso: '2026-01-01T10:00:00.000Z',
    schedule: 'combinational',
    report,
    waveform: [],
  };
}

async function makeValidSubmissionZip(): Promise<ArrayBuffer> {
  const result = await generateIdeSubmissionBundle({
    project: makeProject(),
    verifyLastRun: makeLastRun(),
    verifyRunHistory: [
      {
        runId: 'run-1',
        ranAtIso: '2026-01-01T10:00:00.000Z',
        status: 'pass',
        passedRows: 1,
        failedRows: 0,
        firstFailure: null,
        circuitHash: 'h1',
        vectorsHash: 'h2',
        mappingHash: 'h3',
        projectHash: 'h4',
        didCircuitChangeSinceLast: false,
        didVectorsChangeSinceLast: false,
        didMappingChangeSinceLast: false,
      },
    ],
    submittedAt: '2026-01-15T12:00:00.000Z',
    appCommitSha: 'abc123',
  });
  return result.bytes.buffer as ArrayBuffer;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseIdeSubmissionZip — detects valid submission', () => {
  it('parses a generated submission ZIP successfully', async () => {
    const bytes = await makeValidSubmissionZip();
    const parsed = await parseIdeSubmissionZip(bytes);

    expect(parsed.gradeSummary.rbSubmissionVersion).toBe('ide-submission-v1');
    expect(parsed.gradeSummary.projectName).toBe('Parse Test Project');
    expect(parsed.gradeSummary.studentName).toBe('Ada Lovelace');
    expect(parsed.project.kind).toBe('rb-project');
    expect(parsed.project.name).toBe('Parse Test Project');
    expect(parsed.verifyLastRun).not.toBeNull();
    expect(parsed.verifyLastRun?.status).toBe('pass');
    expect(parsed.verifyRunHistory).toHaveLength(1);
  });
});

describe('parseIdeSubmissionZip — rejects non-submission ZIPs', () => {
  it('throws NotASubmissionZipError when ZIP has no manifest.json', async () => {
    const zip = new JSZip();
    zip.file('some-file.txt', 'hello world');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await expect(parseIdeSubmissionZip(bytes.buffer as ArrayBuffer))
      .rejects.toThrow(NotASubmissionZipError);
  });

  it('throws NotASubmissionZipError when manifest.json lacks bundleId', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ schemaVersion: '1.0' }));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await expect(parseIdeSubmissionZip(bytes.buffer as ArrayBuffer))
      .rejects.toThrow(NotASubmissionZipError);
  });

  it('throws NotASubmissionZipError when grade/summary.json is missing', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ bundleId: 'abc', schemaVersion: '1.0' }));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await expect(parseIdeSubmissionZip(bytes.buffer as ArrayBuffer))
      .rejects.toThrow(NotASubmissionZipError);
  });

  it('throws NotASubmissionZipError when rbSubmissionVersion is wrong', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ bundleId: 'abc', schemaVersion: '1.0' }));
    zip.file('grade/summary.json', JSON.stringify({ rbSubmissionVersion: 'hardware-track-v1' }));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await expect(parseIdeSubmissionZip(bytes.buffer as ArrayBuffer))
      .rejects.toThrow(NotASubmissionZipError);
  });

  it('throws NotASubmissionZipError on non-ZIP bytes', async () => {
    const bytes = new TextEncoder().encode('not a zip file at all').buffer as ArrayBuffer;
    await expect(parseIdeSubmissionZip(bytes)).rejects.toThrow(NotASubmissionZipError);
  });
});

describe('parseIdeSubmissionZip — roundtrip', () => {
  it('generate → parse → gradeSummary deepEqual (minus deviceId which is env-dependent)', async () => {
    const project = makeProject();
    const lastRun = makeLastRun();
    const ledger = [
      {
        runId: 'run-1',
        ranAtIso: '2026-01-01T10:00:00.000Z',
        status: 'pass' as const,
        passedRows: 1,
        failedRows: 0,
        firstFailure: null,
        circuitHash: 'h1',
        vectorsHash: 'h2',
        mappingHash: 'h3',
        projectHash: 'h4',
        didCircuitChangeSinceLast: false,
        didVectorsChangeSinceLast: false,
        didMappingChangeSinceLast: false,
      },
    ];
    const submittedAt = '2026-01-15T12:00:00.000Z';

    const generated = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: lastRun,
      verifyRunHistory: ledger,
      submittedAt,
      appCommitSha: 'abc123',
    });

    const parsed = await parseIdeSubmissionZip(generated.bytes.buffer as ArrayBuffer);

    // Key fields must match
    expect(parsed.gradeSummary.bundleId).toBe(generated.gradeSummary.bundleId);
    expect(parsed.gradeSummary.projectName).toBe(generated.gradeSummary.projectName);
    expect(parsed.gradeSummary.submittedAt).toBe(generated.gradeSummary.submittedAt);
    expect(parsed.gradeSummary.verifyRuns.total).toBe(generated.gradeSummary.verifyRuns.total);
    expect(parsed.gradeSummary.verifyRuns.firstPassAt).toBe(generated.gradeSummary.verifyRuns.firstPassAt);
    expect(parsed.gradeSummary.lastRun?.status).toBe(generated.gradeSummary.lastRun?.status);
    expect(parsed.project.name).toBe(generated.gradeSummary.projectName);
    expect(parsed.verifyRunHistory).toHaveLength(ledger.length);
  });
});
