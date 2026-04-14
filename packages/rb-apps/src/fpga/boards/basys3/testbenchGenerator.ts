import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../../export/projectFormat';
import { compareCodepoint } from '../../../export/codepointSort';
import { exportBasys3Bundle } from './basys3Bundle';
import {
  BASYS3_CLOCK_PIN,
  BASYS3_LED_PINS,
  BASYS3_SWITCH_PINS,
  resolveBasys3PackagePin,
} from './basys3Pins';
import {
  CLOCKED_MACRO_SEQUENCE,
  deriveVerifySchedule,
  type VerifyScheduleContract,
  type VerifySchedule,
} from './verifySchedule';
import { buildTopLevelBindingRefs } from './basys3ExportModel';

interface SignalCatalog {
  inputs: string[];
  outputs: string[];
  clock?: string;
    /** Maps logical signal names (vector keys, node labels) → canonical entity port names */
    logicalToCanonical: Map<string, string>;
}

interface TestbenchGenerationOptions {
  scheduleOverride?: Partial<VerifyScheduleContract> & Pick<VerifyScheduleContract, 'schedule'>;
  /**
   * When provided, component ports + signal declarations are derived directly from
   * the entity declaration in this VHDL text, guaranteeing testbench/entity consistency.
   * Vector types (STD_LOGIC_VECTOR) are preserved; stimulus uses bit-indexed references.
   */
  entityVhd?: string;
}

// ---------------------------------------------------------------------------
// Entity-based port extraction (used when entityVhd option is provided)
// ---------------------------------------------------------------------------

interface EntityPortInfo {
  name: string;
  direction: 'in' | 'out';
  /** Type as written in entity, lowercased */
  typeDecl: string;
  isVector: boolean;
  /** Bit width (e.g. 2 for VECTOR(1 downto 0)); undefined for scalars */
  vectorWidth?: number;
}

function parseEntityPortInfos(topVhd: string): EntityPortInfo[] {
  // Match Port block ending with "  );" on its own line (handles nested parens in vector types)
  const m = topVhd.match(/\bPort\s*\(([\s\S]*?)\n\s*\);/i);
  if (!m) return [];
  const result: EntityPortInfo[] = [];
  for (const entry of m[1].split(';').map((e) => e.trim()).filter(Boolean)) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx < 0) continue;
    const name = entry.slice(0, colonIdx).trim();
    const rest = entry.slice(colonIdx + 1).trim();
    const dirMatch = rest.match(/^(in|out|inout)\s+(.+)$/i);
    if (!dirMatch) continue;
    const dir = dirMatch[1].toLowerCase() as 'in' | 'out';
    const typeDecl = dirMatch[2].trim().toLowerCase();
    const isVector = typeDecl.includes('vector');
    let vectorWidth: number | undefined;
    if (isVector) {
      const wm = typeDecl.match(/\((\d+)\s+downto\s+0\)/);
      vectorWidth = wm ? parseInt(wm[1], 10) + 1 : undefined;
    }
    result.push({ name, direction: dir, typeDecl, isVector, vectorWidth });
  }
  return result;
}

/**
 * Build a mapping from stable IO/vector keys (row ids, node ids, labels, pins) →
 * VHDL port references using the entity declaration as authority.
 *
 * Supports both vector ports (SW0 → SW(0)) and scalar ports (CLK → clk).
 */
