import React from "react";

interface UniverseOrbProps {
  progress?: number;
}

const clamp = (v: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, v));

const UniverseOrb: React.FC<UniverseOrbProps> = ({ progress = 0 }) => {
  const pct = Math.round(clamp(progress) * 100);

  return (
    <div className="relative w-56 h-56 sm:w-64 sm:h-64">
      {/* main orb */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-black via-[#1f0b10] to-black overflow-hidden">
        {/* inner red plasma */}
        <div className="absolute inset-4 rounded-full bg-[radial-gradient(circle_at_30%_20%,#f97373,transparent_55%),radial-gradient(circle_at_70%_80%,#fb923c,transparent_55%),radial-gradient(circle_at_50%_50%,#450a0a,transparent_60%)] opacity-90" />

        {/* circuit rings */}
        <div className="absolute inset-3 rounded-full border border-red-500/40" />
        <div className="absolute inset-6 rounded-full border border-red-500/30" />
        <div className="absolute inset-9 rounded-full border border-red-500/20" />

        {/* crosshair / wiring */}
        <div className="absolute inset-[22%] border border-red-500/25 rounded-full" />
        <div className="absolute inset-[36%] border border-red-500/20 rounded-[40%]" />
        <div className="absolute left-1/2 top-3 bottom-3 w-px bg-gradient-to-b from-red-500/20 via-red-400/60 to-red-500/20" />
        <div className="absolute top-1/2 left-3 right-3 h-px bg-gradient-to-r from-red-500/20 via-red-400/60 to-red-500/20" />

        {/* faint noise mask */}
        <div className="absolute inset-0 rounded-full mix-blend-screen opacity-50 bg-[radial-gradient(circle_at_10%_0%,rgba(248,250,252,0.45),transparent_50%),radial-gradient(circle_at_90%_100%,rgba(254,242,242,0.45),transparent_50%)]" />
      </div>

      {/* glow */}
      <div className="absolute inset-0 blur-3xl bg-[radial-gradient(circle_at_50%_0%,rgba(248,113,113,0.45),transparent_55%),radial-gradient(circle_at_40%_100%,rgba(248,113,113,0.25),transparent_55%)] opacity-80" />

      {/* label */}
      <div className="absolute -bottom-6 w-full flex flex-col items-center text-[10px] tracking-[0.25em] uppercase text-red-200/80">
        <span>redbyte core</span>
        <span className="mt-1 text-[9px] text-red-300/80">
          sync {pct}%
        </span>
      </div>
    </div>
  );
};

export default UniverseOrb;
