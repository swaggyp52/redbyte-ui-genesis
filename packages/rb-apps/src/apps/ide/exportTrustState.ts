import type {
  ProjectHealthExportResult,
  ProjectHealthExportVerificationTrust,
  ProjectVerifyState,
} from './projectHealth';
import type { RBProject } from '../../export/projectFormat';
import { digestValue } from '../../utils/digest';
import {
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../../fpga/vivado/vivadoProjectFolder';

export type ExportStructuralState = 'blocked' | 'downloadable';
export type ExportDownloadActionState = 'not-downloaded' | 'downloaded';
export type ExportDerivedState =
  | 'blocked'
  | `downloadable-${ProjectHealthExportVerificationTrust}`
  | `downloaded-${ProjectHealthExportVerificationTrust}`;

export interface ExportTrustAxes {
  structural: ExportStructuralState;
  verificationTrust: ProjectHealthExportVerificationTrust;
  action: ExportDownloadActionState;
  derived: ExportDerivedState;
}

export interface ExportTrustAxesInput {
  structuralBlocked: boolean;
  verifyState: ProjectVerifyState;
  compareMatches: boolean;
  comparePassIncomplete: boolean;
  downloadedTrust?: ProjectHealthExportVerificationTrust;
}

export interface ExportPackageArtifactInput {
  path: string;
  content: string;
}

export interface ExportDownloadReceiptCurrentInput {
  receipt?: ProjectHealthExportResult;
  currentPackageSourceHash: string;
  currentProjectHash: string;
  currentVerifyHash?: string;
  currentVerificationTrust: ProjectHealthExportVerificationTrust;
  downloadKind: 'project' | 'kit';
}

/**
 * Export has three independent axes:
 * - compiler/mapping structure decides whether bytes may be downloaded;
 * - Verify decides how much trust those bytes carry;
 * - download evidence records whether this exact current package was acted on.
 */
export function deriveExportTrustAxes(input: ExportTrustAxesInput): ExportTrustAxes {
  const structural: ExportStructuralState = input.structuralBlocked ? 'blocked' : 'downloadable';
  const verificationTrust = deriveExportVerificationTrust(input);
  const action: ExportDownloadActionState = input.downloadedTrust ? 'downloaded' : 'not-downloaded';
  let derived: ExportDerivedState;
  if (structural === 'blocked') {
    derived = 'blocked';
  } else if (input.downloadedTrust) {
    derived = `downloaded-${input.downloadedTrust}`;
  } else {
    derived = `downloadable-${verificationTrust}`;
  }

  return { structural, verificationTrust, action, derived };
}

/**
 * Fingerprints every byte-bearing package input, including Verify-derived
 * artifacts, plus the wrapper inputs used by the Vivado project ZIP builder.
 */
export function buildProjectExportPackageSourceHash(
  project: RBProject,
  artifacts: ReadonlyArray<ExportPackageArtifactInput>,
  downloadKind: 'project' | 'kit' = 'project'
): string {
  const topModule = (project.hdl?.top ?? project.fpga?.top ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_') || 'top';
  const projectSlug = deriveVivadoProjectSlug(
    (project.meta?.projectId ?? project.name ?? '').trim()
  );
  const normalizedArtifacts = artifacts
    .map(({ path, content }) => ({ path, content }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);

  return `pkgsrc_${digestValue({
    schema: 'redbyte-export-package-source-v1',
    downloadKind,
    artifacts: normalizedArtifacts,
    wrapper: downloadKind === 'project'
      ? {
          projectName: project.name,
          projectSlug,
          topModule,
          part: resolveVivadoPart(project.fpga?.part),
        }
      : null,
  })}`;
}

/** A receipt is current only for the exact package inputs and trust downloaded. */
export function isExportDownloadReceiptCurrent(
  input: ExportDownloadReceiptCurrentInput
): boolean {
  const receipt = input.receipt;
  return Boolean(
    receipt?.status === 'ok' &&
      receipt.packageHash &&
      /^[a-f0-9]{64}$/i.test(receipt.packageHash) &&
      receipt.downloadKind === input.downloadKind &&
      receipt.hash === input.currentPackageSourceHash &&
      receipt.sourceHashes?.project === input.currentProjectHash &&
      receipt.sourceHashes.export === input.currentPackageSourceHash &&
      (receipt.sourceHashes.verify ?? undefined) === (input.currentVerifyHash ?? undefined) &&
      receipt.verificationTrust === input.currentVerificationTrust &&
      receipt.sourceCurrentness?.project === 'current' &&
      receipt.sourceCurrentness.export === 'current' &&
      receipt.sourceCurrentness.mapping === 'current'
  );
}

export function deriveExportVerificationTrust(
  input: Pick<
    ExportTrustAxesInput,
    'verifyState' | 'compareMatches' | 'comparePassIncomplete'
  >
): ProjectHealthExportVerificationTrust {
  if (input.compareMatches && !input.comparePassIncomplete) return 'trusted';
  if (input.verifyState === 'not-run' || input.verifyState === 'trace') return 'unverified';
  return 'draft';
}

export function formatExportDerivedState(state: ExportDerivedState): string {
  switch (state) {
    case 'blocked':
      return 'Blocked';
    case 'downloadable-draft':
      return 'Draft available';
    case 'downloadable-unverified':
      return 'Unverified package available';
    case 'downloadable-trusted':
      return 'Trusted package ready';
    case 'downloaded-draft':
      return 'Downloaded draft';
    case 'downloaded-unverified':
      return 'Downloaded unverified';
    case 'downloaded-trusted':
      return 'Downloaded trusted';
  }
}
