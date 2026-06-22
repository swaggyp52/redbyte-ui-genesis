import React from 'react';
import { createPortal } from 'react-dom';
import type { IdeBuildIdentity } from '../buildIdentity';

export interface IdeHelpMenuProps {
  buildIdentity?: IdeBuildIdentity;
  onKeyboardShortcuts?: () => void;
}

type HelpPanel = 'about' | 'diagnostics' | null;

export const IdeHelpMenu: React.FC<IdeHelpMenuProps> = ({
  buildIdentity,
  onKeyboardShortcuts,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<HelpPanel>(null);
  const portalHost = typeof document === 'undefined'
    ? null
    : document.querySelector('.ide-root') ?? document.body;

  React.useEffect(() => {
    if (!menuOpen && panel === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setPanel(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, panel]);

  return (
    <div className="ide-help-menu" data-testid="ide-help-menu">
      <button
        type="button"
        className="ide-topbar-help-btn"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen ? 'true' : 'false'}
        title="Help"
        data-testid="ide-topbar-help-btn"
      >
        Help
      </button>
      {menuOpen && portalHost ? createPortal(
        <div className="ide-help-menu-popover" role="menu" data-testid="ide-help-menu-popover">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPanel('about');
            }}
            data-testid="ide-help-about"
          >
            About RedByte
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPanel('diagnostics');
            }}
            data-testid="ide-help-diagnostics"
          >
            Diagnostics
          </button>
          {onKeyboardShortcuts ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onKeyboardShortcuts();
              }}
              data-testid="ide-help-keyboard"
            >
              Keyboard shortcuts
            </button>
          ) : null}
        </div>,
        portalHost
      ) : null}
      {panel && portalHost ? createPortal(
        <HelpDialog
          panel={panel}
          buildIdentity={buildIdentity}
          onClose={() => setPanel(null)}
        />,
        portalHost
      ) : null}
    </div>
  );
};

