import React, { useEffect, useState } from "react";
import { Commands, Command, emitCommand } from "./CommandRegistry";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<Command[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setFiltered([]);
      setIndex(0);
      return;
    }
    setFiltered(Commands);
  }, [open]);

  useEffect(() => {
    const q = query.toLowerCase();
    const f = Commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.includes(q))
    );
    setFiltered(f);
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const chosen = filtered[index];
        if (chosen) {
          emitCommand(chosen);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, index]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[999] bg-black/40 backdrop-blur-md flex justify-center pt-32">
      <div className="w-full max-w-xl rb-glass rounded-2xl border border-slate-800/80 p-3">
        <input
          autoFocus
          className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none"
          placeholder="Search apps, commands, tools..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mt-2 max-h-80 overflow-auto flex flex-col">
          {filtered.length === 0 && (
            <div className="text-[0.75rem] text-slate-500 p-3">
              No matches. Try different words.
            </div>
          )}

          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => {
                emitCommand(cmd);
                onClose();
              }}
              className={
                "text-left text-[0.8rem] px-3 py-2 rounded-xl hover:bg-slate-800/70" +
                (i === index ? " bg-slate-800/70 ring-1 ring-sky-500/50" : "")
              }
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}




























