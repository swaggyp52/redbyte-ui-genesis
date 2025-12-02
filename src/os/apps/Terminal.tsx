import React, { useState } from "react";
import { emitToast } from "../events/events";

interface Line {
  id: string;
  text: string;
  kind: "input" | "output" | "system";
}

const bootstrap: Line[] = [
  {
    id: "l1",
    text: "RedByte NeonOS shell v0.1.0",
    kind: "system",
  },
  {
    id: "l2",
    text: "type `help` for simulated commands",
    kind: "system",
  },
];

const helpLines: string[] = [
  "available commands:",
  "  help        · show this help",
  "  status      · show fake system status",
  "  deploy      · pretend to trigger a deploy",
  "  clear       · clear the terminal buffer",
];

export const TerminalApp: React.FC = () => {
  const [lines, setLines] = useState<Line[]>(bootstrap);
  const [input, setInput] = useState("");

  const pushLine = (text: string, kind: Line["kind"]) => {
    setLines((prev) => [
      ...prev,
      {
        id: `line_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        text,
        kind,
      },
    ]);
  };

  const runCommand = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;

    pushLine(`> ${cmd}`, "input");

    switch (cmd) {
      case "help":
        helpLines.forEach((l) => pushLine(l, "output"));
        break;
      case "status":
        pushLine("RedByte OS status: OK · 0 alerts · 3 workspaces", "output");
        break;
      case "deploy":
        pushLine("triggering fake deploy to Cloudflare...", "output");
        emitToast({
          title: "Deploy (simulated)",
          body: "Pipeline executed from NeonOS terminal.",
          level: "info",
        });
        break;
      case "clear":
        setLines(bootstrap);
        break;
      default:
        pushLine(`command not found: ${cmd}`, "output");
        break;
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    runCommand(input);
    setInput("");
  };

  return (
    <div className="h-full flex flex-col bg-slate-950/60 border border-slate-900/80 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800/80 text-[11px] text-slate-400 flex justify-between">
        <span>NeonOS shell</span>
        <span className="text-slate-500">simulated</span>
      </div>
      <div className="flex-1 px-3 py-2 overflow-auto text-[11px] font-mono text-slate-200 space-y-0.5">
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              line.kind === "system"
                ? "text-slate-400"
                : line.kind === "output"
                ? "text-slate-200"
                : "text-sky-300"
            }
          >
            {line.text}
          </div>
        ))}
      </div>
      <form
        onSubmit={onSubmit}
        className="border-t border-slate-800/80 px-3 py-2 flex items-center gap-2 text-[11px] font-mono"
      >
        <span className="text-slate-500">λ</span>
        <input
          className="flex-1 bg-transparent outline-none text-slate-100 placeholder:text-slate-600"
          placeholder="type a command, e.g. `help`"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </form>
    </div>
  );
};




