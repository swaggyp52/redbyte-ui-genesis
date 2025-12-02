import React, { useState } from "react";
import { agents } from "../../agents/core/registry";
import { createExecution } from "../../agents/core/AgentHost";
import { emitToast } from "../events/events";

export const AgentPanelApp: React.FC = () => {
  const [input, setInput] = useState("Design the next RedByte OS feature.");
  const [lastExecution, setLastExecution] = useState<string | null>(null);

  const primary = agents[0];

  const runAgent = () => {
    if (!primary) return;
    const { execution, agentName } = createExecution(primary.id, input);
    const line = `${agentName ?? primary.id} accepted job ${
      execution.id
    } · status=${execution.status}`;
    setLastExecution(line);
    emitToast({
      title: "Agent dispatched",
      body: line,
      level: "success",
    });
  };

  return (
    <div className="text-xs text-slate-200 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-50">Agents</p>
        <p className="text-slate-400">
          Registry-backed view of system agents. Execution is simulated.
        </p>
      </div>
      <div className="rb-glass rounded-xl p-3 border border-slate-800/80 space-y-2">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold">Registered agents</p>
          <ul className="space-y-1">
            {agents.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between text-[11px]"
              >
                <span>{a.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {a.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold">Simulate request</p>
          <textarea
            className="w-full text-[11px] bg-slate-900/60 border border-slate-700/70 rounded-md px-2 py-1 outline-none focus:border-pink-500/70"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="button"
            onClick={runAgent}
            className="mt-1 inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-gradient-to-r from-pink-500 to-sky-500 text-[11px] font-semibold text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition"
          >
            Dispatch to {primary?.name ?? "agent"}
          </button>
        </div>
        {lastExecution && (
          <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-md px-2 py-1">
            {lastExecution}
          </div>
        )}
      </div>
    </div>
  );
};






















