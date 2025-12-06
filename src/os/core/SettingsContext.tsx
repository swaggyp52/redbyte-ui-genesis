import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Accent = "red" | "blue" | "green";

interface SettingsValue {
  accent: Accent;
  compact: boolean;
  setAccent: (accent: Accent) => void;
  setCompact: (compact: boolean) => void;
}

const SettingsContext = createContext<SettingsValue | undefined>(undefined);

const STORAGE_KEY = "redbyte_settings_v1";

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accent, setAccent] = useState<Accent>("red");
  const [compact, setCompact] = useState(false);

  // load once
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.accent === "blue" || parsed.accent === "green" || parsed.accent === "red") {
        setAccent(parsed.accent);
      }
      if (typeof parsed.compact === "boolean") {
        setCompact(parsed.compact);
      }
    } catch {
      // ignore
    }
  }, []);

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accent, compact })
      );
    } catch {
      // ignore
    }
  }, [accent, compact]);

  return (
    <SettingsContext.Provider
      value={{ accent, compact, setAccent, setCompact }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside <SettingsProvider>");
  }
  return ctx;
}
