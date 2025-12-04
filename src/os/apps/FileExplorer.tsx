import React, { useState } from "react";
import { useFS } from "../core/fsStore";

const FileExplorer: React.FC = () => {
  const fs = useFS();
  const [path, setPath] = useState("/");

  const parts = path.split("/").filter(Boolean);
  const entries = fs.list(path) || [];

  const open = (name: string, type: string) => {
    if (type === "folder") setPath(path === "/" ? `/${name}` : `${path}/${name}`);
  };

  return (
    <div className="h-full w-full bg-black/70 text-[12px] font-mono text-red-100 p-3 flex flex-col">
      <div className="border-b border-red-900/60 pb-2 mb-2 flex items-center justify-between">
        <div>{path}</div>
        <button
          className="text-red-300 hover:text-red-100"
          onClick={() => {
            const up = parts.slice(0, -1).join("/");
            setPath(up ? `/${up}` : "/");
          }}
        >
          up
        </button>
      </div>

      <div className="overflow-auto flex-1 space-y-1">
        {entries.map((e) => (
          <div
            key={e.name}
            onClick={() => open(e.name, e.type)}
            className="flex items-center gap-3 hover:bg-red-900/30 px-2 py-1 cursor-pointer"
          >
            <span className={`text-[10px] ${e.type === "folder" ? "text-red-300" : "text-red-500"}`}>
              [{e.type}]
            </span>
            <span>{e.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;
