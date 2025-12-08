import React from "react";
import { useSettings, LayoutMode } from "../context/SettingsContext";

const SettingsApp: React.FC = () => {
    const { layoutMode, gridSize, setLayoutMode, setGridSize } = useSettings();

    return (
        <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex flex-col p-4 gap-4">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-red-300/80">
                    system preferences
                </div>
                <div className="text-[11px] text-slate-400">
                    Edit desktop behavior and snapping engine.
                </div>
            </div>

            {/* Window Layout Mode */}
            <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 flex flex-col gap-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    window mode
                </div>

                <label className="flex items-center gap-2 text-[11px]">
                    <input
                        type="radio"
                        name="layout"
                        checked={layoutMode === "free"}
                        onChange={() => setLayoutMode("free")}
                    />
                    <span>Freeform (no snapping)</span>
                </label>

                <label className="flex items-center gap-2 text-[11px]">
                    <input
                        type="radio"
                        name="layout"
                        checked={layoutMode === "smart"}
                        onChange={() => setLayoutMode("smart")}
                    />
                    <span>SmartSnap (grid + magnet edges)</span>
                </label>
            </div>

            {/* Grid Size */}
            <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 flex flex-col gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    snapping grid
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min={4}
                        max={64}
                        step={4}
                        value={gridSize}
                        onChange={(e) => setGridSize(parseInt(e.target.value))}
                        className="flex-1"
                    />
                    <span className="text-red-300">{gridSize}px</span>
                </div>

                <div className="text-[10px] text-slate-500">
                    Large values = chunkier snapping. Small values = fine control.
                </div>
            </div>

            <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 text-[10px] text-slate-400">
                More settings coming soon: themes, animations, performance modes,
                layout presets, autosave, profiles, and dev tools.
            </div>
        </div>
    );
};

export default SettingsApp;
