import { describe, expect, it } from 'vitest';
import { migrateIoMappingToHardwareMappingV2 } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import {
  buildImportedProjectCompilerResult,
  deriveProjectCompilerResult,
} from '../importCompiler';
import type { ParsedHDL } from '../hdlToCircuit';

function buildAndGateParsedHdl(): ParsedHDL {
  return {
    entityName: 'top',
    ports: [
      { name: 'a', direction: 'in', typeName: 'STD_LOGIC' },
      { name: 'b', direction: 'in', typeName: 'STD_LOGIC' },
      { name: 'y', direction: 'out', typeName: 'STD_LOGIC' },
    ],
    instances: [
      {
        id: 'u_and',
        componentType: 'AND2',
        portMap: {
          A: 'a',
          B: 'b',
          Y: 'y',
        },
      },
    ],
    signals: [],
    warnings: [],
    lang: 'vhdl',
  };
}

function buildMissingClockParsedHdl(): ParsedHDL {
  return {
    entityName: 'top',
    ports: [
      { name: 'd', direction: 'in', typeName: 'STD_LOGIC' },
      { name: 'q', direction: 'out', typeName: 'STD_LOGIC' },
    ],
    instances: [
      {
        id: 'u_ff',
        componentType: 'DFF',
        portMap: {
          D: 'd',
          Q: 'q',
        },
      },
    ],
    signals: [],
    warnings: [],
    lang: 'vhdl',
  };
}

function buildManifestProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    name: 'manifest-compiler-context',
    circuit: {
      nodes: [
        { id: 'port_in_a', type: 'INPUT', x: 0, y: 0, label: 'in_a', config: {}, state: {} },
        { id: 'port_out_y', type: 'OUTPUT', x: 160, y: 0, label: 'out_y', config: {}, state: {} },
      ],
      connections: [
        {
          from: { nodeId: 'port_in_a', portName: 'out' },
          to: { nodeId: 'port_out_y', portName: 'in' },
        },
      ],
    },
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: 'broken preview text',
        },
      ],
    },
    fpga: {
      board: 'basys3',
      top: 'top',
    },
    ioMapping: {
      inputs: [{ id: 'in_a', nodeId: 'port_in_a', port: 'out', label: 'in_a', pin: 'V17' }],
      outputs: [{ id: 'out_y', nodeId: 'port_out_y', port: 'in', label: 'out_y', pin: 'U16' }],
    },
    hardwareMappingV2: migrateIoMappingToHardwareMappingV2({
      inputs: [{ id: 'in_a', nodeId: 'port_in_a', port: 'out', label: 'in_a', pin: 'V17' }],
      outputs: [{ id: 'out_y', nodeId: 'port_out_y', port: 'in', label: 'out_y', pin: 'U16' }],
    }),
    vectors: [],
  };
}

describe('buildImportedProjectCompilerResult', () => {
  it('builds IR and SimulationModel immediately for valid structural HDL', () => {
    const result = buildImportedProjectCompilerResult({
      sourceName: 'and-gate.vhd',
      topPath: 'top.vhd',
      topText: '-- structural fixture',
      parsedHdl: buildAndGateParsedHdl(),
    });

    expect(result.status.parse).toBe('success');
    expect(result.status.reconstruction).toBe('success');
    expect(result.status.compiler).toBe('runnable');
    expect(result.isImportRunnable).toBe(true);
    expect(result.ir.schemaVersion).toBe('rb.circuit-ir.v2');
    expect(result.simModel.isRunnable).toBe(true);
    expect(result.compilerDiagnostics).toEqual([]);
    expect(result.project.hardwareMappingV2?.entries).toHaveLength(3);
    expect(result.project.ioMapping?.inputs).toHaveLength(2);
    expect(result.project.ioMapping?.outputs).toHaveLength(1);
  });

  it('distinguishes reconstruction success from compiler blockage', () => {
    const result = buildImportedProjectCompilerResult({
      sourceName: 'dff-missing-clock.vhd',
      topPath: 'top.vhd',
      topText: '-- structural but invalid',
      parsedHdl: buildMissingClockParsedHdl(),
    });

    expect(result.status.parse).toBe('success');
    expect(result.status.reconstruction).toBe('success');
    expect(result.status.compiler).toBe('blocked');
    expect(result.isImportRunnable).toBe(false);
    expect(result.compilerDiagnostics.some((diagnostic) => diagnostic.code === 'IR004')).toBe(true);
  });

  it('preserves parser-failure vs compiler-runnable distinction for restored projects', () => {
    const project = buildManifestProject();
    const result = deriveProjectCompilerResult(project, {
      parsedHdl: {
        entityName: 'top',
        ports: [
          { name: 'in_a', direction: 'in', typeName: 'STD_LOGIC' },
          { name: 'out_y', direction: 'out', typeName: 'STD_LOGIC' },
        ],
        instances: [],
        signals: [],
        warnings: [],
        lang: 'vhdl',
      },
      parseStatus: 'failure',
      parserDiagnostics: [
        {
          source: 'manifest',
          severity: 'warning',
          message: 'Manifest HDL preview failed, but RedByte restored the manifest circuit.',
        },
      ],
    });

    expect(result.status.parse).toBe('failure');
    expect(result.status.compiler).toBe('runnable');
    expect(result.isImportRunnable).toBe(true);
    expect(result.parserDiagnostics[0]?.message).toContain('restored the manifest circuit');
  });
});
