import React, { useState } from "react";
import {
  getNode,
  listChildren,
  createFile,
  createFolder,
  deleteNode,
  renameNode,
} from "../fs/RVFS";
import { useSystem } from "../os/core/SystemProvider";

export function FileExplorerApp() {
  const root = getNode("root")!;
  const [currentId, setCurrentId] = useState(root.id);
  const [refresh, setRefresh] = useState(0);
  const { openApp } = useSystem();

  const current = getNode(currentId)!;
  const items = listChildren(currentId);

  const triggerRefresh = () => setRefresh((n) => n + 1);

  const openItem = (id: string) => {
    const n = getNode(id);
    if (!n) return;
    if (n.type === "folder") {
      setCurrentId(id);
    } else if (n.type === "file") {
      // open file in Notes
      openApp("notes");
      setTimeout(() => {
        const textarea = document.querySelector("textarea");
        if (textarea) (textarea as HTMLTextAreaElement).value = n.content || "";
      }, 100);
    }
  };

  const createNewFile = () => {
    const name = prompt("File name:");
    if (!name) return;
    createFile(currentId, name);
    triggerRefresh();
  };

  const createNewFolder = () => {
    const name = prompt("Folder name:");
    if (!name) return;
    createFolder(currentId, name);
    triggerRefresh();
  };

  const renameItem = (id: string) => {
    const name = prompt("New name:");
    if (!name) return;
    renameNode(id, name);
    triggerRefresh();
  };

  const deleteItem = (id: string) => {
    if (confirm("Delete this item?")) {
      deleteNode(id);
      triggerRefresh();
    }
  };

  const goUp = () => {
    const node = getNode(currentId);
    if (node?.parentId) {
      setCurrentId(node.parentId);
    }
  };

  return (
    <div className="h-full flex flex-col text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">File Explorer</h1>
          <p className="text-[0.7rem] text-slate-400">
            Virtual filesystem storage for worlds & blueprints.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          FS://{current.name.toUpperCase()}
        </span>
      </header>

      <div className="flex gap-2 py-2">
        <button
          className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-pink-500/70"
          onClick={goUp}
        >
          Up
        </button>
        <button
          className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-emerald-500/70"
          onClick={createNewFile}
        >
          New File
        </button>
        <button
          className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-sky-500/70"
          onClick={createNewFolder}
        >
          New Folder
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-slate-950/80 border border-slate-800/80 p-2">
        {items.length === 0 ? (
          <div className="text-[0.7rem] text-slate-500">Empty folder</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between px-2 py-1 rounded-xl hover:bg-slate-900/80 cursor-pointer"
                onClick={() => openItem(n.id)}
              >
                <span className="flex items-center gap-2 text-slate-200">
                  {n.type === "folder" ? "📁" : "📄"} {n.name}
                </span>
                <div className="flex gap-2">
                  <button
                    className="text-[0.6rem] text-slate-400 hover:text-pink-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      renameItem(n.id);
                    }}
                  >
                    rename
                  </button>
                  <button
                    className="text-[0.6rem] text-rose-400 hover:text-rose-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(n.id);
                    }}
                  >
                    delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
