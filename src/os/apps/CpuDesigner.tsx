import React, { useState } from "react";

type Op = "ADD" | "AND" | "OR" | "XOR" | "SHL" | "SHR";

interface CpuResult {
  result: number;
  carry: boolean;
  zero: boolean;
  negative: boolean;
}

function runOp(a: number, b: number, op: Op): CpuResult {
  a = a & 0xff;
  b = b & 0xff;
  let res = 0;
  let carry = false;

  switch (op) {
    case "ADD": {
      const sum = a + b;
      res = sum & 0xff;
      carry = sum > 0xff;
      break;
    }
    case "AND":
      res = a & b;
      break;
    case "OR":
      res = a | b;
      break;
    case "XOR":
      res = a ^ b;
      break;
    case "SHL": {
      const shifted = a << 1;
      res = shifted & 0xff;
      carry = (a & 0x80) !== 0;
      break;
    }
    case "SHR":
      res = (a >> 1) & 0xff;
      carry = (a & 0x01) !== 0;
      break;
  }

  const zero = res === 0;
  const negative = (res & 0x80) !== 0;

  return { result: res, carry, zero, negative };
}

const CpuDesigner: React.FC = () => {
  const [a, setA] = useState(5);
  const [b, setB] = useState(3);
  const [op, setOp] = useState<Op>("ADD");

  const r = runOp(a, b, op);

  const parse = (val: string) => {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > 255) return 255;
    return n;
  };

  const toBin = (n: number) =>
    n
      .toString(2)
      .padStart(8, "0")
      .replace(/(.{4})/, "$1 ");

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex flex-col p-3 gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-red-300/80">
        cpu slice
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* registers */}
        <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
            registers
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-slate-300 mb-1">A (8-bit)</div>
              <input
                type="number"
                min={0}
                max={255}
                value={a}
                onChange={(e) => setA(parse(e.target.value))}
                className="w-full bg-black/80 border border-red-900/70 rounded px-2 py-1 text-[11px] outline-none focus:border-red-400"
              />
              <div className="mt-1 text-[10px] text-slate-400 font-mono">
                {toBin(a)} (dec {a})
              </div>
            </div>
            <div>
              <div className="text-slate-300 mb-1">B (8-bit)</div>
              <input
                type="number"
                min={0}
                max={255}
                value={b}
                onChange={(e) => setB(parse(e.target.value))}
                className="w-full bg-black/80 border border-red-900/70 rounded px-2 py-1 text-[11px] outline-none focus:border-red-400"
              />
              <div className="mt-1 text-[10px] text-slate-400 font-mono">
                {toBin(b)} (dec {b})
              </div>
            </div>
          </div>
        </div>

        {/* alu */}
        <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
            alu
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {(["ADD", "AND", "OR", "XOR", "SHL", "SHR"] as Op[]).map((o) => (
              <button
                key={o}
                onClick={() => setOp(o)}
                className={[
                  "px-2 py-1 rounded border text-[10px] font-mono",
                  op === o
                    ? "border-red-400 bg-red-900/60 text-red-100"
                    : "border-red-900 bg-black/70 text-slate-200 hover:border-red-500/80"
                ].join(" ")}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="space-y-1 text-[10px] text-slate-300">
            <div>operation: {op}</div>
            <div>expression: A {op === "ADD" ? "+" : op} B</div>
          </div>
        </div>

        {/* result + flags */}
        <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
            result
          </div>
          <div className="text-[11px] text-slate-100 font-mono">
            {toBin(r.result)} (dec {r.result})
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-[10px]">
            <div
              className={[
                "px-2 py-1 rounded border text-center",
                r.zero
                  ? "border-emerald-400 bg-emerald-900/40 text-emerald-200"
                  : "border-slate-700 bg-black/70 text-slate-400"
              ].join(" ")}
            >
              Z
            </div>
            <div
              className={[
                "px-2 py-1 rounded border text-center",
                r.carry
                  ? "border-amber-400 bg-amber-900/40 text-amber-200"
                  : "border-slate-700 bg-black/70 text-slate-400"
              ].join(" ")}
            >
              C
            </div>
            <div
              className={[
                "px-2 py-1 rounded border text-center",
                r.negative
                  ? "border-red-400 bg-red-900/40 text-red-200"
                  : "border-slate-700 bg-black/70 text-slate-400"
              ].join(" ")}
            >
              N
            </div>
            <div className="px-2 py-1 rounded border border-slate-700 bg-black/70 text-slate-400 text-center">
              8-bit
            </div>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-500 mt-auto">
        simple 8-bit slice – next step is wiring this into a full microcoded
        core.
      </div>
    </div>
  );
};

export default CpuDesigner;
