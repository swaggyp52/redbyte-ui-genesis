import {
  choosePrimaryProjectCta,
  deriveProjectHealth,
  deriveProjectVerifyState,
  deriveStageCompletion,
  type ProjectHealthCore,
  type ProjectPrimaryCta,
  type ProjectReadinessState,
  type ProjectVerifyState,
} from './projectHealth';
import type { VerifyRunLedgerEntry } from './projectRuntime';
import {
  deriveProjectTruthSnapshot,
  type ProjectTruthSnapshot,
  type ProjectTruthState,
} from './projectTruth';
import type { IdeWorkflowRouteMode } from './workflowStages';

export interface ProjectWorkflowAuthority {
  truth: ProjectTruthSnapshot;
  truthState: ProjectTruthState;
  verifyState: ProjectVerifyState;
  verifyCurrent: boolean;
  trustedVerifyCurrent: boolean;
  compareCurrent: boolean;
  comparePassCurrent: boolean;
  comparePassIncomplete: boolean;
  compareMatches: boolean;
  compareDiffers: boolean;
  compareTraceOnly: boolean;
  exportCurrent: boolean;
  hasSuccessfulExportBundle: boolean;
  exportAvailable: boolean;
  exportPackageCurrent: boolean;
  exportTrusted: boolean;
  draftExportAvailable: boolean;
  designReady: boolean;
  hardwareReady: boolean;
  stageCompletion: Record<IdeWorkflowRouteMode, boolean>;
  primaryCta: ProjectPrimaryCta;
  statusBarGateStatus: 'pass' | 'warn' | 'fail';
}

export interface ProjectWorkflowAuthorityInput {
  projectHealthCore: ProjectHealthCore;
  readiness: ProjectReadinessState;
  verifyLastRun?: unknown;
  verifyRunHistory?: Array<Pick<VerifyRunLedgerEntry, 'projectHash'>>;
  currentVerifyProjectHash?: string | null;
  currentExportHash?: string | null;
}

export type HardwareExportFailureTruthCondition =
  | 'mapping-incomplete'
  | 'design-blocked'
  | 'export-stale'
  | 'export-missing'
  | 'verify-not-run'
  | 'verify-stale'
  | 'assertions-differ'
  | 'trace-only'
  | 'mapping-review'
  | 'ready';

export type HardwareExportFailureTruthSeverity = 'blocked' | 'advisory' | 'ready';

export type HardwareExportFailureTruthIntent =
  | 'map-pins'
  | 'design'
  | 'build-current-bundle'
  | 're-export-current-bundle'
  | 'verify'
  | 'program-handoff';

export interface HardwareExportFailureTruth {
  condition: HardwareExportFailureTruthCondition;
  severity: HardwareExportFailureTruthSeverity;
  statusLabel: 'BLOCKED' | 'READY TO BUILD' | 'STALE' | 'NEEDS REVIEW' | 'READY';
  title: string;
  message: string;
  primaryCtaLabel: string;
  primaryCtaIntent: HardwareExportFailureTruthIntent;
}

export interface HardwareExportFailureTruthInput {
  workflowAuthority: Pick<
    ProjectWorkflowAuthority,
    | 'verifyState'
    | 'compareDiffers'
    | 'compareTraceOnly'
    | 'comparePassIncomplete'
    | 'compareMatches'
    | 'exportCurrent'
    | 'exportPackageCurrent'
    | 'hasSuccessfulExportBundle'
    | 'trustedVerifyCurrent'
  >;
  hasRequiredMappingGap: boolean;
  hasOtherBlockingIssue: boolean;
}

export function deriveVerifyCurrent(input: {
  hasVerifyRun: boolean;
  latestVerifyLedgerEntry?: Pick<VerifyRunLedgerEntry, 'projectHash'> | null;
  currentVerifyProjectHash?: string | null;
  dirtySinceVerify: boolean;
}): boolean {
  if (!input.hasVerifyRun) return false;
  if (input.latestVerifyLedgerEntry && input.currentVerifyProjectHash) {
    return input.latestVerifyLedgerEntry.projectHash === input.currentVerifyProjectHash;
  }
  return !input.dirtySinceVerify;
}

export function deriveExportCurrent(input: {
  lastExport?: ProjectHealthCore['lastExport'];
  currentExportHash?: string | null;
  dirtySinceExport: boolean;
}): boolean {
  if (input.lastExport?.status !== 'ok') return false;
  if (input.lastExport.hash && input.currentExportHash) {
    return input.lastExport.hash === input.currentExportHash;
  }
  return !input.dirtySinceExport;
}

