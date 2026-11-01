import { describe, expect, it, beforeEach } from 'vitest';
import {
  documentKey,
  isWorkspaceRoot,
  documentMode,
  fallbackDocumentLabel,
  parseWorkbenchDocument,
  pruneDocuments,
  type WorkbenchDocument,
} from '../workbenchDocuments';
import {
  useWorkbenchDocuments,
  WORKBENCH_DOCUMENTS_STORAGE_KEY,
} from '../workbenchDocumentStore';
import { useEngineeringSelection } from '../engineeringSelection';

const ALL_KINDS: WorkbenchDocument[] = [
  { kind: 'project-overview' },
  { kind: 'sources' },
  { kind: 'source-file', fileId: 'top.vhd' },
  { kind: 'compile-order' },
  { kind: 'schematic', moduleId: 'half_adder' },
  { kind: 'scenario', scenarioId: 'scn-1' },
  { kind: 'board-io', constraintSetId: 'xdc-main' },
  { kind: 'package-artifact' },
];

describe('workbenchDocuments (pure model)', () => {
  it('gives every kind a stable unique key and a workspace mode', () => {
    const keys = ALL_KINDS.map(documentKey);
    expect(new Set(keys).size).toBe(ALL_KINDS.length);
    for (const doc of ALL_KINDS) {
      expect(['project', 'design', 'verify', 'hardware', 'export']).toContain(
        documentMode(doc)
      );
      expect(fallbackDocumentLabel(doc).length).toBeGreaterThan(0);
    }
  });

  it('maps parameterized documents to their workspace', () => {
    expect(documentMode({ kind: 'schematic', moduleId: 'm1' })).toBe('design');
    expect(documentMode({ kind: 'scenario', scenarioId: 's1' })).toBe('verify');
    expect(documentMode({ kind: 'board-io', constraintSetId: 'c1' })).toBe('hardware');
    expect(documentMode({ kind: 'sources' })).toBe('project');
  });

  it('prunes descriptors whose referenced object is gone, keeps static kinds', () => {
    const pruned = pruneDocuments(ALL_KINDS, {
      moduleIds: new Set<string>(),
      scenarioIds: new Set(['scn-1']),
      fileIds: new Set<string>(),
      constraintSetIds: new Set<string>(),
    });
    const keys = pruned.map(documentKey);
    expect(keys).toContain('project-overview');
    expect(keys).toContain('sources');
    expect(keys).toContain('compile-order');
    expect(keys).toContain('package-artifact');
    expect(keys).toContain('scenario:scn-1');
    expect(keys).not.toContain('schematic:half_adder');
    expect(keys).not.toContain('source-file:top.vhd');
    expect(keys).not.toContain('board-io:xdc-main');
  });

  it('keeps the top schematic even without a hierarchy module entry', () => {
    const pruned = pruneDocuments([{ kind: 'schematic', moduleId: 'top' }], {
      moduleIds: new Set<string>(),
      scenarioIds: new Set<string>(),
      fileIds: new Set<string>(),
      constraintSetIds: new Set<string>(),
    });
    expect(pruned).toHaveLength(1);
  });

  it('rejects malformed persisted descriptors instead of guessing', () => {
    expect(parseWorkbenchDocument({ kind: 'schematic' })).toBeNull();
    expect(parseWorkbenchDocument({ kind: 'unknown-kind' })).toBeNull();
    expect(parseWorkbenchDocument('schematic:top')).toBeNull();
    expect(parseWorkbenchDocument({ kind: 'scenario', scenarioId: 's1' })).toEqual({
      kind: 'scenario',
      scenarioId: 's1',
    });
  });

  // A reader whose stored session had `Default — Timing` and `Default — Waveform` open had one
  // experiment open, and they still do. The descriptors resolve into that scenario's workbench
  // rather than being discarded as unknown kinds, and three of them are one tab.
  it('resolves retired cases/timing/waveform descriptors into their scenario workbench', () => {
    for (const kind of ['cases', 'timing', 'waveform'] as const) {
      expect(parseWorkbenchDocument({ kind, scenarioId: 's1' })).toEqual({
        kind: 'scenario',
        scenarioId: 's1',
      });
    }
    const keys = (['cases', 'timing', 'waveform'] as const).map((kind) =>
      documentKey(parseWorkbenchDocument({ kind, scenarioId: 's1' })!)
    );
    expect(new Set(keys).size).toBe(1);
  });

  // The rail owns workspace navigation, so a workspace's own root view is never a tab.
  it('names the workspace roots that are the workspace rather than a tab in it', () => {
    expect(isWorkspaceRoot({ kind: 'project-overview' })).toBe(true);
    expect(isWorkspaceRoot({ kind: 'board-io', constraintSetId: 'default' })).toBe(true);
    expect(isWorkspaceRoot({ kind: 'package' })).toBe(true);
    expect(isWorkspaceRoot({ kind: 'scenario', scenarioId: 's1' })).toBe(false);
    expect(isWorkspaceRoot({ kind: 'handoff' })).toBe(false);
  });
});

