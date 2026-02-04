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
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const isE2ELite = params.get('e2e') === '1';
        const isBootOnly = params.get('boot') === '1';
        await registerAllApps(isBootOnly ? { mode: 'e2e-boot' } : isE2ELite ? { mode: 'e2e-lite' } : undefined);
        console.log('RB_APPS_REGISTERED');
    }
    catch (err) {
        console.error('RB_APPS_REGISTRATION_FAILED', err);
        throw err;
    }
    // Instrument page lifecycle
    if (navigator.webdriver) {
        try {
            const logClose = (type, extra) => {
                const payload = {
                    type,
                    ts: Date.now(),
                    visibilityState: document.visibilityState,
                    persisted: Boolean(extra?.persisted),
                    url: window.location.href,
                };
                try {
                    localStorage.setItem('__RB_LAST_CLOSE__', JSON.stringify(payload));
                }
                catch { }
                console.info('RB_CLOSE_SIGNAL', JSON.stringify(payload));
            };
            window.addEventListener('beforeunload', () => logClose('beforeunload'));
            window.addEventListener('pagehide', (ev) => logClose('pagehide', { persisted: ev?.persisted }));
            window.addEventListener('unload', () => logClose('unload'));
            window.addEventListener('visibilitychange', () => logClose('visibilitychange'));
            const logNav = (subtype, detail) => {
                const payload = {
                    subtype,
                    ts: Date.now(),
                    from: window.location.href,
                    to: detail?.to ?? window.location.href,
                };
                console.info('RB_NAV', JSON.stringify(payload));
            };
            const originalReload = window.location.reload.bind(window.location);
            window.location.reload = function () {
                logNav('reload');
                originalReload();
            };
            const originalPushState = history.pushState.bind(history);
            history.pushState = function (data, title, url) {
                try {
                    const to = url ? String(url) : undefined;
                    logNav('pushState', { to });
                }
                catch { }
                return originalPushState(data, title, url);
            };
            const originalReplaceState = history.replaceState.bind(history);
            history.replaceState = function (data, title, url) {
                try {
                    const to = url ? String(url) : undefined;
                    logNav('replaceState', { to });
                }
                catch { }
                return originalReplaceState(data, title, url);
            };
        }
        catch { }
    }
    if (import.meta.env.DEV) {
        initializeStoreInstrumentation();
        pushMount('BOOT: store-instrumentation-initialized');
    }
    // Render Shell
    const root = document.getElementById('root');
    if (root) {
        ReactDOM.createRoot(root).render(React.createElement(React.StrictMode, null, React.createElement(ErrorBoundary, null, React.createElement(Shell, null))));
    }
}
