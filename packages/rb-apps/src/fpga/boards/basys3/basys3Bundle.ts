import type { Circuit } from '@redbyte/rb-logic-core';
import { toCircuitV1 } from '@redbyte/rb-logic-core';
import { circuitToVerilog } from '@redbyte/rb-fpga-toolchain';
import type { IoMapping } from '@redbyte/rb-utils';
import { compareCodepoint } from '../../../export/codepointSort';
import { vhdlFromNetlist } from '../../../export/vhdlExport';
import {
  BASYS3_ALLOWED_PACKAGE_PINS,
} from './basys3Pins';
import { buildBasys3ExportModel, type Basys3ExportModel } from './basys3ExportModel';
import {
  buildExportContract,
  type Basys3ExportContract,
  type Basys3PortContract,
} from './basys3ExportContract';
import { lintBasys3ProjectPorts } from './portLint';

export { buildVhdlTopLevelBindings } from './basys3ExportModel';

export interface Basys3BundleResult {
  topV: string;
  topVhd: string;
  topXdc: string;
  readme: string;
  warnings: string[];
  valid: boolean;
}

function parsePackagePin(line: string): string | null {
  const match = line.match(/PACKAGE_PIN\s+([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

const XDC_GROUP_ORDER = [
  'Clock',
  'Switches',
  'Buttons',
  'LEDs',
  '7-Segment Cathodes',
  '7-Segment Anodes',
  'Other',
] as const;

function xdcGroupForPort(port: Basys3PortContract): typeof XDC_GROUP_ORDER[number] {
  switch (port.resourceRole) {
    case 'clock': return 'Clock';
    case 'switch_input': return 'Switches';
    case 'button_input': return 'Buttons';
    case 'led_output': return 'LEDs';
    case 'sevenseg_enable_output': return '7-Segment Anodes';
    case 'sevenseg_segment_output':
    case 'sevenseg_dp_output': return '7-Segment Cathodes';
    default: return 'Other';
  }
}

function buildTopXdc(
  contract: Basys3ExportContract,
  warnings: string[],
): string {
  const lines: string[] = [];
  lines.push('# RedByte Basys3 Constraints (deterministic)');
  lines.push(`# Generated for top module: ${contract.entityName}`);
  if (contract.clockPolicy === 'clocked_primary') {
    lines.push('# Timing: Sequential design (clocked) — create_clock constraint generated below.');
  } else if (contract.clockPolicy === 'latch_async') {
    lines.push('# Timing: Sequential design (latch-based) — create_clock intentionally omitted.');
    lines.push('# Vivado timing/power warnings for unconstrained paths are expected and non-blocking.');
  } else {
    lines.push('# Timing: Combinational design — create_clock intentionally omitted.');
    lines.push('# Vivado timing/power warnings for unconstrained paths are expected and non-blocking.');
  }
  lines.push('# CLOCK_BUFFER_TYPE NONE applied to all switch/button ports to prevent synthesis clock-buffer insertion.');
  lines.push('');

  const projectionById = new Map(
    contract.mappingProjection.map((projection) => [projection.logicalSignalId, projection]),
  );
  const groups = new Map<string, Basys3PortContract[]>();
  for (const port of contract.ports) {
    const group = xdcGroupForPort(port);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)?.push(port);
  }

  for (const groupName of XDC_GROUP_ORDER) {
    const entries = groups.get(groupName);
    if (!entries || entries.length === 0) continue;

    lines.push(`## ${groupName}`);
    for (const port of entries) {
      const projection = projectionById.get(port.entryId);
      if (!projection?.packagePin || !projection.exactXdcLine) {
        warnings.push(`Missing pin mapping for ${port.nodeId}.${port.port}`);
        continue;
      }
      lines.push(projection.exactXdcLine);
      lines.push(`set_property IOSTANDARD ${projection.ioStandard} [get_ports {${projection.artifactPortName}}]`);
      // SW/BTN ports can be student-driven event sources, including manual clocks like
      // Lab 8 ENTER, but they are never real FPGA oscillators. Always suppress BUFG
      // inference so Vivado does not invent clock-buffered domains on board controls.
      // This is safe for combinational, latch, and true clocked designs alike.
      if (port.suppressClockBuffer) {
        lines.push(`set_property CLOCK_BUFFER_TYPE NONE [get_ports {${projection.artifactPortName}}]`);
      }
      if (port.timingRole === 'primary_clock') {
        lines.push(
          `create_clock -period 10.000 -name sys_clk -waveform {0.000 5.000} [get_ports {${projection.artifactPortName}}]`,
        );
      }
    }
    lines.push('');
  }

  if (contract.clockPolicy === 'latch_async') {
    const asyncInputPortRefs = Array.from(
      new Set(
        contract.ports
          .filter((port) => port.timingRole === 'false_path_input')
          .map((port) => projectionById.get(port.entryId)?.artifactPortName ?? port.xdcRef)
      )
    );

    if (asyncInputPortRefs.length > 0) {
      lines.push('## Manual switch timing');
      lines.push('# Treat switch/button driven state changes as asynchronous event sources in Vivado timing analysis.');
      lines.push('# Human-speed ENTER/RESET activity should not be timed like an FPGA clock domain.');
      for (const portRef of asyncInputPortRefs) {
        lines.push(`set_false_path -from [get_ports {${portRef}}]`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function buildReadme(
  contract: Basys3ExportContract,
  warnings: string[],
): string {
  const lines: string[] = [];
  lines.push('# RedByte Basys3 Export — Vivado Import Kit');
  lines.push('');
  lines.push('## Contents');
  lines.push('- `top.vhd`: deterministic synthesizable VHDL top module');
  lines.push('- `top.xdc`: Basys3 pin constraints for mapped ports only');
  lines.push('- `vivado_import.tcl`: creates the Vivado project from these sources');
  lines.push('- `testbench.vhd`: simulation source (when verify vectors are present)');
  lines.push('');
  lines.push('## Evidence boundary');
  lines.push('This export is E0 package evidence only.');
  lines.push('It does not prove Vivado build/bitstream success, board programming, or observed hardware behavior.');
  lines.push('Collect E1/E2/E3 evidence separately after running Vivado and checking the physical board.');
  lines.push('');
  lines.push('## Vivado quick steps');
  lines.push('1. Unzip and extract to a short path (e.g. C:\\rb\\) — Vivado warns on paths > 80 chars.');
  lines.push('2. Run from the extracted folder:');
  lines.push('     vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log');
  lines.push('3. Open Vivado → File → Open Project → select the generated .xpr file.');
  lines.push('4. Run Synthesis → Run Implementation → Generate Bitstream.');
  lines.push('5. Open Hardware Manager and program the Basys3.');
  lines.push('');
  lines.push('## Pin map');
  lines.push('| Logical signal | Artifact port | Board resource | Package Pin | Direction |');
  lines.push('| --- | --- | --- | --- | --- |');

  for (const projection of contract.mappingProjection) {
    if (!projection.packagePin) {
      warnings.push(`README pin map omitted invalid mapping: ${projection.logicalSignalId}`);
      continue;
    }
    lines.push(
      `| ${projection.logicalLabel} | ${projection.artifactPortName} | ` +
      `${projection.boardResourceLabel ?? 'Unknown resource'} | ${projection.packagePin} | ` +
      `${projection.direction === 'in' ? 'input' : 'output'} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

function extractVhdlEntityPorts(vhdlText: string): string[] {
  const match = vhdlText.match(/\bPort\s*\(([\s\S]*?)\n\s*\);/i);
  if (!match) return [];
  return match[1]
    .split(';')
    .map((line) => line.trim().split(':')[0]?.trim() ?? '')
    .filter(Boolean);
}

function extractXdcPortNames(xdcText: string): string[] {
  return [...xdcText.matchAll(/\[get_ports\s+\{([^}]+)\}\]/g)].map((match) => match[1].trim());
}

export function exportBasys3Bundle(
  circuit: Circuit,
  ioMapping: IoMapping,
  options?: {
    entityName?: string;
    exportModel?: Basys3ExportModel;
    contract?: Basys3ExportContract;
  },
): Basys3BundleResult {
  const warnings: string[] = [];
  const exportModel = options?.exportModel ?? buildBasys3ExportModel(circuit, ioMapping);
  const entityName = options?.entityName ?? 'top';
  const contract = options?.contract ?? buildExportContract(exportModel, ioMapping, entityName);

  const vhdl = vhdlFromNetlist(exportModel.netlist, {
    entityName,
    topPorts: exportModel.topPorts,
    topInputBindings: exportModel.topInputBindings,
    topOutputBindings: exportModel.topOutputBindings,
  });

  warnings.push(...vhdl.warnings);

  // TODO(slice4-migration): replace this legacy raw-circuit Verilog path with an
  // export-model-backed adapter so top.v no longer has its own structural authority.
  const verilog = circuitToVerilog(toCircuitV1(circuit), ioMapping, {
    moduleName: entityName,
    targetBoard: 'basys3',
  });
  if (verilog.unsupportedNodes.length > 0) {
    warnings.push(...verilog.unsupportedNodes.map((node) => `Unsupported node: ${node}`));
  }
  warnings.push(...verilog.warnings);

  const topXdc = buildTopXdc(contract, warnings);
  const lint = lintBasys3ProjectPorts(
    {
      sources: [{ path: 'top.v', language: 'verilog', text: verilog.verilog }],
      top: entityName,
    },
    topXdc,
  );

  const hasVectorTopPorts = exportModel.topPorts.some((port) =>
    /STD_LOGIC_VECTOR/i.test(port.vhdlType ?? '')
  );
  if (!hasVectorTopPorts) {
    // Legacy raw-Verilog lint remains advisory only. The real student handoff is
    // top.vhd + top.xdc, so bundle validity is decided by the canonical VHDL/XDC
    // contract below, not by this older structural cross-check.
    if (!lint.verilogModuleFound) {
      warnings.push('top module not found in generated verilog');
    }
    // The raw-Verilog port cross-check compared node ids (ld0_node_in) against
    // artifact ports (LD0_CARRY) — two namespaces that never match under the
    // canonical naming — so it reported two false mismatches on every scalar
    // starter. Port parity is decided by the VHDL/XDC contract below.
  }

  const xdcPinWarnings = topXdc
    .split('\n')
    .map((line) => parsePackagePin(line))
    .filter((pin): pin is string => Boolean(pin))
    .filter((pin) => !BASYS3_ALLOWED_PACKAGE_PINS.has(pin))
    .map((pin) => `Unknown Basys3 package pin in XDC: ${pin}`);
  warnings.push(...xdcPinWarnings);

  const vhdlEntityPorts = new Set(extractVhdlEntityPorts(vhdl.vhd));
  const xdcPortRefs = extractXdcPortNames(topXdc).filter((port) => !port.startsWith('sys_clk'));
  const xdcBaseNames = new Set(xdcPortRefs.map((port) => port.replace(/\[\d+\]$/, '')));
  const vhdlXdcMismatches: string[] = [];
  for (const port of vhdlEntityPorts) {
    if (!xdcBaseNames.has(port)) {
      vhdlXdcMismatches.push(`VHDL entity port "${port}" has no XDC constraint`);
    }
  }
  for (const port of xdcPortRefs) {
    const base = port.replace(/\[\d+\]$/, '');
    if (!vhdlEntityPorts.has(base)) {
      vhdlXdcMismatches.push(`XDC get_ports "${port}" not found in VHDL entity`);
    }
  }
  warnings.push(...vhdlXdcMismatches);

  const readme = buildReadme(contract, warnings);
  const uniqueWarnings = Array.from(new Set(warnings)).sort((left, right) =>
    compareCodepoint(left, right),
  );

  const valid =
    xdcPinWarnings.length === 0 &&
    verilog.unsupportedNodes.length === 0 &&
    vhdlXdcMismatches.length === 0 &&
    exportModel.blockingDiagnostics.length === 0;

  return {
    topV: verilog.verilog,
    topVhd: vhdl.vhd,
    topXdc,
    readme,
    warnings: uniqueWarnings,
    valid,
  };
}
