// Voltage Divider Model
import { VoltageDividerNode } from '../types';

export function simulateVoltageDivider(node: VoltageDividerNode): VoltageDividerNode {
  const vIn = Number.isFinite(node.inputs.v_in) ? node.inputs.v_in : 0;
  const r1 = Number.isFinite(node.inputs.r1) ? node.inputs.r1 : 0;
  const r2 = Number.isFinite(node.inputs.r2) ? node.inputs.r2 : 0;
  // Vout = Vin * R2 / (R1 + R2)
  node.outputs.v_out = (r1 + r2) > 0 ? vIn * r2 / (r1 + r2) : 0;
  return node;
}
