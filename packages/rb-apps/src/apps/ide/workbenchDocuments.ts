import type { IdeMode } from './workflowStages';

/**
 * Workbench documents — the typed vocabulary of the multi-document host.
 *
 * A document is a DESCRIPTOR: a typed reference into an existing canonical
 * authority (project runtime, source model, hierarchy, scenarios, constraint
 * sets, package projection). It never stores content. The document host only
 * remembers which references are open and which one is active; everything the
 * document displays is read live from its authority, so a tab can never drift
 * from project truth.
 *
 * The union grows one workspace at a time as each surface migrates onto the
 * host. Only kinds a surface can honestly render belong here — a tab must
 * never open a view that does not exist yet.
 */
export type WorkbenchDocument =
  | { readonly kind: 'project-overview' }
  /** Module tree, block view and interface table over the same hierarchy Design uses. */
  | { readonly kind: 'architecture' }
  /** Run ledger and actual diagnostics. */
  | { readonly kind: 'runs' }
  | { readonly kind: 'sources' }
  | { readonly kind: 'source-file'; readonly fileId: string }
  | { readonly kind: 'compile-order' }
  | { readonly kind: 'schematic'; readonly moduleId: string }
  /** Combinational scenario as a truth-table instrument (Case Lab). */
  | { readonly kind: 'cases'; readonly scenarioId: string }
  /** Sequential scenario as a clock/edge instrument (Timing Lab). */
  | { readonly kind: 'timing'; readonly scenarioId: string }
  /** Recorded run evidence for a scenario (Waveform). */
  | { readonly kind: 'waveform'; readonly scenarioId: string }
  | { readonly kind: 'board-io'; readonly constraintSetId: string }
  | { readonly kind: 'package-artifact' }
  /** The engineering handoff overview derived from canonical evidence (in-app only). */
  | { readonly kind: 'handoff' };

export type WorkbenchDocumentKind = WorkbenchDocument['kind'];

/** Stable identity for open-list membership, activation, and test ids. */
export function documentKey(doc: WorkbenchDocument): string {
  switch (doc.kind) {
    case 'project-overview':
    case 'architecture':
    case 'runs':
    case 'sources':
    case 'compile-order':
    case 'package-artifact':
    case 'handoff':
      return doc.kind;
    case 'source-file':
      return `source-file:${doc.fileId}`;
    case 'schematic':
      return `schematic:${doc.moduleId}`;
    case 'cases':
      return `cases:${doc.scenarioId}`;
    case 'timing':
      return `timing:${doc.scenarioId}`;
    case 'waveform':
      return `waveform:${doc.scenarioId}`;
    case 'board-io':
      return `board-io:${doc.constraintSetId}`;
  }
}

/**
 * Every document belongs to exactly one workspace. Activating a document
 * activates its workspace; IdeApp stays the single owner of `currentMode` and
 * applies the change (the engineeringLocation "shell records, owner applies"
 * pattern).
 */
export function documentMode(doc: WorkbenchDocument): IdeMode {
  switch (doc.kind) {
    case 'project-overview':
    case 'architecture':
    case 'runs':
    case 'sources':
    case 'source-file':
    case 'compile-order':
      return 'project';
    case 'schematic':
      return 'design';
    case 'cases':
    case 'timing':
    case 'waveform':
      return 'verify';
    case 'board-io':
      return 'hardware';
    case 'package-artifact':
    case 'handoff':
      return 'export';
  }
}

/**
 * Label used when the live authority cannot name the reference (e.g. before
 * the project snapshot is available). Callers with authority access should
 * prefer real names — module display names, scenario names, file names.
 */
export function fallbackDocumentLabel(doc: WorkbenchDocument): string {
  switch (doc.kind) {
    case 'project-overview':
      return 'Overview';
    case 'architecture':
      return 'Architecture';
    case 'runs':
      return 'Runs';
    case 'sources':
      return 'Sources';
    case 'source-file':
      return doc.fileId;
    case 'compile-order':
      return 'Compile Order';
    case 'schematic':
      return doc.moduleId === 'top' ? 'Schematic' : `${doc.moduleId} — Schematic`;
    case 'cases':
      return 'Cases';
    case 'timing':
      return 'Timing';
    case 'waveform':
      return 'Waveform';
    case 'board-io':
      return 'I/O Planning';
    case 'package-artifact':
      return 'Package';
    case 'handoff':
      return 'Handoff';
  }
}

/** Live ids a persisted descriptor may reference. Absent id ⇒ the tab drops. */
export interface WorkbenchDocumentSnapshot {
  readonly moduleIds: ReadonlySet<string>;
  readonly scenarioIds: ReadonlySet<string>;
  readonly fileIds: ReadonlySet<string>;
  readonly constraintSetIds: ReadonlySet<string>;
}

/**
 * Drop descriptors whose authority no longer contains the referenced object.
 * Static kinds (overview, sources, compile order, package) always survive.
 * Runs on project load/replace so a persisted tab can never outlive its truth.
 */
export function pruneDocuments(
  docs: readonly WorkbenchDocument[],
  snapshot: WorkbenchDocumentSnapshot
): readonly WorkbenchDocument[] {
  return docs.filter((doc) => {
    switch (doc.kind) {
      case 'project-overview':
      case 'architecture':
      case 'runs':
      case 'sources':
      case 'compile-order':
      case 'package-artifact':
      case 'handoff':
        return true;
      case 'source-file':
        return snapshot.fileIds.has(doc.fileId);
      case 'schematic':
        return doc.moduleId === 'top' || snapshot.moduleIds.has(doc.moduleId);
      case 'cases':
      case 'timing':
      case 'waveform':
        return snapshot.scenarioIds.has(doc.scenarioId);
      case 'board-io':
        return doc.constraintSetId === 'default' || snapshot.constraintSetIds.has(doc.constraintSetId);
    }
  });
}

/** Parse one persisted descriptor; null for anything unknown or malformed. */
export function parseWorkbenchDocument(value: unknown): WorkbenchDocument | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const str = (key: string): string | null =>
    typeof raw[key] === 'string' && (raw[key] as string).length > 0 ? (raw[key] as string) : null;
  switch (raw.kind) {
    case 'project-overview':
    case 'architecture':
    case 'runs':
    case 'sources':
    case 'compile-order':
    case 'package-artifact':
    case 'handoff':
      return { kind: raw.kind };
    case 'source-file': {
      const fileId = str('fileId');
      return fileId ? { kind: 'source-file', fileId } : null;
    }
    case 'schematic': {
      const moduleId = str('moduleId');
      return moduleId ? { kind: 'schematic', moduleId } : null;
    }
    case 'cases':
    case 'timing':
    case 'waveform': {
      const scenarioId = str('scenarioId');
      return scenarioId ? { kind: raw.kind, scenarioId } : null;
    }
    case 'board-io': {
      const constraintSetId = str('constraintSetId');
      return constraintSetId ? { kind: 'board-io', constraintSetId } : null;
    }
    default:
      return null;
  }
}
