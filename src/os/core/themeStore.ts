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

export const useTheme = create<ThemeState>()(
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
