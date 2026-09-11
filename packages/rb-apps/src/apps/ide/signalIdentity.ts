import {
  normalizeSignalKey,
  type VerifyEvidenceIoRow,
  type VerifyEvidenceResolutionEntry,
} from './verifyReport';

// Engineering-object signal identity — a derived read model, not a store.
//
// A simulation run reports rows keyed by a canonical run-signal name (e.g. the
// Full Adder carry output arrives as "ld0carry"), while the authored boundary
// contract keys the same output by its field id ("ld0"). Relating the two by
// string containment ("ld0carry".includes("ld0")) is unsafe: it collides the
// moment a project contains ld0, ld0carry, ld0carry2, u0/ld0, output_ld0, or
// ld0[0]. The run *evidence already states the relationship explicitly* —
// `normalizationMap` role-'expected' entries map field id -> run signal, and
// `ioRows` map field id -> circuit nodeId. This module consumes that authority,
// prefers exact identity, keeps aliases explicit, and refuses to guess when a
// field's run signal is ambiguous. Case Lab, Waveform, Board, and Package are
// intended to resolve field<->signal through this one relationship.

/** How a field's run signal was established. */
export type SignalResolutionKind =
  | 'exact' // a run signal is byte-identical (after normalization) to the field id
  | 'evidence-expected' // normalizationMap role 'expected': field id -> matchedSignal
  | 'evidence-node' // ioRow field -> nodeId, then a role 'output' entry on that node
  | 'ambiguous' // more than one distinct authoritative candidate — surfaced, never guessed
  | 'unresolved'; // no authoritative relationship found

export interface ResolvedFieldSignal {
  readonly fieldId: string;
  /** The run-report signal key for this field, or null when ambiguous/unresolved. */
  readonly runSignal: string | null;
  readonly kind: SignalResolutionKind;
  /** Every distinct candidate run signal considered, for diagnostics/inspection. */
  readonly candidates: readonly string[];
  /** The circuit node id backing this field, when the evidence knows it. */
  readonly nodeId?: string;
}

export interface FieldSignalResolver {
  /** Resolve one field id to its run signal. Unknown fields resolve 'unresolved'. */
  resolve(fieldId: string): ResolvedFieldSignal;
  /** Every resolution, keyed by normalized field id. */
  readonly byField: ReadonlyMap<string, ResolvedFieldSignal>;
  /** Field ids whose run signal is ambiguous — callers should surface these. */
  readonly ambiguous: readonly string[];
}

/**
 * Canonical signal-id normalization. Mirrors the historical
 * `normalizeFieldId(normalizeSignalKey(x))` pipeline so this resolver agrees
 * with existing evidence keys: ':' becomes '.', then everything outside
 * [a-z0-9_] collapses to '_'. Normalization only decides *string equality* of
 * two candidate names; it never invents a containment relationship.
 */
