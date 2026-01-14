import React from 'react';
import ReactDOM from 'react-dom/client';

// Bisect steps 0-5: progressively import modules (from the original implementation)
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
        // Minimal React only (no CSS import)
        renderMarker(0);
        break;
      }
      case 1: {
        // Import Shell module ONLY (no render)
        await import('@redbyte/rb-shell');
        renderMarker(1);
        break;
      }
      case 2: {
        // Render Shell (routing/window manager) without any instrumentation
        const shell = await import('@redbyte/rb-shell');
        const shellEl = React.createElement(shell.Shell);
        renderMarker(2, React.createElement('div', { style: { marginTop: 8 } }, shellEl));
        break;
      }
      case 3: {
        // Import LogicPlaygroundApp module ONLY (no render)
        await import('@redbyte/rb-apps');
        renderMarker(3);
        break;
      }
      case 4: {
        // Step 4: Apps are now registered dynamically, so can't render component directly
        // This step is now a no-op (apps are loaded via registerAllApps in normal bootstrap)
        renderMarker(4);
        break;
      }
      case 5: {
        // Control: render Shell without instrumentation
        const shell = await import('@redbyte/rb-shell');
        const shellEl = React.createElement(shell.Shell);
        renderMarker(5, React.createElement('div', { style: { marginTop: 8 } }, shellEl));
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

