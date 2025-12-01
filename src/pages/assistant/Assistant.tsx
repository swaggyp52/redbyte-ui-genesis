import React, { useState } from "react";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type Message = {
  from: "user" | "ai";
  text: string;
};

export default function Assistant() {
  const [msgs, setMsgs] = useState<Message[]>([
    {
      from: "ai",
      text: "Yo. I\`m the RedByte assistant shell. This is a demo chat wired to a simple Node API.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!input.trim() || busy) return;

    const text = input.trim();
    setInput("");
    setMsgs((m) => [...m, { from: "user", text }]);
    setBusy(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({}));
      const reply =
        (data && data.reply) ||
        "RedByte demo backend online. (This is a fallback message.)";

      setMsgs((m) => [...m, { from: "ai", text: reply }]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        {
          from: "ai",
          text:
            "Couldn\`t reach the backend. Make sure `npm run api` is running locally, or set VITE_API_URL.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 max-w-4xl mx-auto flex flex-col h-[80vh]">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          RedByte Assistant
        </h1>
        <p className="text-xs text-neutral-400 mt-1 max-w-xl">
          Frontend chat shell + simple JSON API. Perfect for showing off the UX,
          even before plugging in a real LLM.
        </p>
      </div>

      <div className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-5 flex flex-col gap-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              "max-w-[80%] px-3 py-2 rounded-2xl text-xs sm:text-sm " +
              (m.from === "user"
                ? "ml-auto bg-red-600 text-white"
                : "bg-neutral-900 border border-neutral-800 text-neutral-50")
            }
          >
            {m.text}
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs sm:text-sm text-white outline-none focus:border-red-500"
          placeholder="Ask something…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="px-4 sm:px-6 py-2 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs sm:text-sm font-semibold text-white"
        >
          {busy ? "Thinking…" : "Send"}
        </button>
      </div>
    </div>
  );
}

