/**
 * PR15-D: CRITICAL DETERMINISM TEST
 *
 * Export → parse → reload project → re-run verify → assert reportHash matches.
 *
 * If this fails, there is a real determinism bug in buildVerifyReport or
 * buildVerifyRowsDeterministicFromCircuit. Stop and fix before shipping.
 *
 * This test proves that the same circuit + vectors always produces the same
 * verify report hash, regardless of how many times you export and re-import.
 */

import { describe, it, expect } from 'vitest';
import { getIdeExampleById } from '../../apps/ide/examplesCatalog';
import { buildVerifyRowsDeterministicFromCircuit } from '../../apps/ide/sim/simEngine';
import { buildVerifyReport } from '../../apps/ide/verifyReport';
import { decodeRBProject, encodeRBProject } from '../projectFormat';
import { generateIdeSubmissionBundle } from '../ideSubmissionBundle';
import { parseIdeSubmissionZip } from '../parseIdeSubmission';
import type { RBProject } from '../projectFormat';
import type { RuntimeVerifyRun } from '../../apps/ide/projectRuntime';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSimIoRows(ioRows: Array<{ id: string; label: string; direction: 'in' | 'out'; nodeId: string }>) {
  return ioRows.map((row) => ({
    id: row.id,
    label: row.label,
    direction: row.direction,
    nodeId: row.nodeId,
  }));
}

function runDeterministicVerify(project: RBProject, ioRows: typeof project['ioMapping'] extends undefined ? never : NonNullable<RBProject['ioMapping']>['inputs']): ReturnType<typeof buildVerifyReport> {
  const allIoRows = [
    ...(project.ioMapping?.inputs ?? []).map((r) => ({ ...r, direction: 'in' as const })),
    ...(project.ioMapping?.outputs ?? []).map((r) => ({ ...r, direction: 'out' as const })),
  ];
  const rows = buildVerifyRowsDeterministicFromCircuit(
    project.circuit,
    allIoRows,
    project.vectors ?? [],
  );
  return buildVerifyReport({
    scenarioId: 'determinism-test',
    scenarioName: 'Determinism Test',
    status: rows.some((r) => r.expected !== r.actual) ? 'fail' : 'pass',
    deterministicHash: 'det-hash-test',
    rows,
    vectors: [],
    generatedAtIso: '2026-01-01T10:00:00.000Z',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Submission determinism: verify reportHash stable across export/import', () => {
  it('half-adder example: re-run verify after export → parse → reload gives same reportHash', async () => {
    const example = getIdeExampleById('half-adder');
    if (!example) {
      // If example doesn't exist, skip gracefully
      return;
    }

    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: example.name,
      circuit: example.circuit,
      ioMapping: {
        inputs: example.ioRows
          .filter((r) => r.direction === 'in')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
        outputs: example.ioRows
          .filter((r) => r.direction === 'out')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
      },
      vectors: example.vectors,
      meta: { projectId: 'det-test', appSurface: 'ide-export' },
    };

    // Run verify on original project
    const report1 = runDeterministicVerify(project, project.ioMapping!.inputs);
    expect(report1.status).toBe('pass'); // half-adder example should pass

    // Export to submission ZIP
    const bundleResult = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    // Parse ZIP
    const parsed = await parseIdeSubmissionZip(bundleResult.bytes.buffer as ArrayBuffer);

    // Re-run verify on the parsed (roundtripped) project
    const report2 = runDeterministicVerify(parsed.project, parsed.project.ioMapping!.inputs);

    // THE CRITICAL ASSERTION: same reportHash → deterministic
    expect(report2.reportHash).toBe(report1.reportHash);
    expect(report2.status).toBe(report1.status);
  });

  it('wire-lamp example (signal tour): verify reportHash stable after roundtrip', async () => {
    const example = getIdeExampleById('signal-tour');
    if (!example || (example.vectors ?? []).length === 0) {
      // Skip if no vectors
      return;
    }

    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: example.name,
      circuit: example.circuit,
      ioMapping: {
        inputs: example.ioRows
          .filter((r) => r.direction === 'in')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
        outputs: example.ioRows
          .filter((r) => r.direction === 'out')
          .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
      },
      vectors: example.vectors,
      meta: { projectId: 'det-test-2', appSurface: 'ide-export' },
    };

    const report1 = runDeterministicVerify(project, project.ioMapping!.inputs);

    const bundleResult = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-02-01T08:00:00.000Z',
      appCommitSha: 'abc456',
    });

    const parsed = await parseIdeSubmissionZip(bundleResult.bytes.buffer as ArrayBuffer);
    const report2 = runDeterministicVerify(parsed.project, parsed.project.ioMapping!.inputs);

    expect(report2.reportHash).toBe(report1.reportHash);
  });

  it('encodeRBProject → decodeRBProject roundtrip preserves circuit + vectors', () => {
    const example = getIdeExampleById('half-adder') ?? getIdeExampleById('signal-tour');
    if (!example) return;

    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: example.name,
      circuit: example.circuit,
      vectors: example.vectors,
      meta: { projectId: 'roundtrip-test' },
    };

    const encoded = encodeRBProject(project);
    const decoded = decodeRBProject(encoded);

    expect(decoded.circuit.nodes.length).toBe(project.circuit.nodes.length);
    expect(decoded.circuit.connections.length).toBe(project.circuit.connections.length);
    expect(decoded.vectors?.length).toBe(project.vectors?.length);

    // Re-encoding produces the same string (canonical form is idempotent)
    const reEncoded = encodeRBProject(decoded);
    expect(reEncoded).toBe(encoded);
  });
});
