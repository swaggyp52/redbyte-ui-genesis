import { ProjectState } from "./ProjectTypes";

export const PROJECT_STORAGE_KEY = "redbyte-project-v2";

export function serializeProject(project: ProjectState): string {
  return JSON.stringify(project, null, 2);
}

export function exportProjectToBlob(project: ProjectState): Blob {
  const json = serializeProject(project);
  return new Blob([json], { type: "application/json" });
}

export function downloadProject(project: ProjectState) {
  const blob = exportProjectToBlob(project);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = project.meta.name.replace(/[^a-z0-9_\-]+/gi, "_") + ".redproj";
  a.click();
  URL.revokeObjectURL(url);
}

export function importProject(jsonString: string): ProjectState {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid project file");
  }
  if (!parsed.meta?.id || !parsed.meta?.createdAt) {
    throw new Error("Missing metadata");
  }
  const normalized: ProjectState = {
    ...parsed,
    meta: {
      ...parsed.meta,
      version: parsed.meta.version ?? 2,
    },
    signal: parsed.signal ?? { watches: [] },
  };
  return normalized;
}

export function loadProjectFromStorage(): ProjectState | null {
  const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return importProject(raw);
  } catch (err) {
    console.warn("Failed to load stored project", err);
    return null;
  }
}

export function saveProjectToStorage(project: ProjectState) {
  localStorage.setItem(PROJECT_STORAGE_KEY, serializeProject(project));
}

export function clearStoredProject() {
  localStorage.removeItem(PROJECT_STORAGE_KEY);
}
