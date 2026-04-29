export interface VerifyDebugContext {
  /** Stable signal key from Verify; Design uses this to resolve the canvas target. */
  signal: string;
  /** Student-facing signal label shown in failure briefs. */
  signalLabel?: string | null;
  tick: number;
  expected: string;
  actual: string;
  vectorId?: string | null;
  caseIndex?: number | null;
  inputSnapshot: Array<{ label: string; value: string }>;
  patternSummary?: string | null;
  nextInspect?: string | null;
}

export function getVerifyDebugDisplaySignal(context: VerifyDebugContext): string {
  const label = context.signalLabel?.trim();
  return label && label.length > 0 ? label : context.signal;
}

export function formatVerifyDebugInputSnapshot(
  snapshot: readonly { label: string; value: string }[]
): string {
  return snapshot
    .map((entry) => `${entry.label}=${entry.value}`)
    .join(', ');
}

export function formatVerifyMismatchBrief(context: VerifyDebugContext): string {
  const signal = getVerifyDebugDisplaySignal(context);
  const inputs = formatVerifyDebugInputSnapshot(context.inputSnapshot);
  const inputSentence = inputs.length > 0 ? ` Inputs: ${inputs}.` : '';
  const nextInspect = context.nextInspect?.trim();
  const hintSentence =
    nextInspect && nextInspect.length > 0
      ? ` ${nextInspect}`
      : ` Inspect the logic path feeding ${signal}.`;

  return `Verify failed on ${signal}: expected ${context.expected}, observed ${context.actual} at tick ${context.tick}.${inputSentence}${hintSentence}`;
}
