import React from "react";
import { World3DApp } from "./World3DApp";
import { WorldMap2DApp } from "./WorldMap2DApp";
import { RedstoneStatsApp } from "./RedstoneStatsApp";
import { SignalScopeApp } from "./SignalScopeApp";
import { AnalyzerApp } from "./AnalyzerApp";

/**
 * RedstoneLabApp
 *
 * High-level demo control room that embeds the core RedByte
 * redstone tools into a single window:
 * - 3D voxel world
 * - 2D map
 * - Stats
 * - Signal scope
 * - Analyzer
 *
 * This is THE app to open when you want to show off the platform.
 */
export function RedstoneLabApp() {
  return (
    <div className="h-full w-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Redstone Lab — Control Room
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Unified workspace for building, simulating, and inspecting
            Redstone circuits. Everything here shares the same underlying
            voxel world and simulation engine.
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
                Voxel world with real dust physics, repeaters, comparators and
                shared state with all other panels.
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
                  Top-down editor for a single Y-level. Editing here modifies
                  the same world that the 3D view is rendering.
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
                Live metrics from the 3D engine: gate counts, power clusters,
                tick times and more.
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
                Waveform view of captured probes. Great for clocks, edges and
                analog strength changes over time.
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
                Higher-level views of your circuits: traces, captured sessions
                and structural analysis.
              </p>
              <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/90">
                <AnalyzerApp />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RedstoneLabApp;
