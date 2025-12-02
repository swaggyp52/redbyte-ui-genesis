import React, { useEffect, useRef, useState } from "react";
import { loadGlobalSettings } from "../settings/SettingsStore";

interface BootScreenProps {
  onDone?: () => void;
}

interface BootPhase {
  id: string;
  label: string;
  hint: string;
  duration: number;
}

const PHASES: BootPhase[] = [
  {
    id: "firmware",
    label: "Initializing RedByte firmware",
    hint: "Probing virtual devices, calibrating timers",
    duration: 900,
  },
  {
    id: "kernel",
    label: "Warming up kernel",
    hint: "Spawning event bus, process manager, agent host",
    duration: 1100,
  },
  {
    id: "dust",
    label: "Calibrating dust engine",
    hint: "BFS wavefront solver, attenuation curves, repeater timing",
    duration: 1300,
  },
  {
    id: "voxel",
    label: "Building voxel pipeline",
    hint: "Allocating chunk meshes, wiring 3D/2D sync bridge",
    duration: 1200,
  },
  {
    id: "logic",
    label: "Mounting logic workspace",
    hint: "Loading templates, NL designer, export channels",
    duration: 1100,
  },
  {
    id: "desktop",
    label: "Launching desktop environment",
    hint: "Wiring command palette, explain mode, window manager",
    duration: 1300,
  },
  {
    id: "final",
    label: "Handing off control to user",
    hint: "Finalizing status bar, mission control, file explorer",
    duration: 900,
  },
];

const TOTAL_DURATION = PHASES.reduce((sum, p) => sum + p.duration, 0);

