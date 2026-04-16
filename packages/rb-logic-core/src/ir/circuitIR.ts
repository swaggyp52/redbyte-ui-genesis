// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Canonical IR v2 — RedByte Circuit Intermediate Representation
 *
 * This is the structural, layout-free description of a circuit after elaboration.
 * It is the center of the compiler pipeline: all backends (sim, verify, export)
 * must consume this IR rather than reaching directly into raw Circuit graphs.
 *
 * Key properties:
 *  - Derived, never authoritative (projectRuntime owns truth)
 *  - Pure and deterministic (no timestamps in semantic IR)
 *  - Always structurally complete, even for invalid circuits (bad programs
 *    are represented and diagnosed, not rejected at construction)
 *  - Temporal semantics (clocking, scheduling) live in VerifyScheduleContract,
 *    not here. This IR is structural-only.
 */

// ---------------------------------------------------------------------------
// Primitive type union
// ---------------------------------------------------------------------------

/**
 * Closed set of node types supported by the structural-subset compiler.
 * Every circuit node must resolve to one of these; unknown types become UNKNOWN.
 *
 * Reserved diagnostic codes:
 *   IR001: unknown primitive type        (error)
 *   IR002: multiple drivers on net       (error)
 *   IR003: floating output port          (error)
 *   IR004: sequential missing clock      (error)
 *   IR005: disconnected required input   (warning)
 *   IR006: ambiguous reset binding       (reserved)
 *   IR007: width mismatch                (reserved)
 *   IR008: unsupported primitive config  (reserved)
 */
export type IRPrimitiveType =
  // Combinational — 2-input
  | 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR'
  // Combinational — 3-input
  | 'AND3' | 'OR3' | 'NAND3' | 'NOR3' | 'XOR3'
  // Combinational — compound
  | 'FullAdder' | 'MUX4'
  // Sequential
  | 'DFlipFlop' | 'Register1' | 'RegisterBus' | 'StateBank' | 'DLatch' | 'TFlipFlop' | 'JKFlipFlop' | 'Counter4Bit' | 'Delay'
  // Boundary / I-O
  | 'INPUT' | 'OUTPUT' | 'Switch' | 'Clock' | 'PowerSource' | 'Ground' | 'Lamp'
  // Fallback for IR001 — keeps IR total and type-safe; never emit to HDL
  | 'UNKNOWN';

// ---------------------------------------------------------------------------
// Port kind
// ---------------------------------------------------------------------------

export type IRPortKind = 'input' | 'output' | 'clock' | 'reset';

// ---------------------------------------------------------------------------
// Signal type (width-aware, defaulting to scalar)
// ---------------------------------------------------------------------------

/**
 * Signal type for ports and nets. width=1 means scalar std_logic.
 * Field is required now so the IR schema is stable when vector support grows.
 */
export interface IRSignalType {
  /** Bit width. 1 = scalar (std_logic). N > 1 = std_logic_vector(N-1 downto 0). */
  width: number;
}

// ---------------------------------------------------------------------------
// Net endpoint
// ---------------------------------------------------------------------------

/** One connection endpoint: a specific port on a specific node. */
export interface IRNetEndpoint {
  nodeId: string;
  port: string;
}

// ---------------------------------------------------------------------------
// IR Port (boundary I/O)
// ---------------------------------------------------------------------------

/**
 * A boundary port — represents design-level I/O (INPUT, OUTPUT, Switch, Clock, Lamp).
 * Becomes an entity port in the VHDL output.
 */
export interface IRPort {
  /** Stable IR id. Matches sourceNodeId for boundary nodes. */
  id: string;
  /** Original graph node id — required for UI cross-probing and error mapping. */
  sourceNodeId: string;
  /** User label or stable generated name. Becomes the VHDL port name. */
  name: string;
  kind: IRPortKind;
  signalType: IRSignalType;
  /**
   * Board-level physical pin assignment (e.g., "V17" for Basys3).
   * Optional — kept out of net/IR hash; not Basys3-specific.
   */
  physicalPin?: string;
}

// ---------------------------------------------------------------------------
// IR Primitive (internal gate)
// ---------------------------------------------------------------------------

