import React, { useState } from "react";

interface Line {
  id: number;
  text: string;
}

export function TerminalApp() {
  const [lines, setLines] = useState<Line[]>([
    { id: 1, text: "RedByte Shell v0.1" },
    { id: 2, text: "type `help` to see commands" },
  ]);
  const [input, setInput] = useState("");

  const runCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const newTexts: string[] = [`> ${trimmed}`];

    if (trimmed === "help") {
      newTexts.push("Commands: help, clear, about, time");
    } else if (trimmed === "clear") {
      setLines([]);
      return;
    } else if (trimmed === "about") {
      newTexts.push("RedByte OS — prototype shell running inside the browser.");
    } else if (trimmed === "time") {
      newTexts.push(`Time: ${new Date().toLocaleString()}`);
    } else {
      newTexts.push(`Unknown command: ${trimmed}`);
    }

    setLines((prev) => {
      const startId = prev.length > 0 ? prev[prev.length - 1].id : 2;
      const extra = newTexts.map((text, index) => ({
        id: startId + index + 1,
        text,
      }));
      return [...prev, ...extra];
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCommand(input);
    setInput("");
  };

  return (
    <div className="h-full flex flex-col rounded-xl bg-black/70 border border-slate-800/80 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-slate-800/80 text-[0.7rem] text-slate-400">
        REDBYTE://TERMINAL
      </div>
      <div className="flex-1 px-3 py-2 text-[0.7rem] font-mono text-slate-100 overflow-auto">
        {lines.map((line) => (
          <div key={line.id}>{line.text}</div>
        ))}
      </div>
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 px-3 py-2 border-t border-slate-800/80 bg-slate-950/90"
      >
        <span className="text-[0.7rem] text-emerald-400 font-mono">❯</span>
        <input
          className="flex-1 bg-transparent border-none outline-none text-[0.7rem] font-mono text-slate-100"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
      </form>
    </div>
  );
}















