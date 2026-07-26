import { describe, expect, it } from 'vitest';
import {
  buildProjectExportPackageSourceHash,
  deriveExportTrustAxes,
  formatExportDerivedState,
  isExportDownloadReceiptCurrent,
} from '../exportTrustState';
import type { RBProject } from '../../../export/projectFormat';

describe('exportTrustState', () => {
  it('keeps structural, Verify-trust, and action axes independent', () => {
    expect(deriveExportTrustAxes({
      structuralBlocked: false,
      verifyState: 'not-run',
      compareMatches: false,
      comparePassIncomplete: false,
      downloadedTrust: undefined,
    })).toEqual({
      structural: 'downloadable',
      verificationTrust: 'unverified',
      action: 'not-downloaded',
      derived: 'downloadable-unverified',
    });

    expect(deriveExportTrustAxes({
      structuralBlocked: false,
      verifyState: 'assertions-differ',
      compareMatches: false,
      comparePassIncomplete: false,
      downloadedTrust: 'draft',
    })).toEqual({
      structural: 'downloadable',
      verificationTrust: 'draft',
      action: 'downloaded',
      derived: 'downloaded-draft',
    });

    expect(deriveExportTrustAxes({
      structuralBlocked: false,
      verifyState: 'assertions-match',
      compareMatches: true,
      comparePassIncomplete: false,
      downloadedTrust: 'trusted',
    })).toEqual({
      structural: 'downloadable',
      verificationTrust: 'trusted',
      action: 'downloaded',
      derived: 'downloaded-trusted',
    });
  });

  it('never lets Verify state make a structurally blocked export downloadable', () => {
    const axes = deriveExportTrustAxes({
      structuralBlocked: true,
      verifyState: 'assertions-match',
      compareMatches: true,
      comparePassIncomplete: false,
      downloadedTrust: undefined,
    });

    expect(axes).toEqual({
      structural: 'blocked',
      verificationTrust: 'trusted',
      action: 'not-downloaded',
      derived: 'blocked',
    });
    expect(formatExportDerivedState(axes.derived)).toBe('Blocked');
  });

  it('treats trace-only as unverified and stale or incomplete Compare evidence as draft', () => {
    expect(deriveExportTrustAxes({
      structuralBlocked: false,
      verifyState: 'trace',
      compareMatches: false,
      comparePassIncomplete: false,
      downloadedTrust: undefined,
    }).verificationTrust).toBe('unverified');

    expect(deriveExportTrustAxes({
      structuralBlocked: false,
      verifyState: 'stale',
      compareMatches: false,
      comparePassIncomplete: false,
      downloadedTrust: undefined,
    }).verificationTrust).toBe('draft');

    expect(deriveExportTrustAxes({
      structuralBlocked: false,
      verifyState: 'assertions-match',
      compareMatches: false,
      comparePassIncomplete: true,
      downloadedTrust: undefined,
    }).verificationTrust).toBe('draft');
  });

  it('never promotes stored draft download evidence when live Verify later passes', () => {
    const axes = deriveExportTrustAxes({
      structuralBlocked: false,
      verifyState: 'assertions-match',
      compareMatches: true,
      comparePassIncomplete: false,
      downloadedTrust: 'draft',
    });

    expect(axes.verificationTrust).toBe('trusted');
    expect(axes.derived).toBe('downloaded-draft');
  });

  it('binds receipt currentness to Verify-derived artifact inputs and stored trust', () => {
    const project = {
      kind: 'rb-project',
      version: 1,
      name: 'receipt-fixture',
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
      circuit: { nodes: [], connections: [] },
      fpga: { board: 'basys3', top: 'top' },
    } as RBProject;
    const draftHash = buildProjectExportPackageSourceHash(project, [
      { path: 'EXPECTED_IO.json', content: '{"verifyHash":"draft"}' },
    ]);
    const trustedHash = buildProjectExportPackageSourceHash(project, [
      { path: 'EXPECTED_IO.json', content: '{"verifyHash":"trusted"}' },
    ]);
    const receipt = {
      status: 'ok' as const,
      hash: draftHash,
      packageHash: 'a'.repeat(64),
      verificationTrust: 'draft' as const,
      downloadKind: 'project' as const,
      sourceHashes: { project: 'project-hash', export: draftHash, verify: 'verify-draft' },
      sourceCurrentness: {
        project: 'current' as const,
        export: 'current' as const,
        mapping: 'current' as const,
        verify: 'failed' as const,
      },
    };

    expect(isExportDownloadReceiptCurrent({
      receipt,
      currentPackageSourceHash: draftHash,
      currentProjectHash: 'project-hash',
      currentVerifyHash: 'verify-draft',
      currentVerificationTrust: 'draft',
      downloadKind: 'project',
    })).toBe(true);
    expect(isExportDownloadReceiptCurrent({
      receipt,
      currentPackageSourceHash: trustedHash,
      currentProjectHash: 'project-hash',
      currentVerifyHash: 'verify-trusted',
      currentVerificationTrust: 'trusted',
      downloadKind: 'project',
    })).toBe(false);
  });
});
