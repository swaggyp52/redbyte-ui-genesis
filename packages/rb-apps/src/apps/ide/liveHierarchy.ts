import { buildSimulationModel, elaborateCircuit, getComponentSupport, type Circuit, type Node, type PortRef } from '@redbyte/rb-logic-core';
import { canonicalizeSemanticCircuit } from '../../circuit/semanticCircuit';
import { elaborateProjectHierarchy, hierarchyCycleModules, modulePortIndices, modulePortInternalRefs, modulePortWidth, splitBitPort, type ElaborationSources, type NativeVisualModuleDefinition, type ProjectHierarchyDocument } from './projectHierarchy';
import type { RuntimeLogicValue } from './sim/simTypes';

/** Read model over the SAME parent execution. No engine, authored mutations or run authority. */
export function buildLiveHierarchy(top: Circuit, hierarchy: ProjectHierarchyDocument) {
  const sources: ElaborationSources = {};
  if (hierarchyCycleModules(hierarchy).length > 0) return { sources, circuit: top, supported: false, reason: 'Resolve recursive module definitions before exploring.' };
  const circuit = elaborateProjectHierarchy(top, hierarchy, sources);
  const model = buildSimulationModel(elaborateCircuit(canonicalizeSemanticCircuit(circuit)).ir);
  const sequential = circuit.nodes.some(node => Boolean(getComponentSupport(node.type)?.isSequential));
  return { circuit, sources, supported: model.isRunnable && !sequential,
    reason: sequential ? 'Live exploration of sequential modules is not yet qualified. Run authored clock/reset cases in Simulate.'
      : model.isRunnable ? '' : 'Resolve unsupported components or circuit connections before exploring.' };
}

export function moduleForNode(node: Node, hierarchy: ProjectHierarchyDocument): NativeVisualModuleDefinition | undefined {
  return hierarchy.modules.find(module => module.id === node.config?.moduleDefinitionId || module.name === node.type);
}

export function liveScope(top: Circuit, hierarchy: ProjectHierarchyDocument, path: readonly string[]) {
  let circuit = top;
  let definition: NativeVisualModuleDefinition | undefined;
  const names: string[] = [];
  for (const id of path) {
    const instance = circuit.nodes.find(node => node.id === id);
    if (!instance) return null;
    definition = moduleForNode(instance, hierarchy);
    if (!definition) return null;
    names.push(String(instance.config?.instanceName ?? instance.label ?? instance.id));
    circuit = definition.circuit;
  }
  return { circuit, definition, names };
}

export function projectLiveHierarchyValues(top: Circuit, hierarchy: ProjectHierarchyDocument, sources: ElaborationSources,
  signals: Readonly<Record<string, RuntimeLogicValue>>, path: readonly string[]): Map<string, RuntimeLogicValue> {
  const scope = liveScope(top, hierarchy, path);
  const flat = elaborateProjectHierarchy(top, hierarchy);
  const values = new Map<string, RuntimeLogicValue>();
  if (!scope) return values;
  const samePath = (candidate: readonly string[], wanted: readonly string[]) => candidate.length === wanted.length && candidate.every((id, index) => id === wanted[index]);
  const read = (localCircuit: Circuit, localPath: readonly string[], ref: PortRef, depth = 0): RuntimeLogicValue | undefined => {
    if (depth >= 64) return undefined;
    const node = localCircuit.nodes.find(item => item.id === ref.nodeId);
    if (!node) return undefined;
    const module = moduleForNode(node, hierarchy);
    if (module) {
      const { base, bitIndex } = splitBitPort(ref.portName);
      const port = module.ports.find(item => item.name === base);
      const refs = port ? modulePortInternalRefs(port, bitIndex) : [];
      const found = refs.map(item => read(module.circuit, [...localPath, node.id], item, depth + 1));
      return found.length && found.every(value => value !== undefined && value === found[0]) ? found[0] : undefined;
    }
    const flatId = Object.keys(sources).find(id => sources[id].localNodeId === node.id && samePath(sources[id].instancePath, localPath));
    if (flatId && signals[`${flatId}.${ref.portName}`] !== undefined) return signals[`${flatId}.${ref.portName}`];
    if (flatId) {
      const driver = flat.connections.find(connection => typeof connection.to !== 'string' && connection.to.nodeId === flatId && connection.to.portName === ref.portName);
      if (driver && typeof driver.from !== 'string') return signals[`${driver.from.nodeId}.${driver.from.portName}`];
    }
    // Input ports read their actual driver when the engine retains outputs only.
    const incoming = localCircuit.connections.find(connection => typeof connection.to !== 'string' && connection.to.nodeId === node.id && connection.to.portName === ref.portName);
    if (incoming && typeof incoming.from !== 'string') return read(localCircuit, localPath, incoming.from, depth + 1);
    return undefined;
  };
  for (const node of scope.circuit.nodes) {
    const module = moduleForNode(node, hierarchy);
    if (module) {
      for (const port of module.ports) for (const index of modulePortIndices(port)) {
        const name = modulePortWidth(port) > 1 ? `${port.name}(${index})` : port.name;
        const value = read(scope.circuit, path, { nodeId: node.id, portName: name });
        if (value !== undefined) values.set(`${node.id}.${name}`, value);
      }
    } else if (node.config?.moduleBoundary && scope.definition) {
      const port = scope.definition.ports.find(item => item.id === node.config?.modulePortId);
      const refs = port ? modulePortInternalRefs(port, Number(node.config.portBitIndex ?? 0)) : [];
      const found = refs.map(ref => read(scope.circuit, path, ref));
      if (found.length && found.every(value => value !== undefined && value === found[0])) {
        values.set(`${node.id}.out`, found[0]!); values.set(`${node.id}.in`, found[0]!);
      }
    } else {
      const flatId = Object.keys(sources).find(id => sources[id].localNodeId === node.id && samePath(sources[id].instancePath, path));
      if (flatId) for (const [key, value] of Object.entries(signals)) if (key.startsWith(`${flatId}.`)) values.set(`${node.id}${key.slice(flatId.length)}`, value);
    }
  }
  for (const connection of scope.circuit.connections) {
    if (typeof connection.from === 'string' || typeof connection.to === 'string') continue;
    const value = values.get(`${connection.from.nodeId}.${connection.from.portName}`);
    if (value !== undefined) values.set(`${connection.to.nodeId}.${connection.to.portName}`, value);
  }
  return values;
}
