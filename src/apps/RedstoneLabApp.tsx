import React, { useState } from "react";
import { World3DApp } from "./World3DApp";
import { WorldMap2DApp } from "./WorldMap2DApp";
import { RedstoneStatsApp } from "./RedstoneStatsApp";
import { SignalScopeApp } from "./SignalScopeApp";
import { AnalyzerApp } from "./AnalyzerApp";
import { LogicWorkspaceApp } from "./LogicWorkspaceApp";

/**
 * RedstoneLabApp
 *
 * High-level demo control room that now has two main modes:
 * - Logic mode: 2D diagrams that feel like a simple, friendly engineering tool
 * - Visual mode: 3D world + 2D slice + stats/scope/analyzer
 *
 * This is THE app to open when you want to show off the platform to
 * non-technical people (logic view) and to more technical folks (visual mode).
 */
type LabMode = "logic" | "visual";

export function RedstoneLabApp() {
  const [mode, setMode] = useState<LabMode>("logic");

  return (
    <div className="h-full w-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Redstone Lab — Control Room
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Unified workspace for building, simulating, and explaining logic.
            Start in the simple Logic view, then jump into the 3D Redstone
            world when you want to see it as blocks and dust.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] text-emerald-300 font-mono">
            ENGINE://V23-DUST
          </span>
          <span className="text-[0.65rem] text-slate-500 uppercase">
            LAB://CONTROL-ROOM
          </span>
        </div>
      </header>

      {/* Mode toggle */}
      <section className="rb-glass rounded-2xl px-3 py-2 border border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[0.7rem]">
          <span className="text-slate-400">View mode</span>
          <div className="inline-flex rounded-xl bg-slate-950/80 border border-slate-800/80 p-0.5">
            <button
              onClick={() => setMode("logic")}
              className={`px-3 py-1 rounded-lg text-[0.7rem] ${
                mode === "logic"
                  ? "bg-sky-500/20 text-sky-200 border border-sky-400/70"
                  : "text-slate-400 border-transparent hover:text-slate-100"
              }`}
            >
              Logic (2D)
            </button>
            <button
              onClick={() => setMode("visual")}
              className={`px-3 py-1 rounded-lg text-[0.7rem] ${
                mode === "visual"
                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/70"
                  : "text-slate-400 border-transparent hover:text-slate-100"
              }`}
            >
              Redstone (3D + 2D)
            </button>
          </div>
        </div>
        <p className="text-[0.7rem] text-slate-400 max-w-xl">
          Logic mode is friendlier for people who have never touched Minecraft.
          Visual mode shows the same ideas as a 3D world and map for more
          advanced exploration.
        </p>
      </section>

      {mode === "logic" ? (
        // ----------------------------------------------------------
        // LOGIC MODE: full-width LogicWorkspaceApp
        // ----------------------------------------------------------
        <div className="flex-1 min-h-0 rb-glass rounded-2xl border border-slate-800/80 overflow-hidden">
          <LogicWorkspaceApp />
        </div>
      ) : (
        // ----------------------------------------------------------
        // VISUAL MODE: 3D world + 2D map + stats/scope/analyzer
        // ----------------------------------------------------------
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {/* Main layout: 3D world on the left, stacked panels on the right */}
          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-3">
            {/* Left: 3D world */}
            <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xs font-semibold text-slate-100">
                    3D Redstone World
                  </h2>
                  <p className="text-[0.7rem] text-slate-400">
                    Orbit the world, click blocks to change them, and watch
                    power flow through dust, repeaters and comparators in real
                    time.
                  </p>
                </div>
                <span className="text-[0.65rem] text-slate-500 font-mono">
                  VIEW://3D
                </span>
              </div>
              <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/90">
                <World3DApp />
              </div>
            </section>

            {/* Right: stacked panels */}
            <div className="flex flex-col gap-3 min-h-0">
              {/* 2D Map */}
              <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col min-h-[10rem] flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-xs font-semibold text-slate-100">
                      2D Slice Map
                    </h2>
                    <p className="text-[0.7rem] text-slate-400">
                      Top-down editor for a single Y-level. Use this when the
                      3D view feels too busy — it is the same world, just
                      flattened.
                    </p>
                  </div>
                  <span className="text-[0.65rem] text-slate-500 font-mono">
                    VIEW://2D-MAP
                  </span>
                </div>
                <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/90">
                  <WorldMap2DApp />
                </div>
              </section>

              {/* Bottom row: stats + scope + analyzer */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-[12rem]">
                <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xs font-semibold text-slate-100">
                      Simulation Stats
                    </h2>
                    <span className="text-[0.65rem] text-slate-500 font-mono">
                      PANEL://STATS
                    </span>
                  </div>
                  <p className="text-[0.7rem] text-slate-400 mb-2">
                    Live metrics from the 3D engine: gate counts, power
                    clusters, tick times and more. Great for explaining how
                    complex a build is.
                  </p>
                  <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/90">
                    <RedstoneStatsApp />
                  </div>
                </section>

                <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xs font-semibold text-slate-100">
                      Signal Scope
                    </h2>
                    <span className="text-[0.65rem] text-slate-500 font-mono">
                      PANEL://SCOPE
                    </span>
                  </div>
                  <p className="text-[0.7rem] text-slate-400 mb-2">
                    Waveform view of captured probes. Use this to show clocks,
                    pulses and analog strength changes over time.
                  </p>
                  <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/90">
                    <SignalScopeApp />
                  </div>
                </section>

                <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xs font-semibold text-slate-100">
                      Analyzer
                    </h2>
                    <span className="text-[0.65rem] text-slate-500 font-mono">
                      PANEL://ANALYZER
                    </span>
                  </div>
                  <p className="text-[0.7rem] text-slate-400 mb-2">
                    Higher-level views of your circuits: traces, captured
                    sessions and structural analysis; more useful as designs
                    get larger.
                  </p>
                  <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/90">
                    <AnalyzerApp />
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RedstoneLabApp;

















