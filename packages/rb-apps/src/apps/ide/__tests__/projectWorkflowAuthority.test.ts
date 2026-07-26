import { describe, expect, it } from 'vitest';
import type { ProjectHealthCore, ProjectReadinessState } from '../projectHealth';
import {
  deriveHardwareExportFailureTruth,
  deriveProjectWorkflowAuthority,
  isDesignOwnedExportDiagnostic,
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

  it('keeps Project and Export trust truthful through expected-output fail edit repair', () => {
    const initialPass = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-initial-hash',
          reportHash: 'verify-initial-report',
          ranAtIso: '2026-06-12T10:00:00.000Z',
        },
      },
      currentVerifyProjectHash: 'verify-initial-hash',
      verifyRunHistory: [{ projectHash: 'verify-initial-hash' }],
    });

    expect(initialPass.verifyState).toBe('assertions-match');
    expect(initialPass.compareMatches).toBe(true);
    expect(initialPass.trustedVerifyCurrent).toBe(true);

    const staleAfterWrongExpectedEdit = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-initial-hash',
          reportHash: 'verify-initial-report',
          ranAtIso: '2026-06-12T10:00:00.000Z',
        },
        dirtySinceVerify: true,
        dirtySinceExport: true,
      },
      currentVerifyProjectHash: 'verify-wrong-expected-hash',
      verifyRunHistory: [{ projectHash: 'verify-initial-hash' }],
    });

    expect(staleAfterWrongExpectedEdit.verifyState).toBe('stale');
    expect(staleAfterWrongExpectedEdit.compareMatches).toBe(false);
    expect(staleAfterWrongExpectedEdit.exportTrusted).toBe(false);
    expect(staleAfterWrongExpectedEdit.primaryCta).toEqual({
      label: 'Verify',
      mode: 'verify',
      code: 'RBP1004',
    });

    const failedCompare = deriveAuthority({
      core: {
        lastVerify: {
          status: 'fail',
          hash: 'verify-wrong-expected-hash',
          reportHash: 'verify-fail-report',
          failingTick: 0,
          ranAtIso: '2026-06-12T10:01:00.000Z',
        },
        dirtySinceExport: true,
      },
      currentVerifyProjectHash: 'verify-wrong-expected-hash',
      verifyRunHistory: [{ projectHash: 'verify-wrong-expected-hash' }],
    });

    expect(failedCompare.verifyState).toBe('assertions-differ');
    expect(failedCompare.compareDiffers).toBe(true);
    expect(failedCompare.compareMatches).toBe(false);
    expect(failedCompare.exportTrusted).toBe(false);
    expect(
      deriveHardwareExportFailureTruth({
        workflowAuthority: failedCompare,
        hasRequiredMappingGap: false,
        hasOtherBlockingIssue: false,
      })
    ).toEqual(
      expect.objectContaining({
        condition: 'assertions-differ',
        severity: 'advisory',
        primaryCtaIntent: 'verify',
      })
    );

    const staleAfterRepairEdit = deriveAuthority({
      core: {
        lastVerify: {
          status: 'fail',
          hash: 'verify-wrong-expected-hash',
          reportHash: 'verify-fail-report',
          failingTick: 0,
          ranAtIso: '2026-06-12T10:01:00.000Z',
        },
        dirtySinceVerify: true,
        dirtySinceExport: true,
      },
      currentVerifyProjectHash: 'verify-repaired-expected-hash',
      verifyRunHistory: [{ projectHash: 'verify-wrong-expected-hash' }],
    });

    expect(staleAfterRepairEdit.verifyState).toBe('stale');
    expect(staleAfterRepairEdit.compareDiffers).toBe(false);
    expect(staleAfterRepairEdit.exportTrusted).toBe(false);

    const repairedPass = deriveAuthority({
      core: {
        lastVerify: {
          status: 'pass',
          hash: 'verify-repaired-expected-hash',
          reportHash: 'verify-repaired-report',
          ranAtIso: '2026-06-12T10:02:00.000Z',
        },
        dirtySinceExport: true,
      },
      currentVerifyProjectHash: 'verify-repaired-expected-hash',
      verifyRunHistory: [{ projectHash: 'verify-repaired-expected-hash' }],
    });

    expect(repairedPass.verifyState).toBe('assertions-match');
    expect(repairedPass.verifyCurrent).toBe(true);
    expect(repairedPass.compareMatches).toBe(true);
    expect(repairedPass.trustedVerifyCurrent).toBe(true);
    expect(repairedPass.exportTrusted).toBe(false);
    expect(repairedPass.primaryCta).toEqual({
      label: 'Export',
      mode: 'export',
      code: 'RBP2002',
    });
    expect(
      deriveHardwareExportFailureTruth({
        workflowAuthority: repairedPass,
        hasRequiredMappingGap: false,
        hasOtherBlockingIssue: false,
      })
    ).toEqual(
      expect.objectContaining({
        condition: 'export-missing',
        severity: 'advisory',
        statusLabel: 'READY TO BUILD',
        primaryCtaLabel: 'Build Current Bundle',
      })
    );
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

  it('makes a current Design blocker authoritative over earlier passing evidence', () => {
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
      readiness: {
        hasBlockingDesignIssue: true,
        blockingDesignIssueMessage: 'Output LD2 is not driven by the circuit.',
      },
      currentVerifyProjectHash: 'verify-pass-hash',
      currentExportHash: 'export-pass-hash',
      verifyRunHistory: [{ projectHash: 'verify-pass-hash' }],
    });

    expect(authority.designReady).toBe(false);
    expect(authority.verifyBlockedByDesign).toBe(true);
    expect(authority.verifyCurrent).toBe(false);
    expect(authority.compareCurrent).toBe(false);
    expect(authority.comparePassCurrent).toBe(false);
    expect(authority.compareDiffers).toBe(false);
    expect(authority.compareTraceOnly).toBe(false);
    expect(authority.compareMatches).toBe(false);
    expect(authority.trustedVerifyCurrent).toBe(false);
    expect(authority.exportAvailable).toBe(false);
    expect(authority.exportTrusted).toBe(false);
    expect(authority.hardwareReady).toBe(false);
    expect(authority.stageCompletion).toEqual({
      design: false,
      verify: false,
      hardware: false,
      export: false,
    });
    expect(authority.primaryCta).toEqual({
      label: 'Open Design',
      mode: 'design',
      code: 'RBP1006',
    });
    expect(authority.statusBarGateStatus).toBe('fail');
  });

  it('revokes a prior failing Compare while preserving its stored history when Design is blocked', () => {
    const previousFailure = {
      status: 'fail' as const,
      hash: 'verify-fail-hash',
      reportHash: 'verify-fail-report',
      failingTick: 2,
      ranAtIso: '2026-07-15T12:00:00.000Z',
    };
    const core: ProjectHealthCore = {
      lastVerify: previousFailure,
      lastExport: undefined,
      dirtySinceVerify: false,
      dirtySinceExport: true,
    };

    const authority = deriveProjectWorkflowAuthority({
      projectHealthCore: core,
      readiness: {
        hasCircuit: true,
        hasIoMapping: true,
        hasVectors: true,
        hasBlockingDesignIssue: true,
        blockingDesignIssueMessage: 'Output LD2 is not driven by the circuit.',
      },
      verifyLastRun: previousFailure,
      verifyRunHistory: [{ projectHash: 'verify-fail-hash' }],
      currentVerifyProjectHash: 'verify-fail-hash',
    });

    expect(core.lastVerify).toBe(previousFailure);
    expect(authority.verifyBlockedByDesign).toBe(true);
    expect(authority.verifyState).toBe('stale');
    expect(authority.verifyCurrent).toBe(false);
    expect(authority.compareCurrent).toBe(false);
    expect(authority.comparePassCurrent).toBe(false);
    expect(authority.comparePassIncomplete).toBe(false);
    expect(authority.compareMatches).toBe(false);
    expect(authority.compareDiffers).toBe(false);
    expect(authority.compareTraceOnly).toBe(false);
    expect(authority.trustedVerifyCurrent).toBe(false);
    expect(authority.exportTrusted).toBe(false);
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

  it('keeps a current compare PASS blocked on Map Pins when required mappings are missing', () => {
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

    expect(authority.verifyCurrent).toBe(true);
    expect(authority.compareMatches).toBe(true);
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
        title: 'Verify evidence is stale',
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

  it('keeps RBEX4200 advisory for manual-event labs but Design-owned for synchronous timing', () => {
    expect(isDesignOwnedExportDiagnostic('RBEX4200', 'manual_event_driven_lab')).toBe(false);
    expect(isDesignOwnedExportDiagnostic('RBEX4200', 'synchronous_board_clock')).toBe(true);
    expect(isDesignOwnedExportDiagnostic('RBEX4200', 'combinational')).toBe(true);
    expect(isDesignOwnedExportDiagnostic('RBEX4103', 'manual_event_driven_lab')).toBe(true);
    expect(isDesignOwnedExportDiagnostic('RBEV1000', 'synchronous_board_clock')).toBe(false);
  });
});
