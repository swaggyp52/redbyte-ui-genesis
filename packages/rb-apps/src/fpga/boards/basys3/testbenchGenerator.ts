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
import { buildTopLevelBindingRefs, toSignalName } from './basys3ExportModel';
import { normalizeBoardRowId, resolveIoMappingFromProjectFields } from '@redbyte/rb-utils';

interface SignalCatalog {
  inputs: string[];
  outputs: string[];
  clock?: string;
    /** Maps logical signal names (vector keys, node labels) → canonical entity port names */
    logicalToCanonical: Map<string, string>;
}

export interface TestbenchClockDriveView {
  mode: 'auto' | 'authored';
  signalId?: string;
  signalLabel?: string;
  startLevel: 0 | 1;
}

interface TestbenchGenerationOptions {
  scheduleOverride?: Partial<VerifyScheduleContract> & Pick<VerifyScheduleContract, 'schedule'>;
  /**
   * When provided, component ports + signal declarations are derived directly from
   * the entity declaration in this VHDL text, guaranteeing testbench/entity consistency.
   * Vector types (STD_LOGIC_VECTOR) are preserved; stimulus uses bit-indexed references.
   */
  entityVhd?: string;
  /** Sanitized scenario execution intent. Never pass Verify run/result state here. */
  clockDrive?: Readonly<TestbenchClockDriveView>;
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


/**
 * The mapping the package is built from: the structured V2 document when the
 * project carries one, else the legacy ioMapping — the same rule the export
 * service applies. Reading only the legacy field left V2-only projects with no
 * name aliases, so every stimulus and assertion target fell back to a raw name
 * the entity never declared.
 */
function resolveProjectIoMapping(project: RBProject): RBProject['ioMapping'] {
  return resolveIoMappingFromProjectFields({ ioMapping: project.ioMapping, hardwareMappingV2: project.hardwareMappingV2 });
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

    const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const variants = [trimmed, trimmed.toUpperCase(), trimmed.toLowerCase(), normalized].filter(Boolean);
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
    const numberedPort = portsByBase.get(`${normalizedBase}${bitIndex}`);
    if (numberedPort) {
      return numberedPort.name;
    }
    const port = portsByBase.get(normalizedBase);
    if (!port) return undefined;
    return port.isVector ? `${port.name}(${bitIndex})` : port.name;
  };

  const allEntries = [
    ...(resolveProjectIoMapping(project)?.inputs ?? []).map((entry) => ({ ...entry, direction: 'in' as const })),
    ...(resolveProjectIoMapping(project)?.outputs ?? []).map((entry) => ({ ...entry, direction: 'out' as const })),
  ];
  const resolvedIoMapping = resolveProjectIoMapping(project);
  const bindingRefs = resolvedIoMapping ? buildTopLevelBindingRefs(resolvedIoMapping) : null;
  const bindingRefByEntryId = new Map(
    [...(bindingRefs?.inputRefs ?? []), ...(bindingRefs?.outputRefs ?? [])].map((ref) => [ref.entryId, ref] as const)
  );

  for (const entry of allEntries) {
    const label = entry.label?.trim() ?? '';
    const nodeLabel = (nodeLabelsById.get(entry.nodeId ?? '') ?? '').trim();
    if (label.length > 0) {
      countLabelAlias(label);
    }
    if (nodeLabel.length > 0 && nodeLabel.toLowerCase() !== label.toLowerCase()) {
      countLabelAlias(nodeLabel);
    }
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
      // The runtime keys rows, vectors and checks by the label-derived row id
      // (SUM[0] -> sum_0); a project whose rows were derived that way must
      // resolve its assertion targets to the same port.
      registerAlias(entry.label ? normalizeBoardRowId(entry.label) : undefined, ref);
      registerAlias(nodeLabel ? normalizeBoardRowId(nodeLabel) : undefined, ref);
    }
  };

  processEntries(resolveProjectIoMapping(project)?.inputs ?? [], 'in');
  processEntries(resolveProjectIoMapping(project)?.outputs ?? [], 'out');
  return result;
}