function buildLabelToEntityRef(
  project: RBProject,
  entityPorts: EntityPortInfo[],
): Map<string, string> {
  const portsByBase = new Map<string, EntityPortInfo>();
  for (const p of entityPorts) {
    portsByBase.set(p.name.toLowerCase(), p);
  }
  const result = new Map<string, string>();

  const nodeLabelsById = new Map(
    (project.circuit.nodes ?? []).map((node) => [node.id, (node.label ?? '').trim()] as const),
  );
  const ambiguousLabels = new Set<string>();
  const labelCounts = new Map<string, number>();

  const countLabelAlias = (alias: string | undefined) => {
    const trimmed = alias?.trim() ?? '';
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const nextCount = (labelCounts.get(key) ?? 0) + 1;
    labelCounts.set(key, nextCount);
    if (nextCount > 1) {
      ambiguousLabels.add(key);
    }
  };

  const registerAlias = (alias: string | undefined, ref: string, allowAmbiguous = true) => {
    const trimmed = alias?.trim() ?? '';
    if (!trimmed) return;
    if (!allowAmbiguous && ambiguousLabels.has(trimmed.toLowerCase())) return;

    const variants = [trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()];
    for (const variant of variants) {
      const existing = result.get(variant);
      if (!existing || existing === ref) {
        result.set(variant, ref);
      }
    }
  };

  const resolveBasys3AliasFromPin = (pin: string | undefined, direction: 'in' | 'out'): string | undefined => {
    const trimmed = pin?.trim() ?? '';
    if (!trimmed) return undefined;

    const packagePin = resolveBasys3PackagePin(trimmed);
    if (!packagePin) return trimmed;

    if (direction === 'in') {
      if (packagePin === BASYS3_CLOCK_PIN) {
        return 'CLK100MHZ';
      }
      const switchIndex = BASYS3_SWITCH_PINS.indexOf(packagePin as (typeof BASYS3_SWITCH_PINS)[number]);
      if (switchIndex >= 0) {
        return `SW${switchIndex}`;
      }
    }

    if (direction === 'out') {
      const ledIndex = BASYS3_LED_PINS.indexOf(packagePin as (typeof BASYS3_LED_PINS)[number]);
      if (ledIndex >= 0) {
        return `LD${ledIndex}`;
      }
    }

    return trimmed;
  };

  const resolveEntityRef = (candidate: string | undefined): string | undefined => {
    const trimmed = candidate?.trim() ?? '';
    if (!trimmed) return undefined;

    const directPort = portsByBase.get(trimmed.toLowerCase());
    if (directPort) {
      return directPort.name;
    }

    const indexedMatch =
      trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\((\d+)\)$/) ??
      trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]$/) ??
      trimmed.match(/^([A-Za-z_]+)(\d+)$/);
    if (!indexedMatch) return undefined;

    const rawBase = indexedMatch[1] ?? '';
    const normalizedBase = rawBase.toLowerCase() === 'ld' ? 'led' : rawBase.toLowerCase();
    const bitIndex = Number.parseInt(indexedMatch[2] ?? '0', 10);
    const port = portsByBase.get(normalizedBase);
    if (!port) return undefined;
    return port.isVector ? `${port.name}(${bitIndex})` : port.name;
  };

  const allEntries = [
    ...(project.ioMapping?.inputs ?? []).map((entry) => ({ ...entry, direction: 'in' as const })),
    ...(project.ioMapping?.outputs ?? []).map((entry) => ({ ...entry, direction: 'out' as const })),
  ];
  const bindingRefs = project.ioMapping ? buildTopLevelBindingRefs(project.ioMapping) : null;
  const bindingRefByEntryId = new Map(
    [...(bindingRefs?.inputRefs ?? []), ...(bindingRefs?.outputRefs ?? [])].map((ref) => [ref.entryId, ref] as const)
  );

  for (const entry of allEntries) {
    countLabelAlias(entry.label);
    countLabelAlias(nodeLabelsById.get(entry.nodeId ?? ''));
  }

  const processEntries = (
    entries: Array<{ id?: string; nodeId?: string; port?: string; label?: string; pin?: string }>,
    direction: 'in' | 'out',
  ) => {
    for (const entry of entries) {
      const nodeLabel = nodeLabelsById.get(entry.nodeId ?? '');
      const basys3Alias = resolveBasys3AliasFromPin(entry.pin, direction);
      const bindingRef = entry.id ? bindingRefByEntryId.get(entry.id) : undefined;
      const canonicalPortHint = entry.label?.trim()
        ? toVhdlIdentifier(entry.label.trim())
        : toVhdlIdentifier(`${entry.nodeId ?? ''}_${entry.port ?? ''}`);
      const ref =
        resolveEntityRef(bindingRef?.signalRef) ??
        resolveEntityRef(bindingRef?.xdcRef) ??
        resolveEntityRef(bindingRef?.portName) ??
        resolveEntityRef(canonicalPortHint) ??
        resolveEntityRef(basys3Alias) ??
        resolveEntityRef(entry.pin) ??
        resolveEntityRef(entry.label) ??
        resolveEntityRef(nodeLabel);
      if (!ref) continue;

      registerAlias(ref, ref);
      registerAlias(bindingRef?.signalRef, ref);
      registerAlias(bindingRef?.xdcRef, ref);
      registerAlias(bindingRef?.portName, ref);
      registerAlias(canonicalPortHint, ref);
      registerAlias(basys3Alias, ref);
      registerAlias(entry.pin, ref);
      registerAlias(entry.id, ref);
      registerAlias(entry.nodeId, ref);
      registerAlias(toVhdlIdentifier(`${entry.nodeId ?? ''}_${entry.port ?? ''}`), ref);
      registerAlias(entry.label, ref, false);
      registerAlias(nodeLabel, ref, false);
    }
  };

  processEntries(project.ioMapping?.inputs ?? [], 'in');
  processEntries(project.ioMapping?.outputs ?? [], 'out');
  return result;
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
          ...options.scheduleOverride,
        }
      : derivedSchedule;
  const topModule = (project.fpga?.top || project.hdl?.top || 'top').trim() || 'top';
  const resolvedEntityVhd = options?.entityVhd ?? resolveCanonicalEntityVhd(project);

  // Entity-based path: derive component ports directly from the entity VHDL
  // to guarantee testbench/entity consistency. Used when entity uses vector ports.
  if (resolvedEntityVhd) {
    return generateTestbenchFromEntity(
      project,
      vectors,
      resolvedEntityVhd,
      scheduleContract,
      topModule,
    );
  }

  const signalCatalog = collectSignals(project, vectors, scheduleContract.schedule, scheduleContract.clockSignalName);

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

