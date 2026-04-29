/**
 * basys3ExportContract.ts
 *
 * The canonical export contract for Basys3 student exports.
 *
 * This is the SINGLE SOURCE OF TRUTH for all port-level information shared
 * across top.vhd, testbench.vhd, XDC, and auxiliary artifacts.
 *
 * RULE: No generator may independently sanitize or invent a public
 * HDL/XDC/testbench name. Every name must be read from this contract.
 *
 * Supported student-mode constraints (intentionally strict):
 *  - Basys3 board only
 *  - One external primary clock (W5, 100 MHz) or no clock (combinational/latch)
 *  - Synchronous registers or combinational logic only
 *  - Buttons and switches are control/data inputs, never clocks
 *  - Typed board I/O: clock, switch, button, LED, seven-seg segment/enable/dp
 */

import type { Basys3ExportModel } from './basys3ExportModel';
import { getVhdlStatefulNodeTypes } from '@redbyte/rb-logic-core';
import {
  BASYS3_CLOCK_PIN,
  BASYS3_DP_PIN,
  BASYS3_SWITCH_PINS,
  BASYS3_BUTTON_PINS,
  BASYS3_LED_PINS,
  BASYS3_SEGMENT_PINS,
  BASYS3_ANODE_PINS,
  resolveBasys3PackagePin,
} from './basys3Pins';
import type { IoMapping } from '@redbyte/rb-utils';

// ---------------------------------------------------------------------------
// Typed board resource roles
// ---------------------------------------------------------------------------

export type BasysResourceRole =
  | 'clock'                    // W5 — 100 MHz board oscillator input
  | 'switch_input'             // SW0–SW15 — slide switch
  | 'button_input'             // BTNC/BTNU/BTNL/BTNR/BTND — push button
  | 'led_output'               // LD0–LD15 — LED
  | 'sevenseg_segment_output'  // SEG0–SEG6 — seven-segment cathode
  | 'sevenseg_enable_output'   // AN0–AN3 — seven-segment anode enable
  | 'sevenseg_dp_output'       // DP — decimal point cathode
  | 'other_input'              // Unmapped or future input resource
  | 'other_output';            // Unmapped or future output resource

// ---------------------------------------------------------------------------
// Clock and timing policy
// ---------------------------------------------------------------------------

export type BasysClockPolicy =
  /** No stateful elements, no board clock. */
  | 'combinational'
  /** Exactly one W5 board clock; synchronous design. */
  | 'clocked_primary'
  /** Stateful elements but no board clock (manual/async control). */
  | 'latch_async';

export type BasysTimingMode = 'synchronous_board_clock' | 'manual_event_driven_lab' | 'combinational';

export type BasysTimingRole =
  /** create_clock -period 10.000 is generated for this port. */
  | 'primary_clock'
  /** set_false_path -from is generated (async/latch designs only). */
  | 'false_path_input'
  /** No timing constraint is generated for this port. */
  | 'unconstrained';

// ---------------------------------------------------------------------------
// Port contract — the atomic unit
// ---------------------------------------------------------------------------

/**
 * Represents ONE logical port in the exported top-level entity.
 *
 * A vector port (e.g., LED as STD_LOGIC_VECTOR(3 downto 0)) is represented
 * by multiple PortContracts sharing the same portName but different bitIndex.
 * A scalar port has bitIndex === undefined.
 *
 * AUTHORITY RULE: Every generator reads portName, xdcRef, and signalRef
 * from here and never re-derives them locally.
 */
export interface Basys3PortContract {
  /**
   * VHDL entity port name. This string is the authority for:
   *   top.vhd entity declaration
   *   testbench.vhd component declaration and signal declarations
   *   XDC get_ports base name
   */
  portName: string;

  /**
   * XDC get_ports reference.
   *   Scalar: "CLK"
   *   Vector bit: "LED[3]"
   */
  xdcRef: string;

