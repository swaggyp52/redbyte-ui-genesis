import { create } from "zustand";

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createOS> | null = null;

function createOS() {
  return create((set) => ({
    theme: "redbyte",
    glow: true,
    grid: true,
    reducedMotion: false,

    setTheme: (t: string) => set({ theme: t }),
    toggleGlow: () => set((s: any) => ({ glow: !s.glow })),
    toggleGrid: () => set((s: any) => ({ grid: !s.grid })),
    toggleMotion: () => set((s: any) => ({ reducedMotion: !s.reducedMotion }))
  }));
}

export const useOS: ReturnType<typeof createOS> = ((...args: any[]) => {
  if (!_store) _store = createOS();
  return (_store as any)(...args);
}) as any;

(useOS as any).getState = () => {
  if (!_store) _store = createOS();
  return (_store as any).getState();
};

(useOS as any).setState = (...a: any[]) => {
  if (!_store) _store = createOS();
  return (_store as any).setState(...a);
};

(useOS as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createOS();
  return (_store as any).subscribe(...a);
};
