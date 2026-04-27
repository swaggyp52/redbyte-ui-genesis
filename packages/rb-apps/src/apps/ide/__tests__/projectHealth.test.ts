import { describe, expect, it } from 'vitest';
import { choosePrimaryProjectCta, deriveProjectHealth, deriveProjectVerifyState, deriveStageCompletion, hasCurrentPassingVerify } from '../projectHealth';

describe('deriveProjectVerifyState — four canonical verify states (GAP-007)', () => {
  const passedLastVerify = {
    status: 'pass' as const,
    hash: 'abc',
    ranAtIso: '2026-04-01T00:00:00.000Z',
  };
  const failedLastVerify = {
    status: 'fail' as const,
    hash: 'abc',
    ranAtIso: '2026-04-01T00:00:00.000Z',
  };

  it('returns not-run when lastVerify is undefined', () => {
    expect(deriveProjectVerifyState({ lastVerify: undefined, dirtySinceVerify: false })).toBe('not-run');
  });

  it('returns stale when lastVerify exists but circuit changed since (dirtySinceVerify)', () => {
    expect(deriveProjectVerifyState({ lastVerify: passedLastVerify, dirtySinceVerify: true })).toBe('stale');
  });

  it('returns assertions-differ when verify failed and not stale', () => {
    expect(deriveProjectVerifyState({ lastVerify: failedLastVerify, dirtySinceVerify: false })).toBe('assertions-differ');
  });

  it('returns assertions-match when verify passed and circuit is current', () => {
    expect(deriveProjectVerifyState({ lastVerify: passedLastVerify, dirtySinceVerify: false })).toBe('assertions-match');
  });
});

