import React, { useEffect, useState } from "react";
import {
  listBlueprintMeta,
  deleteBlueprint,
  loadBlueprint,
  saveBlueprint,
} from "../sim/RedstoneBlueprints";
import { useSystem } from "../os/core/SystemProvider";
import { createGrid } from "../sim/RedstoneEngine";
import { setActiveBlueprintName } from "../sim/RedstoneSession";

export function RedstoneLabApp() {
  const [blueprints, setBlueprints] = useState(() => listBlueprintMeta());
  const { openApp } = useSystem();

  const refresh = () => {
    setBlueprints(listBlueprintMeta());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleOpenInSim = (name: string) => {
    // Set session blueprint and then open the sim.
    setActiveBlueprintName(name);
    openApp("sim");
  };

  const handleDelete = (name: string) => {
    if (!window.confirm(`Delete blueprint "${name}"?`)) return;
    deleteBlueprint(name);
    refresh();
  };

  const handleNewBlank = () => {
    const name = window.prompt("New blueprint name:");
    if (!name) return;
    const grid = createGrid({ width: 16, height: 16 });
    saveBlueprint(name, grid);
    refresh();
  };

  const handleDuplicate = (name: string) => {
    const newName = window.prompt("Duplicate as:", `${name}-copy`);
    if (!newName) return;
    const grid = loadBlueprint(name);
    if (!grid) {
      window.alert("Original blueprint could not be loaded.");
      return;
    }
    saveBlueprint(newName, grid);
    refresh();
  };

  const handleOpenSimBlank = () => {
    setActiveBlueprintName(null);
    openApp("sim");
  };

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Redstone Lab
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Manage Redstone blueprints and launch simulations.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          LAB://REDSTONE
        </span>
      </header>

      <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="px-2 py-1 rounded-xl border border-emerald-500/70 text-[0.7rem] text-emerald-300 hover:bg-emerald-500/10"
            onClick={handleNewBlank}
          >
            New Blank Blueprint
          </button>
          <button
            className="px-2 py-1 rounded-xl border border-sky-500/70 text-[0.7rem] text-sky-300 hover:bg-sky-500/10"
            onClick={handleOpenSimBlank}
          >
            Open Sim (blank)
          </button>
          <button
            className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-pink-500/70"
            onClick={refresh}
          >
            Refresh
          </button>
          <span className="ml-auto text-[0.7rem] text-slate-400">
            Stored under <span className="font-mono">/Redstone</span> in RVFS
          </span>
        </div>
      </section>

      <section className="flex-1 min-h-0 rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <h2 className="text-xs font-semibold text-slate-100">
          Blueprints
        </h2>
        <div className="text-[0.7rem] text-slate-400 mb-1">
          These are saved Redstone grids. Use duplicate to experiment on a copy.
        </div>

        <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-slate-950/80 border border-slate-800/80">
          {blueprints.length === 0 ? (
            <div className="px-3 py-2 text-[0.7rem] text-slate-500">
              No blueprints yet. Create one with{" "}
              <span className="font-mono">New Blank Blueprint</span>.
            </div>
          ) : (
            <table className="w-full text-[0.7rem]">
              <thead className="bg-slate-900/80 sticky top-0">
                <tr className="text-slate-400 text-left">
                  <th className="px-2 py-1 font-normal">Name</th>
                  <th className="px-2 py-1 font-normal">Created</th>
                  <th className="px-2 py-1 font-normal">Updated</th>
                  <th className="px-2 py-1 font-normal text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {blueprints.map((bp) => (
                  <tr
                    key={bp.id}
                    className="border-t border-slate-900/80"
                  >
                    <td className="px-2 py-1 text-slate-100 truncate max-w-[10rem]">
                      {bp.name}
                    </td>
                    <td className="px-2 py-1 text-slate-400">
                      {new Date(bp.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-slate-400">
                      {new Date(bp.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          className="px-2 py-0.5 rounded-full border border-sky-500/70 text-sky-300 hover:bg-sky-500/10"
                          onClick={() => handleOpenInSim(bp.name)}
                        >
                          Open in Sim
                        </button>
                        <button
                          className="px-2 py-0.5 rounded-full border border-slate-700/80 text-slate-300 hover:bg-slate-700/50"
                          onClick={() => handleDuplicate(bp.name)}
                        >
                          Duplicate
                        </button>
                        <button
                          className="px-2 py-0.5 rounded-full border border-rose-500/70 text-rose-300 hover:bg-rose-500/10"
                          onClick={() => handleDelete(bp.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
