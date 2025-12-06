import { useState, useEffect } from "react";

/**
 * In-memory filesystem with automatic persistence.
 */
interface FSNodeFile {
  type: "file";
  content: string;
}
interface FSNodeDir {
  type: "dir";
  children: Record<string, FSNode>;
}
type FSNode = FSNodeFile | FSNodeDir;

interface FSApi {
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  list(path: string): string[];
  mkdir(path: string): void;
  exists(path: string): boolean;
}

const STORAGE_KEY = "redbyte_fs_v1";

// ---------- helpers ----------
function ensureDir(root: FSNodeDir, parts: string[]): FSNodeDir {
  let curr = root;
  for (const part of parts) {
    if (!curr.children[part]) {
      curr.children[part] = { type: "dir", children: {} };
    }
    const node = curr.children[part];
    if (node.type !== "dir") throw new Error(`Path component ${part} is not a directory.`);
    curr = node;
  }
  return curr;
}

function getNode(root: FSNodeDir, path: string): FSNode | null {
  const parts = path.split("/").filter(Boolean);
  let curr: FSNode = root;
  for (const p of parts) {
    if (curr.type !== "dir") return null;
    curr = curr.children[p];
    if (!curr) return null;
  }
  return curr;
}

// ---------- FS API ----------
function createFS(): FSApi {
  let root: FSNodeDir = { type: "dir", children: {} };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) root = JSON.parse(saved);
  } catch {}

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    } catch {}
  }

  return {
    readFile(path) {
      const node = getNode(root, path);
      if (!node || node.type !== "file") throw new Error(`File not found: ${path}`);
      return node.content;
    },

    writeFile(path, content) {
      const parts = path.split("/").filter(Boolean);
      const filename = parts.pop()!;
      const dir = ensureDir(root, parts);
      dir.children[filename] = { type: "file", content };
      persist();
    },

    list(path) {
      const node = getNode(root, path);
      if (!node || node.type !== "dir") throw new Error(`Directory not found: ${path}`);
      return Object.keys(node.children);
    },

    mkdir(path) {
      ensureDir(root, path.split("/").filter(Boolean));
      persist();
    },

    exists(path) {
      return getNode(root, path) !== null;
    }
  };
}

const fs = createFS();

// ---------- React hook wrapper ----------
export function useFS() {
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(x => x + 1);

  useEffect(() => {}, []);

  return {
    readFile: (p: string) => fs.readFile(p),
    writeFile: (p: string, c: string) => {
      fs.writeFile(p, c);
      forceUpdate();
    },
    list: (p: string) => fs.list(p),
    mkdir: (p: string) => {
      fs.mkdir(p);
      forceUpdate();
    },
    exists: (p: string) => fs.exists(p),
  };
}

export default fs;