describe('hasCurrentPassingVerify — export trust authority (GAP-007)', () => {
  it('returns false when verify has not run', () => {
    expect(hasCurrentPassingVerify({ lastVerify: undefined, dirtySinceVerify: false })).toBe(false);
  });

  it('returns false when verify is stale (design changed after pass)', () => {
    expect(hasCurrentPassingVerify({
      lastVerify: { status: 'pass', hash: 'abc', ranAtIso: '2026-04-01T00:00:00.000Z' },
      dirtySinceVerify: true,
    })).toBe(false);
  });

  it('returns false when verify assertions differ', () => {
    expect(hasCurrentPassingVerify({
      lastVerify: { status: 'fail', hash: 'abc', ranAtIso: '2026-04-01T00:00:00.000Z' },
      dirtySinceVerify: false,
    })).toBe(false);
  });

  it('returns true only when verify passed and circuit is current', () => {
    expect(hasCurrentPassingVerify({
      lastVerify: { status: 'pass', hash: 'abc', ranAtIso: '2026-04-01T00:00:00.000Z' },
      dirtySinceVerify: false,
    })).toBe(true);
  });
});

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
        fixPath: { mode: 'hardware', actionLabel: 'Open Map Pins' },
      },
    ]);
    expect(
      choosePrimaryProjectCta(health, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: 'incomplete-mapping',
      })
    ).toEqual({ label: 'Map Pins', mode: 'hardware', code: 'RBP1005' });
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
      label: 'Map Pins',
      mode: 'hardware',
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

  it('routes trace-only current evidence back to Verify instead of treating it like a pass', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          runKind: 'trace',
          hash: 'verify-trace-hash',
          ranAtIso: '2026-03-25T00:00:00.000Z',
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

  it('routes a current, export-ready project to Program as the final student-facing CTA', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          ranAtIso: '2026-03-27T00:00:00.000Z',
        },
        lastExport: {
          status: 'ok',
          hash: 'export-hash',
          ranAtIso: '2026-03-27T00:05:00.000Z',
        },
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

    expect(
      choosePrimaryProjectCta(health, {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        verifyQualification: undefined,
      })
    ).toEqual({ label: 'Program', mode: 'hardware', code: 'RBP4000' });
  });

  it('keeps stale verify and stale export out of structural blockingIssues', () => {
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

    expect(health.blockingIssues).toEqual([]);
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

describe('deriveStageCompletion — unified progress signal for all three nav systems', () => {
  it('marks only design as complete when circuit exists but nothing else is done', () => {
    const health = deriveProjectHealth(
      { lastVerify: undefined, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: false, hasVectors: false }
    );
    const completion = deriveStageCompletion(health, { hasCircuit: true, hasIoMapping: false, hasVectors: false });
    expect(completion).toEqual({ design: true, verify: false, hardware: false, export: false });
  });

  it('marks design as incomplete when no circuit exists', () => {
    const health = deriveProjectHealth(
      { lastVerify: undefined, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: false, hasIoMapping: false, hasVectors: false }
    );
    const completion = deriveStageCompletion(health, { hasCircuit: false, hasIoMapping: false, hasVectors: false });
    expect(completion.design).toBe(false);
  });

  it('does NOT require mapping for design completion (pipeline-strip bug fix)', () => {
    const health = deriveProjectHealth(
      { lastVerify: undefined, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: false, hasVectors: false }
    );
    const completion = deriveStageCompletion(health, { hasCircuit: true, hasIoMapping: false, hasVectors: false });
    expect(completion.design).toBe(true);
  });

  it('marks verify as complete for any current run (assertions-match, trace, assertions-differ)', () => {
    // assertions-match: pass verify run, not stale → complete
    const passCurrent = deriveProjectHealth(
      { lastVerify: { status: 'pass', hash: 'h1', ranAtIso: '2026-04-01T00:00:00Z' }, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    expect(deriveStageCompletion(passCurrent, { hasCircuit: true, hasIoMapping: true, hasVectors: true }).verify).toBe(true);

    // stale: pass run but circuit changed → incomplete (needs re-run)
    const passStale = deriveProjectHealth(
      { lastVerify: { status: 'pass', hash: 'h1', ranAtIso: '2026-04-01T00:00:00Z' }, lastExport: undefined, dirtySinceVerify: true, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    expect(deriveStageCompletion(passStale, { hasCircuit: true, hasIoMapping: true, hasVectors: true }).verify).toBe(false);

    // assertions-differ: verify ran, student saw failures → complete (engaged; can proceed)
    const failed = deriveProjectHealth(
      { lastVerify: { status: 'fail', hash: 'h1', ranAtIso: '2026-04-01T00:00:00Z' }, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    expect(deriveStageCompletion(failed, { hasCircuit: true, hasIoMapping: true, hasVectors: true }).verify).toBe(true);

    // trace: observation-only run → complete (student observed behavior)
    const traceRun = deriveProjectHealth(
      { lastVerify: { status: 'pass', hash: 'h2', runKind: 'trace', ranAtIso: '2026-04-01T00:00:00Z' }, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    expect(deriveStageCompletion(traceRun, { hasCircuit: true, hasIoMapping: true, hasVectors: true }).verify).toBe(true);

    // not-run: no verify at all → incomplete
    const noRun = deriveProjectHealth(
      { lastVerify: undefined, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    expect(deriveStageCompletion(noRun, { hasCircuit: true, hasIoMapping: true, hasVectors: true }).verify).toBe(false);
  });

  it('marks hardware complete when IO mapping exists', () => {
    const health = deriveProjectHealth(
      { lastVerify: undefined, lastExport: undefined, dirtySinceVerify: false, dirtySinceExport: false },
      { hasCircuit: true, hasIoMapping: true, hasVectors: false }
    );
    expect(deriveStageCompletion(health, { hasCircuit: true, hasIoMapping: true, hasVectors: false }).hardware).toBe(true);
  });

  it('marks export as complete only when export is ok and not dirty', () => {
    const exportOk = deriveProjectHealth(
      {
        lastVerify: { status: 'pass', hash: 'h1', ranAtIso: '2026-04-01T00:00:00Z' },
        lastExport: { status: 'ok', hash: 'e1', ranAtIso: '2026-04-01T00:05:00Z' },
        dirtySinceVerify: false,
        dirtySinceExport: false,
      },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    expect(deriveStageCompletion(exportOk, { hasCircuit: true, hasIoMapping: true, hasVectors: true }).export).toBe(true);

    const exportDirty = deriveProjectHealth(
      {
        lastVerify: { status: 'pass', hash: 'h1', ranAtIso: '2026-04-01T00:00:00Z' },
        lastExport: { status: 'ok', hash: 'e1', ranAtIso: '2026-04-01T00:05:00Z' },
        dirtySinceVerify: false,
        dirtySinceExport: true,
      },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    expect(deriveStageCompletion(exportDirty, { hasCircuit: true, hasIoMapping: true, hasVectors: true }).export).toBe(false);
  });

  it('marks all stages complete for a fully-done project', () => {
    const health = deriveProjectHealth(
      {
        lastVerify: { status: 'pass', hash: 'h1', ranAtIso: '2026-04-01T00:00:00Z' },
        lastExport: { status: 'ok', hash: 'e1', ranAtIso: '2026-04-01T00:05:00Z' },
        dirtySinceVerify: false,
        dirtySinceExport: false,
      },
      { hasCircuit: true, hasIoMapping: true, hasVectors: true }
    );
    const completion = deriveStageCompletion(health, { hasCircuit: true, hasIoMapping: true, hasVectors: true });
    expect(completion).toEqual({ design: true, verify: true, hardware: true, export: true });
  });
});
