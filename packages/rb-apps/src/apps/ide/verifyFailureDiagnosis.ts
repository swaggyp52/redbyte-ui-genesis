export type VerifyFailureDiagnosisCategory =
  | 'stale-result'
  | 'disconnected-output'
  | 'possible-wrong-gate-or-wire'
  | 'expected-value-check-needed'
  | 'design-output-wrong'
  | 'unknown';

export type VerifyFailurePrimaryLane = 'expected' | 'design' | 'rerun' | 'none';

export interface VerifyFailureDiagnosisInput {
  status?: 'idle' | 'pass' | 'fail' | string;
  staleReason?: 'design' | 'testbench' | 'project' | null;
  runRowsCount?: number;
  outputLabels?: string[];
  preflightIssues?: Array<{
    kind?: string;
    signal?: string;
    message?: string;
  }>;
  failure?: {
    signalLabel?: string;
    signal?: string;
    expected?: string;
    observed?: string;
    inputSnapshot?: Array<{ label: string; value: string }>;
  };
  directDriver?: {
    label?: string;
    type?: string;
    incomingWires?: number;
    outgoingWires?: number;
  } | null;
  studentBelievesCircuitCorrect?: boolean;
}

export interface VerifyFailureDiagnosis {
  category: VerifyFailureDiagnosisCategory;
  primaryLane: VerifyFailurePrimaryLane;
  confidence: 'high' | 'medium' | 'low';
  message: string;
  recommendedAction: string;
}

function readableSignal(input: VerifyFailureDiagnosisInput): string {
  const fromFailure = input.failure?.signalLabel ?? input.failure?.signal;
  if (fromFailure && fromFailure.trim().length > 0) return fromFailure.trim();
  const outputLabel = input.outputLabels?.find((label) => label.trim().length > 0);
  if (outputLabel && outputLabel.trim().length > 0) return outputLabel.trim();
  const issueSignal = input.preflightIssues?.find((issue) => issue.signal?.trim())?.signal;
  return issueSignal?.trim() || 'the output';
}

// An output whose observed value is X (undefined) or "-" (no sampled value) is
// not driven to a real logic level. That is a STRUCTURAL failure, not a runnable
// expected-vs-observed mismatch: the student cannot fix it by editing an expected
// value, so it must be routed to a Design repair, not the expected-value lane.
function isFloatingObservedValue(value: string | null | undefined): boolean {
  if (value == null) return false;
  const normalized = value.trim().toUpperCase();
  return normalized === 'X' || normalized === '-';
}

function hasStructuralOutputIssue(input: VerifyFailureDiagnosisInput): boolean {
  const structuralIssue = input.preflightIssues?.some(
    (issue) =>
      issue.kind === 'missing-output-sample' ||
      issue.kind === 'missing-output-node' ||
      issue.kind === 'missing-output-row'
  );
  const floatingObserved =
    input.status === 'fail' && isFloatingObservedValue(input.failure?.observed);
  return Boolean(
    structuralIssue ||
      floatingObserved ||
      (input.status === 'fail' && input.runRowsCount === 0 && (input.outputLabels?.length ?? 0) > 0)
  );
}

export function diagnoseVerifyFailure(input: VerifyFailureDiagnosisInput): VerifyFailureDiagnosis {
  const signal = readableSignal(input);

  if (input.staleReason) {
    const staleSubject =
      input.staleReason === 'design'
        ? 'Design changed'
        : input.staleReason === 'testbench'
          ? 'Checks changed'
          : 'Project changed';
    return {
      category: 'stale-result',
      primaryLane: 'rerun',
      confidence: 'high',
      message: `${staleSubject}. The old Compare result is no longer trustworthy.`,
      recommendedAction: 'Rerun Compare before changing expected values or editing the circuit.',
    };
  }

  if (hasStructuralOutputIssue(input)) {
    return {
      category: 'disconnected-output',
      primaryLane: 'design',
      confidence: 'high',
      message: `${signal} is not driven to a defined value, so Compare cannot check its behavior.`,
      recommendedAction: `Open Design, connect a driver to ${signal}, then rerun Compare.`,
    };
  }

  if (input.studentBelievesCircuitCorrect) {
    return {
      category: 'expected-value-check-needed',
      primaryLane: 'expected',
      confidence: 'medium',
      message: `This is an expected-output repair only if the circuit is correct.`,
      recommendedAction: `Edit the expected value. Use observed for ${signal} only after confirming the circuit is right.`,
    };
  }

  if (input.directDriver?.label || input.directDriver?.type) {
    const driverLabel = input.directDriver.label ?? 'the selected driver';
    const driverType = input.directDriver.type ? ` (${input.directDriver.type})` : '';
    return {
      category: 'possible-wrong-gate-or-wire',
      primaryLane: 'design',
      confidence: 'medium',
      message: `${signal} does not match the expected value. Check ${driverLabel}${driverType} before editing expected outputs.`,
      recommendedAction: `Inspect Design for the failed output, focus the driver if available, then rerun Compare.`,
    };
  }

  if (input.status === 'fail' && input.failure) {
    return {
      category: 'design-output-wrong',
      primaryLane: 'design',
      confidence: 'low',
      message: `${signal} produced ${input.failure.observed ?? 'a different value'} when ${input.failure.expected ?? 'another value'} was expected.`,
      recommendedAction: `Decide first: fix the expected output if it is wrong, or inspect Design if the circuit is wrong.`,
    };
  }

  return {
    category: 'unknown',
    primaryLane: 'none',
    confidence: 'low',
    message: 'RedByte does not have enough evidence to choose a repair path.',
    recommendedAction: 'Inspect the testbench and design, then rerun Compare.',
  };
}
