import type { Circuit } from '@redbyte/rb-logic-core';
import { toCircuitV1 } from '@redbyte/rb-logic-core';
import { circuitToVerilog } from '@redbyte/rb-fpga-toolchain';
import type { IoMapping, IoMappingEntry } from '@redbyte/rb-utils';
import { compareCodepoint } from '../../../export/codepointSort';
import type { Netlist } from '../../../export/netlistExport';
import { vhdlFromNetlist } from '../../../export/vhdlExport';
import {
  BASYS3_ALLOWED_PACKAGE_PINS,
  BASYS3_ANODE_PINS,
  BASYS3_BUTTON_PINS,
  BASYS3_CLOCK_PIN,
  BASYS3_DP_PIN,
  BASYS3_LED_PINS,
  BASYS3_SEGMENT_PINS,
  BASYS3_SWITCH_PINS,
  resolveBasys3PackagePin,
} from './basys3Pins';
import { buildBasys3ExportModel } from './basys3ExportModel';
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

function sanitizeIdentifier(name: string): string {
  const normalized = name
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (normalized.length === 0) return '';
  if (/^[A-Za-z]/.test(normalized)) return normalized;
  return `sig_${normalized}`;
}

function mappingKey(entry: IoMappingEntry): string {
  return `${entry.nodeId}.${entry.port}.${entry.id}`;
}

function stableSortMapping(entries: IoMappingEntry[]): IoMappingEntry[] {
  return [...entries].sort((left, right) => compareCodepoint(mappingKey(left), mappingKey(right)));
}

