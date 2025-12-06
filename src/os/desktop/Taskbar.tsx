import React from "react";

const Taskbar = ({ windows, focus, close }) => {
  return (
    <div className="h-8 bg-black/70 border-t border-red-900/70 flex items-center px-2 gap-2 text-[11px] font-mono text-slate-300">
      {windows.map((w) => (
        <button
          key={w.id}
          onClick={() => focus(w.id)}
          className={`px-3 py-1 rounded ${
            w.focused ? "bg-red-900/60 text-red-200" : "bg-black/40"
          }`}
        >
          {w.title}
        </button>
      ))}

      <div className="flex-1" />

      <span className="text-red-300/70">RB-OS</span>
    </div>
  );
};

export default Taskbar;
