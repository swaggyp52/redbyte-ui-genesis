import React, { useEffect, useRef, useState } from "react";
import { loadGlobalSettings } from "../settings/SettingsStore";

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

export function BootScreen({ onDone }: BootScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [enabled, setEnabled] = useState(false);

  const doneRef = useRef(false);

  useEffect(() => {
    // Respect global boot mode (cinematic vs instant), but no flashy labels
    try {
      const global = loadGlobalSettings();
      if (global.bootMode === "instant") {
        doneRef.current = true;
        setProgress(1);
        setStepIndex(STEPS.length - 1);
        setEnabled(false);
        setTimeout(() => onDone?.(), 40);
        return;
      }
    } catch {
      // ignore
    }
    setEnabled(true);
  }, [onDone]);

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
          setTimeout(() => onDone?.(), 400);
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
          setProgress(1);
          setTimeout(() => onDone?.(), 120);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDone]);

  const step = STEPS[stepIndex] ?? STEPS[0];
  const percent = Math.round(progress * 100);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 text-slate-100 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.08),_transparent_55%)]" />
      <div className="relative z-10 w-full max-w-xl px-4">
        <div className="rb-glass rounded-3xl border border-slate-800/80 bg-slate-950/90 px-5 py-6 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-mono">
                REDBYTE OS
              </span>
              <span className="text-2xl font-semibold text-slate-100">
                Starting up
              </span>
            </div>
            <div className="text-[0.7rem] text-slate-500 font-mono text-right">
              <div>Build: dev</div>
              <div>Press Enter to skip</div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <div className="text-[0.8rem] text-slate-300">
              {step.label}
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900/90 border border-slate-800/80 overflow-hidden">
              <div
                className="h-full bg-slate-100/90 transition-all duration-120"
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[0.7rem] text-slate-500 font-mono">
              <span>Step {stepIndex + 1} of {STEPS.length}</span>
              <span>{percent.toString().padStart(3, " ")}%</span>
            </div>
          </div>

          <div className="mt-2 text-[0.7rem] text-slate-500 border-t border-slate-900/80 pt-2">
            RedByte OS is initializing its core services and desktop
            environment. This screen can be made shorter or entirely skipped
            in production builds.
          </div>
        </div>
      </div>
    </div>
  );
}

export default BootScreen;
