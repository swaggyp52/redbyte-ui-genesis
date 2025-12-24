// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Desktop } from './Desktop';
import { Dock } from './Dock';
import { ShellWindow } from './ShellWindow';
import { applyTheme } from '@redbyte/rb-theme';
import { useSettingsStore } from '@redbyte/rb-utils';
import {
  getApp,
  type RedByteApp,
  useFileSystemStore,
  useFileAssociationsStore,
  getFileActionTargets,
  isFileActionEligible,
  resolveDefaultTarget,
  OpenWithModal,
  type FileActionTarget,
} from '@redbyte/rb-apps';
import { useWindowStore, loadSession, resolveTargetWindowId } from '@redbyte/rb-windowing';
import { useWorkspaceStore, loadWorkspaces } from './workspaceStore';
import { executeMacro, type MacroExecutionContext } from './macros/executeMacro';
import { useMacroStore } from './macros/macroStore';
import BootScreen from './BootScreen';
import { ToastContainer } from './ToastContainer';
import { CommandPalette, type Command } from './CommandPalette';
import { SystemSearch } from './SystemSearch';
import { WorkspaceSwitcher, MacroRunner, WindowSwitcher } from './modals';
import type { Intent } from './intent-types';
import { getVersionString } from './version';
import './styles.css';

export interface ShellProps {
  children?: React.ReactNode;
}

interface WindowAppBinding {
  appId: string;
  props?: any;
}

interface OpenWithModalState {
  resourceId: string;
  resourceType: 'file' | 'folder';
  resourceName: string;
  extension: string;
  eligibleTargets: FileActionTarget[];
}

