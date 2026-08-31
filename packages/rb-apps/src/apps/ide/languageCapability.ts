// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Language capability matrix — an honest, single declaration of what RedByte can
 * actually do with each source language *today*. It exists so the workbench (and
 * the import review) never over-claims: every surface that shows a source reads
 * its tier from here rather than guessing.
 *
 * The tiers deliberately separate "recognized" from "reconstructed": RedByte can
 * carry a file it cannot turn into editable logic, and it says so. Tcl is a hard
 * case — it is recognized and preserved but **never executed**.
 *
 * This matrix reflects the *current* parser support (see `status`). Planned
 * tiers are declared but marked `planned` so callers can distinguish a designed
 * capability from an available one.
 */

import type { ProjectSourceModel, SourceFile, SourceLanguage } from './projectSourceModel';

/**
 * Best structural outcome RedByte can reach for a source language:
 * - `structural-subset` — parsed into a real structural circuit (ports + component
 *   instantiations); behavioral bodies outside the subset are preserved, not lost.
 * - `ports-only`        — the interface (entity/module ports) is parsed; the body
 *   is opaque.
 * - `read-only`         — recognized and parsed for metadata/display (e.g. XDC
 *   pin/iostandard), never reconstructed into logic.
 * - `opaque-preserved`  — recognized by extension and kept verbatim; not parsed.
 * - `unsupported`       — not recognized.
 */
export type SourceCapabilityTier =
  | 'structural-subset'
  | 'ports-only'
  | 'read-only'
  | 'opaque-preserved'
  | 'unsupported';

/** Whether the declared tier is wired today or a designed-but-not-yet target. */
export type CapabilityStatus = 'available' | 'planned';

export interface LanguageCapability {
  language: SourceLanguage;
  displayName: string;
  /** Best structural tier for this language. */
  tier: SourceCapabilityTier;
  /** Whether {@link tier} is wired today (`available`) or planned. */
  status: CapabilityStatus;
  /** Can RedByte edit this as source text in place? */
  editable: boolean;
  /** Does RedByte ever EXECUTE this language? Tcl is always `false`. */
  executes: boolean;
  /** Can a bounded subset feed the browser logic provider (simulation)? */
  simulatable: boolean;
  /** Honest one-line description of the supported subset / boundary. */
  notes: string;
}

const TIER_RANK: Record<SourceCapabilityTier, number> = {
  'structural-subset': 0,
  'ports-only': 1,
  'read-only': 2,
  'opaque-preserved': 3,
  unsupported: 4,
};

const CAPABILITIES: Record<SourceLanguage, LanguageCapability> = {
  vhdl: {
    language: 'vhdl',
    displayName: 'VHDL',
    tier: 'structural-subset',
    status: 'available',
    editable: false,
    executes: false,
    simulatable: true,
    notes:
      'entity + ports (incl. bit-blasted std_logic_vector) + component instantiation + concurrent boolean assignments are reconstructed into a structural circuit (a rising_edge+reset flip-flop is inferred as a register). Generics are detected but dropped. The import surface blocks behavioral/sequential HDL (process, rising_edge, …) on commit, so the effective importable surface is structural-combinational.',
  },
  verilog: {
    language: 'verilog',
    displayName: 'Verilog',
    tier: 'structural-subset',
    status: 'available',
    editable: false,
    executes: false,
    simulatable: true,
    notes:
      'module + ports + gate primitives + module instantiation are reconstructed; assign is pass-through only. Behavioral always blocks and operator expressions are not reconstructed and are blocked at import.',
  },
  systemverilog: {
    language: 'systemverilog',
    displayName: 'SystemVerilog',
    tier: 'structural-subset',
    status: 'available',
    editable: false,
    executes: false,
    simulatable: true,
    notes:
      'parsed by the Verilog parser (no SystemVerilog-specific grammar): the Verilog-compatible structural subset (module/ports/gates/instantiation) is reconstructed. SV-specific constructs (interfaces, packages, always_ff, classes) are unsupported.',
  },
  xdc: {
    language: 'xdc',
    displayName: 'Xilinx Constraints (XDC)',
    tier: 'read-only',
    status: 'available',
    editable: false,
    executes: false,
    simulatable: false,
    notes:
      'set_property PACKAGE_PIN / IOSTANDARD and get_ports are parsed for pin mapping; never reconstructed into logic.',
  },
  tcl: {
    language: 'tcl',
    displayName: 'Tcl',
    tier: 'opaque-preserved',
    status: 'available',
    editable: false,
    executes: false,
    simulatable: false,
    notes: 'NEVER executed by RedByte. Preserved verbatim; parsed only for display.',
  },
  vcd: {
    language: 'vcd',
    displayName: 'Value Change Dump (VCD)',
    tier: 'read-only',
    status: 'planned',
    editable: false,
    executes: false,
    simulatable: false,
    notes:
      'imported waveform evidence (generated outside RedByte). Read into the Imported VCD provider / Analyzer (P2-6); never reconstructed into logic.',
  },
  unknown: {
    language: 'unknown',
    displayName: 'Unknown',
    tier: 'unsupported',
    status: 'available',
    editable: false,
    executes: false,
    simulatable: false,
    notes: 'unrecognized language; carried as opaque text with no capabilities.',
  },
};

/** The capability declaration for a language. Always defined (falls back to `unknown`). */
export function capabilityFor(language: SourceLanguage): LanguageCapability {
  return CAPABILITIES[language] ?? CAPABILITIES.unknown;
}

/** The full matrix, ordered from most- to least-capable then by name. */
export const LANGUAGE_CAPABILITIES: readonly LanguageCapability[] = Object.values(CAPABILITIES)
  .slice()
  .sort((a, b) => {
    const tierDelta = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tierDelta !== 0) return tierDelta;
    return a.displayName.localeCompare(b.displayName);
  });

/** RedByte never executes source. This is a hard invariant, surfaced for callers. */
export function neverExecuted(language: SourceLanguage): boolean {
  return capabilityFor(language).executes === false;
}

/** Whether a language can currently be reconstructed into simulatable logic. */
export function isReconstructable(language: SourceLanguage): boolean {
  const capability = capabilityFor(language);
  return (
    capability.status === 'available' &&
    (capability.tier === 'structural-subset' || capability.tier === 'ports-only')
  );
}

export function tierRank(tier: SourceCapabilityTier): number {
  return TIER_RANK[tier];
}

/** The capability declaration for a source file, by its declared language. */
export function capabilityForFile(file: Pick<SourceFile, 'language'>): LanguageCapability {
  return capabilityFor(file.language);
}

export interface CapabilityCoverage {
  total: number;
  /** Files whose language can currently be reconstructed into simulatable logic. */
  reconstructable: number;
  /** Files recognized and parsed for metadata/display only (e.g. XDC). */
  readOnly: number;
  /** Files carried verbatim without parsing (opaque / unsupported). */
  opaque: number;
}

/** Summarize a source model by what RedByte can do with each file today. */
export function summarizeModelCapabilities(model: ProjectSourceModel): CapabilityCoverage {
  let reconstructable = 0;
  let readOnly = 0;
  let opaque = 0;
  for (const file of model.files) {
    const capability = capabilityForFile(file);
    if (isReconstructable(file.language)) reconstructable += 1;
    else if (capability.tier === 'read-only' && capability.status === 'available') readOnly += 1;
    else opaque += 1;
  }
  return { total: model.files.length, reconstructable, readOnly, opaque };
}
