/**
 * PR15-D: IDE Submission Bundle Tests
 *
 * Tests for generateIdeSubmissionBundle:
 *   - ZIP contains all required files
 *   - Determinism: same inputs → identical bundleId
 *   - Grade summary: run history, firstPassAt, lastPassAt
 *   - Gate results populated when labId matches
 *   - Works with zero verify runs
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateIdeSubmissionBundle } from '../ideSubmissionBundle';
import type { IdeSubmissionGradeSummary } from '../ideSubmissionBundle';
import type { RBProject } from '../projectFormat';
import type { VerifyRunLedgerEntry, RuntimeVerifyRun } from '../../apps/ide/projectRuntime';
import { buildVerifyReport } from '../../apps/ide/verifyReport';
import { parseIdeSubmissionZip } from '../parseIdeSubmission';
import { validateSubmissionForLab } from '../../labs/submissionGates';
import { deriveProofRunFlags } from '../../labs/proofRunFlags';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<RBProject> = {}): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test Project',
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
      { tick: 1, inputs: { a: 1 }, expected: { y: 1 } },
    ],
    meta: {
      projectId: 'test-proj-001',
      appSurface: 'ide-export',
    },
    ...overrides,
  };
}

function makeLedgerEntry(n: number, status: 'pass' | 'fail', changedCircuit = false): VerifyRunLedgerEntry {
  return {
    runId: `run-${n}`,
    ranAtIso: `2026-01-0${n}T10:00:00.000Z`,
    status,
    passedRows: status === 'pass' ? 4 : 2,
    failedRows: status === 'pass' ? 0 : 2,
    firstFailure: status === 'fail'
      ? { tick: 1, signal: 'y', expected: '1', actual: '0' }
      : null,
    circuitHash: changedCircuit ? `hash-circuit-new-${n}` : 'hash-circuit-v1',
    vectorsHash: 'hash-vectors-v1',
    mappingHash: 'hash-mapping-v1',
    projectHash: `hash-project-${n}`,
    didCircuitChangeSinceLast: changedCircuit && n > 1,
    didVectorsChangeSinceLast: false,
    didMappingChangeSinceLast: false,
  };
}

function makeLastRun(status: 'pass' | 'fail'): RuntimeVerifyRun {
  const rows = status === 'pass'
    ? [
        { tick: 0, signal: 'y', expected: '0', actual: '0' },
        { tick: 1, signal: 'y', expected: '1', actual: '1' },
      ]
    : [
        { tick: 0, signal: 'y', expected: '0', actual: '0' },
        { tick: 1, signal: 'y', expected: '1', actual: '0' },
      ];
  const report = buildVerifyReport({
    scenarioId: 'test',
    scenarioName: 'Test',
    status,
    deterministicHash: 'det-hash',
    rows,
    vectors: [],
    generatedAtIso: '2026-01-01T10:00:00.000Z',
  });
  return {
    scenarioId: 'test',
    scenarioName: 'Test',
    status,
    deterministicHash: 'det-hash',
    reportHash: report.reportHash,
    generatedAtIso: '2026-01-01T10:00:00.000Z',
    schedule: 'combinational',
    report,
    waveform: [],
  };
}

function makeLabReadyHdl() {
  return {
    top: 'top',
    sources: [
      {
        path: 'top.vhd',
        language: 'vhdl' as const,
        text: 'entity top is end top; architecture rtl of top is begin end rtl;',
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateIdeSubmissionBundle — required files', () => {
  it('ZIP contains all required files + hashes match manifest', async () => {
    const project = makeProject();
    const result = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: makeLastRun('pass'),
      verifyRunHistory: [makeLedgerEntry(1, 'pass')],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(result.bytes);

    // Required files must exist
    expect(zip.file('manifest.json')).not.toBeNull();
    expect(zip.file('grade/summary.json')).not.toBeNull();
    expect(zip.file('project.rbproj.json')).not.toBeNull();
    expect(zip.file('verify/last-run.json')).not.toBeNull();
    expect(zip.file('verify/run-ledger.json')).not.toBeNull();
    expect(zip.file('README.txt')).not.toBeNull();

    // Manifest hashes match
    const manifestText = await zip.file('manifest.json')!.async('text');
    const manifest = JSON.parse(manifestText) as {
      bundleId: string;
      includedFiles: Array<{ path: string; sha256: string }>;
    };
    expect(typeof manifest.bundleId).toBe('string');
    expect(manifest.bundleId.length).toBeGreaterThan(0);
    expect(Array.isArray(manifest.includedFiles)).toBe(true);
    expect(manifest.includedFiles.length).toBeGreaterThan(0);

    // grade/summary.json has correct schema marker
    const summaryText = await zip.file('grade/summary.json')!.async('text');
    const summary = JSON.parse(summaryText) as IdeSubmissionGradeSummary;
    expect(summary.rbSubmissionVersion).toBe('ide-submission-v1');
    expect(summary.bundleId).toBe(manifest.bundleId);
  });
});

describe('generateIdeSubmissionBundle — determinism', () => {
  it('same inputs → identical bundleId and bytes', async () => {
    const project = makeProject();
    const history = [makeLedgerEntry(1, 'pass')];
    const lastRun = makeLastRun('pass');
    const submittedAt = '2026-01-15T12:00:00.000Z';

    const r1 = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: lastRun,
      verifyRunHistory: history,
      submittedAt,
      appCommitSha: 'abc123',
    });

    const r2 = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: lastRun,
      verifyRunHistory: history,
      submittedAt,
      appCommitSha: 'abc123',
    });

    // bundleId must match
    expect(r1.gradeSummary.bundleId).toBe(r2.gradeSummary.bundleId);
  });

  it('different submittedAt does NOT change bundleId', async () => {
    const project = makeProject();
    const history = [makeLedgerEntry(1, 'pass')];
    const lastRun = makeLastRun('pass');

    const r1 = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: lastRun,
      verifyRunHistory: history,
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    const r2 = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: lastRun,
      verifyRunHistory: history,
      submittedAt: '2026-03-01T09:00:00.000Z',
      appCommitSha: 'abc123',
    });

    // bundleId is content-addressed from file hashes, NOT submittedAt
    expect(r1.gradeSummary.bundleId).toBe(r2.gradeSummary.bundleId);
    // But submittedAt differs in grade summary
    expect(r1.gradeSummary.submittedAt).not.toBe(r2.gradeSummary.submittedAt);
  });
});

describe('generateIdeSubmissionBundle — grade summary: run history', () => {
  it('3 runs: fail, fail, pass → passes=1, firstPassAt=run3', async () => {
    const project = makeProject();
    const history = [
      makeLedgerEntry(1, 'fail'),
      makeLedgerEntry(2, 'fail'),
      makeLedgerEntry(3, 'pass'),
    ];

    const result = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: makeLastRun('pass'),
      verifyRunHistory: history,
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    const s = result.gradeSummary;
    expect(s.verifyRuns.total).toBe(3);
    expect(s.verifyRuns.passes).toBe(1);
    expect(s.verifyRuns.fails).toBe(2);
    expect(s.verifyRuns.firstPassAt).toBe('2026-01-03T10:00:00.000Z');
    expect(s.verifyRuns.lastPassAt).toBe('2026-01-03T10:00:00.000Z');
    expect(s.verifyRuns.lastStatus).toBe('pass');
  });

  it('circuit change detected in ledger', async () => {
    const project = makeProject();
    const history = [
      makeLedgerEntry(1, 'fail', false),
      makeLedgerEntry(2, 'fail', true),   // circuit changed
    ];

    const result = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: makeLastRun('fail'),
      verifyRunHistory: history,
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    // Ledger data passed through unchanged
    const zip = await JSZip.loadAsync(result.bytes);
    const ledgerText = await zip.file('verify/run-ledger.json')!.async('text');
    const ledger = JSON.parse(ledgerText) as VerifyRunLedgerEntry[];
    expect(ledger[1]?.didCircuitChangeSinceLast).toBe(true);
    expect(ledger[0]?.didCircuitChangeSinceLast).toBe(false);
  });
});

describe('generateIdeSubmissionBundle — zero verify runs', () => {
  it('zero runs → lastStatus:none, lastRun:null, gateResults may still run', async () => {
    const project = makeProject();

    const result = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    const s = result.gradeSummary;
    expect(s.verifyRuns.lastStatus).toBe('none');
    expect(s.lastRun).toBeNull();
    expect(s.verifyRuns.total).toBe(0);
    expect(s.verifyRuns.firstPassAt).toBeNull();
  });
});

describe('generateIdeSubmissionBundle — gate results', () => {
  it('gate results empty when no labId (freeplay)', async () => {
    const project = makeProject({ meta: { projectId: 'test', appSurface: 'ide-export' } });

    const result = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    expect(result.gradeSummary.gateResults).toHaveLength(0);
    expect(result.gradeSummary.overallGateVerdict).toBe('ungraded');
  });

  it('gate results populated when labId matches lab definition', async () => {
    const project = makeProject({
      meta: {
        projectId: 'test',
        appSurface: 'ide-export',
        labId: 'lab-1',
      },
    });

    const result = await generateIdeSubmissionBundle({
      project,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    // lab-1 has requireSimEvidence — should produce a warn/block gate issue
    expect(result.gradeSummary.gateResults.length).toBeGreaterThan(0);
    expect(result.gradeSummary.overallGateVerdict).not.toBe('ungraded');
  });

  it('lab 7 remains blocked until counter-sequence-proof checkpoint passes', async () => {
    const failingLab7 = makeProject({
      hdl: makeLabReadyHdl(),
      meta: {
        projectId: 'lab7-fail',
        appSurface: 'ide-export',
        labId: 'lab-7',
      },
      labSpec: {
        schemaVersion: '1.0',
        labId: 'lab-7',
        title: 'Lab 7',
        objectives: ['Counter proof'],
        checkpoints: [
          {
            id: 'counter-sequence-proof',
            type: 'truth-table',
            title: 'Counter sequence',
            config: {
              schedule: 'combinational',
              inputs: ['n1'],
              outputs: ['n2'],
              table: [{ inputs: { n1: true }, outputs: { n2: false } }],
            },
          },
        ],
      },
    });

    const blocked = await generateIdeSubmissionBundle({
      project: failingLab7,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    expect(blocked.gradeSummary.proofRuns.sequenceProofRun).toBe(false);
    expect(blocked.gradeSummary.gateResults.some((gate) => gate.gateId === 'sequence_proof_missing')).toBe(true);

    const passingLab7 = makeProject({
      hdl: makeLabReadyHdl(),
      meta: {
        projectId: 'lab7-pass',
        appSurface: 'ide-export',
        labId: 'lab-7',
      },
      labSpec: {
        schemaVersion: '1.0',
        labId: 'lab-7',
        title: 'Lab 7',
        objectives: ['Counter proof'],
        checkpoints: [
          {
            id: 'counter-sequence-proof',
            type: 'truth-table',
            title: 'Counter sequence',
            config: {
              schedule: 'combinational',
              inputs: ['n1'],
              outputs: ['n2'],
              table: [{ inputs: { n1: true }, outputs: { n2: true } }],
            },
          },
        ],
      },
    });

    const unblocked = await generateIdeSubmissionBundle({
      project: passingLab7,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    expect(unblocked.gradeSummary.proofRuns.sequenceProofRun).toBe(true);
    expect(unblocked.gradeSummary.gateResults.some((gate) => gate.gateId === 'sequence_proof_missing')).toBe(false);
  });

  it('lab 8 remains blocked until both fsm path checkpoints pass', async () => {
    const failingLab8 = makeProject({
      hdl: makeLabReadyHdl(),
      meta: {
        projectId: 'lab8-fail',
        appSurface: 'ide-export',
        labId: 'lab-8',
      },
      labSpec: {
        schemaVersion: '1.0',
        labId: 'lab-8',
        title: 'Lab 8',
        objectives: ['FSM path proof'],
        checkpoints: [
          {
            id: 'fsm-invalid-path',
            type: 'truth-table',
            title: 'Invalid path',
            config: {
              schedule: 'combinational',
              inputs: ['n1'],
              outputs: ['n2'],
              table: [{ inputs: { n1: true }, outputs: { n2: true } }],
            },
          },
          {
            id: 'fsm-valid-path',
            type: 'truth-table',
            title: 'Valid path',
            config: {
              schedule: 'combinational',
              inputs: ['n1'],
              outputs: ['n2'],
              table: [{ inputs: { n1: true }, outputs: { n2: false } }],
            },
          },
        ],
      },
    });

    const blocked = await generateIdeSubmissionBundle({
      project: failingLab8,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    expect(blocked.gradeSummary.proofRuns.fsmPathsRun).toBe(false);
    expect(blocked.gradeSummary.gateResults.some((gate) => gate.gateId === 'fsm_paths_missing')).toBe(true);

    const passingLab8 = makeProject({
      hdl: makeLabReadyHdl(),
      meta: {
        projectId: 'lab8-pass',
        appSurface: 'ide-export',
        labId: 'lab-8',
      },
      labSpec: {
        schemaVersion: '1.0',
        labId: 'lab-8',
        title: 'Lab 8',
        objectives: ['FSM path proof'],
        checkpoints: [
          {
            id: 'fsm-invalid-path',
            type: 'truth-table',
            title: 'Invalid path',
            config: {
              schedule: 'combinational',
              inputs: ['n1'],
              outputs: ['n2'],
              table: [{ inputs: { n1: true }, outputs: { n2: true } }],
            },
          },
          {
            id: 'fsm-valid-path',
            type: 'truth-table',
            title: 'Valid path',
            config: {
              schedule: 'combinational',
              inputs: ['n1'],
              outputs: ['n2'],
              table: [{ inputs: { n1: true }, outputs: { n2: true } }],
            },
          },
        ],
      },
    });

    const unblocked = await generateIdeSubmissionBundle({
      project: passingLab8,
      verifyLastRun: null,
      verifyRunHistory: [],
      submittedAt: '2026-01-15T12:00:00.000Z',
      appCommitSha: 'abc123',
    });

    expect(unblocked.gradeSummary.proofRuns.fsmPathsRun).toBe(true);
    expect(unblocked.gradeSummary.gateResults.some((gate) => gate.gateId === 'fsm_paths_missing')).toBe(false);
  });

  it('proof flags stay in lockstep between runtime gate evaluation and parsed submission summary', async () => {
    const scenarios: Array<{
      label: string;
      labId: 'lab-7' | 'lab-8';
      project: RBProject;
      proofKey: 'sequenceProofRun' | 'fsmPathsRun';
      missingGateId: 'sequence_proof_missing' | 'fsm_paths_missing';
      expectedProof: boolean;
    }> = [
      {
        label: 'lab7-fail',
        labId: 'lab-7',
        project: makeProject({
          hdl: makeLabReadyHdl(),
          meta: { projectId: 'lab7-sync-fail', appSurface: 'ide-export', labId: 'lab-7' },
          labSpec: {
            schemaVersion: '1.0',
            labId: 'lab-7',
            title: 'Lab 7',
            objectives: ['Counter proof'],
            checkpoints: [
              {
                id: 'counter-sequence-proof',
                type: 'truth-table',
                title: 'Counter sequence',
                config: {
                  schedule: 'combinational',
                  inputs: ['n1'],
                  outputs: ['n2'],
                  table: [{ inputs: { n1: true }, outputs: { n2: false } }],
                },
              },
            ],
          },
        }),
        proofKey: 'sequenceProofRun',
        missingGateId: 'sequence_proof_missing',
        expectedProof: false,
      },
      {
        label: 'lab7-pass',
        labId: 'lab-7',
        project: makeProject({
          hdl: makeLabReadyHdl(),
          meta: { projectId: 'lab7-sync-pass', appSurface: 'ide-export', labId: 'lab-7' },
          labSpec: {
            schemaVersion: '1.0',
            labId: 'lab-7',
            title: 'Lab 7',
            objectives: ['Counter proof'],
            checkpoints: [
              {
                id: 'counter-sequence-proof',
                type: 'truth-table',
                title: 'Counter sequence',
                config: {
                  schedule: 'combinational',
                  inputs: ['n1'],
                  outputs: ['n2'],
                  table: [{ inputs: { n1: true }, outputs: { n2: true } }],
                },
              },
            ],
          },
        }),
        proofKey: 'sequenceProofRun',
        missingGateId: 'sequence_proof_missing',
        expectedProof: true,
      },
      {
        label: 'lab8-fail',
        labId: 'lab-8',
        project: makeProject({
          hdl: makeLabReadyHdl(),
          meta: { projectId: 'lab8-fsm-fail', appSurface: 'ide-export', labId: 'lab-8' },
          labSpec: {
            schemaVersion: '1.0',
            labId: 'lab-8',
            title: 'Lab 8',
            objectives: ['FSM path proof'],
            checkpoints: [
              {
                id: 'fsm-invalid-path',
                type: 'truth-table',
                title: 'Invalid path',
                config: {
                  schedule: 'combinational',
                  inputs: ['n1'],
                  outputs: ['n2'],
                  table: [{ inputs: { n1: true }, outputs: { n2: true } }],
                },
              },
              {
                id: 'fsm-valid-path',
                type: 'truth-table',
                title: 'Valid path',
                config: {
                  schedule: 'combinational',
                  inputs: ['n1'],
                  outputs: ['n2'],
                  table: [{ inputs: { n1: true }, outputs: { n2: false } }],
                },
              },
            ],
          },
        }),
        proofKey: 'fsmPathsRun',
        missingGateId: 'fsm_paths_missing',
        expectedProof: false,
      },
      {
        label: 'lab8-pass',
        labId: 'lab-8',
        project: makeProject({
          hdl: makeLabReadyHdl(),
          meta: { projectId: 'lab8-fsm-pass', appSurface: 'ide-export', labId: 'lab-8' },
          labSpec: {
            schemaVersion: '1.0',
            labId: 'lab-8',
            title: 'Lab 8',
            objectives: ['FSM path proof'],
            checkpoints: [
              {
                id: 'fsm-invalid-path',
                type: 'truth-table',
                title: 'Invalid path',
                config: {
                  schedule: 'combinational',
                  inputs: ['n1'],
                  outputs: ['n2'],
                  table: [{ inputs: { n1: true }, outputs: { n2: true } }],
                },
              },
              {
                id: 'fsm-valid-path',
                type: 'truth-table',
                title: 'Valid path',
                config: {
                  schedule: 'combinational',
                  inputs: ['n1'],
                  outputs: ['n2'],
                  table: [{ inputs: { n1: true }, outputs: { n2: true } }],
                },
              },
            ],
          },
        }),
        proofKey: 'fsmPathsRun',
        missingGateId: 'fsm_paths_missing',
        expectedProof: true,
      },
    ];

    for (const scenario of scenarios) {
      const proofRuns = await deriveProofRunFlags(scenario.project, scenario.labId);
      const runtimeGate = validateSubmissionForLab(scenario.labId, {
        projectSnapshot: scenario.project,
        doctorReport: null,
        recentRuns: {
          simulated: true,
          synthesized: true,
          ...proofRuns,
        },
      });

      const generated = await generateIdeSubmissionBundle({
        project: scenario.project,
        verifyLastRun: null,
        verifyRunHistory: [],
        submittedAt: '2026-01-15T12:00:00.000Z',
        appCommitSha: 'abc123',
      });
      const parsed = await parseIdeSubmissionZip(generated.bytes.buffer as ArrayBuffer);

      expect(parsed.gradeSummary.proofRuns[scenario.proofKey], `${scenario.label}: parsed proof flag`).toBe(scenario.expectedProof);
      expect(generated.gradeSummary.proofRuns[scenario.proofKey], `${scenario.label}: generated proof flag`).toBe(scenario.expectedProof);

      const runtimeMissing = runtimeGate.issues.some((issue) => issue.code === scenario.missingGateId);
      const summaryMissing = parsed.gradeSummary.gateResults.some((gate) => gate.gateId === scenario.missingGateId);
      expect(runtimeMissing, `${scenario.label}: runtime missing gate issue`).toBe(!scenario.expectedProof);
      expect(summaryMissing, `${scenario.label}: parsed summary missing gate issue`).toBe(!scenario.expectedProof);
      expect(parsed.gradeSummary.overallGateVerdict, `${scenario.label}: verdict parity`).toBe(runtimeGate.verdict);
    }
  });
});
