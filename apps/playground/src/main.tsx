// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Shell, ErrorBoundary } from '@redbyte/rb-shell';
import { initializeStoreInstrumentation } from '@redbyte/rb-utils';
import './index.css';

// Initialize dev-only store instrumentation for React #185 detection
if (import.meta.env.DEV) {
  initializeStoreInstrumentation();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  </React.StrictMode>
);
