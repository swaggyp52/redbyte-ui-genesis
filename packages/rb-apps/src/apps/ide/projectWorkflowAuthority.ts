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
import type { IdeWorkflowRouteMode } from './workflowStages';

export interface ProjectWorkflowAuthority {
  verifyState: ProjectVerifyState;
  verifyCurrent: boolean;
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
  statusLabel: 'BLOCKED' | 'NEEDS REVIEW' | 'READY';
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

  if (workflowAuthority.hasSuccessfulExportBundle && !workflowAuthority.exportCurrent) {
    return blocked(
      'export-stale',
      'Re-export the current bundle',
      'A successful bundle exists, but it no longer matches the current circuit. Re-export the current bundle, then continue to programming.',
      'Re-export Current Bundle',
      're-export-current-bundle'
    );
  }

  if (!workflowAuthority.hasSuccessfulExportBundle) {
    return blocked(
      'export-missing',
      'Build the current bundle first',
      'No current hardware bundle exists yet. Build the current bundle in Export, then continue to programming.',
      'Build Current Bundle',
      'build-current-bundle'
    );
  }

  if (workflowAuthority.verifyState === 'not-run') {
    return advisory(
      'verify-not-run',
      'Run Verify before relying on this handoff',
      'The bundle exists, but no expected-output comparison has been recorded for this design state yet. Open Verify before you rely on the handoff.',
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
  const comparePassCurrent = verifyState === 'assertions-match';
  const comparePassIncomplete =
    comparePassCurrent && input.readiness.verifyQualification === 'incomplete-mapping';
  const compareMatches = comparePassCurrent && !comparePassIncomplete;
  const compareDiffers =
    verifyState === 'assertions-differ' || verifyState === 'verify-error';
  const compareTraceOnly = verifyState === 'trace';
  const compareCurrent = comparePassCurrent || compareDiffers;
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
  const exportTrusted = exportAvailable && compareMatches;
  const hardwareReady = exportPackageCurrent;
  const stageCompletion = deriveStageCompletion(projectHealth, input.readiness);
  const primaryCta = choosePrimaryProjectCta(projectHealth, input.readiness);
  const statusBarGateStatus: ProjectWorkflowAuthority['statusBarGateStatus'] =
    projectHealth.blockingIssues.length > 0
      ? 'fail'
      : compareDiffers || compareTraceOnly || projectHealth.dirtySinceVerify || projectHealth.dirtySinceExport
        ? 'warn'
        : !verifyCurrent && Boolean(input.projectHealthCore.lastVerify)
          ? 'warn'
          : !exportCurrent && input.projectHealthCore.lastExport?.status === 'ok'
            ? 'warn'
            : 'pass';

  return {
    verifyState,
    verifyCurrent,
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
    designReady,
    hardwareReady,
    stageCompletion,
    primaryCta,
    statusBarGateStatus,
  };
}
