// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Shell } from '@redbyte/rb-shell';
import './index.css';
import { LauncherSearchPanel } from './LauncherSearchPanel';
import { useLauncherSearchToggle } from './useLauncherSearchToggle';

export function PlaygroundRoot() {
  const { isLauncherOpen, closeLauncher, shellRef } = useLauncherSearchToggle();

  return (
    <div ref={shellRef} tabIndex={-1} className="relative h-full" data-testid="playground-shell">
      <Shell />
      {isLauncherOpen && <LauncherSearchPanel onClose={closeLauncher} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlaygroundRoot />

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="relative h-full">
      <Shell />
      <LauncherSearchPanel />
    </div>
  </React.StrictMode>
);
