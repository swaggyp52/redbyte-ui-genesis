import { useEffect } from "react";

export interface ShortcutConfig {
  key: string;
  mod?: boolean; // ctrl or cmd
}

export function useShortcut(config: ShortcutConfig, handler: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const wantedKey = config.key.toLowerCase();
      const matchKey = key === wantedKey;

      const matchMod = config.mod ? e.metaKey || e.ctrlKey : true;

      if (matchKey && matchMod) {
        e.preventDefault();
        handler();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [config.key, config.mod, handler]);
}
