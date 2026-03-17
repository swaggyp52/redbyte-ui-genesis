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
  if (entry.label?.trim()) return sanitizeIdentifier(entry.label.trim());
  return sanitizeIdentifier(`${entry.nodeId}_${entry.port}`);
}

/**
 * Normalize a label prefix to the Basys3 canonical port base name.
 * 'SW', 'SWITCH' → 'SW'; 'LED', 'LAMP' → 'LED'; others upper-cased.
 */
function normalizePortBase(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper === 'SW' || upper === 'SWITCH') return 'SW';
  if (upper === 'LED' || upper === 'LAMP') return 'LED';
  return upper;
}

/**
 * Build a map of entryId → XDC port reference string, mirroring buildPortGroups() in vhdlExport.ts.
 *
 * Input entries default to 'SW' group; output entries default to 'LED' group when unlabeled.
 * Labeled entries (SW[0], LED[1]) are grouped by prefix and emitted as vector bit refs.
 * Unlabeled entries without a clear prefix fall back to individual nodeId_port names.
 *
 * Returns Map<entryId, xdcPortRef> e.g. 'sw0-id' → 'SW[0]', 'led0-id' → 'LED[0]'.
 */
function buildXdcPortRefMap(
  inputs: IoMappingEntry[],
  outputs: IoMappingEntry[],
): Map<string, string> {
  function processGroup(entries: IoMappingEntry[], defaultBase: string): Map<string, string> {
    const prefixGroups = new Map<string, IoMappingEntry[]>();
    const listIndexByPrefix = new Map<string, number>();

    for (const entry of entries) {
      const label = entry.label?.trim();
      let prefix: string;
      if (label) {
        const match = label.match(/^([A-Za-z_]+)/);
        prefix = match ? normalizePortBase(match[1]) : sanitizeIdentifier(label);
      } else {
        // No label → use defaultBase ('SW' or 'LED') to match buildPortGroups behaviour
        prefix = defaultBase;
      }
      if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
      prefixGroups.get(prefix)!.push(entry);
    }

    const result = new Map<string, string>();
    for (const [prefix, groupEntries] of prefixGroups) {
      const bits = groupEntries.map((e) => {
        const m = (e.label ?? '').match(/\[(\d+)\]/);
        return m ? parseInt(m[1], 10) : -1;
      });
      const maxExplicitBit = Math.max(...bits.filter((b) => b >= 0), -1);
      const isVector = maxExplicitBit > 0 || groupEntries.length > 1;

      listIndexByPrefix.set(prefix, 0);
      for (const entry of groupEntries) {
        const bitMatch = (entry.label ?? '').match(/\[(\d+)\]/);
        const listIdx = listIndexByPrefix.get(prefix) ?? 0;
        listIndexByPrefix.set(prefix, listIdx + 1);
        const bitIndex = bitMatch ? parseInt(bitMatch[1], 10) : listIdx;
        result.set(entry.id, isVector ? `${prefix}[${bitIndex}]` : prefix);
      }
    }
    return result;
  }

  const result = new Map<string, string>();
  processGroup(inputs, 'SW').forEach((v, k) => result.set(k, v));
  processGroup(outputs, 'LED').forEach((v, k) => result.set(k, v));
  return result;
}

