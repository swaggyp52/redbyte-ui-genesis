import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVhdl } from '../vhdlImport';
import { buildImportedProjectCompilerResult } from '../importCompiler';
import { parseXdcPins } from '../xdcImport';
import { exportBasys3Bundle } from '../../fpga/boards/basys3/basys3Bundle';
import { buildBasys3ExportModel } from '../../fpga/boards/basys3/basys3ExportModel';
import { buildExportContract } from '../../fpga/boards/basys3/basys3ExportContract';
import { parsedHdlToCircuit } from '../hdlToCircuit';

/** Minimal Vivado-style src tree (top.vhd + top.xdc only). Full Vivado dumps stay local and are gitignored. */
const FIXTURE_DIR = join(__dirname, '../../fixtures/import/04-lab8-security-lock/sources');

describe('fixture04 lab8 security lock import', () => {
  it('parses process-based sequential VHDL with CE/CLR and indexed vector ports', () => {
    const topVhd = readFileSync(join(FIXTURE_DIR, 'sources_1/imports/lab8/top.vhd'), 'utf8');
    const parsed = parseVhdl(topVhd);

    const inputNames = parsed.ports.filter((port) => port.direction === 'in').map((port) => port.name);
    const outputNames = parsed.ports
      .filter((port) => port.direction === 'out')
      .map((port) => port.name);

    expect(inputNames).toEqual(['SW[8]', 'SW[7]', 'SW[6]', 'SW[5]', 'SW[4]']);
    expect(outputNames).toEqual(['LED1']);
    expect(parsed.instances.filter((instance) => instance.componentType === 'FDCE')).toHaveLength(8);
    expect(parsed.instances.some((instance) => instance.componentType === 'AND')).toBe(true);
    expect(parsed.instances.some((instance) => instance.componentType === 'XOR')).toBe(true);
    expect(parsed.instances.some((instance) => instance.componentType === 'NOT')).toBe(true);
    expect(parsed.warnings).toEqual([]);
  });

  it('builds runnable imported project with fixture xdc mapping', () => {
    const topVhd = readFileSync(join(FIXTURE_DIR, 'sources_1/imports/lab8/top.vhd'), 'utf8');
    const topXdc = readFileSync(join(FIXTURE_DIR, 'constrs_1/imports/lab8/top.xdc'), 'utf8');
    const parsed = parseVhdl(topVhd);
    const xdc = parseXdcPins(topXdc);

    const result = buildImportedProjectCompilerResult({
      sourceName: 'lab8_security_lock_vivado.zip',
      topPath: 'top.vhd',
      topText: topVhd,
      parsedHdl: parsed,
      xdcPath: 'top.xdc',
      xdcText: topXdc,
      xdcResult: xdc,
    });

    expect(result.status.parse).toBe('success');
    expect(result.status.reconstruction).toBe('success');
    expect(result.status.compiler).toBe('runnable');
    const registerFamilyCount = result.project.circuit.nodes.filter(
      (node) => node.type === 'Register1'
    ).length;
    expect(registerFamilyCount).toBe(8);
    expect(result.project.hardwareMappingV2?.entries).toHaveLength(6);
    expect(result.project.ioMapping.inputs).toHaveLength(5);
    expect(result.project.ioMapping.outputs).toHaveLength(1);
    expect(result.project.ioMapping.inputs.map((entry) => entry.pin)).toEqual(
      expect.arrayContaining(['V15', 'W14', 'W13', 'V2', 'W15'])
    );
  });

  it('round-trips Lab 8 semantics through export and re-import', () => {
    const topVhd = readFileSync(join(FIXTURE_DIR, 'sources_1/imports/lab8/top.vhd'), 'utf8');
    const topXdc = readFileSync(join(FIXTURE_DIR, 'constrs_1/imports/lab8/top.xdc'), 'utf8');
    const parsed = parseVhdl(topVhd);
    const xdc = parseXdcPins(topXdc);
    const imported = buildImportedProjectCompilerResult({
      sourceName: 'lab8_security_lock_vivado.zip',
      topPath: 'top.vhd',
      topText: topVhd,
      parsedHdl: parsed,
      xdcPath: 'top.xdc',
      xdcText: topXdc,
      xdcResult: xdc,
    });

    expect(imported.status.compiler).toBe('runnable');
    const exportModel = buildBasys3ExportModel(imported.project.circuit, imported.project.ioMapping);
    const contract = buildExportContract(exportModel, imported.project.ioMapping, 'top');
    expect(contract.timingMode).toBe('manual_event_driven_lab');

    const bundle = exportBasys3Bundle(imported.project.circuit, imported.project.ioMapping, {
      entityName: 'top',
      exportModel,
    });
    expect(bundle.topXdc).not.toMatch(/(^|\n)\s*create_clock\b/im);
    expect(bundle.topXdc).toMatch(/set_false_path\s+-from/i);

    const reparsed = parseVhdl(bundle.topVhd);
    const reconstructed = parsedHdlToCircuit(reparsed);
    const reconstructedRegisters = reconstructed.circuit.nodes.filter(
      (node) => node.type === 'Register1'
    ).length;
    const sourceRegisters = imported.project.circuit.nodes.filter(
      (node) => node.type === 'Register1'
    ).length;

    expect(reparsed.ports.filter((port) => port.direction === 'in').length).toBe(5);
    expect(reparsed.ports.filter((port) => port.direction === 'out').length).toBe(1);
    expect(reconstructedRegisters).toBe(sourceRegisters);
    expect(imported.project.ioMapping.inputs.map((entry) => entry.pin)).toEqual(
      expect.arrayContaining(['V15', 'W14', 'W13', 'V2', 'W15'])
    );
    expect(imported.project.ioMapping.outputs.map((entry) => entry.pin)).toEqual(
      expect.arrayContaining(['E19'])
    );
  });
});
