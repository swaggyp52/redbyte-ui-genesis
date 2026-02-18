/**
 * IDE Bootstrap: Render RedByte IDE as the standalone default surface.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { IdeApp, registerAllApps } from '@redbyte/rb-apps';
import { initializeStoreInstrumentation, installFatalCapture, pushMount } from '@redbyte/rb-utils';
import '../index.css';
import '../ide/ide-root.css';

declare const __RB_VITE_CONFIG__: string;

const IDE_BOOT_ENTRY = 'ide-bootstrap.ts';

type IDECrashBoundaryState = {
  hasError: boolean;
  message?: string;
  stack?: string;
};

class IDECrashBoundary extends React.Component<{ children: React.ReactNode }, IDECrashBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): IDECrashBoundaryState {
    return {
      hasError: true,
      message: error.message,
      stack: error.stack,
    };
  }

  componentDidCatch(error: Error) {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.redbyteMode = 'ide-crash';
    }
    console.error(`[RB_BOOT] mode=IDE status=CRASH entry=${IDE_BOOT_ENTRY} message=${error.message}`);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement(
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
            padding: '24px',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
          },
        },
        React.createElement('h1', { style: { margin: 0, fontSize: '20px', color: '#ef4444' } }, 'RedByte IDE crashed'),
        React.createElement('p', { style: { marginTop: '12px', marginBottom: '8px' } }, this.state.message ?? 'Unknown error'),
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
          this.state.stack ?? 'No stack trace available.'
        )
      );
    }

    return this.props.children;
  }
}

function getViteConfigName(): string {
  try {
    return __RB_VITE_CONFIG__;
  } catch {
    return 'unknown';
  }
}

export async function bootstrapIDE() {
  installFatalCapture({ force: true });
  pushMount('BOOT_IDE: fatal-capture-installed');

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isE2ELite = params.get('e2e') === '1';
  const opts = isE2ELite ? { mode: 'e2e-lite' } : undefined;

  const url = typeof window !== 'undefined' ? window.location.href : 'unknown';
  const configName = getViteConfigName();
  console.log(`[RB_BOOT] mode=IDE url=${url} entry=${IDE_BOOT_ENTRY} config=${configName}`);

  console.log('[RB_BOOT] RB_APPS_REGISTER_START (IDE)', opts ?? { mode: 'full' });
  const startedAt = performance.now();

  registerAllApps(opts as any)
    .then(() => {
      console.log('[RB_BOOT] RB_APPS_REGISTERED (IDE)', { ms: Math.round(performance.now() - startedAt) });
    })
    .catch((err) => {
      console.error('[RB_BOOT] RB_APPS_REGISTER_FAILED', err);
    });

  setTimeout(() => {
    console.warn('[RB_BOOT] RB_APPS_REGISTER_TIMEOUT (IDE)', { ms: 5000 });
  }, 5000);

  if (import.meta.env.DEV) {
    initializeStoreInstrumentation();
    pushMount('BOOT_IDE: store-instrumentation-initialized');
  }

  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Missing #root element');
  }

  try {
    ReactDOM.createRoot(root).render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          IDECrashBoundary,
          null,
          React.createElement(IdeApp, null)
        )
      )
    );
    pushMount('BOOT_IDE: render-complete');
    console.log('[RB_BOOT] mode=IDE status=READY');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    document.documentElement.dataset.redbyteMode = 'ide-crash';
    console.error(`[RB_BOOT] mode=IDE status=CRASH entry=${IDE_BOOT_ENTRY} message=${message}`);
    throw error;
  }
}