/**
 * An internal gate / primitive element.
 * Sequential primitives declare their clock and reset net bindings.
 */
export interface IRPrimitive {
  /** Stable IR id. */
  id: string;
  /** Original graph node id — required for error mapping. */
  sourceNodeId: string;
  type: IRPrimitiveType;
  /** User-assigned label, if any. */
  label?: string;
  /** Name of the net driving this primitive's clock port (sequential only). */
  clockBinding?: string;
  /** Name of the net driving this primitive's reset port (sequential, optional). */
  resetBinding?: string;
}

// ---------------------------------------------------------------------------
// IR Net (named wire)
// ---------------------------------------------------------------------------

/**
 * A named wire / signal in the design.
 *
 * drivers: In valid circuits, length === 1.
 *          length === 0 indicates a net with no driver (not normally created).
 *          length >= 2 indicates a multi-driver conflict (IR002) — still
 *          represented structurally so the compiler can diagnose precisely.
 *
 * sinks: All ports that receive this signal.
 */
export interface IRNet {
  /** Stable canonical name. Derived from driver labels or topology hash. */
  name: string;
  signalType: IRSignalType;
  /** Source endpoints driving this net. Normally length 1. */
  drivers: IRNetEndpoint[];
  /** Sink endpoints receiving this signal. */
  sinks: IRNetEndpoint[];
}

// ---------------------------------------------------------------------------
// IR Diagnostic
// ---------------------------------------------------------------------------

export interface IRDiagnostic {
  /** Diagnostic code (e.g., "IR001", "IR002"). */
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** Source-mapped node id for error highlighting. */
  nodeId?: string;
  /** Specific port on the node involved, for precise localization. */
  port?: string;
  /** Net name involved, if applicable. */
  netName?: string;
}

// ---------------------------------------------------------------------------
// IR Features summary
// ---------------------------------------------------------------------------

/**
 * Pre-computed feature flags derived during elaboration.
 * Prevents downstream backends from re-deriving compiler facts.
 */
export interface IRFeatures {
  hasSequentialLogic: boolean;
  hasCombinationalLoop: boolean;
  hasMultipleDrivers: boolean;
  hasFloatingOutputs: boolean;
  /** Names of all nets identified as clock signals. */
  clockNetNames: string[];
  /** Names of all nets identified as reset signals. */
  resetNetNames: string[];
}

// ---------------------------------------------------------------------------
// Canonical IR
// ---------------------------------------------------------------------------

/**
 * The canonical intermediate representation of a circuit after elaboration.
 *
 * This type is intentionally pure / structural:
 *   - No timestamps (lives in ElaborationResult)
 *   - No temporal / scheduling semantics (lives in VerifyScheduleContract)
 *   - No layout / position data
 *
 * irHash is computed only from semantic topology and is stable regardless of
 * input array ordering.
 */
export interface CircuitIR {
  schemaVersion: 'rb.circuit-ir.v2';
  /** Deterministic topology hash. Does NOT include timestamps or positions. */
  irHash: string;

  // Boundary ports
  /** All boundary ports (superset of inputs + outputs + clocks + resets). */
  ports: IRPort[];
  inputs: IRPort[];
  outputs: IRPort[];
  clocks: IRPort[];
  resets: IRPort[];

  // Internal elements
  primitives: IRPrimitive[];

  // Connectivity
  nets: IRNet[];

  // Diagnostics
  diagnostics: IRDiagnostic[];
  /** Count of severity='error' diagnostics. Convenience field for fast branching. */
  blockingDiagnosticCount: number;

  // Summary
  features: IRFeatures;
  /** true iff blockingDiagnosticCount === 0 */
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Elaboration result envelope
// ---------------------------------------------------------------------------

/**
 * Envelope returned by elaborateCircuit().
 * Timestamp lives here, not inside CircuitIR, to keep IR pure and hashable.
 */
export interface ElaborationResult {
  ir: CircuitIR;
  /** Mirrors ir.diagnostics — provided at top level for convenience. */
  diagnostics: IRDiagnostic[];
  /** ISO 8601 timestamp of when elaboration ran. Not part of semantic IR. */
  elaboratedAt: string;
}
