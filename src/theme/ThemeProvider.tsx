import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { themes, neonTheme } from "./index";
import type { ThemeTokenSet } from "./types";

interface ThemeContextValue {
  theme: ThemeTokenSet;
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "redbyte:theme:v1";

/** Migrate legacy theme IDs to new values */
function migrateThemeId(id: string): string {
  if (id === "neon") return "dark";
  if (id === "carbon") return "light";
  return id;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeId, setThemeIdRaw] = useState<string>(() => {
    if (typeof window === "undefined") return neonTheme.id;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) return migrateThemeId(saved);
    } catch {
      // ignore
    }
    return neonTheme.id;
  });

  const setThemeId = (id: string) => setThemeIdRaw(migrateThemeId(id));

  const theme = themes.find((t) => t.id === themeId) ?? neonTheme;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // ignore
    }
    // Sync with data-theme attribute for CSS variable system
    document.documentElement.setAttribute("data-theme", themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId }}>
      <div className={`${theme.background} ${theme.foreground} w-full h-full`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
