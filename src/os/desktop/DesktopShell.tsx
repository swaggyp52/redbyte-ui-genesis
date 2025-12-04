import React from "react";

interface DesktopShellProps {
  user: string;
}

const DesktopShell: React.FC<DesktopShellProps> = ({ user }) => {
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* top bar */}
      <header className="h-10 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 backdrop-blur">
        <div className="text-[10px] tracking-[0.28em] uppercase text-slate-400">
          redbyte os
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <span className="opacity-80">{user}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </header>

      {/* desktop field */}
      <main className="flex-1 relative bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.16),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(8,47,73,0.5),transparent_55%)]">
        <div className="absolute inset-0 p-6 flex gap-4">
          {/* left module column */}
          <aside className="w-40 space-y-2 text-xs text-slate-300">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">
              modules
            </div>
            <button className="w-full rounded-lg border border-slate-800/80 bg-slate-900/80 px-3 py-2 text-left hover:border-sky-400/70 hover:bg-slate-900 transition">
              Terminal
            </button>
            <button className="w-full rounded-lg border border-slate-800/80 bg-slate-900/80 px-3 py-2 text-left hover:border-sky-400/70 hover:bg-slate-900 transition">
              Files
            </button>
            <button className="w-full rounded-lg border border-slate-800/80 bg-slate-900/80 px-3 py-2 text-left hover:border-sky-400/70 hover:bg-slate-900 transition">
              Notes
            </button>
          </aside>

          {/* main window */}
          <section className="flex-1 flex flex-col">
            <div className="flex-1 rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-sm shadow-[0_0_80px_rgba(15,23,42,0.9)] overflow-hidden">
              <div className="h-9 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Session console</span>
                </div>
              </div>
              <div className="p-4 text-xs font-mono text-slate-300 space-y-1">
                <div>redbyte shell ready.</div>
                <div>current mode: prototype desktop</div>
                <div>next step: connect services, storage, and real system calls</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default DesktopShell;
