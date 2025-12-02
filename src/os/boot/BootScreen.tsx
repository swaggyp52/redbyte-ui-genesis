import React, { useEffect, useRef, useState } from "react";
import UniverseOrb from "./UniverseOrb";

export type BootScreenProps = {
  onDone?: () => void;
  /** Optional override; defaults to 15 seconds */
  durationMs?: number;
};

const DEFAULT_DURATION = 15000;

const STEPS = [
  "Waking the core",
  "Linking RedByte subsystems",
  "Preparing your workspace",
  "Syncing RedByte identity",
];

const TIPS = [
  "Tip: Start small. One idea, one sketch, one circuit. Ship it, then expand.",
  "Tip: Let the machine handle the noise. Save your attention for the hard parts.",
  "Tip: Silence isn’t empty. It’s the space where your next move appears.",
  "Tip: RedByte grows when you do. The system is here to keep up, not slow you down.",
];

function BootScreen({ onDone, durationMs = DEFAULT_DURATION }: BootScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const doneRef = useRef(false);

  // Time-based progress: 0 -> 1 across durationMs
  useEffect(() => {
    const total = durationMs;
    const start = performance.now();
    let frameId = 0;

    const loop = () => {
      const now = performance.now();
      const elapsed = now - start;
      const p = Math.min(1, elapsed / total);

      setProgress(p);
      const idx = Math.min(
        STEPS.length - 1,
        Math.floor(p * STEPS.length)
      );
      setStepIndex(idx);

      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        onDone?.();
        return;
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [durationMs, onDone]);

  // Allow Enter to skip as soon as the screen is visible
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !doneRef.current) {
        doneRef.current = true;
        setProgress(1);
        onDone?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDone]);

  const percent = Math.round(progress * 100);
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const step = STEPS[stepIndex] ?? STEPS[STEPS.length - 1];
  const tipIndex = Math.min(
    TIPS.length - 1,
    Math.floor(progress * TIPS.length)
  );
  const tip = TIPS[tipIndex];

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 flex flex-col">
      {/* Top: Void core */}
      <div className="flex-1 flex items-center justify-center px-4 pt-6 pb-2 overflow-hidden">
        <div className="w-full max-w-5xl aspect-[21/9]">
          <UniverseOrb progress={progress} />
        </div>
      </div>

      {/* Bottom: Status + progress */}
      <div className="border-t border-slate-800/80 bg-slate-950/95 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
            RedByte OS • System boot • Deep void core
          </div>
          <div className="text-sm text-slate-200">
            {step}
          </div>
          <div className="text-xs text-slate-400 max-w-xl">
            {tip}
          </div>
          <div className="text-[0.7rem] text-slate-500 mt-1">
            Press <span className="text-slate-200">Enter</span> to skip.
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 mt-2 sm:mt-0">
          <div className="h-1.5 w-48 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all"
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          <div className="text-[0.7rem] text-slate-400 font-mono">
            Step {stepIndex + 1} / {STEPS.length} •{" "}
            {clampedPercent.toString().padStart(3, " ")}%
          </div>
        </div>
      </div>
    </div>
  );
}

// Keep both default + named exports so older imports still work
export { BootScreen };
export default BootScreen;






















