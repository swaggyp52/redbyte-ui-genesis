import React from "react";

/**
 * CpuDesignerApp
 *
 * v1 is a "CPU concept studio" — a friendly place to:
 * - see the parts of a CPU (ALU, registers, control, memory)
 * - understand how they connect
 * - get guidance on which Logic Workspace templates to use
 *
 * Later versions can embed real logic templates and full simulations.
 */
export function CpuDesignerApp() {
  return (
    <div className="h-full w-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            CPU Designer — Concept Studio
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            A high-level view of how a small CPU is built from blocks: ALU,
            registers, control logic and memory. Use this as the &quot;map&quot;
            for building real circuits in the Logic Designer and Redstone Lab.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] text-emerald-300 font-mono">
            MODE://CPU-DESIGNER
          </span>
          <span className="text-[0.65rem] text-slate-500 uppercase">
            LAB://CPU-CORE-V1
          </span>
        </div>
      </header>

      {/* Layout: left = block diagram, right = explanation & checklist */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-3">
        {/* LEFT: block diagram */}
        <section className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xs font-semibold text-slate-100">
                CPU Block Diagram
              </h2>
              <p className="text-[0.7rem] text-slate-400">
                A tiny CPU consists of four big ideas: an ALU, registers, a
                control unit, and memory. Data flows around on a shared bus.
              </p>
            </div>
            <span className="text-[0.65rem] text-slate-500 font-mono">
              VIEW://BLOCK-DIAGRAM
            </span>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="grid grid-cols-3 grid-rows-3 gap-3 max-w-xl w-full">
              {/* Registers */}
              <div className="row-span-1 col-span-1 rb-glass rounded-2xl border border-sky-500/60 p-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.8rem] text-slate-100 font-semibold">
                    Registers
                  </span>
                  <span className="text-[0.7rem] text-sky-300 font-mono">
                    REG
                  </span>
                </div>
                <p className="text-[0.7rem] text-slate-400">
                  Small, fast storage cells that hold numbers the CPU is
                  currently working with.
                </p>
              </div>

              {/* ALU */}
              <div className="row-span-1 col-span-1 rb-glass rounded-2xl border border-emerald-500/60 p-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.8rem] text-slate-100 font-semibold">
                    ALU
                  </span>
                  <span className="text-[0.7rem] text-emerald-300 font-mono">
                    +− &amp;&amp; ||
                  </span>
                </div>
                <p className="text-[0.7rem] text-slate-400">
                  Arithmetic Logic Unit. Adds, subtracts and compares values.
                </p>
              </div>

              {/* Control unit */}
              <div className="row-span-1 col-span-1 rb-glass rounded-2xl border border-fuchsia-500/60 p-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.8rem] text-slate-100 font-semibold">
                    Control
                  </span>
                  <span className="text-[0.7rem] text-fuchsia-300 font-mono">
                    CTRL
                  </span>
                </div>
                <p className="text-[0.7rem] text-slate-400">
                  Decides which operation to perform next and which components
                  should listen on each clock tick.
                </p>
              </div>

              {/* Bus */}
              <div className="row-span-1 col-span-3 rb-glass rounded-2xl border border-slate-700/80 p-3 flex items-center justify-center">
                <span className="text-[0.75rem] text-slate-300 font-mono">
                  DATA BUS — The shared highway where numbers travel between
                  registers, ALU and memory.
                </span>
              </div>

              {/* Program counter */}
              <div className="row-span-1 col-span-1 rb-glass rounded-2xl border border-amber-500/60 p-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.8rem] text-slate-100 font-semibold">
                    Program Counter
                  </span>
                  <span className="text-[0.7rem] text-amber-300 font-mono">
                    PC
                  </span>
                </div>
                <p className="text-[0.7rem] text-slate-400">
                  Keeps track of &quot;where we are&quot; in the instruction
                  list.
                </p>
              </div>

              {/* Instruction memory */}
              <div className="row-span-1 col-span-1 rb-glass rounded-2xl border border-indigo-500/60 p-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.8rem] text-slate-100 font-semibold">
                    Instruction Memory
                  </span>
                  <span className="text-[0.7rem] text-indigo-300 font-mono">
                    ROM
                  </span>
                </div>
                <p className="text-[0.7rem] text-slate-400">
                  Stores the small program telling the CPU which steps to run.
                </p>
              </div>

              {/* Data memory */}
              <div className="row-span-1 col-span-1 rb-glass rounded-2xl border border-teal-500/60 p-3 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.8rem] text-slate-100 font-semibold">
                    Data Memory
                  </span>
                  <span className="text-[0.7rem] text-teal-300 font-mono">
                    RAM
                  </span>
                </div>
                <p className="text-[0.7rem] text-slate-400">
                  Stores the working data the program manipulates.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: guidance, templates, roadmap */}
        <section className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col gap-3">
          <div>
            <h2 className="text-xs font-semibold text-slate-100 mb-1">
              How to build this CPU inside RedByte
            </h2>
            <p className="text-[0.7rem] text-slate-400 mb-2">
              You don&apos;t have to build a full CPU all at once. Start with a
              few small circuits and combine them:
            </p>
            <ul className="list-disc list-inside text-[0.7rem] text-slate-300 space-y-1">
              <li>
                Use <span className="text-emerald-300">Logic Designer</span> to
                create an ALU slice (see the &quot;4-bit mini-ALU&quot;
                template).
              </li>
              <li>
                Use <span className="text-sky-300">Logic Designer</span> +
                &quot;Mini CPU counter&quot; template for a simple clocked
                counter.
              </li>
              <li>
                Combine these ideas into a program counter + a simple state
                machine for control.
              </li>
              <li>
                Finally, use{" "}
                <span className="text-fuchsia-300">Redstone Lab</span> to see
                the same logic rendered as 3D blocks.
              </li>
            </ul>
          </div>

          <div className="border-t border-slate-800/80 pt-2">
            <h3 className="text-[0.75rem] font-semibold text-slate-100 mb-1">
              Suggested learning path
            </h3>
            <ol className="list-decimal list-inside text-[0.7rem] text-slate-300 space-y-1">
              <li>Start with the traffic light example in Logic Designer.</li>
              <li>Move on to the elevator controller example.</li>
              <li>Experiment with the mini-ALU and mini CPU counter templates.</li>
              <li>
                Sketch how these pieces fit into the CPU diagram you see here.
              </li>
              <li>
                Once comfortable, design your own register file and instruction
                format.
              </li>
            </ol>
          </div>

          <div className="border-t border-slate-800/80 pt-2">
            <h3 className="text-[0.75rem] font-semibold text-slate-100 mb-1">
              Roadmap for future CPU Designer versions
            </h3>
            <ul className="list-disc list-inside text-[0.7rem] text-slate-300 space-y-1">
              <li>
                Embed real Logic Designer diagrams on the ALU / control blocks.
              </li>
              <li>
                One-click &quot;Build this in 3D&quot; for the full CPU core.
              </li>
              <li>
                Run simple programs step-by-step with a visual instruction
                pointer.
              </li>
              <li>
                Export your CPU as JSON / Verilog-style descriptions for use in
                other tools.
              </li>
            </ul>
          </div>

          <div className="mt-auto text-[0.65rem] text-slate-500">
            CPU Designer v1 is intentionally simple: it&apos;s a conversation
            starter with students, teammates, or investors. You can say,
            &quot;this is the architecture I&apos;m building&quot; before
            getting lost in wiring details.
          </div>
        </section>
      </div>
    </div>
  );
}

export default CpuDesignerApp;









