import React, { useState } from "react";

interface LoginProps {
  onSuccess: (user: string) => void;
}

const LoginScreen: React.FC<LoginProps> = ({ onSuccess }) => {
  const [user, setUser] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Placeholder auth logic – you can wire real auth later.
    if (!user.trim()) {
      setError("enter an id to continue");
      return;
    }

    setError(null);
    onSuccess(user.trim());
  };

  return (
    <div className="h-screen w-screen bg-[#02010a] text-slate-50 flex items-center justify-center overflow-hidden relative">
      {/* background wash */}
      <div className="absolute inset-0 pointer-events-none opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(248,113,113,0.35),transparent_55%),radial-gradient(circle_at_100%_0%,rgba(239,68,68,0.25),transparent_55%)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6">
        <header className="mb-6">
          <div className="text-[10px] tracking-[0.28em] uppercase text-red-300/80 mb-2">
            redbyte os
          </div>
          <h1 className="text-2xl font-semibold text-slate-50">
            Sign in
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Local dev session. No network sign-in yet.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-slate-300 mb-1 uppercase tracking-[0.22em]">
              id
            </label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500/90 focus:border-red-500/90"
              placeholder="e.g. 1642 or your handle"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-300 mb-1 uppercase tracking-[0.22em]">
              key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full rounded-xl bg-black/50 border border-slate-700/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500/90 focus:border-red-500/90"
              placeholder="local-only for now"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-orange-400 text-slate-950 font-medium text-sm py-2.5 shadow-lg shadow-red-500/30 hover:brightness-110 transition"
          >
            Enter desktop
          </button>
        </form>

        {error && (
          <div className="mt-3 text-[11px] text-rose-300/90 bg-rose-900/30 border border-rose-500/40 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="mt-6 text-[10px] text-slate-500 tracking-[0.25em] uppercase">
          build: local • pre-alpha
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
