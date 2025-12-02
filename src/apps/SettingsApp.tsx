import React, { useEffect, useState } from "react";
import {
  loadGlobalSettings,
  saveGlobalSettings,
  loadUserSettings,
  saveUserSettings,
  BootMode,
  UserSettings,
} from "../os/settings/SettingsStore";

interface CurrentUser {
  id: string;
  name: string;
  tag?: string;
}

const CURRENT_USER_KEY = "redbyte_current_user_v1";

function loadCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.name) return null;
    return parsed as CurrentUser;
  } catch {
    return null;
  }
}

export function SettingsApp() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [bootMode, setBootMode] = useState<BootMode>("cinematic");
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Load current user + settings
  useEffect(() => {
    const u = loadCurrentUser();
    setCurrentUser(u);

    const global = loadGlobalSettings();
    setBootMode(global.bootMode);

    if (u) {
      const us = loadUserSettings(u.id);
      setUserSettings(us);
    } else {
      setUserSettings(null);
    }
  }, []);

  function handleBootModeChange(mode: BootMode) {
    setBootMode(mode);
    const current = loadGlobalSettings();
    saveGlobalSettings({ ...current, bootMode: mode });
  }

  function updateUserSettings(patch: Partial<UserSettings>) {
    if (!currentUser || !userSettings) return;
    const updated: UserSettings = { ...userSettings, ...patch, userId: currentUser.id };
    setUserSettings(updated);
    saveUserSettings(currentUser.id, updated);
  }

  const favoriteAppIds = userSettings?.favoriteApps ?? [];
  const toggleFavorite = (id: string) => {
    if (!userSettings || !currentUser) return;
    const exists = userSettings.favoriteApps.includes(id);
    const nextFavs = exists
      ? userSettings.favoriteApps.filter((x) => x !== id)
      : [...userSettings.favoriteApps, id];
    updateUserSettings({ favoriteApps: nextFavs });
  };

  const theme = userSettings?.preferredTheme ?? "neon";
  const showHints = userSettings?.showHints ?? true;

  const appChoices = [
    { id: "file-explorer", label: "File Explorer" },
    { id: "redstone-lab", label: "Redstone Lab" },
    { id: "logic-workspace", label: "Logic Designer" },
    { id: "cpu-designer", label: "CPU Designer" },
    { id: "terminal", label: "Terminal" },
    { id: "notes", label: "Notes" },
    { id: "system-monitor", label: "System Monitor" },
  ];

  return (
    <div className="h-full w-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            RedByte Settings
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Control boot mode, themes and per-user preferences. This is the
            control panel for your OS, not just a single app.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] text-emerald-300 font-mono">
            SETTINGS://OS-V39
          </span>
          {currentUser ? (
            <span className="text-[0.65rem] text-slate-400 font-mono">
              USER: {currentUser.name} ({currentUser.tag || "USER"})
            </span>
          ) : (
            <span className="text-[0.65rem] text-slate-500 font-mono">
              USER: none (login overlay not ready)
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr] gap-3">
        {/* Left: global options */}
        <section className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col gap-3">
          <div>
            <h2 className="text-[0.8rem] font-semibold text-slate-100 mb-1">
              Boot Mode (global)
            </h2>
            <p className="text-[0.7rem] text-slate-400 mb-2">
              Cinematic boot shows the full multi-phase intro. Instant boot
              jumps directly into the desktop. This setting is global for this
              device.
            </p>
            <div className="flex flex-col gap-1 text-[0.75rem]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bootMode"
                  className="accent-sky-500"
                  checked={bootMode === "cinematic"}
                  onChange={() => handleBootModeChange("cinematic")}
                />
                <span>
                  <span className="text-slate-100">Cinematic</span>{" "}
                  <span className="text-slate-500">
                    (show full boot sequence every time)
                  </span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bootMode"
                  className="accent-sky-500"
                  checked={bootMode === "instant"}
                  onChange={() => handleBootModeChange("instant")}
                />
                <span>
                  <span className="text-slate-100">Instant</span>{" "}
                  <span className="text-slate-500">
                    (skip boot; go straight to desktop)
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-2">
            <h2 className="text-[0.8rem] font-semibold text-slate-100 mb-1">
              Hints & teaching overlays
            </h2>
            <p className="text-[0.7rem] text-slate-400 mb-2">
              RedByte can behave like a teaching OS: explaining features,
              surfacing tips and being grandma-friendly. Turn hints off if you
              want a quieter experience.
            </p>
            <label className="inline-flex items-center gap-2 text-[0.75rem] cursor-pointer">
              <input
                type="checkbox"
                className="accent-emerald-500"
                checked={showHints}
                onChange={(e) =>
                  updateUserSettings({ showHints: e.target.checked })
                }
                disabled={!currentUser || !userSettings}
              />
              <span>
                <span className="text-slate-100">Show hints and guidance</span>{" "}
                <span className="text-slate-500">
                  (recommended for students and first-time users)
                </span>
              </span>
            </label>
          </div>
        </section>

        {/* Right: per-user theme + favorites */}
        <section className="rb-glass rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 flex flex-col gap-3">
          <div>
            <h2 className="text-[0.8rem] font-semibold text-slate-100 mb-1">
              Theme preference (per user)
            </h2>
            <p className="text-[0.7rem] text-slate-400 mb-2">
              This setting is stored per user and can later be wired directly
              into the OS theme engine. For now it is saved and visible here
              as a user preference.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
              <button
                onClick={() => updateUserSettings({ preferredTheme: "neon" })}
                disabled={!currentUser || !userSettings}
                className={`rb-glass rounded-xl border px-2 py-1.5 text-left ${
                  theme === "neon"
                    ? "border-fuchsia-500/80 ring-1 ring-fuchsia-500/60"
                    : "border-slate-800/80"
                }`}
              >
                <div className="text-slate-100">Neon</div>
                <div className="text-[0.7rem] text-slate-400">
                  Bright, cyber OS look
                </div>
              </button>
              <button
                onClick={() => updateUserSettings({ preferredTheme: "midnight" })}
                disabled={!currentUser || !userSettings}
                className={`rb-glass rounded-xl border px-2 py-1.5 text-left ${
                  theme === "midnight"
                    ? "border-sky-500/80 ring-1 ring-sky-500/60"
                    : "border-slate-800/80"
                }`}
              >
                <div className="text-slate-100">Midnight</div>
                <div className="text-[0.7rem] text-slate-400">
                  Dark, subtle control room
                </div>
              </button>
              <button
                onClick={() => updateUserSettings({ preferredTheme: "carbon" })}
                disabled={!currentUser || !userSettings}
                className={`rb-glass rounded-xl border px-2 py-1.5 text-left ${
                  theme === "carbon"
                    ? "border-emerald-500/80 ring-1 ring-emerald-500/60"
                    : "border-slate-800/80"
                }`}
              >
                <div className="text-slate-100">Carbon</div>
                <div className="text-[0.7rem] text-slate-400">
                  Industrial, console minimal
                </div>
              </button>
              <button
                onClick={() => updateUserSettings({ preferredTheme: "system" })}
                disabled={!currentUser || !userSettings}
                className={`rb-glass rounded-xl border px-2 py-1.5 text-left ${
                  theme === "system"
                    ? "border-slate-500/80 ring-1 ring-slate-500/60"
                    : "border-slate-800/80"
                }`}
              >
                <div className="text-slate-100">System / auto</div>
                <div className="text-[0.7rem] text-slate-400">
                  Follow device or future policy
                </div>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-2 flex-1 min-h-0">
            <h2 className="text-[0.8rem] font-semibold text-slate-100 mb-1">
              Favorite apps (per user)
            </h2>
            <p className="text-[0.7rem] text-slate-400 mb-2">
              Mark apps as favorites. In future updates this can drive dock
              layout, quick launch rows and default projects.
            </p>
            <div className="border border-slate-800/80 rounded-xl bg-slate-950/95 max-h-40 overflow-auto">
              <ul className="divide-y divide-slate-800/80 text-[0.75rem]">
                {appChoices.map((app) => {
                  const selected = favoriteAppIds.includes(app.id);
                  return (
                    <li
                      key={app.id}
                      className="flex items-center justify-between px-2 py-1.5"
                    >
                      <span className="text-slate-100">{app.label}</span>
                      <button
                        onClick={() => toggleFavorite(app.id)}
                        disabled={!currentUser || !userSettings}
                        className={`px-2 py-0.5 rounded-full border text-[0.7rem] ${
                          selected
                            ? "border-emerald-500/80 text-emerald-200 bg-emerald-500/10"
                            : "border-slate-700/80 text-slate-300 hover:bg-slate-800/80"
                        }`}
                      >
                        {selected ? "Favorited" : "Favorite"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="text-[0.65rem] text-slate-500">
            All settings here are currently stored in local browser storage.
            When you add a backend, this data structure can sync to cloud
            storage or per-user accounts without changing the UI.
          </div>
        </section>
      </div>
    </div>
  );
}

export default SettingsApp;
