import { create } from 'zustand';
import type { LabDoc, LabDocMeta, TruthTableRow } from '../plugins/LabDoc';
import type { WindowState } from '../window/windowTypes';
import type { Event } from '../window/windowTypes';

/**
 * LabStore: Global state for the lab3-webapp
 * Manages document state, windows, and event log
 */
export type LabStoreState = {
  doc: LabDoc;
  windows: WindowState[];
  events: Event[];
  eventSeq: number;
  zCounter: number;
  activeWindowId?: string;
  
  // Actions
  setDoc: (doc: LabDoc) => void;
  setWindows: (windows: WindowState[]) => void;
  emitEvent: (type: string, payload: unknown) => void;
  hydrateFromSnapshot: (snapshot: SerializedSnapshot) => void;
  discardRecovery: () => void;
  bringToFront: (windowId: string) => void;
  openWindow: (pluginId: string, viewId: string, rect?: { x: number; y: number; w: number; h: number }) => void;
  closeWindow: (windowId: string) => void;
};

/**
 * Serialized snapshot format (for full store state)
 */
export interface SerializedSnapshot {
  schemaVersion: 1;
  sessionId: string;
  savedAt: string;
  doc: LabDoc;
  windows: WindowState[];
  events: Event[];
  eventSeq: number;
}

/**
 * Create an empty LabDoc with 16 truth table rows (4-bit input: 0000-1111)
 */
