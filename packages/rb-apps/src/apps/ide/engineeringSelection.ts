import { create } from 'zustand';
import type { SourceRange } from './sourceDiagnostics';
import type { WorkbenchDocumentKind } from './workbenchDocuments';

/**
 * Global engineering-object selection — the one place the workbench remembers
 * "what is selected" across documents (schematic node, signal, case, board
 * resource, source range, artifact, module, scenario, run, problem).
 *
 * A read-model, never persisted, never an authority: selecting an object does
 * not change project data, and consumers read the referenced object live from
 * its canonical owner.
 *
 * Signal identity rule: `fieldId` is the canonical identity (the boundary
 * contract field). A cached `runSignal` may be populated ONLY from a
 * signalIdentity resolution of kind 'exact' / 'evidence-expected' /
 * 'evidence-node'. Ambiguous or unresolved fields carry runSignal: null and
 * consumers must surface that state — never guess a lane by string matching.
 */

export type EngineeringObjectRef =
  | { readonly kind: 'project' }
  | {
      readonly kind: 'signal';
      readonly fieldId: string;
      readonly runSignal: string | null;
      readonly nodeId?: string;
    }
  | { readonly kind: 'node'; readonly moduleId: string; readonly nodeId: string }
  | { readonly kind: 'module'; readonly moduleId: string }
  | { readonly kind: 'component'; readonly componentName: string }
  | { readonly kind: 'macro'; readonly macroId: string; readonly macroName: string }
  | { readonly kind: 'scenario'; readonly scenarioId: string }
  | { readonly kind: 'case-tick'; readonly scenarioId: string; readonly tick: number }
  | { readonly kind: 'signal-edge'; readonly fieldId: string; readonly tick: number }
  | {
      readonly kind: 'board-resource';
      readonly constraintSetId: string;
      readonly pin: string;
    }
  | { readonly kind: 'constraint-set'; readonly constraintSetId: string }
  | { readonly kind: 'source-range'; readonly fileId: string; readonly range: SourceRange }
  | { readonly kind: 'artifact'; readonly artifactId: string }
  | { readonly kind: 'run'; readonly runId: string }
  | { readonly kind: 'problem'; readonly problemId: string };

/** Where a selection came from — consumers skip echoes of their own selections. */
export type SelectionOrigin = WorkbenchDocumentKind | 'explorer' | 'status-bar' | 'inspector' | 'bottom-panel' | 'navigator' | 'problems';

interface EngineeringSelectionState {
  selected: EngineeringObjectRef | null;
  origin: SelectionOrigin | null;
  select: (ref: EngineeringObjectRef, origin: SelectionOrigin) => void;
  clear: () => void;
}

export const useEngineeringSelection = create<EngineeringSelectionState>((set) => ({
  selected: null,
  origin: null,
  select: (ref, origin) => set({ selected: ref, origin }),
  clear: () => set({ selected: null, origin: null }),
}));

/** Structural equality for refs, so consumers can skip redundant updates. */
export function sameEngineeringObject(a: EngineeringObjectRef | null, b: EngineeringObjectRef | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Compact status-bar path for the selected object, e.g. `full_adder / ld0`. */
export function describeEngineeringObject(ref: EngineeringObjectRef): string {
  switch (ref.kind) {
    case 'project':
      return 'project';
    case 'signal':
      return ref.runSignal && ref.runSignal !== ref.fieldId
        ? `${ref.fieldId} → ${ref.runSignal}`
        : ref.fieldId;
    case 'node':
      return ref.moduleId === 'top' ? ref.nodeId : `${ref.moduleId} / ${ref.nodeId}`;
    case 'module':
      return ref.moduleId === 'top' ? 'top' : ref.moduleId;
    case 'component':
      return ref.componentName;
    case 'macro':
      return ref.macroName;
    case 'scenario':
      return `scenario ${ref.scenarioId}`;
    case 'case-tick':
      return `${ref.scenarioId} · t${ref.tick}`;
    case 'signal-edge':
      return `${ref.fieldId} @ tick ${ref.tick}`;
    case 'board-resource':
      return `pin ${ref.pin}`;
    case 'constraint-set':
      return ref.constraintSetId === 'default' ? 'constraints' : ref.constraintSetId;
    case 'source-range':
      return `${ref.fileId}:${ref.range.start.line}`;
    case 'artifact':
      return ref.artifactId;
    case 'run':
      return `run ${ref.runId.slice(0, 8)}`;
    case 'problem':
      return ref.problemId;
  }
}
