import { useState, useEffect } from "react";

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

const KEY = "redbyte:workspaces";

export function loadWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error("no ws");
    return JSON.parse(raw);
  } catch {
    const base: Workspace[] = [
      { id: "main", name: "Main", createdAt: Date.now() },
      { id: "dev", name: "DevOps", createdAt: Date.now() + 1 },
      { id: "lab", name: "R&D", createdAt: Date.now() + 2 }
    ];
    localStorage.setItem(KEY, JSON.stringify(base));
    return base;
  }
}

export function saveWorkspaces(w: Workspace[]) {
  localStorage.setItem(KEY, JSON.stringify(w));
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [active, setActive] = useState("main");

  useEffect(() => {
    setWorkspaces(loadWorkspaces());
  }, []);

  const createWorkspace = (name: string) => {
    const ws: Workspace = {
      id: `ws_${Date.now()}`,
      name,
      createdAt: Date.now(),
    };
    const next = [...workspaces, ws];
    setWorkspaces(next);
    saveWorkspaces(next);
  };

  const switchWorkspace = (id: string) => {
    setActive(id);
  };

  return { workspaces, active, createWorkspace, switchWorkspace };
}