function parsePackagePin(line: string): string | null {
  const match = line.match(/PACKAGE_PIN\s+([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

function toSignalName(entry: IoMappingEntry): string {
  if (entry.label?.trim()) {
    const sanitizedLabel = sanitizeIdentifier(entry.label.trim());
    if (sanitizedLabel.length > 0) return sanitizedLabel;
  }
  return sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
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

const BASYS3_SWITCH_PIN_SET = new Set<string>(BASYS3_SWITCH_PINS);
const BASYS3_BUTTON_PIN_SET = new Set<string>(BASYS3_BUTTON_PINS);
const BASYS3_LED_PIN_SET = new Set<string>(BASYS3_LED_PINS);
const BASYS3_SEGMENT_PIN_SET = new Set<string>(BASYS3_SEGMENT_PINS);
const BASYS3_ANODE_PIN_SET = new Set<string>(BASYS3_ANODE_PINS);

function detectSignalGroup(entry: IoMappingEntry): string {
  const packagePin = resolveBasys3PackagePin(entry.pin ?? '');
  if (!packagePin) return 'Other';
  if (packagePin === BASYS3_CLOCK_PIN) return 'Clock';
  if (BASYS3_SWITCH_PIN_SET.has(packagePin)) return 'Switches';
  if (BASYS3_BUTTON_PIN_SET.has(packagePin)) return 'Buttons';
  if (BASYS3_LED_PIN_SET.has(packagePin)) return 'LEDs';
  if (BASYS3_ANODE_PIN_SET.has(packagePin)) return '7-Segment Anodes';
  if (packagePin === BASYS3_DP_PIN || BASYS3_SEGMENT_PIN_SET.has(packagePin)) return '7-Segment Cathodes';
  return 'Other';
}

const STATEFUL_NODE_TYPES = new Set(['DLatch', 'DFlipFlop', 'TFlipFlop', 'JKFlipFlop']);

function hasStatefulNodes(netlist: Netlist): boolean {
  return netlist.nodes.some((node) => STATEFUL_NODE_TYPES.has(node.type));
}

function hasClockInput(ioMapping: IoMapping): boolean {
  return ioMapping.inputs.some((entry) => {
    const alias = (entry.pin ?? '').toUpperCase().trim();
    return alias === 'CLK' || alias === 'CLK100MHZ' || alias === 'W5';
  });
}

type DesignClassification = 'sequential-clocked' | 'sequential-latch' | 'combinational';

function classifyDesign(ioMapping: IoMapping, netlist: Netlist): DesignClassification {
  if (hasClockInput(ioMapping)) return 'sequential-clocked';
  if (hasStatefulNodes(netlist)) return 'sequential-latch';
  return 'combinational';
}

function buildTopXdc(
  ioMapping: IoMapping,
  warnings: string[],
  portRefMap: Map<string, string> | null,
  classification: DesignClassification,
): string {
  const lines: string[] = [];
  lines.push('# RedByte Basys3 Constraints (deterministic)');
  lines.push('# Generated for top module: top');
  if (classification === 'sequential-clocked') {
    lines.push('# Timing: Sequential design (clocked) — create_clock constraint generated below.');
  } else if (classification === 'sequential-latch') {
    lines.push('# Timing: Sequential design (latch-based) — create_clock intentionally omitted.');
    lines.push('# Vivado timing/power warnings for unconstrained paths are expected and non-blocking.');
  } else {
    lines.push('# Timing: Combinational design — create_clock intentionally omitted.');
    lines.push('# Vivado timing/power warnings for unconstrained paths are expected and non-blocking.');
  }
  lines.push('# CLOCK_BUFFER_TYPE NONE applied to all switch/button ports to prevent synthesis clock-buffer insertion.');
  lines.push('');

  type TaggedEntry = { entry: IoMappingEntry; dir: 'in' | 'out' };

  const allEntries: TaggedEntry[] = [
    ...stableSortMapping(ioMapping.inputs).map((entry) => ({ entry, dir: 'in' as const })),
    ...stableSortMapping(ioMapping.outputs).map((entry) => ({ entry, dir: 'out' as const })),
  ];

  const groups = new Map<string, TaggedEntry[]>();
  for (const tagged of allEntries) {
    const group = detectSignalGroup(tagged.entry);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)?.push(tagged);
  }

  for (const groupName of XDC_GROUP_ORDER) {
    const entries = groups.get(groupName);
    if (!entries || entries.length === 0) continue;

    lines.push(`## ${groupName}`);
    const isNonClockInputGroup = groupName === 'Switches' || groupName === 'Buttons';
    for (const { entry, dir } of entries) {
      if (!entry.pin) {
        warnings.push(`Missing pin mapping for ${entry.nodeId}.${entry.port}`);
        continue;
      }
      const packagePin = resolveBasys3PackagePin(entry.pin);
      if (!packagePin) {
        warnings.push(`Unsupported Basys3 pin alias for ${entry.nodeId}.${entry.port}: ${entry.pin}`);
        continue;
      }
      const portRef = portRefMap?.get(entry.id) ?? toSignalName(entry);
      lines.push(`set_property PACKAGE_PIN ${packagePin} [get_ports {${portRef}}]`);
      lines.push(`set_property IOSTANDARD LVCMOS33 [get_ports {${portRef}}]`);
      // SW/BTN ports can be student-driven event sources, including manual clocks like
      // Lab 8 ENTER, but they are never real FPGA oscillators. Always suppress BUFG
      // inference so Vivado does not invent clock-buffered domains on board controls.
      // This is safe for combinational, latch, and true clocked designs alike.
      if (isNonClockInputGroup && dir === 'in') {
        lines.push(`set_property CLOCK_BUFFER_TYPE NONE [get_ports {${portRef}}]`);
      }
      if (packagePin === 'W5') {
        lines.push(
          `create_clock -period 10.000 -name sys_clk -waveform {0.000 5.000} [get_ports {${portRef}}]`,
        );
      }
    }
    lines.push('');
  }

  if (classification === 'sequential-latch') {
    const asyncInputPortRefs = Array.from(
      new Set(
        allEntries
          .filter(({ entry, dir }) => {
            if (dir !== 'in') return false;
            const group = detectSignalGroup(entry);
            return group === 'Switches' || group === 'Buttons';
          })
          .map(({ entry }) => portRefMap?.get(entry.id) ?? toSignalName(entry))
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
  ioMapping: IoMapping,
  warnings: string[],
  portRefMap: Map<string, string> | null,
): string {
  const sortedInputs = stableSortMapping(ioMapping.inputs);
  const sortedOutputs = stableSortMapping(ioMapping.outputs);

  const lines: string[] = [];
  lines.push('# RedByte Basys3 Export — Vivado Import Kit');
  lines.push('');
  lines.push('## Contents');
  lines.push('- `top.vhd`: deterministic synthesizable VHDL top module');
  lines.push('- `top.xdc`: Basys3 pin constraints for mapped ports only');
  lines.push('- `vivado_import.tcl`: creates the Vivado project from these sources');
  lines.push('- `testbench.vhd`: simulation source (when verify vectors are present)');
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
  lines.push('| Signal | Alias | Package Pin | Direction |');
  lines.push('| --- | --- | --- | --- |');

  for (const entry of sortedInputs) {
    const packagePin = entry.pin ? resolveBasys3PackagePin(entry.pin) : null;
    if (!packagePin) {
      warnings.push(`README pin map omitted invalid input pin alias: ${entry.nodeId}.${entry.port}`);
      continue;
    }
    const portRef = portRefMap?.get(entry.id) ?? toSignalName(entry);
    lines.push(`| ${portRef} | ${entry.pin} | ${packagePin} | input |`);
  }

  for (const entry of sortedOutputs) {
    const packagePin = entry.pin ? resolveBasys3PackagePin(entry.pin) : null;
    if (!packagePin) {
      warnings.push(`README pin map omitted invalid output pin alias: ${entry.nodeId}.${entry.port}`);
      continue;
    }
    const portRef = portRefMap?.get(entry.id) ?? toSignalName(entry);
    lines.push(`| ${portRef} | ${entry.pin} | ${packagePin} | output |`);
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
  options?: { entityName?: string },
): Basys3BundleResult {
  const warnings: string[] = [];
  const exportModel = buildBasys3ExportModel(circuit, ioMapping);
  const entityName = options?.entityName ?? 'top';

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

  const xdcPortRefMap = new Map<string, string>();
  for (const ref of [...exportModel.inputRefs, ...exportModel.outputRefs]) {
    xdcPortRefMap.set(ref.entryId, ref.xdcRef);
  }

  const classification = classifyDesign(ioMapping, exportModel.netlist);
  const topXdc = buildTopXdc(ioMapping, warnings, xdcPortRefMap, classification);
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
    if (!lint.verilogModuleFound) {
      warnings.push('top module not found in generated verilog');
    }
    if (lint.missingInHdl.length > 0) {
      warnings.push(`XDC ports missing in HDL: ${lint.missingInHdl.join(', ')}`);
    }
    if (lint.missingInXdc.length > 0) {
      warnings.push(`HDL ports missing in XDC: ${lint.missingInXdc.join(', ')}`);
    }
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

  const readme = buildReadme(ioMapping, warnings, xdcPortRefMap);
  const uniqueWarnings = Array.from(new Set(warnings)).sort((left, right) =>
    compareCodepoint(left, right),
  );

  const valid = hasVectorTopPorts
    ? xdcPinWarnings.length === 0 &&
      vhdlXdcMismatches.length === 0 &&
      exportModel.blockingDiagnostics.length === 0
    : lint.verilogModuleFound &&
      lint.missingInHdl.length === 0 &&
      lint.missingInXdc.length === 0 &&
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
