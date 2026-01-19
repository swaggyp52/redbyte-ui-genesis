import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Accent = "red" | "blue" | "green";
export type Density = "normal" | "compact";

interface ThemeState {
  accent: Accent;
  density: Density;
  setAccent: (accent: Accent) => void;
  setDensity: (density: Density) => void;
}

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createThemeStore> | null = null;

function createThemeStore() {
  return create<ThemeState>()(
    persist(
      (set) => ({
        accent: "red",
        density: "normal",
        setAccent: (accent) => set({ accent }),
        setDensity: (density) => set({ density })
      }),
      {
        name: "redbyte_theme_v1"
      }
    )
  );
}

export const useTheme: ReturnType<typeof createThemeStore> = ((...args: any[]) => {
  if (!_store) _store = createThemeStore();
  return (_store as any)(...args);
}) as any;

(useTheme as any).getState = () => {
  if (!_store) _store = createThemeStore();
  return (_store as any).getState();
};

(useTheme as any).setState = (...a: any[]) => {
  if (!_store) _store = createThemeStore();
  return (_store as any).setState(...a);
};

(useTheme as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createThemeStore();
  return (_store as any).subscribe(...a);
};