export function deriveHardwareExportFailureTruth(
  input: HardwareExportFailureTruthInput
): HardwareExportFailureTruth {
  const { workflowAuthority } = input;
  const blocked = (
    condition: HardwareExportFailureTruthCondition,
    title: string,
    message: string,
    primaryCtaLabel: string,
    primaryCtaIntent: HardwareExportFailureTruthIntent
  ): HardwareExportFailureTruth => ({
    condition,
    severity: 'blocked',
    statusLabel: 'BLOCKED',
    title,
    message,
    primaryCtaLabel,
    primaryCtaIntent,
  });
  const advisory = (
    condition: HardwareExportFailureTruthCondition,
    title: string,
    message: string,
    primaryCtaLabel: string,
    primaryCtaIntent: HardwareExportFailureTruthIntent
  ): HardwareExportFailureTruth => ({
    condition,
    severity: 'advisory',
    statusLabel: 'NEEDS REVIEW',
    title,
    message,
    primaryCtaLabel,
    primaryCtaIntent,
  });

  if (input.hasRequiredMappingGap) {
    return blocked(
      'mapping-incomplete',
      'Complete required pin mapping',
      'Required Basys3 pins are still missing. Open Map Pins, assign the board resources, then return here for the hardware handoff.',
      'Open Map Pins',
      'map-pins'
    );
  }

  if (input.hasOtherBlockingIssue) {
    return blocked(
      'design-blocked',
      'Fix design blockers first',
      'The current design or export diagnostics still block handoff. Fix those blockers in Design before relying on hardware or export.',
      'Open Design',
      'design'
    );
  }

  if (workflowAuthority.verifyState === 'not-run') {
    return advisory(
      'verify-not-run',
      'Run Verify before relying on this handoff',
      'No expected-output comparison has been recorded for this design state yet. Open Verify before you rely on the hardware or export handoff.',
      'Open Verify',
      'verify'
    );
  }

  if (workflowAuthority.verifyState === 'stale') {
    return advisory(
      'verify-stale',
      'Refresh Verify evidence',
      'The design changed after the last Verify run. Refresh Verify before you rely on this handoff.',
      'Open Verify',
      'verify'
    );
  }

  if (workflowAuthority.compareDiffers) {
    return advisory(
      'assertions-differ',
      'Review the failing comparison',
      'The latest comparison differs from observed outputs. Open Verify to inspect the first difference before you rely on this handoff.',
      'Open Verify',
      'verify'
    );
  }

  if (workflowAuthority.compareTraceOnly) {
    return advisory(
      'trace-only',
      'Complete assertion-backed Verify',
      'Only a trace run is current. Open Verify to run Compare when you want assertion-backed evidence for this handoff.',
      'Open Verify',
      'verify'
    );
  }

  if (workflowAuthority.comparePassIncomplete) {
    return advisory(
      'mapping-review',
      'Complete mapping review',
      'The last comparison passed with incomplete mapping. Finish mapping in Map Pins and rerun Compare when you want current evidence for this handoff.',
      'Open Map Pins',
      'map-pins'
    );
  }

  if (workflowAuthority.hasSuccessfulExportBundle && !workflowAuthority.exportCurrent) {
    return {
      condition: 'export-stale',
      severity: 'advisory',
      statusLabel: 'STALE',
      title: 'Rebuild the current bundle',
      message:
        'Verify is current and passing, but the successful bundle no longer matches the current circuit. Rebuild it in Export so the ZIP matches the current design.',
      primaryCtaLabel: 'Rebuild Current Bundle',
      primaryCtaIntent: 're-export-current-bundle',
    };
  }

  if (!workflowAuthority.hasSuccessfulExportBundle) {
    return {
      condition: 'export-missing',
      severity: 'advisory',
      statusLabel: 'READY TO BUILD',
      title: 'Build the current bundle',
      message:
        'Verify, mapping, and design inputs are ready for Export. Build the current Vivado project ZIP, then continue to the hardware handoff.',
      primaryCtaLabel: 'Build Current Bundle',
      primaryCtaIntent: 'build-current-bundle',
    };
  }

  if (workflowAuthority.exportPackageCurrent && workflowAuthority.compareMatches) {
    return {
      condition: 'ready',
      severity: 'ready',
      statusLabel: 'READY',
      title: 'Program with the current handoff',
      message: 'Verify and export are current. Continue to the program handoff for the Basys3.',
      primaryCtaLabel: 'Open Program Handoff',
      primaryCtaIntent: 'program-handoff',
    };
  }

  return advisory(
    'verify-not-run',
    'Run Verify before relying on this handoff',
    'The handoff is available, but current expected-output evidence is still missing. Open Verify before you rely on this handoff.',
    'Open Verify',
    'verify'
  );
}