function resolveCanonicalEntityVhd(project: RBProject): string | undefined {
  if (!project.ioMapping) return undefined;
  try {
    return exportBasys3Bundle(project.circuit, project.ioMapping, {
      entityName: project.hdl?.top,
    }).topVhd;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Entity-based testbench generation
// ---------------------------------------------------------------------------

/**
 * Generate a testbench whose component/signal declarations mirror the entity
 * ports extracted from `topVhd`. This guarantees structural consistency with
 * the generated top.vhd regardless of whether it uses vector or scalar ports.
 */
function generateTestbenchFromEntity(
  project: RBProject,
  vectors: TestVector[],
  topVhd: string,
  scheduleContract: ReturnType<typeof deriveVerifySchedule>,
  topModule: string,
): string {
  const entityPorts = parseEntityPortInfos(topVhd);
  const labelToRef = buildLabelToEntityRef(project, entityPorts);

  // Resolve clock signal name if needed
  let clockPortRef: string | undefined;
  if (scheduleContract.schedule === 'clocked_macro') {
    const hint = scheduleContract.clockSignalName?.trim() ?? '';
    if (hint.length > 0) {
      clockPortRef = labelToRef.get(hint) ?? labelToRef.get(hint.toUpperCase()) ?? hint;
    }
    if (!clockPortRef) {
      const clkPort = entityPorts.find(
        (p) => p.direction === 'in' && /clk|clock/i.test(p.name),
      );
      clockPortRef = clkPort?.name;
    }
  }

  const componentPortLines = entityPorts.map(
    (p) => `      ${p.name} : ${p.direction}  ${p.typeDecl}`,
  );
  const componentPorts = componentPortLines.join(';\n');

  const signalDeclLines = entityPorts.map((p) => {
    const init =
      p.direction === 'in'
        ? p.isVector
          ? " := (others => '0')"
          : " := '0'"
        : '';
    return `  signal ${p.name} : ${p.typeDecl}${init};`;
  });
  if (scheduleContract.schedule === 'clocked_macro') {
    signalDeclLines.push('  constant CLK_HALF_PERIOD : time := 5 ns;');
  }
  const signalDecls = signalDeclLines.join('\n');

  const portMapEntries = entityPorts
    .map((p) => `      ${p.name} => ${p.name}`)
    .join(',\n');

  const stimulus = generateEntityStimulus(
    vectors,
    scheduleContract.schedule,
    clockPortRef,
    labelToRef,
    entityPorts,
  );

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

function generateEntityStimulus(
  vectors: TestVector[],
  schedule: 'combinational' | 'clocked_macro',
  clockPortRef: string | undefined,
  labelToRef: Map<string, string>,
  entityPorts: EntityPortInfo[],
): string {
  const outputPortNames = new Set(
    entityPorts.filter((p) => p.direction === 'out').map((p) => p.name.toLowerCase()),
  );
  const lines: string[] = [];

  vectors.forEach((vector, index) => {
    lines.push(`    -- Vector ${index} (tick=${vector.tick})`);

    for (const key of uniqueSorted(Object.keys(vector.inputs))) {
      const ref = labelToRef.get(key) ?? labelToRef.get(key.toUpperCase()) ?? key;
      // Skip clock — handled by clock process below
      if (clockPortRef && ref === clockPortRef) continue;
      lines.push(`    ${ref} <= ${toBitLiteral(vector.inputs[key])};`);
    }

    if (schedule === 'clocked_macro' && clockPortRef) {
      for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
        lines.push(`    ${clockPortRef} <= '${clockValue}';`);
        lines.push('    wait for CLK_HALF_PERIOD;');
      }
      lines.push('    wait for 0 ns;');
    } else {
      lines.push('    wait for 10 ns;');
    }

    for (const expectedKey of uniqueSorted(Object.keys(vector.expected ?? {}))) {
      const ref =
        labelToRef.get(expectedKey) ??
        labelToRef.get(expectedKey.toUpperCase()) ??
        expectedKey;
      const expectedLiteral = toBitLiteral(vector.expected[expectedKey]);
      lines.push(`    assert ${ref} = ${expectedLiteral}`);
      lines.push(
        `      report "Vector ${index} failed on ${ref}: expected ${expectedLiteral}"`,
      );
      lines.push('      severity error;');
    }

    lines.push('');
  });

  return lines.join('\n');
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
      lines.push('    wait for 10 ns;');
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
      const addLogicalAlias = (alias: string | undefined, canonical: string) => {
        const trimmed = alias?.trim() ?? '';
        if (trimmed.length === 0) return;
        logicalToCanonical.set(trimmed, canonical);
        logicalToCanonical.set(trimmed.toLowerCase(), canonical);
      };

      // Derive canonical port names from ioMapping — label takes precedence,
      // matching basys3Bundle.toSignalName() and verilog-generator.ts exactly.
      for (const entry of project.ioMapping?.inputs ?? []) {
        const canonical = entry.label?.trim()
          ? toVhdlIdentifier(entry.label.trim())
          : toVhdlIdentifier(`${entry.nodeId}_${entry.port}`);
        inputNames.add(canonical);
        addLogicalAlias(canonical, canonical);
        addLogicalAlias(entry.id, canonical);
        addLogicalAlias(entry.nodeId, canonical);
        addLogicalAlias(entry.label, canonical);
        // Also alias the legacy nodeId_port form so old vectors still resolve.
        addLogicalAlias(toVhdlIdentifier(`${entry.nodeId}_${entry.port}`), canonical);
        const node = (project.circuit.nodes ?? []).find((n) => n.id === entry.nodeId);
        addLogicalAlias(node?.label, canonical);
      }
      for (const entry of project.ioMapping?.outputs ?? []) {
        const canonical = entry.label?.trim()
          ? toVhdlIdentifier(entry.label.trim())
          : toVhdlIdentifier(`${entry.nodeId}_${entry.port}`);
        outputNames.add(canonical);
        addLogicalAlias(canonical, canonical);
        addLogicalAlias(entry.id, canonical);
        addLogicalAlias(entry.nodeId, canonical);
        addLogicalAlias(entry.label, canonical);
        // Also alias the legacy nodeId_port form so old vectors still resolve.
        addLogicalAlias(toVhdlIdentifier(`${entry.nodeId}_${entry.port}`), canonical);
        const node = (project.circuit.nodes ?? []).find((n) => n.id === entry.nodeId);
        addLogicalAlias(node?.label, canonical);
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
