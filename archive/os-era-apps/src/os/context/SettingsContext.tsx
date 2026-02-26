import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Accent = "red" | "blue" | "green";
export type Density = "cozy" | "compact";
export type LayoutMode = "free" | "smart";

interface SettingsState {
  accent: Accent;
  density: Density;
  layoutMode: LayoutMode;
  gridSize: number;
}

interface SettingsContextValue extends SettingsState {
  setAccent: (accent: Accent) => void;
  setDensity: (density: Density) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setGridSize: (size: number) => void;
}

const DEFAULT_STATE: SettingsState = {
  accent: "red",
  density: "cozy",
  layoutMode: "smart",
  gridSize: 16,
};

const STORAGE_KEY = "redbyte_settings_v2";

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<SettingsState>(DEFAULT_STATE);

  // load
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setState((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch {
      // ignore bad storage
    }
  }, []);

  // save
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const value: SettingsContextValue = {
    ...state,
    setAccent: (accent) => setState((prev) => ({ ...prev, accent })),
    setDensity: (density) => setState((prev) => ({ ...prev, density })),
    setLayoutMode: (layoutMode) => setState((prev) => ({ ...prev, layoutMode })),
    setGridSize: (gridSize) => setState((prev) => ({ ...prev, gridSize })),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return ctx;
};
