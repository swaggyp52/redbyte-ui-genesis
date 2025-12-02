import React, { useEffect, useRef, useState } from "react";
import {
  createGrid,
  stepGrid,
  toggleCell,
  getNeighbors,
} from "../sim/RedstoneEngine";
import type { RedstoneGrid, RedstoneCell } from "../sim/RedstoneTypes";
import {
  listBlueprints,
  saveBlueprint,
  loadBlueprint,
} from "../sim/RedstoneBlueprints";
import {
  getActiveBlueprintName,
  setActiveBlueprintName,
} from "../sim/RedstoneSession";
import { addWatchpoint, recordTick } from "../sim/RedstoneTrace";

interface SelectedCell {
  x: number;
  y: number;
}

function describeCell(cell: RedstoneCell): string {
  switch (cell.type) {
    case "empty":
      return "Empty";
    case "wire":
      return "Wire";
    case "source":
      return "Power Source";
    case "gate_and":
      return "AND Gate";
    case "gate_or":
      return "OR Gate";
    case "gate_not":
      return "NOT Gate";
    case "output":
      return "Output";
    default:
      return cell.type;
  }
}

export function RedstoneSimApp() {
  const [grid, setGrid] = useState<RedstoneGrid>(() =>
    createGrid({ width: 16, height: 16 })
  );
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);
  const [tickRate, setTickRate] = useState(4); // ticks per second
  const [zoom, setZoom] = useState(1); // viewport scale
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [blueprints, setBlueprints] = useState<string[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<string>("");

  // On mount, try to load active blueprint from session bridge
  useEffect(() => {
    const name = getActiveBlueprintName();
    setBlueprints(listBlueprints());
    if (name) {
      const loaded = loadBlueprint(name);
      if (loaded) {
        setGrid(loaded);
        tickRef.current = 0;
        setTick(0);
        setRunning(false);
        setSelected(null);
        setSelectedBlueprint(name);
      }
      // Clear active blueprint after using it
      setActiveBlueprintName(null);
    }
  }, []);

  // Auto-run tick loop (integration with trace)
  useEffect(() => {
    if (!running) return;

    const interval = 1000 / Math.max(1, tickRate);
    const id = window.setInterval(() => {
      setGrid((prev) => {
        const next = stepGrid(prev);
        const nextTick = tickRef.current + 1;
        tickRef.current = nextTick;
        setTick(nextTick);
        recordTick(next, nextTick);
        return next;
      });
    }, interval);

    return () => window.clearInterval(id);
  }, [running, tickRate]);

  // Keyboard shortcuts: space = step, R = reset, P = play/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.target && (e.target as HTMLElement).tagName === "TEXTAREA")
        return;

      if (e.key === " ") {
        e.preventDefault();
        setRunning(false);
        handleStep();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setRunning((r) => !r);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellClick = (x: number, y: number) => {
    setSelected({ x, y });
    setGrid((prev) => toggleCell(prev, x, y));
  };

  const handleStep = () => {
    setGrid((prev) => {
      const next = stepGrid(prev);
      const nextTick = tickRef.current + 1;
      tickRef.current = nextTick;
      setTick(nextTick);
      recordTick(next, nextTick);
      return next;
    });
  };

  const handleReset = () => {
    const fresh = createGrid({ width: 16, height: 16 });
    setGrid(fresh);
    tickRef.current = 0;
    setTick(0);
    setRunning(false);
    setSelected(null);
    // reset trace history to align with new sim; we just record tick 0 state
    recordTick(fresh, 0);
  };

  const handleSaveBlueprint = () => {
    const name = window.prompt(
      "Blueprint name:",
      selectedBlueprint || "my-circuit"
    );
    if (!name) return;
    saveBlueprint(name, grid);
    setBlueprints(listBlueprints());
    setSelectedBlueprint(name);
  };

  const handleLoadBlueprint = () => {
    if (!selectedBlueprint) return;
    const loaded = loadBlueprint(selectedBlueprint);
    if (loaded) {
      setGrid(loaded);
      tickRef.current = 0;
      setTick(0);
      setRunning(false);
      setSelected(null);
      recordTick(loaded, 0);
    } else {
      window.alert("Failed to load blueprint.");
    }
  };

  const handleAddWatch = () => {
    if (!selected) {
      window.alert("Select a cell in the grid first.");
      return;
    }
    const label = `cell(${selected.x},${selected.y})`;
    addWatchpoint(label, selected.x, selected.y);
  };

  const currentCell =
    selected && grid[selected.y] && grid[selected.y][selected.x]
      ? grid[selected.y][selected.x]
      : null;

  const neighbors =
    selected && currentCell
      ? getNeighbors(grid, selected.x, selected.y).map((c) => grid[c.y][c.x])
      : [];

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Redstone Sandbox (Phase 3.5)
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Grid-based power simulation with gates, inspector, blueprints,
            zoomable viewport and signal tracing.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          SIM://GRID16
        </span>
      </header>

      {/* Controls */}
      <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              className={`px-2 py-1 rounded-xl border text-[0.7rem] ${
                running
                  ? "border-rose-500/70 text-rose-300"
                  : "border-emerald-500/70 text-emerald-300"
              }`}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? "Pause" : "Run"}
            </button>
            <button
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-sky-500/70"
              onClick={handleStep}
            >
              Step
            </button>
            <button
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-rose-500/70"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2 text-[0.7rem]">
            <span className="text-slate-400">Tick rate</span>
            <input
              type="range"
              min={1}
              max={20}
              value={tickRate}
              onChange={(e) => setTickRate(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono text-slate-100">{tickRate} tps</span>
          </div>

          <div className="flex items-center gap-2 text-[0.7rem] ml-auto">
            <span className="text-slate-400">Zoom</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono text-slate-100">
              {(zoom * 100).toFixed(0)}%
            </span>
          </div>

          <div className="flex items-center gap-4 text-[0.7rem] text-slate-400">
            <span>
              Tick:{" "}
              <span className="font-mono text-slate-100">{tick}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[0.7rem] text-slate-400">
          <span className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-sm border border-slate-600 bg-slate-900" />{" "}
            empty
            <span className="inline-flex h-3 w-3 rounded-sm border border-amber-400 bg-amber-500/20" />{" "}
            source
            <span className="inline-flex h-3 w-3 rounded-sm border border-sky-400 bg-sky-500/10" />{" "}
            wire
            <span className="inline-flex h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-500/20" />{" "}
            gates
            <span className="inline-flex h-3 w-3 rounded-sm border border-fuchsia-400 bg-fuchsia-500/20" />{" "}
            output
          </span>

          <div className="flex items-center gap-2 text-[0.7rem] ml-auto">
            <button
              className="px-2 py-1 rounded-xl border border-emerald-500/70 text-[0.7rem] text-emerald-300 hover:bg-emerald-500/10"
              onClick={handleSaveBlueprint}
            >
              Save blueprint
            </button>
            <select
              value={selectedBlueprint}
              onChange={(e) => setSelectedBlueprint(e.target.value)}
              className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.7rem] text-slate-100"
            >
              <option value="">Load blueprint...</option>
              {blueprints.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-sky-500/70"
              onClick={handleLoadBlueprint}
              disabled={!selectedBlueprint}
            >
              Load
            </button>
          </div>
        </div>

        <div className="text-[0.65rem] text-slate-500">
          Hotkeys: <span className="font-mono">P</span> = play/pause,{" "}
          <span className="font-mono">Space</span> = step,{" "}
          <span className="font-mono">R</span> = reset. Use the Signal Scope app
          to visualize watched signals over time.
        </div>
      </section>

      {/* Grid + Inspector */}
      <section className="flex-1 min-h-0 rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col md:flex-row gap-3">
        <div className="md:w-2/3 flex items-center justify-center min-h-0 overflow-auto">
          <div
            className="inline-flex flex-col bg-slate-950/90 rounded-2xl border border-slate-800/80 p-2 origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            {grid.map((row, y) => (
              <div key={y} className="flex">
                {row.map((cell, x) => {
                  const isSelected =
                    selected && selected.x === x && selected.y === y;

                  let bg = "bg-slate-900";
                  let border = "border-slate-700";
                  let label = "";

                  switch (cell.type) {
                    case "source":
                      bg = cell.powered
                        ? "bg-amber-400"
                        : "bg-amber-500/40";
                      border = "border-amber-300";
                      label = "S";
                      break;
                    case "wire":
                      if (cell.powered) {
                        bg = "bg-sky-400";
                        border = "border-sky-300";
                      } else {
                        bg = "bg-sky-500/10";
                        border = "border-sky-500/60";
                      }
                      label = "";
                      break;
                    case "gate_and":
                      bg = cell.powered
                        ? "bg-emerald-400"
                        : "bg-emerald-500/20";
                      border = "border-emerald-300";
                      label = "∧";
                      break;
                    case "gate_or":
                      bg = cell.powered
                        ? "bg-emerald-400"
                        : "bg-emerald-500/20";
                      border = "border-emerald-300";
                      label = "∨";
                      break;
                    case "gate_not":
                      bg = cell.powered
                        ? "bg-emerald-400"
                        : "bg-emerald-500/20";
                      border = "border-emerald-300";
                      label = "¬";
                      break;
                    case "output":
                      bg = cell.powered
                        ? "bg-fuchsia-400"
                        : "bg-fuchsia-500/20";
                      border = "border-fuchsia-300";
                      label = "O";
                      break;
                    case "empty":
                    default:
                      bg = "bg-slate-900";
                      border = "border-slate-700";
                      label = "";
                      break;
                  }

                  const extra = isSelected
                    ? "ring-2 ring-pink-500/80"
                    : "";

                  return (
                    <button
                      key={x}
                      onClick={() => handleCellClick(x, y)}
                      className={`h-6 w-6 m-[1px] rounded-sm border ${bg} ${border} ${extra} flex items-center justify-center text-[0.65rem] text-slate-900/80`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="md:w-1/3 flex flex-col gap-2">
          <div className="text-[0.7rem] text-slate-400">
            Click a cell to cycle its type and inspect its state. Blueprints are
            stored in the virtual filesystem under{" "}
            <span className="font-mono">/Redstone</span>. Add watchpoints for
            important nodes, then open the Signal Scope app to see timelines.
          </div>

          <div className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-slate-100">
              Cell Inspector
            </h2>
            {currentCell && selected ? (
              <>
                <div className="grid grid-cols-2 gap-1 text-[0.7rem]">
                  <span className="text-slate-400">Position</span>
                  <span className="font-mono text-slate-100">
                    ({selected.x}, {selected.y})
                  </span>
                  <span className="text-slate-400">Type</span>
                  <span className="text-slate-100">
                    {describeCell(currentCell)}
                  </span>
                  <span className="text-slate-400">Powered</span>
                  <span className="font-mono text-slate-100">
                    {currentCell.powered ? "true" : "false"}
                  </span>
                  <span className="text-slate-400">Neighbors</span>
                  <span className="font-mono text-slate-100">
                    {neighbors.length}
                  </span>
                </div>
                <div className="text-[0.7rem] text-slate-400">
                  Neighbor powered count:{" "}
                  <span className="font-mono text-slate-100">
                    {
                      neighbors.filter(
                        (c) => c.powered && c.type !== "empty"
                      ).length
                    }
                  </span>
                </div>
                <div className="mt-2">
                  <button
                    className="px-2 py-1 rounded-xl border border-sky-500/70 text-[0.7rem] text-sky-300 hover:bg-sky-500/10"
                    onClick={handleAddWatch}
                  >
                    Add watch for this cell
                  </button>
                </div>
              </>
            ) : (
              <div className="text-[0.7rem] text-slate-500">
                No cell selected. Click a cell in the grid to inspect it and add
                a watch.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}




