export const Shell: React.FC<ShellProps> = () => {
  const [booted, setBooted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('rb:shell:booted') === '1';
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [systemSearchOpen, setSystemSearchOpen] = useState(false);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [macroRunnerOpen, setMacroRunnerOpen] = useState(false);
  const [windowSwitcherOpen, setWindowSwitcherOpen] = useState(false);
  const [windowSwitcherPreviousFocus, setWindowSwitcherPreviousFocus] = useState<string | null>(null);
  const [openWithModalState, setOpenWithModalState] = useState<OpenWithModalState | null>(null);

  const hasShownWelcomeRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const windowsRaw = useWindowStore((s) => s.windows);
  const windows = useMemo(() => {
    return [...windowsRaw].sort((a, b) => a.zIndex - b.zIndex);
  }, [windowsRaw]);
  const runningAppIds = useMemo(() => {
    const ids = windows.filter((w) => w.mode !== 'minimized').map((w) => w.contentId);
    return Array.from(new Set(ids));
  }, [windows]);
  const createWindow = useWindowStore((s) => s.createWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const snapWindow = useWindowStore((s) => s.snapWindow);
  const centerWindow = useWindowStore((s) => s.centerWindow);
  const restoreSession = useWindowStore((s) => s.restoreSession);

  const [bindings, setBindings] = useState<Record<string, WindowAppBinding>>({});
  const [recentAppIds, setRecentAppIds] = useState<string[]>([]);
  const [pinnedAppIds, setPinnedAppIds] = useState<string[]>(() => {
    if (typeof localStorage === 'undefined') return [];

    try {
      const raw = localStorage.getItem('rb:shell:pinnedApps');
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string');
      }
    } catch {}

    return [];
  });
  const settings = useSettingsStore();
  const hasSettings = useMemo(() => Boolean(getApp('settings')), []);

  const recordRecentApp = useCallback((appId: string) => {
    if (appId === 'launcher') return;

    setRecentAppIds((prev) => {
      const next = [appId, ...prev.filter((id) => id !== appId)];
      return next.slice(0, 5);
    });
  }, []);

  const togglePinnedAppId = useCallback((appId: string) => {
    if (appId === 'launcher') return;

    setPinnedAppIds((prev) => {
      const exists = prev.includes(appId);
      const next = exists ? prev.filter((id) => id !== appId) : [appId, ...prev];

      try {
        localStorage.setItem('rb:shell:pinnedApps', JSON.stringify(next));
      } catch {}

      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyTheme(document.documentElement, settings.themeVariant);
    }
  }, [settings.themeVariant]);

  // Workspace/Session restore on mount
  useEffect(() => {
    if (!booted) return;

    // Check for active workspace first
    const workspaceData = loadWorkspaces();
    let snapshot = null;

    if (workspaceData?.activeWorkspaceId) {
      const workspace = workspaceData.workspaces.find((w) => w.id === workspaceData.activeWorkspaceId);
      if (workspace) {
        snapshot = workspace.snapshot;
      }
    }

    // Fall back to session restore if no active workspace
    if (!snapshot) {
      const session = loadSession();
      if (session) {
        snapshot = session;
      }
    }

    if (!snapshot) return;

    // Filter out unknown apps and Launcher
    const validWindows = snapshot.windows.filter((w) => {
      if (w.contentId === 'launcher') return false;
      const app = getApp(w.contentId);
      return Boolean(app);
    });

    if (validWindows.length === 0) return;

    // Restore session to store
    restoreSession(validWindows, snapshot.nextZIndex);

    // Bind all restored windows
    const newBindings: Record<string, WindowAppBinding> = {};
    validWindows.forEach((w) => {
      newBindings[w.id] = { appId: w.contentId };
    });
    setBindings(newBindings);
  }, [booted, restoreSession]);

  const openWindow = useCallback(
    (appId: string, props?: any) => {
      const app = getApp(appId);
      if (!app) return null;

      recordRecentApp(appId);

      if (app.manifest.singleton) {
        const existing = windows.find((w) => w.contentId === appId);
        if (existing) {
          if (existing.mode === 'minimized') {
            restoreWindow(existing.id);
          }
          focusWindow(existing.id);
          setBindings((prev) => ({ ...prev, [existing.id]: { appId, props } }));
          return existing.id;
        }
      }

      const state = createWindow({
        title: app.manifest.name,
        width: app.manifest.defaultSize?.width,
        height: app.manifest.defaultSize?.height,
        contentId: app.manifest.id,
      });

      setBindings((prev) => ({ ...prev, [state.id]: { appId, props } }));
      return state.id;
    },
    [createWindow, focusWindow, recordRecentApp, windows, restoreWindow]
  );

  const dispatchIntent = useCallback(
    (intent: Intent) => {
      switch (intent.type) {
        case 'open-with': {
          const { targetAppId, resourceId, resourceType } = intent.payload;
          const preferNewWindow = intent.routingHint?.preferNewWindow ?? false;

          // PHASE_AC: Use routing resolver to determine reuse vs create
          const targetWindowId = resolveTargetWindowId(targetAppId, preferNewWindow, windows);

          if (targetWindowId) {
            // Reuse existing window
            const binding = bindings[targetWindowId];
            if (binding) {
              // Update props with new resource
              setBindings((prev) => ({
                ...prev,
                [targetWindowId]: { ...binding, props: { resourceId, resourceType } },
              }));
              focusWindow(targetWindowId);
              return targetWindowId;
            }
          }

          // Create new window (no existing window found or preferNewWindow=true)
          return openWindow(targetAppId, { resourceId, resourceType });
        }
        default:
          console.warn('Unknown intent type:', (intent as any).type);
          return null;
      }
    },
    [openWindow, windows, bindings, focusWindow]
  );

  const switchWorkspaceById = useCallback(
    (workspaceId: string): boolean => {
      const snapshot = useWorkspaceStore.getState().switchWorkspace(workspaceId);
      if (!snapshot) return false;

      // Close all current windows
      const currentWindows = useWindowStore.getState().windows;
      currentWindows.forEach((w) => {
        closeWindow(w.id);
        setBindings((prev) => {
          const next = { ...prev };
          delete next[w.id];
          return next;
        });
      });

      // Restore workspace snapshot
      const validWindows = snapshot.windows.filter((w) => {
        if (w.contentId === 'launcher') return false;
        const app = getApp(w.contentId);
        return Boolean(app);
      });

      restoreSession(validWindows, snapshot.nextZIndex);

      const newBindings: Record<string, WindowAppBinding> = {};
      validWindows.forEach((w) => {
        newBindings[w.id] = { appId: w.contentId };
      });
      setBindings(newBindings);

      return true;
    },
    [closeWindow, restoreSession]
  );

  const handleClose = useCallback(
    (id: string) => {
      closeWindow(id);
      setBindings((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [closeWindow]
  );

  // Ref to hold latest executeCommand for macro execution
  const executeCommandRef = useRef<((command: Command) => void) | null>(null);

  const executeCommand = useCallback(
    (command: Command) => {
      switch (command) {
        case 'focus-next-window': {
          const activeWindows = useWindowStore.getState().getActiveWindows();
          if (activeWindows.length < 2) return;

          const sortedByZ = [...activeWindows].sort((a, b) => b.zIndex - a.zIndex);
          const focusedIndex = sortedByZ.findIndex((w) => w.focused);

          if (focusedIndex === -1) {
            focusWindow(sortedByZ[0].id);
          } else {
            const nextIndex = (focusedIndex + 1) % sortedByZ.length;
            focusWindow(sortedByZ[nextIndex].id);
          }
          break;
        }

        case 'close-focused-window': {
          const focused = useWindowStore.getState().getFocusedWindow();
          if (focused) {
            handleClose(focused.id);
          }
          break;
        }

        case 'minimize-focused-window': {
          const focused = useWindowStore.getState().getFocusedWindow();
          if (focused && focused.minimizable) {
            toggleMinimize(focused.id);
          }
          break;
        }

        case 'snap-left':
        case 'snap-right':
        case 'snap-top':
        case 'snap-bottom': {
          const focused = useWindowStore.getState().getFocusedWindow();
          if (!focused) return;

          const desktopBounds = {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };

          const direction = command.replace('snap-', '') as 'left' | 'right' | 'top' | 'bottom';
          snapWindow(focused.id, direction, desktopBounds);
          break;
        }

        case 'center-window': {
          const focused = useWindowStore.getState().getFocusedWindow();
          if (!focused) return;

          const desktopBounds = {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };

          centerWindow(focused.id, desktopBounds);
          break;
        }

        case 'create-workspace': {
          const name = window.prompt('Workspace name:');
          if (!name) return;

          const currentWindows = useWindowStore.getState().windows;
          const nextZIndex = useWindowStore.getState().nextZIndex;

          const snapshot = {
            windows: currentWindows,
            nextZIndex,
          };

          useWorkspaceStore.getState().createWorkspace(name, snapshot);
          break;
        }

        case 'switch-workspace': {
          setWorkspaceSwitcherOpen(true);
          break;
        }

        case 'delete-workspace': {
          const workspaces = useWorkspaceStore.getState().listWorkspaces();
          if (workspaces.length === 0) {
            alert('No workspaces to delete');
            return;
          }

          const names = workspaces.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
          const input = window.prompt(`Delete workspace:\n\n${names}\n\nEnter number:`);
          if (!input) return;

          const index = parseInt(input, 10) - 1;
          if (isNaN(index) || index < 0 || index >= workspaces.length) {
            alert('Invalid selection');
            return;
          }

          const selectedWorkspace = workspaces[index];
          useWorkspaceStore.getState().deleteWorkspace(selectedWorkspace.id);
          break;
        }

        case 'run-macro': {
          setMacroRunnerOpen(true);
          break;
        }
      }
    },
    [focusWindow, handleClose, toggleMinimize, snapWindow, centerWindow, restoreSession, setBindings]
  );

  // Store ref for macro execution to avoid circular dependency
  executeCommandRef.current = executeCommand;

  const executeMacroById = useCallback(
    (macroId: string): void => {
      const context: MacroExecutionContext = {
        executeCommand: (command) => executeCommandRef.current?.(command),
        openWindow: (appId, props) => openWindow(appId, props),
        dispatchIntent: (intent) => dispatchIntent(intent),
        switchWorkspace: (workspaceId) => switchWorkspaceById(workspaceId),
        getApp: (appId) => getApp(appId),
      };

      const result = executeMacro(macroId, context);

      if (!result.success) {
        alert(`Macro failed at step ${result.stepIndex + 1}: ${result.error}`);
      }
    },
    [openWindow, dispatchIntent, switchWorkspaceById]
  );

  const handleWorkspaceSelect = useCallback(
    (workspaceId: string) => {
      switchWorkspaceById(workspaceId);
    },
    [switchWorkspaceById]
  );

  const handleMacroExecute = useCallback(
    (macroId: string) => {
      executeMacroById(macroId);
    },
    [executeMacroById]
  );

  const handleWindowSwitcherSelect = useCallback(
    (windowId: string) => {
      const window = windows.find((w) => w.id === windowId);
      if (!window) return;

      // If minimized, restore first
      if (window.mode === 'minimized') {
        restoreWindow(windowId);
      }

      // Focus the window
      focusWindow(windowId);

      // Close switcher
      setWindowSwitcherOpen(false);
      setWindowSwitcherPreviousFocus(null);
    },
    [windows, restoreWindow, focusWindow]
  );

  const handleWindowSwitcherCancel = useCallback(() => {
    // Restore focus to previous window if valid
    if (windowSwitcherPreviousFocus) {
      const previousWindow = windows.find((w) => w.id === windowSwitcherPreviousFocus);
      if (previousWindow) {
        focusWindow(windowSwitcherPreviousFocus);
      }
    }

    // Close switcher
    setWindowSwitcherOpen(false);
    setWindowSwitcherPreviousFocus(null);
  }, [windowSwitcherPreviousFocus, windows, focusWindow]);

  const handleSearchExecuteIntent = useCallback(
    (intentId: string) => {
      if (intentId === 'open-in-playground') {
        console.log('Intent target clicked: open-in-playground (no active file context)');
      }
    },
    []
  );

  const handleSearchExecuteFile = useCallback(
    (fileId: string, shiftKey: boolean) => {
      // Get the file entry from filesystem store
      const allFiles = useFileSystemStore.getState().getAllFiles();
      const file = allFiles.find((f) => f.id === fileId);

      if (!file) {
        console.warn(`File not found: ${fileId}`);
        return;
      }

      // Check if file is eligible for file actions
      if (!isFileActionEligible(file)) {
        console.warn(`File not eligible for actions: ${file.name}`);
        return;
      }

      // Get eligible targets
      const eligibleTargets = getFileActionTargets(file);
      if (eligibleTargets.length === 0) {
        console.warn(`No eligible targets for file: ${file.name}`);
        return;
      }

      // Extract extension
      const extension = file.name.includes('.')
        ? file.name.split('.').pop() || ''
        : '';

      if (shiftKey) {
        // Shift+Enter: Open With modal
        setOpenWithModalState({
          resourceId: file.id,
          resourceType: file.type,
          resourceName: file.name,
          extension,
          eligibleTargets,
        });
      } else {
        // Enter: Default open using PHASE_AA associations + PHASE_AC routing
        const targetId = resolveDefaultTarget(file.type, extension, eligibleTargets);
        const target = eligibleTargets.find((t) => t.id === targetId);

        if (target) {
          // Dispatch open-with intent with default target
          dispatchIntent({
            type: 'open-with',
            payload: {
              sourceAppId: 'system-search',
              targetAppId: target.appId,
              resourceId: file.id,
              resourceType: file.type,
            },
          });
        }
      }
    },
    [openWindow, dispatchIntent]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option' || target?.isContentEditable;

      // Ctrl+Tab: Window Switcher (check before other ctrl checks)
      if ((event.ctrlKey || event.metaKey) && event.key === 'Tab' && !isEditable) {
        event.preventDefault();
        const focused = useWindowStore.getState().getFocusedWindow();
        setWindowSwitcherPreviousFocus(focused?.id || null);
        setWindowSwitcherOpen(true);
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;
      if (isEditable) return;

      // Cmd/Ctrl+Space: Open System Search
      if (event.key === ' ') {
        event.preventDefault();
        setSystemSearchOpen(true);
        return;
      }

      // Cmd/Ctrl+Shift+P: Open Command Palette
      if (event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Cmd/Ctrl+K: Open Launcher
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openWindow('launcher');
        return;
      }

      // Cmd/Ctrl+,: Open Settings
      if (!event.altKey && !event.shiftKey && event.key === ',' && hasSettings) {
        event.preventDefault();
        openWindow('settings');
        return;
      }

      // Cmd/Ctrl+`: Window cycling
      if (event.key === '`') {
        event.preventDefault();
        executeCommand('focus-next-window');
        return;
      }

      // Cmd/Ctrl+W: Close focused window
      if (event.key.toLowerCase() === 'w') {
        event.preventDefault();
        executeCommand('close-focused-window');
        return;
      }

      // Cmd/Ctrl+M: Minimize focused window
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        executeCommand('minimize-focused-window');
        return;
      }

      // Cmd/Ctrl+Alt+Arrow: Window snap
      if (event.altKey) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          executeCommand('snap-left');
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          executeCommand('snap-right');
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          executeCommand('snap-top');
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          executeCommand('snap-bottom');
          return;
        }
        if (event.key.toLowerCase() === 'c') {
          event.preventDefault();
          executeCommand('center-window');
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasSettings, openWindow, executeCommand]);

  useEffect(() => {
    if (!booted || hasInitializedRef.current) return;

    hasInitializedRef.current = true;

    try {
      localStorage.setItem('rb:shell:booted', '1');
    } catch {}

    if (!hasShownWelcomeRef.current) {
      hasShownWelcomeRef.current = true;

      const welcomeSeen = localStorage.getItem('rb-os:v1:welcomeSeen');

      if (welcomeSeen !== 'true') {
        const timer = setTimeout(() => openWindow('welcome'), 500);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  return (
    <div data-testid="shell-container" className="shell-container relative w-screen h-screen overflow-hidden bg-black text-white">
      <Desktop
        onOpenApp={openWindow}
        wallpaperId={settings.wallpaperId}
        themeVariant={settings.themeVariant}
      />

      <Dock onOpenApp={openWindow} />

      {windows.map((window) => {
        const binding = bindings[window.id];
        const app: RedByteApp | null = binding ? getApp(binding.appId) : getApp(window.contentId);
        if (!app) return null;
        const Component = app.component;

        return (
          <ShellWindow
            key={window.id}
            state={window}
            minSize={app.manifest.minSize}
            onClose={() => handleClose(window.id)}
            onFocus={() => focusWindow(window.id)}
            onMove={(x, y) => moveWindow(window.id, x, y)}
            onResize={(w, h) => resizeWindow(window.id, w, h)}
            onMinimize={() => toggleMinimize(window.id)}
            onMaximize={() => toggleMaximize(window.id)}
            onRestore={() => restoreWindow(window.id)}
          >
            <Component
              windowId={window.id}
              onOpenApp={openWindow}
              onClose={() => handleClose(window.id)}
              onDispatchIntent={dispatchIntent}
              recentAppIds={app.manifest.id === 'launcher' ? recentAppIds : undefined}
              pinnedAppIds={app.manifest.id === 'launcher' ? pinnedAppIds : undefined}
              runningAppIds={app.manifest.id === 'launcher' ? runningAppIds : undefined}
              onTogglePin={app.manifest.id === 'launcher' ? togglePinnedAppId : undefined}
              {...binding?.props}
            />
          </ShellWindow>
        );
      })}

      <ToastContainer />

      {systemSearchOpen && (
        <SystemSearch
          onExecuteApp={openWindow}
          onExecuteCommand={executeCommand}
          onExecuteIntent={handleSearchExecuteIntent}
          onExecuteMacro={executeMacroById}
          onExecuteFile={handleSearchExecuteFile}
          onClose={() => setSystemSearchOpen(false)}
        />
      )}

      {commandPaletteOpen && (
        <CommandPalette
          onExecute={executeCommand}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}

      {workspaceSwitcherOpen && (
        <WorkspaceSwitcher
          workspaces={useWorkspaceStore.getState().listWorkspaces()}
          currentWorkspaceId={useWorkspaceStore.getState().activeWorkspaceId || undefined}
          onSelect={handleWorkspaceSelect}
          onClose={() => setWorkspaceSwitcherOpen(false)}
        />
      )}

      {macroRunnerOpen && (
        <MacroRunner
          macros={useMacroStore.getState().listMacros()}
          onExecute={handleMacroExecute}
          onClose={() => setMacroRunnerOpen(false)}
        />
      )}

      {windowSwitcherOpen && (
        <WindowSwitcher
          windows={windows}
          onSelect={handleWindowSwitcherSelect}
          onCancel={handleWindowSwitcherCancel}
        />
      )}

      {openWithModalState && (
        <OpenWithModal
          targets={openWithModalState.eligibleTargets}
          resourceType={openWithModalState.resourceType}
          extension={openWithModalState.extension}
          onSelect={(target, preferNewWindow) => {
            // Dispatch open-with intent with selected target
            dispatchIntent({
              type: 'open-with',
              payload: {
                sourceAppId: 'system-search',
                targetAppId: target.appId,
                resourceId: openWithModalState.resourceId,
                resourceType: openWithModalState.resourceType,
              },
              routingHint: preferNewWindow ? { preferNewWindow } : undefined,
            });
            setOpenWithModalState(null);
          }}
          onCancel={() => setOpenWithModalState(null)}
        />
      )}

      {/* Footer: Preview Badge + Version */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs z-10">
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-amber-900/30 border border-amber-600/50 rounded text-amber-400 font-semibold">
            PREVIEW
          </span>
          <span className="text-slate-400">
            {getVersionString()}
          </span>
        </div>
        <div className="text-slate-500">
          RedByte OS Genesis
        </div>
      </div>
    </div>
  );
};
