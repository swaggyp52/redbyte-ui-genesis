export type WorkspaceLayout = {
  id: string;
  name: string;
  windows: string[];
};

const STORAGE_KEY = "redbyte:workspace:v1";

export interface WorkspaceState {
  currentId: string;
  layouts: WorkspaceLayout[];
}

export function loadWorkspace(): WorkspaceState {
  if (typeof window === "undefined") {
    return {
      currentId: "default",
      layouts: [{ id: "default", name: "Default", windows: [] }],
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no workspace");
    return JSON.parse(raw) as WorkspaceState;
  } catch {
    const fallback: WorkspaceState = {
      currentId: "default",
      layouts: [{ id: "default", name: "Default", windows: [] }],
    };
    saveWorkspace(fallback);
    return fallback;
  }
}

export function saveWorkspace(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
