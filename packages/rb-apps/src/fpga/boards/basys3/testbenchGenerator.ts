import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../../export/projectFormat';
import { compareCodepoint } from '../../../export/codepointSort';
import {
  CLOCKED_MACRO_SEQUENCE,
  deriveVerifySchedule,
  type VerifySchedule,
} from './verifySchedule';

interface SignalCatalog {
  inputs: string[];
  outputs: string[];
  clock?: string;
    /** Maps logical signal names (vector keys, node labels) → canonical entity port names */
    logicalToCanonical: Map<string, string>;
}

interface TestbenchGenerationOptions {
  scheduleOverride?: {
    schedule: VerifySchedule;
    reason?: string;
    clockSignalName?: string;
  };
}

export function generateTestbenchVhdl(
  project: RBProject,
  vectors: TestVector[],
  options?: TestbenchGenerationOptions
): string {
  const derivedSchedule = deriveVerifySchedule(project.circuit, project.ioMapping, project.hdl);
  const scheduleContract =
    options?.scheduleOverride
      ? {
          ...derivedSchedule,
          schedule: options.scheduleOverride.schedule,
          reason: options.scheduleOverride.reason ?? derivedSchedule.reason,
          clockSignalName:
            options.scheduleOverride.clockSignalName ?? derivedSchedule.clockSignalName,
        }
      : derivedSchedule;
  const signalCatalog = collectSignals(project, vectors, scheduleContract.schedule, scheduleContract.clockSignalName);
  const topModule = (project.fpga?.top || project.hdl?.top || 'top').trim() || 'top';

  const vhdlNameByLogical = buildNameMap([
    ...signalCatalog.inputs,
    ...signalCatalog.outputs,
    ...(signalCatalog.clock ? [signalCatalog.clock] : []),
  ]);

    // Extend the name map with logical → canonical aliases so that test vector
    // keys like 'SW0' resolve to the same VHDL identifier as the canonical
    // port name 'sw0_node_out' that appears in the component declaration.
    for (const [logical, canonical] of signalCatalog.logicalToCanonical) {
      if (!vhdlNameByLogical.has(logical)) {
        const vhdlCanonical = vhdlNameByLogical.get(canonical);
        if (vhdlCanonical) {
          vhdlNameByLogical.set(logical, vhdlCanonical);
        }
      }
    }

  const declaredInputs = signalCatalog.clock
    ? uniqueSorted([signalCatalog.clock, ...signalCatalog.inputs])
    : signalCatalog.inputs;
  const declaredOutputs = signalCatalog.outputs;

  const componentPorts = [
    ...declaredInputs.map((name) => `      ${vhdlNameByLogical.get(name)} : in  std_logic`),
    ...declaredOutputs.map((name) => `      ${vhdlNameByLogical.get(name)} : out std_logic`),
  ].join(';\n');

  const signalDecls = [
    ...declaredInputs.map((name) => `  signal ${vhdlNameByLogical.get(name)} : std_logic := '0';`),
    ...declaredOutputs.map((name) => `  signal ${vhdlNameByLogical.get(name)} : std_logic;`),
    ...(scheduleContract.schedule === 'clocked_macro' ? ["  constant CLK_HALF_PERIOD : time := 5 ns;"] : []),
  ].join('\n');

  const portMapEntries = [
    ...declaredInputs.map((name) => `      ${vhdlNameByLogical.get(name)} => ${vhdlNameByLogical.get(name)}`),
    ...declaredOutputs.map((name) => `      ${vhdlNameByLogical.get(name)} => ${vhdlNameByLogical.get(name)}`),
  ].join(',\n');

  const stimulus = generateStimulus(vectors, scheduleContract.schedule, signalCatalog.clock, vhdlNameByLogical);

  return `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity tb_${toVhdlIdentifier(topModule)} is
end entity tb_${toVhdlIdentifier(topModule)};

architecture sim of tb_${toVhdlIdentifier(topModule)} is
  component ${toVhdlIdentifier(topModule)} is
    port (
${componentPorts}
    );
  end component;

${signalDecls}
begin
  -- Deterministic schedule contract with Verify runner:
  -- schedule=${scheduleContract.schedule}
  -- reason=${scheduleContract.reason}
  -- sequence=${scheduleContract.schedule === 'clocked_macro' ? CLOCKED_MACRO_SEQUENCE.join('->') : 'single-tick'}
  dut: ${toVhdlIdentifier(topModule)}
    port map (
${portMapEntries}
    );

  stim: process
  begin
${stimulus}
    wait;
  end process;
end architecture sim;
`;
}

function generateStimulus(
  vectors: TestVector[],
  schedule: 'combinational' | 'clocked_macro',
  clockSignal: string | undefined,
  nameMap: Map<string, string>
): string {
  const lines: string[] = [];
  const safeClock = clockSignal ? nameMap.get(clockSignal) : undefined;

  vectors.forEach((vector, index) => {
    lines.push(`    -- Vector ${index} (tick=${vector.tick})`);

    for (const inputName of uniqueSorted(Object.keys(vector.inputs))) {
      if (safeClock && nameMap.get(inputName) === safeClock) continue;
      const signalName = nameMap.get(inputName);
      if (!signalName) continue;
      lines.push(`    ${signalName} <= ${toBitLiteral(vector.inputs[inputName])};`);
    }

    if (schedule === 'clocked_macro' && safeClock) {
      for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
        lines.push(`    ${safeClock} <= '${clockValue}';`);
        lines.push('    wait for CLK_HALF_PERIOD;');
      }
      lines.push('    wait for 0 ns;');
    } else {
      lines.push('    wait for 0 ns;');
    }

    for (const expectedName of uniqueSorted(Object.keys(vector.expected ?? {}))) {
      const signalName = nameMap.get(expectedName);
      if (!signalName) continue;
      const expectedLiteral = toBitLiteral(vector.expected[expectedName]);
      lines.push(`    assert ${signalName} = ${expectedLiteral}`);
      lines.push(
        `      report "Vector ${index} failed on ${signalName}: expected ${expectedLiteral}, got " & std_logic'image(${signalName})`
      );
      lines.push('      severity error;');
    }

    lines.push('');
  });

  return lines.join('\n');
}

