import React from "react";

interface UniverseOrbProps {
  progress?: number;
}

/**
 * UniverseOrb
 * Pure React plus Tailwind orb, no shaders.
 */
const UniverseOrb: React.FC<UniverseOrbProps> = ({ progress = 0 }) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const percent = Math.round(clamped * 100);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-64 h-64 rounded-full overflow-hidden">
        {/* core gradient */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-sky-100 via-sky-500 to-slate-950" />
        {/* horizon band */}
        <div className="absolute inset-x-[-24%] top-1/2 h-28 rounded-full bg-gradient-to-r from-slate-950/95 via-slate-900/80 to-slate-950/95 blur-sm" />
        {/* inner glow pattern */}
        <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle_at_18%_18%,rgba(248,250,252,0.9),transparent_55%),radial-gradient(circle_at_80%_25%,rgba(56,189,248,0.45),transparent_55%),radial-gradient(circle_at_20%_80%,rgba(15,23,42,0.9),transparent_60%)] opacity-90 animate-pulse" />
        {/* rim light */}
        <div className="absolute inset-0 rounded-full ring-2 ring-sky-300/40 shadow-[0_0_80px_rgba(56,189,248,0.55)]" />
      </div>

      {/* small status line in the orb zone */}
      <div className="absolute bottom-4 text-[10px] tracking-[0.25em] text-slate-300/80 uppercase select-none">
        sync {percent} percent
      </div>
    </div>
  );
};

export default UniverseOrb;
