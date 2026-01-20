// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { useViewStateStore } from './viewStateStore';
import { recordAuditTransition } from '../utils/audit';

export interface Probe {
  id: string;
  nodeId: string;
  portName: string;
  label: string;
  color: string;
  enabled: boolean;
}

interface AddProbeInput {
  nodeId: string;
  portName: string;
  label: string;
}

interface ProbeState {
  probes: Probe[];
  activeProbeId: string | null;
}

interface ProbeActions {
  addProbe: (input: AddProbeInput) => string;
  removeProbe: (id: string) => void;
  renameProbe: (id: string, label: string) => void;
  toggleProbe: (id: string) => void;
  toggleProbeForPort: (nodeId: string, portName: string, label?: string) => void;
  setActiveProbe: (id: string | null) => void;
  clearProbes: () => void;
  setProbes: (probes: Probe[]) => void;
  hasProbe: (nodeId: string, portName: string) => boolean;
  reorderProbes: (fromIndex: number, toIndex: number) => void;
}

type ProbeStore = ProbeState & ProbeActions;

const PROBE_COLORS = [
  '#00ffff',
  '#ffff00',
  '#ff00ff',
  '#00ff00',
  '#ff8800',
  '#8800ff',
  '#ff0088',
  '#00ff88',
];
const PROBE_ID_PREFIX = 'probe-v2-';
const PROBE_ID_RE = /^probe-v2-(\d+)$/;

const hashProbeId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getNextProbeId = (probes: Probe[]): string => {
  let max = 0;
  for (const probe of probes) {
    const match = PROBE_ID_RE.exec(probe.id);
    if (!match) continue;
    const value = parseInt(match[1], 10);
    if (Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return `${PROBE_ID_PREFIX}${max + 1}`;
};

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createProbeStore> | null = null;

function createProbeStore() {
  return create<ProbeStore>((set, get) => ({
    probes: [],
    activeProbeId: null,

    addProbe: ({ nodeId, portName, label }) => {
      const existing = get().probes.find(
        (probe) => probe.nodeId === nodeId && probe.portName === portName
      );
      if (existing) {
        set({ activeProbeId: existing.id });
        return existing.id;
      }

      const before = get().probes;
      const id = getNextProbeId(before);
      const color = PROBE_COLORS[hashProbeId(id) % PROBE_COLORS.length];
      const nextProbe: Probe = {
        id,
        nodeId,
        portName,
        label,
        color,
        enabled: true,
      };

      const nextProbes = [...before, nextProbe];
      set((state) => ({
        probes: nextProbes,
        activeProbeId: id,
      }));

      recordAuditTransition({
        scope: 'probe_store',
        action: 'add',
        before,
        after: nextProbes,
      });

      return id;
    },

    removeProbe: (id) => {
      const before = get().probes;
      const nextProbes = before.filter((probe) => probe.id !== id);
      const nextActive = get().activeProbeId === id ? null : get().activeProbeId;
      set({
        probes: nextProbes,
        activeProbeId: nextActive,
      });
      recordAuditTransition({
        scope: 'probe_store',
        action: 'remove',
        before,
        after: nextProbes,
      });
    },

    renameProbe: (id, label) => {
      const nextLabel = label.trim();
      if (!nextLabel) return;

      const before = get().probes;
      const nextProbes = before.map((probe) =>
        probe.id === id ? { ...probe, label: nextLabel } : probe
      );
      set({ probes: nextProbes });
      recordAuditTransition({
        scope: 'probe_store',
        action: 'rename',
        before,
        after: nextProbes,
      });
    },

    toggleProbe: (id) => {
      const before = get().probes;
      const nextProbes = before.map((probe) =>
        probe.id === id ? { ...probe, enabled: !probe.enabled } : probe
      );
      set({ probes: nextProbes });
      recordAuditTransition({
        scope: 'probe_store',
        action: 'toggle',
        before,
        after: nextProbes,
      });
    },

    setActiveProbe: (id) => {
      const before = get().probes;
      set({ activeProbeId: id });
      recordAuditTransition({
        scope: 'probe_store',
        action: 'activate',
        before,
        after: before,
      });
      if (id) {
        const probe = get().probes.find((item) => item.id === id);
        if (probe) {
          // Use queueMicrotask to break synchronous update chain
          queueMicrotask(() => {
            useViewStateStore.getState().selectNodes([probe.nodeId], false);
          });
        }
      }
    },

    clearProbes: () => {
      const before = get().probes;
      set({ probes: [], activeProbeId: null });
      recordAuditTransition({
        scope: 'probe_store',
        action: 'clear',
        before,
        after: [],
      });
    },

    setProbes: (probes) => {
      const before = get().probes;
      const nextActive = probes.length > 0 ? probes[0].id : null;
      set({ probes: [...probes], activeProbeId: nextActive });
      recordAuditTransition({
        scope: 'probe_store',
        action: 'set',
        before,
        after: [...probes],
      });
    },

    toggleProbeForPort: (nodeId, portName, label) => {
      const existing = get().probes.find(
        (probe) => probe.nodeId === nodeId && probe.portName === portName
      );

      if (existing) {
        // Remove if exists
        get().removeProbe(existing.id);
      } else {
        // Add if doesn't exist
        get().addProbe({
          nodeId,
          portName,
          label: label || `${nodeId.slice(0, 8)}.${portName}`,
        });
      }
    },

    hasProbe: (nodeId, portName) => {
      return get().probes.some(
        (probe) => probe.nodeId === nodeId && probe.portName === portName
      );
    },

    reorderProbes: (fromIndex, toIndex) => {
      const before = get().probes;
      set(() => {
        const newProbes = [...before];
        const [movedProbe] = newProbes.splice(fromIndex, 1);
        newProbes.splice(toIndex, 0, movedProbe);
        recordAuditTransition({
          scope: 'probe_store',
          action: 'reorder',
          before,
          after: newProbes,
        });
        return { probes: newProbes };
      });
    },
  }));
}

export const useProbeStore: ReturnType<typeof createProbeStore> = ((...args: any[]) => {
  if (!_store) _store = createProbeStore();
  return (_store as any)(...args);
}) as any;

(useProbeStore as any).getState = () => {
  if (!_store) _store = createProbeStore();
  return (_store as any).getState();
};

(useProbeStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createProbeStore();
  return (_store as any).setState(...a);
};

(useProbeStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createProbeStore();
  return (_store as any).subscribe(...a);
};
