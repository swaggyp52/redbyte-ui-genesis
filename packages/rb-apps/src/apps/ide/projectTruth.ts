import type { ProjectVerifyState } from './projectHealth';

export type ProjectTruthState =
  | 'blocked'
  | 'needs-design'
  | 'needs-verify'
  | 'needs-mapping'
  | 'draft-export-valid'
  | 'trusted-export-ready'
  | 'hardware-proof-required';

export interface ProjectTruthSnapshot {
  state: ProjectTruthState;
  label: string;
  detail: string;
  trustedVerifyCurrent: boolean;
  trustedExportReady: boolean;
  draftExportAvailable: boolean;
}

export interface ProjectTruthSnapshotInput {
  hasCircuit: boolean;
  hasIoMapping: boolean;
  hasBlockingIssue: boolean;
  verifyState: ProjectVerifyState;
  verifyCurrent: boolean;
  compareMatches: boolean;
  comparePassIncomplete: boolean;
  exportAvailable: boolean;
  exportPackageCurrent: boolean;
}

export function deriveProjectTruthSnapshot(
  input: ProjectTruthSnapshotInput
): ProjectTruthSnapshot {
  const trustedVerifyCurrent =
    input.verifyCurrent && input.compareMatches && !input.comparePassIncomplete;
  const trustedExportReady = trustedVerifyCurrent && input.exportPackageCurrent;
  const draftExportAvailable = input.exportAvailable && !trustedExportReady;

  if (!input.hasCircuit) {
    return {
      state: 'needs-design',
      label: 'Needs Design',
      detail: 'Create or import a circuit before Verify, Map Pins, or Export can be trusted.',
      trustedVerifyCurrent,
      trustedExportReady,
      draftExportAvailable: false,
    };
  }

  if (!input.hasIoMapping) {
    return {
      state: 'needs-mapping',
      label: 'Needs Mapping',
      detail: 'Required Basys3 pins are missing. Map Pins must be complete before export trust.',
      trustedVerifyCurrent,
      trustedExportReady,
      draftExportAvailable,
    };
  }

  if (input.comparePassIncomplete) {
    return {
      state: 'needs-mapping',
      label: 'Needs Mapping',
      detail: 'The last comparison passed only with incomplete mapping. Finish Map Pins, then rerun Verify.',
      trustedVerifyCurrent: false,
      trustedExportReady: false,
      draftExportAvailable,
    };
  }

  if (input.hasBlockingIssue) {
    return {
      state: 'blocked',
      label: 'Blocked',
      detail: 'A design, mapping, or export blocker must be fixed before the project can be trusted.',
      trustedVerifyCurrent,
      trustedExportReady: false,
      draftExportAvailable: false,
    };
  }

  if (!trustedVerifyCurrent) {
    return {
      state: 'needs-verify',
      label: 'Needs Verify',
      detail:
        input.verifyState === 'trace'
          ? 'The current run is observation-only. Run Compare checks for current evidence before treating any export as trusted.'
          : input.verifyState === 'assertions-differ' || input.verifyState === 'verify-error'
            ? 'The latest comparison is not passing. Fix the design or checks, then rerun Verify.'
            : input.verifyState === 'stale'
              ? 'The design changed after the last Verify run. Rerun Verify for current evidence.'
              : 'Run Verify before treating any export as trusted.',
      trustedVerifyCurrent,
      trustedExportReady: false,
      draftExportAvailable,
    };
  }

  if (!input.exportPackageCurrent) {
    return {
      state: 'trusted-export-ready',
      label: 'Trusted Export Ready',
      detail: 'Verify is current and passing. Build or rebuild the Vivado package for this exact state.',
      trustedVerifyCurrent,
      trustedExportReady: false,
      draftExportAvailable,
    };
  }

  return {
    state: 'hardware-proof-required',
    label: 'Hardware Proof Required',
    detail:
      'Verify and export are current. Vivado build/programming proof is still an external classroom evidence step.',
    trustedVerifyCurrent,
    trustedExportReady,
    draftExportAvailable: false,
  };
}
