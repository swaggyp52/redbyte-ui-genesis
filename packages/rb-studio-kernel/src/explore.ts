import { getComponentSupport, type Circuit } from '@redbyte/rb-logic-core';
import { connectionEndpoints } from '@redbyte/rb-logic-view/scene';

/**
 * The live inputs that drive a clock port. Design's "Clock edge" pulses exactly these: low,
 * high, one engine step, low. A step alone leaves a board clock input where it was and never
 * makes an edge. Same rule as the workbench (DesignSurface stepSimulation).
 */
export function clockDrivingInputs(circuit: Circuit, liveInputs: Readonly<Record<string, unknown>>): string[] {
  const nodes = new Map(circuit.nodes.map((node) => [node.id, node] as const));
  const result = new Set<string>();
  for (const connection of circuit.connections) {
    const { from, to } = connectionEndpoints(connection);
    const target = nodes.get(to.nodeId);
    const clockPort = target ? getComponentSupport(target.type)?.clockPort : undefined;
    if (clockPort === to.port && Object.prototype.hasOwnProperty.call(liveInputs, from.nodeId)) result.add(from.nodeId);
  }
  return [...result].sort();
}
