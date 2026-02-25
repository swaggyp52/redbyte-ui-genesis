/**
 * Fact-grounded verification hints.
 * Each hint is triggered by one specific condition derived from real run data.
 * First matching hint wins — at most one hint is shown per FAIL run.
 */

export interface VerifyHintContext {
  hasDff: boolean;
  mappingComplete: boolean;
  allTicksFail: boolean;        // failCount === totalRows
  onlyFirstTickFails: boolean;
  mismatch: { expected: string; actual: string } | null;
  hasFloatingOutputWarning: boolean;
}

const HINTS: Array<{
  condition: (ctx: VerifyHintContext) => boolean;
  text: string;
}> = [
  {
    condition: (ctx) => !ctx.mappingComplete,
    text: 'Some pins are not mapped. Unmapped outputs always read 0. Open Project → Mapping to assign all pins.',
  },
  {
    condition: (ctx) => ctx.hasFloatingOutputWarning,
    text: 'One or more outputs are undriven (floating). Trace back from the failing output — it may have no wire connected.',
  },
  {
    condition: (ctx) => ctx.allTicksFail,
    text: 'Every tick fails. Either the wrong output is mapped, or inputs are not reaching the circuit. Try "Capture observed outputs" to see what the circuit actually produces.',
  },
  {
    condition: (ctx) => ctx.onlyFirstTickFails,
    text: 'Only the first tick fails. Check your initial/reset state: does tick 0 represent the expected start condition?',
  },
  {
    condition: (ctx) =>
      ctx.hasDff && ctx.mismatch?.expected === '1' && ctx.mismatch?.actual === '0',
    text: 'Output should be HIGH but is LOW after a clock edge. Check: (1) Is EN wired to the flip-flop? (2) Is RST accidentally held HIGH?',
  },
  {
    condition: (ctx) =>
      ctx.hasDff && ctx.mismatch?.expected === '0' && ctx.mismatch?.actual === '1',
    text: 'Output should be LOW but is HIGH after a clock edge. Check: (1) Is RST working? (2) Did the counter advance when EN was supposed to be LOW?',
  },
  {
    condition: (ctx) => !ctx.hasDff && ctx.mismatch !== null,
    text: 'Combinational mismatch. Verify the gate connections match your truth table. Use the waveform to see which tick first diverges.',
  },
];

/** Returns the first matching hint text, or null if no condition fires. */
export function getVerifyHint(ctx: VerifyHintContext): string | null {
  const hint = HINTS.find((h) => h.condition(ctx));
  return hint?.text ?? null;
}
