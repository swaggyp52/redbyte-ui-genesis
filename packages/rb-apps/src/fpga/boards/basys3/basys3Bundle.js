import { toCircuitV1 } from '@redbyte/rb-logic-core';
import { circuitToVerilog } from '@redbyte/rb-fpga-toolchain';
import { lintBasys3ProjectPorts } from './portLint';
import { netlistFromCircuit } from '../../../export/netlistExport';
import { vhdlFromNetlist } from '../../../export/vhdlExport';
import { compareCodepoint } from '../../../export/codepointSort';

const BASYS3_SWITCH_PINS = [
  'V17', 'V16', 'W16', 'W17', 'W15', 'V15', 'W14', 'W13',
  'V2', 'T3', 'T2', 'R3', 'W2', 'U1', 'T1', 'R2',
];

const BASYS3_LED_PINS = [
  'U16', 'E19', 'U19', 'V19', 'W18', 'U15', 'U14', 'V14',
  'V13', 'V3', 'W3', 'U3', 'P3', 'N3', 'P1', 'L1',
];

const BASYS3_ALLOWED_PACKAGE_PINS = new Set([...BASYS3_SWITCH_PINS, ...BASYS3_LED_PINS]);

function sanitizeIdentifier(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function mappingKey(entry) {
  return `${entry.nodeId}.${entry.port}.${entry.id}`;
}

function stableSortMapping(entries) {
  return [...entries].sort((a, b) => compareCodepoint(mappingKey(a), mappingKey(b)));
}

function parsePackagePin(line) {
  const match = line.match(/PACKAGE_PIN\s+([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

function toSignalName(entry) {
  return sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
}

function pinToPackagePin(pin) {
  if (pin.startsWith('SW')) {
    const index = Number.parseInt(pin.slice(2), 10);
    return Number.isFinite(index) && index >= 0 && index < BASYS3_SWITCH_PINS.length
      ? BASYS3_SWITCH_PINS[index]
      : null;
  }
  if (pin.startsWith('LD')) {
    const index = Number.parseInt(pin.slice(2), 10);
    return Number.isFinite(index) && index >= 0 && index < BASYS3_LED_PINS.length
      ? BASYS3_LED_PINS[index]
      : null;
  }
  return null;
}

function buildTopXdc(ioMapping, warnings) {
  const lines = [];
  lines.push('# RedByte Basys3 Constraints (deterministic)');
  lines.push('# Generated for top module: top');
  lines.push('');

  const sortedInputs = stableSortMapping(ioMapping.inputs);
  const sortedOutputs = stableSortMapping(ioMapping.outputs);

  if (sortedInputs.length > 0) {
    lines.push('## Inputs (switches)');
    for (const entry of sortedInputs) {
      if (!entry.pin) {
        warnings.push(`Missing pin mapping for input ${entry.nodeId}.${entry.port}`);
        continue;
      }
      const packagePin = pinToPackagePin(entry.pin);
      if (!packagePin) {
        warnings.push(`Unsupported Basys3 pin alias for input ${entry.nodeId}.${entry.port}: ${entry.pin}`);
        continue;
      }
      lines.push(
        `set_property -dict { PACKAGE_PIN ${packagePin} IOSTANDARD LVCMOS33 } [get_ports {${toSignalName(entry)}}]`
      );
    }
    lines.push('');
  }

  if (sortedOutputs.length > 0) {
    lines.push('## Outputs (leds)');
    for (const entry of sortedOutputs) {
      if (!entry.pin) {
        warnings.push(`Missing pin mapping for output ${entry.nodeId}.${entry.port}`);
        continue;
      }
      const packagePin = pinToPackagePin(entry.pin);
      if (!packagePin) {
        warnings.push(`Unsupported Basys3 pin alias for output ${entry.nodeId}.${entry.port}: ${entry.pin}`);
        continue;
      }
      lines.push(
        `set_property -dict { PACKAGE_PIN ${packagePin} IOSTANDARD LVCMOS33 } [get_ports {${toSignalName(entry)}}]`
      );
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function buildReadme(ioMapping, warnings) {
  const sortedInputs = stableSortMapping(ioMapping.inputs);
  const sortedOutputs = stableSortMapping(ioMapping.outputs);

  const lines = [];
  lines.push('# RedByte Basys3 Export Bundle');
  lines.push('');
  lines.push('## Files');
  lines.push('- `top.vhd`: deterministic synthesizable VHDL top module');
  lines.push('- `top.xdc`: Basys3 constraints for used mapped pins only');
  lines.push('');
  lines.push('## Vivado quick steps');
  lines.push('1. Create a new RTL project for Basys3 (xc7a35tcpg236-1).');
  lines.push('2. Add `top.vhd` as design source and set top module to `top`.');
  lines.push('3. Add `top.xdc` as constraints file.');
  lines.push('4. Run Synthesis, Implementation, and Generate Bitstream.');
  lines.push('');
  lines.push('## Pin map');
  lines.push('| Signal | Alias | Package Pin | Direction |');
  lines.push('| --- | --- | --- | --- |');

  for (const entry of sortedInputs) {
    const packagePin = entry.pin ? pinToPackagePin(entry.pin) : null;
    if (!packagePin) {
      warnings.push(`README pin map omitted invalid input pin alias: ${entry.nodeId}.${entry.port}`);
      continue;
    }
    lines.push(`| ${toSignalName(entry)} | ${entry.pin} | ${packagePin} | input |`);
  }

  for (const entry of sortedOutputs) {
    const packagePin = entry.pin ? pinToPackagePin(entry.pin) : null;
    if (!packagePin) {
      warnings.push(`README pin map omitted invalid output pin alias: ${entry.nodeId}.${entry.port}`);
      continue;
    }
    lines.push(`| ${toSignalName(entry)} | ${entry.pin} | ${packagePin} | output |`);
  }

  lines.push('');
  return lines.join('\n');
}

export function exportBasys3Bundle(circuit, ioMapping) {
  const warnings = [];
  const netlist = netlistFromCircuit(circuit);
  const vhdl = vhdlFromNetlist(netlist, { entityName: 'top' });

  warnings.push(...vhdl.warnings);

  const verilog = circuitToVerilog(toCircuitV1(circuit), ioMapping, {
    moduleName: 'top',
    targetBoard: 'basys3',
  });

  if (verilog.unsupportedNodes.length > 0) {
    warnings.push(...verilog.unsupportedNodes.map((node) => `Unsupported node: ${node}`));
  }
  warnings.push(...verilog.warnings);

  const topXdc = buildTopXdc(ioMapping, warnings);
  const lint = lintBasys3ProjectPorts(
    {
      sources: [{ path: 'top.v', language: 'verilog', text: verilog.verilog }],
      top: 'top',
    },
    topXdc
  );

  if (!lint.verilogModuleFound) {
    warnings.push('top module not found in generated verilog');
  }
  if (lint.missingInHdl.length > 0) {
    warnings.push(`XDC ports missing in HDL: ${lint.missingInHdl.join(', ')}`);
  }
  if (lint.missingInXdc.length > 0) {
    warnings.push(`HDL ports missing in XDC: ${lint.missingInXdc.join(', ')}`);
  }

  const xdcPinWarnings = topXdc
    .split('\n')
    .map((line) => parsePackagePin(line))
    .filter((pin) => Boolean(pin))
    .filter((pin) => !BASYS3_ALLOWED_PACKAGE_PINS.has(pin))
    .map((pin) => `Unknown Basys3 package pin in XDC: ${pin}`);
  warnings.push(...xdcPinWarnings);

  const readme = buildReadme(ioMapping, warnings);
  const uniqueWarnings = Array.from(new Set(warnings)).sort((a, b) => compareCodepoint(a, b));

  const valid =
    lint.verilogModuleFound &&
    lint.missingInHdl.length === 0 &&
    lint.missingInXdc.length === 0 &&
    xdcPinWarnings.length === 0 &&
    verilog.unsupportedNodes.length === 0;

  return {
    topV: verilog.verilog,
    topVhd: vhdl.vhd,
    topXdc,
    readme,
    warnings: uniqueWarnings,
    valid,
  };
}
