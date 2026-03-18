import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';
import { deriveDesignCompilerDiagnostics } from '../designCompilerDiagnostics';

function makeSequentialProjectWithoutClock(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    name: 'Missing Clock',
    description: 'Design compiler vs export diagnostic authority',
    circuit: {
      nodes: [
        { id: 'in_d', type: 'INPUT', label: 'D', x: 0, y: 0, config: {}, state: {} },
        { id: 'ff0', type: 'DFlipFlop', label: 'ff0', x: 200, y: 0, config: {}, state: {} },
        { id: 'out_q', type: 'OUTPUT', label: 'Q', x: 400, y: 0, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'in_d', portName: 'out' }, to: { nodeId: 'ff0', portName: 'D' } },
        { from: { nodeId: 'ff0', portName: 'Q' }, to: { nodeId: 'out_q', portName: 'in' } },
      ],
    },
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: '',
        },
      ],
    },
    fpga: {
      board: 'basys3',
      part: 'xc7a35tcpg236-1',
      top: 'top',
      constraints: {
        type: 'xdc',
        text: '',
      },
    },
    ioMapping: {
      inputs: [],
      outputs: [],
    },
    vectors: [],
  };
}

describe('deriveDesignCompilerDiagnostics', () => {
  it('uses IR diagnostics instead of relaying export diagnostics', () => {
    const project = makeSequentialProjectWithoutClock();

    const designDiagnostics = deriveDesignCompilerDiagnostics(project);
    const exportViewModel = buildExportViewModel(project);

    expect(designDiagnostics.some((diagnostic) => diagnostic.code === 'IR004')).toBe(true);
    expect(designDiagnostics.every((diagnostic) => !diagnostic.code.startsWith('RBEX'))).toBe(true);
    expect(exportViewModel.diagnostics.some((diagnostic) => diagnostic.code.startsWith('RBEX'))).toBe(
      true
    );
  });
});
