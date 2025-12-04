import React, { useEffect, useRef, useState } from "react";
import UniverseOrb from "./UniverseOrb";

const BOOT_DURATION_MS = 15000;

const BOOT_TIPS: string[] = [
  "Loading core system",
  "Starting services",
  "Preparing interface",
  "Checking session state",
  "Aligning display",
  "Final checks in progress"
];

interface BootScreenProps {
  onComplete?: () => void;
}

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    let frameId: number;

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;
      const pct = Math.min(1, elapsed / BOOT_DURATION_MS);
      setProgress(pct);

      if (pct < 1) {
        frameId = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        if (onComplete) {
          // small delay to let the bar reach 100 visually
          setTimeout(() => onComplete(), 400);
        }
      }
    };

    frameId = requestAnimationFrame(tick);

    const tipTimer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % BOOT_TIPS.length);
    }, 2500);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearInterval(tipTimer);
    };
  }, [onComplete]);

  const percent = Math.round(progress * 100);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center overflow-hidden">
      {/* background glow */}
      <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(59,130,246,0.3),transparent_55%)] opacity-70 blur-3xl" />

      {/* center orb */}
      <div className="relative w-full max-w-xl h-80 flex items-center justify-center z-10">
        <div className="animate-[spin_40s_linear_infinite]">
          <UniverseOrb progress={progress} />
        </div>
      </div>

      {/* progress bar */}
      <div className="relative z-10 mt-6 w-full max-w-xl px-8">
        <div className="h-2 rounded-full bg-slate-800/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-all duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-[0.22em]">
          <span>booting redbyte os</span>
          <span>{percent}%</span>
        </div>
      </div>

      {/* rotating tips */}
      <div className="relative z-10 mt-6 px-8 max-w-xl text-center">
        <div className="inline-flex items-center justify-center gap-2 text-sm text-slate-300/90">
          <span className="h-[6px] w-[6px] rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-100/90">
            {BOOT_TIPS[tipIndex]}
          </span>
        </div>
      </div>

      {/* footer brand */}
      <div className="relative z-10 mt-10 text-[9px] tracking-[0.35em] uppercase text-slate-500/70">
        redbyte os
      </div>
    </div>
  );
};

export default BootScreen;
