import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { restoreAutoSave } from './use-auto-save';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Restore auto-saved workspace on app load
restoreAutoSave().catch(console.warn);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
