// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useRef, useState } from 'react';
import { useWindowStore } from '@redbyte/rb-windowing';
import { Icon, type IconName } from '@redbyte/rb-icons';

interface DockProps {
  onOpenApp: (id: string) => void;
}

const dockIcons: Array<{ id: string; label: string; iconId: IconName }> = [
  { id: 'launcher', label: 'Launcher', iconId: 'browser' },
  { id: 'start-here', label: 'Start Here', iconId: 'cpu' },
  { id: 'terminal', label: 'Terminal', iconId: 'terminal' },
  { id: 'files', label: 'Files', iconId: 'files' },
  { id: 'settings', label: 'Settings', iconId: 'settings' },
  { id: 'system-log', label: 'System Log', iconId: 'log' },
  { id: 'logic-playground', label: 'Logic Playground', iconId: 'logic' },
  { id: 'app-store', label: 'App Store', iconId: 'neon-wave' },
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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
      className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-end gap-2 rounded-2xl px-4 py-2 backdrop-blur-xl"
      title="Alt+Arrow keys to reorder (when focused)"
      onMouseLeave={() => setHoveredId(null)}
      style={{
        background: 'var(--rb-panel)',
        border: '1px solid var(--rb-border)',
        boxShadow: 'var(--rb-shadow-sm)',
      }}
    >
      {dockItems.map((dock, index) => {
        const iconName = dock.iconId;
        const isRunning = runningIds.includes(dock.id);
        const isHovered = hoveredId === dock.id;
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

        const scale = isHovered ? 1.06 : 1;

        return (
          <button
            key={dock.id}
            onClick={() => onOpenApp(dock.id)}
            onKeyDown={(event) => handleKeyDown(event, dock.id)}
            onMouseEnter={() => setHoveredId(dock.id)}
            ref={(el) => {
              buttonRefs.current[dock.id] = el;
            }}
            aria-label={ariaLabel}
            aria-keyshortcuts={ariaKeyShortcuts}
            title={title}
            style={{
              transform: `scale(${scale})`,
              transition: 'all 120ms var(--rb-easing-out, ease)',
              background: isRunning ? 'var(--rb-panel-2)' : 'var(--rb-panel)',
              border: isRunning ? '1px solid var(--rb-accent-strong)' : '1px solid var(--rb-border)',
              boxShadow: isRunning ? 'var(--rb-shadow-sm)' : 'none',
            }}
            className="relative h-12 w-12 rounded-xl flex items-center justify-center transition-colors duration-200"
            data-testid={`dock-icon-${dock.id}`}
          >
            <Icon
              name={iconName}
              size={24}
              style={{ color: isRunning ? 'var(--rb-accent)' : 'var(--rb-muted)' }}
              className="transition-colors duration-200"
              aria-label={`${dock.label} icon`}
            />
            {isRunning && (
              <span
                className="absolute -bottom-1.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full"
                style={{ background: 'var(--rb-accent)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
