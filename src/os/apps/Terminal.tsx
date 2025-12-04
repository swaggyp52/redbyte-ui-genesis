import React, { useState } from "react";
import { useFS } from "../core/fsStore";

const TerminalApp: React.FC = () => {
  const fs = useFS();
  const [lines, setLines] = useState<string[]>([
    "redbyte terminal",
    "type `help` to list commands.",
    ""
  ]);
  const [input, setInput] = useState("");

  const append = (next: string | string[]) => {
    setLines(prev => [...prev, ...(Array.isArray(next) ? next : [next])]);
  };

  const handle = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    append(`> ${cmd}`);

    const [name, ...rest] = cmd.split(" ");
    const arg = rest.join(" ").trim();

    switch (name) {
      case "help":
        append([
          "available commands:",
          "  help           show this help",
          "  clear          clear screen",
          "  pwd            show current path",
          "  ls             list directory",
          "  cd PATH        change directory",
          "  cat FILE       print file contents",
          "  write FILE     write text into file",
          ""
        ]);
        break;
      case "clear":
        setLines([]);
        break;
      case "pwd":
        append(fs.pwd());
        break;
      case "ls": {
        const list = fs.list();
        if (!list.length) {
          append("(empty)");
        } else {
          append(
            list.map(
              n =>
                `${n.type === "dir" ? "d" : "-"} ${n.name}`
            )
          );
        }
        append("");
        break;
      }
      case "cd":
        if (!arg) {
          append("cd: missing path");
        } else {
          const prev = fs.pwd();
          fs.cd(arg);
          if (fs.pwd() === prev) {
            append(`cd: no such directory: ${arg}`);
          } else {
            append(fs.pwd());
          }
        }
        break;
      case "cat":
        if (!arg) {
          append("cat: missing file name");
        } else {
          const content = fs.readFile(arg);
          if (content == null) {
            append(`cat: cannot open file: ${arg}`);
          } else {
            append(content.split("\n"));
          }
        }
        break;
      case "write":
        if (!arg) {
          append("usage: write FILE (then enter text, end with single '.' line)");
        } else {
          append(`enter text for ${arg}, end with '.' on a single line:`);
          let buffer: string[] = [];

          const intercept = (line: string) => {
            if (line === ".") {
              fs.writeFile(arg, buffer.join("\n"));
              append([`written to ${arg}`, ""]);
              setLines(prev => prev.filter(l => !l.startsWith("::input ")));
              (window as any).__rb_input_handler = null;
              return;
            }
            buffer.push(line);
            setLines(prev => [...prev, `::input ${line}`]);
          };

          (window as any).__rb_input_handler = intercept;
        }
        break;
      default: {
        const handler = (window as any).__rb_input_handler;
        if (typeof handler === "function") {
          handler(cmd);
        } else {
          append(`unknown command: ${name}`);
        }
        break;
      }
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input;
    setInput("");
    handle(value);
  };

  return (
    <div className="h-full w-full flex flex-col bg-black/70">
      <div className="flex-1 overflow-auto p-3 font-mono text-[11px] text-red-100/90">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <form
        onSubmit={onSubmit}
        className="border-t border-red-900/70 px-3 py-2 flex items-center gap-2 bg-black/80"
      >
        <span className="text-[11px] font-mono text-red-400/90">&gt;</span>
        <input
          className="flex-1 bg-transparent outline-none border-none text-[11px] font-mono text-red-100 placeholder-red-500/40"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="type a command, e.g. `help`"
        />
      </form>
    </div>
  );
};

export default TerminalApp;
