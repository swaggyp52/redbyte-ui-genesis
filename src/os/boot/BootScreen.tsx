import React, { useEffect, useRef, useState } from "react";
import { loadGlobalSettings } from "../settings/SettingsStore";
import { UniverseOrb } from "./UniverseOrb";

interface BootScreenProps {
  onDone?: () => void;
}

interface BootStep {
  id: string;
  label: string;
  duration: number;
}

const STEPS: BootStep[] = [
  { id: "init", label: "Initializing system…", duration: 700 },
  { id: "kernel", label: "Starting kernel services…", duration: 800 },
  { id: "services", label: "Launching core services…", duration: 900 },
  { id: "ui", label: "Preparing desktop environment…", duration: 900 },
];

const TOTAL = STEPS.reduce((sum, s) => sum + s.duration, 0);

/**
 * BootScreen
 *
 * Stage 1: Universe orb (interactive 3D scene).
 *   - The orb is the main visual.
 *   - A small status card shows real boot progress.
 *   - User can rotate/zoom the orb while it loads.
 *
 * Stage 2: When progress completes or user clicks "Continue",
 *   we mark boot as finished and unmount this component.
 *   Desktop + login then take over.
 */
export function BootScreen({ onDone }: BootScreenProps) {
  const [stage, setStage] = useState<"universe" | "done">("universe");
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [enabled, setEnabled] = useState(false);

  const doneRef = useRef(false);

  // Respect global boot mode (cinematic vs instant)
  useEffect(() => {
    try {
      const global = loadGlobalSettings();
      if (global.bootMode === "instant") {
        doneRef.current = true;
        setStage("done");
        setProgress(1);
        setStepIndex(STEPS.length - 1);
        onDone?.();
        return;
      }
    } catch {
      // ignore
    }
    setEnabled(true);
  }, [onDone]);

  // Progress loop
  useEffect(() => {
    if (!enabled || doneRef.current) return;

    const start = performance.now();
    let frame: number;

    const loop = () => {
      if (doneRef.current) return;
      const now = performance.now();
      const elapsed = now - start;
      const clamped = Math.min(elapsed, TOTAL);
      const p = clamped / TOTAL;
      setProgress(p);

      let acc = 0;
      let idx = 0;
      for (let i = 0; i < STEPS.length; i++) {
        acc += STEPS[i].duration;
        if (clamped <= acc || i === STEPS.length - 1) {
          idx = i;
          break;
        }
      }
      setStepIndex(idx);

      if (elapsed >= TOTAL) {
        if (!doneRef.current) {
          doneRef.current = true;
          setStage("done");
          setProgress(1);
          setTimeout(() => {
            onDone?.();
          }, 250);
        }
        return;
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [enabled, onDone]);

  // Skip boot with Enter key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!doneRef.current) {
          doneRef.current = true;
          setStage("done");
          setProgress(1);
          setTimeout(() => onDone?.(), 150);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDone]);

  // When stage is done, unmount this screen completely
  if (stage === "done") {
    return null;
  }

  const step = STEPS[stepIndex] ?? STEPS[0];
  const percent = Math.round(progress * 100);

  const canContinue = percent >= 60;

  return (
    <div className="absolute inset-0 z-[900] bg-slate-950 text-slate-100 overflow-hidden flex items-center justify-center">
      {/* Soft background gradients */}
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.12),_transparent_60%)]" />

      <div className="relative z-10 w-full max-w-6xl h-[80vh] px-4 flex flex-col gap-4">
        {/* Top bar: brand + hint */}
        <div className="flex items-center justify-between text-[0.8rem] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            <span className="font-semibold text-slate-100">RedByte OS</span>
            <span className="text-slate-500 hidden sm:inline">
              System startup
            </span>
          </div>
          <div className="font-mono text-[0.7rem] text-slate-500">
            Press <span className="text-slate-200">Enter</span> to skip
          </div>
        </div>

        {/* Main layout: 3D orb + subtle status card */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.8fr_1.1fr] gap-4 items-stretch">
          <div className="relative flex items-center justify-center">
            <UniverseOrb className="w-full h-full rounded-3xl overflow-hidden bg-slate-950/95 border border-slate-800/80 shadow-[0_0_80px_rgba(15,23,42,0.9)]" />
          </div>

          <div className="flex flex-col gap-3">
            <div className="rb-glass rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 flex flex-col gap-3 h-full">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  System status
                </div>
                <p className="text-[0.75rem] text-slate-400 mt-1">
                  RedByte OS is starting services in the background while you
                  interact with the orb. You can continue once the core stack
                  is ready.
                </p>
              </div>

              <div className="mt-1 flex flex-col gap-2">
                <div className="text-[0.8rem] text-slate-300">
                  {step.label}
                </div>
                <div className="h-2 w-full rounded-full bg-slate-900/90 border border-slate-800/80 overflow-hidden">
                  <div
                    className="h-full bg-slate-100/90 transition-all duration-150"
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[0.7rem] text-slate-500 font-mono">
                  <span>
                    Step {stepIndex + 1} of {STEPS.length}
                  </span>
                  <span>{percent.toString().padStart(3, " ")}%</span>
                </div>
              </div>

              <div className="mt-3 text-[0.75rem] text-slate-400 flex-1">
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80" />
                    <span>Kernel services</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                    <span>Desktop environment</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400/80" />
                    <span>Logic and simulation subsystems</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between text-[0.75rem]">
                <span className="text-slate-500">
                  This screen can be shortened or skipped in production builds.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!doneRef.current && canContinue) {
                      doneRef.current = true;
                      setStage("done");
                      setProgress(1);
                      setTimeout(() => onDone?.(), 150);
                    }
                  }}
                  disabled={!canContinue}
                  className={`px-3 py-1.5 rounded-full border text-[0.75rem] ${
                    canContinue
                      ? "border-sky-500/80 text-sky-100 hover:bg-sky-500/10"
                      : "border-slate-700/80 text-slate-400 opacity-60 cursor-not-allowed"
                  }`}
                >
                  {canContinue ? "Continue to login" : "Preparing…"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle footer */}
        <div className="flex items-center justify-between text-[0.7rem] text-slate-500">
          <span className="font-mono">
            RedByte OS • Interactive boot scene
          </span>
          <span className="hidden sm:inline">
            This is a development build. In a full install, persistent storage
            and hardware checks would run here.
          </span>
        </div>
      </div>
    </div>
  );
}

export default BootScreen;