/**
 * The single authority for a generated testbench's entity name. The Vivado
 * project's sim_1 top, the provenance header and the E1 harness all derive it
 * from here or read it back from the testbench text.
 */
export function testbenchEntityNameFor(designTop: string): string {
  return `tb_${toVhdlIdentifier(designTop.trim() || 'top')}`;
}

/** The entity a testbench text declares, read back from the text itself. */
export function detectTestbenchEntityName(testbenchVhd: string): string | undefined {
  return testbenchVhd.match(/^\s*entity\s+([A-Za-z][A-Za-z0-9_]*)\s+is\b/im)?.[1];
}

/** Marker lines a generated testbench carries for keys it could not check or drive. */
export const TESTBENCH_UNRESOLVED_MARKER =
  /--\s*RB_UNRESOLVED_(EXPECTATION|STIMULUS) vector=(\d+) key="([^"\n]*)" reason=([a-z-]+)/g;

export function generateTestbenchVhdl(
  project: RBProject,
  vectors: TestVector[],
  options?: TestbenchGenerationOptions
): string {
  const derivedSchedule = deriveVerifySchedule(project.circuit, resolveProjectIoMapping(project), project.hdl);
  const scheduleContract =
    options?.scheduleOverride
      ? {
          ...derivedSchedule,
          ...options.scheduleOverride,
        }
      : derivedSchedule;
  const topModule = resolveDesignTop(project);
  const resolvedEntityVhd = options?.entityVhd ?? resolveCanonicalEntityVhd(project, topModule);

  // Entity-based path: derive component ports directly from the entity VHDL
  // to guarantee testbench/entity consistency. Used when entity uses vector ports.
  if (resolvedEntityVhd) {
    return generateTestbenchFromEntity(
      project,
      vectors,
      resolvedEntityVhd,
      scheduleContract,
      topModule,
      options?.clockDrive,
    );
  }

  const authoredClock =
    scheduleContract.schedule === 'clocked_macro' && options?.clockDrive?.mode === 'authored';
  const clockSignalHints = [
    options?.clockDrive?.signalId,
    options?.clockDrive?.signalLabel,
    scheduleContract.clockSignalName,
  ];
  const signalCatalog = collectSignals(
    project,
    vectors,
    scheduleContract.schedule,
    clockSignalHints
  );

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
  const authoredClockStartLevel = authoredClock && options?.clockDrive?.startLevel === 1 ? 1 : 0;

  const componentPorts = [
    ...declaredInputs.map((name) => `      ${vhdlNameByLogical.get(name)} : in  std_logic`),
    ...declaredOutputs.map((name) => `      ${vhdlNameByLogical.get(name)} : out std_logic`),
  ].join(';\n');

  const dutEntity = toVhdlIdentifier(topModule);
  const names = allocateSelfCheckNames([dutEntity, ...vhdlNameByLogical.values(), 'CLK_HALF_PERIOD']);

  const signalDecls = [
    ...declaredInputs.map((name) =>
      `  signal ${vhdlNameByLogical.get(name)} : std_logic := '${
        authoredClock && name === signalCatalog.clock ? authoredClockStartLevel : 0
      }';`
    ),
    ...declaredOutputs.map((name) => `  signal ${vhdlNameByLogical.get(name)} : std_logic;`),
    ...(scheduleContract.schedule === 'clocked_macro' && !authoredClock
      ? ["  constant CLK_HALF_PERIOD : time := 5 ns;"]
      : []),
  ].join('\n');

  const portMapEntries = [
    ...declaredInputs.map((name) => `      ${vhdlNameByLogical.get(name)} => ${vhdlNameByLogical.get(name)}`),
    ...declaredOutputs.map((name) => `      ${vhdlNameByLogical.get(name)} => ${vhdlNameByLogical.get(name)}`),
  ].join(',\n');

  const stimulus = generateStimulus(
    vectors,
    scheduleContract.schedule,
    signalCatalog.clock,
    vhdlNameByLogical,
    authoredClock,
    names,
  );
  const clockProcess = authoredClock
    ? ''
    : buildClockProcess(scheduleContract.schedule, signalCatalog.clock, vhdlNameByLogical, names);

  return renderTestbench({
    dutEntity,
    componentPorts,
    signalDecls,
    portMapEntries,
    clockProcess,
    stimulus,
    scheduleContract,
    authoredClock,
    names,
    expectedChecks: countExpectedChecks(vectors),
  });
}

