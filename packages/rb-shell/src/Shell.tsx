// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useState, useRef, useMemo, Suspense, type ErrorInfo } from 'react';
import { Desktop } from './Desktop';
import { Dock } from './Dock';
import { Taskbar } from './Taskbar';
import { ShellWindow } from './ShellWindow';
import { applyTheme } from '@redbyte/rb-theme';
import { isPerfDebugEnabled, startPerfSummaryLogger, startUiTickSampler, toStudentFacingError, useSettingsStore } from '@redbyte/rb-utils';
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
  installErrorHandlers,
  useRenderStormDetector,
  loadFirstRunState,
  resolveFirstRunTargetApp,
  getFirstRunBlockingReason,
  canOpenAppForCurrentMode,
  isStudentModeActive,
  useCapabilitiesStore,
} from '@redbyte/rb-apps';
import { useWindowStore, loadSession, resolveTargetWindowId, type WindowState } from '@redbyte/rb-windowing';
import { useWorkspaceStore, loadWorkspaces } from './workspaceStore';
import { executeMacro, type MacroExecutionContext } from './macros/executeMacro';
import { useMacroStore } from './macros/macroStore';
import BootScreen from './BootScreen';
import { Modal, ToastContainer, toast } from '@redbyte/rb-primitives';
import { progressStart, progressSucceed, progressFail } from '@redbyte/rb-utils';
import { ProgressToasts } from './ProgressToasts';
import { CommandPalette, type Command } from './CommandPalette';
import { SystemSearch } from './SystemSearch';
import { WorkspaceSwitcher, MacroRunner, WindowSwitcher } from './modals';
import { NarrativeOverlay } from './narrative/NarrativeOverlay';
import type { Intent } from './intent-types';
import { getVersionString } from './version';
import { getDesktopBounds, getMaximizedBounds } from './layout/layout-constants';
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
import { ExamplePicker } from './ExamplePicker';
import { BitstreamProvenanceModal } from './BitstreamProvenanceModal';
import {
  decodeInstructorProjectArchive,
  decodeRBProject,
  getCanonicalProjectAutosaveKey,
  loadExampleAsProject,
  loadRbprojAutosave,
  rbProjectToLabProject,
  type ExampleId,
  type RBProject,
} from '@redbyte/rb-apps';
import type { BitstreamProvenanceMetadata } from '@redbyte/rb-fpga-toolchain';
import type { LabProjectV1, CircuitV1 } from '@redbyte/rb-utils';
import { exportEvidenceCapsule, importEvidenceCapsule, useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import {
  convertCircuitV1ToCircuit,
  prepareImportedProjectState,
  getVirtualLabSimulationState,
  getImportWarnings,
  generateImportSummary,
  validateUnifiedProjectStoreCompatibility,
} from '@redbyte/rb-lab-engine';
import { serialize, type Circuit, type Connection, CircuitEngine, toCircuitV1 } from '@redbyte/rb-logic-core';
import { TopBar } from './TopBar';
import { RecoveryPrompt, type RecoveryAction } from './RecoveryPrompt';
import { useSessionDiagnosticsStore, getDiagnosticsSnapshot } from './sessionDiagnosticsStore';
import { checkForRecovery, clearJournal, unregisterAutosave } from './persistenceStore';
import { HomeScreen } from './HomeScreen';
import { RecentLogWidget } from './RecentLogWidget';
import { trackWindowOpen, runWindowCleanup, startLeakMonitor } from './leakGuard';

export interface ShellProps {
  children?: React.ReactNode;
}

interface WindowAppBinding {
  appId: string;
  props?: any;
}

interface WindowHandlersEntry {
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onMoveEnd: (bounds: any) => void;
  onResizeEnd: (bounds: any) => void;
}

interface ShellWindowEntryProps {
  windowId: string;
  binding?: WindowAppBinding;
  handlers?: WindowHandlersEntry;
  snapAssist: string;
  determinismTick: number;
  openWindow: (appId: string, props?: any) => string | null;
  handleClose: (id: string) => void;
  handleSnapPreviewChange: (windowId: string, target: SnapPreviewTarget | null) => void;
  handleSnapCommit: (windowId: string, target: SnapPreviewTarget) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  restoreWindow: (id: string) => void;
  dispatchIntent: (intent: Intent) => string | null;
  registerWindowStateAccessor: (windowId: string, accessors: { getCircuit?: () => any }) => void;
  unregisterWindowStateAccessor: (windowId: string) => void;
  determinismRecorder: ReturnType<typeof useDeterminismRecorder>;
  getCurrentCircuit: () => Circuit | null;
  handleOpenStarterProject: (starter: { exampleId: ExampleId; targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace'; starterId?: string; instructions?: StarterInstructionsPayload; }) => void;
  handleOpenInstructorPackProject: (starter: { starterId: string; targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace'; packId: string; projectArchiveBase64: string; instructions: StarterInstructionsPayload; }) => Promise<void>;
  handleOpenRecentProject: (payload: { projectId: string; targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' }) => Promise<void>;
  handleOpenSubmissionProject: (payload: { project: RBProject; targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace'; }) => Promise<void>;
  recentAppIds: string[];
  pinnedAppIds: string[];
  runningAppIds: string[];
  togglePinnedAppId: (appId: string) => void;
}

const ShellWindowEntry = React.memo(({
  windowId,
  binding,
  handlers,
  snapAssist,
  determinismTick,
  openWindow,
  handleClose,
  handleSnapPreviewChange,
  handleSnapCommit,
  toggleMinimize,
  toggleMaximize,
  restoreWindow,
  dispatchIntent,
  registerWindowStateAccessor,
  unregisterWindowStateAccessor,
  determinismRecorder,
  getCurrentCircuit,
  handleOpenStarterProject,
  handleOpenInstructorPackProject,
  handleOpenRecentProject,
  handleOpenSubmissionProject,
  recentAppIds,
  pinnedAppIds,
  runningAppIds,
  togglePinnedAppId,
}: ShellWindowEntryProps) => {
  const state = useWindowStore(
    useCallback((storeState) => storeState.windows.find((window) => window.id === windowId) ?? null, [windowId])
  );

  if (!state || !handlers) return null;

  const app: RedByteApp | null = binding ? getApp(binding.appId) : getApp(state.contentId);
  if (!app) {
    const orphanId = binding?.appId ?? state.contentId;
    console.warn(`[Shell] Closing orphan window for unregistered app "${orphanId}"`);
    handleClose(state.id);
    return null;
  }

  const Component = app.component;
  const resourceId =
    binding?.props?.resourceId ??
    binding?.props?.initialFileId ??
    binding?.props?.initialExampleId ??
    undefined;

  return (
    <ShellWindow
      key={state.id}
      state={state}
      minSize={app.manifest.minSize}
      iconName={app.manifest.iconId}
      snapAssistMode={snapAssist}
      provenance={{
        appId: app.manifest.id,
        resourceId,
        tick: determinismTick,
      }}
      onClose={handlers.onClose}
      onFocus={handlers.onFocus}
      onMove={handlers.onMove}
      onResize={handlers.onResize}
      onMoveEnd={handlers.onMoveEnd}
      onResizeEnd={handlers.onResizeEnd}
      onSnapPreviewChange={handleSnapPreviewChange}
      onSnap={handleSnapCommit}
      onMinimize={() => {
        toggleMinimize(state.id);
        logSystemEvent({
          level: 'action',
          source: 'shell',
          message: 'Window minimized',
          data: { windowId: state.id, appId: state.contentId },
        });
      }}
      onMaximize={() => {
        toggleMaximize(state.id);
        logSystemEvent({
          level: 'action',
          source: 'shell',
          message: 'Window maximized',
          data: { windowId: state.id, appId: state.contentId },
        });
      }}
      onRestore={() => {
        restoreWindow(state.id);
        logSystemEvent({
          level: 'action',
          source: 'shell',
          message: 'Window restored',
          data: { windowId: state.id, appId: state.contentId },
        });
      }}
    >
      <AppErrorBoundary
        appId={app.manifest.id}
        windowId={state.id}
        onClose={() => handleClose(state.id)}
        onOpenHelp={(errorCode) => {
          const playgroundWindow = useWindowStore.getState().windows.find((window) => window.contentId === 'logic-playground');
          if (!playgroundWindow) openWindow('logic-playground');
          setTimeout(() => {
            globalThis.dispatchEvent(new CustomEvent('rb:open-dock', { detail: { tab: 'learn', subview: 'help', errorCode } }));
          }, playgroundWindow ? 0 : 500);
        }}
      >
        <Suspense fallback={<WindowLoadingFallback />}>
          <Component
            windowId={state.id}
            onOpenApp={openWindow}
            onOpenStarterProject={handleOpenStarterProject}
            onOpenInstructorPackProject={handleOpenInstructorPackProject}
            onOpenRecentProject={handleOpenRecentProject}
            onOpenSubmissionProject={handleOpenSubmissionProject}
            onClose={() => handleClose(state.id)}
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
        </Suspense>
      </AppErrorBoundary>
    </ShellWindow>
  );
});

interface OpenWithModalState {
  resourceId: string;
  resourceType: 'file' | 'folder';
  resourceName: string;
  extension: string;
  eligibleTargets: FileActionTarget[];
}

interface StudioLaunchBlockState {
  stepId: string;
  stepLabel: string;
  machineReason: string;
  humanReason: string;
}

type SnapPreviewTarget = 'left' | 'right' | 'maximize';

interface SnapPreviewState {
  windowId: string;
  target: SnapPreviewTarget;
}

interface ReproCheckItem {
  id: string;
  label: string;
  passed: boolean;
  details?: string;
}

interface ReproCheckReport {
  passed: boolean;
  checks: ReproCheckItem[];
}

interface ProjectSummaryItem {
  id: string;
  label: string;
  value: string;
}

interface ProjectSummaryReport {
  title: string;
  items: ProjectSummaryItem[];
  warnings: string[];
}

interface StarterInstructionsPayload {
  labId: string;
  title: string;
  timeEstimate: string;
  learningGoal: string;
  steps: string[];
  commonMistakes: string[];
  submit: string[];
  rubric: string[];
}

interface AppErrorBoundaryProps {
  appId: string;
  windowId: string;
  onClose: () => void;
  onOpenHelp: (errorCode?: string) => void;
  children: React.ReactNode;
}

/** Per-app error boundary: prevents one crashed app from tearing down the whole shell. */
class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  { hasError: boolean; error?: Error; errorStack?: string; resetNonce: number }
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetNonce: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack = info.componentStack ?? '';
    this.setState({ errorStack: stack });
    console.error(`[LP_SIM_CRASH] [Shell] App "${this.props.appId}" crashed:`, error, stack);
    if (typeof window !== 'undefined') {
      const debug = (window as any).__RB_DEBUG__ ?? {};
      debug.lastSimError = {
        message: error.message,
        stack: error.stack ?? null,
        componentStack: stack,
        appId: this.props.appId,
        windowId: this.props.windowId,
      };
      (window as any).__RB_DEBUG__ = debug;
    }
    logSystemEvent({
      level: 'error',
      source: this.props.appId,
      message: `App crashed: ${error.message}`,
      data: {
        windowId: this.props.windowId,
        stack: error.stack?.slice(0, 500),
        componentStack: stack.slice(0, 500),
      },
    });
  }

  private handleExportState = () => {
    const report = {
      appId: this.props.appId,
      windowId: this.props.windowId,
      timestamp: new Date().toISOString(),
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorStack,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crash-report-${this.props.appId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  private handleCopyDetails = async () => {
    try {
      const payload = {
        appId: this.props.appId,
        windowId: this.props.windowId,
        error: this.state.error?.message ?? 'Unknown error',
        stack: this.state.error?.stack ?? null,
        componentStack: this.state.errorStack ?? null,
      };
      const text = JSON.stringify(payload, null, 2);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      console.error('[Shell] Failed to copy crash details:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      const studentError = toStudentFacingError(this.state.error);
      const btnBase: React.CSSProperties = {
        padding: '0.4rem 1rem', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem',
      };
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: 'var(--rb-surface-0, #0a0a0a)', color: 'var(--rb-text, #e2e8f0)',
          padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--rb-danger, #ef4444)', marginBottom: '0.5rem' }}>
            App encountered a problem
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rb-text-2, #64748b)', marginBottom: '0.25rem' }}>
            <strong>{this.props.appId}</strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rb-text-3, #64748b)', marginBottom: '1rem', maxWidth: 300 }}>
            {studentError.message}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rb-text-2, #94a3b8)', marginBottom: '1rem', maxWidth: 360, textAlign: 'left' }}>
            <div>Try this in order:</div>
            <ol style={{ margin: '0.35rem 0 0 1rem', padding: 0 }}>
              <li>Reload App</li>
              <li>Open Help for guided recovery</li>
              <li>If needed, export a report for TA support</li>
            </ol>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() =>
                this.setState((prev) => ({
                  hasError: false,
                  error: undefined,
                  errorStack: undefined,
                  resetNonce: prev.resetNonce + 1,
                }))
              }
              style={{ ...btnBase, background: 'var(--rb-surface-2, #1e293b)', color: 'var(--rb-text, #e2e8f0)' }}
            >
              Reload App
            </button>
            <button
              type="button"
              onClick={this.handleCopyDetails}
              style={{ ...btnBase, background: 'transparent', color: 'var(--rb-text-2, #94a3b8)' }}
            >
              Copy Details
            </button>
            <button
              type="button"
              onClick={this.handleExportState}
              style={{ ...btnBase, background: 'transparent', color: 'var(--rb-text-2, #94a3b8)' }}
            >
              Export Report
            </button>
            <button
              type="button"
              onClick={() => {
                const studentError = toStudentFacingError(this.state.error);
                this.props.onOpenHelp(studentError.code !== 'UNEXPECTED_ERROR' ? studentError.code : undefined);
              }}
              style={{ ...btnBase, background: 'var(--rb-accent, #0891b2)', color: 'white' }}
            >
              Open Help
            </button>
            <button
              type="button"
              onClick={this.props.onClose}
              style={{ ...btnBase, background: 'var(--rb-danger-bg, rgba(239,68,68,0.12))', color: 'var(--rb-danger, #ef4444)', borderColor: 'var(--rb-danger-border, rgba(239,68,68,0.3))' }}
            >
              Close Window
            </button>
          </div>
        </div>
      );
    }
    return <div key={this.state.resetNonce} style={{ height: '100%' }}>{this.props.children}</div>;
  }
}

/** Loading fallback shown inside Suspense when lazy-loaded app components are loading. */
const WindowLoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: 'var(--rb-surface-0)',
      color: 'var(--rb-text-2)',
      gap: '12px',
    }}
  >
    <div
      style={{
        width: 24,
        height: 24,
        border: '2px solid var(--rb-border)',
        borderTopColor: 'var(--rb-accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <span style={{ fontSize: '12px', fontWeight: 500 }}>Loading...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export const Shell: React.FC<ShellProps> = () => {
  const BOOT_STORAGE_KEY = 'rb:shell:booted:v1';
  const [booted, setBooted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(BOOT_STORAGE_KEY) === '1';
  });

  // P1C manual gate support: ensures the render-storm reporter API is available even before apps open.
  useRenderStormDetector('Shell', 9999);

  // E2E/DEV boot sentinel: used by Playwright gates to fail fast on boot-time crashes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const isE2E = params.get('e2e') === '1' || navigator.webdriver;
      if (!import.meta.env.DEV && !isE2E) return;

      (window as any).__RB_BOOT_OK__ = true;
      (window as any).__RB_BOOT_TS__ = performance.now();
      try {
        document.documentElement?.setAttribute('data-rb-boot-ok', '1');
        document.documentElement?.setAttribute('data-rb-boot-ts', String((window as any).__RB_BOOT_TS__));
      } catch {
        // ignore
      }
      console.info('RB_BOOT_OK', { ts: (window as any).__RB_BOOT_TS__ });
    } catch {
      // Never break boot for instrumentation
    }
  }, []);

  useEffect(() => {
    try {
      const firstRunState = loadFirstRunState();
      const boardStatus = firstRunState.steps.board_detect?.status ?? 'pending';
      const toolchainStatus = firstRunState.steps.programmer_check?.status ?? 'pending';
      const mode = isStudentModeActive() ? 'student' : 'instructor';
      const buildSha = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BUILD_SHA ?? 'dev';
      console.info('RB_STARTUP_BANNER', {
        buildSha,
        mode,
        boardStatus,
        toolchainStatus,
      });
    } catch {
      // Startup banner must never break shell boot
    }
  }, []);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [systemSearchOpen, setSystemSearchOpen] = useState(false);
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [macroRunnerOpen, setMacroRunnerOpen] = useState(false);
  const [windowSwitcherOpen, setWindowSwitcherOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [reproCheckOpen, setReproCheckOpen] = useState(false);
  const [reproCheckReport, setReproCheckReport] = useState<ReproCheckReport | null>(null);
  const [projectSummaryOpen, setProjectSummaryOpen] = useState(false);
  const [projectSummaryReport, setProjectSummaryReport] = useState<ProjectSummaryReport | null>(null);
  const currentProjectRef = useRef<LabProjectV1 | null>(null);
  const loadUnifiedProject = useUnifiedProjectStore((s) => s.loadProject);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState<boolean>(() => {
    return checkForRecovery().length > 0;
  });
  const [windowSwitcherPreviousFocus, setWindowSwitcherPreviousFocus] = useState<string | null>(null);
  const [openWithModalState, setOpenWithModalState] = useState<OpenWithModalState | null>(null);
  const [determinismPanelOpen, setDeterminismPanelOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [examplePickerOpen, setExamplePickerOpen] = useState(false);
  const [bitstreamProvenanceOpen, setBitstreamProvenanceOpen] = useState(false);
  const [bitstreamMetadata, setBitstreamMetadata] = useState<BitstreamProvenanceMetadata | null>(null);
  const [showPerfHud, setShowPerfHud] = useState(() => isPerfDebugEnabled());
  const [showJankHud, setShowJankHud] = useState(false);
  const [showDeadZoneScanner, setShowDeadZoneScanner] = useState(false);
  const [showOverlayDebug, setShowOverlayDebug] = useState(false);
  const [snapPreview, setSnapPreview] = useState<SnapPreviewState | null>(null);
  const [studioLaunchBlock, setStudioLaunchBlock] = useState<StudioLaunchBlockState | null>(null);
  const lastSettingsRef = useRef<{
    themeVariant: string;
    density: string;
    uiScale: number;
    reduceMotion: boolean;
    performanceMode: boolean;
    snapAssist: string;
  } | null>(null);

  const hasInitializedRef = useRef(false);
  const hasAutoBootedLogicPlaygroundRef = useRef(false);
  const hasRestoredSessionRef = useRef(false);

  const windowStates = useWindowStore(useCallback((state) => state.windows, []));
  const windows = useMemo(() => {
    return windowStates.map((window) => ({
      id: window.id,
      contentId: window.contentId,
      mode: window.mode,
      zIndex: window.zIndex,
    }));
  }, [windowStates]);
  const windowIds = useMemo(() => {
    return [...windows].sort((a, b) => a.zIndex - b.zIndex).map((window) => window.id);
  }, [windows]);
  const runningAppIds = useMemo(() => {
    const ids = windows.filter((w) => w.mode !== 'minimized').map((w) => w.contentId);
    return Array.from(new Set(ids));
  }, [windows]);
  const systemLogEntries = useSystemLogStore((s) => s.entries);
  const systemLogLastRead = useSystemLogStore((s) => s.lastReadSeq);
  const logDiagnosticEvent = useSessionDiagnosticsStore((s) => s.logEvent);
  const recordDiagnosticAction = useSessionDiagnosticsStore((s) => s.recordAction);
  const diagnosticEvents = useSessionDiagnosticsStore((s) => s.events);
  const diagnosticsSnapshot = diagnosticsOpen ? getDiagnosticsSnapshot() : null;

  const handleCopyDiagnostics = useCallback(async () => {
    try {
      const snapshot = getDiagnosticsSnapshot();
      const payload = JSON.stringify(snapshot, null, 2);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = payload;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Diagnostics copied to clipboard.');
    } catch (error) {
      console.error('[Diagnostics] Copy failed:', error);
      toast.error('Failed to copy diagnostics.');
    }
  }, []);

  const handleExportDiagnostics = useCallback(() => {
    try {
      const snapshot = getDiagnosticsSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redbyte-diagnostics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[Diagnostics] Export failed:', error);
      toast.error('Failed to export diagnostics.');
    }
  }, []);
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
    if (typeof localStorage === 'undefined') return ['home'];

    try {
      const raw = localStorage.getItem('rb:shell:pinnedApps');

      // Demo mode: Auto-pin demo apps if no pins exist
      if (!raw && isDemoMode) {
        const demoApps = ['home', 'logic-playground', 'labs', 'settings'];
        localStorage.setItem('rb:shell:pinnedApps', JSON.stringify(demoApps));
        return demoApps;
      }

      if (!raw) return ['home'];

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Strip removed app IDs from previous versions and ensure 'home' is first
        const removedIds = new Set(['start-here', 'welcome', 'help', 'user-manual', 'app-store', 'status-panel', 'virtual-lab', 'lab-workspace', 'student-lab']);
        const filtered = parsed.filter((id): id is string => typeof id === 'string' && id !== 'home' && !removedIds.has(id));
        return ['home', ...filtered];
      }
    } catch { }

    return ['home'];
  });
  const themeVariant = useSettingsStore((s) => s.themeVariant);
  const density = useSettingsStore((s) => s.density);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const performanceMode = useSettingsStore((s) => s.performanceMode);
  const snapAssist = useSettingsStore((s) => s.snapAssist);
  const wallpaperId = useSettingsStore((s) => s.wallpaperId);
  const hasSettings = useMemo(() => Boolean(getApp('settings')), []);
  const studentModeEnabled = useCapabilitiesStore((s) => s.studentMode);

  const recordRecentApp = useCallback((appId: string) => {
    if (appId === 'launcher') return;

    setRecentAppIds((prev) => {
      const next = [appId, ...prev.filter((id) => id !== appId)];
      return next.slice(0, 5);
    });
  }, []);

  const handleVerifyReproducibility = useCallback(() => {
    const project = currentProjectRef.current;
    if (!project) {
      toast.error('No project available to verify');
      return;
    }

    const checks: ReproCheckItem[] = [];

    // Schema version check
    checks.push({
      id: 'schema',
      label: 'Schema version is supported',
      passed: project.schemaVersion === '1.0',
      details: `schemaVersion=${project.schemaVersion}`,
    });

    // Circuit node reference check
    const nodeIds = new Set(project.circuit.nodes.map((n) => n.id));
    const invalidConnections = project.circuit.connections.filter(
      (c) => !nodeIds.has(c.fromNodeId) || !nodeIds.has(c.toNodeId)
    );
    checks.push({
      id: 'circuit',
      label: 'Circuit references are valid',
      passed: invalidConnections.length === 0,
      details: invalidConnections.length ? `${invalidConnections.length} invalid connections` : 'ok',
    });

    // Probe definitions check
    const invalidProbes = project.simulation.probes.filter((p) => !p.id || !p.signal);
    checks.push({
      id: 'probes',
      label: 'Probes are well-formed',
      passed: invalidProbes.length === 0,
      details: invalidProbes.length ? `${invalidProbes.length} invalid probes` : 'ok',
    });

    // IO mapping references
    const ioEntries = [
      ...(project.ioMapping?.inputs ?? []),
      ...(project.ioMapping?.outputs ?? []),
    ];
    const invalidIo = ioEntries.filter((entry) => !nodeIds.has(entry.nodeId) || !entry.port);
    const hasBoardSignals = Object.keys(project.boardMap?.signalToPinMap ?? {}).length > 0;
    const missingIoMapping = hasBoardSignals && ioEntries.length === 0;
    checks.push({
      id: 'io-mapping',
      label: 'IO mapping references valid nodes/ports',
      passed: invalidIo.length === 0 && !missingIoMapping,
      details: missingIoMapping
        ? 'Board mappings exist but ioMapping is empty'
        : invalidIo.length
          ? `${invalidIo.length} invalid mappings`
          : 'ok',
    });

    // Recordings check (structure only)
    const recordings = project.recordings ?? [];
    const invalidRecordings = recordings.filter((r) => !Array.isArray(r.events) || r.events.length === 0);
    checks.push({
      id: 'recordings',
      label: 'Recordings are structurally valid',
      passed: invalidRecordings.length === 0,
      details: invalidRecordings.length ? `${invalidRecordings.length} invalid recordings` : 'ok',
    });

    // Replay verification (best-effort)
    if (recordings.length > 0 && invalidRecordings.length === 0) {
      const events = recordings[0].events ?? [];
      const runRecord = (events.find((e: any) => e?.kind === 'runRecord') as any)?.data ?? (events[0] as any);
      const proofPack = (events.find((e: any) => e?.kind === 'proofPack') as any)?.data;

      if (proofPack?.runRecord && runRecord?.circuitDigest && proofPack.runRecord.circuitDigest) {
        const matches = proofPack.runRecord.circuitDigest === runRecord.circuitDigest;
        checks.push({
          id: 'proof-pack',
          label: 'Proof pack matches recording',
          passed: matches,
          details: matches ? 'ok' : 'Circuit digest mismatch',
        });
      }

      if (runRecord?.circuitSnapshot && Array.isArray(runRecord.trace) && Array.isArray(runRecord.probes)) {
        try {
          const engine = new CircuitEngine(runRecord.circuitSnapshot as Circuit);
          const expectedByTick = new Map<number, any>();
          runRecord.trace.forEach((sample: any) => expectedByTick.set(sample.tick, sample));

          const stimulusByTick = new Map<number, any[]>();
          (runRecord.stimulus || []).forEach((event: any) => {
            const list = stimulusByTick.get(event.tick) ?? [];
            list.push(event);
            stimulusByTick.set(event.tick, list);
          });

          const maxTick = runRecord.summary?.tickCount ?? runRecord.trace[runRecord.trace.length - 1]?.tick ?? 0;
          let mismatchTick: number | null = null;

          for (let tick = 0; tick <= maxTick; tick += 1) {
            const events = stimulusByTick.get(tick) ?? [];
            events.forEach((event) => {
              if (event.type === 'input_toggled') {
                const prevState = engine.getNodeState(event.nodeId) || {};
                engine.setNodeState(event.nodeId, { ...prevState, isOn: event.value });
              }
            });

            engine.tick();

            const expected = expectedByTick.get(tick);
            if (!expected) continue;

            const signals = engine.getAllSignals();
            const actualValues: Record<string, number> = {};
            runRecord.probes.forEach((probe: any) => {
              const key = `${probe.nodeId}.${probe.portName}`;
              const rawValue = signals.get(key) ?? 0;
              const value = typeof rawValue === 'number' ? rawValue : 0;
              actualValues[probe.id] = value;
            });

            const mismatched = Object.keys(actualValues).some((probeId) => {
              const expectedValue = expected.values?.[probeId];
              if (expectedValue === undefined) return false;
              return expectedValue !== actualValues[probeId];
            });

            if (mismatched) {
              mismatchTick = tick;
              break;
            }
          }

          checks.push({
            id: 'replay',
            label: 'Replay verification matches recorded trace',
            passed: mismatchTick === null,
            details: mismatchTick === null ? 'ok' : `Mismatch at tick ${mismatchTick}`,
          });
        } catch (error) {
          checks.push({
            id: 'replay',
            label: 'Replay verification matches recorded trace',
            passed: false,
            details: error instanceof Error ? error.message : 'Replay failed',
          });
        }
      } else {
        checks.push({
          id: 'replay',
          label: 'Replay verification matches recorded trace',
          passed: false,
          details: 'Recording missing trace/probes data',
        });
      }
    }

    const passed = checks.every((c) => c.passed);
    setReproCheckReport({ passed, checks });
    setReproCheckOpen(true);
  }, []);

  const handleProjectSummary = useCallback(() => {
    const project = currentProjectRef.current;
    if (!project) {
      toast.error('No project available');
      return;
    }

    const boardSignals = Object.keys(project.boardMap?.signalToPinMap ?? {}).length;
    const ioInputs = project.ioMapping?.inputs?.length ?? 0;
    const ioOutputs = project.ioMapping?.outputs?.length ?? 0;
    const recordings = project.recordings ?? [];
    const recordingEvents = recordings.reduce((sum, r) => sum + (r.eventCount ?? r.events?.length ?? 0), 0);

    const items: ProjectSummaryItem[] = [
      { id: 'name', label: 'Name', value: project.name },
      { id: 'projectId', label: 'Project ID', value: project.projectId },
      { id: 'schema', label: 'Schema Version', value: project.schemaVersion },
      { id: 'created', label: 'Created', value: project.createdAt },
      { id: 'updated', label: 'Updated', value: project.updatedAt },
      { id: 'nodes', label: 'Circuit Nodes', value: String(project.circuit.nodes.length) },
      { id: 'connections', label: 'Connections', value: String(project.circuit.connections.length) },
      { id: 'customChips', label: 'Custom Chips', value: String(project.circuit.customChips?.length ?? 0) },
      { id: 'probes', label: 'Probes', value: String(project.simulation.probes.length) },
      { id: 'breakpoints', label: 'Breakpoints', value: String(project.simulation.breakpoints?.length ?? 0) },
      { id: 'boardSignals', label: 'Board Mappings', value: String(boardSignals) },
      { id: 'ioMapping', label: 'IO Mapping', value: `${ioInputs} inputs / ${ioOutputs} outputs` },
      { id: 'recordings', label: 'Recordings', value: `${recordings.length} runs / ${recordingEvents} events` },
      { id: 'evidenceActions', label: 'Evidence Actions', value: String(project.evidence.actions.length) },
      { id: 'evidenceSnapshots', label: 'Evidence Snapshots', value: String(project.evidence.snapshots.length) },
    ];

    const warnings: string[] = [];
    if (project.schemaVersion !== '1.0') {
      warnings.push(`Unsupported schema version: ${project.schemaVersion}`);
    }
    if (boardSignals > 0 && ioInputs + ioOutputs === 0) {
      warnings.push('Board mappings exist but IO mapping is empty');
    }
    if (project.simulation.probes.length === 0) {
      warnings.push('No probes configured (waveforms will be empty)');
    }

    setProjectSummaryReport({
      title: project.name || 'Project Summary',
      items,
      warnings,
    });
    setProjectSummaryOpen(true);
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

  const openDeterminismPanel = useCallback(() => setDeterminismPanelOpen(true), []);

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
      const desktopBounds = getDesktopBounds();
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

  // Install global error handlers (unhandled exceptions + rejections)
  useEffect(() => {
    const cleanupErrors = installErrorHandlers();
    const cleanupLeaks = import.meta.env.DEV ? startLeakMonitor() : () => { };
    return () => {
      cleanupErrors();
      cleanupLeaks();
    };
  }, []);

  // ── UI Scale Sync ───────────────────────────────────────────────────────────
  // Sync settingsStore.uiScale (100/110/125) to CSS variable --rb-ui-scale
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const scale = uiScale / 100; // Convert 100 → 1.0, 125 → 1.25
    document.documentElement.style.setProperty('--rb-ui-scale', String(scale));
  }, [uiScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleError = (event: ErrorEvent) => {
      logDiagnosticEvent({
        type: 'error',
        message: event.message || 'Unhandled error',
        details: event.error?.stack || event.filename || 'unknown',
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection';
      logDiagnosticEvent({
        type: 'rejection',
        message,
        details: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [logDiagnosticEvent]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      applyTheme(document.documentElement, themeVariant);
      document.documentElement.setAttribute('data-rb-density', density);
      document.documentElement.setAttribute('data-rb-scale', String(uiScale));
      const effectiveReduceMotion = reduceMotion || performanceMode;
      document.documentElement.setAttribute('data-rb-motion', effectiveReduceMotion ? 'reduced' : 'full');
      document.documentElement.setAttribute('data-rb-perf', performanceMode ? 'on' : 'off');
    }
  }, [themeVariant, density, uiScale, reduceMotion, performanceMode, snapAssist]);

  useEffect(() => {
    const current = {
      themeVariant: themeVariant,
      density: density,
      uiScale: uiScale,
      reduceMotion: reduceMotion || performanceMode,
      performanceMode: performanceMode,
      snapAssist: snapAssist,
    };
    if (!lastSettingsRef.current) {
      lastSettingsRef.current = current;
      return;
    }
    if (
      lastSettingsRef.current.themeVariant !== current.themeVariant ||
      lastSettingsRef.current.density !== current.density ||
      lastSettingsRef.current.uiScale !== current.uiScale ||
      lastSettingsRef.current.reduceMotion !== current.reduceMotion ||
      lastSettingsRef.current.performanceMode !== current.performanceMode ||
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
  }, [themeVariant, density, uiScale, reduceMotion, performanceMode, snapAssist]);

  // Workspace/Session restore on mount (idempotent - runs only once when booted becomes true)
  useEffect(() => {
    if (!booted) return;
    // Guard: only restore once per session lifecycle
    if (hasRestoredSessionRef.current) return;
    hasRestoredSessionRef.current = true;

    try {
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
        if (!app) return false;
        return canOpenAppForCurrentMode(w.contentId);
      });

      if (validWindows.length === 0) return;

      // Restore session to store
      const restoreSessionFn = useWindowStore.getState().restoreSession;
      restoreSessionFn(validWindows, snapshot.nextZIndex);

      // Bind all restored windows
      const newBindings: Record<string, WindowAppBinding> = {};
      validWindows.forEach((w) => {
        newBindings[w.id] = { appId: w.contentId };
      });
      setBindings(newBindings);

      // NOTE: No silent auto-restore toast. Restored windows are shown directly.
      // If restore corrupts state, the app will show error boundary, not crash silently.
    } catch (error) {
      // Restore failed - clear corrupted state and show clean shell
      console.error('[Shell] Session restore failed, starting fresh:', error);
      hasRestoredSessionRef.current = false; // Allow retry if needed
      setBindings({});
      clearJournal('session');
      unregisterAutosave('session');
    }
  }, [booted]);



  const openWindow = useCallback(
    (appId: string, props?: any) => {
      const firstRunState = loadFirstRunState();
      const resolvedAppId = resolveFirstRunTargetApp(appId, firstRunState);
      const isStudioLaunchRequest = appId === 'lab-workspace';

      if (isStudioLaunchRequest) {
        console.info('STUDIO_LAUNCH_REQUESTED');
      }

      if (isStudioLaunchRequest && resolvedAppId !== 'lab-workspace') {
        const block = getFirstRunBlockingReason(firstRunState);
        setStudioLaunchBlock(block);
        console.warn(`STUDIO_LAUNCH_BLOCKED reason=${block.machineReason}`);
      } else if (isStudioLaunchRequest) {
        setStudioLaunchBlock(null);
      }

      if (!canOpenAppForCurrentMode(resolvedAppId)) {
        if (isStudioLaunchRequest) {
          console.warn(`STUDIO_LAUNCH_BLOCKED reason=ModeGate(${resolvedAppId})`);
        }
        logSystemEvent({
          level: 'warn',
          source: 'shell',
          message: 'Blocked instructor-only app open in student mode',
          data: { appId: resolvedAppId, studentMode: isStudentModeActive() },
        });
        toast.info({ message: 'This tool is instructor-only.' });
        return null;
      }

      const app = getApp(resolvedAppId);
      if (!app) {
        if (isStudioLaunchRequest) {
          console.warn('STUDIO_LAUNCH_BLOCKED reason=AppNotFound(lab-workspace)');
        }
        logSystemEvent({
          level: 'error',
          source: 'shell',
          message: 'App not found',
          data: { appId: resolvedAppId },
        });
        console.warn(`[Shell] openWindow: app "${resolvedAppId}" not found in registry`);
        toast.error({ title: 'App unavailable', message: `"${resolvedAppId}" is not registered.` });
        return null;
      }

      recordRecentApp(resolvedAppId);

      if (app.manifest.singleton) {
        // Read current windows from the store directly to avoid stale closure
        const currentWindows = useWindowStore.getState().windows;
        const existing = currentWindows.find((w) => w.contentId === resolvedAppId);
        if (existing) {
          if (existing.mode === 'minimized') {
            restoreWindow(existing.id);
          }
          focusWindow(existing.id);
          setBindings((prev) => ({ ...prev, [existing.id]: { appId: resolvedAppId, props } }));
          logSystemEvent({
            level: 'action',
            source: 'shell',
            message: 'Window focused',
            data: { appId: resolvedAppId, windowId: existing.id, mode: existing.mode },
          });
          if (isStudioLaunchRequest && resolvedAppId === 'lab-workspace') {
            console.info(`STUDIO_LAUNCH_OPENED windowId=${existing.id}`);
          }
          recordDiagnosticAction(`Focus window: ${resolvedAppId}`);
          return existing.id;
        }
      }

      const state = createWindow({
        title: app.manifest.name,
        width: app.manifest.defaultSize?.width,
        height: app.manifest.defaultSize?.height,
        contentId: app.manifest.id,
      });

      trackWindowOpen(state.id);
      focusWindow(state.id);

      // Lab apps (logic-playground, lab-workspace) open maximized — no floating window OS metaphor
      const isLabApp = resolvedAppId === 'logic-playground' || resolvedAppId === 'lab-workspace';
      if (isLabApp) {
        toggleMaximize(state.id);
      }
      setBindings((prev) => ({ ...prev, [state.id]: { appId: resolvedAppId, props } }));
      logSystemEvent({
        level: 'action',
        source: 'shell',
        message: 'Window opened',
        data: { appId: resolvedAppId, windowId: state.id },
      });
      if (isStudioLaunchRequest && resolvedAppId === 'lab-workspace') {
        console.info(`STUDIO_LAUNCH_OPENED windowId=${state.id}`);
      }
      recordDiagnosticAction(`Open window: ${resolvedAppId}`);
      return state.id;
    },
    [createWindow, focusWindow, toggleMaximize, recordRecentApp, restoreWindow, recordDiagnosticAction]
  );

  // Auto-boot: open Logic Playground on first visit when no session was restored
  // Uses RAF so the session restore effect has settled before we check window count.
  // Guards: existing windows (session restore ran), explicit ?openApp= param.
  useEffect(() => {
    if (!booted) return;
    const hasExplicitApp = new URLSearchParams(window.location.search).has('openApp');
    if (hasExplicitApp) return;
    const raf = requestAnimationFrame(() => {
      if (useWindowStore.getState().windows.length === 0) {
        openWindow('logic-playground');
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [booted, openWindow]);

  // Helper callbacks that depend on openWindow
  const openLog = useCallback(() => openWindow('system-log'), [openWindow]);
  const openLauncher = useCallback(() => openWindow('launcher'), [openWindow]);
  const openSettings = useCallback(() => openWindow('settings'), [openWindow]);

  const loadImportedProject = useCallback(
    (
      project: LabProjectV1,
      circuit: Circuit,
      targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' = 'logic-playground',
      starterInstructions?: StarterInstructionsPayload,
    ) => {
      const baseName = (project.name || 'imported-circuit').trim();
      const safeName = baseName.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '');
      const filename = `${safeName || 'imported-circuit'}.rblogic`;
      const serialized = serialize(circuit);
      const contentStr = JSON.stringify(serialized);
      const fileId = useFileSystemStore.getState().createFile('documents', filename, contentStr);

      if (targetAppId === 'logic-playground') {
        openWindow('logic-playground', {
          resourceId: fileId,
          resourceType: 'file',
          starterInstructions: starterInstructions ?? undefined,
        });
      } else {
        openWindow(targetAppId, starterInstructions ? { starterInstructions } : undefined);
      }
    },
    [openWindow]
  );

  const hydrateImportedProject = useCallback(
    (
      project: LabProjectV1,
      source: 'user-file' | 'starter' | 'recovery',
      targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' = 'logic-playground',
      starterInstructions?: StarterInstructionsPayload,
    ) => {
      const compatibility = validateUnifiedProjectStoreCompatibility(project);
      if (!compatibility.compatible) {
        throw new Error(`Missing required fields: ${compatibility.missingFields.join(', ')}`);
      }

      prepareImportedProjectState(project, source);
      const warnings = getImportWarnings(project);

      currentProjectRef.current = project;
      loadUnifiedProject(project);

      const circuit = convertCircuitV1ToCircuit(project.circuit);
      loadImportedProject(project, circuit, targetAppId, starterInstructions);

      return {
        warnings,
        summary: generateImportSummary(project, true, warnings),
      };
    },
    [loadUnifiedProject, loadImportedProject]
  );

  const importStarterProject = useCallback(
    async (
      exampleId: ExampleId,
      targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' = 'logic-playground',
      starterInstructions?: StarterInstructionsPayload,
    ) => {
      const starterProject = loadExampleAsProject(exampleId);
      const capsule = await exportEvidenceCapsule(starterProject);
      const { project, integrity } = await importEvidenceCapsule(capsule);
      const { warnings, summary } = hydrateImportedProject(project, 'starter', targetAppId, starterInstructions);

      toast.success(summary);
      logSystemEvent({
        level: 'action',
        source: 'examples',
        message: `Loaded example starter: ${project.name}`,
        data: {
          projectId: project.projectId,
          exampleId,
          targetAppId,
          integrity: integrity.status,
          warningCount: warnings.length,
        },
      });
    },
    [hydrateImportedProject]
  );

  const handleLoadExample = useCallback(
    (
      exampleId: ExampleId,
      targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' = 'logic-playground',
      starterInstructions?: StarterInstructionsPayload,
    ) => {
      void importStarterProject(exampleId, targetAppId, starterInstructions).catch((error) => {
        console.error('Failed to load example starter:', error);
        toast.error(`Failed to load starter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    },
    [importStarterProject]
  );

  const handleOpenStarterProject = useCallback(
    (starter: {
      exampleId: ExampleId;
      targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace';
      starterId?: string;
      instructions?: StarterInstructionsPayload;
    }) => {
      handleLoadExample(starter.exampleId, starter.targetAppId, starter.instructions);
    },
    [handleLoadExample]
  );

  const decodeBase64Payload = useCallback((value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }, []);

  const handleOpenInstructorPackProject = useCallback(
    async (starter: {
      starterId: string;
      targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace';
      packId: string;
      projectArchiveBase64: string;
      instructions: StarterInstructionsPayload;
    }) => {
      try {
        const capsuleBytes = decodeBase64Payload(starter.projectArchiveBase64);
        const rbProject = await decodeInstructorProjectArchive(capsuleBytes);
        const project = rbProjectToLabProject(rbProject);
        const { warnings, summary } = hydrateImportedProject(project, 'starter', starter.targetAppId, starter.instructions);

        toast.success(summary);
        logSystemEvent({
          level: 'action',
          source: 'starter-pack',
          message: `Loaded instructor starter pack: ${project.name}`,
          data: {
            projectId: project.projectId,
            starterId: starter.starterId,
            packId: starter.packId,
            targetAppId: starter.targetAppId,
            warningCount: warnings.length,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to load instructor starter pack:', error);
        toast.error(`Failed to open instructor pack: ${message}`);
        logSystemEvent({
          level: 'error',
          source: 'starter-pack',
          message: 'Instructor starter pack import failed',
          data: {
            starterId: starter.starterId,
            packId: starter.packId,
            error: message,
          },
        });
      }
    },
    [decodeBase64Payload, hydrateImportedProject]
  );

  const handleOpenSubmissionProject = useCallback(
    async (payload: { project: RBProject; targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' }) => {
      try {
        const importedProject = rbProjectToLabProject(payload.project);
        const { warnings, summary } = hydrateImportedProject(importedProject, 'user-file', payload.targetAppId);
        if (warnings.length > 0) {
          console.warn('Submission import warnings:', warnings);
        }
        toast.success(summary);
        logSystemEvent({
          level: 'action',
          source: 'submission',
          message: `Opened submission project: ${importedProject.name}`,
          data: {
            projectId: importedProject.projectId,
            targetAppId: payload.targetAppId,
            warningCount: warnings.length,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to open submission project:', error);
        toast.error(`Failed to open submission project: ${message}`);
        logSystemEvent({
          level: 'error',
          source: 'submission',
          message: 'Submission project import failed',
          data: { error: message },
        });
      }
    },
    [hydrateImportedProject]
  );

  const handleOpenRecentProject = useCallback(
    async (payload: { projectId: string; targetAppId: 'logic-playground' | 'ece-lab' | 'lab-workspace' }) => {
      try {
        const autosaveKey = getCanonicalProjectAutosaveKey(payload.projectId);
        const autosave = loadRbprojAutosave(autosaveKey);
        if (!autosave) {
          toast.error(`No autosave data found for project "${payload.projectId}".`);
          return;
        }

        const rbProject = decodeRBProject(autosave.projectJson);
        const importedProject = rbProjectToLabProject(rbProject);
        const { warnings, summary } = hydrateImportedProject(importedProject, 'recovery', payload.targetAppId);
        if (warnings.length > 0) {
          console.warn('Recent project recovery warnings:', warnings);
        }

        toast.success(summary);
        logSystemEvent({
          level: 'action',
          source: 'recovery',
          message: `Recovered autosaved project: ${importedProject.name}`,
          data: {
            projectId: payload.projectId,
            targetAppId: payload.targetAppId,
            warningCount: warnings.length,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to recover recent project:', error);
        toast.error(`Failed to recover project: ${message}`);
        logSystemEvent({
          level: 'error',
          source: 'recovery',
          message: 'Recent project recovery failed',
          data: {
            projectId: payload.projectId,
            error: message,
          },
        });
      }
    },
    [hydrateImportedProject]
  );

  // Auto-launch Logic Playground from URL parameters (Deep Linking)
  useEffect(() => {
    if (!booted) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    // Check for rb://demo/{exampleId} URI pattern
    if (params.has('demo')) {
      const exampleId = params.get('demo') as ExampleId;
      handleLoadExample(exampleId);
      return;
    }

    // Check for Logic Playground specific parameters
    if (params.has('mode') || params.has('example') || params.has('circuit')) {
      // Open logic-playground (openWindow handles singleton check automatically)
      // We rely on the app itself to parse the params again and apply configuration
      openWindow('logic-playground');
    }
  }, [booted, openWindow, handleLoadExample]);

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
          const targetWindowId = resolveTargetWindowId(targetAppId, preferNewWindow, useWindowStore.getState().windows);

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
          const targetWindowId = resolveTargetWindowId(targetAppId, preferNewWindow, useWindowStore.getState().windows);

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
    [openWindow, bindings, focusWindow]

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
        if (!app) return false;
        return canOpenAppForCurrentMode(w.contentId);
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
      // Clean up autosave + journal + registered cleanups for this window
      unregisterAutosave(id);
      clearJournal(id);
      runWindowCleanup(id);

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

  // E2E convenience bridge: allow tests (and scripted P1C validation runs) to open/close windows
  // without brittle UI selectors. This is DEV/E2E only.
  const e2eWindowsRef = useRef(windows);
  const e2eOpenWindowRef = useRef(openWindow);
  const e2eHandleCloseRef = useRef(handleClose);

  useEffect(() => {
    e2eWindowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    e2eOpenWindowRef.current = openWindow;
  }, [openWindow]);

  useEffect(() => {
    e2eHandleCloseRef.current = handleClose;
  }, [handleClose]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const isE2E = params.get('e2e') === '1' || navigator.webdriver;
      if (!import.meta.env.DEV && !isE2E) return;

      (window as any).__RB_SHELL_E2E__ = {
        openWindow: (appId: string, props?: any) => e2eOpenWindowRef.current(appId, props),
        listWindows: () =>
          e2eWindowsRef.current.map((w) => ({ id: w.id, appId: w.contentId, mode: w.mode })),
        closeFirstWindowByAppId: (appId: string) => {
          const match = e2eWindowsRef.current.find((w) => w.contentId === appId);
          if (!match) return false;
          e2eHandleCloseRef.current(match.id);
          return true;
        },
      };
    } catch {
      // Never break boot for instrumentation
    }
  }, []);

  // Stable window event handlers - prevents React.memo bailout failures
  const windowHandlers = useRef<Record<string, {
    onClose: () => void;
    onFocus: () => void;
    onMove: (x: number, y: number) => void;
    onResize: (w: number, h: number) => void;
    onMoveEnd: (bounds: any) => void;
    onResizeEnd: (bounds: any) => void;
  }>>({});

  // Create stable callbacks for each window
  // Sync window handlers into ref during render (not in useEffect) so they
  // are available on the SAME render cycle a new window appears.  Using
  // useEffect caused a one-frame delay: the render ran first (handlers
  // undefined → window returned null), then the effect populated the ref,
  // but refs don't trigger re-renders so the window stayed invisible until
  // an unrelated state change forced another render pass.
  useMemo(() => {
    const handlers = windowHandlers.current;
    const currentWindowIds = new Set(windows.map(w => w.id));

    // Remove handlers for closed windows
    Object.keys(handlers).forEach(id => {
      if (!currentWindowIds.has(id)) {
        delete handlers[id];
      }
    });

    // Create handlers for new windows
    windows.forEach(window => {
      if (!handlers[window.id]) {
        handlers[window.id] = {
          onClose: () => handleClose(window.id),
          onFocus: () => {
            focusWindow(window.id);
            logSystemEvent({
              level: 'action',
              source: 'shell',
              message: 'Window focused',
              data: { windowId: window.id, appId: window.contentId },
            });
          },
          onMove: (x: number, y: number) => moveWindow(window.id, x, y),
          onResize: (w: number, h: number) => resizeWindow(window.id, w, h),
          onMoveEnd: (bounds: any) => handleMoveEnd(window.id, bounds),
          onResizeEnd: (bounds: any) => handleResizeEnd(window.id, bounds),
        };
      }
    });
  }, [windows, handleClose, focusWindow, moveWindow, resizeWindow, handleMoveEnd, handleResizeEnd]);

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

  // Export handler: convert current circuit to LabProjectV1 and download .rbx.zip
  const handleExportProof = useCallback(async () => {
    const actionId = 'export:evidence';
    const circuit = getCurrentCircuit();
    if (!circuit) {
      toast.error({ message: 'No circuit to export' });
      return;
    }

    progressStart(actionId, 'Exporting circuit evidence...');

    try {
      // Convert Circuit to CircuitV1 (LabProjectV1 schema)
      const circuitV1 = toCircuitV1(circuit);

      // Build minimal LabProjectV1
      const now = new Date().toISOString();
      const project: LabProjectV1 = {
        schemaVersion: '1.0',
        projectId: `project-${Date.now()}`,
        name: 'RedByte Circuit',
        description: 'Exported from RedByte Logic Playground',
        createdAt: now,
        updatedAt: now,
        circuit: circuitV1,
        simulation: {
          tickRate: 20,
          currentTick: determinismRecorder.tickCount || 0,
          probes: [],
        },
        ioMapping: {
          inputs: [],
          outputs: [],
        },
        evidence: {
          actions: [],
          snapshots: [],
        },
        recordings: [],
      };

      currentProjectRef.current = project;

      // Export to zip blob
      const blob = await exportEvidenceCapsule(project);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redbyte-circuit-${Date.now()}.rbx.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      progressSucceed(actionId, 'Circuit exported successfully');
      logSystemEvent({
        level: 'action',
        source: 'export',
        message: `Exported circuit: ${project.name}`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progressFail(actionId, {
        code: 'EXPORT_FAILED',
        studentMessage: 'Export failed. Click "Copy details" and send to your instructor.',
        details: {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          projectId: currentProjectRef.current?.projectId,
          nodeCount: circuit?.nodes?.length,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }, [getCurrentCircuit, determinismRecorder.tickCount]);



  const handleExportVerilog = useCallback(async () => {
    try {
      const project = currentProjectRef.current;
      if (!project) {
        toast.error('No project loaded');
        return;
      }

      // Dynamic import to avoid circular deps
      const {
        generateBitstreamArtifacts,
        validateVerilog,
        validateConstraints,
        calculateReadinessScore
      } = await import('@redbyte/rb-fpga-toolchain');

      const artifacts = await generateBitstreamArtifacts(project);

      // Validate generated Verilog
      const verilogResult = validateVerilog(artifacts.verilog);

      // Extract circuit signal names for constraint validation
      const circuitSignals = [...(verilogResult.moduleInfo?.inputs || []), ...(verilogResult.moduleInfo?.outputs || [])];
      const constraintResult = artifacts.constraints
        ? validateConstraints(artifacts.constraints, circuitSignals)
        : { valid: true, errors: [], warnings: [] };

      // Calculate readiness score
      const readinessScore = calculateReadinessScore(verilogResult, constraintResult);

      // Show validation feedback
      if (!verilogResult.valid) {
        toast.error({ message: `Verilog validation failed: ${verilogResult.errors.length} errors` });
        verilogResult.errors.slice(0, 3).forEach(err => {
          toast.error({ message: `${err.code}: ${err.message}${err.line ? ` (line ${err.line})` : ''}` });
        });
        return; // Don't export invalid Verilog
      }

      if (verilogResult.warnings.length > 0) {
        toast.warning(`${verilogResult.warnings.length} validation warnings - synthesis readiness: ${readinessScore}%`);
      }

      if (artifacts.metadata.unsupportedNodes.length > 0) {
        toast.warning(`Warning: ${artifacts.metadata.unsupportedNodes.length} unsupported nodes`);
      }

      // Download Verilog
      const verilogBlob = new Blob([artifacts.verilog], { type: 'text/plain' });
      const url = URL.createObjectURL(verilogBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.v`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also download constraints if available
      if (artifacts.constraints) {
        const xdcBlob = new Blob([artifacts.constraints], { type: 'text/plain' });
        const xdcUrl = URL.createObjectURL(xdcBlob);
        const xdcLink = document.createElement('a');
        xdcLink.href = xdcUrl;
        xdcLink.download = `${project.name.replace(/\s+/g, '_')}.xdc`;
        document.body.appendChild(xdcLink);
        xdcLink.click();
        document.body.removeChild(xdcLink);
        URL.revokeObjectURL(xdcUrl);
      }

      toast.success('Verilog exported successfully');
      logSystemEvent({
        level: 'action',
        source: 'fpga',
        message: 'Verilog exported',
        data: {
          projectId: project.projectId,
          verilogHash: artifacts.metadata.verilogHash,
          nodeCount: artifacts.metadata.nodeCount,
        },
      });
    } catch (error) {
      console.error('Verilog export failed:', error);
      toast.error(`Verilog export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const handleBuildBitstream = useCallback(async () => {
    try {
      const project = currentProjectRef.current;
      if (!project) {
        toast.error('No project loaded');
        return;
      }

      // Dynamic import to avoid circular deps (browser-safe parts only)
      const { generateBitstreamArtifacts } = await import('@redbyte/rb-fpga-toolchain');

      toast.info('Bitstream synthesis requires Vivado - run locally with toolchain installed');

      // Generate artifacts to show what would be synthesized
      const artifacts = await generateBitstreamArtifacts(project);

      if (artifacts.metadata.unsupportedNodes.length > 0) {
        toast.warning(`Warning: ${artifacts.metadata.unsupportedNodes.length} unsupported nodes - synthesis may fail`);
      }

      // Note: Actual synthesis requires Node.js environment with Vivado installed
      // This is a browser environment, so we only generate HDL artifacts
      toast.info('Verilog and constraints generated - synthesis requires local Vivado installation');

      logSystemEvent({
        level: 'action',
        source: 'fpga',
        message: 'Bitstream build requested (requires local toolchain)',
        data: {
          projectId: project.projectId,
          verilogHash: artifacts.metadata.verilogHash,
          nodeCount: artifacts.metadata.nodeCount,
        },
      });

      // Store artifacts for potential download
      currentProjectRef.current = {
        ...project,
        fpgaArtifacts: {
          ...artifacts,
          metadata: artifacts.metadata as unknown as Record<string, unknown>,
        },
      };
    } catch (error) {
      console.error('Bitstream build failed:', error);
      toast.error(`Bitstream build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logSystemEvent({
        level: 'error',
        source: 'fpga',
        message: 'Bitstream build error',
        data: { error: error instanceof Error ? error.message : 'Unknown' },
      });
    }
  }, []);

  const handleProgramBoard = useCallback(async () => {
    try {
      const project = currentProjectRef.current;
      if (!project) {
        toast.error('No project loaded');
        return;
      }

      // Check if bitstream was built
      const bitstreamPath = (project as any).fpgaArtifacts?.metadata?.bitstreamPath;
      if (!bitstreamPath) {
        toast.error('No bitstream available - build bitstream first using local Vivado installation');
        return;
      }

      toast.info('Board programming requires local toolchain - use rb-fpga-bridge or Vivado Hardware Manager');

      logSystemEvent({
        level: 'action',
        source: 'fpga',
        message: 'Board programming requested (requires local hardware)',
        data: {
          projectId: project.projectId,
          bitstreamPath
        },
      });
    } catch (error) {
      console.error('Board programming failed:', error);
      toast.error(`Board programming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logSystemEvent({
        level: 'error',
        source: 'fpga',
        message: 'Board programming error',
        data: { error: error instanceof Error ? error.message : 'Unknown' },
      });
    }
  }, []);

  const handleShowBitstreamProvenance = useCallback(async () => {
    try {
      const project = currentProjectRef.current;
      if (!project) {
        toast.error('No project loaded');
        return;
      }

      // Generate metadata
      const { generateBitstreamArtifacts } = await import('@redbyte/rb-fpga-toolchain');
      const artifacts = await generateBitstreamArtifacts(project);

      setBitstreamMetadata(artifacts.metadata);
      setBitstreamProvenanceOpen(true);

      logSystemEvent({
        level: 'action',
        source: 'fpga',
        message: 'Bitstream provenance viewed',
        data: { projectId: project.projectId },
      });
    } catch (error) {
      console.error('Failed to generate bitstream metadata:', error);
      toast.error(`Failed to generate metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Import handler: load .rbx.zip and reconstruct circuit
  const handleImportProject = useCallback(async () => {
    try {
      // Create file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.rbx.zip,.rb-lab.zip,.zip';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          // Import and verify integrity
          const blob = file;
          const { project, integrity } = await importEvidenceCapsule(blob);
          const { warnings, summary } = hydrateImportedProject(project, 'user-file', 'logic-playground');
          if (warnings.length > 0) {
            console.warn('Import warnings:', warnings);
          }
          toast.success(summary);

          // Log event for evidence trail
          logSystemEvent({
            level: 'action',
            source: 'import',
            message: `Imported project: ${project.name}`,
            data: {
              projectId: project.projectId,
              integrity: integrity.status,
              nodeCount: project.circuit.nodes.length,
              connectionCount: project.circuit.connections.length,
              hasWarnings: warnings.length > 0,
            },
          });
        } catch (error) {
          console.error('Import failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.error(`Import failed: ${errorMessage}`);

          logSystemEvent({
            level: 'error',
            source: 'import',
            message: 'Project import failed',
            data: { error: errorMessage },
          });
        }
      };

      input.click();
    } catch (error) {
      console.error('Import dialog failed:', error);
      toast.error('Failed to open import dialog');
    }
  }, [hydrateImportedProject]);

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

          const direction = command.replace('snap-', '') as 'left' | 'right' | 'top' | 'bottom';
          snapWindow(focused.id, direction, getDesktopBounds());
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

          centerWindow(focused.id, getDesktopBounds());
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
          window.dispatchEvent(new CustomEvent('rb:open-dock', { detail: { tab: 'learn', subview: 'manual' } }));
          break;
        }

        case 'project-import': {
          handleImportProject();
          break;
        }

        case 'project-export': {
          handleExportProof();
          break;
        }

        case 'project-verify': {
          handleVerifyReproducibility();
          break;
        }

        case 'project-summary': {
          handleProjectSummary();
          break;
        }

        case 'open-example': {
          setExamplePickerOpen(true);
          break;
        }

        case 'project-export-verilog': {
          handleExportVerilog();
          break;
        }

        case 'project-build-bitstream': {
          handleBuildBitstream();
          break;
        }

        case 'project-program-board': {
          handleProgramBoard();
          break;
        }

        case 'project-bitstream-provenance': {
          handleShowBitstreamProvenance();
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

  // P1C self-run (manual gate helper): if `?p1c=1` is present, automate a small,
  // deterministic open/mutate/close flow and emit a single `[render-storm:report]` JSON blob.
  // This enables "one paste" validation without hand-driving DevTools.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('p1c') !== '1') return;
      const anyWin = window as any;
      if (anyWin.__RB_P1C_SELF_RUN_STARTED__) return;
      anyWin.__RB_P1C_SELF_RUN_STARTED__ = true;

      // Ensure render-storm reporting is enabled from the first render.
      try {
        if (localStorage.getItem('rb:renderStormReport') !== '1') {
          localStorage.setItem('rb:renderStormReport', '1');
          // eslint-disable-next-line no-console
          console.info('RB_P1C_SELF_RUN_RELOAD');
          window.location.reload();
          return;
        }
      } catch {
        // ignore
      }

      const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

      const run = async () => {
        // Wait for API to exist (provided by `useRenderStormDetector` when reporting is enabled).
        for (let i = 0; i < 60; i++) {
          if (typeof anyWin.__RB_RENDER_STORM_API__?.markStep === 'function') break;
          await sleep(100);
        }

        anyWin.__RB_RENDER_STORM_API__?.markStep?.('os-idle');
        await sleep(1500);

        openWindow('logic-playground');
        anyWin.__RB_RENDER_STORM_API__?.markStep?.('logic-playground:open');
        await sleep(1500);

        // Mutate the canonical circuit store (no brittle UI selectors).
        try {
          const { useCircuitStore } = await import('@redbyte/rb-apps/stores/circuitStore');
          const s = useCircuitStore.getState();
          if (typeof (s as any).reset === 'function') (s as any).reset();
          s.addNode('NOT', { x: 80, y: 120 });
          s.addNode('NOT', { x: 92, y: 120 });
          s.addNode('NOT', { x: 104, y: 120 });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('RB_P1C_SELF_RUN_MUTATION_ERROR', err);
        }

        anyWin.__RB_RENDER_STORM_API__?.markStep?.('logic-playground:mutate');
        await sleep(1000);

        const closedLP = anyWin.__RB_SHELL_E2E__?.closeFirstWindowByAppId?.('logic-playground');
        if (!closedLP) {
          // eslint-disable-next-line no-console
          console.warn('RB_P1C_SELF_RUN_CLOSE_WARN', { appId: 'logic-playground' });
        }
        await sleep(750);

        openWindow('ece-lab');
        anyWin.__RB_RENDER_STORM_API__?.markStep?.('ece-lab:open');
        await sleep(1500);

        const closedLab = anyWin.__RB_SHELL_E2E__?.closeFirstWindowByAppId?.('ece-lab');
        if (!closedLab) {
          // eslint-disable-next-line no-console
          console.warn('RB_P1C_SELF_RUN_CLOSE_WARN', { appId: 'ece-lab' });
        }
        await sleep(750);

        anyWin.__RB_RENDER_STORM_API__?.markStep?.('open-close-cycle');
        await sleep(1000);

        const report = anyWin.__RB_RENDER_STORM_API__?.finalize?.();
        // eslint-disable-next-line no-console
        console.info('RB_P1C_SELF_RUN_DONE', { pass: report?.pass });
      };

      void run();
    } catch {
      // ignore
    }
  }, [openWindow]);

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
      const window = useWindowStore.getState().windows.find((w) => w.id === windowId);
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
    [restoreWindow, focusWindow]
  );

  const handleWindowSwitcherCancel = useCallback(() => {
    // Restore focus to previous window if valid
    if (windowSwitcherPreviousFocus) {
      const previousWindow = useWindowStore.getState().windows.find((w) => w.id === windowSwitcherPreviousFocus);
      if (previousWindow) {
        focusWindow(windowSwitcherPreviousFocus);
      }
    }

    // Close switcher
    setWindowSwitcherOpen(false);
    setWindowSwitcherPreviousFocus(null);
  }, [windowSwitcherPreviousFocus, focusWindow]);

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

      if (event.key === 'Escape') {
        const closed =
          (diagnosticsOpen && (setDiagnosticsOpen(false), true)) ||
          (commandPaletteOpen && (setCommandPaletteOpen(false), true)) ||
          (systemSearchOpen && (setSystemSearchOpen(false), true)) ||
          (windowSwitcherOpen && (setWindowSwitcherOpen(false), true)) ||
          (workspaceSwitcherOpen && (setWorkspaceSwitcherOpen(false), true)) ||
          (macroRunnerOpen && (setMacroRunnerOpen(false), true)) ||
          (reproCheckOpen && (setReproCheckOpen(false), true)) ||
          (projectSummaryOpen && (setProjectSummaryOpen(false), true)) ||
          (openWithModalState && (setOpenWithModalState(null), true)) ||
          (examplePickerOpen && (setExamplePickerOpen(false), true)) ||
          (aboutModalOpen && (setAboutModalOpen(false), true)) ||
          (onboardingModalOpen && (setOnboardingModalOpen(false), true)) ||
          (bitstreamProvenanceOpen && (setBitstreamProvenanceOpen(false), true));

        if (closed) {
          event.preventDefault();
          recordDiagnosticAction('Escape: close overlay');
          return;
        }
      }

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

      const focusedWindow = useWindowStore.getState().getFocusedWindow();
      const focusedWindowId = focusedWindow?.id;

      if (event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        setDiagnosticsOpen(true);
        recordDiagnosticAction('Shortcut: open diagnostics');
        return;
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        recordDiagnosticAction('Shortcut: export/save');
        window.dispatchEvent(new CustomEvent('rb:export-request', { detail: { windowId: focusedWindowId } }));
        return;
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        recordDiagnosticAction(event.shiftKey ? 'Shortcut: redo' : 'Shortcut: undo');
        window.dispatchEvent(new CustomEvent(event.shiftKey ? 'rb:history-redo' : 'rb:history-undo', { detail: { windowId: focusedWindowId } }));
        return;
      }

      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        recordDiagnosticAction('Shortcut: redo');
        window.dispatchEvent(new CustomEvent('rb:history-redo', { detail: { windowId: focusedWindowId } }));
        return;
      }

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

      // Cmd/Ctrl+/: Open About
      if (event.key === '/') {
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
  }, [
    hasSettings,
    openWindow,
    executeCommand,
    isDemoMode,
    diagnosticsOpen,
    commandPaletteOpen,
    systemSearchOpen,
    windowSwitcherOpen,
    workspaceSwitcherOpen,
    macroRunnerOpen,
    reproCheckOpen,
    projectSummaryOpen,
    openWithModalState,
    examplePickerOpen,
    aboutModalOpen,
    onboardingModalOpen,
    bitstreamProvenanceOpen,
    recordDiagnosticAction,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBlur = () => {
      setDiagnosticsOpen(false);
      setCommandPaletteOpen(false);
      setSystemSearchOpen(false);
      setWindowSwitcherOpen(false);
      setWorkspaceSwitcherOpen(false);
      setMacroRunnerOpen(false);
      setReproCheckOpen(false);
      setProjectSummaryOpen(false);
      setOpenWithModalState(null);
      setExamplePickerOpen(false);
      setAboutModalOpen(false);
      setOnboardingModalOpen(false);
      setBitstreamProvenanceOpen(false);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  useEffect(() => {
    startUiTickSampler();
    startPerfSummaryLogger();
  }, []);

  // SAFETY: Warn users before closing tab with open windows (potential unsaved work)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only warn if there are open application windows (excluding launcher)
      const hasOpenWork = useWindowStore.getState().windows.some(
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
  }, []);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, isDemoMode]);

  // Auto-boot Logic Playground on fresh load, and auto-reopen if closed (IDE sovereignty)
  useEffect(() => {
    if (!booted) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.has('openApp')) return;
    // Allow launcher mode via ?launcher=1
    if (params.get('launcher') === '1') return;

    // Auto-reopen Logic Playground whenever windows.length === 0 (no template grid fallback)
    if (windows.length > 0) return;

    let attempt = 0;
    const maxAttempts = 40; // 40 × 50ms = 2s bounded wait
    let timeoutId: NodeJS.Timeout | null = null;

    const tryBoot = () => {
      const latestParams = new URLSearchParams(window.location.search);
      if (latestParams.has('openApp')) return;
      if (latestParams.get('launcher') === '1') return;

      const latestWindows = useWindowStore.getState().windows;
      if (latestWindows.length > 0) return;

      // Check if logic-playground app is registered
      const app = getApp('logic-playground');
      if (!app) {
        attempt += 1;
        if (attempt < maxAttempts) {
          // Retry in 50ms
          timeoutId = setTimeout(tryBoot, 50);
          return;
        }
        // Max retries reached, log and give up
        console.warn('[Shell] Auto-reopen: logic-playground app not found after 2s');
        return;
      }

      // App is ready, open it (auto-reopen every time windows.length drops to 0)
      openWindow('logic-playground');
    };

    const raf = requestAnimationFrame(tryBoot);

    return () => {
      cancelAnimationFrame(raf);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [booted, windows.length, openWindow]);

  const snapPreviewBounds = useMemo(() => {
    if (!snapPreview || typeof window === 'undefined') return null;
    const desktop = getDesktopBounds();
    if (snapPreview.target === 'maximize') {
      return getMaximizedBounds();
    }
    const halfWidth = Math.floor(desktop.width / 2);
    if (snapPreview.target === 'left') {
      return { x: desktop.x, y: desktop.y, width: halfWidth, height: desktop.height };
    }
    return { x: desktop.x + halfWidth, y: desktop.y, width: halfWidth, height: desktop.height };
  }, [snapPreview]);

  if (!booted) {
    return <BootScreen onComplete={() => setBooted(true)} />;
  }

  const handleRecovery = (entries: RecoveryAction[]) => {
    // Open recovered windows
    for (const entry of entries) {
      if (entry.appId) {
        openWindow(entry.appId, { recoveredData: entry.data });
      }
    }
    setShowRecoveryPrompt(false);
  };

  const handleDiscardRecovery = () => {
    setShowRecoveryPrompt(false);
  };

  const determinismMode: DeterminismMode =
    determinismRecorder.isRecording
      ? 'recording'
      : determinismRecorder.isTimeTraveling
        ? 'replay'
        : 'live';
  const hasVisibleWindows = windows.some((w) => w.mode !== 'minimized');
  
  // IDE Sovereignty: Detect if Logic Playground is the only visible app (fullscreen IDE mode)
  const visibleWindows = windows.filter((w) => w.mode !== 'minimized');
  const isLogicPlaygroundOnly = visibleWindows.length === 1 && visibleWindows[0]?.contentId === 'logic-playground';
  
  // Show OS chrome (TopBar/Dock/Taskbar) only when no windows exist OR when more than just Logic Playground is visible
  const showOSChrome = !hasVisibleWindows || !isLogicPlaygroundOnly;

  const snapPreviewLabel = snapPreview
    ? snapPreview.target === 'maximize'
      ? 'Maximize'
      : snapPreview.target === 'left'
        ? 'Snap Left'
        : 'Snap Right'
    : null;

  return (
    <div data-testid="desktop-shell" className="shell-container rb-shell rb-ui-lab-grid-bg relative w-screen h-screen overflow-hidden">
      <a href="#rb-desktop-region" className="rb-skip-link">Skip to desktop</a>
      {showRecoveryPrompt && (
        <RecoveryPrompt onRecover={handleRecovery} onDiscard={handleDiscardRecovery} />
      )}
      {/* TopBar hides when Logic Playground is the only visible window — IDEModeNav provides all navigation inside the IDE */}
      {showOSChrome && (
        <TopBar
          isRecording={determinismRecorder.isRecording}
          modeLabel={determinismMode}
          tickCount={determinismRecorder.tickCount}
          versionLabel={getVersionString()}
          unreadCount={unreadLogCount}
          onOpenLog={studentModeEnabled ? undefined : openLog}
          onOpenLauncher={openLauncher}
          onOpenSettings={openSettings}
          onOpenDeterminism={openDeterminismPanel}
        />
      )}
      <Desktop
        onOpenApp={openWindow}
        wallpaperId={wallpaperId}
        themeVariant={themeVariant}
      />

      {/* Dock and Taskbar only on the home screen — both hide when Logic Playground is the only visible window.
          Navigation inside the IDE is handled by IDEModeNav. */}
      {showOSChrome && <Dock onOpenApp={openWindow} />}
      {showOSChrome && <Taskbar onOpenApp={openWindow} />}

      {!hasVisibleWindows && (
        <HomeScreen
          onOpenApp={(appId) => {
            if (appId === 'import-project') {
              handleImportProject();
            } else {
              openWindow(appId);
            }
          }}
          onOpenExample={(exampleId) => {
            dispatchIntent({
              type: 'open-example',
              payload: {
                sourceAppId: 'home',
                targetAppId: 'logic-playground',
                exampleId,
              },
            });
          }}
          determinismMode={determinismMode}
          tickCount={determinismRecorder.tickCount}
          isRecording={determinismRecorder.isRecording}
          hasRecording={determinismRecorder.hasRecording}
          logEntryCount={systemLogEntries.length}
          hasProofPack={
            determinismRecorder.verificationResult
              ? determinismRecorder.verificationResult.equal === true
              : false
          }
          verificationStatus={
            determinismRecorder.verificationResult
              ? determinismRecorder.verificationResult.equal
                ? 'pass'
                : 'fail'
              : undefined
          }
        />
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
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-semibold tracking-[0.2em] uppercase border"
                style={{ background: 'var(--rb-surface-2)', borderColor: 'var(--rb-border-strong)', color: 'var(--rb-accent)' }}
              >
                {snapPreviewLabel}
              </div>
            )}
          </div>
        </div>
      )}

      {windowIds.map((windowId) => {
        const handlers = windowHandlers.current[windowId];
        if (!handlers) return null;
        return (
          <ShellWindowEntry
            key={windowId}
            windowId={windowId}
            binding={bindings[windowId]}
            handlers={handlers}
            snapAssist={snapAssist}
            determinismTick={determinismRecorder.tickCount}
            openWindow={openWindow}
            handleClose={handleClose}
            handleSnapPreviewChange={handleSnapPreviewChange}
            handleSnapCommit={handleSnapCommit}
            toggleMinimize={toggleMinimize}
            toggleMaximize={toggleMaximize}
            restoreWindow={restoreWindow}
            dispatchIntent={dispatchIntent}
            registerWindowStateAccessor={registerWindowStateAccessor}
            unregisterWindowStateAccessor={unregisterWindowStateAccessor}
            determinismRecorder={determinismRecorder}
            getCurrentCircuit={getCurrentCircuit}
            handleOpenStarterProject={handleOpenStarterProject}
            handleOpenInstructorPackProject={handleOpenInstructorPackProject}
            handleOpenRecentProject={handleOpenRecentProject}
            handleOpenSubmissionProject={handleOpenSubmissionProject}
            recentAppIds={recentAppIds}
            pinnedAppIds={pinnedAppIds}
            runningAppIds={runningAppIds}
            togglePinnedAppId={togglePinnedAppId}
          />
        );
      })}

      <ToastContainer />
      <ProgressToasts onOpenHelp={(errorCode) => window.dispatchEvent(new CustomEvent('rb:open-dock', { detail: { tab: 'learn', subview: 'help', errorCode } }))} />
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

      {reproCheckOpen && reproCheckReport && (
        <Modal
          isOpen={reproCheckOpen}
          onClose={() => setReproCheckOpen(false)}
          title={reproCheckReport.passed ? 'Reproducibility Check: PASS' : 'Reproducibility Check: FAIL'}
          width={520}
          height={420}
        >
          <div className="p-6 space-y-4">
            <div className="text-sm text-slate-300">
              {reproCheckReport.passed
                ? 'All checks passed. Project should reproduce deterministically.'
                : 'Some checks failed. Fix issues before exporting to other machines.'}
            </div>
            <ul className="space-y-2">
              {reproCheckReport.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-2 text-sm">
                  <span className={check.passed ? 'text-emerald-400' : 'text-red-400'}>
                    {check.passed ? 'OK' : 'X'}
                  </span>
                  <div>
                    <div className="text-slate-200">{check.label}</div>
                    {check.details && (
                      <div className="text-slate-500 text-xs">{check.details}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setReproCheckOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {projectSummaryOpen && projectSummaryReport && (
        <Modal
          isOpen={projectSummaryOpen}
          onClose={() => setProjectSummaryOpen(false)}
          title={`Project Summary: ${projectSummaryReport.title}`}
          width={560}
          height={520}
        >
          <div className="p-6 space-y-4">
            {projectSummaryReport.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <div className="font-semibold uppercase tracking-wide text-[10px]">Warnings</div>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  {projectSummaryReport.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {projectSummaryReport.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-slate-400">{item.label}</div>
                  <div className="text-sm text-slate-100 text-right break-all">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {diagnosticsOpen && diagnosticsSnapshot && (
        <Modal
          isOpen={diagnosticsOpen}
          onClose={() => setDiagnosticsOpen(false)}
          title="Session Diagnostics"
          width={620}
          height={560}
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Captures last action, autosave timestamp, and error events for support.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyDiagnostics}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-100"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={handleExportDiagnostics}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Export JSON
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-200">
              <div><strong>Last Action:</strong> {diagnosticsSnapshot.session.lastAction ?? 'None'}</div>
              <div>
                <strong>Last Autosave:</strong>{' '}
                {diagnosticsSnapshot.session.lastAutosaveAt
                  ? new Date(diagnosticsSnapshot.session.lastAutosaveAt).toLocaleString()
                  : 'Unknown'}
              </div>
              <div><strong>Open Windows:</strong> {diagnosticsSnapshot.session.openWindows.length}</div>
              <div><strong>Safe Mode:</strong> {diagnosticsSnapshot.session.safeMode ? 'On' : 'Off'}</div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[10px] text-slate-400 overflow-auto h-64">
              <pre className="whitespace-pre-wrap">{JSON.stringify(diagnosticsSnapshot, null, 2)}</pre>
            </div>

            {diagnosticEvents.length === 0 ? (
              <div className="text-xs text-slate-500">No diagnostic events recorded.</div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Recent Events</div>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {diagnosticEvents.slice(0, 10).map((eventItem) => (
                    <div key={eventItem.id} className="text-[11px] text-slate-300 flex items-start gap-2">
                      <span className="text-slate-500">{new Date(eventItem.timestamp).toLocaleTimeString()}</span>
                      <span className="uppercase text-[10px] text-slate-400">{eventItem.type}</span>
                      <span>{eventItem.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
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
          windows={[...useWindowStore.getState().windows].sort((a, b) => a.zIndex - b.zIndex)}
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

      {studioLaunchBlock && (
        <Modal
          isOpen={Boolean(studioLaunchBlock)}
          onClose={() => setStudioLaunchBlock(null)}
          title="Studio launch blocked"
          width={520}
          height={260}
        >
          <div className="p-6 space-y-4" data-testid="studio-launch-block-modal">
            <div className="text-sm text-slate-200">{studioLaunchBlock.humanReason}</div>
            <div className="text-xs text-slate-400">
              Open First Run Wizard and complete <strong>{studioLaunchBlock.stepLabel}</strong> to continue.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStudioLaunchBlock(null)}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-100"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudioLaunchBlock(null);
                  openWindow('first-run-wizard');
                }}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-cyan-700 hover:bg-cyan-600 text-white"
              >
                Open First Run Wizard
              </button>
            </div>
          </div>
        </Modal>
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

      {/* About Modal */}
      {aboutModalOpen && (
        <AboutModal
          isOpen={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />
      )}

      {/* Example Picker Modal */}
      <ExamplePicker
        open={examplePickerOpen}
        onClose={() => setExamplePickerOpen(false)}
        onSelectExample={handleLoadExample}
      />

      {/* Bitstream Provenance Modal */}
      {bitstreamMetadata && (
        <BitstreamProvenanceModal
          isOpen={bitstreamProvenanceOpen}
          onClose={() => setBitstreamProvenanceOpen(false)}
          metadata={bitstreamMetadata}
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

      {/* Recent Log Widget: above the Evidence Bar */}
      <RecentLogWidget onOpenLog={openLog} />

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
        recordingEventCount={determinismRecorder.eventCount}
        hasProofPack={
          determinismRecorder.verificationResult
            ? determinismRecorder.verificationResult.equal === true
            : false
        }
        onExportProof={handleExportProof}
      />
    </div>
  );
};
