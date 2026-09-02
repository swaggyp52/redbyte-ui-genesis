import { create } from 'zustand';
import type { IdeMode } from './workflowStages';
import {
  documentKey,
  documentMode,
  parseWorkbenchDocument,
  pruneDocuments,
  type WorkbenchDocument,
  type WorkbenchDocumentSnapshot,
} from './workbenchDocuments';

/**
 * Live document-host state — which typed references are open and which is
 * active. UI-only: project, circuit, simulation, mapping, and package truth
 * stay with their existing authorities; this store never holds content.
 *
 * Persistence mirrors workspacePreferences: a versioned localStorage envelope
 * of descriptors + active key, normalized on read, pruned against the loaded
 * project snapshot so a tab can never reference a deleted object.
 */

export const WORKBENCH_DOCUMENTS_STORAGE_KEY = 'rb.ide.workbench.documents.v1';
const OVERVIEW: WorkbenchDocument = { kind: 'project-overview' };
const OVERVIEW_KEY = documentKey(OVERVIEW);
/** Bounded so a long session cannot accumulate an unusable tab row. */
export const MAX_OPEN_DOCUMENTS = 24;

interface WorkbenchDocumentsState {
  open: WorkbenchDocument[];
  activeKey: string;
  /** Most recently active document per workspace, for mode-driven reconciliation. */
  lastActiveByMode: Partial<Record<IdeMode, string>>;
  /** Open (or re-activate) a document. Returns the activated document. */
  openDocument: (doc: WorkbenchDocument) => WorkbenchDocument;
  /** Activate an already-open document by key; no-op for unknown keys. */
  activateDocument: (key: string) => void;
  /** Close a closable document; the previous-index neighbor activates. */
  closeDocument: (key: string) => void;
  /**
   * Mode changed by another owner (stage nav, URL, Back/Forward): activate that
   * workspace's most recent open document, or open `makeDefault()`. Returns the
   * document now active for the mode, or null when the mode hosts none (e.g.
   * import) — the host renders no active tab in that case.
   */
  activateForMode: (
    mode: IdeMode,
    makeDefault: () => WorkbenchDocument | null
  ) => WorkbenchDocument | null;
  /** Project loaded/replaced: drop tabs whose referenced objects are gone. */
  syncToProject: (snapshot: WorkbenchDocumentSnapshot) => void;
  /** Full reset to the pinned overview (project reset / replace). */
  reset: () => void;
}

function persist(open: readonly WorkbenchDocument[], activeKey: string): void {
  try {
    window.localStorage.setItem(
      WORKBENCH_DOCUMENTS_STORAGE_KEY,
      JSON.stringify({ version: 1, open, activeKey })
    );
  } catch {
    // Private browsing, quota, or policy failures must not break the workbench.
  }
}

