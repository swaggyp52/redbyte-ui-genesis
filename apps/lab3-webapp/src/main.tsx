import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppErrorBoundary } from './AppErrorBoundary';
import { restoreAutoSave } from './use-auto-save';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Restore auto-saved workspace on app load
restoreAutoSave().catch(console.warn);

ReactDOM.createRoot(root).render(
  <AppErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </AppErrorBoundary>
);
