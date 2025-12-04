import React, { useState } from "react";

type GateType = "AND" | "OR" | "XOR" | "NOT";

interface GateInstance {
  id: number;
  type: GateType;
}

function applyGate(type: GateType, a: boolean, b: boolean): boolean {
  switch (type) {
    case "AND":
      return a && b;
    case "OR":
      return a || b;
    case "XOR":
      return a !== b;
    case "NOT":
      return !a;
    default:
      return a;
  }
}

function evaluateChain(gates: GateInstance[], a: boolean, b: boolean): boolean {
  let current = a;
  let other = b;
  for (const g of gates) {
    current = applyGate(g.type, current, other);
  }
  return current;
}

const LogicDesigner: React.FC = () => {
  const [inputA, setInputA] = useState(true);
  const [inputB, setInputB] = useState(false);
  const [gates, setGates] = useState<GateInstance[]>([]);

  const addGate = (type: GateType) => {
    setGates((prev) => [
      ...prev,
      { id: Date.now() + Math.floor(Math.random() * 1000), type }
    ]);
  };

  const removeGate = (id: number) => {
    setGates((prev) => prev.filter((g) => g.id !== id));
  };

  const output = evaluateChain(gates, inputA, inputB);

  return (
    <div className="h-full w-full flex bg-black/80 text-[11px] text-slate-100">
      {/* palette */}
      <aside className="w-40 border-r border-red-900/70 bg-black/80 p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-red-300/80 mb-1">
          gates
        </div>
        {(["AND", "OR", "XOR", "NOT"] as GateType[]).map((t) => (
          <button
            key={t}
            onClick={() => addGate(t)}
            className="w-full mb-1 rounded border border-red-900/70 bg-black/60 hover:border-red-500/80 hover:bg-red-950/60 px-2 py-1 text-left"
          >
            <div className="flex items-center justify-between">
              <span>{t}</span>
              <span className="text-[9px] text-slate-400">add</span>
            </div>
          </button>
        ))}
      </aside>

      {/* canvas + io */}
      <div className="flex-1 flex flex-col">
        {/* inputs / outputs */}
        <div className="border-b border-red-900/70 bg-black/70 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-300">A</span>
              <button
                onClick={() => setInputA(!inputA)}
                className={[
                  "w-10 h-5 rounded-full border text-[10px] flex items-center px-1",
                  inputA
                    ? "border-red-400 bg-red-900/60 justify-end"
                    : "border-slate-600 bg-black/80 justify-start"
                ].join(" ")}
              >
                <span
                  className={[
                    "w-3 h-3 rounded-full",
                    inputA ? "bg-red-300" : "bg-slate-500"
                  ].join(" ")}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300">B</span>
              <button
                onClick={() => setInputB(!inputB)}
                className={[
                  "w-10 h-5 rounded-full border text-[10px] flex items-center px-1",
                  inputB
                    ? "border-red-400 bg-red-900/60 justify-end"
                    : "border-slate-600 bg-black/80 justify-start"
                ].join(" ")}
              >
                <span
                  className={[
                    "w-3 h-3 rounded-full",
                    inputB ? "bg-red-300" : "bg-slate-500"
                  ].join(" ")}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">output</span>
            <div
              className={[
                "w-6 h-6 rounded-full border flex items-center justify-center",
                output
                  ? "border-emerald-400 bg-emerald-900/50 text-emerald-200"
                  : "border-slate-600 bg-black/80 text-slate-400"
              ].join(" ")}
            >
              {output ? "1" : "0"}
            </div>
          </div>
        </div>

        {/* chain */}
        <div className="flex-1 p-3 overflow-auto">
          {gates.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              add gates on the left to build a 2-input circuit
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {gates.map((g, idx) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded border border-red-900/70 bg-black/70 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border border-red-500/70 flex items-center justify-center text-[11px]">
                      {g.type}
                    </div>
                    <div className="text-slate-300">
                      stage {idx + 1} • applies {g.type} to signal
                    </div>
                  </div>
                  <button
                    onClick={() => removeGate(g.id)}
                    className="text-[10px] uppercase tracking-[0.18em] text-red-300/80 hover:text-red-100"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogicDesigner;
