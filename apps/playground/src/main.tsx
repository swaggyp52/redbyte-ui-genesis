// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { installAuditGuards, isAuditEnabled } from './boot/audit-guards';

// SAFETY: Prevent modulepreload of Three.js in boot-bisect mode to avoid temporal dead zone errors
const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const isBisect = params.get('boot') === 'bisect' || import.meta.env.VITE_BOOT_BISECT === '1';
const bisectStep = Number(params.get('step') || '0');
const isE2E = params.get('e2e') === '1' || import.meta.env.VITE_E2E === '1';
const isAudit = isAuditEnabled(params);

// 3) Temporary Crash Beacon for Playwright triage
const isGoldenPath = import.meta.env.VITE_GOLDEN_PATH === '1' || params.get('golden') === '1';

if (isGoldenPath) {
  console.log('RB_GOLDEN_PATH_ACTIVE');
  import('react').then(m => {
    console.log('[GOLDEN_IMPORT] react loaded');
    const React = m.default;
    import('react-dom/client').then(m2 => {
      console.log('[GOLDEN_IMPORT] react-dom/client loaded');
      const ReactDOM = m2;
      import('@redbyte/rb-apps').then(({ PlaygroundGoldenPath }) => {
        console.log('[GOLDEN_IMPORT] PlaygroundGoldenPath loaded');
        console.log('[GOLDEN_IMPORT] About to createRoot');
        const root = document.getElementById('root');
        if (!root) {
          console.error('[GOLDEN_IMPORT] ERROR: no root element found');
          return;
        }
        const reactRoot = ReactDOM.createRoot(root);
        console.log('[GOLDEN_IMPORT] Root created, JSX construction about to begin');
        const element = React.createElement(PlaygroundGoldenPath);
        console.log('[GOLDEN_IMPORT] JSX element created, about to render');
        reactRoot.render(element);
        console.log('[GOLDEN_IMPORT] Render method called - waiting for React to flush...');
        
        // Safety hook to check if React completes render
        setTimeout(() => {
          const hasContent = root.children.length > 0;
          console.log(`[GOLDEN_IMPORT_RENDER_CHECK] React rendered? ${hasContent}, children: ${root.children.length}`);
        }, 100);
      }).catch(e => {
        console.error('[GOLDEN_IMPORT] ERROR loading PlaygroundGoldenPath:', e);
      });
    }).catch(e => {
      console.error('[GOLDEN_IMPORT] ERROR loading react-dom/client:', e);
    });
  }).catch(e => {
    console.error('[GOLDEN_IMPORT] ERROR loading react:', e);
  });
} else if (typeof window !== 'undefined') {
  const renderCrashBeacon = (message: string) => {
    let beacon = document.querySelector('[data-testid="rb-crash-beacon"]');
    if (!beacon) {
      beacon = document.createElement('div');
      beacon.setAttribute('data-testid', 'rb-crash-beacon');
      beacon.style.setProperty('display', 'none');
      document.body.appendChild(beacon);
    }
    beacon.textContent = message;
  };

  window.addEventListener('error', (event) => {
    const error = event.error || { message: event.message };
    (window as any).__rb_crash = { message: error.message, stack: error.stack };
    renderCrashBeacon(error.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    (window as any).__rb_crash = { message: String(reason), stack: reason?.stack };
    renderCrashBeacon(String(reason));
  });
}

installAuditGuards(isAudit);

console.log('RB_MAIN_SEARCH_PARAMS', { isE2E, isBisect, bisectStep });

// Heartbeat check to detect main thread blocking
if (isE2E) {
  setTimeout(() => console.log('RB_HEARTBEAT_1'), 0);
  setTimeout(() => console.log('RB_HEARTBEAT_2'), 50);
  setTimeout(() => console.log('RB_HEARTBEAT_3'), 100);
}

if (isE2E) {
  // DEV/E2E-only bridge to exercise mutation guards in preview builds
  import('./debug/e2e-bridge').then((m) => {
    console.log('RB_E2E_BRIDGE_LOADED');
    m.installE2EBridge?.();
  }).catch((err) => console.error('RB_E2E_BRIDGE_ERROR', err));
}

if (isBisect && bisectStep === -1) {
  // SAFETY: Remove modulepreload links before they auto-load and trigger Three.js TDZ error
  document.querySelectorAll('link[rel="modulepreload"][href*="vendor-3d"]').forEach(el => el.remove());
  document.querySelectorAll('link[rel="modulepreload"][href*="rb-apps"]').forEach(el => el.remove());
  document.querySelectorAll('link[rel="modulepreload"][href*="app-"]').forEach(el => el.remove());
}

console.log('RB_MAIN_LOADED', location.href);

// Minimal dispatcher: conditionally import bisect vs. full bootstrap
console.log('RB_DISPATCHER_READY', { isBisect, bisectStep });

if (isBisect && bisectStep === -1) {
  // SPECIAL: TRUE STEP 0 — inline only, no imports beyond React
  console.log('RB_BOOT_TRUE_STEP0_PATH');
  import('react').then(m => {
    const React = m.default;
    import('react-dom/client').then(m2 => {
      const ReactDOM = m2;
      const root = document.getElementById('root');
      if (root) {
        console.info('RB_BOOT_TRUE_STEP0', location.href);
        ReactDOM.createRoot(root).render(
          React.createElement('div', {
            id: 'boot-bisect',
            'data-step': 'true-0',
            style: { padding: 16, color: '#9ae6b4' }
          }, 'BOOT_BISECT TRUE STEP 0')
        );
      }
    });
  });
} else if (isBisect) {
  // BISECT MODE: conditional steps
  import('./boot/bisect-steps').then(m => m.runBisect(bisectStep)).catch(renderBootLoadFailure);
} else {
  // NORMAL MODE: full bootstrap
  import('./boot/full-bootstrap').then(m => m.bootstrap()).catch(renderBootLoadFailure);
}

// A stale deployment window can 404 the hashed boot chunk. Without this the
// student gets a blank page; render a visible reload path instead.
function renderBootLoadFailure(error: unknown) {
  console.error('RB_BOOT_CHUNK_LOAD_FAILED', error);
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = '';
  const panel = document.createElement('div');
  panel.setAttribute('data-testid', 'rb-boot-load-failure');
  panel.style.cssText = 'max-width:520px;margin:15vh auto 0;padding:24px;border:1px solid #b8c3cd;border-radius:8px;background:#f7f8fa;color:#1c2732;font-family:system-ui,sans-serif;';
  const title = document.createElement('h1');
  title.textContent = 'RedByte did not finish loading';
  title.style.cssText = 'margin:0 0 8px;font-size:20px;';
  const body = document.createElement('p');
  body.textContent = 'Part of the application could not be downloaded. This usually resolves after a reload, which fetches the current files.';
  body.style.cssText = 'margin:0 0 16px;font-size:14px;color:#526170;';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload RedByte';
  reload.style.cssText = 'min-height:40px;padding:0 18px;border:1px solid #2b5f92;border-radius:6px;background:#356fa8;color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
  reload.addEventListener('click', () => window.location.reload());
  panel.append(title, body, reload);
  root.appendChild(panel);
}