/**
 * Identifiers for the self-check bookkeeping. Each one is suffixed until it
 * cannot collide with a DUT port or another testbench name (VHDL is
 * case-insensitive).
 */
interface SelfCheckNames {
  done: string;
  checks: string;
  failures: string;
  expectedChecks: string;
  checkVar: string;
  failureVar: string;
}

function allocateSelfCheckNames(taken: Iterable<string>): SelfCheckNames {
  const used = new Set(Array.from(taken, (name) => name.toLowerCase()));
  const pick = (base: string): string => {
    let candidate = base;
    let suffix = 1;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };
  return {
    done: pick('rb_tb_done'),
    checks: pick('rb_tb_checks'),
    failures: pick('rb_tb_failures'),
    expectedChecks: pick('RB_TB_EXPECTED_CHECKS'),
    checkVar: pick('rb_checks'),
    failureVar: pick('rb_failures'),
  };
}

function countExpectedChecks(vectors: TestVector[]): number {
  return vectors.reduce((total, vector) => total + Object.keys(vector.expected ?? {}).length, 0);
}

interface TestbenchTemplate {
  dutEntity: string;
  componentPorts: string;
  signalDecls: string;
  portMapEntries: string;
  clockProcess: string;
  stimulus: string;
  scheduleContract: ReturnType<typeof deriveVerifySchedule>;
  authoredClock: boolean;
  names: SelfCheckNames;
  expectedChecks: number;
}

/**
 * Shared body for both generator paths. Every testbench counts its checks and
 * failures, stops its own clock and ends with exactly one summary line:
 *   REDBYTE_TB_RESULT v=1 tb=<entity> status=PASS|FAIL|NO_CHECKS checks=<n> failures=<m>
 * FAIL and NO_CHECKS report at severity failure, so a simulator exits nonzero
 * and a testbench without checks can never read as a pass.
 */
function renderTestbench(t: TestbenchTemplate): string {
  const tbEntity = testbenchEntityNameFor(t.dutEntity);
  const { names } = t;
  const summary = `REDBYTE_TB_RESULT v=1 tb=${tbEntity}`;
  const counts = `" checks=" & integer'image(${names.checkVar}) & " failures=" & integer'image(${names.failureVar})`;
  const sequence = t.authoredClock
    ? 'authored-vectors'
    : t.scheduleContract.schedule === 'clocked_macro'
      ? CLOCKED_MACRO_SEQUENCE.join('->')
      : 'single-tick';

  return `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity ${tbEntity} is
end entity ${tbEntity};

architecture sim of ${tbEntity} is
  component ${t.dutEntity} is
    port (
${t.componentPorts}
    );
  end component;

${t.signalDecls}
  signal ${names.done} : boolean := false;
  signal ${names.checks} : natural := 0;
  signal ${names.failures} : natural := 0;
  constant ${names.expectedChecks} : natural := ${t.expectedChecks};
begin
  -- Deterministic schedule contract with Verify runner:
  -- schedule=${t.scheduleContract.schedule}
  -- reason=${t.scheduleContract.reason}
  -- sequence=${sequence}
  -- Self-check: ends with one REDBYTE_TB_RESULT line; FAIL and NO_CHECKS stop at severity failure.
  dut: ${t.dutEntity}
    port map (
${t.portMapEntries}
    );

${t.clockProcess}
  stim: process
    variable ${names.checkVar} : natural := 0;
    variable ${names.failureVar} : natural := 0;
  begin
${t.stimulus}
    ${names.checks} <= ${names.checkVar};
    ${names.failures} <= ${names.failureVar};
    ${names.done} <= true;
    wait for 0 ns;
    if ${names.failureVar} /= 0 or ${names.checkVar} /= ${names.expectedChecks} then
      report "${summary} status=FAIL" & ${counts}
        severity failure;
    elsif ${names.expectedChecks} = 0 then
      report "${summary} status=NO_CHECKS" & ${counts}
        severity failure;
    else
      report "${summary} status=PASS" & ${counts}
        severity note;
    end if;
    wait;
  end process;
end architecture sim;
`;
}

