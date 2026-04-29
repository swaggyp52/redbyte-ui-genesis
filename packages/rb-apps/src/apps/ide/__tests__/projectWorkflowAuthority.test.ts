import { describe, expect, it } from 'vitest';
import type { ProjectHealthCore, ProjectReadinessState } from '../projectHealth';
import {
  deriveHardwareExportFailureTruth,
  deriveProjectWorkflowAuthority,
} from '../projectWorkflowAuthority';

function deriveAuthority(input: {
  core?: Partial<ProjectHealthCore>;
  readiness?: Partial<ProjectReadinessState>;
  currentVerifyProjectHash?: string | null;
  currentExportHash?: string | null;
  verifyRunHistory?: Array<{ projectHash: string }>;
} = {}) {
  const core: ProjectHealthCore = {
    lastVerify: undefined,
    lastExport: undefined,
    dirtySinceVerify: false,
    dirtySinceExport: false,
    ...input.core,
  };
  const readiness: ProjectReadinessState = {
    hasCircuit: true,
    hasIoMapping: true,
    hasVectors: true,
    verifyQualification: core.lastVerify?.qualification,
    ...input.readiness,
  };

  return deriveProjectWorkflowAuthority({
    projectHealthCore: core,
    readiness,
    verifyLastRun: core.lastVerify,
    verifyRunHistory: input.verifyRunHistory,
    currentVerifyProjectHash: input.currentVerifyProjectHash,
    currentExportHash: input.currentExportHash,
  });
}

