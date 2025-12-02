import React, { useEffect, useState } from "react";
import {
  WORLD_SIZE,
  SliceCell,
  getSliceGrid,
  subscribeWorld,
  cycleVoxelType,
  setVoxel,
  getVoxel,
  type Orientation,
} from "../world3d/VoxelWorld";

type ComparatorMode = "compare" | "subtract";

interface HoveredCell {
  x: number;
  z: number;
  cell: SliceCell | null;
}

export function WorldMap2DApp() {
  const [level, setLevel] = useState<number>(Math.floor(WORLD_SIZE / 2));
  const [slice, setSlice] = useState<SliceCell[][]>(() =>
    getSliceGrid(Math.floor(WORLD_SIZE / 2))
  );

  const [repeaterDelay, setRepeaterDelay] = useState<number>(1);
  const [repeaterOrientation, setRepeaterOrientation] =
    useState<Orientation>("east");

  const [comparatorMode, setComparatorMode] =
    useState<ComparatorMode>("compare");

  const [showDustLevels, setShowDustLevels] = useState<boolean>(false);
  const [hovered, setHovered] = useState<HoveredCell | null>(null);

  const refreshSlice = (y: number) => {
    setSlice(getSliceGrid(y));
  };

  useEffect(() => {
    const unsub = subscribeWorld(() => refreshSlice(level));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const handleLevelChange = (v: number) => {
    const clamped = Math.max(0, Math.min(WORLD_SIZE - 1, v));
    setLevel(clamped);
    refreshSlice(clamped);
  };

  const handleCellClick = (x: number, z: number) => {
    const row = slice[z];
    const cell = row?.[x];
    const current = cell?.type ?? "air";
    const nextType = cycleVoxelType(current);

    if (nextType === "repeater") {
      setVoxel(x, level, z, "repeater", false, {
        orientation: repeaterOrientation,
        meta: {
          delay: repeaterDelay,
          timer: 0,
          targetPowered: false,
        },
      });
      return;
    }

    if (nextType === "comparator") {
      setVoxel(x, level, z, "comparator", false, {
        orientation: repeaterOrientation,
        meta: {
          mode: comparatorMode,
        },
      });
      return;
    }

    setVoxel(x, level, z, nextType, false);
  };

  const handleCellContextMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    x: number,
    z: number
  ) => {
    e.preventDefault();

    const b = getVoxel(x, level, z);
    if (!b || b.type !== "comparator") return;

    const rawMeta = (b.meta ?? {}) as { mode?: ComparatorMode };
    const currentMode: ComparatorMode =
      rawMeta.mode === "subtract" ? "subtract" : "compare";
    const nextMode: ComparatorMode =
      currentMode === "compare" ? "subtract" : "compare";

    setVoxel(x, level, z, "comparator", b.powered, {
      orientation: b.orientation,
      powerLevel: b.powerLevel,
      meta: {
        ...b.meta,
        mode: nextMode,
      },
    });
  };

  const handleCellHover = (x: number, z: number) => {
    const row = slice[z];
    const cell = row?.[x] ?? null;
    setHovered({ x, z, cell });
  };

  const handleCellLeave = () => {
    setHovered(null);
  };

  const renderCellLabel = (cell: SliceCell) => {
    if (cell.type === "wire" && showDustLevels) {
      return cell.powerLevel > 0 ? cell.powerLevel.toString(10) : "";
    }
    switch (cell.type) {
      case "source":
        return "S";
      case "gate_and":
        return "∧";
      case "gate_or":
        return "∨";
      case "gate_not":
        return "¬";
      case "repeater":
        return "R";
      case "comparator":
        return "C";
      case "torch":
        return "T";
      case "output":
        return "O";
      case "wire":
      case "air":
      default:
        return "";
    }
  };

  const orientationOptions: Orientation[] = [
    "north",
    "south",
    "east",
    "west",
  ];

  const hoveredText = (() => {
    if (!hovered || !hovered.cell) {
      return "Hover over a cell to see what it is.";
    }
    const c = hovered.cell;
    if (c.type === "air") {
      return `Empty @ (${hovered.x},${level},${hovered.z})`;
    }
    const powerText =
      c.type === "wire"
        ? ` · power ${c.powerLevel}`
        : c.powered
        ? " · powered"
        : " · off";
    return `${c.type} @ (${hovered.x},${level},${hovered.z})${powerText}`;
  })();

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Redstone Map (2D Slice)
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            A simple, top-down view of one height level of the 3D world. For
            people who prefer a diagram over a 3D scene.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          WORLD://MAP2D
        </span>
      </header>

      <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[0.7rem]">
            <span className="text-slate-400">Slice Y-level</span>
            <input
              type="range"
              min={0}
              max={WORLD_SIZE - 1}
              value={level}
              onChange={(e) => handleLevelChange(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono text-slate-100">{level}</span>
          </div>

          <span className="ml-auto text-[0.7rem] text-slate-400">
            Shared with{" "}
            <span className="font-mono text-slate-100">3D Redstone World</span>.
            Change it here or there, it is the same circuit.
          </span>
        </div>

        <div className="text-[0.7rem] text-slate-400">
          Click cells to cycle:
          {" "}
          <span className="font-mono">
            air → wire → source → AND → OR → NOT → repeater → comparator →
            torch → output → air
          </span>
          .
        </div>

        {/* Repeater + Comparator controls */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem]">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Repeater delay</span>
            <input
              type="range"
              min={1}
              max={4}
              value={repeaterDelay}
              onChange={(e) => setRepeaterDelay(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono text-slate-100">
              {repeaterDelay} tick{repeaterDelay === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Facing (repeaters & comparators)</span>
            <select
              value={repeaterOrientation}
              onChange={(e) =>
                setRepeaterOrientation(e.target.value as Orientation)
              }
              className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.7rem] text-slate-100"
            >
              {orientationOptions.map((o) => (
                <option key={o} value={o}>
                  {o.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Comparator mode (default)</span>
            <select
              value={comparatorMode}
              onChange={(e) =>
                setComparatorMode(e.target.value as ComparatorMode)
              }
              className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.7rem] text-slate-100"
            >
              <option value="compare">COMPARE</option>
              <option value="subtract">SUBTRACT</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Dust debug</span>
            <button
              className={`px-2 py-1 rounded-xl border text-[0.7rem] ${
                showDustLevels
                  ? "border-sky-500/80 text-sky-300 bg-sky-500/10"
                  : "border-slate-700/80 text-slate-300 hover:border-sky-500/60"
              }`}
              onClick={() => setShowDustLevels((v) => !v)}
            >
              {showDustLevels ? "Numbers" : "Off"}
            </button>
          </div>
        </div>

        <div className="text-[0.7rem] text-slate-500">
          Tip:{" "}
          <span className="font-mono">Right-click</span> a comparator cell
          to toggle its mode between compare/subtract. Turn on dust debug to
          see power levels (0–15) on wires.
        </div>
      </section>

      <section className="flex-1 min-h-0 rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[0.7rem] text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Hover info:</span>
            <span className="text-slate-300">{hoveredText}</span>
          </div>
          <span className="text-slate-500">
            Think of this like graph paper for your circuit.
          </span>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto">
          <div className="inline-flex flex-col bg-slate-950/90 rounded-2xl border border-slate-800/80 p-2">
            {slice.map((row, z) => (
              <div key={z} className="flex">
                {row.map((cell, x) => {
                  let bg = "bg-slate-900";
                  let border = "border-slate-700";
                  let extraStyle: React.CSSProperties | undefined;

                  if (cell.type === "wire") {
                    if (cell.powerLevel > 0) {
                      const intensity = Math.max(
                        0.15,
                        Math.min(1, cell.powerLevel / 15)
                      );
                      bg = "bg-sky-400";
                      border = "border-sky-300";
                      extraStyle = { opacity: 0.3 + 0.7 * intensity };
                    } else {
                      bg = "bg-sky-500/10";
                      border = "border-sky-500/60";
                      extraStyle = { opacity: 0.25 };
                    }
                  } else {
                    switch (cell.type) {
                      case "source":
                        bg = cell.powered
                          ? "bg-amber-400"
                          : "bg-amber-500/40";
                        border = "border-amber-300";
                        break;
                      case "gate_and":
                      case "gate_or":
                      case "gate_not":
                      case "repeater":
                      case "comparator":
                      case "torch":
                        bg = cell.powered
                          ? "bg-emerald-400"
                          : "bg-emerald-500/20";
                        border = "border-emerald-300";
                        break;
                      case "output":
                        bg = cell.powered
                          ? "bg-fuchsia-400"
                          : "bg-fuchsia-500/20";
                        border = "border-fuchsia-300";
                        break;
                      case "air":
                      default:
                        bg = "bg-slate-900";
                        border = "border-slate-700";
                        break;
                    }
                  }

                  const isHovered =
                    hovered &&
                    hovered.x === x &&
                    hovered.z === z &&
                    hovered.cell?.type === cell.type;

                  const outlineClass = isHovered
                    ? "ring-1 ring-sky-400"
                    : "";

                  return (
                    <button
                      key={x}
                      onClick={() => handleCellClick(x, z)}
                      onContextMenu={(e) => handleCellContextMenu(e, x, z)}
                      onMouseEnter={() => handleCellHover(x, z)}
                      onMouseLeave={handleCellLeave}
                      className={`h-6 w-6 m-[1px] rounded-sm border ${bg} ${border} ${outlineClass} flex items-center justify-center text-[0.65rem] text-slate-900/80`}
                      style={extraStyle}
                    >
                      {renderCellLabel(cell)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}








