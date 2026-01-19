// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { useViewStateStore } from './viewStateStore';

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

const hashProbeId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
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

      const id = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const color = PROBE_COLORS[hashProbeId(id) % PROBE_COLORS.length];
      const nextProbe: Probe = {
        id,
        nodeId,
        portName,
        label,
        color,
        enabled: true,
      };

      set((state) => ({
        probes: [...state.probes, nextProbe],
        activeProbeId: id,
      }));

      return id;
    },

    removeProbe: (id) => {
      set((state) => ({
        probes: state.probes.filter((probe) => probe.id !== id),
        activeProbeId: state.activeProbeId === id ? null : state.activeProbeId,
      }));
    },

    renameProbe: (id, label) => {
      const nextLabel = label.trim();
      if (!nextLabel) return;

      set((state) => ({
        probes: state.probes.map((probe) =>
          probe.id === id ? { ...probe, label: nextLabel } : probe
        ),
      }));
    },

    toggleProbe: (id) => {
      set((state) => ({
        probes: state.probes.map((probe) =>
          probe.id === id ? { ...probe, enabled: !probe.enabled } : probe
        ),
      }));
    },

    setActiveProbe: (id) => {
      set({ activeProbeId: id });
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
      set({ probes: [], activeProbeId: null });
    },

    setProbes: (probes) => {
      const nextActive = probes.length > 0 ? probes[0].id : null;
      set({ probes: [...probes], activeProbeId: nextActive });
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
      set((state) => {
        const newProbes = [...state.probes];
        const [movedProbe] = newProbes.splice(fromIndex, 1);
        newProbes.splice(toIndex, 0, movedProbe);
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