export function createEmptyLabDoc(): LabDoc {
  const truthTable: TruthTableRow[] = [];
  
  // Generate all 16 combinations of 4-bit input
  for (let i = 0; i < 16; i++) {
    const b3 = (i >> 3) & 1;
    const b2 = (i >> 2) & 1;
    const b1 = (i >> 1) & 1;
    const b0 = i & 1;
    
    truthTable.push({
      b3,
      b2,
      b1,
      b0,
      seg: [1, 1, 1, 1, 1, 1, 1], // All segments off (active-low)
      isDontCare: i >= 10, // 10-15 are don't cares for BCD
    });
  }
  
  const meta: LabDocMeta = {
    id: crypto.randomUUID(),
    name: 'Untitled Lab',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  return {
    schemaVersion: 1,
    meta,
    truthTable,
    kMaps: {},
    expressions: {},
    results: {},
  };
}

/**
 * Serialize a LabDoc to JSON string (simple doc serialization for roundtrip)
 */
export function serializeSnapshot(doc: LabDoc): string {
  return JSON.stringify(doc);
}

/**
 * Serialize full store state to JSON string (complete snapshot with metadata)
 */
export function serializeStoreSnapshot(doc: LabDoc, windows: WindowState[], events: Event[], eventSeq: number): string {
  const snapshot: SerializedSnapshot = {
    schemaVersion: 1,
    sessionId: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    doc,
    windows,
    events,
    eventSeq,
  };
  
  return JSON.stringify(snapshot);
}

/**
 * Deserialize a LabDoc from JSON string (no validation)
 */
export function deserializeSnapshot(json: string): LabDoc {
  return JSON.parse(json);
}

/**
 * Deserialize full store snapshot from JSON string (no validation)
 */
export function deserializeStoreSnapshot(json: string): SerializedSnapshot {
  return JSON.parse(json);
}

/**
 * Validate a snapshot object (strict validation for v1)
 */
export function validateSnapshotV1(obj: unknown): obj is SerializedSnapshot {
  if (!obj || typeof obj !== 'object') return false;
  
  const snapshot = obj as Record<string, unknown>;
  
  // Check schemaVersion
  if (snapshot.schemaVersion !== 1) return false;
  
  // Check required metadata
  if (typeof snapshot.sessionId !== 'string') return false;
  if (typeof snapshot.savedAt !== 'string') return false;
  
  // Check doc exists and has required fields
  if (!snapshot.doc || typeof snapshot.doc !== 'object') return false;
  const doc = snapshot.doc as Record<string, unknown>;
  
  if (doc.schemaVersion !== 1) return false;
  if (!doc.meta || typeof doc.meta !== 'object') return false;
  
  const meta = doc.meta as Record<string, unknown>;
  if (typeof meta.id !== 'string') return false;
  if (typeof meta.name !== 'string') return false;
  if (typeof meta.createdAt !== 'string') return false;
  if (typeof meta.updatedAt !== 'string') return false;
  
  // Check truthTable is an array
  if (!Array.isArray(doc.truthTable)) return false;
  
  // Validate each truth table row
  for (const row of doc.truthTable) {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    
    if (typeof r.b3 !== 'number' || (r.b3 !== 0 && r.b3 !== 1)) return false;
    if (typeof r.b2 !== 'number' || (r.b2 !== 0 && r.b2 !== 1)) return false;
    if (typeof r.b1 !== 'number' || (r.b1 !== 0 && r.b1 !== 1)) return false;
    if (typeof r.b0 !== 'number' || (r.b0 !== 0 && r.b0 !== 1)) return false;
    
    if (!Array.isArray(r.seg) || r.seg.length !== 7) return false;
    for (const bit of r.seg) {
      if (typeof bit !== 'number' || (bit !== 0 && bit !== 1)) return false;
    }
    
    if (typeof r.isDontCare !== 'boolean') return false;
  }
  
  // Check other doc fields exist
  if (typeof doc.kMaps !== 'object') return false;
  if (typeof doc.expressions !== 'object') return false;
  if (typeof doc.results !== 'object') return false;
  
  // Check windows is an array
  if (!Array.isArray(snapshot.windows)) return false;
  
  // Check events is an array
  if (!Array.isArray(snapshot.events)) return false;
  
  // Check eventSeq is a number
  if (typeof snapshot.eventSeq !== 'number') return false;
  
  return true;
}

/**
 * Create the Zustand store
 */
const useLabStore = create<LabStoreState>((set, get) => ({
  doc: createEmptyLabDoc(),
  windows: [],
  events: [],
  eventSeq: 0,
  zCounter: 1,
  activeWindowId: undefined,
  
  setDoc: (doc: LabDoc) => {
    set({ doc });
  },
  
  setWindows: (windows: WindowState[]) => {
    set({ windows });
  },
  
  emitEvent: (type: string, payload: unknown) => {
    const state = get();
    const newEvent: Event = {
      id: `evt-${state.eventSeq}`,
      ts: new Date().toISOString(),
      type,
      payload,
    };
    
    // Cap events at 200, removing oldest if needed
    let newEvents = [...state.events, newEvent];
    if (newEvents.length > 200) {
      newEvents = newEvents.slice(newEvents.length - 200);
    }
    
    set({
      events: newEvents,
      eventSeq: state.eventSeq + 1,
    });
  },
  
  hydrateFromSnapshot: (snapshot: SerializedSnapshot) => {
    // Validate snapshot
    if (!validateSnapshotV1(snapshot)) {
      console.warn('Invalid snapshot format, skipping hydration');
      return;
    }
    
    set({
      doc: snapshot.doc,
      windows: snapshot.windows,
      events: snapshot.events,
      eventSeq: snapshot.eventSeq,
    });
  },
  
  discardRecovery: () => {
    set({
      events: [],
      eventSeq: 0,
    });
  },
  
  bringToFront: (windowId: string) => {
    const state = get();
    const newZCounter = state.zCounter + 1;
    
    const updatedWindows = state.windows.map(win =>
      win.id === windowId ? { ...win, z: newZCounter } : win
    );
    
    set({
      windows: updatedWindows,
      zCounter: newZCounter,
      activeWindowId: windowId,
    });
  },
  
  openWindow: (pluginId: string, viewId: string, rect?: { x: number; y: number; w: number; h: number }) => {
    const state = get();
    const newZCounter = state.zCounter + 1;
    
    const newWindow: WindowState = {
      id: crypto.randomUUID(),
      pluginId,
      viewId,
      x: rect?.x ?? 100,
      y: rect?.y ?? 100,
      w: rect?.w ?? 400,
      h: rect?.h ?? 300,
      z: newZCounter,
      minimized: false,
      maximized: false,
    };
    
    set({
      windows: [...state.windows, newWindow],
      zCounter: newZCounter,
      activeWindowId: newWindow.id,
    });
  },
  
  closeWindow: (windowId: string) => {
    const state = get();
    const updatedWindows = state.windows.filter(win => win.id !== windowId);
    
    set({
      windows: updatedWindows,
      activeWindowId: state.activeWindowId === windowId ? undefined : state.activeWindowId,
    });
  },
}));

export default useLabStore;