function readPersisted(): { open: WorkbenchDocument[]; activeKey: string } {
  const fallback = { open: [OVERVIEW], activeKey: OVERVIEW_KEY };
  try {
    const raw = window.localStorage.getItem(WORKBENCH_DOCUMENTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const envelope = parsed as Record<string, unknown>;
    if (envelope.version !== 1 || !Array.isArray(envelope.open)) return fallback;
    const seen = new Set<string>();
    const open: WorkbenchDocument[] = [];
    for (const entry of envelope.open) {
      const doc = parseWorkbenchDocument(entry);
      if (!doc) continue;
      const key = documentKey(doc);
      if (seen.has(key)) continue;
      seen.add(key);
      open.push(doc);
    }
    if (!seen.has(OVERVIEW_KEY)) open.unshift(OVERVIEW);
    const activeKey =
      typeof envelope.activeKey === 'string' && seen.has(envelope.activeKey)
        ? envelope.activeKey
        : OVERVIEW_KEY;
    return { open: open.slice(0, MAX_OPEN_DOCUMENTS), activeKey };
  } catch {
    return fallback;
  }
}

const initial =
  typeof window === 'undefined'
    ? { open: [OVERVIEW], activeKey: OVERVIEW_KEY }
    : readPersisted();

export const useWorkbenchDocuments = create<WorkbenchDocumentsState>((set, get) => {
  const commit = (
    open: WorkbenchDocument[],
    activeKey: string,
    lastActiveByMode: Partial<Record<IdeMode, string>>
  ) => {
    set({ open, activeKey, lastActiveByMode });
    if (typeof window !== 'undefined') persist(open, activeKey);
  };

  const touchMode = (
    lastActiveByMode: Partial<Record<IdeMode, string>>,
    doc: WorkbenchDocument
  ): Partial<Record<IdeMode, string>> => ({
    ...lastActiveByMode,
    [documentMode(doc)]: documentKey(doc),
  });

  return {
    open: initial.open,
    activeKey: initial.activeKey,
    lastActiveByMode: {},

    openDocument: (doc) => {
      const { open, lastActiveByMode } = get();
      const key = documentKey(doc);
      const existing = open.find((entry) => documentKey(entry) === key);
      const nextOpen = existing ? open : [...open, doc].slice(-MAX_OPEN_DOCUMENTS);
      const activated = existing ?? doc;
      commit(nextOpen, key, touchMode(lastActiveByMode, activated));
      return activated;
    },

    activateDocument: (key) => {
      const { open, lastActiveByMode } = get();
      const doc = open.find((entry) => documentKey(entry) === key);
      if (!doc) return;
      commit(open, key, touchMode(lastActiveByMode, doc));
    },

    closeDocument: (key) => {
      if (key === OVERVIEW_KEY) return;
      const { open, activeKey, lastActiveByMode } = get();
      const index = open.findIndex((entry) => documentKey(entry) === key);
      if (index === -1) return;
      const nextOpen = open.filter((_, i) => i !== index);
      const nextLast: Partial<Record<IdeMode, string>> = Object.fromEntries(
        Object.entries(lastActiveByMode).filter(([, value]) => value !== key)
      );
      if (activeKey !== key) {
        commit(nextOpen, activeKey, nextLast);
        return;
      }
      const neighbor = nextOpen[Math.max(0, index - 1)] ?? OVERVIEW;
      commit(nextOpen, documentKey(neighbor), touchMode(nextLast, neighbor));
    },

    activateForMode: (mode, makeDefault) => {
      const { open, activeKey, lastActiveByMode } = get();
      const active = open.find((entry) => documentKey(entry) === activeKey);
      if (active && documentMode(active) === mode) return active;
      const rememberedKey = lastActiveByMode[mode];
      const remembered = rememberedKey
        ? open.find((entry) => documentKey(entry) === rememberedKey)
        : undefined;
      const candidate =
        remembered ?? open.find((entry) => documentMode(entry) === mode);
      if (candidate) {
        const key = documentKey(candidate);
        commit(open, key, touchMode(lastActiveByMode, candidate));
        return candidate;
      }
      const created = makeDefault();
      if (!created || documentMode(created) !== mode) return null;
      const nextOpen = [...open, created].slice(-MAX_OPEN_DOCUMENTS);
      commit(nextOpen, documentKey(created), touchMode(lastActiveByMode, created));
      return created;
    },

    syncToProject: (snapshot) => {
      const { open, activeKey, lastActiveByMode } = get();
      const pruned = [...pruneDocuments(open, snapshot)];
      if (!pruned.some((entry) => documentKey(entry) === OVERVIEW_KEY)) {
        pruned.unshift(OVERVIEW);
      }
      const keys = new Set(pruned.map(documentKey));
      const nextActive = keys.has(activeKey) ? activeKey : OVERVIEW_KEY;
      const nextLast: Partial<Record<IdeMode, string>> = Object.fromEntries(
        Object.entries(lastActiveByMode).filter(([, value]) => value && keys.has(value))
      );
      commit(pruned, nextActive, nextLast);
    },

    reset: () => {
      commit([OVERVIEW], OVERVIEW_KEY, {});
    },
  };
});
