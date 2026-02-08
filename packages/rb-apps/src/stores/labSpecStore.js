// Zustand store for lab spec state
import { create } from 'zustand';
export const useLabSpecStore = create((set) => ({
    labSpec: null,
    setLabSpec: (spec) => set({ labSpec: spec }),
    clearLabSpec: () => set({ labSpec: null }),
}));
