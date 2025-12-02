import React, { useState } from "react";
import { useEventBus } from "../../hooks/useEventBus";
import type { OSEvent } from "../events/events";

interface ToastState {
  id: string;
  title: string;
  body?: string;
  level: "info" | "success" | "error";
}

export const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEventBus((event: OSEvent) => {
    if (event.type !== "toast") return;
    const toast: ToastState = {
      id: event.id,
      title: event.title,
      body: event.body,
      level: event.level,
    };
    setToasts((prev) => [...prev, toast]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== event.id));
    }, 4000);
  });

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-40 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rb-glass rounded-xl px-3 py-2 border border-slate-800/80 min-w-[220px] max-w-xs text-xs text-slate-50"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold truncate">{toast.title}</span>
            <span className="text-[9px] uppercase tracking-wide text-slate-400">
              {toast.level}
            </span>
          </div>
          {toast.body && (
            <p className="text-[11px] text-slate-300">{toast.body}</p>
          )}
        </div>
      ))}
    </div>
  );
};


























