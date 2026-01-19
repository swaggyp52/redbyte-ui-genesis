// Voltage Source Model (constant output)
import { VoltageSourceNode } from '../types';

export function simulateVoltageSource(node: VoltageSourceNode): VoltageSourceNode {
  const configVoltage = node.config?.voltage;
  const stateVoltage = node.state?.voltage;
  const voltage =
    typeof configVoltage === 'number' && Number.isFinite(configVoltage)
      ? configVoltage
      : typeof stateVoltage === 'number' && Number.isFinite(stateVoltage)
        ? stateVoltage
        : 5;
  node.outputs.out = voltage;
  return node;
}