export function deriveProjectWorkflowAuthority(
  input: ProjectWorkflowAuthorityInput
): ProjectWorkflowAuthority {
  const projectHealth = deriveProjectHealth(input.projectHealthCore, input.readiness);
  const latestVerifyLedgerEntry = input.verifyRunHistory?.[input.verifyRunHistory.length - 1];
  const verifyCurrent = deriveVerifyCurrent({
    hasVerifyRun: Boolean(input.verifyLastRun ?? input.projectHealthCore.lastVerify),
    latestVerifyLedgerEntry,
    currentVerifyProjectHash: input.currentVerifyProjectHash,
    dirtySinceVerify: input.projectHealthCore.dirtySinceVerify,
  });
  const rawVerifyState = deriveProjectVerifyState(input.projectHealthCore);
  const verifyState =
    !verifyCurrent && input.projectHealthCore.lastVerify
      ? 'stale'
      : rawVerifyState;
  const comparePassCurrent = verifyCurrent && verifyState === 'assertions-match';
  const comparePassIncomplete =
    comparePassCurrent && input.readiness.verifyQualification === 'incomplete-mapping';
  const compareMatches = comparePassCurrent && !comparePassIncomplete;
  const compareDiffers =
    verifyCurrent && (verifyState === 'assertions-differ' || verifyState === 'verify-error');
  const compareTraceOnly = verifyCurrent && verifyState === 'trace';
  const compareCurrent = verifyCurrent && (comparePassCurrent || compareDiffers);
  const designReady = input.readiness.hasCircuit && input.readiness.hasIoMapping;
  const exportCurrent = deriveExportCurrent({
    lastExport: input.projectHealthCore.lastExport,
    currentExportHash: input.currentExportHash,
    dirtySinceExport: input.projectHealthCore.dirtySinceExport,
  });
  const hasSuccessfulExportBundle = input.projectHealthCore.lastExport?.status === 'ok';
  const exportAvailable =
    designReady && input.projectHealthCore.lastExport?.status !== 'blocked';
  const exportPackageCurrent =
    exportAvailable &&
    input.projectHealthCore.lastExport?.status === 'ok' &&
    exportCurrent;
  const trustedVerifyCurrent = compareMatches;
  const exportTrusted = exportPackageCurrent && trustedVerifyCurrent;
  const hardwareReady = exportTrusted;
  const baseStageCompletion = deriveStageCompletion(projectHealth, input.readiness);
  const stageCompletion = {
    ...baseStageCompletion,
    verify: trustedVerifyCurrent,
    export: exportTrusted,
  };
  const primaryCta = choosePrimaryProjectCta(projectHealth, input.readiness);
  const truth = deriveProjectTruthSnapshot({
    hasCircuit: input.readiness.hasCircuit,
    hasIoMapping: input.readiness.hasIoMapping,
    hasBlockingIssue: projectHealth.blockingIssues.length > 0,
    verifyState,
    verifyCurrent,
    compareMatches,
    comparePassIncomplete,
    exportAvailable,
    exportPackageCurrent,
  });
  const statusBarGateStatus: ProjectWorkflowAuthority['statusBarGateStatus'] =
    projectHealth.blockingIssues.length > 0
      ? 'fail'
      : truth.state === 'hardware-proof-required'
        ? 'pass'
        : compareDiffers || compareTraceOnly || projectHealth.dirtySinceVerify || projectHealth.dirtySinceExport
        ? 'warn'
        : !verifyCurrent && Boolean(input.projectHealthCore.lastVerify)
          ? 'warn'
          : !exportCurrent && input.projectHealthCore.lastExport?.status === 'ok'
            ? 'warn'
            : 'pass';

  return {
    truth,
    truthState: truth.state,
    verifyState,
    verifyCurrent,
    trustedVerifyCurrent,
    compareCurrent,
    comparePassCurrent,
    comparePassIncomplete,
    compareMatches,
    compareDiffers,
    compareTraceOnly,
    exportCurrent,
    hasSuccessfulExportBundle,
    exportAvailable,
    exportPackageCurrent,
    exportTrusted,
    draftExportAvailable: truth.draftExportAvailable,
    designReady,
    hardwareReady,
    stageCompletion,
    primaryCta,
    statusBarGateStatus,
  };
}
