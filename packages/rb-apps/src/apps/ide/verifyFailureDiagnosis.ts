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

function hasStructuralOutputIssue(input: VerifyFailureDiagnosisInput): boolean {
  const structuralIssue = input.preflightIssues?.some(
    (issue) =>
      issue.kind === 'missing-output-sample' ||
      issue.kind === 'missing-output-node' ||
      issue.kind === 'missing-output-row'
  );
  return Boolean(structuralIssue || (input.status === 'fail' && input.runRowsCount === 0 && (input.outputLabels?.length ?? 0) > 0));
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
      message: `${signal} did not produce a sampled output for Compare.`,
      recommendedAction: `Open Design and connect a driver to ${signal}, then rerun Compare.`,
    };
  }

  if (input.studentBelievesCircuitCorrect) {
    return {
      category: 'expected-value-check-needed',
      primaryLane: 'expected',
      confidence: 'medium',
      message: `Use observed only if the circuit is correct and the expected value is the mistake.`,
      recommendedAction: `Use observed for ${signal}, or edit the expected output by hand, then rerun Compare.`,
    };
  }

  if (input.directDriver?.label || input.directDriver?.type) {
    const driverLabel = input.directDriver.label ?? 'the selected driver';
    const driverType = input.directDriver.type ? ` (${input.directDriver.type})` : '';
    return {
      category: 'possible-wrong-gate-or-wire',
      primaryLane: 'design',
      confidence: 'medium',
      message: `${signal} disagrees with the expected value. Start by checking ${driverLabel}${driverType}.`,
      recommendedAction: `Inspect Design to trace the gate or wire driving ${signal} before using observed values.`,
    };
  }

  if (input.status === 'fail' && input.failure) {
    return {
      category: 'design-output-wrong',
      primaryLane: 'design',
      confidence: 'low',
      message: `${signal} produced ${input.failure.observed ?? 'a different value'} when ${input.failure.expected ?? 'another value'} was expected.`,
      recommendedAction: `Inspect Design if your expected output is correct. Use observed only after you confirm the circuit is correct.`,
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