describe('workbenchDocumentStore', () => {
  beforeEach(() => {
    window.localStorage.removeItem(WORKBENCH_DOCUMENTS_STORAGE_KEY);
    useWorkbenchDocuments.getState().reset();
  });

  it('starts with the pinned overview and cannot close it', () => {
    const store = useWorkbenchDocuments.getState();
    expect(store.open.map(documentKey)).toEqual(['project-overview']);
    store.closeDocument('project-overview');
    expect(useWorkbenchDocuments.getState().open).toHaveLength(1);
  });

  it('opens, re-activates instead of duplicating, and closes to the neighbor', () => {
    const store = useWorkbenchDocuments.getState();
    store.openDocument({ kind: 'sources' });
    store.openDocument({ kind: 'compile-order' });
    store.openDocument({ kind: 'sources' });
    let state = useWorkbenchDocuments.getState();
    expect(state.open.map(documentKey)).toEqual([
      'project-overview',
      'sources',
      'compile-order',
    ]);
    expect(state.activeKey).toBe('sources');

    state.activateDocument('compile-order');
    useWorkbenchDocuments.getState().closeDocument('compile-order');
    state = useWorkbenchDocuments.getState();
    expect(state.open.map(documentKey)).toEqual(['project-overview', 'sources']);
    expect(state.activeKey).toBe('sources');
  });

  it('activateForMode prefers the remembered document, else opens the default', () => {
    const store = useWorkbenchDocuments.getState();
    store.openDocument({ kind: 'schematic', moduleId: 'half_adder' });
    store.openDocument({ kind: 'sources' });
    // Mode change back to design: remembered schematic reactivates, no new tab.
    const reactivated = useWorkbenchDocuments
      .getState()
      .activateForMode('design', () => ({ kind: 'schematic', moduleId: 'top' }));
    expect(reactivated && documentKey(reactivated)).toBe('schematic:half_adder');
    expect(useWorkbenchDocuments.getState().open).toHaveLength(3);
    // Mode with no open document: the default opens.
    const created = useWorkbenchDocuments
      .getState()
      .activateForMode('verify', () => ({ kind: 'scenario', scenarioId: 's1' }));
    expect(created && documentKey(created)).toBe('scenario:s1');
    expect(useWorkbenchDocuments.getState().activeKey).toBe('scenario:s1');
    // A mode that hosts no documents yields null and changes nothing.
    const none = useWorkbenchDocuments.getState().activateForMode('import', () => null);
    expect(none).toBeNull();
  });

  it('syncToProject drops tabs whose objects are gone and repairs the active key', () => {
    const store = useWorkbenchDocuments.getState();
    store.openDocument({ kind: 'scenario', scenarioId: 'stale' });
    useWorkbenchDocuments.getState().syncToProject({
      moduleIds: new Set<string>(),
      scenarioIds: new Set<string>(),
      fileIds: new Set<string>(),
      constraintSetIds: new Set<string>(),
    });
    const state = useWorkbenchDocuments.getState();
    expect(state.open.map(documentKey)).toEqual(['project-overview']);
    expect(state.activeKey).toBe('project-overview');
  });

  it('persists descriptors + active key across a rehydrate', () => {
    useWorkbenchDocuments.getState().openDocument({ kind: 'sources' });
    const raw = window.localStorage.getItem(WORKBENCH_DOCUMENTS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as {
      version: number;
      open: unknown[];
      activeKey: string;
    };
    expect(parsed.version).toBe(1);
    expect(parsed.activeKey).toBe('sources');
    expect(parsed.open).toHaveLength(2);
  });
});

describe('engineeringSelection', () => {
  it('records ref + origin and clears; never persists', () => {
    const selection = useEngineeringSelection.getState();
    selection.select(
      { kind: 'signal', fieldId: 'ld0', runSignal: 'ld0carry' },
      'cases'
    );
    let state = useEngineeringSelection.getState();
    expect(state.selected).toEqual({
      kind: 'signal',
      fieldId: 'ld0',
      runSignal: 'ld0carry',
    });
    expect(state.origin).toBe('cases');
    useEngineeringSelection.getState().clear();
    state = useEngineeringSelection.getState();
    expect(state.selected).toBeNull();
    expect(state.origin).toBeNull();
  });
});