function emitExpectationCheck(
  lines: string[],
  names: SelfCheckNames,
  index: number,
  ref: string,
  literal: BitLiteral,
): void {
  lines.push(`    ${names.checkVar} := ${names.checkVar} + 1;`);
  lines.push(`    if ${ref} /= ${literal} then`);
  lines.push(`      ${names.failureVar} := ${names.failureVar} + 1;`);
  lines.push('    end if;');
  lines.push(`    assert ${ref} = ${literal}`);
  lines.push(`      report "Vector ${index} failed on ${ref}: expected ${literal}, got " & std_logic'image(${ref})`);
  lines.push('      severity error;');
}

/**
 * A key the generator cannot check is a counted failure in the simulator and a
 * marker that validateArtifactConsistency turns into a blocking export error.
 */
function emitUnresolvedExpectation(
  lines: string[],
  names: SelfCheckNames,
  index: number,
  key: string,
  reason: 'unmapped' | 'non-binary',
): void {
  const display = displayKey(key);
  lines.push(`    -- RB_UNRESOLVED_EXPECTATION vector=${index} key="${display}" reason=${reason}`);
  lines.push(`    ${names.checkVar} := ${names.checkVar} + 1;`);
  lines.push(`    ${names.failureVar} := ${names.failureVar} + 1;`);
  lines.push(
    `    report "Vector ${index} cannot check ${display}: ${
      reason === 'unmapped' ? 'no testbench signal matches this key' : 'the expected value is not 0 or 1'
    }" severity error;`,
  );
}

function emitUnresolvedStimulus(
  lines: string[],
  names: SelfCheckNames,
  index: number,
  key: string,
  reason: 'unmapped' | 'non-binary',
): void {
  const display = displayKey(key);
  lines.push(`    -- RB_UNRESOLVED_STIMULUS vector=${index} key="${display}" reason=${reason}`);
  lines.push(`    ${names.failureVar} := ${names.failureVar} + 1;`);
  lines.push(
    `    report "Vector ${index} cannot drive ${display}: ${
      reason === 'unmapped' ? 'no testbench signal matches this key' : 'the input value is not 0 or 1'
    }" severity error;`,
  );
}

/** Keys can be arbitrary authored text; keep only characters safe in a VHDL comment and string. */
function displayKey(key: string): string {
  return key.replace(/[^A-Za-z0-9 _.:()[\]-]/g, '?').slice(0, 80);
}

/** Same precedence as the export service (hdl.top, then fpga.top), so top.vhd and the DUT component agree. */
function resolveDesignTop(project: RBProject): string {
  return project.hdl?.top?.trim() || project.fpga?.top?.trim() || 'top';
}

