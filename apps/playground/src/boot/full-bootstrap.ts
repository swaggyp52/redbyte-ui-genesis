import React from 'react';
import ReactDOM from 'react-dom/client';
import { Shell, ErrorBoundary } from '@redbyte/rb-shell';
import { registerAllApps } from '@redbyte/rb-apps';
import { initializeStoreInstrumentation, installFatalCapture, pushMount } from '@redbyte/rb-utils';
import '../index.css';

// Full bootstrap: all startup code (previously in main.tsx)
export async function bootstrap() {
  // Install instrumentation
  if (import.meta.env.DEV || navigator.webdriver) {
    installFatalCapture();
    pushMount('BOOT: fatal-capture-installed');
    console.log('RB_FATAL_CAPTURE_INSTALLED');
  }

  // Register all apps BEFORE rendering Shell to avoid lazy loading during render
  try {
    await registerAllApps();
    console.log('RB_APPS_REGISTERED');
  } catch (err) {
    console.error('RB_APPS_REGISTRATION_FAILED', err);
    throw err;
  }

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
