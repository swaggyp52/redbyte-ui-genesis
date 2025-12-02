import React, { useEffect, useState } from "react";
import { runBootSequence } from "./BootLogic";

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Starting...");

  useEffect(() => {
    runBootSequence((p, lbl) => {
      setProgress(p);
      setLabel(lbl);
      if (p >= 1) {
        setTimeout(() => onDone(), 400);
      }
    });
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-200">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-fuchsia-400 to-sky-400 text-transparent bg-clip-text mb-6">
        RedByte OS
      </h1>

      <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-sky-500 transition-all duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <p className="mt-4 text-xs text-slate-400">{label}</p>

      <p className="absolute bottom-4 text-[0.65rem] text-slate-600">
        RedByte Systems — Bootloader v30
      </p>
    </div>
  );
}

export default BootScreen;
