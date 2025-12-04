import { create } from "zustand";

export interface FSNode {
  type: "file" | "folder";
  name: string;
  children?: FSNode[];
  content?: string;
}

interface FSState {
  root: FSNode;
  createFile: (path: string, content?: string) => void;
  createFolder: (path: string) => void;
  readFile: (path: string) => string | null;
  writeFile: (path: string, content: string) => void;
  list: (path: string) => FSNode[] | null;
}

function getNode(root: FSNode, parts: string[]): FSNode | null {
  if (parts.length === 0) return root;
  const [head, ...rest] = parts;
  if (!root.children) return null;
  const next = root.children.find((c) => c.name === head);
  if (!next) return null;
  return getNode(next, rest);
}

export const useFS = create<FSState>((set, get) => ({
  root: {
    type: "folder",
    name: "/",
    children: [
      { type: "folder", name: "projects", children: [] },
      { type: "folder", name: "system", children: [] },
      { type: "file", name: "readme.txt", content: "Welcome to RedByte OS" }
    ]
  },

  createFolder: (path) => {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) return;

    set((state) => {
      const parent = getNode(state.root, parts);
      if (!parent || parent.type !== "folder") return state;
      if (!parent.children) parent.children = [];
      parent.children.push({ type: "folder", name, children: [] });
      return { ...state };
    });
  },

  createFile: (path, content = "") => {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) return;

    set((state) => {
      const parent = getNode(state.root, parts);
      if (!parent || parent.type !== "folder") return state;
      if (!parent.children) parent.children = [];
      parent.children.push({ type: "file", name, content });
      return { ...state };
    });
  },

  readFile: (path) => {
    const parts = path.split("/").filter(Boolean);
    const file = getNode(get().root, parts);
    return file && file.type === "file" ? file.content || "" : null;
  },

  writeFile: (path, content) => {
    const parts = path.split("/").filter(Boolean);
    const file = getNode(get().root, parts);
    if (file && file.type === "file") {
      file.content = content;
      set((state) => ({ ...state }));
    }
  },

  list: (path) => {
    const parts = path.split("/").filter(Boolean);
    const folder = getNode(get().root, parts);
    if (folder && folder.type === "folder") return folder.children || [];
    return null;
  }
}));
