export type ProjectHealthMode = 'project' | 'design' | 'verify' | 'export' | 'import';

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
  failingTick?: number;
  ranAtIso: string;
}

export interface ProjectHealthExportResult {
  status: 'ok' | 'blocked';
  hash?: string;
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
}

export interface ProjectPrimaryCta {
  label: string;
  mode: ProjectHealthMode;
  code: string;
}

export function deriveProjectHealth(
  core: ProjectHealthCore,
  readiness: ProjectReadinessState
): ProjectHealth {
  const blockingIssues: ProjectHealthIssue[] = [];

  if (!readiness.hasCircuit) {
    blockingIssues.push({
      code: 'RBP1000',
      message: 'No circuit graph found.',
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

  if (!readiness.hasVectors) {
    blockingIssues.push({
      code: 'RBP1002',
      message: 'No verification vectors defined.',
      fixPath: { mode: 'verify', actionLabel: 'Add Test Vectors' },
    });
  }

  if (core.lastVerify?.status === 'fail') {
    blockingIssues.push({
      code: 'RBP1003',
      message: 'Latest verification run failed.',
      fixPath: { mode: 'verify', actionLabel: 'Run Verification' },
    });
  }

  if (core.dirtySinceVerify) {
    blockingIssues.push({
      code: 'RBP1004',
      message: 'Design changed since last verification run.',
      fixPath: { mode: 'verify', actionLabel: 'Run Verification' },
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
      fixPath: { mode: 'export', actionLabel: 'Download Vivado Bundle' },
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
  if (!readiness.hasIoMapping) {
    return { label: 'Fix Mapping', mode: 'project', code: 'RBP1001' };
  }
  if (!readiness.hasVectors) {
    return { label: 'Add Test Vectors', mode: 'verify', code: 'RBP1002' };
  }
  if (!health.lastVerify || health.dirtySinceVerify) {
    return { label: 'Run Verification', mode: 'verify', code: 'RBP1004' };
  }
  if (!health.lastExport || health.dirtySinceExport) {
    return { label: 'Download Vivado Bundle', mode: 'export', code: 'RBP2002' };
  }
  return { label: 'Review Project Health', mode: 'project', code: 'RBP0000' };
}
