// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useRef, useState } from 'react';
import { useWindowStore } from '@redbyte/rb-windowing';
import { Icon, type IconName } from '@redbyte/rb-icons';

interface DockProps {
  onOpenApp: (id: string) => void;
}

const systemIcons: Array<{ id: string; label: string; iconId: IconName }> = [
  { id: 'launcher', label: 'Launcher', iconId: 'browser' },
  { id: 'files', label: 'Files', iconId: 'files' },
  { id: 'settings', label: 'Settings', iconId: 'settings' },
];

const appIcons: Array<{ id: string; label: string; iconId: IconName }> = [
  { id: 'logic-playground', label: 'Logic Playground', iconId: 'logic' },
  { id: 'start-here', label: 'Start Here', iconId: 'cpu' },
  { id: 'terminal', label: 'Terminal', iconId: 'terminal' },
  { id: 'system-log', label: 'System Log', iconId: 'log' },
];

const allIcons = [...systemIcons, ...appIcons];

const LAUNCHER_SHORTCUT_HINT = 'Ctrl+K / Cmd+K';
const SETTINGS_SHORTCUT_HINT = 'Ctrl+, / Cmd+,';
const LAUNCHER_ARIA_KEYSHORTCUTS = 'Control+K Meta+K';
const SETTINGS_ARIA_KEYSHORTCUTS = 'Control+, Meta+,';
const DOCK_ORDER_STORAGE_KEY = 'rb.shell.dockOrder';

const DEFAULT_DOCK_IDS = allIcons.map((dock) => dock.id);

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
  if (typeof localStorage === 'undefined') return DEFAULT_DOCK_IDS;
  const raw = localStorage.getItem(DOCK_ORDER_STORAGE_KEY);
  if (!raw) return DEFAULT_DOCK_IDS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeDockOrder(parsed.filter((id): id is string => typeof id === 'string'));
    }
  } catch {}
  return DEFAULT_DOCK_IDS;
};

const persistDockOrder = (order: string[]) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DOCK_ORDER_STORAGE_KEY, JSON.stringify(order));
};

export const Dock: React.FC<DockProps> = React.memo(({ onOpenApp }) => {
  const windows = useWindowStore((s) => s.windows);
  const [dockOrder, setDockOrder] = useState<string[]>(() => loadDockOrder());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const dockItems = useMemo(() => {
    const byId = new Map(allIcons.map((dock) => [dock.id, dock]));
    return normalizeDockOrder(dockOrder).map((id) => byId.get(id)!).filter(Boolean);
  }, [dockOrder]);

  const systemIds = new Set(systemIcons.map((s) => s.id));

  const moveDockItem = (id: string, delta: number) => {
    setDockOrder((prev) => {
      const base = normalizeDockOrder(prev);
      const index = base.indexOf(id);
      const target = index + delta;
      if (index === -1 || target < 0 || target >= base.length) return base;
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
    if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveDockItem(id, -1);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveDockItem(id, 1);
    }
  };

  // Split items into system and app sections
  const systemItems = dockItems.filter((d) => systemIds.has(d.id));
  const appItems = dockItems.filter((d) => !systemIds.has(d.id));

  const renderIcon = (dock: typeof allIcons[number]) => {
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

    return (
      <button
        type="button"
        key={dock.id}
        onClick={() => onOpenApp(dock.id)}
        onKeyDown={(event) => handleKeyDown(event, dock.id)}
        onMouseEnter={() => setHoveredId(dock.id)}
        onMouseLeave={() => setHoveredId(null)}
        ref={(el) => { buttonRefs.current[dock.id] = el; }}
        aria-label={ariaLabel}
        aria-keyshortcuts={ariaKeyShortcuts}
        title={title}
        className="relative h-10 w-10 rounded-lg flex items-center justify-center transition-all"
        style={{
          transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
          transition: `all ${isHovered ? '120ms' : '80ms'} var(--rb-easing-out)`,
          background: isHovered ? 'var(--rb-surface-3)' : 'transparent',
        }}
        data-testid={`dock-icon-${dock.id}`}
      >
        {/* Running indicator — left edge bar */}
        {isRunning && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
            style={{ background: 'var(--rb-accent)' }}
          />
        )}
        <Icon
          name={dock.iconId}
          size={18}
          style={{ color: isRunning ? 'var(--rb-accent)' : 'var(--rb-text-2)' }}
          className="transition-colors"
          aria-label={`${dock.label} icon`}
        />
      </button>
    );
  };

  return (
    <nav
      aria-label="Application Dock"
      className="fixed left-0 top-8 bottom-0 z-40 flex flex-col items-center py-2 border-r"
      title="Alt+Arrow keys to reorder (when focused)"
      style={{
        width: '52px',
        background: 'var(--rb-surface-1)',
        borderColor: 'var(--rb-border)',
      }}
    >
      {/* System icons */}
      <div className="flex flex-col items-center gap-0.5">
        {systemItems.map(renderIcon)}
      </div>

      {/* Separator */}
      <div
        className="w-6 my-2"
        style={{ height: '1px', background: 'var(--rb-border-strong)' }}
      />

      {/* App icons */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        {appItems.map(renderIcon)}
      </div>
    </nav>
  );
});
Dock.displayName = 'Dock';
