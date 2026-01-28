import { create } from 'zustand';
import type { InstrumentId } from './types';

interface InstrumentState {
  activeInstrumentId: InstrumentId;
  selectedSignalId: string | null;
  setActiveInstrumentId: (id: InstrumentId) => void;
  setSelectedSignalId: (id: string | null) => void;
}

export const useInstrumentState = create<InstrumentState>((set) => ({
  activeInstrumentId: 'net-inspector',
  selectedSignalId: null,
  setActiveInstrumentId: (id) => set({ activeInstrumentId: id }),
  setSelectedSignalId: (id) => set({ selectedSignalId: id }),
}));
