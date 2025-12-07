import React, { useState } from "react";
import { Button, Input } from "@rb/primitives";

interface LoginScreenProps {
  onLogin: (handle: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [handle, setHandle] = useState("operator");

  const tryEnter = () => {
    if (!onLogin) return;
    onLogin(handle.trim() || "operator");
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
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") tryEnter();
          }}
          className="mb-3 text-[12px]"
        />

        <Button onClick={tryEnter} className="w-full justify-center text-[12px]">
          Enter workspace
        </Button>

        <div className="text-[10px] text-slate-500 mt-3">
          Projects stay local to this browser and auto-save as you work.
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