const HelpDialog: React.FC<{
  panel: Exclude<HelpPanel, null>;
  buildIdentity?: IdeBuildIdentity;
  onClose: () => void;
}> = ({ panel, buildIdentity, onClose }) => {
  const diagnosticsBundle = React.useMemo(
    () => (panel === 'diagnostics' ? buildSupportDiagnosticsBundle(buildIdentity) : ''),
    [buildIdentity, panel]
  );
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');

  React.useEffect(() => {
    setCopyState('idle');
  }, [panel]);

  const copyDiagnostics = React.useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard unavailable');
      }
      await navigator.clipboard.writeText(diagnosticsBundle);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }, [diagnosticsBundle]);

  return (
    <div className="ide-help-dialog-backdrop" role="presentation">
      <section
        className="ide-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ide-help-dialog-${panel}-title`}
        data-testid={panel === 'about' ? 'ide-about-dialog' : 'ide-diagnostics-dialog'}
      >
        <header className="ide-help-dialog-header">
          <div>
            <span className="ide-help-dialog-kicker">Help</span>
            <h2 id={`ide-help-dialog-${panel}-title`}>
              {panel === 'about' ? 'About RedByte' : 'Diagnostics'}
            </h2>
          </div>
          <button
            type="button"
            className="ide-help-dialog-close"
            onClick={onClose}
            aria-label="Close help dialog"
            data-testid="ide-help-dialog-close"
          >
            Close
          </button>
        </header>
        {panel === 'about' ? (
          <div className="ide-help-dialog-body">
            <p>
              RedByte is a browser workspace for building, checking, mapping, and exporting
              classroom FPGA labs.
            </p>
            <p>
              The app can generate project files and keep the workflow state organized. Vivado
              build logs, board programming, and physical board observations are recorded outside
              this browser workspace.
            </p>
          </div>
        ) : (
          <div className="ide-help-dialog-body ide-diagnostics-grid">
            <DiagnosticRow label="Build fingerprint" value={buildIdentity?.fullSha ?? 'dev'} />
            <DiagnosticRow label="Environment" value={buildIdentity?.envLabel ?? 'dev'} />
            <DiagnosticRow label="Built" value={buildIdentity?.buildDate ?? 'local session'} />
            <DiagnosticRow
              label="Evidence boundary"
              value="Browser package generation only; external build and board records are separate."
            />
            <DiagnosticRow label="Project" value={readRuntimeSummary().project} />
            <DiagnosticRow label="Mode" value={readRuntimeSummary().mode} />
            <DiagnosticRow label="Checks" value={readRuntimeSummary().checks} />
            <DiagnosticRow label="Storage" value={readRuntimeSummary().storage} />
            <div className="ide-diagnostics-support">
              <div className="ide-diagnostics-support-header">
                <span>Support bundle</span>
                <button
                  type="button"
                  className="ide-button ide-button-secondary"
                  onClick={copyDiagnostics}
                  data-testid="ide-diagnostics-copy-bundle"
                >
                  Copy support bundle
                </button>
              </div>
              <pre data-testid="ide-diagnostics-support-bundle">{diagnosticsBundle}</pre>
              <span
                className="ide-diagnostics-copy-state"
                aria-live="polite"
                data-testid="ide-diagnostics-copy-state"
              >
                {copyState === 'copied'
                  ? 'Support bundle copied.'
                  : copyState === 'failed'
                    ? 'Clipboard unavailable. Select the bundle text to copy.'
                    : 'Ready to copy for TA support.'}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const DiagnosticRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="ide-diagnostics-row">
    <span>{label}</span>
    <code>{value}</code>
  </div>
);

function readRuntimeSummary(): {
  project: string;
  mode: string;
  checks: string;
  storage: string;
} {
  if (typeof window === 'undefined') {
    return {
      project: 'server render',
      mode: 'unknown',
      checks: 'unknown',
      storage: 'unavailable',
    };
  }

  const runtime = (window as any).__RB_PROJECT_RUNTIME__?.getState?.();
  const root = document.querySelector('[data-testid="ide-root"]') as HTMLElement | null;
  const mode =
    new URLSearchParams(window.location.search).get('mode') ||
    document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ||
    'project';
  const projectName = typeof runtime?.projectName === 'string' ? runtime.projectName : 'Untitled Project';
  const projectId = typeof runtime?.projectId === 'string' ? runtime.projectId : 'unknown-project';
  const scenario = Array.isArray(runtime?.scenarios)
    ? runtime.scenarios.find((entry: { id?: string }) => entry?.id === runtime.activeScenarioId)
    : null;
  const lastRun = runtime?.verifyLastRun;
  const storageKeys = readStorageKeys();
  const savedAt = typeof runtime?.lastSavedAt === 'string' && runtime.lastSavedAt.trim()
    ? runtime.lastSavedAt.trim()
    : 'not saved in this session';

  return {
    project: `${projectName} (${projectId})`,
    mode,
    checks: `${scenario?.name ?? 'Default'} / ${runtime?.scenarioAuthority ?? 'unknown'} / ${
      lastRun?.status ?? 'not run'
    }`,
    storage: `${storageKeys.length} RedByte keys; ${savedAt}; build ${root?.dataset.buildSha ?? 'dev'}`,
  };
}

function buildSupportDiagnosticsBundle(buildIdentity?: IdeBuildIdentity): string {
  if (typeof window === 'undefined') {
    return JSON.stringify({ redbyteDiagnostics: 1, runtime: 'server-render' }, null, 2);
  }

  const runtime = (window as any).__RB_PROJECT_RUNTIME__?.getState?.();
  const root = document.querySelector('[data-testid="ide-root"]') as HTMLElement | null;
  const mode =
    new URLSearchParams(window.location.search).get('mode') ||
    document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ||
    'project';
  const activeScenario = Array.isArray(runtime?.scenarios)
    ? runtime.scenarios.find((entry: { id?: string }) => entry?.id === runtime.activeScenarioId)
    : null;
  const lastRun = runtime?.verifyLastRun;
  const storageKeys = readStorageKeys();

  return JSON.stringify(
    {
      redbyteDiagnostics: 1,
      collectedAtIso: new Date().toISOString(),
      build: {
        fullSha: buildIdentity?.fullSha ?? root?.dataset.buildFullSha ?? 'dev',
        shortSha: root?.dataset.buildSha ?? 'dev',
        environment: buildIdentity?.envLabel ?? 'dev',
        builtAt: buildIdentity?.buildDate ?? 'local session',
      },
      app: {
        mode,
        urlPath: window.location.pathname,
        studentUiContract: root?.dataset.studentUiContract ?? null,
        workspaceStatus: document.querySelector('[data-testid="ide-proof-ribbon-evidence"]')?.textContent?.trim() ?? null,
      },
      project: {
        id: runtime?.projectId ?? null,
        name: runtime?.projectName ?? null,
        kind: runtime?.projectKind ?? null,
        sourceExampleId: runtime?.sourceExampleId ?? null,
        nodeCount: runtime?.circuit?.nodes?.length ?? null,
        wireCount: runtime?.circuit?.wires?.length ?? null,
      },
      verify: {
        activeScenarioId: runtime?.activeScenarioId ?? null,
        activeScenarioName: activeScenario?.name ?? null,
        scenarioAuthority: runtime?.scenarioAuthority ?? null,
        lastRunStatus: lastRun?.status ?? null,
        lastRunKind: lastRun?.runKind ?? null,
        lastRunScenarioId: lastRun?.scenarioId ?? null,
        lastRunReportHash: lastRun?.reportHash ?? null,
        dirtySinceVerify: runtime?.projectHealthCore?.dirtySinceVerify ?? null,
      },
      storage: {
        redbyteKeyCount: storageKeys.length,
        keys: storageKeys,
        sessionMetaPresent: storageKeys.includes('rb.ide.sessionMeta.v1'),
        runtimeStatePresent: storageKeys.includes('rb.ide.project-runtime.v1'),
        savedProjectIndexPresent: storageKeys.includes('rb.ide.projects.v1.index'),
      },
      browser: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        userAgent: navigator.userAgent,
        online: navigator.onLine,
      },
    },
    null,
    2
  );
}

function readStorageKeys(): string[] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith('rb-') || key.startsWith('rb.'))
      .sort();
  } catch {
    return [];
  }
}
