import React, { useEffect, useRef, useState } from "react";
import UniverseOrb from "./UniverseOrb";

type BootScreenProps = {
  onDone?: () => void;
};

type BootStep = {
  label: string;
  duration: number;
};

const STEPS: BootStep[] = [
  { label: "Linking RedByte core to local machine…", duration: 2600 },
  { label: "Preparing workspace, logic grid and simulation layers…", duration: 2600 },
  { label: "Warming up analysis, render and monitoring nodes…", duration: 2600 },
  { label: "Securing session and loading your environment…", duration: 2600 },
];

const TOTAL = STEPS.reduce((acc, s) => acc + s.duration, 0);

const TIPS: string[] = [
  "Tip: RedByte is designed to feel like an OS, not a website.",
  "Tip: You can expand this into a full physical simulation lab.",
  "Tip: The goal is clarity — complex systems, simple views.",
  "Tip: Eventually this will control real-world structures.",
  "Tip: Every session can become a blueprint, not just a file.",
];

const BootScreen: React.FC<BootScreenProps> = ({ onDone }) => {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [localDone, setLocalDone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    // pick a stable random tip for this boot
    setTipIndex(Math.floor(Math.random() * TIPS.length));
  }, []);

  useEffect(() => {
    const start = performance.now();
    let frame: number;

    const loop = () => {
      if (doneRef.current) return;

      const now = performance.now();
      const elapsed = now - start;
      const clamped = Math.min(elapsed, TOTAL);
      const p = clamped / TOTAL;

      setProgress(p);

      // Determine current step
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
          setProgress(1);
          setLocalDone(true);
          onDone?.();
        }
        return;
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !doneRef.current) {
        e.preventDefault();
        doneRef.current = true;
        setProgress(1);
        setLocalDone(true);
        onDone?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDone]);

  if (localDone) {
    return null;
  }

  const step = STEPS[stepIndex] ?? STEPS[STEPS.length - 1];
  const percent = Math.round(progress * 100);

  return (
    <div className="absolute inset-0 z-[900] bg-slate-950 text-slate-100 flex items-center justify-center overflow-hidden">
      {/* Deep void background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.09),_transparent_60%)] opacity-80 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-slate-950/90 to-black/95" />

      <div className="relative z-10 w-full max-w-5xl h-[80vh] px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[1.8fr_1.1fr] gap-6 items-stretch">
        {/* Orb side */}
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 shadow-[0_0_80px_rgba(15,23,42,0.9)] overflow-hidden">
          <UniverseOrb />
        </div>

        {/* Status side */}
        <div className="flex flex-col rounded-3xl border border-slate-800/80 bg-slate-950/85 backdrop-blur-xl p-4 sm:p-5 gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                RedByte OS
              </div>
              <div className="text-base sm:text-lg font-semibold text-slate-100 mt-1">
                Session starting
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end text-[0.65rem] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CORE
              </span>
              <span className="flex items-center gap-1 mt-1">
                <span className="h-1 w-1 rounded-full bg-sky-400/70" />
                VOID LINK
              </span>
            </div>
          </div>

          <div className="text-sm text-slate-300">{step.label}</div>

          {/* Progress bar */}
          <div className="mt-1">
            <div className="h-2 w-full rounded-full bg-slate-900/90 border border-slate-800/90 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[0.7rem] text-slate-500 font-mono">
              <span>
                step {stepIndex + 1}/{STEPS.length}
              </span>
              <span>{percent.toString().padStart(3, " ")}%</span>
            </div>
          </div>

          {/* Tip */}
          <div className="mt-2 text-[0.75rem] text-slate-400 border-t border-slate-800/80 pt-3">
            <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-1">
              redbyte hint
            </div>
            <p>{TIPS[tipIndex]}</p>
          </div>

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between text-[0.7rem] text-slate-500">
            <span className="font-mono">
              Press <span className="text-slate-200">Enter</span> to skip boot
            </span>
            <span className="hidden sm:inline">
              This sequence can be shortened or disabled in future builds.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BootScreen;
