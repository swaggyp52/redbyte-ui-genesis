import { useCallback, useMemo, useState } from "react";

export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  createdAt: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useWindows() {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const openWindow = useCallback(
    (payload: Omit<WindowInstance, "createdAt" | "x" | "y" | "width" | "height">) => {
      setWindows((prev) => {
        const offset = prev.length * 28;
        const next: WindowInstance = {
          ...payload,
          createdAt: Date.now(),
          x: 120 + offset,
          y: 96 + offset,
          width: 420,
          height: 320,
        };
        return [...prev, next];
      });
      setActiveId(payload.id);
    },
    []
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const updateWindow = useCallback(
    (id: string, patch: Partial<Pick<WindowInstance, "x" | "y" | "width" | "height">>) => {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                ...patch,
              }
            : w
        )
      );
    },
    []
  );

  const ordered = useMemo(
    () => [...windows].sort((a, b) => a.createdAt - b.createdAt),
    [windows]
  );

  return {
    windows: ordered,
    activeId,
    openWindow,
    closeWindow,
    focusWindow,
    updateWindow,
  };
}

