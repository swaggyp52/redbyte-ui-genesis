import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { getComponentSupport } from '@redbyte/rb-logic-core';
import { buildHierarchicalRippleAdder } from '../examples/hierarchicalRippleAdder';
import { buildLiveHierarchy, liveScope, projectLiveHierarchyValues } from '../liveHierarchy';
import { createEmptyProjectHierarchy, createModuleFromSelection, placeModuleInstance, type NativeVisualModuleDefinition } from '../projectHierarchy';
import { useProjectRuntime } from '../projectRuntime';

describe('parent live hierarchy projection', () => {
  it('projects the real 7 + 1 ripple values into repeated instances without changing authored or recorded owners', () => {
    const fixture = buildHierarchicalRippleAdder();
    useProjectRuntime.getState().loadFromProject({ kind: 'rb-project', version: 1, name: 'live adder', circuit: fixture.circuit, hierarchy: fixture.hierarchy, ioMapping: { inputs: [], outputs: [] } } as any);
    const state = useProjectRuntime.getState();
    const before = JSON.stringify({ circuit: state.circuit, hierarchy: state.hierarchy, vectors: state.projectVectors, scenarios: state.scenarios, archive: state.verifyRunArchive });
    const boundary = fixture.circuit.nodes.filter(node => node.type === 'INPUT' || node.type === 'Switch');
    for (const node of boundary) state.actions.sim.setInput(node.id, /a[012]$/i.test(node.id) || /b0$/i.test(node.id) ? 1 : 0);
    const current = useProjectRuntime.getState();
    const model = buildLiveHierarchy(current.circuit, current.hierarchy);
    expect(model.supported).toBe(true);
    const top = projectLiveHierarchyValues(current.circuit, current.hierarchy, model.sources, current.sim.signals, []);
    expect([0, 1, 2, 3].map(bit => top.get(`sum${bit}.out`))).toEqual([0, 0, 0, 1]);
    const instances = current.circuit.nodes.filter(node => node.config?.moduleDefinitionId);
    expect(instances).toHaveLength(4);
    const carryInstance = instances.find(node => String(node.config?.instanceName ?? node.label).includes('fa2'))!;
    const local = projectLiveHierarchyValues(current.circuit, current.hierarchy, model.sources, current.sim.signals, [carryInstance.id]);
    expect(local.get('o1.out')).toBe(1);
    expect(local.get('o1.a')).toBe(0);
    expect(local.get('o1.b')).toBe(1);
    expect(JSON.stringify({ circuit: current.circuit, hierarchy: current.hierarchy, vectors: current.projectVectors, scenarios: current.scenarios, archive: current.verifyRunArchive })).toBe(before);
    expect(liveScope(current.circuit, current.hierarchy, [carryInstance.id])?.names).toHaveLength(1);
  });

  it('uses exact instance identity for an ordinary authored reusable module and rejects recursion', () => {
    const circuit = { nodes: [{ id: 'a', type: 'Switch' }, { id: 'n1', type: 'NOT' }, { id: 'n2', type: 'NOT' }, { id: 'out', type: 'Lamp' }], connections: [
      { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'n1', portName: 'in' } },
      { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
      { from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
    ] };
    const result = createModuleFromSelection(circuit, createEmptyProjectHierarchy(), { moduleName: 'BufferPair', instanceName: 'first', selectedNodeIds: ['n1', 'n2'] });
    const model = buildLiveHierarchy(result.circuit, result.hierarchy);
    expect(model.supported).toBe(true);
    const id = Object.keys(model.sources).find(id => model.sources[id].localNodeId === 'n2')!;
    const values = projectLiveHierarchyValues(result.circuit, result.hierarchy, model.sources, { [`${id}.out`]: 1 }, [result.instance.id]);
    expect(values.get('n2.out')).toBe(1);
    expect(projectLiveHierarchyValues(result.circuit, result.hierarchy, model.sources, { [`${id}.out`]: 1 }, ['wrong']).size).toBe(0);
    result.definition.circuit.nodes.push({ id: 'recursive', type: result.definition.name, config: { moduleDefinitionId: result.definition.id } });
    expect(buildLiveHierarchy(result.circuit, result.hierarchy).reason).toMatch(/recursive/);
  });

  for (const { type, ports } of [
    { type: 'Register1', ports: ['D', 'CLK', 'EN', 'RST'] },
    { type: 'DLatch', ports: ['D', 'EN'] },
    { type: 'RSLatch', ports: ['R', 'S'] },
  ]) {
    it(`explicitly leaves a native ${type} module unqualified for live exploration`, () => {
      const support = getComponentSupport(type);
      expect(support?.isSequential).toBe(true);
      if (type === 'DLatch') {
        expect(ports).not.toContain('CLK'); // EN is level-sensitive, not a clock boundary.
        expect(support?.clockPort).toBe('EN');
      }
      if (type === 'RSLatch') expect(support?.clockPort).toBeUndefined();
      const circuit: Circuit = {
        nodes: [...ports.map(port => ({ id: `input-${port}`, type: 'INPUT', label: port })),
          { id: 'storage', type }, { id: 'buffer', type: 'NOT' }, { id: 'output', type: 'OUTPUT', label: 'Y' }],
        connections: [...ports.map(port => ({ id: `drive-${port}`, from: { nodeId: `input-${port}`, portName: 'out' },
          to: { nodeId: 'storage', portName: port } })),
          { id: 'storage-buffer', from: { nodeId: 'storage', portName: 'Q' }, to: { nodeId: 'buffer', portName: 'in' } },
          { id: 'buffer-output', from: { nodeId: 'buffer', portName: 'out' }, to: { nodeId: 'output', portName: 'in' } }],
      };
      const created = createModuleFromSelection(circuit, createEmptyProjectHierarchy(), {
        moduleName: `${type}Cell`, instanceName: 'storage_cell', selectedNodeIds: ['storage', 'buffer'], nowIso: '2026-10-08T12:00:00.000Z',
      });
      expect(created.definition.ports.filter(port => port.direction === 'input')).toHaveLength(ports.length);
      expect(created.circuit.nodes.some(node => node.config?.moduleDefinitionId === created.definition.id)).toBe(true);
      const model = buildLiveHierarchy(created.circuit, created.hierarchy);
      expect(model.circuit.nodes.some(node => node.type === type)).toBe(true);
      expect(model.supported).toBe(false);
      expect(model.reason).toMatch(/sequential modules.*not yet qualified/);
      expect(model.reason).toMatch(/Run authored clock\/reset cases in Simulate/);
    });
  }

  it('projects two true nested module instances and their internal boundaries from the shared parent execution', () => {
    const primitive: Circuit = {
      nodes: [{ id: 'a', type: 'Switch', label: 'A' }, { id: 'n1', type: 'NOT' }, { id: 'n2', type: 'NOT' },
        { id: 'n3', type: 'NOT' }, { id: 'out', type: 'Lamp', label: 'Y' }],
      connections: [
        { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'n1', portName: 'in' } },
        { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
        { from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'n3', portName: 'in' } },
        { from: { nodeId: 'n3', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
      ],
    };
    const inner = createModuleFromSelection(primitive, createEmptyProjectHierarchy(), {
      moduleName: 'NestedBufferPair', instanceName: 'buffer', selectedNodeIds: ['n1', 'n2'], nowIso: '2026-10-08T12:00:00.000Z',
    });
    const outer = createModuleFromSelection(inner.circuit, inner.hierarchy, {
      moduleName: 'NestedInverter', instanceName: 'first', selectedNodeIds: [inner.instance.id, 'n3'], nowIso: '2026-10-08T12:00:00.000Z',
    });
    expect(outer.definition.circuit.nodes.some(node => node.config?.moduleDefinitionId === inner.definition.id)).toBe(true);
    const second = placeModuleInstance(outer.circuit, outer.definition, { x: 300, y: 200 }, 'second');
    const outerInput = outer.definition.ports.find(port => port.direction === 'input')!;
    const outerOutput = outer.definition.ports.find(port => port.direction === 'output')!;
    const innerInput = inner.definition.ports.find(port => port.direction === 'input')!;
    const innerOutput = inner.definition.ports.find(port => port.direction === 'output')!;
    const top: Circuit = { nodes: [...second.circuit.nodes, { id: 'b', type: 'Switch', label: 'B' }, { id: 'out-b', type: 'Lamp', label: 'Z' }],
      connections: [...second.circuit.connections,
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: second.instance.id, portName: outerInput.name } },
        { from: { nodeId: second.instance.id, portName: outerOutput.name }, to: { nodeId: 'out-b', portName: 'in' } }],
    };
    useProjectRuntime.getState().loadFromProject({ kind: 'rb-project', version: 1, name: 'nested live projection',
      circuit: top, hierarchy: outer.hierarchy,
      ioMapping: { inputs: [{ id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'SW0' }, { id: 'b', nodeId: 'b', port: 'out', label: 'B', pin: 'SW1' }],
        outputs: [{ id: 'y', nodeId: 'out', port: 'in', label: 'Y', pin: 'LD0' }, { id: 'z', nodeId: 'out-b', port: 'in', label: 'Z', pin: 'LD1' }] },
      vectors: [{ tick: 0, inputs: { a: 0, b: 0 }, expected: { y: 1, z: 1 } }],
    } as any);
    const initial = useProjectRuntime.getState();
    const recording = initial.runVerification({ scenarioId: initial.activeScenarioId, scenarioName: 'Both inputs low',
      deterministicHash: 'nested-reference', rows: [], captureEvaluations: true });
    expect(recording.status).toBe('pass');
    const owners = () => { const state = useProjectRuntime.getState(); return JSON.stringify({ circuit: state.circuit, hierarchy: state.hierarchy,
      vectors: state.projectVectors, scenarios: state.scenarios, archive: state.verifyRunArchive, history: state.verifyRunHistory,
      last: state.verifyLastRun, health: state.projectHealthCore, mapping: state.hardwareMappingV2, exports: state.exportHistory }); };
    const before = owners();
    const assertBoundaries = (definition: NativeVisualModuleDefinition, values: Map<string, unknown>, inputBit: number, outputBit: number) => {
      const boundaries = definition.circuit.nodes.filter(node => node.config?.moduleBoundary);
      expect(boundaries).toHaveLength(2);
      for (const boundary of boundaries) {
        const expected = boundary.config?.moduleBoundary === 'input' ? inputBit : outputBit;
        expect(values.get(`${boundary.id}.out`)).toBe(expected);
        expect(values.get(`${boundary.id}.in`)).toBe(expected);
      }
    };
    for (const a of [1, 0] as const) {
      const b = a === 1 ? 0 : 1;
      useProjectRuntime.getState().actions.sim.setInput('a', a);
      useProjectRuntime.getState().actions.sim.setInput('b', b);
      const state = useProjectRuntime.getState();
      const model = buildLiveHierarchy(state.circuit, state.hierarchy);
      expect(model.supported).toBe(true);
      const topValues = projectLiveHierarchyValues(state.circuit, state.hierarchy, model.sources, state.sim.signals, []);
      expect(topValues.get('out.in')).toBe(1 - a);
      expect(topValues.get('out-b.in')).toBe(a);
      for (const [instance, inputBit] of [[outer.instance, a], [second.instance, b]] as const) {
        const path = [instance.id, inner.instance.id];
        expect(liveScope(state.circuit, state.hierarchy, path)?.names).toEqual([instance.config?.instanceName, 'buffer']);
        expect(Object.values(model.sources).some(source => source.localNodeId === 'n1'
          && source.instancePath.length === 2 && source.instancePath.every((id, index) => id === path[index]))).toBe(true);
        const parentValues = projectLiveHierarchyValues(state.circuit, state.hierarchy, model.sources, state.sim.signals, [instance.id]);
        expect(parentValues.get(`${inner.instance.id}.${innerInput.name}`)).toBe(inputBit);
        expect(parentValues.get(`${inner.instance.id}.${innerOutput.name}`)).toBe(inputBit);
        expect(parentValues.get('n3.in')).toBe(inputBit);
        expect(parentValues.get('n3.out')).toBe(1 - inputBit);
        assertBoundaries(outer.definition, parentValues, inputBit, 1 - inputBit);
        const nestedValues = projectLiveHierarchyValues(state.circuit, state.hierarchy, model.sources, state.sim.signals, path);
        expect(nestedValues.get('n1.in')).toBe(inputBit);
        expect(nestedValues.get('n1.out')).toBe(1 - inputBit);
        expect(nestedValues.get('n2.in')).toBe(1 - inputBit);
        expect(nestedValues.get('n2.out')).toBe(inputBit);
        assertBoundaries(inner.definition, nestedValues, inputBit, inputBit);
      }
      expect(owners()).toBe(before);
    }
  });
});
