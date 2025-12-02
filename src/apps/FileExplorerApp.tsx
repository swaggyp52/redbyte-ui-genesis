import React, { useEffect, useMemo, useState } from "react";

type NodeType = "folder" | "file";

interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  children?: FSNode[];
  content?: string;
  updatedAt: number;
}

interface RecentEntry {
  id: string;
  name: string;
  path: string;
  openedAt: number;
}

const RECENT_KEY = "redbyte_recent_files_v1";

const now = () => Date.now();

function makeId() {
  return Math.random().toString(36).slice(2);
}

// Initial tree: just a friendly, fake filesystem for now
const INITIAL_FS: FSNode = {
  id: "root",
  name: "RedByte",
  type: "folder",
  updatedAt: now(),
  children: [
    {
      id: "docs",
      name: "Documents",
      type: "folder",
      updatedAt: now(),
      children: [
        {
          id: "welcome",
          name: "Welcome to RedByte.txt",
          type: "file",
          updatedAt: now(),
          content:
            "Welcome to RedByte OS.\n\nThis File Explorer is a virtual filesystem for your projects, diagrams and simulations.\n\nIn future versions, this will save to cloud and share across devices.",
        },
        {
          id: "cpu-notes",
          name: "CPU Design Notes.md",
          type: "file",
          updatedAt: now(),
          content:
            "# CPU Design Notes\n\n- ALU: add, sub, compare\n- Registers: A, B, ACC, PC\n- Control: simple micro-steps for FETCH / DECODE / EXECUTE\n\nYou can mirror these ideas in the CPU Designer app.",
        },
      ],
    },
    {
      id: "projects",
      name: "Projects",
      type: "folder",
      updatedAt: now(),
      children: [
        {
          id: "traffic-light-logic",
          name: "TrafficLight.logic.json",
          type: "file",
          updatedAt: now(),
          content:
            "{\n  \"name\": \"Traffic Light Controller\",\n  \"inputs\": [\"car_present\", \"walk_button\"],\n  \"outputs\": [\"main_green\", \"walk_green\"],\n  \"notes\": \"Matches the Logic Designer example.\"\n}",
        },
        {
          id: "mini-cpu",
          name: "MiniCPU.core.json",
          type: "file",
          updatedAt: now(),
          content:
            "{\n  \"name\": \"Mini CPU Core\",\n  \"parts\": [\"ALU\", \"PC\", \"Registers\", \"Control\"],\n  \"notes\": \"High-level description of a teaching CPU.\"\n}",
        },
      ],
    },
    {
      id: "exports",
      name: "Exports",
      type: "folder",
      updatedAt: now(),
      children: [
        {
          id: "example-verilog",
          name: "example_circuit.v",
          type: "file",
          updatedAt: now(),
          content:
            "// Example Verilog-style output from Logic Designer.\nmodule example_circuit(input a, input b, output y);\n  assign y = a & b;\nendmodule\n",
        },
      ],
    },
  ],
};

function pathToString(path: string[]): string {
  if (path.length === 0) return "RedByte://";
  return "RedByte://" + path.join("/");
}

function loadRecents(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentEntry[];
  } catch {
    return [];
  }
}

function saveRecents(recents: RecentEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
  } catch {
    // ignore
  }
}

function findNode(root: FSNode, path: string[]): FSNode | null {
  let current: FSNode = root;
  for (const segment of path) {
    if (!current.children || current.type !== "folder") return null;
    const next = current.children.find((n) => n.name === segment);
    if (!next) return null;
    current = next;
  }
  return current;
}

function listChildren(node: FSNode): FSNode[] {
  if (node.type !== "folder" || !node.children) return [];
  return [...node.children].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    if (a.type === "folder") return -1;
    return 1;
  });
}

