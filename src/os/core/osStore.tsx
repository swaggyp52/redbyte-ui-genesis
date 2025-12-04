import { create } from "zustand";

export const useOS = create((set) => ({
  theme: "redbyte",
  glow: true,
  grid: true,
  reducedMotion: false,

  setTheme: (t: string) => set({ theme: t }),
  toggleGlow: () => set((s: any) => ({ glow: !s.glow })),
  toggleGrid: () => set((s: any) => ({ grid: !s.grid })),
  toggleMotion: () => set((s: any) => ({ reducedMotion: !s.reducedMotion }))
}));