  /**
   * VHDL signal/port assignment reference.
   *   Scalar: "CLK"
   *   Vector bit: "LED(3)"
   */
  signalRef: string;

  direction: 'in' | 'out';

  /** 'STD_LOGIC' or 'STD_LOGIC_VECTOR(N downto 0)' */
  vhdlType: string;

  /** Present only for entries that map to a specific bit of a vector port. */
  bitIndex?: number;

  /** Physical Basys3 package pin (e.g., 'W5', 'V17', 'U16'). */
  packagePin: string;

  ioStandard: 'LVCMOS33';

  /** Typed board resource role — determines legal usage and timing policy. */
  resourceRole: BasysResourceRole;

  /**
   * When true, `set_property CLOCK_BUFFER_TYPE NONE` must be emitted
   * for this port in the XDC. True for all switch and button inputs to
   * prevent Vivado from inferring a global clock buffer on a non-clock pin.
   */
  suppressClockBuffer: boolean;

  /** What timing constraint (if any) is emitted for this port. */
  timingRole: BasysTimingRole;

  /** Back-reference to IoMappingEntry.id. */
  entryId: string;
  nodeId: string;
  port: string;

  /**
   * All string aliases that should resolve to this port during verify
   * and testbench signal lookup. Includes portName, entryId, nodeId,
   * user label, and pin alias.
   */
  verifyAliases: string[];
}

// ---------------------------------------------------------------------------
// Contract-level errors
// ---------------------------------------------------------------------------

export interface Basys3ContractError {
  /**
   * Stable diagnostic code. Format: RBEX-CT-NNN.
   * Never changes across RedByte versions — safe to assert in tests.
   */
  code: string;
  message: string;
  /** Which port triggered the error, if applicable. */
  portName?: string;
  severity: 'error' | 'warning';
}

// ---------------------------------------------------------------------------
// Export contract
// ---------------------------------------------------------------------------

export interface Basys3ExportContract {
  /** VHDL entity / Verilog module name. */
  entityName: string;

  /** Design timing classification. */
  clockPolicy: BasysClockPolicy;
  /** User-facing timing mode classification used by Hardware/Export UX. */
  timingMode: BasysTimingMode;

  /** The port bound to W5 (100 MHz board oscillator), if present. */
  primaryClockPort?: Basys3PortContract;

  /** Primary clock frequency in Hz. Always 100_000_000 for Basys3. */
  primaryClockFreqHz: number;

  /**
   * All ports in deterministic order: inputs first (by entryId), then outputs.
   * This is the ordered authority list — all generators iterate this.
   */
  ports: Basys3PortContract[];
  inputPorts: Basys3PortContract[];
  outputPorts: Basys3PortContract[];

  /**
   * Contract violations. If any entry has severity 'error', export MUST be
   * blocked before emitting any HDL/XDC file.
   */
  errors: Basys3ContractError[];
}

// ---------------------------------------------------------------------------
// Internal: pin-to-role classification
// ---------------------------------------------------------------------------

const SWITCH_PIN_SET = new Set<string>(BASYS3_SWITCH_PINS);
const BUTTON_PIN_SET = new Set<string>(BASYS3_BUTTON_PINS);
const LED_PIN_SET = new Set<string>(BASYS3_LED_PINS);
const SEGMENT_PIN_SET = new Set<string>(BASYS3_SEGMENT_PINS);
const ANODE_PIN_SET = new Set<string>(BASYS3_ANODE_PINS);

function detectResourceRole(packagePin: string, direction: 'in' | 'out'): BasysResourceRole {
  if (packagePin === BASYS3_CLOCK_PIN) return 'clock';
  if (packagePin === BASYS3_DP_PIN) return 'sevenseg_dp_output';
  if (SWITCH_PIN_SET.has(packagePin)) return 'switch_input';
  if (BUTTON_PIN_SET.has(packagePin)) return 'button_input';
  if (LED_PIN_SET.has(packagePin)) return 'led_output';
  if (SEGMENT_PIN_SET.has(packagePin)) return 'sevenseg_segment_output';
  if (ANODE_PIN_SET.has(packagePin)) return 'sevenseg_enable_output';
  return direction === 'in' ? 'other_input' : 'other_output';
}