/** True when the circuit has at least one first-class IO node (Switch, Lamp, etc.). */
function circuitHasIoNodes(circuit: { nodes?: Array<{ type: string }> }): boolean {
  return (circuit.nodes ?? []).some((n) =>
    ['INPUT', 'OUTPUT', 'Switch', 'Lamp', 'Button', 'Clock', 'CLOCK'].includes(n.type),
  );
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

function detectSignalGroup(entry: IoMappingEntry): string {
  const alias = (entry.pin ?? '').toUpperCase().trim();
  if (!alias) return 'Other';
  if (alias === 'CLK' || alias === 'CLK100MHZ' || alias === 'W5') return 'Clock';
  if (alias.startsWith('SW')) return 'Switches';
  if (alias.startsWith('BTN')) return 'Buttons';
  if (alias.startsWith('LD') || alias.startsWith('LED')) return 'LEDs';
  if (alias.startsWith('AN')) return '7-Segment Anodes';
  if (
    alias.startsWith('SEG') ||
    alias === 'DP' ||
    (alias.length === 2 && alias[0] === 'C' && 'ABCDEFG'.includes(alias[1] ?? ''))
  )
    return '7-Segment Cathodes';
  return 'Other';
}

function buildTopXdc(
  ioMapping: IoMapping,
  warnings: string[],
  portRefMap: Map<string, string> | null,
): string {
  const lines: string[] = [];
  lines.push('# RedByte Basys3 Constraints (deterministic)');
  lines.push('# Generated for top module: top');
  lines.push('');

  type TaggedEntry = { entry: IoMappingEntry; dir: 'in' | 'out' };

  const allEntries: TaggedEntry[] = [
    ...stableSortMapping(ioMapping.inputs).map((e) => ({ entry: e, dir: 'in' as const })),
    ...stableSortMapping(ioMapping.outputs).map((e) => ({ entry: e, dir: 'out' as const })),
  ];

  const groups = new Map<string, TaggedEntry[]>();
  for (const tagged of allEntries) {
    const group = detectSignalGroup(tagged.entry);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(tagged);
  }

  for (const groupName of XDC_GROUP_ORDER) {
    const entries = groups.get(groupName);
    if (!entries || entries.length === 0) continue;

    lines.push(`## ${groupName}`);
    for (const { entry } of entries) {
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
      // Two-line format matching Basys3 master XDC reference standard
      lines.push(`set_property PACKAGE_PIN ${packagePin} [get_ports {${portRef}}]`);
      lines.push(`set_property IOSTANDARD LVCMOS33 [get_ports {${portRef}}]`);
      // Basys3 onboard 100 MHz oscillator is on W5 — emit timing constraint.
      if (packagePin === 'W5') {
        lines.push(
          `create_clock -period 10.000 -name sys_clk -waveform {0.000 5.000} [get_ports {${portRef}}]`,
        );
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function buildReadme(
  ioMapping: IoMapping,
  warnings: string[],
  portRefMap: Map<string, string> | null,
): string {
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

  // For circuits with first-class IO nodes (Switch/Lamp), let buildPortGroups in
  // vhdlFromNetlist produce SW/LED vector ports matching the swaggy.zip standard.
  // For degenerate circuits (only logic-gate ports in ioMapping), fall back to
  // explicit topPorts so the entity still has declared ports.
  const useVectorPorts = circuitHasIoNodes(circuit);
  const { topPorts, topInputBindings, topOutputBindings } = buildVhdlTopLevelBindings(ioMapping);
  const vhdl = vhdlFromNetlist(netlist, {
    entityName: options?.entityName ?? 'top',
    ...(useVectorPorts ? {} : { topPorts, topInputBindings, topOutputBindings }),
  });

  warnings.push(...vhdl.warnings);

    // ---------------------------------------------------------------------------
    // VHDL entity port extraction (used for pre-ZIP parity check)
    // ---------------------------------------------------------------------------

    function extractVhdlEntityPorts(vhdlText: string): string[] {
      // Use a Port-block end marker (own line with ');') to avoid truncation on nested
      // parentheses inside vector types like STD_LOGIC_VECTOR(N downto 0).
      const match = vhdlText.match(/\bPort\s*\(([\s\S]*?)\n\s*\);/i);
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

  // Build XDC port ref map only for vector-port circuits (SW/LED style).
  // For degenerate circuits (topPorts fallback), null → uses toSignalName instead.
  const xdcPortRefMap = useVectorPorts
    ? buildXdcPortRefMap(
        stableSortMapping(ioMapping.inputs),
        stableSortMapping(ioMapping.outputs),
      )
    : null;

  const topXdc = buildTopXdc(ioMapping, warnings, xdcPortRefMap);
  const lint = lintBasys3ProjectPorts(
    {
      sources: [{ path: 'top.v', language: 'verilog', text: verilog.verilog }],
      top: options?.entityName ?? 'top',
    },
    topXdc
  );

  // When using vector VHDL ports, the verilog generator uses individual names that
  // diverge from the vector XDC refs by design — suppress misleading lint warnings.
  if (!useVectorPorts) {
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

    // ---- VHDL entity port vs XDC port parity check ---------------------------
    // For vector ports: XDC uses SW[0], SW[1] but VHDL entity declares SW.
    // Strip [N] from XDC refs to get base port name for comparison.
    const vhdlEntityPorts = new Set(extractVhdlEntityPorts(vhdl.vhd));
    const xdcPortRefs = extractXdcPortNames(topXdc).filter(
      // Exclude create_clock port ref (it's a timing constraint, not a port)
      (p) => !p.startsWith('sys_clk'),
    );
    // Map each XDC port ref to its base entity port name (strip [N] suffix)
    const xdcBaseNames = new Set(xdcPortRefs.map((p) => p.replace(/\[\d+\]$/, '')));
    const vhdlXdcMismatches: string[] = [];
    for (const p of vhdlEntityPorts) {
      if (!xdcBaseNames.has(p)) {
        vhdlXdcMismatches.push(`VHDL entity port "${p}" has no XDC constraint`);
      }
    }
    for (const p of xdcPortRefs) {
      const base = p.replace(/\[\d+\]$/, '');
      if (!vhdlEntityPorts.has(base)) {
        vhdlXdcMismatches.push(`XDC get_ports "${p}" not found in VHDL entity`);
      }
    }
    warnings.push(...vhdlXdcMismatches);

  const readme = buildReadme(ioMapping, warnings, xdcPortRefMap);
  const uniqueWarnings = Array.from(new Set(warnings)).sort((a, b) => compareCodepoint(a, b));

  // When using vector VHDL ports (SW/LED style), verilog lint diverges by design —
  // skip verilog-based checks; validity is proven by the VHDL-vs-XDC parity check.
  const valid = useVectorPorts
    ? xdcPinWarnings.length === 0 && vhdlXdcMismatches.length === 0
    : lint.verilogModuleFound &&
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
