import React from 'react';
import ReactDOM from 'react-dom/client';

// Bisect steps for boot diagnostics
export async function runBisect(step: number) {
  const root = document.getElementById('root')!;
  const renderMarker = (n: number, children?: React.ReactNode) => {
    const marker = React.createElement(
      'div',
      { id: 'boot-bisect', 'data-step': n, style: { padding: 16, color: '#9ae6b4' } },
      `BOOT_BISECT STEP ${n}`,
      children
    );
    ReactDOM.createRoot(root).render(marker);
  };

  try {
    switch (step) {
      case 0: {
        renderMarker(0);
        break;
      }
      case 1: {
        await import('@redbyte/rb-apps');
        renderMarker(1);
        break;
      }
      default:
        renderMarker(step);
    }
  } catch (e) {
    const errorDiv = React.createElement(
      'div',
      { id: 'boot-bisect', 'data-step': step, style: { padding: 16, color: '#fca5a5' } },
      `BOOT_BISECT STEP ${step} ERROR: ${String(e)}`
    );
    ReactDOM.createRoot(root).render(errorDiv);
  }
}
