import React from "react";

const launchItems = [
  { id: "root-console", name: "/root console", group: "system" },
  { id: "terminal", name: "Neon Terminal", group: "dev" },
  { id: "launchpad", name: "Launchpad", group: "system" },
  { id: "notifications", name: "Notification Center", group: "system" },
  { id: "agents", name: "Agents", group: "agents" },
];

export const LaunchpadApp: React.FC = () => {
  return (
    <div className="text-xs text-slate-200 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-50">Launchpad</p>
        <p className="text-slate-400">
          Quick overview of installed RedByte OS apps.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {launchItems.map((item) => (
          <div
            key={item.id}
            className="rb-glass rounded-xl px-3 py-2 border border-slate-800/70 flex flex-col gap-1"
          >
            <span className="text-[11px] font-semibold">{item.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              {item.group}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};




