function detectTimingRole(
  role: BasysResourceRole,
  clockPolicy: BasysClockPolicy,
): BasysTimingRole {
  if (role === 'clock') return 'primary_clock';
  if (
    clockPolicy === 'latch_async' &&
    (role === 'switch_input' || role === 'button_input')
  ) {
    return 'false_path_input';
  }
  return 'unconstrained';
}

const STATEFUL_NODE_TYPES = new Set(getVhdlStatefulNodeTypes());

function detectClockPolicy(
  exportModel: Basys3ExportModel,
  ioMapping: IoMapping,
): BasysClockPolicy {
  const hasClockInput = ioMapping.inputs.some((entry) => {
    const alias = (entry.pin ?? '').toUpperCase().trim();
    return alias === 'CLK' || alias === 'CLK100MHZ' || alias === 'W5';
  });
  if (hasClockInput) return 'clocked_primary';

  const hasStateful = exportModel.netlist.nodes.some((node) =>
    STATEFUL_NODE_TYPES.has(node.type),
  );
  if (hasStateful) return 'latch_async';

  return 'combinational';
}

export function classifyBasysTimingMode(clockPolicy: BasysClockPolicy): BasysTimingMode {
  if (clockPolicy === 'clocked_primary') return 'synchronous_board_clock';
  if (clockPolicy === 'latch_async') return 'manual_event_driven_lab';
  return 'combinational';
}

// ---------------------------------------------------------------------------
// Contract builder
// ---------------------------------------------------------------------------

/**
 * Build the canonical export contract from a pre-computed export model.
 *
 * Call this BEFORE generating any HDL/XDC file. If `contract.errors` contains
 * any 'error'-severity entries, abort export immediately.
 */
export function buildExportContract(
  exportModel: Basys3ExportModel,
  ioMapping: IoMapping,
  entityName: string,
): Basys3ExportContract {
  const clockPolicy = detectClockPolicy(exportModel, ioMapping);

  const allRefs = [
    ...exportModel.inputRefs,
    ...exportModel.outputRefs,
  ];

  const ports: Basys3PortContract[] = allRefs.map((ref) => {
    const packagePin = resolveBasys3PackagePin(ref.pin ?? '') ?? '';
    const role = detectResourceRole(packagePin, ref.direction);
    const suppressClockBuffer =
      ref.direction === 'in' &&
      (role === 'switch_input' || role === 'button_input');
    const timingRole = detectTimingRole(role, clockPolicy);

    const topPort = exportModel.topPorts.find((p) => p.name === ref.portName);

    const verifyAliases = Array.from(
      new Set(
        [ref.portName, ref.entryId, ref.nodeId, ref.label, ref.pin,
          ref.xdcRef, ref.signalRef]
          .filter((a): a is string => typeof a === 'string' && a.trim().length > 0),
      ),
    );

    return {
      portName: ref.portName,
      xdcRef: ref.xdcRef,
      signalRef: ref.signalRef,
      direction: ref.direction,
      vhdlType: topPort?.vhdlType ?? 'STD_LOGIC',
      bitIndex: ref.bitIndex,
      packagePin,
      ioStandard: 'LVCMOS33',
      resourceRole: role,
      suppressClockBuffer,
      timingRole,
      entryId: ref.entryId,
      nodeId: ref.nodeId,
      port: ref.port,
      verifyAliases,
    };
  });

  const inputPorts = ports.filter((p) => p.direction === 'in');
  const outputPorts = ports.filter((p) => p.direction === 'out');
  const primaryClockPort = ports.find((p) => p.resourceRole === 'clock');

  const contract: Basys3ExportContract = {
    entityName,
    clockPolicy,
    timingMode: classifyBasysTimingMode(clockPolicy),
    primaryClockPort,
    primaryClockFreqHz: 100_000_000,
    ports,
    inputPorts,
    outputPorts,
    errors: [],
  };

  contract.errors = validateExportContract(contract);
  return contract;
}

