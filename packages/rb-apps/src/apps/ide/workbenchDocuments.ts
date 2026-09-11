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
 * **A tab is another object inside the workspace that owns it.** Visiting a
 * workspace is not opening a document — the left rail owns workspace
 * navigation, and each workspace's own root view is the workspace itself. What
 * earns a tab is a second module or source in Design, another scenario in
 * Simulate, a file preview or the report in Package. Project and Board have no
 * root tab, and neither does the workspace you are already in.
 *
 * **A scenario is one workbench.** `cases`, `timing` and `waveform` used to be
 * three documents describing one experiment through three rendering
 * techniques, which is how "Default — Timing" and "Default — Waveform" came to
 * sit side by side in the tab row as though they were separate work. They are
 * one `scenario` document whose presentation is view state.
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
  /**
   * One experiment: its authored stimulus, its optional checks, its selected
   * run, and the presentation the reader last chose for it. Table, timing and
   * waveform are representations of this one document, not documents.
   */
  | { readonly kind: 'scenario'; readonly scenarioId: string }
  | { readonly kind: 'board-io'; readonly constraintSetId: string }
  /** The operational package landing: what you can obtain and what is left to do. */
  | { readonly kind: 'package' }
  /** One generated file, opened deliberately for inspection. */
  | { readonly kind: 'package-artifact' }
  /** The engineering handoff report, opened deliberately (in-app only). */
  | { readonly kind: 'handoff' };

export type WorkbenchDocumentKind = WorkbenchDocument['kind'];

/**
 * How a scenario workbench is currently drawn. This is view state, not
 * identity: switching representation does not change which experiment is open,
 * and it never opens a second tab.
 */
export type ScenarioView = 'table' | 'timing' | 'waveform';

/** Stable identity for open-list membership, activation, and test ids. */
export function documentKey(doc: WorkbenchDocument): string {
  switch (doc.kind) {
    case 'project-overview':
    case 'architecture':
    case 'runs':
    case 'sources':
    case 'compile-order':
    case 'package':
    case 'package-artifact':
    case 'handoff':
      return doc.kind;
    case 'source-file':
      return `source-file:${doc.fileId}`;
    case 'schematic':
      return `schematic:${doc.moduleId}`;
    case 'scenario':
      return `scenario:${doc.scenarioId}`;
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
    case 'scenario':
      return 'verify';
    case 'board-io':
      return 'hardware';
    case 'package':
    case 'package-artifact':
    case 'handoff':
      return 'export';
  }
}

/**
 * The document a workspace shows when you simply arrive there. A root is not a
 * tab: it is the workspace. Only documents beyond the root earn a tab, which is
 * what stops the strip from growing one entry per workspace visited.
 */
export function isWorkspaceRoot(doc: WorkbenchDocument): boolean {
  switch (doc.kind) {
    case 'project-overview':
    case 'board-io':
    case 'package':
      return true;
    default:
      return false;
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
    case 'scenario':
      return 'Scenario';
    case 'board-io':
      return 'I/O Planning';
    case 'package':
      return 'Package';
    case 'package-artifact':
      return 'File';
    case 'handoff':
      return 'Report';
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
      case 'package':
      case 'package-artifact':
      case 'handoff':
        return true;
      case 'source-file':
        return snapshot.fileIds.has(doc.fileId);
      case 'schematic':
        return doc.moduleId === 'top' || snapshot.moduleIds.has(doc.moduleId);
      case 'scenario':
        return snapshot.scenarioIds.has(doc.scenarioId);
      case 'board-io':
        return doc.constraintSetId === 'default' || snapshot.constraintSetIds.has(doc.constraintSetId);
    }
  });
}

/**
 * Parse one persisted descriptor; null for anything unknown or malformed.
 *
 * `cases`, `timing` and `waveform` were three descriptors for one experiment.
 * A stored session carrying any of them resolves into that scenario's
 * workbench rather than losing the reference — the reader had a scenario open,
 * and they still do. The store dedupes by key, so a session with all three
 * collapses to one tab.
 */
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
    case 'package':
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
    case 'scenario':
    case 'cases':
    case 'timing':
    case 'waveform': {
      const scenarioId = str('scenarioId');
      return scenarioId ? { kind: 'scenario', scenarioId } : null;
    }
    case 'board-io': {
      const constraintSetId = str('constraintSetId');
      return constraintSetId ? { kind: 'board-io', constraintSetId } : null;
    }
    default:
      return null;
  }
}

/** The representation a stored `cases`/`timing`/`waveform` descriptor implied. */
export function migratedScenarioView(kind: unknown): ScenarioView | null {
  if (kind === 'cases') return 'table';
  if (kind === 'timing') return 'timing';
  if (kind === 'waveform') return 'waveform';
  return null;
}
