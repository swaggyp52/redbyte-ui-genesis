// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Standalone entry point for Logic Lab app (student-facing)

import React from 'react';
import ReactDOM from 'react-dom/client';
import LogicLabApp from '../../../packages/rb-apps/src/apps/LogicLabApp';

// Minimal CSS reset
const style = document.createElement('style');
style.textContent = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #root { width: 100%; height: 100%; background: #0a0a0a; overflow: hidden; }
`;
document.head.appendChild(style);

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <LogicLabApp />
    </React.StrictMode>
  );
}
