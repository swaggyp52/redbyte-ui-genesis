import React from 'react';
import ReactDOM from 'react-dom/client';
import { Shell, ErrorBoundary } from '@redbyte/rb-shell';
import { registerAllApps } from '@redbyte/rb-apps';
import { initializeStoreInstrumentation, installFatalCapture, pushMount } from '@redbyte/rb-utils';
import { bootstrapIDE } from './ide-bootstrap';
import '../index.css';

// Full bootstrap: all startup code (previously in main.tsx)
export async function bootstrap() {
  // PHASE A: Check if this is IDE mode or launcher mode
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isLauncherMode = params.get('launcher') === '1';
  
  // If ?launcher=1, use Shell (OS mode). Otherwise, use IDE (direct render).
  if (isLauncherMode) {
    return bootstrapShell();
  } else {
    return bootstrapIDE();
  }
}

// Old logic moved to bootstrapShell
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
