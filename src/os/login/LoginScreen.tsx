import React, { useState } from "react";

interface LoginScreenProps {
  onSuccess?: (user: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = user.trim() || "operator";
    setStatus("Session opened for " + handle + ".");
    if (onSuccess) {
      onSuccess(handle);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex items-center justify-center overflow-hidden">
      {/* background field */}
      <div className="absolute -inset-40 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(8,47,73,0.45),transparent_55%)] opacity-70 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-8">
        <div className="mb-8">
          <div className="text-[11px] tracking-[0.35em] uppercase text-slate-400 mb-2">
            redbyte os
          </div>
          <h1 className="text-3xl font-semibold text-slate-50">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Local client session. Credentials stay on this machine.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 uppercase tracking-[0.18em]">
              handle
            </label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700/70 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:border-sky-400/80"
              placeholder="operator"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 uppercase tracking-[0.18em]">
              key
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700/70 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:border-sky-400/80"
              placeholder="secure key"
            />
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-medium text-sm py-2.5 shadow-lg shadow-sky-500/25 hover:brightness-110 transition"
          >
            Enter session
          </button>
        </form>

        {status && (
          <div className="mt-4 text-xs text-emerald-300/90 bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2">
            {status}
          </div>
        )}

        <div className="mt-6 text-[10px] text-slate-500 tracking-[0.25em] uppercase">
          local build • pre alpha
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
