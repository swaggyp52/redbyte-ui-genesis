import { create } from 'zustand';
export const useGradingNotesStore = create((set) => ({
    grading: { initials: '' },
    setGrading: (g) => set((state) => ({ grading: { ...state.grading, ...g } })),
    resetGrading: () => set({ grading: { initials: '' } }),
}));
