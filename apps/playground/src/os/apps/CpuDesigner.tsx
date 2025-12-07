import React from "react";
import { useProject, CpuModuleKind } from "../context/ProjectContext";

const CPU_KINDS: CpuModuleKind[] = [
  "alu",
  "register-file",
  "control-unit",
  "clock",
  "memory",
  "io",
];

const CPUDesigner: React.FC = () => {
  const { project, addCpuModule, removeCpuModule } = useProject();

  const describeKind = (kind: CpuModuleKind): string => {
    switch (kind) {
      case "alu":
        return "math / logic core";
      case "register-file":
        return "small fast memory";
      case "control-unit":
        return "instruction decoder";
      case "clock":
        return "timing & stepper";
      case "memory":
        return "RAM / ROM block";
      case "io":
        return "inputs / outputs";
      default:
        return "";
    }
  };

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex">
      <div className="w-44 border-r border-red-900/60 p-2 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80 mb-1">
          cpu units
        </div>
        <div className="space-y-1">
          {CPU_KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => addCpuModule(kind)}
              className="w-full rounded border border-red-900/70 bg-black/70 hover:border-red-400/80 px-2 py-1 text-left"
            >
              <div className="text-[11px] text-slate-100">
                {kind.toUpperCase()}
              </div>
              <div className="text-[9px] text-slate-400">{describeKind(kind)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">
              cpu map (proto)
            </div>
            <div className="text-[11px] text-slate-400">
              {project.cpu.units.length} unit
              {project.cpu.units.length === 1 ? "" : "s"} in design
            </div>
          </div>
        </div>

        <div className="flex-1 rounded-lg border border-red-900/70 bg-black/70 overflow-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-black/60 text-slate-400 border-b border-red-900/60">
              <tr>
                <th className="px-3 py-2 text-left font-normal">Label</th>
                <th className="px-3 py-2 text-left font-normal">Kind</th>
                <th className="px-3 py-2 text-left font-normal">Clock (Hz)</th>
                <th className="px-3 py-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {project.cpu.units.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-red-900/40 last:border-0 hover:bg-red-950/40"
                >
                  <td className="px-3 py-1.5">{u.label}</td>
                  <td className="px-3 py-1.5 text-slate-300">{u.kind}</td>
                    <td className="px-3 py-1.5 text-slate-300">{u.clockHz.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => removeCpuModule(u.id)}
                      className="text-[10px] uppercase tracking-[0.16em] text-red-300/80 hover:text-red-200"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
              {project.cpu.units.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-center text-slate-500 text-[11px]"
                  >
                    no cpu units yet  add from the left palette
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-slate-500">
          later this view becomes a visual layout of units + buses; for now it's your
          CPU bill-of-materials
        </div>
      </div>
    </div>
  );
};

export default CPUDesigner;
