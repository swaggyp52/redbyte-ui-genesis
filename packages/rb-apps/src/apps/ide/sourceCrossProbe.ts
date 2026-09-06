// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Bidirectional source ↔ visual cross-probe index.
 *
 * A cross-probe link ties a design element (a hierarchy module, a circuit node,
 * a port, an instance, or a signal) to a location in a source file, so the
 * workbench can jump both ways: click a node → reveal the source range that
 * produced it; click a source range → highlight the design element it produced.
 *
 * This module is the pure data model + query layer. Populating links from parser
 * output is wired separately; the model deliberately holds only ids and ranges
 * so it can be built from any source (parsers, import, or hand authoring) and
 * round-trips deterministically.
 */

import type { SourcePosition, SourceRange } from './sourceDiagnostics';
import { compareRanges, rangeContainsPosition } from './sourceDiagnostics';

export type CrossProbeKind =
  | 'module'
  | 'port'
  | 'instance'
  | 'signal'
  | 'node'
  | 'connection'
  | 'constraint'
  | 'testbench-case'
  | 'requirement';

/**
 * Honest confidence of a source↔visual link:
 *   - exact       — a unique declaration was located with a precise range.
 *   - partial     — the element was matched by name but without a precise range.
 *   - ambiguous   — more than one candidate declaration matched the name.
 *   - unavailable — the design element has no backing source (native-only).
 *   - stale       — the link was computed against source that has since changed.
 * A link never claims more confidence than RedByte actually has.
 */
export type CrossProbeQuality = 'exact' | 'partial' | 'ambiguous' | 'unavailable' | 'stale';

export const CROSS_PROBE_QUALITY_ORDER: readonly CrossProbeQuality[] = [
  'exact',
  'partial',
  'ambiguous',
  'stale',
  'unavailable',
];

export function crossProbeQualityLabel(quality: CrossProbeQuality): string {
  switch (quality) {
    case 'exact':
      return 'Exact';
    case 'partial':
      return 'Partial';
    case 'ambiguous':
      return 'Ambiguous';
    case 'stale':
      return 'Stale';
    case 'unavailable':
      return 'Unavailable';
  }
}

/**
 * One-line explanation of a link-quality tier, for a row badge's tooltip so the
 * meaning travels with the relationship instead of a permanent legend key.
 */
export function crossProbeQualityDescription(quality: CrossProbeQuality): string {
  switch (quality) {
    case 'exact':
      return 'Exact — this design element is matched to one source location with full confidence.';
    case 'partial':
      return 'Partial — matched to source, but some detail (a port, a range) could not be confirmed.';
    case 'ambiguous':
      return 'Ambiguous — more than one source location could be this element; RedByte will not guess.';
    case 'stale':
      return 'Stale — the source changed since this link was resolved; re-open the source to refresh it.';
    case 'unavailable':
      return 'Unavailable — this element is native-only or has no source RedByte can read.';
  }
}

export interface CrossProbeLink {
  /** What the link represents on the design side. */
  kind: CrossProbeKind;
  /** Hierarchy module id the element belongs to (or the top module). */
  moduleId?: string;
  /** Circuit node id, when the element is (or maps to) a node. */
  nodeId?: string;
  /** Stable design-element key (e.g. a port or signal name) when not a node. */
  elementKey?: string;
  /** The backing source file id. */
  sourceId: string;
  /** Location within the source, when known. */
  range?: SourceRange;
  /** Honest confidence of the link. Absent is treated as `partial`. */
  quality?: CrossProbeQuality;
  /** Optional human label for the link. */
  label?: string;
}

export interface CrossProbeIndex {
  links: readonly CrossProbeLink[];
}

export const EMPTY_CROSS_PROBE_INDEX: CrossProbeIndex = Object.freeze({ links: Object.freeze([]) });

function linkSortKey(link: CrossProbeLink): string {
  return [
    link.sourceId,
    link.range ? String(link.range.start.line).padStart(8, '0') : '99999999',
    link.range ? String(link.range.start.column).padStart(8, '0') : '99999999',
    link.kind,
    link.moduleId ?? '',
    link.nodeId ?? '',
    link.elementKey ?? '',
  ].join(' ');
}

/**
 * Build a normalized index: drops links without a sourceId, and sorts
 * deterministically by source, then range, then kind/target — so serialization
 * and rendering are stable.
 */
export function buildCrossProbeIndex(links: readonly CrossProbeLink[]): CrossProbeIndex {
  const cleaned = links.filter((link) => typeof link.sourceId === 'string' && link.sourceId.length > 0);
  const sorted = cleaned.slice().sort((a, b) => {
    const keyA = linkSortKey(a);
    const keyB = linkSortKey(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  return { links: sorted };
}

/** All links whose design element belongs to `moduleId`. */
export function linksForModule(index: CrossProbeIndex, moduleId: string): CrossProbeLink[] {
  return index.links.filter((link) => link.moduleId === moduleId);
}

/** All links that map to circuit node `nodeId`. */
export function linksForNode(index: CrossProbeIndex, nodeId: string): CrossProbeLink[] {
  return index.links.filter((link) => link.nodeId === nodeId);
}

/** All links backed by source file `sourceId`, in source order. */
export function linksForSource(index: CrossProbeIndex, sourceId: string): CrossProbeLink[] {
  return index.links
    .filter((link) => link.sourceId === sourceId)
    .sort((a, b) => {
      if (a.range && b.range) return compareRanges(a.range, b.range);
      if (a.range) return -1;
      if (b.range) return 1;
      return 0;
    });
}

/**
 * The most specific link at a source position: among links in the file whose
 * range contains the position, the one with the smallest (innermost) range.
 * Enables click-in-source → highlight-in-design.
 */
export function linkAtSourcePosition(
  index: CrossProbeIndex,
  sourceId: string,
  position: SourcePosition
): CrossProbeLink | undefined {
  let best: CrossProbeLink | undefined;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (const link of index.links) {
    if (link.sourceId !== sourceId || !link.range) continue;
    if (!rangeContainsPosition(link.range, position)) continue;
    const span = rangeSpan(link.range);
    if (span < bestSpan) {
      best = link;
      bestSpan = span;
    }
  }
  return best;
}

/**
 * The design element(s) a source range maps to — the reverse probe used to
 * highlight the canvas when a source region is selected. Returns links in the
 * file that overlap the given range.
 */
export function designTargetsForRange(index: CrossProbeIndex, sourceId: string, range: SourceRange): CrossProbeLink[] {
  return index.links.filter(
    (link) => link.sourceId === sourceId && link.range !== undefined && rangesOverlap(link.range, range)
  );
}

function rangeSpan(range: SourceRange): number {
  const lineDelta = range.end.line - range.start.line;
  if (lineDelta !== 0) return lineDelta * 100000;
  return range.end.column - range.start.column;
}

function rangesOverlap(a: SourceRange, b: SourceRange): boolean {
  // a.start <= b.end && b.start <= a.end
  return (
    compareRangePositions(a.start, b.end) <= 0 && compareRangePositions(b.start, a.end) <= 0
  );
}

function compareRangePositions(a: SourcePosition, b: SourcePosition): number {
  if (a.line !== b.line) return a.line - b.line;
  return a.column - b.column;
}