export function BootScreen({ onDone }: BootScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [bootChannel] = useState("GENESIS-39");
  const [skipped, setSkipped] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const doneRef = useRef(false);
  const lastPhaseRef = useRef<number | null>(null);
  const logsRef = useRef<string[]>([]);

  // Respect global boot mode
  useEffect(() => {
    try {
      const global = loadGlobalSettings();
      if (global.bootMode === "instant") {
        doneRef.current = true;
        setProgress(1);
        setPhaseIndex(PHASES.length - 1);
        setEnabled(false);
        setTimeout(() => onDone?.(), 50);
        return;
      }
    } catch {
      // ignore, fall back to cinematic
    }
    setEnabled(true);
  }, [onDone]);

  // Main animation loop (cinematic mode only)
  useEffect(() => {
    if (!enabled || skipped) return;
    const start = performance.now();
    let frame: number;

    const loop = () => {
      if (doneRef.current || skipped) return;
      const now = performance.now();
      const elapsed = now - start;
      const clamped = Math.min(elapsed, TOTAL_DURATION);
      const p = clamped / TOTAL_DURATION;
      setProgress(p);

      let acc = 0;
      let idx = 0;
      for (let i = 0; i < PHASES.length; i++) {
        acc += PHASES[i].duration;
        if (clamped <= acc || i === PHASES.length - 1) {
          idx = i;
          break;
        }
      }
      setPhaseIndex(idx);

      if (lastPhaseRef.current !== idx) {
        lastPhaseRef.current = idx;
        const phase = PHASES[idx];
        const timestamp = new Date().toISOString().split("T")[1]?.slice(0, 8);
        const line = `[${timestamp}] ${phase.label}…`;
        logsRef.current = [...logsRef.current, line];
        setLogs(logsRef.current.slice(-18));
      }

      if (elapsed >= TOTAL_DURATION) {
        if (!doneRef.current) {
          doneRef.current = true;
          setTimeout(() => onDone?.(), 600);
        }
        return;
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [enabled, skipped, onDone]);

  // Skip boot: Enter key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!doneRef.current) {
          doneRef.current = true;
          setSkipped(true);
          setProgress(1);
          setTimeout(() => onDone?.(), 150);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDone]);

  const currentPhase = PHASES[phaseIndex] ?? PHASES[0];
  const percent = Math.round(progress * 100);

  const dustCalibration = Math.round(30 + progress * 70);
  const logicWarmth = Math.round(40 + progress * 60);
  const kernelStable = progress > 0.4 ? "STABLE" : "WARMING";

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 text-slate-100 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/40 via-slate-950 to-sky-900/40 pointer-events-none" />
      <div className="absolute -top-40 -right-40 h-80 w-80 bg-fuchsia-500/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 bg-sky-500/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-soft-light bg-[repeating-linear-gradient(to_bottom,rgba(15,23,42,0.8),rgba(15,23,42,0.8)_2px,rgba(15,23,42,0.6)_2px,rgba(15,23,42,0.6)_4px)]" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-4">
        <div className="rb-glass border border-slate-800/80 rounded-3xl bg-slate-950/80 shadow-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between text-[0.7rem] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full border border-sky-500/70 text-sky-300 text-[0.65rem] font-mono">
                REDBYTE OS // BOOT CHANNEL
              </span>
              <span className="font-mono text-slate-500">
                {bootChannel}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-slate-500">
                KERNEL:
                <span className="ml-1 text-emerald-400">{kernelStable}</span>
              </span>
              <span className="text-slate-500 hidden sm:inline">
                PRESS <span className="text-slate-200">ENTER</span> TO SKIP
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1.1fr] gap-4 items-stretch">
            <div className="flex flex-col justify-center gap-3">
              <div className="flex flex-col items-start gap-2">
                <div className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-fuchsia-400 via-sky-400 to-emerald-400 text-transparent bg-clip-text drop-shadow-lg">
                  RedByte&nbsp;OS
                </div>
                <div className="text-xs md:text-[0.8rem] text-slate-400 max-w-md">
                  Logic-native operating system for circuits, CPUs and worlds.
                  Boot sequence v39 can be cinematic or instant, depending on
                  your global settings.
                </div>
              </div>

              <div className="mt-2 rb-glass border border-slate-800/80 rounded-2xl bg-slate-950/80 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[0.75rem] text-slate-400">
                      CURRENT PHASE
                    </span>
                    <span className="text-sm font-semibold text-slate-100">
                      {currentPhase.label}
                    </span>
                  </div>
                  <div className="text-[0.75rem] text-slate-400 font-mono">
                    {phaseIndex + 1}/{PHASES.length}
                  </div>
                </div>
                <p className="text-[0.7rem] text-slate-400">
                  {currentPhase.hint}
                </p>
              </div>

              <div className="mt-1 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[0.7rem] text-slate-400">
                  <span>System boot progress</span>
                  <span className="font-mono text-slate-200">
                    {percent.toString().padStart(3, " ")}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900/90 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-emerald-400 transition-all duration-100"
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-1 text-[0.7rem] font-mono">
                <div className="rb-glass rounded-xl border border-slate-800/80 bg-slate-950/80 px-2 py-1">
                  <div className="text-slate-500">DUST CAL</div>
                  <div className="text-emerald-400 text-sm">
                    {dustCalibration}%
                  </div>
                </div>
                <div className="rb-glass rounded-xl border border-slate-800/80 bg-slate-950/80 px-2 py-1">
                  <span className="text-slate-500">LOGIC HEAT</span>
                  <div className="text-sky-400 text-sm">
                    {logicWarmth}%
                  </div>
                </div>
                <div className="rb-glass rounded-xl border border-slate-800/80 bg-slate-950/80 px-2 py-1">
                  <div className="text-slate-500">BOOT TIER</div>
                  <div className="text-fuchsia-300 text-sm">
                    {enabled ? "CINEMATIC" : "INSTANT"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/85 p-3 flex flex-col min-h-[10rem]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                  <span className="text-[0.75rem] text-slate-300 font-semibold">
                    Boot diagnostics
                  </span>
                </div>
                <span className="text-[0.65rem] text-slate-500 font-mono">
                  LOG://BOOTD-39
                </span>
              </div>
              <div className="flex-1 min-h-[8rem] max-h-56 overflow-hidden rounded-xl bg-slate-950/95 border border-slate-900/90">
                <div className="h-full w-full overflow-y-auto px-3 py-2 text-[0.7rem] font-mono text-slate-300 space-y-0.5">
                  {logs.length === 0 && enabled && (
                    <div className="text-slate-500">
                      Awaiting first phase…
                    </div>
                  )}
                  {logs.map((line, idx) => (
                    <div key={idx} className="whitespace-pre">
                      {line}
                    </div>
                  ))}
                  <div className="text-slate-500 flex items-center gap-1">
                    <span className="text-emerald-400">›</span>
                    <span>Preparing desktop, apps and AI systems…</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[0.65rem] text-slate-500">
                <span>
                  Tip: press <span className="text-slate-200">Enter</span> to skip boot.
                </span>
                <button
                  onClick={() => {
                    if (!doneRef.current) {
                      doneRef.current = true;
                      setSkipped(true);
                      setProgress(1);
                      setTimeout(() => onDone?.(), 150);
                    }
                  }}
                  className="px-2 py-0.5 rounded-lg border border-slate-600/80 hover:bg-slate-800/80 text-slate-200"
                >
                  Skip boot
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[0.65rem] text-slate-500 pt-1 border-t border-slate-900/80">
            <span className="font-mono">
              REDBYTE-OS v39 • SIM/LOGIC/3D READY
            </span>
            <span className="font-mono">
              NEXT: LOGIN • DESKTOP • PALETTE • LAB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BootScreen;
