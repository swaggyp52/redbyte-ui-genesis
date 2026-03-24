import { describe, expect, it } from 'vitest';
import { choosePrimaryProjectCta, deriveProjectHealth } from '../projectHealth';

describe('projectHealth verify trust vs structural blockers', () => {
  it('treats pass-with-incomplete-mapping as a hardware trust blocker in shared project health', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          qualification: 'incomplete-mapping',
          ranAtIso: '2026-03-21T00:00:00.000Z',
        },
        lastExport: undefined,
        dirtySinceVerify: false,
        dirtySinceExport: false,
      },
      {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: 'incomplete-mapping',
      }
    );

    expect(health.blockingIssues).toEqual([
      {
        code: 'RBP1005',
        message:
          'Some required output pins remain unmapped. Finish mapping before relying on hardware behavior.',
        fixPath: { mode: 'hardware', actionLabel: 'Open Hardware' },
      },
    ]);
    expect(
      choosePrimaryProjectCta(health, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: 'incomplete-mapping',
      })
    ).toEqual({ label: 'Hardware', mode: 'hardware', code: 'RBP1005' });
  });

  it('falls back to core lastVerify qualification when readiness qualification is unavailable', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          qualification: 'incomplete-mapping',
          ranAtIso: '2026-03-21T00:00:00.000Z',
        },
        lastExport: undefined,
        dirtySinceVerify: false,
        dirtySinceExport: false,
      },
      {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: undefined,
      }
    );

    expect(health.blockingIssues).toContainEqual(
      expect.objectContaining({ code: 'RBP1005' })
    );
  });

  it('keeps structural mapping blockers ahead of RBP1005 when choosing the primary CTA', () => {
    const readiness = {
      hasCircuit: true,
      hasIoMapping: false,
      hasVectors: true,
      verifyQualification: 'incomplete-mapping' as const,
    };
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          qualification: 'incomplete-mapping',
          ranAtIso: '2026-03-21T00:00:00.000Z',
        },
        lastExport: undefined,
        dirtySinceVerify: false,
        dirtySinceExport: false,
      },
      readiness
    );

    expect(health.blockingIssues.map((issue) => issue.code)).toEqual(['RBP1001', 'RBP1005']);
    expect(choosePrimaryProjectCta(health, readiness)).toEqual({
      label: 'Design',
      mode: 'design',
      code: 'RBP1001',
    });
  });

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
        verifyQualification: undefined,
      }
    );

    expect(health.blockingIssues).toEqual([]);
    expect(
      choosePrimaryProjectCta(health, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: undefined,
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
        verifyQualification: undefined,
      }
    );

    expect(health.blockingIssues).toEqual([
      {
        code: 'RBP2002',
        message: 'Project changed since last successful export.',
        fixPath: { mode: 'export', actionLabel: 'Build Submission Package' },
      },
    ]);
  });

  it('routes back to Verify after a design mutation even when required mapping is now incomplete', () => {
    const readiness = {
      hasCircuit: true,
      hasIoMapping: false,
      hasVectors: true,
      verifyQualification: undefined,
    };
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          ranAtIso: '2026-03-23T00:00:00.000Z',
        },
        lastExport: undefined,
        dirtySinceVerify: true,
        dirtySinceExport: false,
      },
      readiness
    );

    expect(health.blockingIssues.map((issue) => issue.code)).toContain('RBP1001');
    expect(choosePrimaryProjectCta(health, readiness)).toEqual({
      label: 'Verify',
      mode: 'verify',
      code: 'RBP1004',
    });
  });
});
