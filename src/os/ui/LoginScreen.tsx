import React, { useState } from "react";

interface LoginScreenProps {
  onEnter: (handle: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onEnter }) => {
  const [handle, setHandle] = useState("operator");

  const tryEnter = () => {
    if (!onEnter) return;
    onEnter(handle.trim() || "operator");
  };

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <div className="w-[360px] bg-slate-950/90 border border-slate-800 rounded-xl shadow-xl p-6 text-slate-200">
        <div className="text-xs tracking-[0.3em] text-red-300 mb-2 uppercase">
          redbyte os
        </div>
        <div className="text-lg font-semibold mb-1">Local development workspace</div>
        <div className="text-[11px] text-slate-400 mb-4">
          Focused workspace for building systems, circuits and tools.
          Nothing leaves this browser.
        </div>

        <label className="text-[11px] text-slate-300 mb-1 block">Handle</label>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[12px] mb-3"
        />

        <button
          onClick={tryEnter}
          className="w-full bg-red-600 hover:bg-red-500 text-white rounded px-3 py-2 text-[12px] transition-colors"
        >
          Enter workspace
        </button>

        <div className="text-[10px] text-slate-500 mt-3">
          local build • dev-only • key stored only in this browser
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