// ---------------------------------------------------------------------------
// Pre-export validation
// ---------------------------------------------------------------------------

// VHDL-2008 reserved words that could plausibly appear as student signal names.
// Emitting any of these as an entity port identifier is a VHDL syntax error.
const VHDL_RESERVED_WORDS = new Set([
  'abs', 'access', 'after', 'alias', 'all', 'and', 'architecture', 'array',
  'assert', 'attribute', 'begin', 'block', 'body', 'buffer', 'bus', 'case',
  'component', 'configuration', 'constant', 'context', 'disconnect', 'downto',
  'else', 'elsif', 'end', 'entity', 'exit', 'file', 'for', 'force',
  'function', 'generate', 'generic', 'group', 'guarded', 'if', 'impure',
  'in', 'inertial', 'inout', 'is', 'label', 'library', 'linkage', 'literal',
  'loop', 'map', 'mod', 'nand', 'new', 'next', 'nor', 'not', 'null', 'of',
  'on', 'open', 'or', 'out', 'package', 'port', 'postponed', 'procedure',
  'process', 'property', 'protected', 'pure', 'range', 'record', 'register',
  'reject', 'release', 'rem', 'report', 'restrict', 'return', 'rol', 'ror',
  'select', 'sequence', 'severity', 'signal', 'shared', 'sla', 'sll', 'sra',
  'srl', 'subtype', 'then', 'to', 'transport', 'type', 'unaffected', 'units',
  'until', 'use', 'variable', 'wait', 'when', 'while', 'with', 'xnor', 'xor',
]);

// Board resource roles that are only legal as VHDL inputs.
const BOARD_INPUT_ONLY_ROLES = new Set<BasysResourceRole>([
  'clock', 'switch_input', 'button_input',
]);

// Board resource roles that are only legal as VHDL outputs.
const BOARD_OUTPUT_ONLY_ROLES = new Set<BasysResourceRole>([
  'led_output', 'sevenseg_segment_output', 'sevenseg_enable_output',
  'sevenseg_dp_output',
]);

/**
 * Validate the contract and return any violations.
 *
 * Exported for direct testing. Normally called by buildExportContract.
 */
