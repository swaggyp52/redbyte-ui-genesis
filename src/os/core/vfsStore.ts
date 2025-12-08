import { create } from "zustand";

export type NodeType = "file" | "dir";

export interface FileNode {
  type: "file";
  content: string;
}

export interface DirNode {
  type: "dir";
  children: Record<string, FsNode>;
}

export type FsNode = FileNode | DirNode;

export interface DirEntry {
  name: string;
  type: NodeType;
}

export interface VfsState {
  root: DirNode;
  cwd: string;
  list: (path?: string) => DirEntry[] | null;
  readFile: (path: string) => string | null;
  writeFile: (path: string, content: string) => void;
  makeDir: (path: string) => boolean;
  touchFile: (path: string) => boolean;
  removePath: (path: string) => boolean;
  changeDir: (path: string) => boolean;
}

const STORAGE_KEY = "redbyte_vfs_v1";

function defaultRoot(): DirNode {
  return {
    type: "dir",
    children: {
      home: {
        type: "dir",
        children: {
          "1642": {
            type: "dir",
            children: {
              notes: {
                type: "dir",
                children: {
                  "welcome.txt": {
                    type: "file",
                    content:
                      "Welcome to RedByte OS\n\n" +
                      "This is your notes directory.\n" +
                      "Use `notes` app or `cat` in the terminal.\n",
                  },
                },
              },
              projects: {
                type: "dir",
                children: {},
              },
              tmp: {
                type: "dir",
                children: {},
              },
            },
          },
        },
      },
      etc: {
        type: "dir",
        children: {},
      },
    },
  };
}

function cloneRoot(root: DirNode): DirNode {
  return JSON.parse(JSON.stringify(root)) as DirNode;
}

function saveFs(root: DirNode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch {
    // ignore
  }
}

function loadFs(): DirNode {
  if (typeof window === "undefined") {
    return defaultRoot();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRoot();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === "dir" && parsed.children) {
      return parsed as DirNode;
    }
    return defaultRoot();
  } catch {
    return defaultRoot();
  }
}

function normalizePath(cwd: string, target: string): string {
  if (!target || target === ".") return cwd;
  if (target === "/") return "/";

  const isAbs = target.startsWith("/");
  const base = isAbs ? "" : cwd;

  const parts = (base + "/" + target).split("/").filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return "/" + stack.join("/");
}

function getNodeAt(root: DirNode, path: string): FsNode | null {
  if (path === "/") return root;
  const parts = path.split("/").filter(Boolean);
  let cur: FsNode = root;

  for (const part of parts) {
    if (cur.type !== "dir") return null;
    const next = cur.children[part];
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function getParentDir(
  root: DirNode,
  path: string,
  createMissing: boolean
): { dir: DirNode; name: string } | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const name = parts.pop() as string;
  let cur: DirNode = root;

  for (const part of parts) {
    const existing = cur.children[part];
    if (!existing) {
      if (!createMissing) return null;
      const newDir: DirNode = { type: "dir", children: {} };
      cur.children[part] = newDir;
      cur = newDir;
    } else {
      if (existing.type !== "dir") return null;
      cur = existing;
    }
  }

  return { dir: cur, name };
}

export const useVfsStore = create<VfsState>((set, get) => ({
  root: loadFs(),
  cwd: "/home/1642",

  list(path) {
    const state = get();
    const target = normalizePath(state.cwd, path ?? ".");
    const node = getNodeAt(state.root, target);
    if (!node || node.type !== "dir") return null;

    return Object.keys(node.children)
      .sort()
      .map((name) => ({
        name,
        type: node.children[name].type,
      }));
  },

  readFile(path) {
    const state = get();
    const target = normalizePath(state.cwd, path);
    const node = getNodeAt(state.root, target);
    if (!node || node.type !== "file") return null;
    return node.content;
  },

  writeFile(path, content) {
    set((state) => {
      const abs = normalizePath(state.cwd, path);
      const root = cloneRoot(state.root);
      const info = getParentDir(root, abs, true);
      if (!info) return state;
      info.dir.children[info.name] = { type: "file", content };
      saveFs(root);
      return { ...state, root };
    });
  },

  makeDir(path) {
    let ok = false;
    set((state) => {
      const abs = normalizePath(state.cwd, path);
      const root = cloneRoot(state.root);
      const info = getParentDir(root, abs, true);
      if (!info) return state;
      if (!info.dir.children[info.name]) {
        info.dir.children[info.name] = { type: "dir", children: {} };
      }
      ok = true;
      saveFs(root);
      return { ...state, root };
    });
    return ok;
  },

  touchFile(path) {
    let ok = false;
    set((state) => {
      const abs = normalizePath(state.cwd, path);
      const root = cloneRoot(state.root);
      const info = getParentDir(root, abs, true);
      if (!info) return state;
      if (!info.dir.children[info.name]) {
        info.dir.children[info.name] = { type: "file", content: "" };
      }
      ok = true;
      saveFs(root);
      return { ...state, root };
    });
    return ok;
  },

  removePath(path) {
    let ok = false;
    set((state) => {
      const abs = normalizePath(state.cwd, path);
      if (abs === "/") return state;

      const root = cloneRoot(state.root);
      const info = getParentDir(root, abs, false);
      if (!info) return state;
      if (!info.dir.children[info.name]) return state;

      delete info.dir.children[info.name];
      ok = true;
      saveFs(root);
      return { ...state, root };
    });
    return ok;
  },

  changeDir(path) {
    const state = get();
    const abs = normalizePath(state.cwd, path);
    const node = getNodeAt(state.root, abs);
    if (!node || node.type !== "dir") return false;
    set({ cwd: abs });
    return true;
  },
}));
