import React, { useEffect, useState } from "react";
import { useFS } from "../core/fsStore";

const NotesApp: React.FC = () => {
  const fs = useFS();
  const path = "/system/notes.txt";

  const [txt, setTxt] = useState("");

  useEffect(() => {
    const found = fs.readFile(path);
    if (found != null) setTxt(found);
    else fs.createFile(path, "");
  }, []);

  useEffect(() => {
    fs.writeFile(path, txt);
  }, [txt]);

  return (
    <div className="h-full w-full bg-black/70 flex flex-col">
      <textarea
        className="flex-1 p-3 bg-transparent text-[12px] font-mono text-red-100 outline-none resize-none"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
      />
      <div className="h-7 border-t border-red-900/60 px-3 flex items-center justify-between text-[10px] text-red-300">
        <span>notes.txt</span>
        <span>autosaved</span>
      </div>
    </div>
  );
};

export default NotesApp;
