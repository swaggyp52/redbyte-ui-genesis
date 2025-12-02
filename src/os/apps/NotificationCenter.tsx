import React from "react";

interface NotificationItem {
  id: string;
  source: string;
  message: string;
  time: string;
}

const notifications: NotificationItem[] = [
  {
    id: "n1",
    source: "Pipeline",
    message: "Cloudflare deploy healthy on main.",
    time: "just now",
  },
  {
    id: "n2",
    source: "Agent · Marcus",
    message: "Stage 2 OS shell online.",
    time: "1 min ago",
  },
  {
    id: "n3",
    source: "System",
    message: "Workspace state persisted.",
    time: "3 min ago",
  },
];

export const NotificationCenterApp: React.FC = () => {
  return (
    <div className="text-xs text-slate-200 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-50">
          Notification Center
        </p>
        <p className="text-slate-400">
          Synthetic feed representing OS level events.
        </p>
      </div>
      <div className="space-y-2 max-h-64 overflow-auto pr-1">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="rb-glass rounded-lg px-3 py-2 border border-slate-800/80 flex flex-col gap-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold">{n.source}</span>
              <span className="text-[10px] text-slate-500">{n.time}</span>
            </div>
            <p className="text-[11px] text-slate-300">{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

