function resolveCanonicalEntityVhd(project: RBProject, topModule: string): string | undefined {
  const exportIoMapping = resolveProjectIoMapping(project);
  if (!exportIoMapping) return undefined;
  try {
    return exportBasys3Bundle(project.circuit, exportIoMapping, {
      entityName: topModule,
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
  clockDrive?: Readonly<TestbenchClockDriveView>,
): string {
  const entityPorts = parseEntityPortInfos(topVhd);
  const labelToRef = buildLabelToEntityRef(project, entityPorts);
  const authoredClock =
    scheduleContract.schedule === 'clocked_macro' && clockDrive?.mode === 'authored';

  // Resolve clock signal name if needed
  let clockPortRef: string | undefined;
  if (scheduleContract.schedule === 'clocked_macro') {
    const hints = [clockDrive?.signalId, clockDrive?.signalLabel, scheduleContract.clockSignalName]
      .map((hint) => hint?.trim() ?? '')
      .filter(Boolean);
    for (const hint of hints) {
      clockPortRef = labelToRef.get(hint) ?? labelToRef.get(hint.toUpperCase());
      if (clockPortRef) break;
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
        ? buildEntityInputInitializer(
            p,
            authoredClock ? clockPortRef : undefined,
            authoredClock && clockDrive?.startLevel === 1 ? 1 : 0,
          )
        : '';
    return `  signal ${p.name} : ${p.typeDecl}${init};`;
  });
  if (scheduleContract.schedule === 'clocked_macro' && !authoredClock) {
    signalDeclLines.push('  constant CLK_HALF_PERIOD : time := 5 ns;');
  }
  const signalDecls = signalDeclLines.join('\n');

  const portMapEntries = entityPorts
    .map((p) => `      ${p.name} => ${p.name}`)
    .join(',\n');

  const dutEntity = resolveDutEntityName(topVhd, topModule);
  const names = allocateSelfCheckNames([dutEntity, ...entityPorts.map((p) => p.name), 'CLK_HALF_PERIOD']);
  const stimulus = generateEntityStimulus(
    vectors,
    scheduleContract.schedule,
    clockPortRef,
    labelToRef,
    entityPorts,
    authoredClock,
    names,
  );
  const clockProcess = authoredClock
    ? ''
    : buildEntityClockProcess(scheduleContract.schedule, clockPortRef, names);

  return renderTestbench({
    dutEntity,
    componentPorts,
    signalDecls,
    portMapEntries,
    clockProcess,
    stimulus,
    scheduleContract,
    authoredClock,
    names,
    expectedChecks: countExpectedChecks(vectors),
  });
}

/**
 * The DUT component must name the entity top.vhd declares. Keep the project's
 * top when the text declares it; otherwise trust the text's first entity.
 */
function resolveDutEntityName(topVhd: string, topModule: string): string {
  const requested = toVhdlIdentifier(topModule);
  const declared = Array.from(topVhd.matchAll(/^\s*entity\s+([A-Za-z][A-Za-z0-9_]*)\s+is\b/gim), (m) => m[1]);
  if (declared.some((name) => name.toLowerCase() === requested.toLowerCase())) return requested;
  return declared[0] ?? requested;
}

function buildEntityInputInitializer(
  port: EntityPortInfo,
  clockPortRef: string | undefined,
  clockStartLevel: 0 | 1,
): string {
  const normalizedPort = port.name.trim().toLowerCase();
  const normalizedClock = clockPortRef?.replace(/\s+/g, '').toLowerCase();
  const scalarClock = normalizedClock === normalizedPort;

  if (!port.isVector) {
    return ` := '${scalarClock ? clockStartLevel : 0}'`;
  }

  if (clockStartLevel === 1 && normalizedClock) {
    const bitPrefix = `${normalizedPort}(`;
    if (normalizedClock.startsWith(bitPrefix) && normalizedClock.endsWith(')')) {
      const bitIndex = normalizedClock.slice(bitPrefix.length, -1);
      if (/^\d+$/.test(bitIndex)) {
        return ` := (${bitIndex} => '1', others => '0')`;
      }
    }
    if (scalarClock) {
      return " := (others => '1')";
    }
  }

  return " := (others => '0')";
}

function generateEntityStimulus(
  vectors: TestVector[],
  schedule: 'combinational' | 'clocked_macro',
  clockPortRef: string | undefined,
  labelToRef: Map<string, string>,
  entityPorts: EntityPortInfo[],
  authoredClock: boolean,
  names: SelfCheckNames,
): string {
  const lines: string[] = [];
  const resolve = (key: string): string | undefined =>
    labelToRef.get(key) ?? labelToRef.get(key.trim()) ?? labelToRef.get(key.trim().toUpperCase());

  vectors.forEach((vector, index) => {
    lines.push(`    -- Vector ${index} (tick=${vector.tick})`);

    for (const key of uniqueSorted(Object.keys(vector.inputs))) {
      const ref = resolve(key);
      if (!ref) {
        emitUnresolvedStimulus(lines, names, index, key, 'unmapped');
        continue;
      }
      // Skip clock — handled by clock process below
      if (!authoredClock && clockPortRef && ref === clockPortRef) continue;
      const literal = toBitLiteral(vector.inputs[key]);
      if (!literal) {
        emitUnresolvedStimulus(lines, names, index, key, 'non-binary');
        continue;
      }
      lines.push(`    ${ref} <= ${literal};`);
    }

    lines.push(...settleLines(schedule, clockPortRef, authoredClock));

    for (const expectedKey of uniqueSorted(Object.keys(vector.expected ?? {}))) {
      const ref = resolve(expectedKey);
      const literal = toBitLiteral(vector.expected[expectedKey]);
      if (!ref) emitUnresolvedExpectation(lines, names, index, expectedKey, 'unmapped');
      else if (!literal) emitUnresolvedExpectation(lines, names, index, expectedKey, 'non-binary');
      else emitExpectationCheck(lines, names, index, ref, literal);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Auto board clock: sample 1 ns after the rising edge (well inside the 5 ns
 * half period), so logic after a register has settled like the runtime's
 * post-edge sample. Two delta cycles only covered one assignment past the
 * flip-flop. Authored and combinational schedules settle for 10 ns.
 */
function settleLines(
  schedule: 'combinational' | 'clocked_macro',
  clockRef: string | undefined,
  authoredClock: boolean,
): string[] {
  if (schedule === 'clocked_macro' && clockRef && !authoredClock) {
    return [`    wait until rising_edge(${clockRef});`, '    wait for 1 ns;'];
  }
  return ['    wait for 10 ns;'];
}

function generateStimulus(
  vectors: TestVector[],
  schedule: 'combinational' | 'clocked_macro',
  clockSignal: string | undefined,
  nameMap: Map<string, string>,
  authoredClock: boolean,
  names: SelfCheckNames,
): string {
  const lines: string[] = [];
  const safeClock = clockSignal ? nameMap.get(clockSignal) : undefined;
  const resolve = (key: string): string | undefined => nameMap.get(key) ?? nameMap.get(key.trim());

  vectors.forEach((vector, index) => {
    lines.push(`    -- Vector ${index} (tick=${vector.tick})`);

    for (const inputName of uniqueSorted(Object.keys(vector.inputs))) {
      const signalName = resolve(inputName);
      if (!signalName) {
        emitUnresolvedStimulus(lines, names, index, inputName, 'unmapped');
        continue;
      }
      if (!authoredClock && safeClock && signalName === safeClock) continue;
      const literal = toBitLiteral(vector.inputs[inputName]);
      if (!literal) {
        emitUnresolvedStimulus(lines, names, index, inputName, 'non-binary');
        continue;
      }
      lines.push(`    ${signalName} <= ${literal};`);
    }

    lines.push(...settleLines(schedule, safeClock, authoredClock));

    for (const expectedName of uniqueSorted(Object.keys(vector.expected ?? {}))) {
      const signalName = resolve(expectedName);
      const literal = toBitLiteral(vector.expected[expectedName]);
      if (!signalName) emitUnresolvedExpectation(lines, names, index, expectedName, 'unmapped');
      else if (!literal) emitUnresolvedExpectation(lines, names, index, expectedName, 'non-binary');
      else emitExpectationCheck(lines, names, index, signalName, literal);
    }

    lines.push('');
  });

  return lines.join('\n');
}

function buildClockProcess(
  schedule: 'combinational' | 'clocked_macro',
  logicalClockName: string | undefined,
  nameMap: Map<string, string>,
  names: SelfCheckNames,
): string {
  if (schedule !== 'clocked_macro' || !logicalClockName) return '';
  const clockRef = nameMap.get(logicalClockName);
  if (!clockRef) return '';
  return renderClockProcess(clockRef, names);
}

function buildEntityClockProcess(
  schedule: 'combinational' | 'clocked_macro',
  clockPortRef: string | undefined,
  names: SelfCheckNames,
): string {
  if (schedule !== 'clocked_macro' || !clockPortRef) return '';
  return renderClockProcess(clockPortRef, names);
}

/** The free-running board clock stops once the stimulus is done, so `run all` terminates. */
function renderClockProcess(clockRef: string, names: SelfCheckNames): string {
  return [
    '  clock_gen: process',
    '  begin',
    `    ${clockRef} <= '0';`,
    '    wait for CLK_HALF_PERIOD;',
    `    while not ${names.done} loop`,
    `      ${clockRef} <= '1';`,
    '      wait for CLK_HALF_PERIOD;',
    `      ${clockRef} <= '0';`,
    '      wait for CLK_HALF_PERIOD;',
    '    end loop;',
    '    wait;',
    '  end process;',
    '',
  ].join('\n');
}

function collectSignals(
  project: RBProject,
  vectors: TestVector[],
  schedule: 'combinational' | 'clocked_macro',
  scheduleClockHints: Array<string | undefined> = []
): SignalCatalog {
  const inputNames = new Set<string>();
  const outputNames = new Set<string>();

    // Build canonical name map: logical name (vector key, node label) → canonical entity port name.
    // Canonical names use the same nodeId_port scheme as buildVhdlTopLevelBindings / toSignalName,
    // ensuring testbench component ports match entity ports exactly.
    const logicalToCanonical = new Map<string, string>();

    const hasIoMapping =
      (resolveProjectIoMapping(project)?.inputs?.length ?? 0) > 0 ||
      (resolveProjectIoMapping(project)?.outputs?.length ?? 0) > 0;

    if (hasIoMapping) {
      const addLogicalAlias = (alias: string | undefined, canonical: string) => {
        const trimmed = alias?.trim() ?? '';
        if (trimmed.length === 0) return;
        logicalToCanonical.set(trimmed, canonical);
        logicalToCanonical.set(trimmed.toLowerCase(), canonical);
      };

      // Derive canonical port names from ioMapping — label takes precedence,
      // matching basys3Bundle.toSignalName() and verilog-generator.ts exactly.
      for (const entry of resolveProjectIoMapping(project)?.inputs ?? []) {
        // Use toSignalName (same sanitizer as basys3ExportModel/top.vhd) so the
        // fallback testbench path emits identical identifiers to the entity.
        const canonical = toSignalName(entry);
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
      for (const entry of resolveProjectIoMapping(project)?.outputs ?? []) {
        // Use toSignalName (same sanitizer as basys3ExportModel/top.vhd) so the
        // fallback testbench path emits identical identifiers to the entity.
        const canonical = toSignalName(entry);
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
    const resolvedClockHint = scheduleClockHints
      .map((hint) => hint?.trim() ?? '')
      .filter((hint) => hint.length > 0)
      .map(
        (hint) =>
          logicalToCanonical.get(hint) ??
          logicalToCanonical.get(hint.toLowerCase()) ??
          (inputNames.has(hint) ? hint : undefined)
      )
      .find((hint): hint is string => typeof hint === 'string');
    if (resolvedClockHint) {
      clock = resolvedClockHint;
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

type BitLiteral = "'0'" | "'1'";

/** Only an unambiguous bit becomes a literal; anything else is reported, never coerced. */
function toBitLiteral(value: unknown): BitLiteral | undefined {
  if (value === true || value === 1 || value === '1') return "'1'";
  if (value === false || value === 0 || value === '0') return "'0'";
  return undefined;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => compareCodepoint(left, right));
}
