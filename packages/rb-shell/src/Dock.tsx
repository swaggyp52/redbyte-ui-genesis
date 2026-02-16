// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useWindowStore } from '@redbyte/rb-windowing';
import { Icon, type IconName } from '@redbyte/rb-icons';

interface DockProps {
  onOpenApp: (id: string) => void;
}

const primaryIcons: Array<{ id: string; label: string; iconId: IconName }> = [
  { id: 'home', label: 'Dashboard', iconId: 'neon-wave' },
  { id: 'lab-workspace', label: 'Studio', iconId: 'cpu' },
  { id: 'logic-playground', label: 'Playground', iconId: 'logic' },
  { id: 'settings', label: 'Settings', iconId: 'settings' },
];

const secondaryIcons: Array<{ id: string; label: string; iconId: IconName }> = [
  { id: 'files', label: 'Files', iconId: 'files' },
];

const allIcons = [...primaryIcons, ...secondaryIcons];

const SETTINGS_SHORTCUT_HINT = 'Ctrl+, / Cmd+,';
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
  const pendingOpenRef = useRef<Set<string>>(new Set());

  const safeDebouncedOpenApp = useCallback((appId: string) => {
    // Prevent double-clicking from opening the app twice
    if (pendingOpenRef.current.has(appId)) return;
    
    pendingOpenRef.current.add(appId);
    onOpenApp(appId);
    
    // Clear the pending flag after a short delay to allow time for state updates
    setTimeout(() => {
      pendingOpenRef.current.delete(appId);
    }, 300);
  }, [onOpenApp]);

  const dockItems = useMemo(() => {
    const byId = new Map(allIcons.map((dock) => [dock.id, dock]));
    return normalizeDockOrder(dockOrder).map((id) => byId.get(id)!).filter(Boolean);
  }, [dockOrder]);

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

  const primaryIds = new Set(primaryIcons.map((item) => item.id));
  const primaryItems = dockItems.filter((item) => primaryIds.has(item.id));
  const secondaryItems = dockItems.filter((item) => !primaryIds.has(item.id));

  const renderIcon = (dock: typeof allIcons[number], compact = false) => {
    const isRunning = runningIds.includes(dock.id);
    const isHovered = hoveredId === dock.id;
    const tooltipText =
      dock.id === 'settings'
          ? `${dock.label} (${SETTINGS_SHORTCUT_HINT})`
          : dock.label;
    const ariaLabel = dock.label;
    const ariaKeyShortcuts =
      dock.id === 'settings'
          ? SETTINGS_ARIA_KEYSHORTCUTS
          : undefined;

    return (
      <button
        type="button"
        key={dock.id}
        onClick={() => safeDebouncedOpenApp(dock.id)}
        onKeyDown={(event) => handleKeyDown(event, dock.id)}
        onMouseEnter={() => setHoveredId(dock.id)}
        onMouseLeave={() => setHoveredId(null)}
        ref={(el) => { buttonRefs.current[dock.id] = el; }}
        aria-label={ariaLabel}
        aria-keyshortcuts={ariaKeyShortcuts}
        className={`relative flex items-center justify-center group ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}
        style={{
          transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
          transition: 'all var(--rb-ui-motion-fast, 120ms) var(--rb-ui-ease-out)',
          background: isHovered ? 'var(--rb-ui-surface-3)' : 'transparent',
          borderRadius: 'var(--rb-ui-radius-md, 8px)',
          opacity: isRunning || isHovered ? 1 : 0.7,
        }}
        data-testid={`dock-icon-${dock.id}`}
      >
        {/* Instant tooltip - appears on hover */}
        {isHovered && (
          <span
            className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap pointer-events-none z-50"
            style={{
              background: 'var(--rb-ui-surface-3)',
              color: 'var(--rb-ui-text)',
              border: '1px solid var(--rb-ui-border)',
              boxShadow: 'var(--rb-ui-shadow-2)',
            }}
          >
            {tooltipText}
          </span>
        )}
        {/* Running indicator — left edge dot */}
        {isRunning && (
          <span
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: '-2px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'var(--rb-ui-accent)',
              transform: 'translateY(-50%) scale(1)',
              transition: 'transform var(--rb-ui-motion-fast, 120ms) var(--rb-ui-ease-out)',
            }}
          />
        )}
        <Icon
          name={dock.iconId}
          size={18}
          style={{ color: isRunning ? 'var(--rb-ui-accent)' : 'var(--rb-ui-text-2)' }}
          className="transition-colors"
          aria-label={`${dock.label} icon`}
        />
      </button>
    );
  };

  return (
    <nav
      aria-label="Application Dock"
      className="fixed left-0 top-8 bottom-0 z-40 flex flex-col items-center py-2 border-r rb-blur-surface"
      title="Alt+Arrow keys to reorder (when focused)"
      style={{
        width: '52px',
        background: 'color-mix(in srgb, var(--rb-ui-surface-1) 85%, transparent)',
        backdropFilter: 'blur(var(--rb-blur-strength, 16px)) saturate(1.4)',
        WebkitBackdropFilter: 'blur(var(--rb-blur-strength, 16px)) saturate(1.4)',
        borderColor: 'var(--rb-ui-border)',
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        {primaryItems.map((item) => renderIcon(item))}
      </div>

      <div
        className="w-6 my-2"
        style={{ height: '1px', background: 'var(--rb-ui-border-strong)' }}
      />

      <div className="flex flex-col items-center gap-1 flex-1">
        {secondaryItems.map((item) => renderIcon(item, true))}
      </div>
    </nav>
  );
});
Dock.displayName = 'Dock';
