import type { RedstoneGrid } from "./RedstoneTypes";
import {
  createFile,
  createFolder,
  getNode,
  listChildren,
  writeFile,
  deleteNode,
  type RVFSNode,
} from "../fs/RVFS";

const BLUEPRINT_ROOT_NAME = "Redstone";

function ensureBlueprintFolder(): RVFSNode {
  const root = getNode("root");
  if (!root || root.type !== "folder") {
    throw new Error("RVFS root folder missing");
  }
  const existing = listChildren(root.id).find(
    (n) => n.type === "folder" && n.name === BLUEPRINT_ROOT_NAME
  );
  if (existing) return existing;

  const created = createFolder(root.id, BLUEPRINT_ROOT_NAME);
  if (!created) {
    throw new Error("Failed to create Redstone blueprint folder");
  }
  return created;
}

export interface RedstoneBlueprintMeta {
  name: string;
  id: string;
  createdAt: number;
  updatedAt: number;
}

export function listBlueprints(): string[] {
  const root = getNode("root");
  if (!root || root.type !== "folder") return [];
  const folder = listChildren(root.id).find(
    (n) => n.type === "folder" && n.name === BLUEPRINT_ROOT_NAME
  );
  if (!folder) return [];
  return listChildren(folder.id)
    .filter((n) => n.type === "file")
    .map((n) => n.name);
}

export function listBlueprintMeta(): RedstoneBlueprintMeta[] {
  const root = getNode("root");
  if (!root || root.type !== "folder") return [];
  const folder = listChildren(root.id).find(
    (n) => n.type === "folder" && n.name === BLUEPRINT_ROOT_NAME
  );
  if (!folder) return [];
  return listChildren(folder.id)
    .filter((n) => n.type === "file")
    .map((n) => ({
      name: n.name,
      id: n.id,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
}

export function saveBlueprint(name: string, grid: RedstoneGrid) {
  const folder = ensureBlueprintFolder();
  const existing = listChildren(folder.id).find(
    (n) => n.type === "file" && n.name === name
  );

  const payload = JSON.stringify(
    {
      kind: "redstone-blueprint",
      version: 1,
      width: grid[0]?.length ?? 0,
      height: grid.length,
      grid,
    },
    null,
    2
  );

  if (existing) {
    writeFile(existing.id, payload);
  } else {
    createFile(folder.id, name, payload);
  }
}

export function loadBlueprint(name: string): RedstoneGrid | null {
  const root = getNode("root");
  if (!root || root.type !== "folder") return null;
  const folder = listChildren(root.id).find(
    (n) => n.type === "folder" && n.name === BLUEPRINT_ROOT_NAME
  );
  if (!folder) return null;

  const file = listChildren(folder.id).find(
    (n) => n.type === "file" && n.name === name
  );
  if (!file || !file.content) return null;

  try {
    const parsed = JSON.parse(file.content);
    if (
      parsed &&
      parsed.kind === "redstone-blueprint" &&
      Array.isArray(parsed.grid)
    ) {
      return parsed.grid;
    }
  } catch {
    // ignore
  }
  return null;
}

export function deleteBlueprint(name: string): boolean {
  const root = getNode("root");
  if (!root || root.type !== "folder") return false;
  const folder = listChildren(root.id).find(
    (n) => n.type === "folder" && n.name === BLUEPRINT_ROOT_NAME
  );
  if (!folder) return false;

  const file = listChildren(folder.id).find(
    (n) => n.type === "file" && n.name === name
  );
  if (!file) return false;

  deleteNode(file.id);
  return true;
}
