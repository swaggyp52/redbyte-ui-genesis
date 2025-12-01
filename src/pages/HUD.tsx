import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getSystemStats } from "../state/System";

type Stats = {
  cpu: number;
  ram: number;
  temp: number;
};

export default function HUD() {
  const [stats, setStats] = useState<Stats>(getSystemStats());

  useEffect(() => {
    const id = setInterval(() => {
      setStats(getSystemStats());
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl rounded-3xl border border-red-500/40 bg-gradient-to-br from-red-500/20 via-black to-black/90 p-6 md:p-8 shadow-[0_0_60px_rgba(255,0,80,0.6)]"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-4 text-center">
          RedByte OS • Live HUD
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-center mb-6 neon-text">
          Telemetry Link Established
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <HudStat label="CPU Load" value={`${stats.cpu}%`} tone="red" />
          <HudStat label="RAM Usage" value={`${stats.ram}%`} tone="yellow" />
          <HudStat label="Core Temp" value={`${stats.temp}°C`} tone="emerald" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-gray-300">
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-1">
              Session
            </p>
            <p>HUD linked to RedByte OS v7 desktop shell.</p>
            <p className="text-gray-400 mt-1">
              Navigate to <span className="text-red-400">/desktop</span> to
              explore spaces, files, and apps.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-1">
              Live Feed
            </p>
            <p>
              Stats auto-refresh every few seconds to simulate an active
              telemetry stream.
            </p>
            <p className="text-gray-400 mt-1">
              This is a visual demo layer — safe to share with anyone.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

type HudStatProps = {
  label: string;
  value: string;
  tone: "red" | "yellow" | "emerald";
};

function HudStat({ label, value, tone }: HudStatProps) {
  const colorMap: Record<HudStatProps["tone"], string> = {
    red: "from-red-500 to-pink-500",
    yellow: "from-yellow-400 to-amber-500",
    emerald: "from-emerald-400 to-cyan-400",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-2">
        {label}
      </p>
      <p className="text-2xl md:text-3xl font-semibold mb-2">{value}</p>
      <div
        className={`h-1.5 rounded-full bg-gradient-to-r ${colorMap[tone]} shadow-[0_0_20px_rgba(255,255,255,0.4)]`}
      />
    </div>
  );
}
