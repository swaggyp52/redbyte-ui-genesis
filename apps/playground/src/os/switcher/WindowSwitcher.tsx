import React from "react";

interface SwitcherProps {
  windows: { id: number; title: string }[];
  activeIndex: number;
  visible: boolean;
}

const WindowSwitcher: React.FC<SwitcherProps> = ({ windows, activeIndex, visible }) => {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] transition-opacity"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="flex gap-4 px-6 py-4 rounded-2xl bg-black/70 border border-red-900/70 shadow-xl">
        {windows.map((w, i) => (
          <div
            key={w.id}
            className={`
              px-4 py-3 rounded-lg border 
              ${i === activeIndex ? "border-red-400 bg-red-950/40" : "border-red-900/50 bg-black/40"}
              text-slate-200 text-xs w-40 text-center transition-all
            `}
          >
            {w.title}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WindowSwitcher;
