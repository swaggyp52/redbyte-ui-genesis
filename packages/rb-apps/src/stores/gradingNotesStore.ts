import { create } from 'zustand';

export interface GradingNotes {
  score?: number;
  passFail?: boolean;
  notes?: string;
  initials: string;
}

interface GradingNotesState {
  grading: GradingNotes;
  setGrading: (g: Partial<GradingNotes>) => void;
  resetGrading: () => void;
}

export const useGradingNotesStore = create<GradingNotesState>((set) => ({
  grading: { initials: '' },
  setGrading: (g) => set((state) => ({ grading: { ...state.grading, ...g } })),
  resetGrading: () => set({ grading: { initials: '' } }),
}));
