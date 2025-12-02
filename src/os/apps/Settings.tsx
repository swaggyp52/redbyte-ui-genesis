import React from "react";
import { themes } from "../../theme";
import { useTheme } from "../../theme/ThemeProvider";

export const SettingsApp: React.FC = () => {
  const { themeId, setThemeId } = useTheme();

  return (
    <div className="text-xs text-slate-200 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-50">Settings</p>
        <p className="text-slate-400">
          Appearance and workspace preferences for RedByte OS.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold">Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setThemeId(t.id)}
              className={`rb-glass rounded-xl px-3 py-2 border text-left transition ${
                themeId === t.id
                  ? "border-pink-500/80 shadow-md"
                  : "border-slate-800/80 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="text-[11px] font-semibold">{t.name}</div>
              <div className="mt-1 flex gap-1 items-center">
                <span className={`h-4 w-6 rounded-md ${t.accentSoft}`} />
                <span className="h-4 flex-1 rounded-md border border-dashed border-slate-600/70" />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold">Shortcuts</p>
        <ul className="text-[10px] text-slate-400 space-y-0.5">
          <li>⌘K — Command palette</li>
          <li>⌘← / ⌘→ / ⌘↑ / ⌘↓ — Tile active window</li>
          <li>⌘F — Fullscreen active window</li>
        </ul>
      </div>
    </div>
  );
};



















