// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Module provenance tiers — how a design unit came to exist and what RedByte can
 * do with it. Every module the workbench shows carries exactly one tier, so the
 * UI can label it honestly (editable vs read-only vs preserved) and never imply
 * it can round-trip source it only preserved.
 *
 * Tiers, from most to least capable:
 * - `native-visual-editable` — authored in RedByte's visual hierarchy; the
 *   circuit is the source of truth; fully editable and simulatable.
 * - `source-editable`        — backed by a source file within a language subset
 *   RedByte can both reconstruct AND edit in place; edits re-derive the visual.
 * - `structural-read-only`   — backed by a source that reconstructs to a
 *   structural circuit but is not editable in place (imported RTL today).
 * - `opaque-preserved`       — backed by a recognized source RedByte cannot
 *   reconstruct; kept verbatim as evidence, not turned into logic.
 * - `missing`                — referenced by name but with no backing definition
 *   or source; a diagnostic, not a usable module.
 */

import type { SourceLanguage } from './projectSourceModel';
import { capabilityFor } from './languageCapability';

export type ModuleTier =
  | 'native-visual-editable'
  | 'source-editable'
  | 'structural-read-only'
  | 'opaque-preserved'
  | 'missing';

/** Reconstruction outcome for a source-backed module (mirrors import ReconstructionLevel + none). */
export type ModuleReconstruction = 'full' | 'ports-only' | 'empty' | 'none';

export interface ModuleTierInput {
  /** True when the module exists in the native visual hierarchy. */
  isNativeVisual: boolean;
  /** True when a source file backs the module. */
  hasBackingSource: boolean;
  /** Language of the backing source, when any. */
  backingLanguage?: SourceLanguage;
  /** How faithfully the backing source reconstructed into a circuit. */
  reconstruction?: ModuleReconstruction;
}

export interface ModuleTierResult {
  tier: ModuleTier;
  /** Can the module be edited (visually or as source) and re-derived? */
  editable: boolean;
  /** Can the module feed the browser logic provider? */
  simulatable: boolean;
  /** Honest one-line explanation of the classification. */
  rationale: string;
}

/**
 * Classify a module into its provenance tier. Native visual modules win — the
 * circuit is authoritative regardless of any backing source. Otherwise the tier
 * is decided by whether a source backs it, that source's language capability,
 * and how faithfully it reconstructed.
 */
export function classifyModuleTier(input: ModuleTierInput): ModuleTierResult {
  if (input.isNativeVisual) {
    return {
      tier: 'native-visual-editable',
      editable: true,
      simulatable: true,
      rationale: 'Authored in the native visual hierarchy; the circuit is the source of truth.',
    };
  }

  if (!input.hasBackingSource || !input.backingLanguage) {
    return {
      tier: 'missing',
      editable: false,
      simulatable: false,
      rationale: 'Referenced but has no native definition and no backing source.',
    };
  }

  const capability = capabilityFor(input.backingLanguage);
  const reconstruction = input.reconstruction ?? 'none';

  // A recognized-but-unreconstructable source is preserved, not turned into logic.
  if (
    reconstruction === 'none' ||
    reconstruction === 'empty' ||
    capability.tier === 'opaque-preserved' ||
    capability.tier === 'read-only' ||
    capability.tier === 'unsupported'
  ) {
    return {
      tier: 'opaque-preserved',
      editable: false,
      simulatable: false,
      rationale: `Backed by ${capability.displayName} that RedByte preserves verbatim but does not reconstruct.`,
    };
  }

  // A source that fully reconstructs AND whose language RedByte can edit in place
  // is source-editable. Today no language is editable in place, so imported RTL
  // lands as structural-read-only — this stays honest as editing support lands.
  if (reconstruction === 'full' && capability.editable) {
    return {
      tier: 'source-editable',
      editable: true,
      simulatable: capability.simulatable,
      rationale: `Backed by an editable ${capability.displayName} source within RedByte's supported subset.`,
    };
  }

  return {
    tier: 'structural-read-only',
    editable: false,
    simulatable: capability.simulatable && reconstruction === 'full',
    rationale:
      reconstruction === 'full'
        ? `Reconstructed from ${capability.displayName} into a structural circuit; the source is not edited in place.`
        : `Only the interface of the ${capability.displayName} source was reconstructed (ports-only).`,
  };
}

const TIER_RANK: Record<ModuleTier, number> = {
  'native-visual-editable': 0,
  'source-editable': 1,
  'structural-read-only': 2,
  'opaque-preserved': 3,
  missing: 4,
};

export function moduleTierRank(tier: ModuleTier): number {
  return TIER_RANK[tier];
}

const TIER_LABEL: Record<ModuleTier, string> = {
  'native-visual-editable': 'Native (visual)',
  'source-editable': 'Source (editable)',
  'structural-read-only': 'Structural (read-only)',
  'opaque-preserved': 'Opaque (preserved)',
  missing: 'Missing',
};

export function moduleTierLabel(tier: ModuleTier): string {
  return TIER_LABEL[tier];
}
