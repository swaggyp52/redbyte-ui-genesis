import type { Circuit } from '@redbyte/rb-logic-core';
import { toCircuitV1 } from '@redbyte/rb-logic-core';
import { circuitToVerilog } from '@redbyte/rb-fpga-toolchain';
import type { IoMapping, IoMappingEntry } from '@redbyte/rb-utils';
import { lintBasys3ProjectPorts } from './portLint';
import { compareCodepoint } from '../../../export/codepointSort';
import { netlistFromCircuit } from '../../../export/netlistExport';
import {
  vhdlFromNetlist,
  type VhdlTopInputBinding,
  type VhdlTopOutputBinding,
  type VhdlTopPort,
} from '../../../export/vhdlExport';
import { BASYS3_ALLOWED_PACKAGE_PINS, resolveBasys3PackagePin } from './basys3Pins';

export interface Basys3BundleResult {
  topV: string;
  topVhd: string;
  topXdc: string;
  readme: string;
  warnings: string[];
  valid: boolean;
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function mappingKey(entry: IoMappingEntry): string {
  return `${entry.nodeId}.${entry.port}.${entry.id}`;
}

function stableSortMapping(entries: IoMappingEntry[]): IoMappingEntry[] {
  return [...entries].sort((a, b) => compareCodepoint(mappingKey(a), mappingKey(b)));
}

function parsePackagePin(line: string): string | null {
  const match = line.match(/PACKAGE_PIN\s+([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

function toSignalName(entry: IoMappingEntry): string {
  return sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
}

function buildTopXdc(ioMapping: IoMapping, warnings: string[]): string {
  const lines: string[] = [];
  lines.push('# RedByte Basys3 Constraints (deterministic)');
  lines.push('# Generated for top module: top');
  lines.push('');

  const sortedInputs = stableSortMapping(ioMapping.inputs);
  const sortedOutputs = stableSortMapping(ioMapping.outputs);

  if (sortedInputs.length > 0) {
    lines.push('## Inputs');
    for (const entry of sortedInputs) {
      if (!entry.pin) {
        warnings.push(`Missing pin mapping for input ${entry.nodeId}.${entry.port}`);
        continue;
      }
      const packagePin = resolveBasys3PackagePin(entry.pin);
      if (!packagePin) {
        warnings.push(`Unsupported Basys3 pin alias for input ${entry.nodeId}.${entry.port}: ${entry.pin}`);
        continue;
      }
      lines.push(
        `set_property -dict { PACKAGE_PIN ${packagePin} IOSTANDARD LVCMOS33 } [get_ports {${toSignalName(entry)}}]`
      );
      // Basys3 onboard 100 MHz oscillator is on W5 — emit timing constraint.
      if (packagePin === 'W5') {
        lines.push(
          `create_clock -period 10.000 -name sys_clk -waveform {0.000 5.000} [get_ports {${toSignalName(entry)}}]`
        );
      }
    }
    lines.push('');
  }

  if (sortedOutputs.length > 0) {
    lines.push('## Outputs');
    for (const entry of sortedOutputs) {
      if (!entry.pin) {
        warnings.push(`Missing pin mapping for output ${entry.nodeId}.${entry.port}`);
        continue;
      }
      const packagePin = resolveBasys3PackagePin(entry.pin);
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

function buildReadme(ioMapping: IoMapping, warnings: string[]): string {
  const sortedInputs = stableSortMapping(ioMapping.inputs);
  const sortedOutputs = stableSortMapping(ioMapping.outputs);

  const lines: string[] = [];
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
    const packagePin = entry.pin ? resolveBasys3PackagePin(entry.pin) : null;
    if (!packagePin) {
      warnings.push(`README pin map omitted invalid input pin alias: ${entry.nodeId}.${entry.port}`);
      continue;
    }
    lines.push(`| ${toSignalName(entry)} | ${entry.pin} | ${packagePin} | input |`);
  }

  for (const entry of sortedOutputs) {
    const packagePin = entry.pin ? resolveBasys3PackagePin(entry.pin) : null;
    if (!packagePin) {
      warnings.push(`README pin map omitted invalid output pin alias: ${entry.nodeId}.${entry.port}`);
      continue;
    }
    lines.push(`| ${toSignalName(entry)} | ${entry.pin} | ${packagePin} | output |`);
  }

  lines.push('');
  return lines.join('\n');
}

export function buildVhdlTopLevelBindings(ioMapping: IoMapping): {
  topPorts: VhdlTopPort[];
  topInputBindings: VhdlTopInputBinding[];
  topOutputBindings: VhdlTopOutputBinding[];
} {
  const sortedInputs = stableSortMapping(ioMapping.inputs);
  const sortedOutputs = stableSortMapping(ioMapping.outputs);

  const topPorts: VhdlTopPort[] = [
    ...sortedInputs.map((entry) => ({ name: toSignalName(entry), dir: 'in' as const, vhdlType: 'STD_LOGIC' })),
    ...sortedOutputs.map((entry) => ({ name: toSignalName(entry), dir: 'out' as const, vhdlType: 'STD_LOGIC' })),
  ];

  const topInputBindings: VhdlTopInputBinding[] = sortedInputs.map((entry) => ({
    portName: toSignalName(entry),
    toNodeId: entry.nodeId,
    toPort: entry.port,
  }));

  const topOutputBindings: VhdlTopOutputBinding[] = sortedOutputs.map((entry) => ({
    portName: toSignalName(entry),
    fromNodeId: entry.nodeId,
    fromPort: entry.port,
  }));

  return { topPorts, topInputBindings, topOutputBindings };
}

export function exportBasys3Bundle(
  circuit: Circuit,
  ioMapping: IoMapping,
  options?: { entityName?: string },
): Basys3BundleResult {
  const warnings: string[] = [];
  const netlist = netlistFromCircuit(circuit);
  const { topPorts, topInputBindings, topOutputBindings } = buildVhdlTopLevelBindings(ioMapping);
  const vhdl = vhdlFromNetlist(netlist, {
    entityName: options?.entityName ?? 'top',
    topPorts,
    topInputBindings,
    topOutputBindings,
  });

  warnings.push(...vhdl.warnings);

    // ---------------------------------------------------------------------------
    // VHDL entity port extraction (used for pre-ZIP parity check)
    // ---------------------------------------------------------------------------

    function extractVhdlEntityPorts(vhdlText: string): string[] {
      const match = vhdlText.match(/entity\s+\w+\s+is\s+Port\s*\(([^)]+)\)/si);
      if (!match) return [];
      return match[1]
        .split(';')
        .map((line) => line.trim().split(':')[0]?.trim() ?? '')
        .filter(Boolean);
    }

    function extractXdcPortNames(xdcText: string): string[] {
      return [...xdcText.matchAll(/\[get_ports\s+\{([^}]+)\}\]/g)].map((m) => m[1].trim());
    }

  const verilog = circuitToVerilog(toCircuitV1(circuit), ioMapping, {
    moduleName: options?.entityName ?? 'top',
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
      top: options?.entityName ?? 'top',
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
    .filter((pin): pin is string => Boolean(pin))
    .filter((pin) => !BASYS3_ALLOWED_PACKAGE_PINS.has(pin))
    .map((pin) => `Unknown Basys3 package pin in XDC: ${pin}`);
  warnings.push(...xdcPinWarnings);

    // ---- VHDL entity port vs XDC port parity check ---------------------------
    // This would have caught the 'LED not declared' bug: entity had 'ld0_node_in'
    // but XDC also had 'ld0_node_in', so a mismatch would surface immediately.
    const vhdlEntityPorts = new Set(extractVhdlEntityPorts(vhdl.vhd));
    const xdcPorts = new Set(extractXdcPortNames(topXdc));
    const vhdlXdcMismatches: string[] = [];
    for (const p of vhdlEntityPorts) {
      if (!xdcPorts.has(p)) {
        vhdlXdcMismatches.push(`VHDL entity port "${p}" has no XDC constraint`);
      }
    }
    for (const p of xdcPorts) {
      if (!vhdlEntityPorts.has(p)) {
        vhdlXdcMismatches.push(`XDC get_ports "${p}" not found in VHDL entity`);
      }
    }
    warnings.push(...vhdlXdcMismatches);

  const readme = buildReadme(ioMapping, warnings);
  const uniqueWarnings = Array.from(new Set(warnings)).sort((a, b) => compareCodepoint(a, b));

  const valid =
    lint.verilogModuleFound &&
    lint.missingInHdl.length === 0 &&
    lint.missingInXdc.length === 0 &&
    xdcPinWarnings.length === 0 &&
      verilog.unsupportedNodes.length === 0 &&
      vhdlXdcMismatches.length === 0;

  return {
    topV: verilog.verilog,
    topVhd: vhdl.vhd,
    topXdc,
    readme,
    warnings: uniqueWarnings,
    valid,
  };
}
