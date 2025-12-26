// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useRef, useState } from 'react';
import { useWindowStore } from '@redbyte/rb-windowing';
import { BrowserIcon, TerminalIcon, FilesIcon, SettingsIcon, LogicIcon, NeonWaveIcon } from '@redbyte/rb-icons';

interface DockProps {
  onOpenApp: (id: string) => void;
}

const dockIcons = [
  { id: 'launcher', label: 'Launcher', component: BrowserIcon },
  { id: 'terminal', label: 'Terminal', component: TerminalIcon },
  { id: 'files', label: 'Files', component: FilesIcon },
  { id: 'settings', label: 'Settings', component: SettingsIcon },
  { id: 'logic-playground', label: 'Logic Playground', component: LogicIcon },
  { id: 'app-store', label: 'App Store', component: NeonWaveIcon },
];

const LAUNCHER_SHORTCUT_HINT = 'Ctrl+K / Cmd+K';
const SETTINGS_SHORTCUT_HINT = 'Ctrl+, / Cmd+,';
const LAUNCHER_ARIA_KEYSHORTCUTS = 'Control+K Meta+K';
const SETTINGS_ARIA_KEYSHORTCUTS = 'Control+, Meta+,';
const DOCK_ORDER_STORAGE_KEY = 'rb.shell.dockOrder';
const LEGACY_DOCK_ORDER_STORAGE_KEY = 'rb:shell:dockOrder';

const DEFAULT_DOCK_IDS = dockIcons.map((dock) => dock.id);

const normalizeDockOrder = (order: string[]) => {
  const seen = new Set<string>();
  const base = order.filter((id) => DEFAULT_DOCK_IDS.includes(id) && !seen.has(id) && seen.add(id));

  DEFAULT_DOCK_IDS.forEach((id) => {
    if (!seen.has(id)) {
      base.push(id);
      seen.add(id);
    }
  });

  return base;
};

const loadDockOrder = () => {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_DOCK_IDS;
  }

  const raw = localStorage.getItem(DOCK_ORDER_STORAGE_KEY) ?? localStorage.getItem(LEGACY_DOCK_ORDER_STORAGE_KEY);
  if (!raw) return DEFAULT_DOCK_IDS;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (localStorage.getItem(LEGACY_DOCK_ORDER_STORAGE_KEY) && !localStorage.getItem(DOCK_ORDER_STORAGE_KEY)) {
        localStorage.setItem(DOCK_ORDER_STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_DOCK_ORDER_STORAGE_KEY);
      }
      return normalizeDockOrder(parsed.filter((id): id is string => typeof id === 'string'));
    }
  } catch (err) {
    console.warn('Failed to parse dock order from storage', err);
  }

  return DEFAULT_DOCK_IDS;
};

const persistDockOrder = (order: string[]) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DOCK_ORDER_STORAGE_KEY, JSON.stringify(order));
};

export const Dock: React.FC<DockProps> = ({ onOpenApp }) => {
  const windows = useWindowStore((s) => s.windows);
  const [dockOrder, setDockOrder] = useState<string[]>(() => loadDockOrder());
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const dockItems = useMemo(() => {
    const byId = new Map(dockIcons.map((dock) => [dock.id, dock]));
    return normalizeDockOrder(dockOrder).map((id) => byId.get(id)!).filter(Boolean);
  }, [dockOrder]);

  const moveDockItem = (id: string, delta: number) => {
    setDockOrder((prev) => {
      const base = normalizeDockOrder(prev);
      const index = base.indexOf(id);
      const target = index + delta;

      if (index === -1 || target < 0 || target >= base.length) {
        return base;
      }

      const next = [...base];
      [next[index], next[target]] = [next[target], next[index]];

      persistDockOrder(next);
      requestAnimationFrame(() => buttonRefs.current[id]?.focus());

      return next;
    });
  };
  const runningIds = useMemo(
    () => windows.filter((w) => w.mode !== 'minimized').map((w) => w.contentId),
    [windows]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveDockItem(id, -1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveDockItem(id, 1);
    }
  };

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-slate-900/90 px-3 py-2.5 backdrop-blur-xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/10"
      title="Alt+Arrow keys to reorder (when focused)"
    >
      {dockItems.map((dock) => {
        const Icon = dock.component;
        const isRunning = runningIds.includes(dock.id);
        const title =
          dock.id === 'launcher'
            ? `${dock.label} (${LAUNCHER_SHORTCUT_HINT}) — Type to search — ${SETTINGS_SHORTCUT_HINT} for Settings`
            : dock.label;
        const ariaLabel = dock.id === 'launcher' ? `Launcher (${LAUNCHER_SHORTCUT_HINT})` : dock.label;
        const ariaKeyShortcuts =
          dock.id === 'launcher'
            ? LAUNCHER_ARIA_KEYSHORTCUTS
            : dock.id === 'settings'
              ? SETTINGS_ARIA_KEYSHORTCUTS
              : undefined;
        return (
          <button
            key={dock.id}
            onClick={() => onOpenApp(dock.id)}
            onKeyDown={(event) => handleKeyDown(event, dock.id)}
            ref={(el) => {
              buttonRefs.current[dock.id] = el;
            }}
            aria-label={ariaLabel}
            aria-keyshortcuts={ariaKeyShortcuts}
            title={title}
            className={`relative h-14 w-14 rounded-xl flex items-center justify-center transition-all ${
              isRunning
                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30'
                : 'bg-slate-800/50 hover:bg-slate-700/50 border border-transparent'
            }`}
          >
            <Icon width={28} height={28} className={isRunning ? 'text-cyan-300' : 'text-slate-300'} />
            {isRunning && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />}
          </button>
        );
      })}
    </div>
  );
};