export function FileExplorerApp() {
  const [root] = useState<FSNode>(INITIAL_FS);
  const [path, setPath] = useState<string[]>(["Documents"]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  const currentNode = useMemo(
    () => findNode(root, path) ?? root,
    [root, path]
  );

  const children = useMemo(() => listChildren(currentNode), [currentNode]);

  const selectedNode: FSNode | null = useMemo(() => {
    if (!selectedId) return null;
    if (!currentNode.children) return null;
    return currentNode.children.find((n) => n.id === selectedId) ?? null;
  }, [currentNode, selectedId]);

  function openFolder(node: FSNode) {
    if (node.type !== "folder") return;
    setPath((prev) => [...prev.slice(0, -0), node.name].slice(0, 32)); // simple
    setSelectedId(null);
  }

  function openFile(node: FSNode) {
    if (node.type !== "file") return;
    setSelectedId(node.id);

    const fullPath = [...path, node.name];
    const entry: RecentEntry = {
      id: node.id,
      name: node.name,
      path: pathToString(fullPath),
      openedAt: Date.now(),
    };

    setRecents((prev) => {
      const filtered = prev.filter((r) => r.id !== node.id);
      const updated = [entry, ...filtered].slice(0, 20);
      saveRecents(updated);
      return updated;
    });
  }

  function goUp() {
    setPath((prev) => prev.slice(0, -1));
    setSelectedId(null);
  }

  function jumpToRecent(rec: RecentEntry) {
    const withoutPrefix = rec.path.replace(/^RedByte:\/\//, "");
    const segments = withoutPrefix ? withoutPrefix.split("/") : [];
    if (segments.length === 0) {
      setPath([]);
      setSelectedId(null);
      return;
    }

    const fileName = segments[segments.length - 1];
    const folderPath = segments.slice(0, -1);

    setPath(folderPath);
    setTimeout(() => {
      const folderNode = findNode(root, folderPath);
      if (!folderNode || !folderNode.children) return;
      const fileNode = folderNode.children.find((c) => c.name === fileName);
      if (!fileNode) return;
      setSelectedId(fileNode.id);
    }, 0);
  }

  return (
    <div className="h-full w-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            File Explorer — RedByte FS
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Browse virtual folders for documents, projects and exports. This is
            the starting point for a real filesystem and cloud sync.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] text-emerald-300 font-mono">
            FS://VIRTUAL-V1
          </span>
          <span className="text-[0.65rem] text-slate-500">
            {pathToString(path)}
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr] gap-3">
        {/* Sidebar: quick access + tree */}
        <aside className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col gap-3">
          <section>
            <h2 className="text-[0.75rem] font-semibold text-slate-100 mb-1">
              Quick Access
            </h2>
            <div className="flex flex-col gap-1 text-[0.75rem]">
              <button
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/70 text-slate-200"
                onClick={() => {
                  setPath([]);
                  setSelectedId(null);
                }}
              >
                <span>🏠</span>
                <span>Home (RedByte)</span>
              </button>
              <button
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/70 text-slate-200"
                onClick={() => {
                  setPath(["Documents"]);
                  setSelectedId(null);
                }}
              >
                <span>📄</span>
                <span>Documents</span>
              </button>
              <button
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/70 text-slate-200"
                onClick={() => {
                  setPath(["Projects"]);
                  setSelectedId(null);
                }}
              >
                <span>📁</span>
                <span>Projects</span>
              </button>
              <button
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/70 text-slate-200"
                onClick={() => {
                  setPath(["Exports"]);
                  setSelectedId(null);
                }}
              >
                <span>📦</span>
                <span>Exports</span>
              </button>
            </div>
          </section>

          <section className="border-t border-slate-800/80 pt-2 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[0.75rem] font-semibold text-slate-100">
                Folder Contents
              </h2>
              <button
                onClick={goUp}
                disabled={path.length === 0}
                className="px-2 py-0.5 rounded-lg border border-slate-700/80 text-[0.7rem] text-slate-300 hover:bg-slate-800/80 disabled:opacity-40"
              >
                Up
              </button>
            </div>
            <div className="border border-slate-800/80 rounded-xl bg-slate-950/90 max-h-full overflow-auto">
              {children.length === 0 ? (
                <div className="p-3 text-[0.75rem] text-slate-500">
                  This folder is empty.
                </div>
              ) : (
                <ul className="divide-y divide-slate-800/80">
                  {children.map((node) => (
                    <li
                      key={node.id}
                      className={`flex items-center justify-between px-2 py-1.5 text-[0.75rem] cursor-pointer hover:bg-slate-800/80 ${
                        selectedId === node.id ? "bg-slate-800/80" : ""
                      }`}
                      onClick={() =>
                        node.type === "folder" ? openFolder(node) : openFile(node)
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span>{node.type === "folder" ? "📁" : "📄"}</span>
                        <span className="text-slate-100">{node.name}</span>
                      </div>
                      <span className="text-[0.65rem] text-slate-500">
                        {node.type === "folder" ? "Folder" : "File"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </aside>

        {/* Main: file preview + recent files */}
        <main className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col gap-3">
          <section className="flex-1 min-h-[8rem] flex flex-col">
            <h2 className="text-[0.75rem] font-semibold text-slate-100 mb-1">
              File Preview
            </h2>
            <div className="flex-1 min-h-0 border border-slate-800/80 rounded-xl bg-slate-950/95 p-2">
              {selectedNode && selectedNode.type === "file" ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span>📄</span>
                      <span className="text-[0.8rem] text-slate-100 font-semibold">
                        {selectedNode.name}
                      </span>
                    </div>
                    <span className="text-[0.65rem] text-slate-500">
                      Read-only preview
                    </span>
                  </div>
                  <pre className="flex-1 min-h-0 text-[0.7rem] text-slate-200 whitespace-pre-wrap overflow-auto bg-slate-950/90 rounded-lg px-2 py-1">
                    {selectedNode.content ?? "(empty file)"}
                  </pre>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-[0.75rem] text-slate-500">
                  Select a file on the left to see its contents.
                </div>
              )}
            </div>
          </section>

          <section className="border-t border-slate-800/80 pt-2">
            <h2 className="text-[0.75rem] font-semibold text-slate-100 mb-1">
              Recent Files
            </h2>
            {recents.length === 0 ? (
              <p className="text-[0.7rem] text-slate-500">
                No recent files yet. Open some files from the left to populate this list.
              </p>
            ) : (
              <div className="border border-slate-800/80 rounded-xl bg-slate-950/95 max-h-32 overflow-auto">
                <ul className="divide-y divide-slate-800/80 text-[0.75rem]">
                  {recents.map((r) => (
                    <li
                      key={r.id + r.openedAt}
                      className="px-2 py-1.5 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer"
                      onClick={() => jumpToRecent(r)}
                    >
                      <div className="flex flex-col">
                        <span className="text-slate-100">{r.name}</span>
                        <span className="text-[0.65rem] text-slate-500">
                          {r.path}
                        </span>
                      </div>
                      <span className="text-[0.65rem] text-slate-500">
                        {new Date(r.openedAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default FileExplorerApp;





