// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useState, useRef, useMemo, type ErrorInfo } from 'react';
import { Desktop } from './Desktop';
import { Dock } from './Dock';
import { ShellWindow } from './ShellWindow';
import { applyTheme } from '@redbyte/rb-theme';
import { isPerfDebugEnabled, startPerfSummaryLogger, startUiTickSampler, useSettingsStore } from '@redbyte/rb-utils';
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
  useSystemLogStore,
  logSystemEvent,
  EmptyState,
} from '@redbyte/rb-apps';
import { useWindowStore, loadSession, resolveTargetWindowId } from '@redbyte/rb-windowing';
import { useWorkspaceStore, loadWorkspaces } from './workspaceStore';
import { executeMacro, type MacroExecutionContext } from './macros/executeMacro';
import { useMacroStore } from './macros/macroStore';
import BootScreen from './BootScreen';
import { ToastContainer, toast } from '@redbyte/rb-primitives';
import { CommandPalette, type Command } from './CommandPalette';
import { SystemSearch } from './SystemSearch';
import { WorkspaceSwitcher, MacroRunner, WindowSwitcher } from './modals';
import { NarrativeOverlay } from './narrative/NarrativeOverlay';
import type { Intent } from './intent-types';
import { getVersionString } from './version';
import './styles.css';
import { PerfHud } from './debug/PerfHud';
import { HitTestDebugHUD } from './debug/HitTestDebugHUD';
import { RenderStormMonitor } from './debug/RenderStormMonitor';
import { DeadZoneScanner } from './debug/DeadZoneScanner';
import { OverlayDebugHUD } from './debug/OverlayDebugHUD';

// Determinism imports (core to RedByte, not dev-only)
import { DeterminismPanel, useDeterminismRecorder } from './dev';
import { TruthBar, type DeterminismMode } from './TruthBar';
import { OnboardingModal } from './OnboardingModal';
import { AboutModal } from './AboutModal';
import { TopBar } from './TopBar';

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

type SnapPreviewTarget = 'left' | 'right' | 'maximize';

interface SnapPreviewState {
  windowId: string;
  target: SnapPreviewTarget;
}

