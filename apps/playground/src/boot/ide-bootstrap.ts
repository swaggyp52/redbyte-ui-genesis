/**
 * IDE Bootstrap: Render RedByte IDE as a standalone IDE (no Shell, no window manager)
 * 
 * This bypasses the entire window system and renders the IDE as a fullscreen app.
 * No dragging. No minimize. No window chrome. Just the IDE.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary, registerAllApps } from '@redbyte/rb-apps';
import { initializeStoreInstrumentation, installFatalCapture, pushMount } from '@redbyte/rb-utils';
import '../index.css';
import '../ide/ide-root.css';

export async function bootstrapIDE() {
  // Install fatal capture  
  installFatalCapture({ force: true });
  pushMount('BOOT_IDE: fatal-capture-installed');
  console.log('RB_IDE_BOOT_START');

  // Register all apps (non-blocking)
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isE2ELite = params.get('e2e') === '1';
  const opts = isE2ELite ? { mode: 'e2e-lite' } : undefined;
  
  console.log('RB_APPS_REGISTER_START (IDE)', opts ?? { mode: 'full' });
  const startedAt = performance.now();

  registerAllApps(opts as any)
    .then(() => {
      console.log('RB_APPS_REGISTERED (IDE)', { ms: Math.round(performance.now() - startedAt) });
    })
    .catch((err) => {
      console.error('RB_APPS_REGISTER_FAILED', err);
    });

  // Safety: if registration hangs, tell us explicitly
  setTimeout(() => {
    console.warn('RB_APPS_REGISTER_TIMEOUT (IDE)', { ms: 5000 });
  }, 5000);

  if (import.meta.env.DEV) {
    initializeStoreInstrumentation();
    pushMount('BOOT_IDE: store-instrumentation-initialized');
  }

  // Render IDE directly (no Shell)
  const root = document.getElementById('root');
  if (root) {
    // Mark root as IDE mode for CSS 
    root.setAttribute('data-ide-mode', 'true');
    
    // Dynamically import IdeApp to avoid circular dependency with Three.js
    const { IdeApp } = await import('@redbyte/rb-apps/src/apps/IdeApp');

    ReactDOM.createRoot(root).render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          ErrorBoundary,
          null,
          React.createElement(IdeApp)
        )
      )
    );
  }

  pushMount('BOOT_IDE: render-complete');
  console.log('RB_IDE_BOOT_COMPLETE');
}
