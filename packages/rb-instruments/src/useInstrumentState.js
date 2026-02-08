import { create } from 'zustand';
export const useInstrumentState = create((set) => ({
    activeInstrumentId: 'net-inspector',
    selectedSignalId: null,
    setActiveInstrumentId: (id) => set({ activeInstrumentId: id }),
    setSelectedSignalId: (id) => set({ selectedSignalId: id }),
}));