/** Per-app error boundary: prevents one crashed app from tearing down the whole shell. */
class AppErrorBoundary extends React.Component<
  { appId: string; children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { appId: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Shell] App "${this.props.appId}" crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: '#0a0a0a', color: '#e2e8f0', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>
            App Crashed
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', maxWidth: 300 }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              padding: '0.4rem 1rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.375rem', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.75rem',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Shell: React.FC<ShellProps> = () => {
  const BOOT_STORAGE_KEY = 'rb:shell:booted:v1';
  const [booted, setBooted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(BOOT_STORAGE_KEY) === '1';
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [systemSearchOpen, setSystemSearchOpen] = useState(false);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [macroRunnerOpen, setMacroRunnerOpen] = useState(false);
  const [windowSwitcherOpen, setWindowSwitcherOpen] = useState(false);
  const [windowSwitcherPreviousFocus, setWindowSwitcherPreviousFocus] = useState<string | null>(null);
  const [openWithModalState, setOpenWithModalState] = useState<OpenWithModalState | null>(null);
  const [determinismPanelOpen, setDeterminismPanelOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [showPerfHud, setShowPerfHud] = useState(() => isPerfDebugEnabled());
  const [showJankHud, setShowJankHud] = useState(false);
  const [showDeadZoneScanner, setShowDeadZoneScanner] = useState(false);
  const [showOverlayDebug, setShowOverlayDebug] = useState(false);
  const [snapPreview, setSnapPreview] = useState<SnapPreviewState | null>(null);
  const lastSettingsRef = useRef<{
    themeVariant: string;
    density: string;
    reduceMotion: boolean;
    snapAssist: string;
  } | null>(null);

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
  const systemLogEntries = useSystemLogStore((s) => s.entries);
  const systemLogLastRead = useSystemLogStore((s) => s.lastReadSeq);
  const unreadLogCount = useMemo(
    () => systemLogEntries.filter((entry) => entry.seq > systemLogLastRead).length,
    [systemLogEntries, systemLogLastRead]
  );
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

  // Determinism recorder (core to RedByte - determinism is the physics, not a debug feature)
  const isDemoMode = import.meta.env.VITE_PUBLIC_DEMO === 'true';
  const determinismRecorder = useDeterminismRecorder();

  const [pinnedAppIds, setPinnedAppIds] = useState<string[]>(() => {
    if (typeof localStorage === 'undefined') return ['start-here'];

    try {
      const raw = localStorage.getItem('rb:shell:pinnedApps');

      // Demo mode: Auto-pin demo apps if no pins exist
      if (!raw && isDemoMode) {
        const demoApps = ['start-here', 'logic-playground', 'ece-lab', 'submission-inspector'];
        localStorage.setItem('rb:shell:pinnedApps', JSON.stringify(demoApps));
        return demoApps;
      }

      if (!raw) return ['start-here'];

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Always ensure 'start-here' is first unless explicitly removed
        const filtered = parsed.filter((id): id is string => typeof id === 'string' && id !== 'start-here');
        return ['start-here', ...filtered];
      }
    } catch { }

    return ['start-here'];
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
      } catch { }

      return next;
    });
  }, []);

  const handleSnapPreviewChange = useCallback((windowId: string, target: SnapPreviewTarget | null) => {
    setSnapPreview((prev) => {
      if (!target) {
        return prev?.windowId === windowId ? null : prev;
      }
      if (prev?.windowId === windowId && prev.target === target) return prev;
      return { windowId, target };
    });
  }, []);

  const handleSnapCommit = useCallback(
    (windowId: string, target: SnapPreviewTarget) => {
      const desktopBounds = {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      if (target === 'maximize') {
        toggleMaximize(windowId);
      } else {
        snapWindow(windowId, target, desktopBounds);
      }
      logSystemEvent({
        level: 'action',
        source: 'shell',
        message: 'Window snapped',
        data: { windowId, target },
      });
    },
    [snapWindow, toggleMaximize]
  );

  const handleMoveEnd = useCallback((windowId: string, bounds: { x: number; y: number; width: number; height: number }) => {
    logSystemEvent({
      level: 'action',
      source: 'shell',
      message: 'Window moved',
      data: { windowId, bounds },
    });
  }, []);

  const handleResizeEnd = useCallback((windowId: string, bounds: { x: number; y: number; width: number; height: number }) => {
    logSystemEvent({
      level: 'action',
      source: 'shell',
      message: 'Window resized',
      data: { windowId, bounds },
    });
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyTheme(document.documentElement, settings.themeVariant);
      document.documentElement.setAttribute('data-rb-density', settings.density);
      document.documentElement.setAttribute('data-rb-motion', settings.reduceMotion ? 'reduced' : 'full');
    }
  }, [settings.themeVariant, settings.density, settings.reduceMotion, settings.snapAssist]);

  useEffect(() => {
    const current = {
      themeVariant: settings.themeVariant,
      density: settings.density,
      reduceMotion: settings.reduceMotion,
      snapAssist: settings.snapAssist,
    };
    if (!lastSettingsRef.current) {
      lastSettingsRef.current = current;
      return;
    }
    if (
      lastSettingsRef.current.themeVariant !== current.themeVariant ||
      lastSettingsRef.current.density !== current.density ||
      lastSettingsRef.current.reduceMotion !== current.reduceMotion ||
      lastSettingsRef.current.snapAssist !== current.snapAssist
    ) {
      logSystemEvent({
        level: 'action',
        source: 'settings',
        message: 'Settings updated',
        data: current,
      });
      lastSettingsRef.current = current;
    }
  }, [settings.themeVariant, settings.density, settings.reduceMotion]);

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

    // Show autosave recovery toast (demo mode only)
    if (isDemoMode) {
      toast.success({
        title: 'Session Restored',
        message: 'Recovered your last session',
        duration: 8000,
        actions: [
          {
            label: 'Clear',
            onClick: () => {
              // Close all restored windows
              validWindows.forEach((w) => {
                closeWindow(w.id);
              });
              // Clear bindings
              setBindings({});
            },
          },
        ],
      });
    }
  }, [booted, restoreSession, isDemoMode, closeWindow]);



  const openWindow = useCallback(
    (appId: string, props?: any) => {
      const app = getApp(appId);
      if (!app) {
        logSystemEvent({
          level: 'error',
          source: 'shell',
          message: 'App not found',
          data: { appId },
        });
        return null;
      }

      recordRecentApp(appId);

      if (app.manifest.singleton) {
        const existing = windows.find((w) => w.contentId === appId);
        if (existing) {
          if (existing.mode === 'minimized') {
            restoreWindow(existing.id);
          }
          focusWindow(existing.id);
          setBindings((prev) => ({ ...prev, [existing.id]: { appId, props } }));
          logSystemEvent({
            level: 'action',
            source: 'shell',
            message: 'Window focused',
            data: { appId, windowId: existing.id, mode: existing.mode },
          });
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
      logSystemEvent({
        level: 'action',
        source: 'shell',
        message: 'Window opened',
        data: { appId, windowId: state.id },
      });
      return state.id;
    },
    [createWindow, focusWindow, recordRecentApp, windows, restoreWindow]
  );

  // Auto-launch Logic Playground from URL parameters (Deep Linking)
  useEffect(() => {
    if (!booted) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    // Check for Logic Playground specific parameters
    if (params.has('mode') || params.has('example') || params.has('circuit')) {
      // Open logic-playground (openWindow handles singleton check automatically)
      // We rely on the app itself to parse the params again and apply configuration
      openWindow('logic-playground');
    }
  }, [booted, openWindow]);

  const dispatchIntent = useCallback(
    (intent: Intent) => {
      logSystemEvent({
        level: 'action',
        source: 'intent',
        message: 'Intent dispatched',
        data: { type: intent.type, payload: intent.payload },
      });
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
          const newWindowId = openWindow(targetAppId, { resourceId, resourceType });
          if (!newWindowId) {
            toast.error({ message: `Failed to open ${resourceId}: App "${targetAppId}" not found` });
          }
          return newWindowId;
        }
        case 'open-example': {
          const { targetAppId, exampleId } = intent.payload;
          const preferNewWindow = intent.routingHint?.preferNewWindow ?? false;

          // PHASE_AC: Use routing resolver to determine reuse vs create
          const targetWindowId = resolveTargetWindowId(targetAppId, preferNewWindow, windows);

          if (targetWindowId) {
            // Reuse existing window
            const binding = bindings[targetWindowId];
            if (binding) {
              // Update props with example
              setBindings((prev) => ({
                ...prev,
                [targetWindowId]: { ...binding, props: { initialExampleId: exampleId } },
              }));
              focusWindow(targetWindowId);
              return targetWindowId;
            }
          }

          // Create new window (no existing window found or preferNewWindow=true)
          const newWindowId = openWindow(targetAppId, { initialExampleId: exampleId });
          if (!newWindowId) {
            toast.error({ message: `Failed to open example "${exampleId}": App "${targetAppId}" not found` });
          }
          return newWindowId;
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
      logSystemEvent({
        level: 'action',
        source: 'shell',
        message: 'Window closed',
        data: { windowId: id },
      });
    },
    [closeWindow]
  );

  // Window state accessors registry (for determinism recording)
  const windowStateAccessorsRef = useRef<Map<string, { getCircuit?: () => any }>>(new Map());

  // Register/unregister state accessors for windows
  const registerWindowStateAccessor = useCallback((windowId: string, accessor: { getCircuit?: () => any }) => {
    windowStateAccessorsRef.current.set(windowId, accessor);
  }, []);

  const unregisterWindowStateAccessor = useCallback((windowId: string) => {
    windowStateAccessorsRef.current.delete(windowId);
  }, []);

  // Determinism panel helpers (dev only)
  const getCurrentCircuit = useCallback(() => {
    // Find the focused Logic Playground window
    const focusedWindow = useWindowStore.getState().getFocusedWindow();
    if (!focusedWindow) {
      return null;
    }
    if (focusedWindow.contentId !== 'logic-playground') {
      return null;
    }

    // Check if this window has registered a circuit accessor
    const accessor = windowStateAccessorsRef.current.get(focusedWindow.id);
    if (!accessor?.getCircuit) {
      return null;
    }

    return accessor.getCircuit();
  }, []);

  const handleDeterminismAction = useCallback(
    (action: any) => {
      switch (action.type) {
        case 'start-recording': {
          const circuit = getCurrentCircuit();
          if (circuit) {
            determinismRecorder.startRecording(circuit);
            logSystemEvent({
              level: 'action',
              source: 'determinism',
              message: 'Recording started',
            });
          }
          break;
        }
        case 'stop-recording':
          determinismRecorder.stopRecording();
          logSystemEvent({
            level: 'action',
            source: 'determinism',
            message: 'Recording stopped',
          });
          break;
        case 'verify-replay':
          determinismRecorder.verifyRecording();
          logSystemEvent({
            level: 'action',
            source: 'determinism',
            message: 'Verification requested',
          });
          break;
        case 'reset':
          determinismRecorder.reset();
          logSystemEvent({
            level: 'action',
            source: 'determinism',
            message: 'Determinism state reset',
          });
          break;
        case 'initialize-timetravel':
          determinismRecorder.initializeTimeTravel();
          logSystemEvent({
            level: 'action',
            source: 'determinism',
            message: 'Time travel initialized',
          });
          break;
        case 'step-forward':
          determinismRecorder.stepForwardInTime();
          logSystemEvent({
            level: 'action',
            source: 'determinism',
            message: 'Time travel step forward',
          });
          break;
        case 'step-backward':
          determinismRecorder.stepBackwardInTime();
          logSystemEvent({
            level: 'action',
            source: 'determinism',
            message: 'Time travel step backward',
          });
          break;
      }
    },
    [determinismRecorder, getCurrentCircuit]
  );

  // Ref to hold latest executeCommand for macro execution
  const executeCommandRef = useRef<((command: Command) => void) | null>(null);

  const dispatchPlaygroundCommand = useCallback((command: Command) => {
    const focused = useWindowStore.getState().getFocusedWindow();
    if (!focused || focused.contentId !== 'logic-playground') return;
    window.dispatchEvent(
      new CustomEvent('rb:playground-command', {
        detail: { command, windowId: focused.id },
      })
    );
  }, []);

  const executeCommand = useCallback(
    (command: Command) => {
      logSystemEvent({
        level: 'action',
        source: 'command',
        message: 'Command executed',
        data: { command },
      });
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
          logSystemEvent({
            level: 'action',
            source: 'shell',
            message: 'Window snapped',
            data: { windowId: focused.id, target: direction, via: 'command' },
          });
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
          logSystemEvent({
            level: 'action',
            source: 'shell',
            message: 'Window centered',
            data: { windowId: focused.id, via: 'command' },
          });
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

        case 'open-user-manual': {
          openWindow('user-manual');
          break;
        }

        case 'playground-layout-build':
        case 'playground-layout-analyze':
        case 'playground-layout-explain':
        case 'playground-layout-explore':
        case 'playground-layout-quad':
        case 'playground-layout-circuit-only':
        case 'playground-layout-schematic-only':
        case 'playground-layout-scope-only':
        case 'playground-layout-3d-only':
        case 'playground-project-new':
        case 'playground-project-open':
        case 'playground-project-save':
        case 'playground-project-export':
        case 'playground-dock-info':
        case 'playground-dock-health':
        case 'playground-dock-learn':
        case 'playground-dock-probes':
        case 'playground-dock-chips':
        case 'playground-toggle-wire':
        case 'playground-toggle-pause-scroll':
        case 'playground-fit-view':
        case 'playground-reset-view':
        case 'playground-clear-scope': {
          dispatchPlaygroundCommand(command);
          break;
        }
      }
    },
    [
      dispatchPlaygroundCommand,
      focusWindow,
      handleClose,
      openWindow,
      toggleMinimize,
      snapWindow,
      centerWindow,
      restoreSession,
      setBindings,
    ]
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
        // Intent handled - no active file context
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

      if (import.meta.env.DEV && event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setShowPerfHud((prev) => !prev);
        return;
      }

      if (import.meta.env.DEV && event.shiftKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setShowJankHud((prev) => !prev);
        return;
      }

      if (import.meta.env.DEV && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowDeadZoneScanner((prev) => !prev);
        return;
      }

      if (import.meta.env.DEV && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        setShowOverlayDebug((prev) => !prev);
        return;
      }

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

      // Cmd/Ctrl+Shift+D: Open Determinism Tools (full panel)
      if (event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setDeterminismPanelOpen(true);
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

      // Cmd/Ctrl+/: Open About (demo mode only)
      if (isDemoMode && event.key === '/') {
        event.preventDefault();
        setAboutModalOpen(true);
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
  }, [hasSettings, openWindow, executeCommand, isDemoMode]);

  useEffect(() => {
    startUiTickSampler();
    startPerfSummaryLogger();
  }, []);

  // SAFETY: Warn users before closing tab with open windows (potential unsaved work)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only warn if there are open application windows (excluding launcher)
      const hasOpenWork = windows.some(
        (w) => w.contentId !== 'launcher' && w.mode !== 'minimized'
      );

      if (hasOpenWork) {
        // Standard way to trigger browser's "Are you sure?" dialog
        event.preventDefault();
        // Legacy support for older browsers
        event.returnValue = 'You have unsaved work. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [windows]);

  // SAFETY: Listen for storage errors and show toast notifications
  useEffect(() => {
    const handleStorageError = (event: CustomEvent<{ type: string; message: string }>) => {
      if (event.detail?.type === 'quota-exceeded') {
        toast.error({
          title: 'Storage Full',
          message: event.detail.message,
          duration: 15000, // Show for 15 seconds - this is important
          actions: [
            {
              label: 'Learn More',
              onClick: () => {
                // Could open help or settings
                openWindow('settings');
              },
            },
          ],
        });
        logSystemEvent({
          level: 'error',
          source: 'storage',
          message: 'Storage quota exceeded',
          data: { detail: event.detail },
        });
      }
    };

    window.addEventListener('rb:storage-error', handleStorageError as EventListener);
    return () => window.removeEventListener('rb:storage-error', handleStorageError as EventListener);
  }, [openWindow]);

  useEffect(() => {
    if (!booted || hasInitializedRef.current) return;

    hasInitializedRef.current = true;

    try {
      localStorage.setItem(BOOT_STORAGE_KEY, '1');
    } catch { }

    // Auto-open app from query param for automation testing and E2E
    // Enabled in dev + when navigator.webdriver is present (Playwright/Selenium)
    if (import.meta.env.DEV || navigator.webdriver) {
      const params = new URLSearchParams(window.location.search);
      const openApp = params.get('openApp');
      if (openApp && getApp(openApp)) {
        const timer = setTimeout(() => openWindow(openApp), 300);
        return () => clearTimeout(timer);
      }
    }

    // Demo mode: Show onboarding modal instead of welcome screen
    if (isDemoMode) {
      const onboardingDismissed = localStorage.getItem('rb:onboarding:dismissed');
      if (onboardingDismissed !== 'true') {
        const timer = setTimeout(() => setOnboardingModalOpen(true), 500);
        return () => clearTimeout(timer);
      }
    } else {
      // Dev mode: Show welcome screen
      if (!hasShownWelcomeRef.current) {
        hasShownWelcomeRef.current = true;

        const welcomeSeen = localStorage.getItem('rb-os:v1:welcomeSeen');

        if (welcomeSeen !== 'true') {
          const timer = setTimeout(() => openWindow('start-here'), 500);
          return () => clearTimeout(timer);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, isDemoMode]);

  const snapPreviewBounds = useMemo(() => {
    if (!snapPreview || typeof window === 'undefined') return null;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (snapPreview.target === 'maximize') {
      return { x: 0, y: 0, width, height };
    }
    const halfWidth = Math.floor(width / 2);
    if (snapPreview.target === 'left') {
      return { x: 0, y: 0, width: halfWidth, height };
    }
    return { x: width - halfWidth, y: 0, width: halfWidth, height };
  }, [snapPreview]);

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  const determinismMode: DeterminismMode =
    determinismRecorder.isRecording
      ? 'recording'
      : determinismRecorder.isTimeTraveling
        ? 'replay'
        : 'live';
  const hasVisibleWindows = windows.some((w) => w.mode !== 'minimized');

  const snapPreviewLabel = snapPreview
    ? snapPreview.target === 'maximize'
      ? 'Maximize'
      : snapPreview.target === 'left'
        ? 'Snap Left'
        : 'Snap Right'
    : null;

  return (
    <div data-testid="shell-container" className="shell-container rb-shell relative w-screen h-screen overflow-hidden">
      <TopBar
        isRecording={determinismRecorder.isRecording}
        modeLabel={determinismMode}
        tickCount={determinismRecorder.tickCount}
        versionLabel={getVersionString()}
        unreadCount={unreadLogCount}
        onOpenLog={() => openWindow('system-log')}
        onOpenLauncher={() => openWindow('launcher')}
        onOpenSettings={() => openWindow('settings')}
        onOpenDeterminism={() => setDeterminismPanelOpen(true)}
      />
      <Desktop
        onOpenApp={openWindow}
        wallpaperId={settings.wallpaperId}
        themeVariant={settings.themeVariant}
      />

      <Dock onOpenApp={openWindow} />

      {!hasVisibleWindows && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <EmptyState
            icon="browser"
            title="Workspace idle"
            description="Open the Launcher to start an app or use Ctrl/Cmd+Space to search."
            action={(
              <button
                onClick={() => openWindow('launcher')}
                className="px-3 py-1.5 rounded-md text-xs font-semibold"
                style={{
                  background: 'var(--rb-surface-2)',
                  border: '1px solid var(--rb-border)',
                  color: 'var(--rb-text)',
                }}
              >
                Open Launcher
              </button>
            )}
            className="pointer-events-auto"
          />
        </div>
      )}

      {snapPreviewBounds && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
          <div
            className="absolute rounded-2xl border"
            style={{
              left: snapPreviewBounds.x,
              top: snapPreviewBounds.y,
              width: snapPreviewBounds.width,
              height: snapPreviewBounds.height,
              borderColor: 'var(--rb-accent-strong)',
              background: 'var(--rb-accent-weak)',
              boxShadow: 'var(--rb-shadow-2)',
              backdropFilter: 'blur(6px)',
            }}
          >
            {snapPreviewLabel && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-semibold tracking-[0.2em] uppercase text-cyan-200 border"
                style={{ background: 'var(--rb-surface-2)', borderColor: 'var(--rb-border-strong)' }}
              >
                {snapPreviewLabel}
              </div>
            )}
          </div>
        </div>
      )}

      {windows.map((window) => {
        const binding = bindings[window.id];
        const app: RedByteApp | null = binding ? getApp(binding.appId) : getApp(window.contentId);
        if (!app) return null;
        const Component = app.component;
        const resourceId =
          binding?.props?.resourceId ??
          binding?.props?.initialFileId ??
          binding?.props?.initialExampleId ??
          undefined;

        return (
          <ShellWindow
            key={window.id}
            state={window}
            minSize={app.manifest.minSize}
            iconName={app.manifest.iconId}
            snapAssistMode={settings.snapAssist}
            provenance={{
              appId: app.manifest.id,
              resourceId,
              tick: determinismRecorder.tickCount,
            }}
            onClose={() => handleClose(window.id)}
            onFocus={() => {
              focusWindow(window.id);
              logSystemEvent({
                level: 'action',
                source: 'shell',
                message: 'Window focused',
                data: { windowId: window.id, appId: window.contentId },
              });
            }}
            onMove={(x, y) => moveWindow(window.id, x, y)}
            onResize={(w, h) => resizeWindow(window.id, w, h)}
            onMoveEnd={(bounds) => handleMoveEnd(window.id, bounds)}
            onResizeEnd={(bounds) => handleResizeEnd(window.id, bounds)}
            onSnapPreviewChange={handleSnapPreviewChange}
            onSnap={handleSnapCommit}
            onMinimize={() => {
              toggleMinimize(window.id);
              logSystemEvent({
                level: 'action',
                source: 'shell',
                message: 'Window minimized',
                data: { windowId: window.id, appId: window.contentId },
              });
            }}
            onMaximize={() => {
              toggleMaximize(window.id);
              logSystemEvent({
                level: 'action',
                source: 'shell',
                message: 'Window maximized',
                data: { windowId: window.id, appId: window.contentId },
              });
            }}
            onRestore={() => {
              restoreWindow(window.id);
              logSystemEvent({
                level: 'action',
                source: 'shell',
                message: 'Window restored',
                data: { windowId: window.id, appId: window.contentId },
              });
            }}
          >
            <AppErrorBoundary appId={app.manifest.id}>
              <Component
                windowId={window.id}
                onOpenApp={openWindow}
                onClose={() => handleClose(window.id)}
                onDispatchIntent={dispatchIntent}
                registerStateAccessor={registerWindowStateAccessor}
                unregisterStateAccessor={unregisterWindowStateAccessor}
                determinismRecorder={determinismRecorder}
                getCurrentCircuit={getCurrentCircuit}
                versionLabel={getVersionString()}
                recentAppIds={app.manifest.id === 'launcher' ? recentAppIds : undefined}
                pinnedAppIds={app.manifest.id === 'launcher' ? pinnedAppIds : undefined}
                runningAppIds={app.manifest.id === 'launcher' ? runningAppIds : undefined}
                onTogglePin={app.manifest.id === 'launcher' ? togglePinnedAppId : undefined}
                {...binding?.props}
              />
            </AppErrorBoundary>
          </ShellWindow>
        );
      })}

      <ToastContainer />
      <NarrativeOverlay />

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

      {/* Onboarding Modal (Demo mode only) */}
      {isDemoMode && onboardingModalOpen && (
        <OnboardingModal
          isOpen={onboardingModalOpen}
          onClose={() => setOnboardingModalOpen(false)}
          onOpenApp={openWindow}
          onDispatchIntent={dispatchIntent}
        />
      )}

      {/* About Modal (Demo mode only) */}
      {isDemoMode && aboutModalOpen && (
        <AboutModal
          isOpen={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />
      )}

      {/* Determinism Tools Panel (full controls) */}
      {determinismPanelOpen && DeterminismPanel && (
        <DeterminismPanel
          isOpen={determinismPanelOpen}
          onClose={() => setDeterminismPanelOpen(false)}
          getCurrentCircuit={getCurrentCircuit}
          onRecordAction={handleDeterminismAction}
          onExportLog={determinismRecorder.exportLog}
          isRecording={determinismRecorder.isRecording}
          verificationResult={determinismRecorder.verificationResult}
          currentSnapshot={determinismRecorder.currentSnapshot}
          canNavigateForward={determinismRecorder.canNavigateForward()}
          canNavigateBackward={determinismRecorder.canNavigateBackward()}
        />
      )}

      {showPerfHud && <PerfHud onClose={() => setShowPerfHud(false)} />}

      {import.meta.env.DEV && showJankHud && (
        <>
          <HitTestDebugHUD />
          <RenderStormMonitor />
        </>
      )}

      {import.meta.env.DEV && showDeadZoneScanner && <DeadZoneScanner />}
      {import.meta.env.DEV && showOverlayDebug && <OverlayDebugHUD />}

      {/* Truth Bar: Always-visible determinism status */}
      <TruthBar
        mode={determinismMode}
        tickCount={determinismRecorder.tickCount}
        totalEvents={determinismRecorder.currentSnapshot?.totalEvents}
        hashPrefix={
          determinismRecorder.verificationResult?.liveHash
            ? determinismRecorder.verificationResult.liveHash.slice(0, 8)
            : undefined
        }
        canRecord={getCurrentCircuit() !== null}
        onToggleRecording={() => {
          if (determinismRecorder.isRecording) {
            handleDeterminismAction({ type: 'stop-recording' });
          } else {
            handleDeterminismAction({ type: 'start-recording' });
          }
        }}
        onVerify={
          determinismRecorder.hasRecording && !determinismRecorder.isRecording
            ? () => handleDeterminismAction({ type: 'verify-replay' })
            : undefined
        }
        verificationStatus={
          determinismRecorder.verificationResult
            ? determinismRecorder.verificationResult.equal
              ? 'pass'
              : 'fail'
            : undefined
        }
        onOpenPanel={() => setDeterminismPanelOpen(true)}
      />
    </div>
  );
};
