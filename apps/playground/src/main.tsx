// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// SAFETY: Prevent modulepreload of Three.js in boot-bisect mode to avoid temporal dead zone errors
const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const isBisect = params.get('boot') === 'bisect' || import.meta.env.VITE_BOOT_BISECT === '1';
const bisectStep = Number(params.get('step') || '0');

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
  import('./boot/bisect-steps').then(m => m.runBisect(bisectStep));
} else {
  // NORMAL MODE: full bootstrap
  import('./boot/full-bootstrap').then(m => m.bootstrap());
}
