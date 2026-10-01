import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { buildBasys3ExportModel } from './basys3ExportModel';
import { exportBasys3Bundle } from './basys3Bundle';

function fixture(): { circuit: Circuit; mapping: IoMapping } {
  return {
    circuit: {
      nodes: [{ id: 'sw', type: 'INPUT' }, { id: 'led', type: 'OUTPUT' }],
      connections: [{ from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'led', portName: 'in' } }],
    },
    mapping: {
      inputs: [{ id: 'sw', nodeId: 'sw', port: 'out', pin: 'SW0' }],
      outputs: [{ id: 'led', nodeId: 'led', port: 'in', pin: 'LD0' }],
    },
  };
}

describe('canonical VHDL/XDC bundle authority', () => {
  it('preserves unsupported unknown primitives as invalid instead of accepting a skipped VHDL node', () => {
    const { circuit, mapping } = fixture();
    circuit.nodes.push({ id: 'unknown', type: 'UnknownGate' });
    const model = buildBasys3ExportModel(circuit, mapping);
    expect(model.blockingDiagnostics.some((entry) => entry.code === 'IR001')).toBe(true);
    const bundle = exportBasys3Bundle(circuit, mapping, { exportModel: model });
    expect(bundle.valid).toBe(false);
    expect(bundle.warnings).toContain('Unsupported node: unknown (UnknownGate)');
  });

  it('preserves an undriven output as a draft warning without promoting it to an export error', () => {
    const { circuit, mapping } = fixture();
    circuit.connections = [];
    const model = buildBasys3ExportModel(circuit, mapping);
    expect(model.ir.diagnostics.find((entry) => entry.code === 'IR003')?.severity).toBe('warning');
    const bundle = exportBasys3Bundle(circuit, mapping, { exportModel: model });
    expect(bundle.valid).toBe(true);
    expect(bundle.warnings.some((warning) => warning.includes('has no driver'))).toBe(true);
  });

  it.each(['RegisterBus', 'StateBank'])('keeps %s blocked by the current scalar export policy', (type) => {
    const { circuit, mapping } = fixture();
    circuit.nodes.push({ id: 'reg', type });
    circuit.connections = [
      { from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'reg', portName: 'D' } },
      { from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'reg', portName: 'CLK' } },
      { from: { nodeId: 'reg', portName: 'Q' }, to: { nodeId: 'led', portName: 'in' } },
    ];
    const bundle = exportBasys3Bundle(circuit, mapping);
    expect(bundle.valid).toBe(false);
    expect(bundle.warnings.some((warning) => warning.includes(`Unsupported sequential component: ${type}`))).toBe(true);
  });

  it('keeps falling-edge Register1 capture blocked by the current temporal policy', () => {
    const { circuit, mapping } = fixture();
    circuit.nodes.push({ id: 'reg', type: 'Register1', config: { clockPolarity: 'falling_edge' } });
    circuit.connections = [
      { from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'reg', portName: 'D' } },
      { from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'reg', portName: 'CLK' } },
      { from: { nodeId: 'reg', portName: 'Q' }, to: { nodeId: 'led', portName: 'in' } },
    ];
    const bundle = exportBasys3Bundle(circuit, mapping);
    expect(bundle.valid).toBe(false);
    expect(bundle.warnings.some((warning) => warning.includes('falling-edge capture is not supported'))).toBe(true);
  });

  it('rejects multiple authored drivers on the same output input', () => {
    const { circuit, mapping } = fixture();
    circuit.nodes.push({ id: 'sw2', type: 'INPUT' });
    circuit.connections.push({ from: { nodeId: 'sw2', portName: 'out' }, to: { nodeId: 'led', portName: 'in' } });
    mapping.inputs.push({ id: 'sw2', nodeId: 'sw2', port: 'out', pin: 'SW1' });
    const model = buildBasys3ExportModel(circuit, mapping);
    expect(model.blockingDiagnostics.some((entry) => entry.code === 'IR002')).toBe(true);
    expect(exportBasys3Bundle(circuit, mapping, { exportModel: model }).valid).toBe(false);
  });

  it('rejects a register without its required clock driver', () => {
    const { circuit, mapping } = fixture();
    circuit.nodes.push({ id: 'reg', type: 'Register1' });
    circuit.connections = [
      { from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'reg', portName: 'D' } },
      { from: { nodeId: 'reg', portName: 'Q' }, to: { nodeId: 'led', portName: 'in' } },
    ];
    const model = buildBasys3ExportModel(circuit, mapping);
    expect(model.blockingDiagnostics.some((entry) => entry.code === 'IR004')).toBe(true);
    expect(exportBasys3Bundle(circuit, mapping, { exportModel: model }).valid).toBe(false);
  });

  it('rejects an unsupported pin alias through the canonical pin contract', () => {
    const { circuit, mapping } = fixture();
    mapping.outputs[0].pin = 'UNKNOWN_PIN';
    const bundle = exportBasys3Bundle(circuit, mapping);
    expect(bundle.valid).toBe(false);
    expect(bundle.warnings.some((warning) => warning.includes('[RBEX-CT-006]'))).toBe(true);
  });

  it('rejects two physical output ports claiming the same package pin', () => {
    const { circuit, mapping } = fixture();
    circuit.nodes.push({ id: 'led2', type: 'OUTPUT' });
    circuit.connections.push({ from: { nodeId: 'sw', portName: 'out' }, to: { nodeId: 'led2', portName: 'in' } });
    mapping.outputs.push({ id: 'led2', nodeId: 'led2', port: 'in', pin: 'LD0' });
    const bundle = exportBasys3Bundle(circuit, mapping);
    expect(bundle.valid).toBe(false);
    expect(bundle.warnings.some((warning) => warning.includes('[RBEX-CT-008]'))).toBe(true);
  });
});
