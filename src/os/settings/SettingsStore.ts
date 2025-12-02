import { create } from "zustand";

export interface SettingsState {
  bootMode: "cinematic" | "instant";
  bootDone: boolean;

  setBootDone: (value: boolean) => void;
  setBootMode: (mode: "cinematic" | "instant") => void;
}

export const useSettings = create<SettingsState>((set) => ({
  bootMode: "cinematic",  // ALWAYS cinematic
  bootDone: false,        // ALWAYS start with boot unfinished

  setBootDone: (value) => set({ bootDone: value }),
  setBootMode: (mode) => set({ bootMode: mode }),
}));
