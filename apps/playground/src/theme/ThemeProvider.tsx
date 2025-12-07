import React, { createContext, useContext, useEffect, useState } from "react";
import { applyTheme, getActiveTheme, ThemeVariant } from "@rb/theme";

interface ThemeContextValue {
  theme: ThemeVariant;
  setTheme: (next: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeVariant>(() => getActiveTheme() ?? "dark-neon");

  useEffect(() => {
    if (typeof window === "undefined") return;
    applyTheme(window.document.documentElement, theme, { persist: true });
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
