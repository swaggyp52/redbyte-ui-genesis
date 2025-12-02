import React from "react";
import { useNotifications, type NotificationKind } from "../../kernel/KernelProvider";

export function NotificationCenter() {
  const { notifications, markAsRead } = useNotifications();

  if (!notifications.length) return null;

  const visible = [...notifications].slice(-3).reverse();

  const borderClassForKind = (kind: NotificationKind) => {
    switch (kind) {
      case "success":
        return "border-emerald-500/80";
      case "warning":
        return "border-amber-400/80";
      case "error":
        return "border-rose-500/80";
      case "info":
      default:
        return "border-sky-500/80";
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-end p-4 gap-2 z-40">
      {visible.map((n) => {
        const borderClass = borderClassForKind(n.kind);
        return (
          <div
            key={n.id}
            className={`pointer-events-auto rb-glass max-w-xs rounded-2xl px-3 py-2 text-xs shadow-lg border-l-4 ${borderClass}`}
            onClick={() => markAsRead(n.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-slate-50 truncate">
                {n.title}
              </div>
              <span className="text-[0.6rem] text-slate-400">
                {new Date(n.createdAt).toLocaleTimeString()}
              </span>
            </div>
            {n.body && (
              <div className="mt-1 text-[0.7rem] text-slate-300">
                {n.body}
              </div>
            )}
            <div className="mt-1 text-[0.6rem] text-slate-500">
              Click to mark as read
            </div>
          </div>
        );
      })}
    </div>
  );
}









