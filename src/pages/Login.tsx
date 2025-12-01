import React from "react";
import { useNavigate } from "react-router-dom";
import { Power } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate("/desktop");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-red-900 flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-3xl border border-red-500/50 bg-black/70 backdrop-blur-xl p-8 shadow-[0_0_70px_rgba(248,113,113,0.5)]">
        <p className="text-[10px] tracking-[0.35em] uppercase text-red-300 mb-3">
          RedByte Labs
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mb-2">
          RedByte OS • Genesis
        </h1>
        <p className="text-sm text-gray-300 mb-6">
          This is your experimental shell. No accounts, no friction — just a
          direct boot into your design system desktop.
        </p>

        <div className="flex flex-col gap-3 mb-8 text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.2em] text-gray-500">
              Build
            </span>
            <span className="text-gray-200">v4.0 • Genesis</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.2em] text-gray-500">
              Mode
            </span>
            <span className="text-gray-200">Demo / Showcase</span>
          </div>
        </div>

        <button
          onClick={handleEnter}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 hover:bg-red-400 text-white py-3.5 text-sm font-semibold tracking-wide shadow-[0_0_35px_rgba(248,113,113,0.7)] transition"
        >
          <Power className="w-4 h-4" />
          Enter RedByte OS
        </button>

        <p className="mt-4 text-[11px] text-gray-500 text-center">
          Tip: send your friends{" "}
          <span className="text-red-300">redbytelabs.com</span> — it boots
          straight into this.
        </p>
      </div>
    </div>
  );
}