function collectSignals(
  project: RBProject,
  vectors: TestVector[],
  schedule: 'combinational' | 'clocked_macro',
  scheduleClockHint?: string
): SignalCatalog {
  const inputNames = new Set<string>();
  const outputNames = new Set<string>();

    // Build canonical name map: logical name (vector key, node label) → canonical entity port name.
    // Canonical names use the same nodeId_port scheme as buildVhdlTopLevelBindings / toSignalName,
    // ensuring testbench component ports match entity ports exactly.
    const logicalToCanonical = new Map<string, string>();

    const hasIoMapping =
      (project.ioMapping?.inputs?.length ?? 0) > 0 ||
      (project.ioMapping?.outputs?.length ?? 0) > 0;

    if (hasIoMapping) {
      // Derive canonical port names from ioMapping (same scheme as basys3Bundle.toSignalName).
      for (const entry of project.ioMapping?.inputs ?? []) {
        const canonical = toVhdlIdentifier(`${entry.nodeId}_${entry.port}`);
        inputNames.add(canonical);
        logicalToCanonical.set(canonical, canonical);
        if (entry.label) logicalToCanonical.set(entry.label.trim(), canonical);
        // Map node label (e.g. 'SW0') → canonical (e.g. 'sw0_node_out')
        const node = (project.circuit.nodes ?? []).find((n) => n.id === entry.nodeId);
        if (node?.label) logicalToCanonical.set(node.label.trim(), canonical);
      }
      for (const entry of project.ioMapping?.outputs ?? []) {
        const canonical = toVhdlIdentifier(`${entry.nodeId}_${entry.port}`);
        outputNames.add(canonical);
        logicalToCanonical.set(canonical, canonical);
        if (entry.label) logicalToCanonical.set(entry.label.trim(), canonical);
        const node = (project.circuit.nodes ?? []).find((n) => n.id === entry.nodeId);
        if (node?.label) logicalToCanonical.set(node.label.trim(), canonical);
      }
    } else {
      // Legacy fallback: no ioMapping — derive from circuit node labels directly.
      for (const node of project.circuit.nodes ?? []) {
        const label = (node.label || node.id || '').trim();
        if (!label) continue;
        if (node.type === 'Switch' || node.type === 'InputPin' || node.type === 'INPUT' || node.type === 'Clock') {
          inputNames.add(label);
          logicalToCanonical.set(label, label);
        } else if (node.type === 'Lamp' || node.type === 'OUTPUT') {
          outputNames.add(label);
          logicalToCanonical.set(label, label);
        }
      }
    }

    // Translate test vector keys through the canonical map.
    // If a key maps to a canonical name (e.g. 'SW0' → 'sw0_node_out'), use the canonical name.
    // Otherwise keep the key as-is (allows freeform vector-only testbenches).
    for (const vector of vectors) {
      for (const key of Object.keys(vector.inputs ?? {})) {
        const resolved = logicalToCanonical.get(key.trim()) ?? key.trim();
        if (!outputNames.has(resolved)) inputNames.add(resolved);
        logicalToCanonical.set(key.trim(), resolved);
      }
      for (const key of Object.keys(vector.expected ?? {})) {
        const resolved = logicalToCanonical.get(key.trim()) ?? key.trim();
        outputNames.add(resolved);
        logicalToCanonical.set(key.trim(), resolved);
      }
    }

    let clock: string | undefined;
  if (schedule === 'clocked_macro') {
    if (scheduleClockHint && scheduleClockHint.trim().length > 0) {
        clock = logicalToCanonical.get(scheduleClockHint.trim()) ?? scheduleClockHint.trim();
      inputNames.add(clock);
    } else if (inputNames.has('clk')) {
      clock = 'clk';
    } else if (inputNames.has('CLK100MHZ')) {
      clock = 'CLK100MHZ';
    } else {
      clock = '__sim_clk__';
      inputNames.add(clock);
    }
  }

  const inputs = uniqueSorted(Array.from(inputNames).filter((name) => !outputNames.has(name)));
  const outputs = uniqueSorted(Array.from(outputNames));

    return { inputs, outputs, clock, logicalToCanonical };
}

function buildNameMap(logicalNames: string[]): Map<string, string> {
  const nameMap = new Map<string, string>();
  const used = new Set<string>();

  for (const logicalName of uniqueSorted(logicalNames)) {
    const base = toVhdlIdentifier(logicalName);
    let candidate = base;
    let suffix = 1;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    nameMap.set(logicalName, candidate);
  }

  return nameMap;
}

function toVhdlIdentifier(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!cleaned) return 'sig';
  if (/^[0-9]/.test(cleaned)) return `_${cleaned}`;
  return cleaned;
}

function toBitLiteral(value: unknown): "'0'" | "'1'" {
  if (value === true) return "'1'";
  if (value === false) return "'0'";
  if (typeof value === 'number') return value === 0 ? "'0'" : "'1'";
  return "'0'";
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => compareCodepoint(left, right));
}
