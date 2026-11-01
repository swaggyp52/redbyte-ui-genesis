import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { connectBuses, createBusBoundary } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { buildBasys3ExportModel } from '../basys3ExportModel';

function passthrough(): { circuit: Circuit; ioMapping: IoMapping } {
  let circuit: Circuit = { nodes: [], connections: [] };
  const a = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 1, right: 0 });
  circuit = a.circuit;
  const y = createBusBoundary(circuit, { name: 'Y', direction: 'output', left: 1, right: 0 });
  circuit = y.circuit;
  circuit = connectBuses(circuit, a.bus.id, y.bus.id);

  const nodeId = (label: string) =>
    circuit.nodes.find((node) => node.label === label)!.id;
  const ioMapping: IoMapping = {
    inputs: [
      { id: 'in-a0', nodeId: nodeId('A[0]'), port: 'out', label: 'A[0]', pin: 'V17' },
      { id: 'in-a1', nodeId: nodeId('A[1]'), port: 'out', label: 'A[1]', pin: 'V16' },
    ],
    outputs: [
      { id: 'out-y0', nodeId: nodeId('Y[0]'), port: 'in', label: 'Y[0]', pin: 'U16' },
      { id: 'out-y1', nodeId: nodeId('Y[1]'), port: 'in', label: 'Y[1]', pin: 'E19' },
    ],
  };
  return { circuit, ioMapping };
}

describe('Basys3 export: declared buses', () => {
  it('emits full declared vector ports from declarations', () => {
    const { circuit, ioMapping } = passthrough();
    const model = buildBasys3ExportModel(circuit, ioMapping);
    const a = model.topPorts.find((port) => port.name === 'A');
    const yPort = model.topPorts.find((port) => port.name === 'Y');
    expect(a?.vhdlType).toBe('STD_LOGIC_VECTOR(1 downto 0)');
    expect(yPort?.vhdlType).toBe('STD_LOGIC_VECTOR(1 downto 0)');
    expect(model.inputRefs.map((ref) => ref.signalRef).sort()).toEqual(['A(0)', 'A(1)']);
    expect(model.outputRefs.map((ref) => ref.xdcRef).sort()).toEqual(['Y[0]', 'Y[1]']);
  });

  it('declared identity survives member label drift (the declaration owns the vector)', () => {
    const { circuit, ioMapping } = passthrough();
    const drifted: Circuit = {
      ...circuit,
      nodes: circuit.nodes.map((node) =>
        node.label === 'A[1]' ? { ...node, label: 'RENAMED_BY_HAND' } : node
      ),
    };
    const driftedMapping: IoMapping = {
      ...ioMapping,
      inputs: ioMapping.inputs.map((entry) =>
        entry.label === 'A[1]' ? { ...entry, label: 'RENAMED_BY_HAND' } : entry
      ),
    };
    const model = buildBasys3ExportModel(drifted, driftedMapping);
    const a = model.topPorts.find((port) => port.name === 'A');
    expect(a?.vhdlType).toBe('STD_LOGIC_VECTOR(1 downto 0)');
    // Without the declaration the drifted label would fall out of the group.
    const withoutDeclaration = buildBasys3ExportModel(
      { ...drifted, buses: undefined },
      driftedMapping
    );
    const scalarNames = withoutDeclaration.topPorts.map((port) => port.name);
    expect(scalarNames).toContain('RENAMED_BY_HAND');
  });

  it('honors ascending declarations with VHDL "to" ranges', () => {
    let circuit: Circuit = { nodes: [], connections: [] };
    const d = createBusBoundary(circuit, { name: 'D', direction: 'input', left: 0, right: 3 });
    circuit = d.circuit;
    const ioMapping: IoMapping = {
      inputs: d.bus.bits.map((bit) => ({
        id: `in-${bit.index}`,
        nodeId: bit.nodeId,
        port: 'out',
        label: `D[${bit.index}]`,
        pin: '',
      })),
      outputs: [],
    };
    const model = buildBasys3ExportModel(circuit, ioMapping);
    const port = model.topPorts.find((entry) => entry.name === 'D');
    expect(port?.vhdlType).toBe('STD_LOGIC_VECTOR(0 to 3)');
  });
});
