export interface VerifyDebugContext {
  signal: string;
  tick: number;
  expected: string;
  actual: string;
  inputSnapshot: Array<{ label: string; value: string }>;
  patternSummary?: string | null;
  nextInspect?: string | null;
}
