import { describe, expect, it } from 'vitest';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';

describe('projectHealth verify trust vs structural blockers', () => {
  it('keeps failed verify out of structural blockingIssues while still routing the student back to Verify', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'fail',
          hash: 'verify-fail-hash',
          ranAtIso: '2026-03-17T00:00:00.000Z',
        },
        lastExport: undefined,
        dirtySinceVerify: false,
        dirtySinceExport: false,
      },
      {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
      }
    );

    expect(health.blockingIssues).toEqual([]);
    expect(
      choosePrimaryProjectCta(health, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
      })
    ).toEqual({ label: 'Verify', mode: 'verify', code: 'RBP1004' });
  });

  it('keeps stale verify out of structural blockingIssues while preserving export dirtiness', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          ranAtIso: '2026-03-17T00:00:00.000Z',
        },
        lastExport: undefined,
        dirtySinceVerify: true,
        dirtySinceExport: true,
      },
      {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
      }
    );

    expect(health.blockingIssues).toEqual([
      {
        code: 'RBP2002',
        message: 'Project changed since last successful export.',
        fixPath: { mode: 'export', actionLabel: 'Build Evidence Capsule' },
      },
    ]);
  });
});
