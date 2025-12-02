import React from "react";
import { useKernel, useNotifications } from "../kernel/KernelProvider";

export function SettingsApp() {
  const { settings, toggleTheme, toggleAnimations } = useKernel();
  const { notifications, clearNotifications } = useNotifications();

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            RedByte Settings
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Core system preferences and diagnostics.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          SETTINGS://CORE
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Theme & UX */}
        <section className="rb-glass rounded-2xl p-3 flex flex-col gap-2 border border-slate-800/80">
          <h2 className="text-xs font-semibold text-slate-100">
            Appearance & UX
          </h2>
          <p className="text-[0.7rem] text-slate-400">
            Visual preferences for the RedByte environment.
          </p>

          <div className="mt-1 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[0.75rem] text-slate-200">
                  Theme (simulated)
                </div>
                <div className="text-[0.65rem] text-slate-500">
                  Currently: <span className="font-mono">{settings.theme}</span>
                  {" "} (UI remains dark for now)
                </div>
              </div>
              <button
                className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-pink-500/70 hover:text-pink-300"
                onClick={toggleTheme}
              >
                Toggle theme
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[0.75rem] text-slate-200">
                  Animations
                </div>
                <div className="text-[0.65rem] text-slate-500">
                  {settings.animations ? "Enabled" : "Disabled"}
                </div>
              </div>
              <button
                className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-pink-500/70 hover:text-pink-300"
                onClick={toggleAnimations}
              >
                Toggle animations
              </button>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="rb-glass rounded-2xl p-3 flex flex-col gap-2 border border-slate-800/80">
          <h2 className="text-xs font-semibold text-slate-100">
            Notifications
          </h2>
          <p className="text-[0.7rem] text-slate-400">
            System alerts and lifecycle messages from the kernel.
          </p>

          <div className="flex items-center justify-between mt-1">
            <div className="text-[0.7rem] text-slate-300">
              Total:{" "}
              <span className="font-mono">
                {notifications.length}
              </span>
              {" · "}
              Unread:{" "}
              <span className="font-mono">
                {unread}
              </span>
            </div>
            <button
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-rose-500/70 hover:text-rose-300"
              onClick={clearNotifications}
              disabled={notifications.length === 0}
            >
              Clear all
            </button>
          </div>

          <div className="mt-2 max-h-32 overflow-auto rounded-xl bg-slate-950/80 border border-slate-800/80 px-2 py-1.5">
            {notifications.length === 0 ? (
              <div className="text-[0.7rem] text-slate-500">
                No notifications yet.
              </div>
            ) : (
              notifications
                .slice()
                .reverse()
                .slice(0, 8)
                .map((n) => (
                  <div
                    key={n.id}
                    className="text-[0.7rem] text-slate-200 flex justify-between gap-2"
                  >
                    <span className="truncate">{n.title}</span>
                    <span className="text-[0.6rem] text-slate-500">
                      {new Date(n.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
            )}
          </div>
        </section>

        {/* System Info */}
        <section className="rb-glass rounded-2xl p-3 flex flex-col gap-2 border border-slate-800/80">
          <h2 className="text-xs font-semibold text-slate-100">
            System Info
          </h2>
          <p className="text-[0.7rem] text-slate-400">
            High-level information about this RedByte session.
          </p>

          <div className="mt-1 space-y-1.5 text-[0.7rem] text-slate-300">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Kernel:</span>
              <span className="font-mono">rb-kernel</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Mode:</span>
              <span className="font-mono">simulation</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Session:</span>
              <span className="font-mono">
                {typeof window !== "undefined"
                  ? window.location.hostname
                  : "browser"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