describe('project workflow authority', () => {
  it('keeps not-run verify advisory instead of trusted', () => {
    const authority = deriveAuthority();

    expect(authority.verifyState).toBe('not-run');
    expect(authority.compareCurrent).toBe(false);
    expect(authority.exportAvailable).toBe(true);
    expect(authority.exportTrusted).toBe(false);
    expect(authority.truthState).toBe('needs-verify');
    expect(authority.draftExportAvailable).toBe(true);
    expect(authority.hardwareReady).toBe(false);
    expect(authority.primaryCta).toEqual({
      label: 'Verify',
      mode: 'verify',
      code: 'RBP1004',
    });
  });

  it('never treats trace-only verify as a passing comparison', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          runKind: 'trace',
          hash: 'trace-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
      },
    });

    expect(authority.verifyState).toBe('trace');
    expect(authority.compareTraceOnly).toBe(true);
    expect(authority.compareMatches).toBe(false);
    expect(authority.exportTrusted).toBe(false);
    expect(authority.statusBarGateStatus).toBe('warn');
  });

  it('keeps failed compare advisory instead of blocked', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'fail',
          hash: 'verify-fail-hash',
          reportHash: 'report-fail-hash',
          failingTick: 3,
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
      },
    });

    expect(authority.verifyState).toBe('assertions-differ');
    expect(authority.compareDiffers).toBe(true);
    expect(authority.exportAvailable).toBe(true);
    expect(authority.exportTrusted).toBe(false);
    expect(authority.statusBarGateStatus).toBe('warn');
  });

  it('marks current passing verify and export as fully ready', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
        lastExport: {
          status: 'ok',
          hash: 'export-pass-hash',
          ranAtIso: '2026-04-06T10:01:00.000Z',
        },
      },
      currentVerifyProjectHash: 'verify-pass-hash',
      currentExportHash: 'export-pass-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(authority.verifyCurrent).toBe(true);
    expect(authority.verifyState).toBe('assertions-match');
    expect(authority.compareMatches).toBe(true);
    expect(authority.exportCurrent).toBe(true);
    expect(authority.exportPackageCurrent).toBe(true);
    expect(authority.exportTrusted).toBe(true);
    expect(authority.truthState).toBe('hardware-proof-required');
    expect(authority.trustedVerifyCurrent).toBe(true);
    expect(authority.hardwareReady).toBe(true);
    expect(authority.stageCompletion).toEqual({
      design: true,
      verify: true,
      hardware: true,
      export: true,
    });
    expect(authority.statusBarGateStatus).toBe('pass');
  });

  it('demotes verify to stale after mapping changes', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
        dirtySinceVerify: true,
      },
      currentVerifyProjectHash: 'verify-new-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(authority.verifyCurrent).toBe(false);
    expect(authority.verifyState).toBe('stale');
    expect(authority.compareCurrent).toBe(false);
    expect(authority.exportTrusted).toBe(false);
    expect(authority.primaryCta).toEqual({
      label: 'Verify',
      mode: 'verify',
      code: 'RBP1004',
    });
    expect(authority.statusBarGateStatus).toBe('warn');
  });

  it('keeps verify current while surfacing stale export as a re-export state', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
        lastExport: {
          status: 'ok',
          hash: 'export-old-hash',
          ranAtIso: '2026-04-06T10:01:00.000Z',
        },
        dirtySinceExport: true,
      },
      currentVerifyProjectHash: 'verify-pass-hash',
      currentExportHash: 'export-new-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(authority.verifyCurrent).toBe(true);
    expect(authority.verifyState).toBe('assertions-match');
    expect(authority.compareMatches).toBe(true);
    expect(authority.exportCurrent).toBe(false);
    expect(authority.exportPackageCurrent).toBe(false);
    expect(authority.exportTrusted).toBe(false);
    expect(authority.truthState).toBe('trusted-export-ready');
    expect(authority.hardwareReady).toBe(false);
    expect(authority.statusBarGateStatus).toBe('warn');
  });

  it('keeps stage completion and primary CTA aligned when export is the next required step', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
        lastExport: {
          status: 'ok',
          hash: 'export-old-hash',
          ranAtIso: '2026-04-06T10:01:00.000Z',
        },
        dirtySinceExport: true,
      },
      currentVerifyProjectHash: 'verify-pass-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(authority.stageCompletion).toEqual({
      design: true,
      verify: true,
      hardware: true,
      export: false,
    });
    expect(authority.primaryCta).toEqual({
      label: 'Export',
      mode: 'export',
      code: 'RBP2002',
    });
  });

  it('maps required pin gaps to a blocked Map Pins handoff', () => {
    const authority = deriveAuthority();

    expect(
      deriveHardwareExportFailureTruth({
        workflowAuthority: authority,
        hasRequiredMappingGap: true,
        hasOtherBlockingIssue: false,
      })
    ).toEqual(
      expect.objectContaining({
        condition: 'mapping-incomplete',
        severity: 'blocked',
        statusLabel: 'BLOCKED',
        primaryCtaLabel: 'Open Map Pins',
        primaryCtaIntent: 'map-pins',
      })
    );
  });

  it('maps missing export bundles to a ready-to-build handoff instead of a blocker', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
      },
      currentVerifyProjectHash: 'verify-pass-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(
      deriveHardwareExportFailureTruth({
        workflowAuthority: authority,
        hasRequiredMappingGap: false,
        hasOtherBlockingIssue: false,
      })
    ).toEqual(
      expect.objectContaining({
        condition: 'export-missing',
        severity: 'advisory',
        statusLabel: 'READY TO BUILD',
        primaryCtaLabel: 'Build Current Bundle',
        primaryCtaIntent: 'build-current-bundle',
      })
    );
  });

  it('maps stale export bundles to a rebuild advisory instead of a blocker', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
        lastExport: {
          status: 'ok',
          hash: 'export-old-hash',
          ranAtIso: '2026-04-06T10:01:00.000Z',
        },
        dirtySinceExport: true,
      },
      currentVerifyProjectHash: 'verify-pass-hash',
      currentExportHash: 'export-new-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(
      deriveHardwareExportFailureTruth({
        workflowAuthority: authority,
        hasRequiredMappingGap: false,
        hasOtherBlockingIssue: false,
      })
    ).toEqual(
      expect.objectContaining({
        condition: 'export-stale',
        severity: 'advisory',
        statusLabel: 'STALE',
        primaryCtaLabel: 'Rebuild Current Bundle',
        primaryCtaIntent: 're-export-current-bundle',
      })
    );
  });

  it('maps stale verify evidence to an advisory Open Verify handoff', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
        lastExport: {
          status: 'ok',
          hash: 'export-pass-hash',
          ranAtIso: '2026-04-06T10:01:00.000Z',
        },
        dirtySinceVerify: true,
      },
      currentVerifyProjectHash: 'verify-new-hash',
      currentExportHash: 'export-pass-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(
      deriveHardwareExportFailureTruth({
        workflowAuthority: authority,
        hasRequiredMappingGap: false,
        hasOtherBlockingIssue: false,
      })
    ).toEqual(
      expect.objectContaining({
        condition: 'verify-stale',
        severity: 'advisory',
        statusLabel: 'NEEDS REVIEW',
        primaryCtaLabel: 'Open Verify',
        primaryCtaIntent: 'verify',
      })
    );
  });

  it('maps current verify plus current export to a ready program handoff', () => {
    const authority = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-pass-hash',
          reportHash: 'verify-report-hash',
          ranAtIso: '2026-04-06T10:00:00.000Z',
        },
        lastExport: {
          status: 'ok',
          hash: 'export-pass-hash',
          ranAtIso: '2026-04-06T10:01:00.000Z',
        },
      },
      currentVerifyProjectHash: 'verify-pass-hash',
      currentExportHash: 'export-pass-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(
      deriveHardwareExportFailureTruth({
        workflowAuthority: authority,
        hasRequiredMappingGap: false,
        hasOtherBlockingIssue: false,
      })
    ).toEqual(
      expect.objectContaining({
        condition: 'ready',
        severity: 'ready',
        statusLabel: 'READY',
        primaryCtaLabel: 'Open Program Handoff',
        primaryCtaIntent: 'program-handoff',
      })
    );
  });
});