export function normalizeSignalId(value: string): string {
  return normalizeSignalKey(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
}

interface ResolverInput {
  readonly fieldIds: readonly string[];
  readonly evidence?: {
    readonly ioRows?: readonly VerifyEvidenceIoRow[];
    readonly normalizationMap?: readonly VerifyEvidenceResolutionEntry[];
  };
  /** Distinct signals actually present in the run report rows. */
  readonly reportSignals?: readonly string[];
}

const UNRESOLVED = (fieldId: string): ResolvedFieldSignal => ({
  fieldId,
  runSignal: null,
  kind: 'unresolved',
  candidates: [],
});

/**
 * Build a field -> run-signal resolver from run evidence and the report's
 * signal set. Resolution precedence, each authoritative and containment-free:
 *
 *   1. exact            — a report signal normalizes equal to the field id
 *   2. evidence-expected — normalizationMap role 'expected' rawKey == field id
 *   3. evidence-node     — ioRow field -> nodeId, role 'output' entry on the node
 *
 * A candidate only counts when it actually appears in `reportSignals` (when that
 * set is provided). If a field yields more than one distinct candidate signal,
 * or a run signal is claimed by more than one field, the field is 'ambiguous'
 * and its runSignal is null — the caller must surface it, not pick a winner.
 */
export function buildFieldSignalResolver(input: ResolverInput): FieldSignalResolver {
  const ioRows = input.evidence?.ioRows ?? [];
  const normalizationMap = input.evidence?.normalizationMap ?? [];
  const reportSignals = input.reportSignals ?? [];

  // Normalized report-signal index → the first raw report signal that produced
  // it (report rows already share one canonical key per signal).
  const reportByNorm = new Map<string, string>();
  for (const signal of reportSignals) {
    const key = normalizeSignalId(signal);
    if (key && !reportByNorm.has(key)) reportByNorm.set(key, signal);
  }
  const hasReportSet = reportByNorm.size > 0;
  const isReportSignal = (signal: string | null | undefined): signal is string => {
    if (!signal) return false;
    if (!hasReportSet) return true; // no report set to constrain against
    return reportByNorm.has(normalizeSignalId(signal));
  };
  const asReportSignal = (signal: string): string =>
    reportByNorm.get(normalizeSignalId(signal)) ?? signal;

  // field id -> nodeId, from the io boundary contract.
  const nodeByField = new Map<string, string>();
  for (const row of ioRows) {
    const key = normalizeSignalId(row.id);
    if (key && row.nodeId && !nodeByField.has(key)) nodeByField.set(key, row.nodeId);
  }

  // field id -> distinct expected-role run signals (the primary bridge).
  const expectedByField = new Map<string, Set<string>>();
  // node output signal (e.g. "ld0_node.in") -> the run signal that drives it.
  const runSignalByNodePort = new Map<string, Set<string>>();
  for (const entry of normalizationMap) {
    if (!entry.matchedSignal) continue;
    if (entry.role === 'expected') {
      const key = normalizeSignalId(entry.rawKey);
      const set = expectedByField.get(key) ?? new Set<string>();
      set.add(entry.matchedSignal);
      expectedByField.set(key, set);
    } else if (entry.role === 'output') {
      // rawKey is the run signal; matchedSignal is the node port it resolved to.
      const portKey = normalizeSignalId(entry.matchedSignal);
      const set = runSignalByNodePort.get(portKey) ?? new Set<string>();
      set.add(entry.rawKey);
      runSignalByNodePort.set(portKey, set);
    }
  }

  const resolveOne = (fieldId: string): ResolvedFieldSignal => {
    const key = normalizeSignalId(fieldId);
    const nodeId = nodeByField.get(key);
    const candidates = new Set<string>();

    // 1. exact — a report signal identical to the field id.
    let exact: string | null = null;
    if (reportByNorm.has(key)) {
      exact = reportByNorm.get(key) ?? null;
      if (exact) candidates.add(exact);
    }

    // 2. evidence-expected — the authoritative field -> signal link.
    const expected = new Set<string>();
    for (const signal of expectedByField.get(key) ?? []) {
      if (isReportSignal(signal)) {
        const canonical = asReportSignal(signal);
        expected.add(canonical);
        candidates.add(canonical);
      }
    }

    // 3. evidence-node — via the field's circuit node's .in/.out ports.
    const viaNode = new Set<string>();
    if (nodeId) {
      for (const port of [`${nodeId}.in`, `${nodeId}.out`]) {
        for (const signal of runSignalByNodePort.get(normalizeSignalId(port)) ?? []) {
          if (isReportSignal(signal)) {
            const canonical = asReportSignal(signal);
            viaNode.add(canonical);
            candidates.add(canonical);
          }
        }
      }
    }

    const distinct = new Set(Array.from(candidates, (c) => normalizeSignalId(c)));
    const candidateList = Array.from(candidates);

    if (distinct.size === 0) {
      return { fieldId, runSignal: null, kind: 'unresolved', candidates: [], nodeId };
    }
    if (distinct.size > 1) {
      return { fieldId, runSignal: null, kind: 'ambiguous', candidates: candidateList, nodeId };
    }

    // Exactly one distinct candidate — label it by the strongest source that
    // produced it (exact > evidence-expected > evidence-node).
    const only = candidateList[0];
    const onlyNorm = normalizeSignalId(only);
    let kind: SignalResolutionKind = 'evidence-node';
    if (exact && normalizeSignalId(exact) === onlyNorm) kind = 'exact';
    else if (Array.from(expected, (s) => normalizeSignalId(s)).includes(onlyNorm))
      kind = 'evidence-expected';
    else if (Array.from(viaNode, (s) => normalizeSignalId(s)).includes(onlyNorm))
      kind = 'evidence-node';
    return { fieldId, runSignal: only, kind, candidates: candidateList, nodeId };
  };

  const byField = new Map<string, ResolvedFieldSignal>();
  for (const fieldId of input.fieldIds) {
    byField.set(normalizeSignalId(fieldId), resolveOne(fieldId));
  }

  // Cross-field collision: if one run signal is the resolved signal of more than
  // one field, none of those fields may silently own it — demote them all to
  // ambiguous so the collision is surfaced rather than first-match-won.
  const ownersBySignal = new Map<string, string[]>();
  for (const resolution of byField.values()) {
    if (!resolution.runSignal) continue;
    const key = normalizeSignalId(resolution.runSignal);
    ownersBySignal.set(key, [...(ownersBySignal.get(key) ?? []), resolution.fieldId]);
  }
  for (const [, owners] of ownersBySignal) {
    if (owners.length <= 1) continue;
    for (const fieldId of owners) {
      const key = normalizeSignalId(fieldId);
      const prior = byField.get(key);
      if (prior) byField.set(key, { ...prior, runSignal: null, kind: 'ambiguous' });
    }
  }

  const ambiguous = Array.from(byField.values())
    .filter((r) => r.kind === 'ambiguous')
    .map((r) => r.fieldId);

  return {
    byField,
    ambiguous,
    resolve: (fieldId: string) => byField.get(normalizeSignalId(fieldId)) ?? UNRESOLVED(fieldId),
  };
}