export function validateExportContract(
  contract: Basys3ExportContract,
): Basys3ContractError[] {
  const errors: Basys3ContractError[] = [];

  // RBEX-CT-001: Duplicate canonical port-slot identifiers.
  //
  // Vector bits legitimately share a portName (e.g., SW[0] and SW[1] both have
  // portName "SW") but each has a distinct bitIndex — that is expected and valid.
  //
  // A collision only occurs when two entries share the same portName AND the same
  // bitIndex (or when two scalar entries share the same portName). Either case
  // produces a duplicate identifier in the VHDL entity declaration.
  const seenPortSlots = new Map<string, number>();
  for (const port of contract.ports) {
    const key = `${port.portName.toLowerCase()}::${port.bitIndex ?? '__scalar__'}`;
    seenPortSlots.set(key, (seenPortSlots.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seenPortSlots) {
    if (count > 1) {
      const [portName] = key.split('::');
      errors.push({
        code: 'RBEX-CT-001',
        message:
          `${count} ports resolve to the same VHDL identifier slot "${portName}" ` +
          `after sanitization. Rename the conflicting signals so each produces a unique ` +
          `VHDL entity port.`,
        portName,
        severity: 'error',
      });
    }
  }

  // RBEX-CT-002: Empty port name
  // An empty string in the entity port list is a VHDL syntax error.
  for (const port of contract.ports) {
    if (!port.portName || port.portName.trim().length === 0) {
      errors.push({
        code: 'RBEX-CT-002',
        message:
          `Entry "${port.entryId}" (node ${port.nodeId}) produced an empty VHDL identifier. ` +
          `Add a non-empty label or ensure the node ID is non-empty.`,
        portName: port.portName,
        severity: 'error',
      });
    }
  }

  // RBEX-CT-003: VHDL reserved word used as a port name
  for (const port of contract.ports) {
    if (VHDL_RESERVED_WORDS.has(port.portName.toLowerCase())) {
      errors.push({
        code: 'RBEX-CT-003',
        message:
          `Port name "${port.portName}" is a VHDL reserved word and cannot appear as an ` +
          `entity port identifier. Rename the signal.`,
        portName: port.portName,
        severity: 'error',
      });
    }
  }

  // RBEX-CT-004: Direction mismatch with board resource type
  // An input-only board resource (switch, button, clock) must not be wired as
  // a VHDL output, and an output-only resource (LED, seven-seg) must not be a
  // VHDL input. Such a mapping would produce an XDC constraint that contradicts
  // the physical board wiring.
  for (const port of contract.ports) {
    if (port.direction === 'in' && BOARD_OUTPUT_ONLY_ROLES.has(port.resourceRole)) {
      errors.push({
        code: 'RBEX-CT-004',
        message:
          `Port "${port.portName}" is declared as a VHDL input, but board pin ` +
          `"${port.packagePin}" is a ${port.resourceRole} (board-output only). ` +
          `Change the port direction to output, or remap to an input-capable pin.`,
        portName: port.portName,
        severity: 'error',
      });
    }
    if (port.direction === 'out' && BOARD_INPUT_ONLY_ROLES.has(port.resourceRole)) {
      errors.push({
        code: 'RBEX-CT-004',
        message:
          `Port "${port.portName}" is declared as a VHDL output, but board pin ` +
          `"${port.packagePin}" is a ${port.resourceRole} (board-input only). ` +
          `Change the port direction to input, or remap to an output-capable pin.`,
        portName: port.portName,
        severity: 'error',
      });
    }
  }

  // RBEX-CT-005: Multiple board clock ports
  // Student mode supports exactly one primary board clock.
  const clockPorts = contract.ports.filter((p) => p.resourceRole === 'clock');
  if (clockPorts.length > 1) {
    errors.push({
      code: 'RBEX-CT-005',
      message:
        `${clockPorts.length} ports are mapped to the board clock pin. ` +
        `Only one primary board clock is supported. ` +
        `Remove all but one clock binding.`,
      severity: 'error',
    });
  }

  // RBEX-CT-006: Port has no valid Basys3 package pin
  // A port without a resolved package pin cannot appear in the XDC. Vivado
  // would either fail to constrain the port or leave it floating.
  for (const port of contract.ports) {
    if (!port.packagePin) {
      errors.push({
        code: 'RBEX-CT-006',
        message:
          `Port "${port.portName}" has no valid Basys3 package pin. ` +
          `Map this signal to a supported Basys3 pin alias (e.g., SW0, LD1, BTNC).`,
        portName: port.portName,
        severity: 'error',
      });
    }
  }

  // RBEX-CT-007: XDC base name mismatch
  // The XDC get_ports base name must equal the entity port name. A mismatch
  // means Vivado's elaboration cannot match the constraint to the port.
  for (const port of contract.ports) {
    if (!port.portName || !port.xdcRef) continue;
    const xdcBase = port.xdcRef.replace(/\[\d+\]$/, '');
    if (xdcBase !== port.portName) {
      errors.push({
        code: 'RBEX-CT-007',
        message:
          `Port "${port.portName}" has XDC reference "${port.xdcRef}" whose base ` +
          `"${xdcBase}" does not match the entity port name. ` +
          `This would cause Vivado get_ports to fail. File a RedByte bug.`,
        portName: port.portName,
        severity: 'error',
      });
    }
  }

  return errors;
}
