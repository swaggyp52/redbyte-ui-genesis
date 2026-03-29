import type { VerifyReport } from './verifyReport';

import { getOpenStageActionLabel, getWorkflowCtaLabel } from './workflowStages';
import type { ProjectKind } from './projectIdentity';

export type VerifyRunKind = 'trace' | 'verify';
export type ProjectVerifyState =
  | 'not-run'
  | 'stale'
  | 'trace'
  | 'assertions-match'
  | 'assertions-differ'
  | 'verify-error';

export type ProjectHealthMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';

export interface ProjectHealthFixPath {
  mode: ProjectHealthMode;
  actionLabel: string;
}

export interface ProjectHealthIssue {
  code: string;
  message: string;
  fixPath?: ProjectHealthFixPath;
}

export interface ProjectHealthVerifyResult {
  status: 'pass' | 'fail';
  hash: string;
  runKind?: VerifyRunKind;
  qualification?: 'incomplete-mapping';
  reportHash?: string;
  report?: VerifyReport;
  failingTick?: number;
  ranAtIso: string;
}

export interface ProjectHealthExportResult {
  status: 'ok' | 'blocked';
  hash?: string;
  manifestHash?: string;
  bundleHash?: string;
  artifacts?: string[];
  ranAtIso: string;
}

export interface ProjectHealthCore {
  lastVerify?: ProjectHealthVerifyResult;
  lastExport?: ProjectHealthExportResult;
  dirtySinceVerify: boolean;
  dirtySinceExport: boolean;
}

export interface ProjectHealth extends ProjectHealthCore {
  blockingIssues: ProjectHealthIssue[];
}

export interface ProjectReadinessState {
  hasCircuit: boolean;
  hasIoMapping: boolean;
  hasVectors: boolean;
  projectKind?: ProjectKind;
  verifyQualification?: 'incomplete-mapping';
}

export interface ProjectPrimaryCta {
  label: string;
  mode: ProjectHealthMode;
  code: string;
}

export function getProjectVerifyRunKind(
  result: ProjectHealthVerifyResult | undefined
): VerifyRunKind | undefined {
  if (!result) return undefined;
  return result.runKind === 'trace' ? 'trace' : 'verify';
}

export function deriveProjectVerifyState(
  core: Pick<ProjectHealthCore, 'lastVerify' | 'dirtySinceVerify'>
): ProjectVerifyState {
  if (!core.lastVerify) return 'not-run';
  if (core.dirtySinceVerify) return 'stale';
  if (getProjectVerifyRunKind(core.lastVerify) === 'trace') return 'trace';
  if (core.lastVerify.status === 'pass') return 'assertions-match';
  if (core.lastVerify.report && core.lastVerify.report.rows.length === 0) return 'verify-error';
  return 'assertions-differ';
}

export function hasCurrentAssertionBackedVerify(
  core: Pick<ProjectHealthCore, 'lastVerify' | 'dirtySinceVerify'>
): boolean {
  const state = deriveProjectVerifyState(core);
  return (
    state === 'assertions-match' ||
    state === 'assertions-differ' ||
    state === 'verify-error'
  );
}

export function hasCurrentPassingVerify(
  core: Pick<ProjectHealthCore, 'lastVerify' | 'dirtySinceVerify'>
): boolean {
  return deriveProjectVerifyState(core) === 'assertions-match';
}

export function deriveProjectHealth(
  core: ProjectHealthCore,
  readiness: ProjectReadinessState
): ProjectHealth {
  const blockingIssues: ProjectHealthIssue[] = [];
  const verifyQualification = readiness.verifyQualification ?? core.lastVerify?.qualification;
  const verifyState = deriveProjectVerifyState(core);
  const isIncompleteMappingQualifiedPass =
    verifyState === 'assertions-match' &&
    verifyQualification === 'incomplete-mapping';

  if (!readiness.hasCircuit) {
    blockingIssues.push({
      code: 'RBP1000',
      message: 'No circuit graph yet.',
      fixPath: { mode: 'design', actionLabel: 'Open Design' },
    });
  }

  if (!readiness.hasIoMapping) {
    blockingIssues.push({
      code: 'RBP1001',
      message: 'Required Basys3 I/O mappings are missing.',
      fixPath: { mode: 'project', actionLabel: 'Fix Mapping' },
    });
  }

  if (isIncompleteMappingQualifiedPass) {
    blockingIssues.push({
      code: 'RBP1005',
      message: 'Some required output pins remain unmapped. Finish mapping before relying on hardware behavior.',
      fixPath: { mode: 'hardware', actionLabel: getOpenStageActionLabel('hardware') },
    });
  }

  if (core.lastExport?.status === 'blocked') {
    blockingIssues.push({
      code: 'RBP2001',
      message: 'Latest export attempt was blocked.',
      fixPath: { mode: 'export', actionLabel: 'Open Export Diagnostics' },
    });
  }

  if (core.dirtySinceExport) {
    blockingIssues.push({
      code: 'RBP2002',
      message: 'Project changed since last successful export.',
      fixPath: { mode: 'export', actionLabel: 'Build Submission Package' },
    });
  }

  return {
    ...core,
    blockingIssues,
  };
}

export function choosePrimaryProjectCta(
  health: ProjectHealth,
  readiness: ProjectReadinessState
): ProjectPrimaryCta {
  if (!readiness.hasCircuit) {
    return {
      label: readiness.projectKind === 'home' ? 'Build Fresh' : 'Open Design',
      mode: 'design',
      code: 'RBP3000',
    };
  }
  const verifyState = deriveProjectVerifyState(health);
  const needsVerify =
    verifyState === 'stale' ||
    verifyState === 'trace' ||
    (readiness.hasVectors &&
      verifyState !== 'assertions-match');
  if (needsVerify) {
    return { label: 'Verify', mode: 'verify', code: 'RBP1004' };
  }
  if (!readiness.hasIoMapping) {
    return { label: 'Design', mode: 'design', code: 'RBP1001' };
  }
  if (!readiness.hasVectors) {
    return { label: 'Verify', mode: 'verify', code: 'RBP1002' };
  }
  if (health.blockingIssues.some((issue) => issue.code === 'RBP1005')) {
    return { label: getWorkflowCtaLabel('hardware', 'RBP1005'), mode: 'hardware', code: 'RBP1005' };
  }
  if (!health.lastExport || health.lastExport.status === 'blocked' || health.dirtySinceExport) {
    return { label: 'Export', mode: 'export', code: 'RBP2002' };
  }
  return { label: getWorkflowCtaLabel('hardware', 'RBP4000'), mode: 'hardware', code: 'RBP4000' };
}
