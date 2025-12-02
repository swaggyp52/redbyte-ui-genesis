import React, { useMemo } from "react";
import { useKernel } from "../kernel/KernelProvider";
import { useSystem } from "../os/core/SystemProvider";

export function SystemMonitorApp() {
  const { processes } = useKernel();
  const { closeWindow } = useSystem();

  const sorted = useMemo(
    () =>
      processes.slice().sort((a, b) => {
        if (a.status === b.status) {
          return b.cpu - a.cpu;
        }
        // running first, then suspended, then stopped
        const order = { running: 0, suspended: 1, stopped: 2 } as const;
        return order[a.status] - order[b.status];
      }),
    [processes]
  );

  const totalCpu = sorted.reduce((acc, p) => acc + p.cpu, 0);
  const totalMem = sorted.reduce((acc, p) => acc + p.memory, 0);

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            System Monitor
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Live view of RedByte processes. Simulated metrics for now.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          PROC://MONITOR
        </span>
      </header>

      <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <h2 className="text-xs font-semibold text-slate-100">Overview</h2>
        <div className="grid grid-cols-3 gap-2 text-[0.7rem]">
          <div className="flex flex-col">
            <span className="text-slate-400">Processes</span>
            <span className="font-mono text-slate-100">
              {sorted.length}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">CPU (sim)</span>
            <span className="font-mono text-slate-100">
              {totalCpu.toFixed(0)}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Memory (sim)</span>
            <span className="font-mono text-slate-100">
              {totalMem.toFixed(0)} MB
            </span>
          </div>
        </div>
      </section>

      <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex-1 min-h-0 flex flex-col gap-2">
        <h2 className="text-xs font-semibold text-slate-100">
          Processes
        </h2>
        <div className="text-[0.7rem] text-slate-400 mb-1">
          Window processes are mapped to RedByte windows. Killing a process
          will close its associated window.
        </div>

        <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-slate-950/80 border border-slate-800/80">
          <table className="w-full text-[0.7rem]">
            <thead className="bg-slate-900/80 sticky top-0">
              <tr className="text-slate-400 text-left">
                <th className="px-2 py-1 font-normal">PID</th>
                <th className="px-2 py-1 font-normal">Label</th>
                <th className="px-2 py-1 font-normal">Type</th>
                <th className="px-2 py-1 font-normal">Status</th>
                <th className="px-2 py-1 font-normal text-right">CPU</th>
                <th className="px-2 py-1 font-normal text-right">Mem</th>
                <th className="px-2 py-1 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-2 py-2 text-center text-slate-500"
                  >
                    No processes tracked yet.
                  </td>
                </tr>
              ) : (
                sorted.map((p) => (
                  <tr key={p.pid} className="border-t border-slate-900/80">
                    <td className="px-2 py-1 font-mono text-slate-300">
                      {p.pid}
                    </td>
                    <td className="px-2 py-1 text-slate-100 truncate max-w-[8rem]">
                      {p.label}
                    </td>
                    <td className="px-2 py-1 text-slate-400">
                      {p.type}
                    </td>
                    <td className="px-2 py-1 text-slate-400">
                      {p.status}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <span className="font-mono text-slate-200">
                        {p.cpu.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <span className="font-mono text-slate-200">
                        {p.memory.toFixed(0)} MB
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      {p.windowId ? (
                        <button
                          className="px-2 py-0.5 rounded-full border border-rose-500/70 text-rose-300 hover:bg-rose-500/10"
                          onClick={() => closeWindow(p.windowId!)}
                        >
                          Kill
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}




























