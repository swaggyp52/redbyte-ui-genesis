// Zustand store for lab spec state
import { create } from 'zustand';
import type { LabSpecV1 } from '@redbyte/rb-logic-core';

interface LabSpecStoreState {
  labSpec: LabSpecV1 | null;
  setLabSpec: (spec: LabSpecV1 | null) => void;
  clearLabSpec: () => void;
}

export const useLabSpecStore = create<LabSpecStoreState>((set) => ({
  labSpec: null,
  setLabSpec: (spec) => set({ labSpec: spec }),
  clearLabSpec: () => set({ labSpec: null }),
}));
