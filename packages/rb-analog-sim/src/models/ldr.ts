// LDR Model (Light Dependent Resistor)
import { LdrNode } from '../types';

// Typical LDR resistance range: ~1k (bright) to ~100k (dark)
const LDR_MIN = 1000; // Ohms (bright)
const LDR_MAX = 100000; // Ohms (dark)

export function simulateLdr(node: LdrNode): LdrNode {
  const light = Number.isFinite(node.inputs.light) ? node.inputs.light : 0;
  const vIn = Number.isFinite(node.inputs.v_in) ? node.inputs.v_in : 0;
  // Clamp light to [0,1]
  const clamped = Math.max(0, Math.min(1, light));
  // Resistance decreases as light increases
  const resistance = LDR_MAX - (LDR_MAX - LDR_MIN) * clamped;
  node.outputs.resistance = resistance;
  // If part of a voltage divider, v_out is not calculated here
  node.outputs.v_out = vIn; // Pass-through for now
  return node;
}
