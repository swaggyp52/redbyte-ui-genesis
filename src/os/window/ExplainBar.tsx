import React, { useState } from "react";
import { explainApp } from "../../ai/AIExplain";

interface Props {
  appId: string;
  title: string;
}

export function ExplainBar({ appId, title }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>("");

  async function handleExplain() {
    setOpen(true);
    const out = await explainApp(appId, title);
    setText(out);
  }

  return (
    <div className="border-b border-slate-800/80 bg-slate-950/80 px-3 py-1 flex items-center justify-between text-[0.75rem]">
      <button
        onClick={handleExplain}
        className="px-2 py-0.5 rounded-lg border border-sky-500/70 text-sky-300 hover:bg-sky-500/10"
      >
        Explain this
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-8 bottom-0 bg-slate-900/95 backdrop-blur-xl p-4 overflow-auto z-50">
          <h2 className="text-slate-100 text-sm font-semibold mb-2">AI Explanation</h2>
          <pre className="whitespace-pre-wrap text-[0.75rem] text-slate-300">
            {text}
          </pre>

          <button
            onClick={() => setOpen(false)}
            className="mt-3 px-3 py-1 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700/60"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}



