/** Native edge-clocked behaviors with a shared read/commit boundary. */
const CAPTURE_TYPES = new Set([
  'DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'TFlipFlop', 'JKFlipFlop',
]);

/** Supported combinational behaviors may settle after Q publication. Stateful
 * Clock/Delay/latch/custom behaviors retain one invocation per engine tick. */
const SETTLE_TYPES = new Set([
  'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR',
  'AND3', 'OR3', 'NAND3', 'NOR3', 'XOR3', 'FullAdder', 'MUX4',
  'Wire', 'Lamp', 'OUTPUT',
]);

export function isClockCaptureNodeType(type: string): boolean {
  return CAPTURE_TYPES.has(type);
}

export function canSettleAfterClockCapture(type: string): boolean {
  return SETTLE_TYPES.has(type);
}
