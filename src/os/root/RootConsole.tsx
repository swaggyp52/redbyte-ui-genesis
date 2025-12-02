import React from "react";
import { useRootLogs } from "./logs";

export const RootConsole: React.FC = () => {
  const { logs } = useRootLogs();

  return (
    <div className="flex flex-col gap-3 text-xs font-mono">
      <div className="flex items-center justify-between">
        <span className="text-slate-300">/root · system console</span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
          healthy
        </span>
      </div>
      <div className="rb-glass rounded-xl p-3 max-h-64 overflow-auto space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 items-start">
            <span className="text-slate-500 whitespace-nowrap">
              {log.timestamp}
            </span>
            <span className="text-slate-300">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};



