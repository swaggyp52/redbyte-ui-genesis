// Copyright © 2025 Connor Angiel — RedByte OS Genesis// PreFlight validation for submission export

export interface PreflightIssue {
  severity: 'error' | 'warning';
  category: 'project' | 'circuit' | 'hardware' | 'data';
  message: string;
  fix?: string;
}

export interface PreflightResult {
  canExport: boolean;
  issues: PreflightIssue[];
  warnings: PreflightIssue[];
}

/**
 * Validate project is ready for submission export
 */
export function validateExportReadiness(options: {
  projectTitle?: string;
  circuitNodeCount?: number;
  hasCombinatorialLoops?: boolean;
  probeBufferSize?: number;
  hardwareMode?: 'dry-run' | 'real' | 'none';
  studentName?: string;
  labId?: string;
}): PreflightResult {
  const issues: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  // Check 1: Project title
  if (!options.projectTitle || options.projectTitle.trim() === '' || options.projectTitle === 'Untitled') {
    issues.push({
      severity: 'error',
      category: 'project',
      message: 'Project has no title',
      fix: 'Set a descriptive project title before exporting',
    });
  }

  // Check 2: Circuit not empty
  if (!options.circuitNodeCount || options.circuitNodeCount === 0) {
    issues.push({
      severity: 'error',
      category: 'circuit',
      message: 'Circuit is empty',
      fix: 'Add circuit components before exporting',
    });
  }

  // Check 3: No combinatorial loops
  if (options.hasCombinatorialLoops) {
    issues.push({
      severity: 'error',
      category: 'circuit',
      message: 'Circuit contains combinatorial loops',
      fix: 'Remove combinatorial loops using the circuit validator',
    });
  }

  // Check 4: Probe buffer size (should be automatic, but validate)
  if (options.probeBufferSize !== undefined && options.probeBufferSize > 100000) {
    warnings.push({
      severity: 'warning',
      category: 'data',
      message: `Probe buffer is large (${options.probeBufferSize} samples)`,
      fix: 'Consider clearing buffer if export is slow',
    });
  }

  // Check 5: Hardware mode clarity
  if (options.hardwareMode && options.hardwareMode !== 'none') {
    warnings.push({
      severity: 'warning',
      category: 'hardware',
      message: `Hardware mode: ${options.hardwareMode === 'dry-run' ? 'Dry-run (simulated)' : 'Real hardware'}`,
    });
  }

  // Check 6: Student identity
  if (!options.studentName || options.studentName.trim() === '') {
    warnings.push({
      severity: 'warning',
      category: 'project',
      message: 'No student name set',
      fix: 'Set your name in settings for better file naming',
    });
  }

  const canExport = issues.length === 0;

  return {
    canExport,
    issues,
    warnings,
  };
}
