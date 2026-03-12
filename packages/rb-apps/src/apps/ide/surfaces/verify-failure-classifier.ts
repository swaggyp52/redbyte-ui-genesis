export type VerifyFailureReason =
  | 'output-mismatch'
  | 'undefined-output'
  | 'floating-output'
  | 'timing-mismatch';

export interface VerifyFailureClassifierInput {
  expected: string;
  actual: string;
  isSequential?: boolean;
  samplePoint?: string | null;
  clockingProtocol?: string | null;
}

export interface VerifyFailureClassification {
  reason: VerifyFailureReason;
  message: string;
}

function normalizeValue(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

function isBinaryValue(value: string): boolean {
  return value === '0' || value === '1';
}

function shouldClassifyAsTimingMismatch(input: VerifyFailureClassifierInput): boolean {
  return Boolean(
    input.isSequential ||
      input.clockingProtocol === 'clocked_macro' ||
      input.samplePoint === 'post-rising-edge'
  );
}

function buildMessage(reason: VerifyFailureReason, expected: string, actual: string): string {
  if (reason === 'output-mismatch') {
    return `Output driver mismatch - expected ${expected}, got ${actual}`;
  }
  if (reason === 'undefined-output') {
    return 'Undefined output - gate may have no valid input path';
  }
  if (reason === 'floating-output') {
    return 'Floating output - check if this signal has a driver';
  }
  return 'Timing mismatch - check clock edge alignment';
}

export function classifyVerifyFailure(input: VerifyFailureClassifierInput): VerifyFailureClassification {
  const expected = normalizeValue(input.expected);
  const actual = normalizeValue(input.actual);
  const normalizedActual = actual.toUpperCase();

  let reason: VerifyFailureReason;

  if (normalizedActual === 'X') {
    reason = 'undefined-output';
  } else if (actual === '' || actual === '-') {
    reason = 'floating-output';
  } else if (expected !== actual && isBinaryValue(expected) && isBinaryValue(actual)) {
    reason = shouldClassifyAsTimingMismatch(input) ? 'timing-mismatch' : 'output-mismatch';
  } else {
    reason = 'output-mismatch';
  }

  return {
    reason,
    message: buildMessage(reason, expected || '?', actual || '?'),
  };
}
