import React from "react";
import { Accent, Density, useTheme } from "../core/themeStore";

const SettingsApp: React.FC = () => {
  const { accent, density, setAccent, setDensity } = useTheme();

  const accents: Accent[] = ["red", "blue", "green"];
  const densities: Density[] = ["normal", "compact"];

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex flex-col p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-red-300/80 mb-1">
        settings
      </div>

      {/* accent color */}
      <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
        <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
          accent color
        </div>
        <div className="flex gap-2">
          {accents.map((c) => (
            <button
              key={c}
              onClick={() => setAccent(c)}
              className={[
                "px-2 py-1 rounded border text-[10px] capitalize transition-colors",
                accent === c
                  ? "border-red-400 text-red-200 bg-red-950/40"
                  : "border-red-900 text-slate-300 hover:border-red-500/80"
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* layout density */}
      <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
        <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
          layout density
        </div>
        <div className="flex gap-2">
          {densities.map((d) => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={[
                "px-2 py-1 rounded border text-[10px] capitalize transition-colors",
                density === d
                  ? "border-red-400 text-red-200 bg-red-950/40"
                  : "border-red-900 text-slate-300 hover:border-red-500/80"
              ].join(" ")}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto text-[10px] text-slate-500">
        settings are stored locally in this browser. accent + density are
        applied across the desktop in real time.
      </div>
    </div>
  );
};

export default SettingsApp;
