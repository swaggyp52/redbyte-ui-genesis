import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerAllApps } from '@redbyte/rb-apps';
import { initializeStoreInstrumentation, installFatalCapture, pushMount } from '@redbyte/rb-utils';
import { bootstrapIDE } from './ide-bootstrap';
import '../index.css';

const FULL_BOOT_ENTRY = 'full-bootstrap.ts';

// Full bootstrap: all startup code (previously in main.tsx)
export async function bootstrap() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isLauncherMode = params.get('launcher') === '1';
  const mode = isLauncherMode ? 'SHELL' : 'IDE';
  const url = typeof window !== 'undefined' ? window.location.href : 'unknown';

  console.log(`[RB_BOOT] mode=${mode} url=${url} entry=${FULL_BOOT_ENTRY}`);

  if (isLauncherMode) {
    return bootstrapShell();
  }

  try {
    await bootstrapIDE();
  } catch (error) {
    renderIdeBootCrash(error);
  }
}

function renderIdeBootCrash(error: unknown) {
  const root = document.getElementById('root');
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  document.documentElement.dataset.redbyteMode = 'ide-crash';
  console.error(`[RB_BOOT] mode=IDE status=CRASH entry=${FULL_BOOT_ENTRY} message=${message}`);

  if (!root) {
    console.error('[RB_BOOT] mode=IDE status=CRASH reason=missing-root');
    return;
  }

  ReactDOM.createRoot(root).render(
    React.createElement(
      'div',
      {
        'data-testid': 'rb-ide-boot-crash',
        'data-redbyte-crash': 'ide',
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100vw',
          height: '100vh',
          background: '#0f0f0f',
          color: '#f8fafc',
          fontFamily: 'monospace',
          padding: '24px',
          boxSizing: 'border-box',
          textAlign: 'left',
        },
      },
      React.createElement('h1', { style: { margin: 0, fontSize: '20px', color: '#ef4444' } }, 'RedByte IDE failed to boot'),
      React.createElement('p', { style: { marginTop: '12px', marginBottom: '8px', maxWidth: '900px' } }, message),
      React.createElement(
        'pre',
        {
          style: {
            margin: 0,
            padding: '12px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '50vh',
            overflow: 'auto',
            border: '1px solid #334155',
            borderRadius: '6px',
            background: '#020617',
            color: '#cbd5e1',
          },
        },
        stack ?? 'No stack trace available.'
      )
    )
  );
}

// Old logic moved to bootstrapShell
// rb-shell is lazy-loaded here so the default IDE path never pays for it.
async function bootstrapShell() {
  // Install fatal capture always (production preview needs diagnostics for demo)
  installFatalCapture({ force: true });
  pushMount('BOOT: fatal-capture-installed');
  console.log('RB_FATAL_CAPTURE_INSTALLED');

  // Register all apps (non-blocking - Shell must boot even if apps fail)
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isE2ELite = params.get('e2e') === '1';
  const isBootOnly = params.get('boot') === '1';
  const opts = isBootOnly ? { mode: 'e2e-boot' } : isE2ELite ? { mode: 'e2e-lite' } : undefined;

  console.log('RB_APPS_REGISTER_START', opts ?? { mode: 'full' });
  const startedAt = performance.now();

  // Do NOT await here. Boot must continue even if registration fails/hangs.
  registerAllApps(opts as any)
    .then(() => {
      console.log('RB_APPS_REGISTERED', { ms: Math.round(performance.now() - startedAt) });
    })
    .catch((err) => {
      console.error('RB_APPS_REGISTER_FAILED', err);
    });

  // Safety: if registration hangs, tell us explicitly.
  setTimeout(() => {
    console.warn('RB_APPS_REGISTER_TIMEOUT', { ms: 5000, mode: (opts as any)?.mode ?? 'full' });
  }, 5000);

  // Instrument page lifecycle
  if (navigator.webdriver) {
    try {
      const logClose = (type: string, extra?: any) => {
        const payload = {
          type,
          ts: Date.now(),
          visibilityState: document.visibilityState,
          persisted: Boolean(extra?.persisted),
          url: window.location.href,
        };
        try {
          localStorage.setItem('__RB_LAST_CLOSE__', JSON.stringify(payload));
        } catch {}
        console.info('RB_CLOSE_SIGNAL', JSON.stringify(payload));
      };

      window.addEventListener('beforeunload', () => logClose('beforeunload'));
      window.addEventListener('pagehide', (ev: any) => logClose('pagehide', { persisted: ev?.persisted }));
      window.addEventListener('unload', () => logClose('unload'));
      window.addEventListener('visibilitychange', () => logClose('visibilitychange'));

      const logNav = (subtype: string, detail?: any) => {
        const payload = {
          subtype,
          ts: Date.now(),
          from: window.location.href,
          to: detail?.to ?? window.location.href,
        };
        console.info('RB_NAV', JSON.stringify(payload));
      };

      const originalReload = window.location.reload.bind(window.location);
      (window.location as any).reload = function () {
        logNav('reload');
        originalReload();
      };

      const originalPushState = history.pushState.bind(history);
      (history as any).pushState = function (data: any, title: string, url?: string | URL | null) {
        try {
          const to = url ? String(url) : undefined;
          logNav('pushState', { to });
        } catch {}
        return originalPushState(data, title, url as any);
      };

      const originalReplaceState = history.replaceState.bind(history);
      (history as any).replaceState = function (data: any, title: string, url?: string | URL | null) {
        try {
          const to = url ? String(url) : undefined;
          logNav('replaceState', { to });
        } catch {}
        return originalReplaceState(data, title, url as any);
      };
    } catch {}
  }

  if (import.meta.env.DEV) {
    initializeStoreInstrumentation();
    pushMount('BOOT: store-instrumentation-initialized');
  }

  // Lazy-load rb-shell only when actually needed (launcher mode)
  const { Shell, ErrorBoundary } = await import('@redbyte/rb-shell');

  // Render Shell
  const root = document.getElementById('root');
  if (root) {
    ReactDOM.createRoot(root).render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          ErrorBoundary,
          null,
          React.createElement(Shell, null)
        )
      )
    );
  }
}

