export interface RVFSNode {
  id: string;
  name: string;
  type: "file" | "folder";
  createdAt: number;
  updatedAt: number;
  parentId: string | null;
  content?: string;
  children?: string[];
}

interface RVFSSnapshot {
  nodes: Record<string, RVFSNode>;
  rootId: string;
}

const STORAGE_KEY = "rvfs_snapshot_v1";

let fs: RVFSSnapshot = {
  nodes: {},
  rootId: "root",
};

function createBaseFS() {
  const root: RVFSNode = {
    id: "root",
    name: "Root",
    type: "folder",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    parentId: null,
    children: [],
  };

  return {
    nodes: { root },
    rootId: "root",
  } as RVFSSnapshot;
}

// LOAD FS
export function loadFS() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      fs = createBaseFS();
      saveFS();
      return fs;
    }
    fs = JSON.parse(raw);
    return fs;
  } catch {
    fs = createBaseFS();
    saveFS();
    return fs;
  }
}

// SAVE FS
export function saveFS() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fs));
}

function genId() {
  return "n-" + Math.random().toString(16).slice(2);
}

export function getNode(id: string): RVFSNode | null {
  return fs.nodes[id] ?? null;
}

export function listChildren(id: string): RVFSNode[] {
  const parent = getNode(id);
  if (!parent || parent.type !== "folder") return [];
  return parent.children!.map((cid) => fs.nodes[cid]);
}

export function createFolder(parentId: string, name: string) {
  const parent = getNode(parentId);
  if (!parent || parent.type !== "folder") return null;

  const id = genId();
  const node: RVFSNode = {
    id,
    name,
    type: "folder",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    parentId,
    children: [],
  };

  fs.nodes[id] = node;
  parent.children!.push(id);
  parent.updatedAt = Date.now();

  saveFS();
  return node;
}

export function createFile(parentId: string, name: string, content = "") {
  const parent = getNode(parentId);
  if (!parent || parent.type !== "folder") return null;

  const id = genId();
  const node: RVFSNode = {
    id,
    name,
    type: "file",
    parentId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content,
  };

  fs.nodes[id] = node;
  parent.children!.push(id);
  parent.updatedAt = Date.now();

  saveFS();
  return node;
}

export function writeFile(id: string, content: string) {
  const n = getNode(id);
  if (!n || n.type !== "file") return;

  n.content = content;
  n.updatedAt = Date.now();
  saveFS();
}

export function deleteNode(id: string) {
  const n = getNode(id);
  if (!n) return;

  if (n.parentId) {
    const parent = getNode(n.parentId);
    if (parent?.children) {
      parent.children = parent.children.filter((c) => c !== id);
    }
  }

  if (n.type === "folder") {
    n.children?.forEach(deleteNode);
  }

  delete fs.nodes[id];
  saveFS();
}

export function renameNode(id: string, newName: string) {
  const n = getNode(id);
  if (!n) return;

  n.name = newName;
  n.updatedAt = Date.now();
  saveFS();
}

