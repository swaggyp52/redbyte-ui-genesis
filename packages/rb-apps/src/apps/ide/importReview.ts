// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Import review-before-apply contract.
 *
 * Import is a *review* program, not a silent load. Given what an import would
 * bring in, this builds a plan describing exactly what applying it *would* do —
 * which sources become which fileset at which capability tier, what is blocked,
 * and whether the user must confirm — WITHOUT applying anything. Three
 * invariants are encoded structurally and can never be flipped by a caller:
 *
 *   - `executesTcl` is always `false` — RedByte never runs imported Tcl.
 *   - `mutatesInspectedSource` is always `false` — inspecting never edits source.
 *   - Replacing an existing project always `requiresConfirmation` — no silent
 *     replacement of the user's work.
 */

import { defaultFilesetForLanguage, detectSourceLanguage, type FilesetKind, type SourceLanguage } from './projectSourceModel';
import { capabilityFor, type SourceCapabilityTier } from './languageCapability';

export type ImportApplyKind = 'create-new' | 'replace-current';
export type ImportSourceAction = 'add' | 'preserve-opaque' | 'skip';

export interface ImportSourceInput {
  path: string;
  language?: SourceLanguage;
  /** How faithfully this source reconstructed, when it is HDL. */
  reconstruction?: 'full' | 'ports-only' | 'empty' | 'none';
}

export interface ImportSourcePlan {
  path: string;
  language: SourceLanguage;
  fileset: FilesetKind;
  tier: SourceCapabilityTier;
  action: ImportSourceAction;
  /** True for Tcl — surfaced so the UI can state it will never be executed. */
  neverExecuted: boolean;
  reason: string;
}

export interface ImportReviewInput {
  sources: ImportSourceInput[];
  /** Whether a project is currently loaded (→ replace vs create). */
  hasCurrentProject: boolean;
  /** Blocking reasons already detected (behavioral HDL, empty reconstruction, …). */
  blockers?: string[];
  /** Non-blocking warnings to carry into the review. */
  warnings?: string[];
}

export interface ImportReviewPlan {
  applyKind: ImportApplyKind;
  willReplaceExisting: boolean;
  sources: ImportSourcePlan[];
  blockers: string[];
  warnings: string[];
  /** Review-before-apply: true when replacing existing work or any blocker exists. */
  requiresConfirmation: boolean;
  /** True only when there are no blockers (apply is otherwise permitted). */
  canApply: boolean;
  /** Structural invariant — RedByte never executes imported Tcl. */
  readonly executesTcl: false;
  /** Structural invariant — inspecting an import never mutates its source. */
  readonly mutatesInspectedSource: false;
}

function planForSource(input: ImportSourceInput): ImportSourcePlan {
  const path = input.path.trim();
  const language = input.language ?? detectSourceLanguage(path);
  const capability = capabilityFor(language);
  const fileset = defaultFilesetForLanguage(language);
  const reconstruction = input.reconstruction ?? 'none';
  const neverExecuted = language === 'tcl';

  let action: ImportSourceAction;
  let reason: string;

  if (capability.tier === 'structural-subset' && capability.status === 'available') {
    if (reconstruction === 'empty' || reconstruction === 'none') {
      action = 'preserve-opaque';
      reason = `${capability.displayName} source could not be reconstructed; preserved verbatim.`;
    } else {
      action = 'add';
      reason = `${capability.displayName} source added to the ${fileset} fileset (${reconstruction} reconstruction).`;
    }
  } else if (capability.tier === 'read-only' && capability.status === 'available') {
    action = 'add';
    reason = `${capability.displayName} added to the ${fileset} fileset (read-only).`;
  } else if (language === 'tcl') {
    action = 'add';
    reason = 'Tcl added to the utility fileset — preserved for reference and never executed.';
  } else {
    action = 'preserve-opaque';
    reason = `${capability.displayName} is not reconstructable; preserved verbatim.`;
  }

  return { path, language, fileset, tier: capability.tier, action, neverExecuted, reason };
}

/**
 * Build a review plan for an import. Pure: it never applies anything, executes
 * nothing, and mutates no source.
 */
export function buildImportReviewPlan(input: ImportReviewInput): ImportReviewPlan {
  const sources = input.sources.filter((s) => s.path.trim().length > 0).map(planForSource);
  const blockers = [...(input.blockers ?? [])].map((b) => b.trim()).filter(Boolean);
  const warnings = [...(input.warnings ?? [])].map((w) => w.trim()).filter(Boolean);
  const applyKind: ImportApplyKind = input.hasCurrentProject ? 'replace-current' : 'create-new';
  const willReplaceExisting = applyKind === 'replace-current';
  const canApply = blockers.length === 0;
  // No silent replacement: replacing existing work always needs confirmation,
  // as does any blocked import (so the user sees why it cannot proceed).
  const requiresConfirmation = willReplaceExisting || blockers.length > 0;

  return {
    applyKind,
    willReplaceExisting,
    sources,
    blockers,
    warnings,
    requiresConfirmation,
    canApply,
    executesTcl: false,
    mutatesInspectedSource: false,
  };
}

/** A short human summary of the plan for the review header. */
export function summarizeImportReview(plan: ImportReviewPlan): string {
  const added = plan.sources.filter((s) => s.action === 'add').length;
  const preserved = plan.sources.filter((s) => s.action === 'preserve-opaque').length;
  const verb = plan.willReplaceExisting ? 'Replace current project' : 'Create new project';
  const parts = [`${verb}`, `${added} source${added === 1 ? '' : 's'} added`];
  if (preserved > 0) parts.push(`${preserved} preserved`);
  if (plan.blockers.length > 0) parts.push(`${plan.blockers.length} blocker${plan.blockers.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
